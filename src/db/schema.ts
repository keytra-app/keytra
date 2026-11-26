import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz("created_at").notNull().defaultNow();

export const userRole = pgEnum("user_role", ["admin", "translator"]);
export const translatorAccess = pgEnum("translator_access", ["all", "selected"]);
export const translationStatus = pgEnum("translation_status", ["translated", "outdated"]);

// Emails are stored lowercased by the app; uniqueness is case-sensitive at DB level.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("translator"),
  createdAt: createdAt(),
});

// id is the SHA-256 hash of the session token; the raw token only lives in the cookie.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    role: userRole("role").notNull().default("translator"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invites_created_by_idx").on(t.createdBy)],
);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sourceLocale: text("source_locale").notNull(),
  translatorAccess: translatorAccess("translator_access").notNull().default("all"),
  createdAt: createdAt(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.projectId, t.userId] }),
    index("project_members_user_id_idx").on(t.userId),
  ],
);

export const projectLocales = pgTable(
  "project_locales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("project_locales_project_code_uq").on(t.projectId, t.code)],
);

export const translationKeys = pgTable(
  "translation_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull().default("default"),
    key: text("key").notNull(),
    description: text("description"),
    sourceValue: text("source_value").notNull(),
    // Hex SHA-256 of sourceValue; a change marks existing translations as outdated.
    sourceHash: text("source_hash").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("translation_keys_project_ns_key_uq").on(t.projectId, t.namespace, t.key)],
);

export const translations = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    keyId: uuid("key_id")
      .notNull()
      .references(() => translationKeys.id, { onDelete: "cascade" }),
    localeId: uuid("locale_id")
      .notNull()
      .references(() => projectLocales.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    status: translationStatus("status").notNull().default("translated"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique("translations_key_locale_uq").on(t.keyId, t.localeId),
    index("translations_locale_id_idx").on(t.localeId),
  ],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamptz("last_used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("api_keys_project_id_idx").on(t.projectId)],
);

// Relations (for db.query.* relational queries)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  invites: many(invites),
  memberships: many(projectMembers),
  translations: many(translations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  creator: one(users, { fields: [invites.createdBy], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  members: many(projectMembers),
  locales: many(projectLocales),
  keys: many(translationKeys),
  apiKeys: many(apiKeys),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const projectLocalesRelations = relations(projectLocales, ({ one, many }) => ({
  project: one(projects, { fields: [projectLocales.projectId], references: [projects.id] }),
  translations: many(translations),
}));

export const translationKeysRelations = relations(translationKeys, ({ one, many }) => ({
  project: one(projects, { fields: [translationKeys.projectId], references: [projects.id] }),
  translations: many(translations),
}));

export const translationsRelations = relations(translations, ({ one }) => ({
  key: one(translationKeys, { fields: [translations.keyId], references: [translationKeys.id] }),
  locale: one(projectLocales, { fields: [translations.localeId], references: [projectLocales.id] }),
  updatedByUser: one(users, { fields: [translations.updatedBy], references: [users.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
}));
