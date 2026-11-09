import type { API, Client, WithoutNull } from "@zrzur/sdk/solid";
import { ApiError, withoutNull } from "@zrzur/sdk/solid";

import type { CreateInteraction } from "./types";

/**
 * API error with the server's error type (`UnknownCommand`,
 * `ApplicationOffline`, ...): the SDK's `ApiError`
 */
export const InteractionError = ApiError;
export type InteractionError = ApiError;

export const interactionApi = {
  /** With `channelId`, the server's channel rules are applied too */
  serverCommands: async (
    client: Client,
    serverId: string,
    channelId?: string,
  ) =>
    withoutNull(
      await client.api.get(
        `/servers/${serverId}/commands`,
        channelId ? { channel: channelId } : undefined,
      ),
    ),

  /** A bot's global commands, for its DM and its pages */
  botCommands: async (client: Client, botId: string) =>
    withoutNull(await client.api.get(`/bots/${botId}/commands`)),

  create: (client: Client, data: CreateInteraction) =>
    client.api.post("/interactions/", data),

  /** Developer portal: the bot's global commands (owner session) */
  commands: async (client: Client, applicationId: string) =>
    withoutNull(
      await client.api.get(`/applications/${applicationId}/commands`),
    ),

  syncCommands: (
    client: Client,
    applicationId: string,
    commands: API.DataApplicationCommand[],
  ) => client.api.put(`/applications/${applicationId}/commands`, commands),

  deleteCommand: (client: Client, applicationId: string, commandId: string) =>
    client.api.delete(`/applications/${applicationId}/commands/${commandId}`),

  autocomplete: (
    client: Client,
    data: CreateInteraction,
    signal: AbortSignal,
  ) => client.api.post("/interactions/autocomplete", data, { signal }),
};

/** Unique per click or submit, so retries never run an action twice */
export function nonce(): string {
  return crypto.randomUUID();
}

/** OAuth2 consent, authorized apps and the owner's client settings */
export const oauthApi = {
  /** @param search The page's query string, as the app received it */
  preview: async (client: Client, search: string) => {
    const query = new URLSearchParams(search);
    const value = (name: string) => query.get(name) ?? "";
    return withoutNull(
      await client.api.get("/oauth2/authorize", {
        client_id: value("client_id"),
        redirect_uri: value("redirect_uri"),
        response_type: value("response_type"),
        scope: value("scope"),
        state: value("state"),
        code_challenge: value("code_challenge"),
        code_challenge_method: value("code_challenge_method"),
        permissions: query.has("permissions")
          ? Number(query.get("permissions"))
          : undefined,
      }),
    );
  },

  decide: (client: Client, body: API.DataAuthorize) =>
    client.api.post("/oauth2/authorize", body),

  authorized: async (client: Client) =>
    withoutNull(await client.api.get("/oauth2/authorized")),

  revoke: (client: Client, applicationId: string) =>
    client.api.delete(`/oauth2/authorized/${applicationId}`),

  settings: async (client: Client, applicationId: string) =>
    withoutNull(await client.api.get(`/applications/${applicationId}/oauth`)),

  editRedirects: async (
    client: Client,
    applicationId: string,
    redirect_uris: string[],
  ) =>
    withoutNull(
      await client.api.patch(`/applications/${applicationId}/oauth`, {
        redirect_uris,
      }),
    ),

  /** Needs a validated MFA ticket; the secret is shown once */
  resetSecret: (client: Client, applicationId: string, ticket: string) =>
    client.api.post(`/applications/${applicationId}/oauth/secret`, undefined, {
      headers: { "X-MFA-Ticket": ticket },
    }),
};

export type OAuthServer = WithoutNull<API.OAuthServer>;
export type AuthorizationPreview = WithoutNull<API.AuthorizationPreview>;
export type AuthorizedApplication = WithoutNull<API.AuthorizedApplication>;
export type OAuthClientSettings = WithoutNull<API.OAuthClientSettings>;
