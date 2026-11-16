import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";

import { useError } from "@revolt/i18n";
import {
  Button,
  CircularProgress,
  Column,
  Dialog,
  Form2,
  Row,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { type CategoryContext, channelsOf, findCategory } from "./category";

/**
 * Category overview: its name and note, and the channels inside with
 * whether each follows the category's permissions
 */
export default function CategoryOverview(props: { context: CategoryContext }) {
  const { t } = useLingui();
  const describeError = useError();

  const category = createMemo(() => findCategory(props.context));
  const channels = createMemo(() => channelsOf(props.context, category()));
  const hiddenCount = () =>
    (category()?.channels.length ?? 0) - channels().length;
  const canEdit = () => props.context.server.havePermission("ManageChannel");

  /* eslint-disable solid/reactivity */
  // we want to take the initial value only
  const editGroup = createFormGroup({
    title: createFormControl(category()?.title ?? "", {
      disabled: !canEdit(),
    }),
    description: createFormControl(category()?.description ?? "", {
      disabled: !canEdit(),
    }),
  });
  /* eslint-enable solid/reactivity */

  function onReset() {
    editGroup.controls.title.setValue(category()?.title ?? "");
    editGroup.controls.description.setValue(category()?.description ?? "");
  }

  async function onSubmit() {
    const changes: { title?: string; description?: string } = {};
    if (editGroup.controls.title.isDirty) {
      changes.title = editGroup.controls.title.value.trim();
    }
    if (editGroup.controls.description.isDirty) {
      changes.description = editGroup.controls.description.value.trim();
    }
    await props.context.server.editCategory(props.context.categoryId, changes);
  }

  const submit = Form2.useSubmitHandler(editGroup, onSubmit, onReset);

  /** The channels to bring back to the category: one, or all that left it */
  const [confirm, setConfirm] = createSignal<Channel[]>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const ownPermissions = () =>
    channels().filter(
      (channel) =>
        !channel.permissionsSynced &&
        channel.havePermission("ManagePermissions"),
    );

  async function follow() {
    setBusy(true);
    setError(undefined);
    try {
      for (const channel of confirm() ?? []) {
        await channel.syncPermissions();
      }
      setConfirm(undefined);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Column gap="xl">
      <form onSubmit={submit}>
        <Column gap="lg">
          <SettingsSection title={<Trans>Category info</Trans>}>
            <SettingsFormPanel>
              <Form2.TextField
                minlength={1}
                maxlength={32}
                counter
                name="category_title"
                control={editGroup.controls.title}
                label={t`Category name`}
              />
              <Form2.TextField
                maxlength={120}
                counter
                name="category_description"
                control={editGroup.controls.description}
                label={t`Note (optional)`}
                placeholder={t`One short line about this category`}
              />
            </SettingsFormPanel>
          </SettingsSection>
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

      <SettingsSection
        title={<Trans>Channels in this category</Trans>}
        aside={
          <Show when={ownPermissions().length > 1}>
            <Button
              size="sm"
              variant="text"
              data-testid="category-follow-all"
              onPress={() => setConfirm(ownPermissions())}
            >
              <Trans>Make all follow</Trans>
            </Button>
          </Show>
        }
        description={
          <Trans>
            A channel follows the category's permissions until you change
            permissions on the channel itself.
          </Trans>
        }
      >
        <Show
          when={channels().length}
          fallback={
            <SettingsRow
              icon={<Icon name="hash" size={20} />}
              title={<Trans>No channels in this category yet.</Trans>}
            />
          }
        >
          <For each={channels()}>
            {(channel) => (
              <SettingsRow
                icon={
                  <Icon
                    name={channel.isVoiceRoom ? "speaker-high" : "hash"}
                    size={20}
                  />
                }
                title={channel.name}
                description={
                  <span data-testid={`category-channel-state-${channel.id}`}>
                    <Show
                      when={channel.permissionsSynced}
                      fallback={<Trans>Own permissions</Trans>}
                    >
                      <Trans>Follows the category</Trans>
                    </Show>
                  </span>
                }
                control={() => (
                  <Show
                    when={
                      !channel.permissionsSynced &&
                      channel.havePermission("ManagePermissions")
                    }
                  >
                    <Button
                      size="sm"
                      variant="tonal"
                      data-testid={`category-follow-${channel.id}`}
                      onPress={() => setConfirm([channel])}
                      aria-label={t`Make ${channel.name} follow the category`}
                    >
                      <Trans>Follow category</Trans>
                    </Button>
                  </Show>
                )}
              />
            )}
          </For>
        </Show>
        <Show when={hiddenCount() > 0}>
          <SettingsRow
            icon={<Icon name="lock-simple" size={20} />}
            title={
              <Trans>
                Channels here that are hidden from you: {hiddenCount()}
              </Trans>
            }
          />
        </Show>
      </SettingsSection>

      <Dialog
        tone="danger"
        show={!!confirm()}
        onClose={() => setConfirm(undefined)}
        title={<Trans>Follow the category?</Trans>}
        isDisabled={busy()}
        actions={[
          { text: <Trans>Cancel</Trans> },
          {
            text: <Trans>Follow category</Trans>,
            onClick: () => {
              void follow();
              return false;
            },
          },
        ]}
      >
        <Column gap="md">
          <span>
            <Trans>
              The channel's own permissions for everyone and for roles are
              removed and it uses the category's. Member overrides stay.
            </Trans>
          </span>
          <span>
            {(confirm() ?? []).map((channel) => channel.name).join(", ")}
          </span>
          <Show when={error()}>
            <span role="alert">{error()}</span>
          </Show>
        </Column>
      </Dialog>
    </Column>
  );
}
