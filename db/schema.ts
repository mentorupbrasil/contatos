import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    role: text("role", { enum: ["admin", "leader"] }).notNull().default("leader"),
    status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    phoneDisplay: text("phone_display").notNull(),
    neighborhood: text("neighborhood").notNull().default("Não informado"),
    city: text("city").notNull().default("Imperatriz"),
    tituloNumero: text("titulo_numero"),
    tituloUf: text("titulo_uf"),
    zona: integer("zona"),
    secao: integer("secao"),
    localVotacao: text("local_votacao"),
    localEndereco: text("local_endereco"),
    localBairro: text("local_bairro"),
    perfilSecao: text("perfil_secao"),
    leaderId: integer("leader_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("lideranca_presencial"),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "date" }).notNull(),
    consentTextVersion: text("consent_text_version").notNull().default("2026-01"),
    status: text("status", { enum: ["active", "opted_out", "deleted"] }).notNull().default("active"),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("contacts_phone_unique").on(table.phoneE164),
    uniqueIndex("contacts_titulo_unique").on(table.tituloNumero),
    index("contacts_leader_idx").on(table.leaderId),
    index("contacts_status_idx").on(table.status),
    index("contacts_neighborhood_idx").on(table.neighborhood),
    index("contacts_zona_idx").on(table.zona),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    templateName: text("template_name").notNull(),
    templateLanguage: text("template_language").notNull().default("pt_BR"),
    includeNameParameter: boolean("include_name_parameter").notNull().default(true),
    audienceType: text("audience_type").notNull().default("all_active"),
    status: text("status", {
      enum: ["draft", "queued", "sending", "completed", "paused", "failed"],
    })
      .notNull()
      .default("draft"),
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("campaigns_status_idx").on(table.status)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["queued", "sending", "sent", "delivered", "read", "failed", "skipped"],
    })
      .notNull()
      .default("queued"),
    providerMessageId: text("provider_message_id"),
    failureCode: text("failure_code"),
    attempts: integer("attempts").notNull().default(0),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    uniqueIndex("campaign_contact_unique").on(table.campaignId, table.contactId),
    uniqueIndex("provider_message_unique").on(table.providerMessageId),
    index("recipients_campaign_status_idx").on(table.campaignId, table.status),
  ],
);

export const consentEvents = pgTable(
  "consent_events",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    kind: text("kind", { enum: ["granted", "withdrawn", "deleted"] }).notNull(),
    source: text("source").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    detail: text("detail"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("consent_contact_idx").on(table.contactId, table.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
