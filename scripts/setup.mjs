// First-time setup on a new machine: `npm run setup`
// Creates .env from .env.example (with a random session secret) if it doesn't exist yet.
import crypto from "node:crypto";
import fs from "node:fs";

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`Node.js 20 or newer is required (you have ${process.versions.node}).`);
  process.exit(1);
}

if (fs.existsSync(".env")) {
  console.log(".env already exists, leaving it as is.");
} else {
  const env = fs
    .readFileSync(".env.example", "utf8")
    .replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${crypto.randomBytes(32).toString("hex")}`)
    .replace(/^ADMIN_PASSWORD=.*$/m, "ADMIN_PASSWORD=dispatch");
  fs.writeFileSync(".env", env);
  console.log("Created .env (sign-in password: dispatch, change ADMIN_PASSWORD in .env if you like).");
}

console.log("\nNext:  npm run dev   then open http://localhost:3000");
