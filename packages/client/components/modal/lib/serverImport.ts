import type { API, Client } from "@zrzur/sdk/solid";

/**
 * "Copy a server setup": the layout of a server (categories, channels,
 * roles) read out of a Discord server template and built here. Messages and
 * members are never part of it.
 *
 * The types mirror `POST /servers/import/preview` and `POST /servers/import`.
 * They live here until the SDK's generated contract carries the two routes;
 * the calls go through the client's plain request for the same reason.
 */
export type LayoutOverride = { allow: number; deny: number };
export type LayoutChannel = {
  key: string;
  type: "Text" | "Voice" | "Forum";
  name: string;
  description?: string;
  nsfw?: boolean;
  announcement?: boolean;
  slowmode?: number;
  max_users?: number;
  synced?: boolean;
  default_permissions?: LayoutOverride;
  role_permissions?: Record<string, LayoutOverride>;
};
export type LayoutCategory = {
  title: string;
  channels: LayoutChannel[];
  default_permissions?: LayoutOverride;
  role_permissions?: Record<string, LayoutOverride>;
};
export type LayoutRole = {
  key: string;
  name: string;
  colour?: string;
  hoist: boolean;
  allow: number;
};
export type ServerLayout = {
  description?: string;
  default_permissions?: number;
  channels: LayoutChannel[];
  categories: LayoutCategory[];
  roles: LayoutRole[];
  system_channel?: string;
};
export type ImportReport = {
  categories: number;
  channels: number;
  roles: number;
  held_back: string[];
  shortened: string[];
  skipped_channels: string[];
  over_limit_channels: number;
  over_limit_roles: number;
  unmatched_permissions: string[];
  member_overrides: number;
  private_channels: number;
  mature_channels: number;
};
export type ImportPreview = {
  name: string;
  structure: ServerLayout;
  report: ImportReport;
};

/** Is the feature open on this server, and may a template be read by link? */
export function importAvailability(client: Client | undefined) {
  const features = client?.configuration?.features as
    | { server_import?: boolean; server_import_link?: boolean }
    | undefined;
  return {
    open: features?.server_import === true,
    byLink: features?.server_import_link === true,
  };
}

/** What a person gave: a link (or bare code), or the template's own text */
export function sourceOf(input: string): { link: string } | { text: string } {
  const value = input.trim();
  return value.startsWith("{") || value.includes("\n")
    ? { text: value }
    : { link: value };
}

export function readPreview(client: Client, input: string) {
  return client.api.raw<ImportPreview>(
    "post",
    "/servers/import/preview",
    sourceOf(input),
  );
}

export function buildServer(
  client: Client,
  data: { name: string; icon?: string; structure: ServerLayout; into?: string },
) {
  return client.api.raw<API.CreateServerLegacyResponse>(
    "post",
    "/servers/import",
    data,
  );
}

/** Why reading or building failed, as the dialog words it */
export type ImportFailure =
  | "invite_link"
  | "not_a_link"
  | "not_a_template"
  | "empty"
  | "too_large"
  | "nothing_given"
  | "not_found"
  | "unavailable"
  | "not_empty"
  | "limited"
  | "other";

const REASONS: readonly ImportFailure[] = [
  "invite_link",
  "not_a_link",
  "not_a_template",
  "empty",
  "too_large",
  "nothing_given",
];

/** The API error inside whatever a failed request threw */
function apiError(error: unknown): { type?: string; reason?: string } {
  let current = error as Record<string, unknown> | undefined;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current.type === "string")
      return current as { type: string; reason?: string };
    current = (current.cause ?? current.response ?? current.data) as
      | Record<string, unknown>
      | undefined;
  }
  return {};
}

export function importFailure(error: unknown): ImportFailure {
  const { type, reason } = apiError(error);
  switch (type) {
    case "ImportInvalid":
      return REASONS.find((known) => known === reason) ?? "not_a_template";
    case "ImportTemplateNotFound":
      return "not_found";
    case "ImportSourceUnavailable":
      return "unavailable";
    case "ImportTargetNotEmpty":
      return "not_empty";
    case "RateLimited":
      return "limited";
    default:
      return "other";
  }
}

/** A failure that is answered by pasting the template's text instead */
export const asksForText = (failure: ImportFailure) =>
  failure === "unavailable";

const VIEW_CHANNEL = 2 ** 20;
const SEND_MESSAGE = 2 ** 22;
/** JS bit operators stop at 32 bits; permission values go beyond */
const holds = (value: number | undefined, bit: number) =>
  Math.floor((value ?? 0) / bit) % 2 === 1;

export type PreviewRow =
  | { kind: "category"; title: string }
  | {
      kind: "channel";
      key: string;
      name: string;
      type: LayoutChannel["type"];
      announcement: boolean;
      /** hidden from members without a chosen role */
      private: boolean;
      /** members read, chosen roles write */
      readOnly: boolean;
      mature: boolean;
    };

/** The layout as the channel list will show it, top to bottom */
export function previewRows(layout: ServerLayout): PreviewRow[] {
  const row = (
    channel: LayoutChannel,
    category?: LayoutCategory,
  ): PreviewRow => {
    const rights =
      channel.synced && category
        ? category.default_permissions
        : channel.default_permissions;
    const hidden = holds(rights?.deny, VIEW_CHANNEL);
    return {
      kind: "channel",
      key: channel.key,
      name: channel.name,
      type: channel.type,
      announcement: !!channel.announcement,
      private: hidden,
      readOnly: !hidden && holds(rights?.deny, SEND_MESSAGE),
      mature: !!channel.nsfw,
    };
  };
  return [
    ...layout.channels.map((channel) => row(channel)),
    ...layout.categories.flatMap((category) => [
      { kind: "category", title: category.title } as PreviewRow,
      ...category.channels.map((channel) => row(channel, category)),
    ]),
  ];
}

/** The channel a new server opens on: the first one members can write in */
export function openingKey(layout: ServerLayout) {
  const rows = previewRows(layout).filter(
    (row): row is Extract<PreviewRow, { kind: "channel" }> =>
      row.kind === "channel" && row.type === "Text",
  );
  const open = rows.find(
    (row) => !row.private && !row.readOnly && !row.announcement,
  );
  return (open ?? rows.find((row) => !row.private) ?? rows[0])?.key;
}

/**
 * The id of that channel on the built server. The server answers with the
 * channels in the layout's order, so the position finds it.
 */
export function openingChannelId(
  layout: ServerLayout,
  channels: readonly { _id: string }[],
) {
  const keys = [
    ...layout.channels,
    ...layout.categories.flatMap((category) => category.channels),
  ].map((channel) => channel.key);
  const index = keys.indexOf(openingKey(layout) ?? "");
  return (channels[index] ?? channels[0])?._id;
}

/** Is anything listed under "Will not come over" beyond the fixed lines? */
export function hasWarnings(report: ImportReport) {
  return (
    report.held_back.length > 0 ||
    report.shortened.length > 0 ||
    report.skipped_channels.length > 0 ||
    report.over_limit_channels > 0 ||
    report.over_limit_roles > 0
  );
}
