import { For, Show, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { createOwnProfileResource } from "@revolt/client/resources";
import { STAFF_TOOLS_ENABLED } from "@revolt/common/lib/staffTools";
import { useModals } from "@revolt/modal";
import { Avatar, Column, SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useCommunityPermissions } from "./CommunityParts";
import { CreatorPublicName } from "./CreatorPublicName";
import { CreatorStudio } from "./CreatorStudio";
import { CreatorsAdmin } from "./CreatorsAdmin";
import { ProfileLinksEditor, ProfileSectionsEditor } from "./ProfileExtras";
import { ReviewQueue } from "./ReviewQueue";
import { UserProfileEditor } from "./UserProfileEditor";
import { can, maySeeStudio } from "./communityApi";

/**
 * Edit profile: global profile with live preview, then per-server profiles
 */
export function EditProfile() {
  const client = useClient();
  const { openModal } = useModals();
  const profile = createOwnProfileResource();

  const servers = () => client().servers.toList();

  // Creator Studio, review and creator management: only for people staff
  // gave the permission to (the server checks again on every request)
  const { perms } = useCommunityPermissions();
  const [open, setOpen] = createSignal<"studio" | "review" | "creators">();
  const isCreator = () => maySeeStudio(perms());
  // hidden with the other staff and creator tools for now
  const showCommunity = () =>
    STAFF_TOOLS_ENABLED &&
    (isCreator() ||
      can(perms(), "cosmetics.review") ||
      can(perms(), "cosmetics.manage_creators"));
  const me = () => client().user!;

  return (
    <Column gap="xl">
      <UserProfileEditor user={client().user!} profile={profile.data} preview />

      <ProfileSectionsEditor user={client().user!} profile={profile.data} />
      <ProfileLinksEditor user={client().user!} profile={profile.data} />

      <Show when={perms()?.creator === "Active"}>
        <CreatorPublicName initial={!!perms()!.show_public_name} />
      </Show>

      <Show when={showCommunity()}>
        <SettingsSection
          title={<Trans>Designs</Trans>}
          description={
            <Trans>
              Decorations, nameplates and effects made by Zrzur's verified
              creators.
            </Trans>
          }
        >
          <Show when={isCreator()}>
            <SettingsRow
              icon={<Icon name="paint-brush" size={20} />}
              title={<Trans>Creator Studio</Trans>}
              description={
                <Trans>
                  Publish your designs and manage the ones you made.
                </Trans>
              }
              onClick={() => setOpen("studio")}
              navigational
            />
          </Show>
          <Show when={can(perms(), "cosmetics.review")}>
            <SettingsRow
              icon={<Icon name="seal-check" size={20} />}
              title={<Trans>Review queue</Trans>}
              description={
                <Trans>
                  Check reported designs and take down what breaks the rules.
                </Trans>
              }
              onClick={() => setOpen("review")}
              navigational
            />
          </Show>
          <Show when={can(perms(), "cosmetics.manage_creators")}>
            <SettingsRow
              icon={<Icon name="users-three" size={20} />}
              title={<Trans>Creators</Trans>}
              description={
                <Trans>Make someone a creator, or pause or revoke them.</Trans>
              }
              onClick={() => setOpen("creators")}
              navigational
            />
          </Show>
        </SettingsSection>
        <Show when={open() === "studio"}>
          <CreatorStudio
            show
            onClose={() => setOpen(undefined)}
            perms={perms()!}
            avatar={me().animatedAvatarURL}
            name={me().displayName}
          />
        </Show>
        <Show when={open() === "review"}>
          <ReviewQueue
            show
            onClose={() => setOpen(undefined)}
            perms={perms()!}
            avatar={me().animatedAvatarURL}
            name={me().displayName}
          />
        </Show>
        <Show when={open() === "creators"}>
          <CreatorsAdmin
            show
            onClose={() => setOpen(undefined)}
            perms={perms()!}
          />
        </Show>
      </Show>

      <SettingsSection
        title={<Trans>Server profiles</Trans>}
        description={
          <Trans>
            Use a different nickname or avatar in a specific server.
          </Trans>
        }
      >
        <Show
          when={servers().length}
          fallback={
            <SettingsRow
              icon={<Icon name="users-three" size={20} />}
              title={<Trans>You're not in any servers yet</Trans>}
              description={
                <Trans>Server profiles appear here once you join one.</Trans>
              }
            />
          }
        >
          <For each={servers()}>
            {(server) => (
              <SettingsRow
                icon={
                  <Avatar
                    src={server.animatedIconURL}
                    size={24}
                    fallback={server.name}
                    shape="rounded-square"
                  />
                }
                title={server.name}
                onClick={() =>
                  openModal({
                    type: "server_identity",
                    member: server.member!,
                  })
                }
                navigational
              />
            )}
          </For>
        </Show>
      </SettingsSection>
    </Column>
  );
}
