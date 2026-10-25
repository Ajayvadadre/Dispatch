// PM2 process file: `pm2 start deploy/ecosystem.config.cjs`
// Run exactly ONE instance: the scheduler lives inside the app process.
module.exports = {
  apps: [
    {
      name: "dispatch",
      cwd: `${__dirname}/..`, // .env is read from here
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000", // only nginx can reach it
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      kill_timeout: 15000,
      env: {
        NODE_ENV: "production",
        // Needed when DATABASE_URL points at Amazon RDS with sslmode=require (see DEPLOY.md)
        // NODE_EXTRA_CA_CERTS: "/etc/ssl/certs/rds-global-bundle.pem",
      },
    },
  ],
};
