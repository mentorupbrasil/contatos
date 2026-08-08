import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role", { enum: ["admin", "leader"] }).notNull().default("leader"),
    status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const contacts = sqliteTable(
  "contacts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    phoneDisplay: text("phone_display").notNull(),
    neighborhood: text("neighborhood").notNull().default("Não informado"),
    leaderId: integer("leader_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("lideranca_presencial"),
    consentAt: integer("consent_at", { mode: "timestamp_ms" }).notNull(),
    consentTextVersion: text("consent_text_version").notNull().default("2026-01"),
    status: text("status", { enum: ["active", "opted_out", "deleted"] }).notNull().default("active"),
    optedOutAt: integer("opted_out_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("contacts_phone_unique").on(table.phoneE164),
    index("contacts_leader_idx").on(table.leaderId),
    index("contacts_status_idx").on(table.status),
    index("contacts_neighborhood_idx").on(table.neighborhood),
  ],
);

export const campaigns = sqliteTable(
  "campaigns",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    templateName: text("template_name").notNull(),
    templateLanguage: text("template_language").notNull().default("pt_BR"),
    includeNameParameter: integer("include_name_parameter", { mode: "boolean" }).notNull().default(true),
    audienceType: text("audience_type").notNull().default("all_active"),
    status: text("status", { enum: ["draft", "queued", "sending", "completed", "paused", "failed"] }).notNull().default("draft"),
    createdBy: integer("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("campaigns_status_idx").on(table.status)],
);

export const campaignRecipients = sqliteTable(
  "campaign_recipients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["queued", "sending", "sent", "delivered", "read", "failed", "skipped"] }).notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
    failureCode: text("failure_code"),
    attempts: integer("attempts").notNull().default(0),
    queuedAt: integer("queued_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("campaign_contact_unique").on(table.campaignId, table.contactId),
    uniqueIndex("provider_message_unique").on(table.providerMessageId),
    index("recipients_campaign_status_idx").on(table.campaignId, table.status),
  ],
);

export const consentEvents = sqliteTable(
  "consent_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["granted", "withdrawn", "deleted"] }).notNull(),
    source: text("source").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    detail: text("detail"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("consent_contact_idx").on(table.contactId, table.createdAt)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: text("details"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});
