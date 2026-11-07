/** The part of the client this reads; the server's root config, once fetched */
type ConfiguredClient =
  | { configuration?: { features?: { plugins?: boolean } } | undefined }
  | null
  | undefined;

/**
 * Are plugins open on this server (`features.plugins_enabled`)? Only a clear
 * yes from the server counts: while the configuration is unknown, if fetching
 * it failed, or on a server that doesn't send the flag, plugins stay off. Off,
 * nothing about plugins is shown, read, fetched or run; what people installed
 * stays stored and comes back when the flag is turned on.
 */
export function pluginsEnabled(client: ConfiguredClient) {
  return client?.configuration?.features?.plugins === true;
}
