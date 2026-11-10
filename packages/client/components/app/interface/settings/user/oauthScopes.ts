import { useLingui } from "@lingui/solid/macro";

/**
 * What an OAuth2 scope lets an app do, in plain words (never the scope id).
 * The scopes are the backend's `oauth_scopes::ALL`; one the client does not
 * know yet reads as "Other access".
 */
export function useScopeText() {
  const { t } = useLingui();
  return (scope: string) => {
    switch (scope) {
      case "identify":
        return t`Know your username and avatar`;
      case "servers.read":
        return t`See the names and icons of your servers`;
      case "applications.commands":
        return t`Let its commands be used in the server`;
      case "bot.install":
        return t`Add its bot to a server you manage`;
      default:
        return t`Other access`;
    }
  };
}
