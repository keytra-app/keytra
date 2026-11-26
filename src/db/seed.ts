// Dev seed: `pnpm db:seed`. Idempotent: existing rows (and your local edits) are never overwritten.
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { projectLocales, projects, translationKeys, translations, users } from "./schema.ts";
import { hashPassword } from "../lib/auth/crypto.ts";
import { computeSourceHash } from "../lib/i18n/json.ts";

if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
// The seed creates accounts with publicly known passwords.
const { hostname } = new URL(process.env.DATABASE_URL);
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(hostname)
) {
  throw new Error("Refusing to seed: only allowed against a local development database.");
}

const LOCALES = [
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Französisch" },
  { code: "pl", name: "Polnisch" },
] as const;

// [namespace, key, source, de, fr, pl]: null = missing, "~" prefix = outdated.
type Row = [string, string, string, string | null, string | null, string | null];
// prettier-ignore
const KEYS: Row[] = [
  ["common", "actions.save", "Save", "Speichern", "Enregistrer", "Zapisz"],
  ["common", "actions.cancel", "Cancel", "Abbrechen", "Annuler", "Anuluj"],
  ["common", "actions.delete", "Delete", "Löschen", "Supprimer", null],
  ["common", "greeting", "Hello, {{name}}!", "Hallo, {{name}}!", "Bonjour, {{name}} !", "Cześć, {{name}}!"],
  ["common", "items.count", "{count} items selected", "{count} Elemente ausgewählt", "~{count} éléments", null],
  ["common", "search.placeholder", "Search projects…", "Projekte suchen…", null, null],
  ["common", "errors.generic", "Something went wrong. Please try again.", "~Etwas ist schiefgelaufen.", null, "~Coś poszło nie tak."],
  ["common", "footer.updated", "Last updated {{date}} by {{name}}", null, null, null],
  ["auth", "login.title", "Sign in to your account", "Bei deinem Konto anmelden", "Connectez-vous à votre compte", "Zaloguj się na swoje konto"],
  ["auth", "login.email", "Email address", "E-Mail-Adresse", "Adresse e-mail", "Adres e-mail"],
  ["auth", "login.password", "Password", "Passwort", "Mot de passe", "Hasło"],
  ["auth", "login.submit", "Sign in", "~Einloggen", "Se connecter", null],
  ["auth", "login.error", "Invalid email or password.", "E-Mail oder Passwort ist falsch.", null, null],
  ["auth", "password.min_length", "Password must be at least {count} characters.", "Das Passwort muss mindestens {count} Zeichen lang sein.", "~Le mot de passe est trop court.", null],
  ["auth", "invite.welcome", "Welcome, {{name}}! You were invited to {{project}}.", null, "Bienvenue, {{name}} ! Vous avez été invité à {{project}}.", null],
];

function find<T>(rows: T[], predicate: (row: T) => boolean): T {
  const row = rows.find(predicate);
  if (!row) throw new Error("Seed row missing after insert");
  return row;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await drizzle(pool).transaction(async (tx) => {
    await tx
      .insert(users)
      .values([
        {
          email: "admin@keytra.local",
          name: "Admin",
          role: "admin",
          passwordHash: await hashPassword("admin1234"),
        },
        {
          email: "translator@keytra.local",
          name: "Translator",
          role: "translator",
          passwordHash: await hashPassword("trans1234"),
        },
      ])
      .onConflictDoNothing({ target: users.email });
    const [translator] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "translator@keytra.local"));

    await tx
      .insert(projects)
      .values({
        name: "Demo App",
        slug: "demo-app",
        description: "Seed-Daten für die lokale Entwicklung",
        sourceLocale: "en",
      })
      .onConflictDoNothing({ target: projects.slug });
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.slug, "demo-app"));

    await tx
      .insert(projectLocales)
      .values(LOCALES.map((l) => ({ ...l, projectId: project.id })))
      .onConflictDoNothing();
    const locales = await tx
      .select()
      .from(projectLocales)
      .where(eq(projectLocales.projectId, project.id));

    await tx
      .insert(translationKeys)
      .values(
        KEYS.map(([namespace, key, sourceValue]) => ({
          projectId: project.id,
          namespace,
          key,
          sourceValue,
          sourceHash: computeSourceHash(sourceValue),
        })),
      )
      .onConflictDoNothing();
    const keys = await tx
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, project.id));

    const rows = KEYS.flatMap(([namespace, key, , ...values]) => {
      const keyId = find(keys, (k) => k.namespace === namespace && k.key === key).id;
      return values.flatMap((raw, i) => {
        if (raw === null) return [];
        const outdated = raw.startsWith("~");
        return {
          keyId,
          localeId: find(locales, (l) => l.code === LOCALES[i].code).id,
          value: outdated ? raw.slice(1) : raw,
          status: outdated ? ("outdated" as const) : ("translated" as const),
          updatedBy: translator.id,
        };
      });
    });
    await tx.insert(translations).values(rows).onConflictDoNothing();
  });
  console.log(`seeded demo-app (${KEYS.length} keys)`);
} finally {
  await pool.end();
}
