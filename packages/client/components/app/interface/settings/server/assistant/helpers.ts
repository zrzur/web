export const base64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes as ArrayBuffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A verifier and its S256 challenge */
export async function makePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return { verifier, challenge };
}

/** The code in an authorize redirect, only when its state is ours */
export function codeFrom(redirect: string, state: string) {
  const query = new URL(redirect).searchParams;
  return query.get("state") === state ? query.get("code") : null;
}

/** Module pages show only the tabs that have something in them */
export function tabsOf(meta: { messages: unknown[] }) {
  return [
    "settings",
    ...(meta.messages.length ? ["messages"] : []),
    "permissions",
    "log",
    "data",
  ] as const;
}
