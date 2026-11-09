import type { API, Client, WithoutNull } from "@zrzur/sdk/solid";
import { withoutNull } from "@zrzur/sdk/solid";

export type AppInstallation = WithoutNull<API.AppInstallation>;
export type CommandPermissions = WithoutNull<API.CommandPermissions>;

/** Server settings → Apps: installed apps and who may use their commands */
export const serverAppsApi = {
  installed: async (client: Client, serverId: string) =>
    withoutNull(await client.api.get(`/servers/${serverId}/applications`)),

  /** Removes the bot, its managed role and its rules (audit log: BotRemove) */
  remove: (client: Client, serverId: string, applicationId: string) =>
    client.api.delete(`/servers/${serverId}/applications/${applicationId}`),

  /** Every command of the app in this server, unfiltered (managers only) */
  commands: async (client: Client, serverId: string, applicationId: string) =>
    withoutNull(
      await client.api.get(
        `/servers/${serverId}/applications/${applicationId}/commands`,
      ),
    ),

  rules: async (client: Client, serverId: string, applicationId: string) =>
    withoutNull(
      await client.api.get(
        `/servers/${serverId}/applications/${applicationId}/permissions`,
      ),
    ),

  /** Rules for the whole app (`commandId` undefined) or one command */
  saveRules: (
    client: Client,
    serverId: string,
    applicationId: string,
    commandId: string | undefined,
    permissions: API.CommandPermission[],
  ) =>
    commandId
      ? client.api.put(
          `/servers/${serverId}/applications/${applicationId}/commands/${commandId}/permissions`,
          { permissions },
        )
      : client.api.put(
          `/servers/${serverId}/applications/${applicationId}/permissions`,
          { permissions },
        ),
};
