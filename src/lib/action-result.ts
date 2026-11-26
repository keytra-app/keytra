/** Shared return type of all object-argument Server Actions. */
export type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };

/** State of a form driven by `useActionState`. */
export type FormState = { error?: string } | undefined;
