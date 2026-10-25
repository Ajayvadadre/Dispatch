# Dispatch: scheduled article emails for doctors

Upload a doctors list once (Excel), attach an article PDF, choose when it goes out (once, daily or weekly), and Dispatch emails **each doctor individually** with the PDF attached. Every delivery is tracked and failures can be retried.

This is the pilot version. It runs entirely on one laptop: no database server or cloud account is needed.

---

## Setup (any Windows/Mac laptop)

Requires **Node.js 20+** (`node -v` to check).

```bash
git clone <repo-url> article-mailer
cd article-mailer
npm install
npm run setup               # creates .env (password: dispatch)
npm run dev
```

Open **http://localhost:3000** and sign in with the `ADMIN_PASSWORD` from `.env`.

The first start creates the database in `./data/` automatically. Nothing else needs installing, and the app works without internet except for actually sending emails via SMTP/Microsoft 365.

> For a faster, production-like run: `npm run build` once, then `npm start`.

### Moving to another machine

- **Without git:** zip the project folder *without* `node_modules`, `.next` and `data`, then unzip and follow the steps above.
- **Keep existing doctors/articles/history:** stop the app on both machines and copy the `data` folder across. Otherwise the new machine starts empty; just upload the doctors sheet again.
- **`.env` is not in git:** run `npm run setup` on the new machine, then copy over any email settings (SMTP/Graph) you'd configured.
- **Only one machine should send real emails.** If two machines have the same articles scheduled with a real email provider, both will send. Keep the others on `EMAIL_PROVIDER=console`.
- **Scheduled sends need the app running and the laptop awake.** Set Windows *Power & battery → Screen and sleep → "When plugged in, put my device to sleep after" → Never* on demo days, and keep the terminal open.

### Troubleshooting on office laptops

| Problem | Fix |
|---|---|
| `npm install` hangs or fails behind the company proxy | `npm config set proxy http://proxy-host:port` and `npm config set https-proxy http://proxy-host:port` |
| `npm install` fails with `SELF_SIGNED_CERT_IN_CHAIN` (company SSL inspection) | Ask IT for the company root certificate, then `npm config set cafile C:\path\company-root.pem` and set `NODE_EXTRA_CA_CERTS` to the same file |
| Emails fail with `fetch failed` / timeouts on the office network | The network needs a proxy for outbound HTTPS. Start the app with the proxy set in the terminal (not in `.env`; Node reads these at startup, Node 22.21+ / 24): PowerShell `$env:HTTPS_PROXY="http://proxy-host:port"; $env:NODE_USE_ENV_PROXY="1"; npm run dev` |
| `Port 3000 is in use` | Another app uses it: `npm run dev -- -p 3005`, then open http://localhost:3005 |
| PowerShell says "running scripts is disabled" for `npm` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt |

### Sample data

`sample/doctors-sample.xlsx` (24 fictional doctors at `example.com`) and `sample/sample-article.pdf` are included for demos. Regenerate them with `npm run samples`.

---

## Demo walkthrough (about 5 minutes)

1. **Doctors → Upload Excel** → pick `sample/doctors-sample.xlsx` → review the changes → *Update doctors list*.
2. **Articles → New article** → drop `sample/sample-article.pdf` → choose *One time* → click **In 2 minutes** → *Schedule article*.
3. On the article page click **Send test** to email just yourself.
4. Wait for the scheduled time (the Overview counts down). The send starts on its own; open it from **Activity** to watch each doctor's email go out live.
5. Optional: **Send now** sends immediately; **Stop sending** halts a send in progress; **Retry failed** re-sends failures.
   Tip: add a doctor with an address ending in `.invalid` (e.g. `test@clinic.invalid`) to demo a failed delivery in console mode.

---

## Email delivery modes

Set `EMAIL_PROVIDER` in `.env` and restart the app.

| Mode | What happens | When to use |
|---|---|---|
| `console` (default) | Nothing leaves the laptop. Every email is fully processed, tracked and previewable in the app. | Rehearsals, demos with dummy data |
| `smtp` | Real emails through any SMTP mailbox | Temporary real sending until Microsoft 365 is approved |
| `graph` | Real emails from your Microsoft 365 mailbox via Microsoft Graph | The intended setup |

### Temporary real sending (SMTP with Gmail)

1. Use a Gmail account with 2-Step Verification on.
2. Create an **App Password**: Google Account → Security → App passwords.
3. In `.env`:
   ```
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=yourname@gmail.com
   SMTP_PASS=the-16-character-app-password
   MAIL_FROM_ADDRESS=yourname@gmail.com
   ```
Gmail allows roughly 500 recipients/day, which is enough for 200–300 doctors.

### Microsoft 365 (ask IT for this once)

Ask your Microsoft 365 / Entra ID admin to:

1. **Register an app** in Entra ID (Azure AD) → App registrations → New registration.
2. Add the API permission **Microsoft Graph → Application → `Mail.Send`**, then **Grant admin consent**.
3. Create a **client secret**.
4. (Recommended) Restrict the app to the single sending mailbox with an *Application Access Policy* / *RBAC for Applications*, so it can only send as that mailbox.
5. Share: Tenant ID, Client ID, Client secret, and the sender mailbox address (a shared mailbox such as `articles@yourdomain.com` works).

Then in `.env`:
```
EMAIL_PROVIDER=graph
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
MAIL_FROM_ADDRESS=articles@yourdomain.com
```

Sending is paced at 30 emails/minute (Exchange Online's per-mailbox limit), so 300 doctors take about 10 minutes. PDFs over 3 MB are uploaded in chunks automatically. Sent emails appear in the mailbox's Sent Items.

---

## Using the UAT PostgreSQL instead of the embedded database

Set `DATABASE_URL` in `.env`, e.g.
```
DATABASE_URL=postgres://user:password@uat-host:5432/dispatch
```
Tables are created automatically on start. Leave it empty to use the embedded database in `./data/`.

---

## How it works

```
Admin UI (Next.js) ──► API routes ──► PostgreSQL (embedded PGlite or server)
                                        ▲
In-app scheduler (every 15 s) ──────────┤  due article → "run" with one delivery per active doctor
Delivery worker ── paced sends ─────────┘  console | SMTP | Microsoft Graph
PDFs ──► ./data/pdfs
```

- **Articles** each have a PDF and a schedule (once / daily / weekly, optional end date).
- When a scheduled time arrives, a **run** is created with one **delivery** per active doctor; the worker sends them one by one and records sent/failed per doctor.
- After its scheduled send goes out, an article **stops on its own**: daily/weekly ones become *Paused* (press Resume to send the next one), one-time ones become *Finished*. "Send now" doesn't change the schedule.
- The email is just the subject and the message, with the PDF attached. `{{name}}` and `{{title}}` can be used in either.
- If the app was off at the scheduled time it still sends if it comes back within 2 hours (`SCHEDULER_GRACE_MINUTES`); otherwise the send is marked *Missed* (use *Send now*).
- Finished articles and their PDFs are cleaned up after 56 days (`RETENTION_DAYS`).
- The laptop must be on and the app running for scheduled sends to go out.

### Project layout

```
src/app/(app)/        pages: overview, articles, doctors, activity, settings
src/app/api/          JSON API used by the pages
src/lib/dispatcher.ts scheduler + delivery worker
src/lib/email/        email template and providers (console, smtp, graph)
src/lib/db/           schema and database connection (PGlite / Postgres)
drizzle/              SQL migrations (applied automatically)
sample/               demo Excel + PDF
```

## Production

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for running it on an EC2 server.

## Data safety

`.env` and `data/` (database + uploaded PDFs) are git-ignored. Keep the repository private, and load real doctor emails only on the work laptop.
