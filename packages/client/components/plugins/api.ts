import { ApiError, withoutNull } from "@zrzur/sdk/solid";
import type { API, Client, WithoutNull } from "@zrzur/sdk/solid";

import type { Manifest } from "../../../plugin-sdk/src/manifest.ts";

/**
 * The server stores a release's manifest and an install's settings as
 * free-form JSON; the app reads them as the plugin SDK defines them.
 */
type Typed<T> = T extends readonly (infer Item)[]
  ? Typed<Item>[]
  : T extends object
    ? {
        [K in keyof T]: K extends "manifest"
          ? Manifest
          : K extends "settings"
            ? Record<string, unknown>
            : Typed<T[K]>;
      }
    : T;

/* Shapes from the server's OpenAPI document, without the `null` fields */
export type PluginCard = Typed<WithoutNull<API.PluginCard>>;
export type PublisherCard = Typed<WithoutNull<API.PublisherCard>>;
export type ScanFinding = Typed<WithoutNull<API.ScanFinding>>;
export type ReleaseView = Typed<WithoutNull<API.ReleaseView>>;
export type PluginUpdate = Typed<WithoutNull<API.PluginUpdate>>;
export type InstallView = Typed<WithoutNull<API.InstallView>>;
export type PluginDetails = Typed<WithoutNull<API.PluginDetails>>;
export type PluginAccess = Typed<WithoutNull<API.PluginAccess>>;
export type ReviewItem = Typed<WithoutNull<API.ReviewItem>>;
export type PluginProject = Typed<WithoutNull<API.PluginProject>>;
export type PluginValidation = Typed<WithoutNull<API.PluginValidation>>;
export type PluginLogEntry = Typed<WithoutNull<API.PluginLogEntry>>;

/** API error with the server's type and message: the SDK's `ApiError` */
export const PluginApiError = ApiError;
export type PluginApiError = ApiError;

const enc = encodeURIComponent;

/** API data as the app reads it (see `Typed`) */
const typed = <T>(data: T) => withoutNull(data) as Typed<WithoutNull<T>>;

export const pluginApi = {
  access: async (c: Client) =>
    typed(await c.api.get("/plugins/permissions")),
  list: async (
    c: Client,
    query: { query?: string; category?: string; offset?: number },
  ) =>
    typed(
      await c.api.get("/plugins/", {
        query: query.query || undefined,
        category: query.category || undefined,
        offset: query.offset,
      }),
    ),
  details: async (c: Client, id: string) =>
    typed(await c.api.get(`/plugins/${enc(id)}`)),
  log: async (c: Client, id: string) =>
    typed(await c.api.get(`/plugins/${enc(id)}/log`)),

  installs: async (c: Client) =>
    typed(await c.api.get("/plugins/@me/installs")),
  install: async (
    c: Client,
    id: string,
    release_id: string,
    permissions: string[],
  ) =>
    typed(
      await c.api.put(`/plugins/@me/installs/${enc(id)}`, {
        release_id,
        permissions,
      }),
    ),
  setEnabled: async (c: Client, id: string, enabled: boolean) =>
    typed(
      await c.api.patch(`/plugins/@me/installs/${enc(id)}`, { enabled }),
    ),
  uninstall: (c: Client, id: string) =>
    c.api.delete(`/plugins/@me/installs/${enc(id)}`),
  /** The settings as saved (free-form JSON on the server) */
  saveSettings: async (
    c: Client,
    id: string,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const saved: unknown = await c.api.put(
      `/plugins/@me/installs/${enc(id)}/settings`,
      { values },
    );
    return saved && typeof saved === "object" && !Array.isArray(saved)
      ? Object.fromEntries(Object.entries(saved))
      : {};
  },
  report: (c: Client, id: string, reason: string) =>
    c.api.post(`/plugins/${enc(id)}/report`, { reason }),

  create: async (
    c: Client,
    data: { id: string; name: string; summary?: string; category: string },
  ) => typed(await c.api.post("/plugins/", data)),
  validate: async (c: Client, pkg: { manifest: unknown; code?: string }) =>
    typed(await c.api.post("/plugins/validate", pkg)),
  projects: async (c: Client) =>
    typed(await c.api.get("/plugins/@me/projects")),
  submit: async (
    c: Client,
    id: string,
    pkg: { manifest: unknown; code?: string; changelog?: string },
  ) => typed(await c.api.post(`/plugins/${enc(id)}/releases`, pkg)),
  withdraw: (c: Client, releaseId: string) =>
    c.api.post(`/plugins/releases/${enc(releaseId)}/withdraw`),
  remove: (c: Client, id: string, reason?: string) =>
    c.api.post(`/plugins/${enc(id)}/remove`, { reason }),

  queue: async (c: Client) =>
    typed(await c.api.get("/plugins/review/queue")),
  approve: async (
    c: Client,
    releaseId: string,
    body: {
      reason?: string;
      verify_publisher?: boolean;
      acknowledge_high_risk?: boolean;
    },
  ) =>
    typed(
      await c.api.post(`/plugins/releases/${enc(releaseId)}/approve`, body),
    ),
  reject: (c: Client, releaseId: string, reason: string) =>
    c.api.post(`/plugins/releases/${enc(releaseId)}/reject`, { reason }),
  revoke: (c: Client, releaseId: string, reason: string) =>
    c.api.post(`/plugins/releases/${enc(releaseId)}/revoke`, { reason }),
  suspend: async (c: Client, id: string, reason: string) =>
    typed(await c.api.post(`/plugins/${enc(id)}/suspend`, { reason })),
  reinstate: async (c: Client, id: string) =>
    typed(await c.api.post(`/plugins/${enc(id)}/reinstate`, {})),
  suspendPublisher: (c: Client, userId: string, reason: string) =>
    c.api.post(`/plugins/publishers/${enc(userId)}/suspend`, { reason }),
};
