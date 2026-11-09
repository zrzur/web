import { lazy, mergeProps, splitProps } from "solid-js";

import { IS_DEV } from "@revolt/client";

import { type ActiveModal } from ".";
import { Error2Modal } from "./modals/Error2";
import { PolicyChangeModal } from "./modals/PolicyChange";
import { SignedOutModal } from "./modals/SignedOut";

/**
 * Render the modal
 */
/* eslint-disable solid/reactivity */
/* eslint-disable solid/components-return-once */
// every other window loads the first time it opens (smaller first load);
// errors, sign-out and policy changes stay ready, also offline
const AddBotModal = lazy(() =>
  import("./modals/AddBot").then((m) => ({ default: m.AddBotModal })),
);
const AddFriendModal = lazy(() =>
  import("./modals/AddFriend").then((m) => ({ default: m.AddFriendModal })),
);
const AddMembersToGroupModal = lazy(() =>
  import("./modals/AddMembersToGroup").then((m) => ({
    default: m.AddMembersToGroupModal,
  })),
);
const BanMemberModal = lazy(() =>
  import("./modals/BanMember").then((m) => ({ default: m.BanMemberModal })),
);
const BanNonMemberModal = lazy(() =>
  import("./modals/BanNonMember").then((m) => ({
    default: m.BanNonMemberModal,
  })),
);
const BillingCheckoutStatusModal = lazy(() =>
  import("./modals/BillingCheckoutStatus").then((m) => ({
    default: m.BillingCheckoutStatusModal,
  })),
);
const ChannelInfoModal = lazy(() =>
  import("./modals/ChannelInfo").then((m) => ({ default: m.ChannelInfoModal })),
);
const ChannelToggleMatureModal = lazy(() =>
  import("./modals/ChannelToggleMature").then((m) => ({
    default: m.ChannelToggleMatureModal,
  })),
);
const CreateBotModal = lazy(() =>
  import("./modals/CreateBot").then((m) => ({ default: m.CreateBotModal })),
);
const CreateCategoryModal = lazy(() =>
  import("./modals/CreateCategory").then((m) => ({
    default: m.CreateCategoryModal,
  })),
);
const CreateChannelModal = lazy(() =>
  import("./modals/CreateChannel").then((m) => ({
    default: m.CreateChannelModal,
  })),
);
const CreateGroupModal = lazy(() =>
  import("./modals/CreateGroup").then((m) => ({ default: m.CreateGroupModal })),
);
const CreateGroupOrServer = lazy(() =>
  import("./modals/CreateGroupOrServer").then((m) => ({
    default: m.CreateGroupOrServer,
  })),
);
const CreateInviteModal = lazy(() =>
  import("./modals/CreateInvite").then((m) => ({
    default: m.CreateInviteModal,
  })),
);
const CreateOrJoinServerModal = lazy(() =>
  import("./modals/CreateOrJoinServer").then((m) => ({
    default: m.CreateOrJoinServerModal,
  })),
);
const CreateRoleModal = lazy(() =>
  import("./modals/CreateRole").then((m) => ({ default: m.CreateRoleModal })),
);
const CreateServerModal = lazy(() =>
  import("./modals/CreateServer").then((m) => ({
    default: m.CreateServerModal,
  })),
);
const CropModal = lazy(() =>
  import("./modals/CropProcess").then((m) => ({ default: m.CropModal })),
);
const CustomStatusModal = lazy(() =>
  import("./modals/CustomStatus").then((m) => ({
    default: m.CustomStatusModal,
  })),
);
const DeleteBotModal = lazy(() =>
  import("./modals/DeleteBot").then((m) => ({ default: m.DeleteBotModal })),
);
const DeleteCategoryModal = lazy(() =>
  import("./modals/DeleteCategory").then((m) => ({
    default: m.DeleteCategoryModal,
  })),
);
const DeleteChannelModal = lazy(() =>
  import("./modals/DeleteChannel").then((m) => ({
    default: m.DeleteChannelModal,
  })),
);
const DeleteEmojiModal = lazy(() =>
  import("./modals/DeleteEmoji").then((m) => ({ default: m.DeleteEmojiModal })),
);
const BulkDeleteMessagesModal = lazy(() =>
  import("./modals/BulkDeleteMessages").then((m) => ({
    default: m.BulkDeleteMessagesModal,
  })),
);
const DeleteMessageModal = lazy(() =>
  import("./modals/DeleteMessage").then((m) => ({
    default: m.DeleteMessageModal,
  })),
);
const DeleteRoleModal = lazy(() =>
  import("./modals/DeleteRole").then((m) => ({ default: m.DeleteRoleModal })),
);
const DeleteServerModal = lazy(() =>
  import("./modals/DeleteServer").then((m) => ({
    default: m.DeleteServerModal,
  })),
);
const EditBotUsernameModal = lazy(() =>
  import("./modals/EditBotUsername").then((m) => ({
    default: m.EditBotUsernameModal,
  })),
);
const CategoryPermissionsModal = lazy(() =>
  import("./modals/CategoryPermissions").then((m) => ({
    default: m.CategoryPermissionsModal,
  })),
);
const CreateThreadModal = lazy(() =>
  import("./modals/CreateThread").then((m) => ({
    default: m.CreateThreadModal,
  })),
);
const EditCategoryModal = lazy(() =>
  import("./modals/EditCategory").then((m) => ({
    default: m.EditCategoryModal,
  })),
);
const EditEmailModal = lazy(() =>
  import("./modals/EditEmail").then((m) => ({ default: m.EditEmailModal })),
);
const EditEmojiModal = lazy(() =>
  import("./modals/EditEmoji").then((m) => ({ default: m.EditEmojiModal })),
);
const EditPasswordModal = lazy(() =>
  import("./modals/EditPassword").then((m) => ({
    default: m.EditPasswordModal,
  })),
);
const EditServerFolderModal = lazy(() =>
  import("./modals/EditServerFolder").then((m) => ({
    default: m.EditServerFolderModal,
  })),
);
const EditUsernameModal = lazy(() =>
  import("./modals/EditUsername").then((m) => ({
    default: m.EditUsernameModal,
  })),
);
const EmojiPreviewModal = lazy(() =>
  import("./modals/EmojiPreview").then((m) => ({
    default: m.EmojiPreviewModal,
  })),
);
const InterestsModal = lazy(() =>
  import("./modals/InterestsModal").then((m) => ({
    default: m.InterestsModal,
  })),
);
const InviteModal = lazy(() =>
  import("./modals/Invite").then((m) => ({ default: m.InviteModal })),
);
const JoinServerModal = lazy(() =>
  import("./modals/JoinServer").then((m) => ({ default: m.JoinServerModal })),
);
const KickMemberModal = lazy(() =>
  import("./modals/KickMember").then((m) => ({ default: m.KickMemberModal })),
);
const LeaveServerModal = lazy(() =>
  import("./modals/LeaveServer").then((m) => ({ default: m.LeaveServerModal })),
);
const LinkWarningModal = lazy(() =>
  import("./modals/LinkWarning").then((m) => ({ default: m.LinkWarningModal })),
);
const MoveSuperchargeModal = lazy(() =>
  import("./modals/MoveSupercharge").then((m) => ({
    default: m.MoveSuperchargeModal,
  })),
);
const PinMessageModal = lazy(() =>
  import("./modals/PinMessage").then((m) => ({ default: m.PinMessageModal })),
);
const RemoveMemberModal = lazy(() =>
  import("./modals/RemoveMember").then((m) => ({
    default: m.RemoveMemberModal,
  })),
);
const RemoveTimeoutModal = lazy(() =>
  import("./modals/RemoveTimeout").then((m) => ({
    default: m.RemoveTimeoutModal,
  })),
);
const RenameSessionModal = lazy(() =>
  import("./modals/RenameSession").then((m) => ({
    default: m.RenameSessionModal,
  })),
);
const ReportContentModal = lazy(() =>
  import("./modals/ReportContent").then((m) => ({
    default: m.ReportContentModal,
  })),
);
const InteractionsEndpointModal = lazy(() =>
  import("./modals/InteractionsEndpoint").then((m) => ({
    default: m.InteractionsEndpointModal,
  })),
);
const ResetBotTokenModal = lazy(() =>
  import("./modals/ResetBotToken").then((m) => ({
    default: m.ResetBotTokenModal,
  })),
);
const ServerIdentityModal = lazy(() =>
  import("./modals/ServerIdentity").then((m) => ({
    default: m.ServerIdentityModal,
  })),
);
const ServerInfoModal = lazy(() =>
  import("./modals/ServerInfo").then((m) => ({ default: m.ServerInfoModal })),
);
const SignOutSessionsModal = lazy(() =>
  import("./modals/SignOutSessions").then((m) => ({
    default: m.SignOutSessionsModal,
  })),
);
const TimeoutMemberModal = lazy(() =>
  import("./modals/TimeoutMember").then((m) => ({
    default: m.TimeoutMemberModal,
  })),
);
const UserProfileModal = lazy(() =>
  import("./modals/UserProfile").then((m) => ({ default: m.UserProfileModal })),
);
const UserProfileMutualFriendsModal = lazy(() =>
  import("./modals/UserProfileMutualFriends").then((m) => ({
    default: m.UserProfileMutualFriendsModal,
  })),
);
const UserProfileMutualGroupsModal = lazy(() =>
  import("./modals/UserProfileMutualGroups").then((m) => ({
    default: m.UserProfileMutualGroupsModal,
  })),
);
const UserProfileRolesModal = lazy(() =>
  import("./modals/UserProfileRoles").then((m) => ({
    default: m.UserProfileRolesModal,
  })),
);
// big windows load the first time they open (smaller start-up bundle)
const ChangelogModal = lazy(() =>
  import("./modals/Changelog").then((m) => ({ default: m.ChangelogModal })),
);
const GiftPlusModal = lazy(() =>
  import("./modals/GiftPlus").then((m) => ({ default: m.GiftPlusModal })),
);
const ImageViewerModal = lazy(() =>
  import("./modals/ImageViewer").then((m) => ({ default: m.ImageViewerModal })),
);
const MFAEnableTOTPModal = lazy(() =>
  import("./modals/MFAEnableTOTP").then((m) => ({
    default: m.MFAEnableTOTPModal,
  })),
);
const MFAFlowModal = lazy(() =>
  import("./modals/MFAFlow").then((m) => ({ default: m.MFAFlowModal })),
);
const MFARecoveryModal = lazy(() =>
  import("./modals/MFARecovery").then((m) => ({ default: m.MFARecoveryModal })),
);
const OnboardingModal = lazy(() =>
  import("./modals/Onboarding").then((m) => ({ default: m.OnboardingModal })),
);
const PlusCheckoutModal = lazy(() =>
  import("./modals/PlusCheckout").then((m) => ({
    default: m.PlusCheckoutModal,
  })),
);
const PromoteServerModal = lazy(() =>
  import("./modals/PromoteServer").then((m) => ({
    default: m.PromoteServerModal,
  })),
);
const ScreenSharePickerModal = lazy(() =>
  import("./modals/ScreenSharePicker").then((m) => ({
    default: m.ScreenSharePickerModal,
  })),
);
const ScreenShareSettingsModal = lazy(() =>
  import("./modals/ScreenShareSettings").then((m) => ({
    default: m.ScreenShareSettingsModal,
  })),
);
const SettingsModal = lazy(() =>
  import("./modals/Settings").then((m) => ({ default: m.SettingsModal })),
);
const SuperchargeServerModal = lazy(() =>
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
    case "delete_bot":
      return <DeleteBotModal {...modalProps} />;
    case "delete_channel":
      return <DeleteChannelModal {...modalProps} />;
    case "delete_category":
      return <DeleteCategoryModal {...modalProps} />;
    case "delete_message":
      return <DeleteMessageModal {...modalProps} />;
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
    case "user_profile_mutual_friends":
      return <UserProfileMutualFriendsModal {...modalProps} />;
    case "user_profile_mutual_groups":
      return <UserProfileMutualGroupsModal {...modalProps} />;
    case "reset_bot_token":
      return <ResetBotTokenModal {...modalProps} />;
    case "interactions_endpoint":
      return <InteractionsEndpointModal {...modalProps} />;
    case "edit_category":
      return <EditCategoryModal {...modalProps} />;
    case "category_permissions":
      return <CategoryPermissionsModal {...modalProps} />;
    case "create_thread":
      return <CreateThreadModal {...modalProps} />;
    case "edit_server_folder":
      return <EditServerFolderModal {...modalProps} />;
    case "remove_member":
      return <RemoveMemberModal {...modalProps} />;
    case "pin_message":
      return <PinMessageModal {...modalProps} />;
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
