/** The parts of a channel the link reads */
type KnownChannel = {
  path: string;
  type: string;
  displayName?: string;
  server?: { name: string };
};

/**
 * Where "Forwarded" links back to: the original message, if this reader can
 * open its channel (the app only knows channels its user can see). The
 * server decides again when the link is opened.
 * @param origin Where the copy came from
 * @param channel Look up a channel the app knows
 */
export function originLink(
  origin: { channel?: string | null; message: string },
  channel: (id: string) => KnownChannel | undefined,
): { path: string; place: string } | undefined {
  if (!origin.channel) return;
  const source = channel(origin.channel);
  if (!source) return;

  const name = source.displayName ?? "";
  const place =
    source.type === "TextChannel"
      ? `#${name}${source.server ? ` · ${source.server.name}` : ""}`
      : name;

  return { path: `${source.path}/${origin.message}`, place };
}
