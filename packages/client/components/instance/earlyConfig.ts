/**
 * The server's configuration (`GET /` on the API), asked for by the first
 * code that runs (src/index.tsx). Nothing shows until it has arrived, and it
 * used to be asked for only after the language file: on a slow phone that
 * put a whole extra round trip in front of the first picture.
 *
 * Kept small and without imports: the entry file loads it.
 */

let early: { api: string; answer: Promise<unknown> } | undefined;

const root = (api: string) => api.replace(/\/+$/, "");

/** Ask for the configuration of this server now (it is public) */
export function startEarlyConfig(api: string) {
  const answer = fetch(`${root(api)}/`, { credentials: "omit" }).then(
    (response) => {
      if (!response.ok) throw new Error(`configuration ${response.status}`);
      return response.json();
    },
  );
  // nobody may take it (another server was opened): no unhandled rejection
  answer.catch(() => {});
  early = { api: root(api), answer };
}

/** The early answer for this server, once; undefined when there is none */
export function takeEarlyConfig<T>(api: string): Promise<T> | undefined {
  if (!early || early.api !== root(api)) return undefined;
  const { answer } = early;
  early = undefined;
  return answer as Promise<T>;
}

/** Tests only */
export function clearEarlyConfig() {
  early = undefined;
}
