import { useLingui } from "@lingui/solid/macro";

import type { IconName } from "@revolt/ui/icons/Icon";

import {
  type Permission,
  PERMISSIONS,
} from "../../../../../../../plugin-sdk/src/manifest.ts";

/** Words for plugin permissions, states and categories in the user's language */
export function usePluginText() {
  const { t } = useLingui();

  const permission = (id: string): { title: string; detail: string } => {
    switch (id) {
      case "ui.commands":
        return {
          title: t`Add commands`,
          detail: t`Commands you run from its page or a shortcut.`,
        };
      case "ui.panels":
        return {
          title: t`Show panels`,
          detail: t`Its own panels made of text, buttons and switches, always labelled with its name.`,
        };
      case "keybinds":
        return {
          title: t`Add keyboard shortcuts`,
          detail: t`Never shortcuts Zrzur or your browser already use.`,
        };
      case "theme.colors":
        return {
          title: t`Change colours`,
          detail: t`Interface colours only. Warning colours can't change and text must stay readable.`,
        };
      case "accessibility.display":
        return {
          title: t`Change text and motion`,
          detail: t`Text size, spacing, link underlines, focus rings and animations.`,
        };
      case "app.preferences":
        return {
          title: t`Toggle compact mode`,
          detail: t`Switch compact mode on or off when you run its command.`,
        };
      case "storage.settings":
        return {
          title: t`Save its settings`,
          detail: t`Up to 8 KB of its own settings, kept with your account.`,
        };
      case "notifications.show":
        return {
          title: t`Show notices`,
          detail: t`Short in-app notices that start with its name.`,
        };
      case "notifications.display":
        return {
          title: t`Change how notifications look`,
          detail: t`Quiet hours, hidden previews and muted sounds. It never reads your notifications.`,
        };
      case "composer.insert":
        return {
          title: t`Insert text in your message box`,
          detail: t`It can't send anything: you decide whether to send.`,
        };
      case "context.channel":
        return {
          title: t`Know which channel you open`,
          detail: t`The id and name of channels you open, only ones you can already see.`,
        };
      case "context.message.selected":
        return {
          title: t`Read a message you pick`,
          detail: t`Only the one message you choose its action on, and only at that moment.`,
        };
      case "devtools.diagnostics":
        return {
          title: t`Read diagnostics`,
          detail: t`App version, platform and plugin timings, in development builds only.`,
        };
      default:
        return {
          title: id,
          detail: t`Not supported by this version of Zrzur.`,
        };
    }
  };

  const risk = (id: string) => PERMISSIONS[id as Permission]?.risk ?? "high";

  const riskLabel = (value: string) =>
    ({ low: t`Low risk`, medium: t`Medium risk`, high: t`High risk` })[
      value.toLowerCase() as "low" | "medium" | "high"
    ] ?? value;

  const category = (id: string) =>
    ({
      appearance: t`Appearance`,
      productivity: t`Productivity`,
      accessibility: t`Accessibility`,
      notifications: t`Notifications`,
      integration: t`Integrations`,
      developer: t`Developer tools`,
    })[id] ?? id;

  /** Why a plugin isn't running, in words */
  const reason = (id?: string) => {
    switch (id) {
      case undefined:
        return "";
      case "safe_mode":
        return t`Safe Mode is on, so no plugin runs.`;
      case "disabled":
        return t`Turned off.`;
      case "suspended":
        return t`Zrzur suspended this plugin while it's being reviewed.`;
      case "removed":
        return t`This plugin was removed from Zrzur. You can only uninstall it.`;
      case "revoked":
        return t`This version was revoked for safety and won't run again.`;
      case "not_approved":
        return t`This version isn't approved.`;
      case "consent":
        return t`It needs your permission again.`;
      case "third_party_code":
        return t`Code from third-party publishers can't run on Zrzur yet.`;
      case "platform":
        return t`Not available on this device.`;
      case "app_version":
        return t`Needs a newer version of Zrzur.`;
      case "api_version":
        return t`Made for a different plugin API.`;
      case "no_sandbox":
        return t`This browser can't run it safely.`;
      case "quarantined":
        return t`Stopped after repeated errors.`;
      case "integrity":
        return t`Its code didn't match the reviewed version, so it was blocked.`;
      case "unresponsive":
        return t`It stopped responding and was stopped.`;
      case "flood":
        return t`It sent too many requests and was stopped.`;
      case "oversized_message":
        return t`It sent too much data at once and was stopped.`;
      case "boot_timeout":
        return t`It took too long to start.`;
      case "slow_handler":
        return t`It kept taking too long to respond.`;
      default:
        return id.startsWith("crash")
          ? t`It crashed.`
          : t`Something went wrong.`;
    }
  };

  return { permission, risk, riskLabel, category, reason };
}

const CATEGORY_ICONS: Record<string, IconName> = {
  appearance: "palette",
  productivity: "lightning",
  accessibility: "person-arms-spread",
  notifications: "bell",
  integration: "share-network",
  developer: "code",
};

export function categoryIcon(category: string): IconName {
  // own keys only: a category like "constructor" is not one of ours
  return Object.hasOwn(CATEGORY_ICONS, category)
    ? CATEGORY_ICONS[category]
    : "squares-four";
}
