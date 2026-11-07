import type { Client } from "@zrzur/sdk/solid";

import { CONFIGURATION } from "@revolt/common";

import { oauthApi } from "../../../channels/text/interactions/api";

import { base64url, codeFrom, makePkce } from "./helpers";

export type FieldType =
  | "bool"
  | "int"
  | "channel"
  | "channels"
  | "role"
  | "roles"
  | "text"
  | "enum"
  | "list";

export type Field = {
  key: string;
  type: FieldType;
  min?: number;
  max?: number;
  maxItems?: number;
  options?: (string | number)[];
};

export type ModuleMeta = {
  id: string;
  group: string;
  number: number;
  fields: Field[];
  messages: { key: string; defaults: Record<string, string> }[];
};

export type ModuleState = {
  enabled: boolean;
  disabledAt: number | null;
  logChannel: string | null;
  allowRoles: string[];
  allowChannels: string[];
  settings: Record<string, unknown>;
  messages: Record<string, Record<string, string>>;
};

export type Staff = Record<"admin" | "manager" | "moderator" | "support", string[]>;

export type AssistantConfig = {
  global: {
    language: string;
    timezone: string;
    hijri: boolean;
    staff: Staff;
    preset: string | null;
  };
  modules: Record<string, ModuleState>;
};

export type AssistantServer = {
  config: AssistantConfig;
  health: { missing: string[]; rolesAbove: string[]; ok: boolean } | null;
  overview: {
    cases: { number: number; action: string; target: string; at: number }[];
    tickets: { number: number; user: string; state: string; opened: number }[];
    changes: { at: number; user: string; what: string }[];
  };
  presets: string[];
};

/** A refusal from the Assistant's service, with its HTTP status */
export class AssistantError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let session: { token: string; until: number } | undefined;

export const isConnected = () => !!session && session.until > Date.now();

async function request<T>(method: string, path: string, body?: unknown) {
  const service = CONFIGURATION.ASSISTANT!;
  const response = await fetch(`${service.url}${path}`, {
    method,
    headers: {
      ...(session ? { authorization: `Bearer ${session.token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) session = undefined;
    throw new AssistantError(response.status, data?.error ?? "");
  }
  return data as T;
}

/**
 * Sign in to the Assistant's service with the platform's OAuth2 flow. It
 * learns who you are and nothing else; the Connect button is the consent,
 * and the app is listed under Authorized apps in user settings.
 */
export async function connect(client: Client) {
  const service = CONFIGURATION.ASSISTANT!;
  const { verifier, challenge } = await makePkce();
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const { redirect } = await oauthApi.decide(client, {
    client_id: service.botId,
    redirect_uri: `${service.url}/oauth/callback`,
    response_type: "code",
    scope: "identify",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    approve: true,
  });
  const code = codeFrom(redirect, state);
  if (!code) throw new AssistantError(401, "");
  const answer = await request<{ session: string; expires_in: number }>(
    "POST",
    "/api/session",
    { code, verifier },
  );
  session = {
    token: answer.session,
    until: Date.now() + answer.expires_in * 1000,
  };
}

/** Whether this person already agreed, so no button is needed again */
export async function alreadyAuthorized(client: Client) {
  const apps = await oauthApi.authorized(client);
  const id = CONFIGURATION.ASSISTANT!.botId;
  return apps.some((app) => app.application?._id === id);
}

const serverPath = (id: string) => `/api/servers/${id}`;

export const assistantApi = {
  meta: () => request<{ modules: ModuleMeta[] }>("GET", "/api/meta"),
  server: (id: string) => request<AssistantServer>("GET", serverPath(id)),
  patchGlobal: (id: string, patch: Record<string, unknown>) =>
    request<{ config: AssistantConfig }>(
      "PATCH",
      `${serverPath(id)}/global`,
      patch,
    ),
  patchModule: (id: string, module: string, patch: Partial<ModuleState>) =>
    request<{ config: AssistantConfig }>(
      "PATCH",
      `${serverPath(id)}/modules/${module}`,
      patch,
    ),
  wizard: (id: string, preset: string) =>
    request<{ config: AssistantConfig }>("POST", `${serverPath(id)}/wizard`, {
      preset,
    }),
  exportModule: (id: string, module: string) =>
    request<unknown>("GET", `${serverPath(id)}/modules/${module}/export`),
  purgeModule: (id: string, module: string) =>
    request<unknown>("POST", `${serverPath(id)}/modules/${module}/purge`, {}),
  exportConfig: (id: string) => request<unknown>("GET", `${serverPath(id)}/export`),
  importConfig: (id: string, data: unknown) =>
    request<{ config: AssistantConfig }>(
      "POST",
      `${serverPath(id)}/import`,
      data,
    ),
};

/** Save something as a JSON file */
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
