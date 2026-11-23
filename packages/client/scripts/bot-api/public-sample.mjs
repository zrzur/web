// Recorded answers go into the public docs. A value that belongs to the
// machine the checks ran on (the dev stack's own keys) is replaced by a
// placeholder: the docs show the shape, never one server's key, and secret
// scanners do not stop the publication on it.
const PLACEHOLDERS = {
  vapid: "<VAPID public key>",
};

/** A copy of `value` with every field named in PLACEHOLDERS replaced */
export function maskServerValues(value) {
  if (Array.isArray(value)) return value.map(maskServerValues);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      typeof inner === "string" && key in PLACEHOLDERS
        ? PLACEHOLDERS[key]
        : maskServerValues(inner),
    ]),
  );
}
