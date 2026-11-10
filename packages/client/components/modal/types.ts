import {
  API,
  Bot,
  Channel,
  Client,
  Emoji,
  ImageEmbed,
  Message,
  MFA,
  MFATicket,
  ProtocolV1,
  PublicBot,
  PublicChannelInvite,
  Server,
  ServerMember,
  ServerRole,
  Session,
  File as StoatFile,
  User,
  VideoEmbed,
} from "@zrzur/sdk/solid";
import type { TrackReference } from "solid-livekit-components";

import type { SettingsConfigurations } from "@revolt/app/interface/settings";
import { CategoryData } from "@revolt/app/menus/CategoryContextMenu";
import { ServerFolder } from "@revolt/state/stores/ServerFolders";
import {
  ScreenShareContent,
  ScreenShareQualityName,
} from "@revolt/state/stores/Voice";

import type { ReportTargetSpec } from "@revolt/app/interface/safety/safetyApi";
import type { OrderCheckout, Supercharge } from "@revolt/client/billing";

import type { PromoteTarget } from "./modals/PromoteServer";

import type { ChangelogResponse } from "./modals/changelogFeed";
import { CropProcessOptions } from "./modals/CropProcess";

export type Modals =
  | {
      type: "add_bot";
      invite: PublicBot;
      /**
       * Permissions the bot's invite link asks for (bit field)
       */
      permissions?: number;
    }
  | {
      type: "add_friend";
      client: Client;
    }
  | {
      type: "add_members_to_group";
      client: Client;
      group: Channel;
    }
  | {
      type: "ban_member";
      member: ServerMember;
    }
  | {
      type: "ban_non_member";
      user: User;
      server: Server;
    }
  | {
      type: "changelog";
      changelog: ChangelogResponse;
    }
  | {
      type: "channel_info";
      channel: Channel;
    }
  | {
      type: "channel_toggle_mature";
      channel: Channel;
    }
  | {
      type: "create_bot";
      client: Client;
      onCreate: (bot: Bot) => void;
    }
  | {
      type: "create_category";
      server: Server;
    }
  | {
      type: "create_channel";
      server: Server;
      initialType?: "Text" | "Voice";
      categoryId?: string;
      cb?: (channel: Channel) => void;
    }
  | {
      type: "create_group";
      client: Client;
    }
  | {
      type: "create_role";
      server: Server;
      callback: (id: string) => void;
    }
  | {
      type: "create_or_join_server";
      client: Client;
    }
  | {
      type: "create_group_or_server";
      client: Client;
    }
  | {
      type: "create_invite";
      channel: Channel;
    }
  | {
      type: "create_server";
      client: Client;
    }
  | {
      type: "custom_status";
      client: Client;
    }
  | {
      type: "delete_bot";
      bot: Bot;
      onDelete?: () => void;
    }
  | {
      type: "delete_channel";
      channel: Channel;
    }
  | {
      type: "delete_category";
      server: Server;
      categoryId: string;
    }
  | {
      type: "delete_message";
      message: Message;
    }
  | {
      type: "bulk_delete_messages";
      channel: Channel;
      /** The selected messages; left out = pick recent messages */
      ids?: string[];
    }
  | {
      type: "pin_message";
      message: Message;
    }
  | {
      type: "create_poll";
      channel: Channel;
    }
  | {
      type: "poll_voters";
      message: Message;
    }
  | {
      type: "end_poll";
      message: Message;
    }
  | {
      type: "forward_message";
      message: Message;
    }
  | {
      type: "delete_server";
      server: Server;
    }
  | {
      type: "delete_role";
      role: ServerRole;
      cb: () => void;
    }
  | {
      type: "edit_email";
      client: Client;
    }
  | {
      type: "edit_password";
      client: Client;
    }
  | {
      type: "edit_username";
      client: Client;
    }
  | {
      type: "emoji_preview";
      emoji: Emoji;
    }
  | {
      type: "error2";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: any;
    }
  | {
      type: "image_viewer";
      embed?: ImageEmbed;
      gif?: VideoEmbed;
      file?: StoatFile;
    }
  | {
      type: "join_server";
      client: Client;
    }
  | {
      type: "kick_member";
      member: ServerMember;
    }
  | {
      type: "leave_server";
      server: Server;
    }
  | {
      type: "plus_checkout";
    }
  | {
      type: "billing_checkout_status";
      /** order being paid at the payment provider */
      orderId: string;
      /** what creating it returned, shown until the first refresh */
      checkout?: OrderCheckout;
    }
  | {
      type: "gift_plus";
      /** preselected friend */
      user?: User;
    }
  | {
      type: "supercharge_server";
      server: Server;
    }
  | {
      type: "move_supercharge";
      supercharge: Supercharge;
    }
  | {
      type: "promote_server";
      server: Server;
    }
  | {
      type: "promote_bot";
      target: PromoteTarget;
    }
  | {
      type: "mfa_enable_totp";
      identifier: string;
      secret: string;
      callback: (code?: string) => Promise<void>;
      reject?: (reason?: string) => void;
    }
  | ({
      type: "mfa_flow";
    } & (
      | {
          mfa: MFA;
          state: "known";
          callback: (ticket?: MFATicket) => void;
        }
      | {
          state: "unknown";
          available_methods: API.MFAMethod[];
          callback: (response?: API.MFAResponse) => void;
        }
    ))
  | { type: "mfa_recovery"; codes: string[]; mfa: MFA }
  | {
      type: "onboarding";
      callback: (username: string, loginAfterSuccess?: true) => Promise<void>;
    }
  | {
      type: "policy_change";
      changes: ProtocolV1["types"]["policyChange"][];
      acknowledge: () => Promise<void>;
    }
  | {
      type: "rename_session";
      session: Session;
    }
  | {
      type: "report_content";
      client: Client;
      target: Server | User | Message | ReportTargetSpec;
      contextMessage?: Message;
    }
  | {
      type: "server_identity";
      member: ServerMember;
    }
  | {
      type: "server_info";
      server: Server;
    }
  | {
      type: "server_event";
      server: Server;
      /** the event to change; a new one when absent */
      event?: API.ServerEvent;
    }
  | {
      type: "invite";
      invite: PublicChannelInvite;
    }
  | {
      type: "interests";
      server: Server;
    }
  | {
      type: "settings";
      config: keyof typeof SettingsConfigurations;
      /** Open a settings page without mutating its context object. */
      initialPage?: string;
      // eslint-disable-next-line
      context?: any;
    }
  | {
      type: "signed_out";
    }
  | {
      type: "sign_out_sessions";
      client: Client;
      /** One session to close; without it, all others */
      session?: Session;
    }
  // unimplemented: (modals.tsx#L58)
  | {
      type: "report_success";
      user?: User;
    }
  | {
      type: "out_of_date";
      version: string;
    }
  | {
      type: "reset_bot_token";
      bot: Bot;
    }
  | {
      type: "interactions_endpoint";
      bot: Bot;
    }
  | {
      type: "link_warning";
      url: URL;
      display: string;
    }
  // | {
  //     type: "pending_friend_requests";
  //     users: User[];
  //   }
  | {
      type: "user_picker";
      omit?: string[];
      callback: (users: string[]) => Promise<void>;
    }
  | {
      type: "user_profile";
      user: User;
      isPlaceholder?: boolean;
      placeholderProfile?: API.UserProfile;
      member?: ServerMember;
    }
  | {
      type: "user_profile_roles";
      member: ServerMember;
    }
  | {
      type: "user_profile_mutual_friends";
      users: User[];
      server?: Server;
    }
  | {
      type: "user_profile_mutual_groups";
      groups: (Server | Channel)[];
    }
  | {
      type: "leave_group";
      channel: Channel;
    }
  | {
      type: "close_dm";
      channel: Channel;
    }
  | {
      type: "unfriend_user";
      user: User;
    }
  | {
      type: "block_user";
      user: User;
    }
  | {
      type: "import_theme";
    }
  | {
      type: "edit_category";
      server: Server;
      category: CategoryData;
    }
  | {
      type: "create_thread";
      channel: Channel;
      /** start the thread from this message */
      message?: Message;
      /** suggested name */
      name?: string;
    }
  | {
      type: "category_permissions";
      server: Server;
      category: CategoryData;
    }
  | {
      type: "edit_server_folder";
      folder: ServerFolder;
    }
  | {
      type: "remove_member";
      group: Channel;
      user: User;
    }
  | {
      type: "screen_share_settings";
      trackReference: TrackReference;
      qualities: { name: string; fullName: string }[];
      audio: boolean;
      callback: (
        qualityName: ScreenShareQualityName,
        audio: boolean,
        content: ScreenShareContent,
      ) => void;
      onCancel: () => void;
    }
  | {
      type: "screen_share_picker";
      callback: (
        idx: number,
        qualityName: ScreenShareQualityName,
        audio: boolean,
        content: ScreenShareContent,
      ) => void;
      qualities: { name: string; fullName: string }[];
      sources: {
        idx: number;
        name: string;
        isFullScreen: boolean;
        image?: string;
      }[];
      onCancel: () => void;
    }
  | {
      type: "timeout_member";
      member: ServerMember;
    }
  | {
      type: "remove_timeout";
      member: ServerMember;
    }
  | {
      type: "edit_bot_username";
      bot: Bot;
    }
  | {
      type: "edit_emoji";
      emoji: Emoji;
    }
  | {
      type: "delete_emoji";
      emoji: Emoji;
    }
  | {
      type: "crop";
      options: CropProcessOptions;
      files: File[];
      resolve: (files: File[] | null) => void;
      maxSize: number | undefined;
    };
