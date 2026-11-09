/**
 * Whether this address opens a sign-in page (`/login…`, also under an
 * `/i/<host>` instance prefix). There the first download also fetches the
 * sign-in code; everywhere else it loads only when needed.
 */
export function opensSignIn(pathname: string) {
  return /^(\/i\/[^/]+)?\/login(\/|$)/.test(pathname);
}
