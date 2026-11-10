import {
  UNICODE_EMOJI_PACKS,
  UnicodeEmojiPacks,
} from "@revolt/markdown/emoji/emojiPacks";
import { batch } from "solid-js";

import { State } from "..";

import { AbstractStore } from ".";

/**
 * Possible notification permission states
 */
export type NotificationPermissionState =
  | "default"
  | "denied"
  | "allowed"
  | "unsupported";

/**
 * Possible notification permission states
 */
const NotificationPermissionStates: NotificationPermissionState[] = [
  "default",
  "denied",
  "allowed",
  "unsupported",
];

interface SettingsDefinition {
  /**
   * Whether to enable desktop notifications
   */
  "notifications:desktop": NotificationPermissionState;

  /**
   * Whether to enable push notifications
   */
  "notifications:push": NotificationPermissionState;

  /**
   * Selected unicode emoji
   */
  "appearance:unicode_emoji": UnicodeEmojiPacks;

  // TODO: this should be part of theme
  // "appearance:ligatures": boolean;

  /**
   * Enable season effects
   * TODO: implement
   */
  // "appearance:seasonal": boolean;

  // TODO: this should be part of theme
  // "appearance:transparency": boolean;

  /**
   * Show message send button
   */
  "appearance:show_send_button": boolean;

  /**
   * Whether to render messages in compact mode
   */
  "appearance:compact_mode": boolean;

  /**
   * Show profile effects on other people's profiles
   */
  "appearance:profile_effects": boolean;

  /**
   * Indicate new users to Stoat
   * TODO: implement
   */
  // "appearance:show_account_age": boolean;

  /**
   * Whether to include 'copy ID' in context menus
   */
  "advanced:copy_id": boolean;

  /**
   * Whether to include admin panel links in context menus
   */
  "advanced:admin_panel": boolean;

  /**
   * Streamer mode: hide personal details on screen (this device only)
   */
  "privacy:streamer_mode": boolean;

  /**
   * Turn streamer mode on while sharing the screen (off by default)
   */
  "privacy:streamer_on_share": boolean;

  /**
   * Streamer mode was turned on by a screen share (it goes off with it)
   */
  "privacy:streamer_by_share": boolean;
}

/**
 * Map actual type to JavaScript type OR function to clean the value.
 */
type ValueType<T extends keyof SettingsDefinition> =
  SettingsDefinition[T] extends boolean
    ? "boolean"
    : SettingsDefinition[T] extends number
      ? "number"
      : SettingsDefinition[T] extends string
        ? "string"
        : (
            v: Partial<SettingsDefinition[T]>,
          ) => SettingsDefinition[T] | undefined;

/**
 * Expected types of settings keys, enforce some sort of validation is present for all keys.
 * If we cannot validate the value as a primitive, clean it up using a function.
 */
const EXPECTED_TYPES: { [K in keyof SettingsDefinition]: ValueType<K> } = {
  "notifications:desktop": "string",
  "notifications:push": "string",
  "appearance:unicode_emoji": "string",
  "appearance:show_send_button": "boolean",
  "appearance:compact_mode": "boolean",
  "appearance:profile_effects": "boolean",
  "advanced:copy_id": "boolean",
  "advanced:admin_panel": "boolean",
  "privacy:streamer_mode": "boolean",
  "privacy:streamer_on_share": "boolean",
  "privacy:streamer_by_share": "boolean",
};

/**
 * In reality, this is a partial so we map it accordingly here.
 */
export type TypeSettings = Partial<SettingsDefinition>;

/**
 * Default values for settings, if applicable.
 */
const DEFAULT_VALUES: TypeSettings = {};

/**
 * Settings store
 */
export class Settings extends AbstractStore<"settings", TypeSettings> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "settings");
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    streamerAfterLoad(this);
  }

  /**
   * Generate default values
   */
  default(): TypeSettings {
    return {
      "notifications:desktop": "default",
      "notifications:push": "default",
      "appearance:unicode_emoji": "fluent-flat",
      "appearance:show_send_button": true,
      "appearance:compact_mode": false,
      "appearance:profile_effects": true,
      "advanced:copy_id": false,
      "advanced:admin_panel": false,
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeSettings>): TypeSettings {
    const settings: TypeSettings = this.default();
    // keys are validated one by one below, so values are written untyped
    const out = settings as unknown as Record<string, unknown>;

    for (const key of Object.keys(input) as (keyof TypeSettings)[]) {
      const expectedType = EXPECTED_TYPES[key];

      if (typeof expectedType === "function") {
        const cleanedValue = (expectedType as (value: unknown) => unknown)(
          input[key],
        );
        if (cleanedValue) {
          out[key] = cleanedValue;
        }
      } else if (key === "appearance:unicode_emoji") {
        if ((UNICODE_EMOJI_PACKS as readonly unknown[]).includes(input[key])) {
          settings[key] = input[key];
        }
      } else if (key === "notifications:desktop") {
        if (
          (NotificationPermissionStates as readonly unknown[]).includes(
            input[key],
          )
        ) {
          settings[key] = input[key];
        }
      } else if (key === "notifications:push") {
        if (
          (NotificationPermissionStates as readonly unknown[]).includes(
            input[key],
          )
        ) {
          settings[key] = input[key];
        }
      } else if (typeof input[key] === expectedType) {
        out[key] = input[key];
      }
    }

    return settings;
  }

  /**
   * Set a settings key
   * @param key Colon-divided key
   * @param value Value
   */
  setValue<T extends keyof TypeSettings>(key: T, value: TypeSettings[T]) {
    this.set(key, value);
  }

  /**
   * Get a settings key
   * @param key Colon-divided key
   * @returns Value at key or default value
   */
  getValue<T extends keyof TypeSettings>(key: T) {
    return this.get()[key] ?? DEFAULT_VALUES[key];
  }

  /**
   * Whether streamer mode hides personal details now (one store read)
   */
  get streamerMode(): boolean {
    return this.get()["privacy:streamer_mode"] === true;
  }

  set streamerMode(on: boolean) {
    this.setValue("privacy:streamer_mode", on);
  }

  /**
   * Whether sharing the screen turns streamer mode on
   */
  get streamerOnShare(): boolean {
    return this.get()["privacy:streamer_on_share"] === true;
  }

  set streamerOnShare(on: boolean) {
    this.setValue("privacy:streamer_on_share", on);
  }

  /** Whether a screen share turned streamer mode on */
  get streamerByShare(): boolean {
    return this.get()["privacy:streamer_by_share"] === true;
  }

  set streamerByShare(on: boolean) {
    if (on !== this.streamerByShare)
      this.setValue("privacy:streamer_by_share", on);
  }

  /**
   * Get the permission state for desktop notifications
   */
  get desktopNotificationsState(): NotificationPermissionState {
    return this.getValue("notifications:desktop") ?? "default";
  }

  /**
   * Get the permission state for push notifications
   */
  get pushNotificationsState(): NotificationPermissionState {
    return this.getValue("notifications:push") ?? "default";
  }

  /**
   * Set the permission state for desktop notifications. If deskop notifications are ever set to `unsupported` this function will noop.
   */
  set desktopNotificationsState(newState: NotificationPermissionState) {
    if (this.desktopNotificationsState !== "unsupported") {
      this.setValue("notifications:desktop", newState);
    }
  }

  /**
   * Set the permission state for push notifications. If newState is `unsupported` this function will noop.
   */
  set pushNotificationsState(newState: NotificationPermissionState) {
    if (newState !== "unsupported") {
      this.setValue("notifications:push", newState);
    }
  }

  /**
   * Reset the notifications state for both desktop and push notifications.
   * @param newState The state to set both notification states to. Defaults to "default"
   */
  resetNotificationsState(newState?: "default" | "denied") {
    batch(() => {
      // Use setValue here instead of the setter as we want to bypass the unsupported block.
      this.setValue("notifications:desktop", newState ?? "default");
      this.pushNotificationsState = newState ?? "default";
    });
  }
}

// Streamer mode: one switch that hides personal details on screen (email,
// the own tag, invite links and codes, DM previews in notifications). Every
// place reads the one setting `state.settings.streamerMode`; nothing is
// recomputed for whole lists. Kept here so it shares the state chunk.

/** What a hidden detail shows instead */
export const HIDDEN = "••••••••";

type StreamerState = {
  settings: Pick<
    Settings,
    "streamerMode" | "streamerOnShare" | "streamerByShare"
  >;
};

/**
 * Turn streamer mode on or off by hand (the switch, the shortcut, the
 * indicator). A share that ends later leaves this choice alone.
 */
export function setStreamerMode(state: StreamerState, on: boolean) {
  state.settings.streamerByShare = false;
  state.settings.streamerMode = on;
}

/**
 * Screen sharing starts (before the capture) or stopped. "Turned on by a
 * share" is stored, so a reload during a share never leaves it on.
 * @param sharing Whether the screen is (about to be) shared
 */
export function followScreenShare(state: StreamerState, sharing: boolean) {
  if (sharing) {
    if (state.settings.streamerOnShare && !state.settings.streamerMode) {
      state.settings.streamerByShare = true;
      state.settings.streamerMode = true;
    }
  } else if (state.settings.streamerByShare) {
    state.settings.streamerByShare = false;
    state.settings.streamerMode = false;
  }
}

/**
 * Run a screen share toggle with streamer mode on before the capture
 * starts, and off again when it failed or was cancelled
 */
export async function shareWithStreamerMode(
  state: StreamerState,
  wasSharing: boolean,
  toggle: () => Promise<void>,
  sharing: () => boolean,
) {
  if (!wasSharing) followScreenShare(state, true);
  try {
    await toggle();
  } finally {
    if (!sharing()) followScreenShare(state, false);
  }
}

/** At start: a mode the last share turned on does not outlive the page */
export function streamerAfterLoad(settings: StreamerState["settings"]) {
  if (settings.streamerByShare) {
    settings.streamerByShare = false;
    settings.streamerMode = false;
  }
}

/** Whether a notification for this channel may show the message (DMs and groups hide it) */
export function notificationPreviewAllowed(
  streamerMode: boolean,
  channelType: string | undefined,
) {
  return (
    !streamerMode ||
    (channelType !== "DirectMessage" && channelType !== "Group")
  );
}
