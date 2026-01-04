export function getErrorMessage(e: unknown, fallback = "Something went wrong") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
