# Deploying Dispatch to an EC2 server

The app is one Node.js process (web UI + API + scheduler) behind nginx, with a PostgreSQL database and a folder for PDFs.

```
Browser ──HTTPS──► nginx (443) ──► Node app 127.0.0.1:3000 ──► PostgreSQL (RDS / existing server)
                                        │                    └► ./data/pdfs on the EC2 disk
                                        └── scheduler ──HTTPS──► Microsoft Graph (sends the emails)
```

## 0. Before you start (things to get from other teams)

| Item | From | Used for |
|---|---|---|
| Entra ID app: **Tenant ID, Client ID, Client secret** with `Mail.Send` (Application) + admin consent | M365 / IT admin | Sending emails |
| **Sender mailbox**, e.g. `articles@yourdomain.com` (shared mailbox is fine) | M365 / IT admin | "From" address |
| **PostgreSQL** database + user that can create tables | DBA / AWS | App data |
| **DNS name**, e.g. `dispatch.yourdomain.com` → EC2 Elastic IP | Network / DNS | HTTPS URL |
| Who should be able to open the app (office IP range / VPN) | You / security | Security group |

## 1. EC2 instance

- **Size:** `t3.small` (2 GB RAM) is plenty. On `t3.micro`, add 2 GB swap or `npm run build` can run out of memory.
- **OS:** Ubuntu 24.04 LTS (commands below) or Amazon Linux 2023 (use `dnf` instead of `apt`).
- **Disk:** 20 GB gp3, which holds the PDFs.
- **Elastic IP** attached, so the address doesn't change.
- **Security group:**
  - Inbound **443** (and 80 for the certificate) **only from the office IP / VPN range**, because this is an admin tool with one shared password.
  - Inbound **22** from your IP only.
  - Do **not** open 3000.
  - Outbound: the default (all) is fine. The app needs outbound 443 to `login.microsoftonline.com` and `graph.microsoft.com`, and 5432 to the database.

## 2. Install software (once)

```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs git nginx certbot python3-certbot-nginx
sudo npm install -g pm2
node -v   # must be 20+
```

## 3. Database

Use **Amazon RDS for PostgreSQL** (recommended: automatic backups) or your existing UAT/production Postgres server.

```sql
CREATE DATABASE dispatch;
CREATE USER dispatch_app WITH PASSWORD 'strong-password';
GRANT ALL PRIVILEGES ON DATABASE dispatch TO dispatch_app;
\c dispatch
GRANT ALL ON SCHEMA public TO dispatch_app;
```

The app creates its tables automatically on first start (it also creates a small `drizzle` schema to track migrations, so the user needs create rights on the database).

**RDS + SSL:** use `?sslmode=require` in the URL and trust the RDS certificate authority:

```bash
sudo curl -o /etc/ssl/certs/rds-global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

Then uncomment `NODE_EXTRA_CA_CERTS` in `deploy/ecosystem.config.cjs`.

## 4. Get the code and configure

```bash
sudo mkdir -p /srv/dispatch /srv/dispatch-data && sudo chown -R $USER /srv/dispatch /srv/dispatch-data
git clone <your-private-repo-url> /srv/dispatch
cd /srv/dispatch
cp .env.example .env
nano .env
```

Production `.env`:

```bash
ADMIN_PASSWORD=<long strong password>
SESSION_SECRET=<output of: openssl rand -hex 32>
COOKIE_SECURE=true

EMAIL_PROVIDER=graph
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
MAIL_FROM_ADDRESS=articles@yourdomain.com
MAIL_FROM_NAME=Medical Affairs Team

DATABASE_URL=postgres://dispatch_app:<password>@<db-host>:5432/dispatch?sslmode=require
DATA_DIR=/srv/dispatch-data
APP_TIMEZONE=Asia/Kolkata
```

```bash
chmod 600 .env          # secrets: readable by the app user only
npm ci
npm run build
```

## 5. Run it with PM2 (auto-restart + start on boot)

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup             # run the command it prints (sudo ...)
pm2 install pm2-logrotate
curl http://127.0.0.1:3000/api/health     # {"ok":true,"scheduler":"running",...}
```

Keep it at **one instance**. Don't use PM2 cluster mode or several servers: the scheduler and the send pacing (30/min per mailbox) live in the process.

## 6. nginx + HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/dispatch
sudo nano /etc/nginx/sites-available/dispatch            # set server_name
sudo ln -s /etc/nginx/sites-available/dispatch /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d dispatch.yourdomain.com          # free certificate, auto-renews
```

`client_max_body_size 30m` in that file is required. Without it, PDF uploads over 1 MB fail.

*(Alternative: an AWS Application Load Balancer with an ACM certificate in front, forwarding to port 3000 on the instance; health check path `/api/health`.)*

## 7. Go-live checks (end to end)

1. Open `https://dispatch.yourdomain.com` and sign in.
2. **Settings** shows *Microsoft 365 (Graph) · In use*, scheduler *Running*, database *PostgreSQL*.
3. Upload the real doctors sheet.
4. Create an article and click **Send test** to your own address. Check it arrives with the PDF, and appears in the sender mailbox's *Sent Items*.
5. Schedule an article "In 2 minutes" to a small list (e.g. a sheet with 2–3 colleagues). Confirm it sends by itself and the article becomes *Paused*.
6. Upload the full list. You're live.

If a test fails, the reason is shown on the send's page in **Activity**:

| Error | Fix |
|---|---|
| `Microsoft sign-in failed` | Tenant ID, client ID or secret is wrong, or the secret expired |
| `Graph 403` | `Mail.Send` application permission missing, admin consent not granted, or the app is restricted from that mailbox |
| `Graph 404` | `MAIL_FROM_ADDRESS` mailbox doesn't exist |

## 8. Day-2 operations

| Task | How |
|---|---|
| Deploy a new version | `cd /srv/dispatch && git pull && npm ci && npm run build && pm2 restart dispatch`. Avoid doing this while a send is in progress (check Activity). |
| Logs | `pm2 logs dispatch` |
| Health monitoring | Point an uptime check (CloudWatch Synthetics, UptimeRobot, …) at `https://…/api/health`. It returns 503 if the database or scheduler is down. |
| Backups | RDS automated backups for the database; an EBS snapshot (AWS Backup / Data Lifecycle Manager) for `/srv/dispatch-data` (PDFs) |
| Client secret expiry | Entra client secrets expire (6–24 months). Put a reminder in the calendar to rotate it in `.env`, then `pm2 restart dispatch`. |
| Server reboot | PM2 brings the app back automatically. Sends due while it was down go out on start if less than 2 h late, otherwise they show as *Missed*. |

## Notes

- **Sending speed:** 30 emails/minute (Exchange Online's limit per mailbox), so 300 doctors take about 10 minutes.
- **Mailbox limit:** Exchange Online allows 10,000 recipients/day per mailbox, well above what's needed.
- **SPF/DKIM:** emails go out through your own Microsoft 365 mailbox, so your domain's existing SPF/DKIM setup applies. No extra DNS work is needed for deliverability.
- **No inbound email:** the server never receives email, and no SMTP ports need opening.
