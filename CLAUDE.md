@AGENTS.md

# Dispatch

Admin tool that emails an article PDF to a list of doctors (200–300) on a schedule, **one individual email per doctor**. Built as a pilot to demo to stakeholders: runs locally on a laptop now, EC2 production later (`deploy/DEPLOY.md`). Setup and usage: `README.md`.

## Product decisions (agreed with the user — keep unless they change them)

- **Each article is its own schedule** (once / daily / weekly). The user prefers a "recurring slot, new PDF per occurrence" model long-term; it is deferred, not rejected.
- **Auto-pause:** when a scheduled send fires, the article stops — recurring → `paused`, one-time → `completed`. "Send now" and test sends leave the schedule untouched.
- **Email = subject + message + PDF attachment, nothing else.** The user removed the greeting, signature and footer on purpose. `{{name}}` / `{{title}}` placeholders stay available.
- **Doctors list = one Excel sheet**, re-uploaded to update; the import previews a diff and can remove doctors missing from the file.
- **Email provider:** org is on Microsoft 365 → target is Graph (`Mail.Send` application permission, pending IT approval). Until then `console` (simulated) or `smtp` (e.g. Gmail app password). M365 basic-auth SMTP is retired, so it isn't an option.
- **UI:** the user asked for a clean, non-generic look. Keep the established system — paper/ink palette with pine accent, Fraunces (serif headings) + IBM Plex Sans/Mono, hairline cards, tokens in `src/app/globals.css`, primitives in `src/components/ui.tsx`. Reuse those primitives rather than adding a component library.

## Architecture gotchas

- **One process does everything.** `src/instrumentation.ts` starts the scheduler in `src/lib/dispatcher.ts` (15 s tick → due articles become `runs` with one `deliveries` row per active doctor → paced worker sends). Run exactly one instance.
- **Singletons live on `globalThis`** (`getDb()`, scheduler state, latest `tick`): Next loads modules in several bundles in one process, and two PGlite instances on the same folder corrupt it.
- **Database:** embedded PGlite in `./data/pglite` when `DATABASE_URL` is empty, otherwise real Postgres — same Drizzle schema. Never point two running servers at the same `DATA_DIR`.
- **Schema changes:** edit `src/lib/db/schema.ts`, run `npm run db:generate`, commit `drizzle/`. Migrations apply automatically at startup.
- **Claiming is atomic** (conditional update on `articles.next_run_at`, `FOR UPDATE SKIP LOCKED` on deliveries) so a send can't go out twice; keep that property when touching the dispatcher.
- **Times** are stored UTC and entered/shown in `APP_TIMEZONE` (Asia/Kolkata) via `src/lib/time.ts`.
- **Client components** must not import server modules (`env.ts` pulls in `node:path`); shared constants go in server-free files like `src/lib/email/defaults.ts`.
- `cacheComponents` is deliberately off; pages render dynamically and poll with `AutoRefresh` while sends are live.
- `PageProps` / `RouteContext` types are generated: run `npx next typegen` if `tsc` can't find them.

## Verifying changes

`npm run typecheck`, `npx eslint .`, `npm run build`. End to end: `EMAIL_PROVIDER=console`, import `sample/doctors-sample.xlsx`, create an article with `sample/sample-article.pdf` using the "In 2 minutes" quick pick, watch it in Activity. Addresses ending in `.invalid` fail on purpose (to exercise retry). `GET /api/health` reports database + scheduler status.

## Open items

- Get Graph credentials from IT and do a real end-to-end send.
- Deploy to EC2 following `deploy/DEPLOY.md` (Postgres via `DATABASE_URL`, nginx, PM2 single instance).
- Possible later: recurring-slot model; unsubscribe handling.
