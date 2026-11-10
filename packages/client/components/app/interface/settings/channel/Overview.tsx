import { createFormControl, createFormGroup } from "solid-forms";
import { Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { matureAccess } from "@revolt/client/age";
import { useDurationFormat } from "@revolt/i18n/durations";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import {
  Button,
  CircularProgress,
  Column,
  Form2,
  MenuItem,
  Row,
  SettingsFormPanel,
  SettingsIdentityPanel,
  SettingsRow,
  SettingsSection,
  Toggle,
  humanFileSize,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { parseUserLimit, userLimitChange } from "@revolt/rtc/moderation";
import { ChannelSettingsProps } from "../ChannelSettings";
import { UserLimitSlider } from "./UserLimitSlider";

/**
 * Channel overview
 */
export default function ChannelOverview(props: ChannelSettingsProps) {
  const { t } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const instance = useInstance();
  const duration = useDurationFormat();

  /* eslint-disable solid/reactivity */
  // we want to take the initial value only
  const editGroup = createFormGroup({
    name: createFormControl(props.channel.name),
    description: createFormControl(props.channel.description || ""),
    icon: createFormControl<string | File[] | null>(
      props.channel.animatedIconURL,
    ),
    slowmode: createFormControl<string>(
      props.channel.slowmode.toString() ?? "0",
    ),
    userLimit: createFormControl(
      props.channel.voice?.maxUsers?.toString() ?? "",
    ),
    announcement: createFormControl(props.channel.announcement),
  });
  /* eslint-enable solid/reactivity */

  function onReset() {
    editGroup.controls.name.setValue(props.channel.name);
    editGroup.controls.description.setValue(props.channel.description || "");
    editGroup.controls.icon.setValue(props.channel.animatedIconURL ?? null);
    editGroup.controls.slowmode.setValue(
      props.channel.slowmode.toString() ?? "0",
    );
    editGroup.controls.userLimit.setValue(
      props.channel.voice?.maxUsers?.toString() ?? "",
    );
    editGroup.controls.announcement.setValue(props.channel.announcement);
  }

  async function onSubmit() {
    const changes: Parameters<typeof props.channel.edit>[0] = {
      remove: [],
    };

    if (editGroup.controls.name.isDirty) {
      changes.name = editGroup.controls.name.value.trim();
    }

    if (editGroup.controls.description.isDirty) {
      const description = editGroup.controls.description.value.trim();

      if (description) {
        changes.description = description;
      } else {
        changes.remove!.push("Description");
      }
    }

    if (editGroup.controls.icon.isDirty) {
      if (!editGroup.controls.icon.value) {
        changes.remove!.push("Icon");
      } else if (Array.isArray(editGroup.controls.icon.value)) {
        changes.icon = await client().uploadFile(
          "icons",
          editGroup.controls.icon.value[0],
          instance.mediaUrl,
        );
      }
    }

    if (editGroup.controls.slowmode.isDirty) {
      changes.slowmode = Number(editGroup.controls.slowmode.value);
    }
    if (editGroup.controls.announcement.isDirty) {
      changes.announcement = editGroup.controls.announcement.value;
    }
    if (props.channel.isVoice && editGroup.controls.userLimit.isDirty) {
      changes.voice = userLimitChange(
        parseUserLimit(editGroup.controls.userLimit.value),
      );
    }

    await props.channel.edit(changes);
  }

  const toggleAnnouncement = () => {
    editGroup.controls.announcement.setValue(
      !editGroup.controls.announcement.value,
    );
    editGroup.controls.announcement.markDirty(true);
  };

  const submit = Form2.useSubmitHandler(editGroup, onSubmit, onReset);

  return (
    <Column gap="xl">
      <form onSubmit={submit}>
        <Column gap="lg">
          <SettingsSection title={<Trans>Channel info</Trans>}>
            <SettingsIdentityPanel
              picker={
                <Form2.FileInput
                  control={editGroup.controls.icon}
                  accept="image/*"
                  label={t`Change channel icon`}
                  removeLabel={t`Remove channel icon`}
                  imageJustify={false}
                  imageHeight={96}
                  hideMaxSize
                  maxSize={instance.limits().file_upload_size_limits["icons"]}
                  process={cropProcess({
                    ratio: 1,
                    ratioLabel: t`Square`,
                    openModal,
                    allowModeToggle: false,
                    dialogTitle: t`Crop channel icon`,
                  })}
                />
              }
              caption={
                <Trans>
                  Square, up to{" "}
                  {humanFileSize(
                    instance.limits().file_upload_size_limits["icons"],
                  )}
                </Trans>
              }
            >
              <Form2.TextField
                minlength={1}
                maxlength={32}
                counter
                name="name"
                control={editGroup.controls.name}
                label={t`Channel name`}
              />
              <Form2.TextField
                autosize
                min-rows={2}
                maxlength={1024}
                counter
                name="description"
                control={editGroup.controls.description}
                label={t`Channel description`}
                placeholder={t`This channel is about...`}
              />
            </SettingsIdentityPanel>
          </SettingsSection>
          <Show when={props.channel.type === "TextChannel"}>
            <Show when={props.channel.isVoice}>
              <SettingsSection title={<Trans>Voice</Trans>}>
                <SettingsFormPanel>
                  <UserLimitSlider
                    control={editGroup.controls.userLimit}
                    disabled={!props.channel.havePermission("ManageChannel")}
                  />
                  <Hint>
                    <Trans>
                      Slide all the way left for no limit. Lowering the limit
                      does not disconnect anyone.
                    </Trans>
                  </Hint>
                </SettingsFormPanel>
              </SettingsSection>
            </Show>
            {/* voice rooms have no chat: slowmode and announcement don't apply
                (the server refuses announcement on a voice room) */}
            <Show when={!props.channel.isVoice}>
              <SettingsSection title={<Trans>Chat</Trans>}>
                <SettingsFormPanel>
                  <Form2.Select
                    label={t`Channel slowmode`}
                    control={editGroup.controls.slowmode}
                  >
                    <MenuItem value="0">
                      <Trans>Slowmode off</Trans>
                    </MenuItem>
                    <MenuItem value="5">{duration({ seconds: 5 })}</MenuItem>
                    <MenuItem value="10">{duration({ seconds: 10 })}</MenuItem>
                    <MenuItem value="30">{duration({ seconds: 30 })}</MenuItem>
                    <MenuItem value="60">{duration({ minutes: 1 })}</MenuItem>
                    <MenuItem value="300">{duration({ minutes: 5 })}</MenuItem>
                    <MenuItem value="600">{duration({ minutes: 10 })}</MenuItem>
                    <MenuItem value="1800">
                      {duration({ minutes: 30 })}
                    </MenuItem>
                    <MenuItem value="3600">{duration({ hours: 1 })}</MenuItem>
                    <MenuItem value="7200">{duration({ hours: 2 })}</MenuItem>
                    <MenuItem value="21600">{duration({ hours: 6 })}</MenuItem>
                  </Form2.Select>
                </SettingsFormPanel>
                <SettingsRow
                  icon={<Icon name="megaphone" size={20} />}
                  title={<Trans>Announcement channel</Trans>}
                  description={
                    <Trans>
                      Only people who can manage messages post here. Everyone
                      else reads.
                    </Trans>
                  }
                  onClick={toggleAnnouncement}
                  control={(ids) => (
                    <Toggle
                      checked={editGroup.controls.announcement.value}
                      onChange={toggleAnnouncement}
                      aria-labelledby={ids.labelId}
                      aria-describedby={ids.descriptionId}
                    />
                  )}
                />
              </SettingsSection>
            </Show>
          </Show>
          <Row>
            <Form2.Reset group={editGroup} onReset={onReset} />
            <Form2.Submit group={editGroup} requireDirty>
              <Trans>Save</Trans>
            </Form2.Submit>
            <Show when={editGroup.isPending}>
              <CircularProgress />
            </Show>
          </Row>
        </Column>
      </form>
      <SettingsSection title={<Trans>Mark as Mature</Trans>}>
        <MatureRow>
          <Show
            when={
              props.channel.mature || matureAccess() !== "verification_required"
            }
            fallback={
              <Hint data-testid="mature-paused">
                <Trans>
                  Mature channels are paused: nobody can open mature content
                  until Zrzur offers an age check.
                </Trans>
              </Hint>
            }
          >
            <Hint>
              <Trans>
                Users will be asked to confirm their age before opening this
                channel.
              </Trans>
            </Hint>
            <Button
              onPress={() =>
                openModal({
                  type: "channel_toggle_mature",
                  channel: props.channel,
                })
              }
            >
              <Switch fallback={<Trans>Mark as Mature</Trans>}>
                <Match when={props.channel.mature}>
                  <Trans>Unmark as Mature</Trans>
                </Match>
              </Switch>
            </Button>
          </Show>
        </MatureRow>
      </SettingsSection>
    </Column>
  );
}

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const MatureRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px 16px",
    padding: "14px 16px",
  },
});
