"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/action-result";

// Kept inside the client module: constants exported from a "use client" file
// would arrive in Server Components as client references, not objects.
const FIELDS = {
  name: { label: "Name", type: "text", autoComplete: "name" },
  email: { label: "E-Mail", type: "email", autoComplete: "email" },
  password: { label: "Passwort", type: "password", autoComplete: "current-password" },
  "new-password": {
    label: "Passwort (min. 8 Zeichen)",
    type: "password",
    autoComplete: "new-password",
  },
} as const;

export type FieldKey = keyof typeof FIELDS;

export function AuthForm({
  title,
  description,
  action,
  fields,
  submitLabel,
}: {
  title: string;
  description?: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldKey[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-5 rounded-lg border border-zinc-800 bg-[#111113] p-6"
      >
        <div className="space-y-1">
          <h1 className="text-base font-medium text-zinc-100">{title}</h1>
          {description && <p className="text-sm text-zinc-500">{description}</p>}
        </div>

        {fields.map((key) => (
          <label key={key} className="block space-y-1.5">
            <span className="text-xs text-zinc-400">{FIELDS[key].label}</span>
            <input
              name={key === "new-password" ? "password" : key}
              type={FIELDS[key].type}
              autoComplete={FIELDS[key].autoComplete}
              required
              minLength={key === "new-password" ? 8 : undefined}
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
            />
          </label>
        ))}

        {state?.error && (
          <p role="alert" className="text-sm text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded border border-zinc-700 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </form>
    </main>
  );
}
