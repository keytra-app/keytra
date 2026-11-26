const UNIQUE_VIOLATION = "23505";
const SERIALIZATION_FAILURE = "40001";

function codeOf(value: unknown): unknown {
  return typeof value === "object" && value !== null && "code" in value ? value.code : undefined;
}

/** Drizzle wraps driver errors, so the Postgres code may sit on `cause`. */
function pgErrorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return codeOf(error) ?? ("cause" in error ? codeOf(error.cause) : undefined);
}

export const isUniqueViolation = (error: unknown) => pgErrorCode(error) === UNIQUE_VIOLATION;

export const isSerializationFailure = (error: unknown) =>
  pgErrorCode(error) === SERIALIZATION_FAILURE;
