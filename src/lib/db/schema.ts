import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  specialty: text("specialty"),
  city: text("city"),
  hospital: text("hospital"),
  active: boolean("active").notNull().default(true),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type Recurrence = "once" | "daily" | "weekly";
export type ArticleStatus = "active" | "paused" | "completed";

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  pdfPath: text("pdf_path").notNull(),
  pdfName: text("pdf_name").notNull(),
  pdfSize: integer("pdf_size").notNull(),
  recurrence: text("recurrence").$type<Recurrence>().notNull(),
  startAt: ts("start_at").notNull(),
  endAt: ts("end_at"),
  nextRunAt: ts("next_run_at"),
  status: text("status").$type<ArticleStatus>().notNull().default("active"),
  lastRunAt: ts("last_run_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type RunKind = "scheduled" | "manual" | "test";
export type RunStatus = "queued" | "sending" | "completed" | "partial" | "failed" | "missed" | "cancelled";

export const runs = pgTable(
  "runs",
  {
    id: serial("id").primaryKey(),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RunKind>().notNull(),
    status: text("status").$type<RunStatus>().notNull().default("queued"),
    scheduledFor: ts("scheduled_for").notNull(),
    total: integer("total").notNull().default(0),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    note: text("note"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("runs_article_idx").on(t.articleId), index("runs_status_idx").on(t.status)],
);

export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "cancelled";

export const deliveries = pgTable(
  "deliveries",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    doctorId: integer("doctor_id").references(() => doctors.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    status: text("status").$type<DeliveryStatus>().notNull().default("pending"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    sentAt: ts("sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("deliveries_status_idx").on(t.status),
    index("deliveries_run_idx").on(t.runId),
    uniqueIndex("deliveries_run_email_uq").on(t.runId, t.email),
  ],
);

/** Small key/value store for things like "last import" info. */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type Doctor = typeof doctors.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Delivery = typeof deliveries.$inferSelect;
