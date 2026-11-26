import { lazy } from "@revolt/common/lib/lazyPart";
import { type Component, mergeProps, splitProps } from "solid-js";

import { IS_DEV } from "@revolt/client";

import { type ActiveModal } from ".";
import { Error2Modal } from "./modals/Error2";
import { PolicyChangeModal } from "./modals/PolicyChange";
import { SignedOutModal } from "./modals/SignedOut";

/** The windows' own parts: a failure of one of these means the window never drew */
const windowParts = new Set<unknown>();

/** lazy() for a window's own part */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function windowPart<T extends Component<any>>(
  fn: () => Promise<{ default: T }>,
) {
  const part = lazy(fn);
  windowParts.add(part);
  return part;
}

/** Is this a window's own part (not one nested inside a window)? */
export const isWindowPart = (part: unknown) => windowParts.has(part);

/**
 * Render the modal
 */
/* eslint-disable solid/reactivity */
/* eslint-disable solid/components-return-once */
// every other window loads the first time it opens (smaller first load);
// errors, sign-out and policy changes stay ready, also offline
const AddBotModal = windowPart(() =>
  import("./modals/AddBot").then((m) => ({ default: m.AddBotModal })),
);
const AddFriendModal = windowPart(() =>
  import("./modals/AddFriend").then((m) => ({ default: m.AddFriendModal })),
);
const AddMembersToGroupModal = windowPart(() =>
  import("./modals/AddMembersToGroup").then((m) => ({
    default: m.AddMembersToGroupModal,
  })),
);
const BanMemberModal = windowPart(() =>
  import("./modals/BanMember").then((m) => ({ default: m.BanMemberModal })),
);
const BanNonMemberModal = windowPart(() =>
  import("./modals/BanNonMember").then((m) => ({
    default: m.BanNonMemberModal,
  })),
);
const BillingCheckoutStatusModal = windowPart(() =>
  import("./modals/BillingCheckoutStatus").then((m) => ({
    default: m.BillingCheckoutStatusModal,
  })),
);
const ChannelInfoModal = windowPart(() =>
  import("./modals/ChannelInfo").then((m) => ({ default: m.ChannelInfoModal })),
);
const ChannelToggleMatureModal = windowPart(() =>
  import("./modals/ChannelToggleMature").then((m) => ({
    default: m.ChannelToggleMatureModal,
  })),
);
const CreateBotModal = windowPart(() =>
  import("./modals/CreateBot").then((m) => ({ default: m.CreateBotModal })),
);
const CreateCategoryModal = windowPart(() =>
  import("./modals/CreateCategory").then((m) => ({
    default: m.CreateCategoryModal,
  })),
);
const CreateChannelModal = windowPart(() =>
  import("./modals/CreateChannel").then((m) => ({
    default: m.CreateChannelModal,
  })),
);
const CreateGroupModal = windowPart(() =>
  import("./modals/CreateGroup").then((m) => ({ default: m.CreateGroupModal })),
);
const CreateGroupOrServer = windowPart(() =>
  import("./modals/CreateGroupOrServer").then((m) => ({
    default: m.CreateGroupOrServer,
  })),
);
const CreateInviteModal = windowPart(() =>
  import("./modals/CreateInvite").then((m) => ({
    default: m.CreateInviteModal,
  })),
);
const CreateOrJoinServerModal = windowPart(() =>
  import("./modals/CreateOrJoinServer").then((m) => ({
    default: m.CreateOrJoinServerModal,
  })),
);
const CreateRoleModal = windowPart(() =>
  import("./modals/CreateRole").then((m) => ({ default: m.CreateRoleModal })),
);
const CreateServerModal = windowPart(() =>
  import("./modals/CreateServer").then((m) => ({
    default: m.CreateServerModal,
  })),
);
const CropModal = windowPart(() =>
  import("./modals/CropProcess").then((m) => ({ default: m.CropModal })),
);
const CustomStatusModal = windowPart(() =>
  import("./modals/CustomStatus").then((m) => ({
    default: m.CustomStatusModal,
  })),
);
const VoiceRoomModal = windowPart(() =>
  import("./modals/VoiceRoom").then((m) => ({ default: m.VoiceRoomModal })),
);
const InstallAppModal = windowPart(() =>
  import("./modals/InstallApp").then((m) => ({ default: m.InstallAppModal })),
);
const DeleteBotModal = windowPart(() =>
  import("./modals/DeleteBot").then((m) => ({ default: m.DeleteBotModal })),
);
const DeleteCategoryModal = windowPart(() =>
  import("./modals/DeleteCategory").then((m) => ({
    default: m.DeleteCategoryModal,
  })),
);
const CloseTicketModal = windowPart(() =>
  import("./modals/CloseTicket").then((m) => ({
    default: m.CloseTicketModal,
  })),
);
const OpenTicketModal = windowPart(() =>
  import("./modals/OpenTicket").then((m) => ({
    default: m.OpenTicketModal,
  })),
);
const RoomControlsModal = windowPart(() =>
  import("./modals/RoomControls").then((m) => ({
    default: m.RoomControlsModal,
  })),
);
const DeleteChannelModal = windowPart(() =>
  import("./modals/DeleteChannel").then((m) => ({
    default: m.DeleteChannelModal,
  })),
);
const DeleteEmojiModal = windowPart(() =>
  import("./modals/DeleteEmoji").then((m) => ({ default: m.DeleteEmojiModal })),
);
const BulkDeleteMessagesModal = windowPart(() =>
  import("./modals/BulkDeleteMessages").then((m) => ({
    default: m.BulkDeleteMessagesModal,
  })),
);
const RemoveLinkPreviewsModal = windowPart(() =>
  import("./modals/RemoveLinkPreviews").then((m) => ({
    default: m.RemoveLinkPreviewsModal,
  })),
);
const DeleteMessageModal = windowPart(() =>
  import("./modals/DeleteMessage").then((m) => ({
    default: m.DeleteMessageModal,
  })),
);
const DeleteRoleModal = windowPart(() =>
  import("./modals/DeleteRole").then((m) => ({ default: m.DeleteRoleModal })),
);
const DeleteServerModal = windowPart(() =>
  import("./modals/DeleteServer").then((m) => ({
    default: m.DeleteServerModal,
  })),
);
const EditBotUsernameModal = windowPart(() =>
  import("./modals/EditBotUsername").then((m) => ({
    default: m.EditBotUsernameModal,
  })),
);
const CreateThreadModal = windowPart(() =>
  import("./modals/CreateThread").then((m) => ({
    default: m.CreateThreadModal,
  })),
);
const EditEmailModal = windowPart(() =>
  import("./modals/EditEmail").then((m) => ({ default: m.EditEmailModal })),
);
const EditEmojiModal = windowPart(() =>
  import("./modals/EditEmoji").then((m) => ({ default: m.EditEmojiModal })),
);
const EditPasswordModal = windowPart(() =>
  import("./modals/EditPassword").then((m) => ({
    default: m.EditPasswordModal,
  })),
);
const EditServerFolderModal = windowPart(() =>
  import("./modals/EditServerFolder").then((m) => ({
    default: m.EditServerFolderModal,
  })),
);
const EditUsernameModal = windowPart(() =>
  import("./modals/EditUsername").then((m) => ({
    default: m.EditUsernameModal,
  })),
);
const EmojiPreviewModal = windowPart(() =>
  import("./modals/EmojiPreview").then((m) => ({
    default: m.EmojiPreviewModal,
  })),
);
const InterestsModal = windowPart(() =>
  import("./modals/InterestsModal").then((m) => ({
    default: m.InterestsModal,
  })),
);
const InviteModal = windowPart(() =>
  import("./modals/Invite").then((m) => ({ default: m.InviteModal })),
);
const JoinServerModal = windowPart(() =>
  import("./modals/JoinServer").then((m) => ({ default: m.JoinServerModal })),
);
const KickMemberModal = windowPart(() =>
  import("./modals/KickMember").then((m) => ({ default: m.KickMemberModal })),
);
const LeaveServerModal = windowPart(() =>
  import("./modals/LeaveServer").then((m) => ({ default: m.LeaveServerModal })),
);
const LinkWarningModal = windowPart(() =>
  import("./modals/LinkWarning").then((m) => ({ default: m.LinkWarningModal })),
);
const MoveSuperchargeModal = windowPart(() =>
  import("./modals/MoveSupercharge").then((m) => ({
    default: m.MoveSuperchargeModal,
  })),
);
const PinMessageModal = windowPart(() =>
  import("./modals/PinMessage").then((m) => ({ default: m.PinMessageModal })),
);
const StartCallModal = windowPart(() =>
  import("./modals/StartCall").then((m) => ({ default: m.StartCallModal })),
);
const RemindMessageModal = windowPart(() =>
  import("./modals/RemindMessage").then((m) => ({
    default: m.RemindMessageModal,
  })),
);
const CreatePollModal = windowPart(() =>
  import("./modals/CreatePoll").then((m) => ({
    default: m.CreatePollModal,
  })),
);
const PollVotersModal = windowPart(() =>
  import("./modals/PollVoters").then((m) => ({
    default: m.PollVotersModal,
  })),
);
const EndPollModal = windowPart(() =>
  import("./modals/EndPoll").then((m) => ({ default: m.EndPollModal })),
);
const QuickSwitcherModal = windowPart(() =>
  import("./modals/QuickSwitcher").then((m) => ({
    default: m.QuickSwitcherModal,
  })),
);
const ForwardMessageModal = windowPart(() =>
  import("./modals/ForwardMessage").then((m) => ({
    default: m.ForwardMessageModal,
  })),
);
const RemoveMemberModal = windowPart(() =>
  import("./modals/RemoveMember").then((m) => ({
    default: m.RemoveMemberModal,
  })),
);
const RemoveTimeoutModal = windowPart(() =>
  import("./modals/RemoveTimeout").then((m) => ({
    default: m.RemoveTimeoutModal,
  })),
);
const RenameSessionModal = windowPart(() =>
  import("./modals/RenameSession").then((m) => ({
    default: m.RenameSessionModal,
  })),
);
const ReportContentModal = windowPart(() =>
  import("./modals/ReportContent").then((m) => ({
    default: m.ReportContentModal,
  })),
);
const InteractionsEndpointModal = windowPart(() =>
  import("./modals/InteractionsEndpoint").then((m) => ({
    default: m.InteractionsEndpointModal,
  })),
);
const ResetBotTokenModal = windowPart(() =>
  import("./modals/ResetBotToken").then((m) => ({
    default: m.ResetBotTokenModal,
  })),
);
const ServerIdentityModal = windowPart(() =>
  import("./modals/ServerIdentity").then((m) => ({
    default: m.ServerIdentityModal,
  })),
);
const ServerEventEditorModal = windowPart(() =>
  import("./modals/ServerEventEditor").then((m) => ({
    default: m.ServerEventEditorModal,
  })),
);
const ServerInfoModal = windowPart(() =>
  import("./modals/ServerInfo").then((m) => ({ default: m.ServerInfoModal })),
);
const SignOutSessionsModal = windowPart(() =>
  import("./modals/SignOutSessions").then((m) => ({
    default: m.SignOutSessionsModal,
  })),
);
const TimeoutMemberModal = windowPart(() =>
  import("./modals/TimeoutMember").then((m) => ({
    default: m.TimeoutMemberModal,
  })),
);
const UserProfileModal = windowPart(() =>
  import("./modals/UserProfile").then((m) => ({ default: m.UserProfileModal })),
);
const UserProfileMutualFriendsModal = windowPart(() =>
  import("./modals/UserProfileMutualFriends").then((m) => ({
    default: m.UserProfileMutualFriendsModal,
  })),
);
const UserProfileMutualGroupsModal = windowPart(() =>
  import("./modals/UserProfileMutualGroups").then((m) => ({
    default: m.UserProfileMutualGroupsModal,
  })),
);
const SteamGamesModal = windowPart(() =>
  import("./modals/SteamGames").then((m) => ({
    default: m.SteamGamesModal,
  })),
);
const UserProfileRolesModal = windowPart(() =>
  import("./modals/UserProfileRoles").then((m) => ({
    default: m.UserProfileRolesModal,
  })),
);
// big windows load the first time they open (smaller start-up bundle)
const ChangelogModal = windowPart(() =>
  import("./modals/Changelog").then((m) => ({ default: m.ChangelogModal })),
);
const GiftPlusModal = windowPart(() =>
  import("./modals/GiftPlus").then((m) => ({ default: m.GiftPlusModal })),
);
const ImageViewerModal = windowPart(() =>
  import("./modals/ImageViewer").then((m) => ({ default: m.ImageViewerModal })),
);
const MFAEnableTOTPModal = windowPart(() =>
  import("./modals/MFAEnableTOTP").then((m) => ({
    default: m.MFAEnableTOTPModal,
  })),
);
const MFAFlowModal = windowPart(() =>
  import("./modals/MFAFlow").then((m) => ({ default: m.MFAFlowModal })),
);
const MFARecoveryModal = windowPart(() =>
  import("./modals/MFARecovery").then((m) => ({ default: m.MFARecoveryModal })),
);
const OnboardingModal = windowPart(() =>
  import("./modals/Onboarding").then((m) => ({ default: m.OnboardingModal })),
);
const PlusCheckoutModal = windowPart(() =>
  import("./modals/PlusCheckout").then((m) => ({
    default: m.PlusCheckoutModal,
  })),
);
const PromoteServerModal = windowPart(() =>
  import("./modals/PromoteServer").then((m) => ({
    default: m.PromoteServerModal,
  })),
);
const ScreenSharePickerModal = windowPart(() =>
  import("./modals/ScreenSharePicker").then((m) => ({
    default: m.ScreenSharePickerModal,
  })),
);
const ScreenShareSettingsModal = windowPart(() =>
  import("./modals/ScreenShareSettings").then((m) => ({
    default: m.ScreenShareSettingsModal,
  })),
);
const SettingsModal = windowPart(() =>
  import("./modals/Settings").then((m) => ({ default: m.SettingsModal })),
);
const SuperchargeServerModal = windowPart(() =>
  import("./modals/SuperchargeServer").then((m) => ({
    default: m.SuperchargeServerModal,
  })),
);

export function RenderModal(props: ActiveModal & { onClose: () => void }) {
  if (IS_DEV) {
    console.info(
      "components/modal — modal renderer created for type:",
      props.props.type,
    );
  }

  const [modal2Props] = splitProps(props, ["show", "onClose"]);
  // modalId lets a modal hold back closing (ModalController.guardClose)
  const modalProps = mergeProps(props.props, modal2Props, {
    modalId: props.id,
  });

  switch (modalProps.type) {
    case "add_bot":
      return <AddBotModal {...modalProps} />;
    case "add_friend":
      return <AddFriendModal {...modalProps} />;
    case "ban_member":
      return <BanMemberModal {...modalProps} />;
    case "ban_non_member":
      return <BanNonMemberModal {...modalProps} />;
    case "changelog":
      return <ChangelogModal {...modalProps} />;
    case "add_members_to_group":
      return <AddMembersToGroupModal {...modalProps} />;
    case "channel_info":
      return <ChannelInfoModal {...modalProps} />;
    case "channel_toggle_mature":
      return <ChannelToggleMatureModal {...modalProps} />;
    case "create_bot":
      return <CreateBotModal {...modalProps} />;
    case "create_category":
      return <CreateCategoryModal {...modalProps} />;
    case "create_channel":
      return <CreateChannelModal {...modalProps} />;
    case "create_group":
      return <CreateGroupModal {...modalProps} />;
    case "create_invite":
      return <CreateInviteModal {...modalProps} />;
    case "create_or_join_server":
      return <CreateOrJoinServerModal {...modalProps} />;
    case "create_group_or_server":
      return <CreateGroupOrServer {...modalProps} />;
    case "create_role":
      return <CreateRoleModal {...modalProps} />;
    case "create_server":
      return <CreateServerModal {...modalProps} />;
    case "custom_status":
      return <CustomStatusModal {...modalProps} />;
    case "install_app":
      return <InstallAppModal {...modalProps} />;
    case "voice_room":
      return <VoiceRoomModal {...modalProps} />;
    case "delete_bot":
      return <DeleteBotModal {...modalProps} />;
    case "close_ticket":
      return <CloseTicketModal {...modalProps} />;
    case "open_ticket":
      return <OpenTicketModal {...modalProps} />;
    case "room_controls":
      return <RoomControlsModal {...modalProps} />;
    case "delete_channel":
      return <DeleteChannelModal {...modalProps} />;
    case "delete_category":
      return <DeleteCategoryModal {...modalProps} />;
    case "delete_message":
      return <DeleteMessageModal {...modalProps} />;
    case "remove_link_previews":
      return <RemoveLinkPreviewsModal {...modalProps} />;
    case "bulk_delete_messages":
      return <BulkDeleteMessagesModal {...modalProps} />;
    case "delete_role":
      return <DeleteRoleModal {...modalProps} />;
    case "delete_server":
      return <DeleteServerModal {...modalProps} />;
    case "edit_email":
      return <EditEmailModal {...modalProps} />;
    case "edit_password":
      return <EditPasswordModal {...modalProps} />;
    case "edit_username":
      return <EditUsernameModal {...modalProps} />;
    case "emoji_preview":
      return <EmojiPreviewModal {...modalProps} />;
    case "error2":
      return <Error2Modal {...modalProps} />;
    case "image_viewer":
      return <ImageViewerModal {...modalProps} />;
    case "invite":
      return <InviteModal {...modalProps} />;
    case "join_server":
      return <JoinServerModal {...modalProps} />;
    case "kick_member":
      return <KickMemberModal {...modalProps} />;
    case "interests":
      return <InterestsModal {...modalProps} />;
    case "leave_server":
      return <LeaveServerModal {...modalProps} />;
    case "plus_checkout":
      return <PlusCheckoutModal {...modalProps} />;
    case "billing_checkout_status":
      return <BillingCheckoutStatusModal {...modalProps} />;
    case "gift_plus":
      return <GiftPlusModal {...modalProps} />;
    case "supercharge_server":
      return <SuperchargeServerModal {...modalProps} />;
    case "move_supercharge":
      return <MoveSuperchargeModal {...modalProps} />;
    case "promote_server":
    case "promote_bot":
      return <PromoteServerModal {...modalProps} />;
    case "link_warning":
      return <LinkWarningModal {...modalProps} />;
    case "mfa_enable_totp":
      return <MFAEnableTOTPModal {...modalProps} />;
    case "mfa_flow":
      return <MFAFlowModal {...modalProps} />;
    case "mfa_recovery":
      return <MFARecoveryModal {...modalProps} />;
    case "onboarding":
      return <OnboardingModal {...modalProps} />;
    case "policy_change":
      return <PolicyChangeModal {...modalProps} />;
    case "rename_session":
      return <RenameSessionModal {...modalProps} />;
    case "report_content":
      return <ReportContentModal {...modalProps} />;
    case "server_identity":
      return <ServerIdentityModal {...modalProps} />;
    case "server_info":
      return <ServerInfoModal {...modalProps} />;
    case "server_event":
      return <ServerEventEditorModal {...modalProps} />;
    case "settings":
      return <SettingsModal {...modalProps} />;
    case "signed_out":
      return <SignedOutModal {...modalProps} />;
    case "sign_out_sessions":
      return <SignOutSessionsModal {...modalProps} />;
    case "user_profile":
      return <UserProfileModal {...modalProps} />;
    case "user_profile_roles":
      return <UserProfileRolesModal {...modalProps} />;
    case "steam_games":
      return <SteamGamesModal {...modalProps} />;
    case "user_profile_mutual_friends":
      return <UserProfileMutualFriendsModal {...modalProps} />;
    case "user_profile_mutual_groups":
      return <UserProfileMutualGroupsModal {...modalProps} />;
    case "reset_bot_token":
      return <ResetBotTokenModal {...modalProps} />;
    case "interactions_endpoint":
      return <InteractionsEndpointModal {...modalProps} />;
    case "create_thread":
      return <CreateThreadModal {...modalProps} />;
    case "edit_server_folder":
      return <EditServerFolderModal {...modalProps} />;
    case "remove_member":
      return <RemoveMemberModal {...modalProps} />;
    case "pin_message":
      return <PinMessageModal {...modalProps} />;
    case "start_call":
      return <StartCallModal {...modalProps} />;
    case "create_poll":
      return <CreatePollModal {...modalProps} />;
    case "remind_message":
      return <RemindMessageModal {...modalProps} />;
    case "poll_voters":
      return <PollVotersModal {...modalProps} />;
    case "end_poll":
      return <EndPollModal {...modalProps} />;
    case "forward_message":
      return <ForwardMessageModal {...modalProps} />;
    case "quick_switcher":
      return <QuickSwitcherModal {...modalProps} />;
    case "edit_bot_username":
      return <EditBotUsernameModal {...modalProps} />;
    case "screen_share_settings":
      return <ScreenShareSettingsModal {...modalProps} />;
    case "screen_share_picker":
      return <ScreenSharePickerModal {...modalProps} />;
    case "timeout_member":
      return <TimeoutMemberModal {...modalProps} />;
    case "remove_timeout":
      return <RemoveTimeoutModal {...modalProps} />;
    case "edit_emoji":
      return <EditEmojiModal {...modalProps} />;
    case "delete_emoji":
      return <DeleteEmojiModal {...modalProps} />;
    case "crop":
      return <CropModal {...modalProps} />;
    default:
      console.error(
        "Failed to create modal for",
        props.props.type,
        "as it is not registered.",
      );
  }
}
