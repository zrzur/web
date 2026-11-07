/**
 * Keep a name (server, user, channel) in its own reading direction inside a
 * translated sentence, so a Latin name can't scramble Arabic text around it
 * (and the other way round).
 */
export function isolate(text: string) {
  return `\u2068${text}\u2069`;
}
