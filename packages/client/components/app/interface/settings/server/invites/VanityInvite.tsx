import { For, Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  billingAvailable,
  billingPlans,
  refreshBilling,
  vanityLevel,
} from "@revolt/client/billing";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { getInviteLink } from "@revolt/modal/modals/CreateInvite";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  SettingsStatus,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";
import { vanityState } from "./vanityState";

/**
 * Custom invite link (zrzur.cc/<name>), unlocked by a Wings level
 */
export function VanityInvite(props: { server: Server }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const { navigate } = useSettingsNavigation();

  onMount(() => {
    if (!billingPlans()) refreshBilling(client());
  });

  const current = () => props.server.vanityInvite;
  const required = () => vanityLevel();
  const level = () => props.server.supercharge?.level ?? 0;
  // with billing off nothing is paid for: the link is open to every server
  const free = () => !!billingPlans() && !billingAvailable();
  const unlocked = () =>
    free() || (!!required() && level() >= required()!.level);

  const [code, setCode] = createSignal(current()?.code ?? "");
  const [channel, setChannel] = createSignal(current()?.channel ?? "");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [armed, setArmed] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const name = () => code().trim().toLowerCase();
  const nameProblem = () => {
    if (!name()) return undefined;
    if (name().length < 3 || !isInviteCode(name()))
      return t`Use 3–32 letters, numbers or single hyphens.`;
  };
  const changed = () =>
    name() !== (current()?.code ?? "") ||
    channel() !== (current()?.channel ?? "");
  const canSave = () =>
    unlocked() && !!name() && !nameProblem() && changed() && !pending();

  const textChannels = () =>
    props.server.channels.filter((entry) => entry.type === "TextChannel");

  const state = () => vanityState(current()?.belowLevelSince);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(i18n().locale, { dateStyle: "medium" }).format(
      value,
    );

  async function save() {
    if (!canSave()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.claimVanityInvite(name(), channel() || undefined);
      setCode(props.server.vanityInvite?.code ?? name());
      setChannel(props.server.vanityInvite?.channel ?? "");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!armed()) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setPending(true);
    setError(undefined);
    try {
      await props.server.removeVanityInvite();
      setCode("");
      setChannel("");
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  function copy() {
    const value = current()?.code;
    if (!value) return;
    navigator.clipboard.writeText(getInviteLink(value, instance));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Show when={free() || required()}>
      <SettingsSection
        title={<Trans>Custom invite link</Trans>}
        description={
          <Show
            when={free()}
            fallback={
              <Trans>
                One short, memorable link for your server, like
                zrzur.cc/your-name. Unlocked at Wings level{" "}
                {required()!.level}.
              </Trans>
            }
          >
            <Trans>
              One short, memorable link for your server, like zrzur.cc/your-name.
            </Trans>
          </Show>
        }
        aside={
          <Show when={current()}>
            <Switch>
              <Match when={state().kind === "grace"}>
                <SettingsStatus tone="warning">
                  <Trans>Ending soon</Trans>
                </SettingsStatus>
              </Match>
              <Match when={state().kind === "paused"}>
                <SettingsStatus tone="warning">
                  <Trans>Paused</Trans>
                </SettingsStatus>
              </Match>
              <Match when={state().kind === "active"}>
                <SettingsStatus tone="success">
                  <Trans>Active</Trans>
                </SettingsStatus>
              </Match>
            </Switch>
          </Show>
        }
      >
        <Switch>
          <Match when={!unlocked() && !current()}>
            <SettingsRow
              icon={<Icon name="lock-simple" size={20} />}
              title={
                <Trans>
                  Reach level {required()!.level} to unlock (
                  {required()!.supercharges} Wings)
                </Trans>
              }
              description={
                <Trans>
                  This server is at level {level()} with{" "}
                  {props.server.supercharge?.count ?? 0} Wings.
                </Trans>
              }
              control={() => (
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => navigate("wings")}
                >
                  <Trans>See levels</Trans>
                </Button>
              )}
            />
          </Match>
          <Match when={true}>
            <SettingsFormPanel>
              <Show when={state().kind === "grace"}>
                <Notice data-tone="warning" role="status">
                  <Icon name="warning" size={18} />
                  <span>
                    <Trans>
                      This server is below level {required()!.level}. The link
                      keeps working until{" "}
                      {date((state() as { ends: Date }).ends)}, then pauses.
                    </Trans>
                  </span>
                </Notice>
              </Show>
              <Show when={state().kind === "paused"}>
                <Notice data-tone="warning" role="status">
                  <Icon name="pause" size={18} />
                  <span>
                    <Trans>
                      The link is paused. The name stays yours until{" "}
                      {date((state() as { releasedAt: Date }).releasedAt)}.
                      Reach level {required()!.level} again to turn it back on.
                    </Trans>
                  </span>
                </Notice>
              </Show>

              <TextField
                label={t`Link name`}
                prefix="zrzur.cc/"
                value={code()}
                maxlength={32}
                autocapitalize="none"
                autocorrect="off"
                spellcheck={false}
                disabled={!unlocked() || pending()}
                error={nameProblem()}
                helper={t`Letters, numbers and single hyphens. 3–32 characters.`}
                onInput={(event) => {
                  setCode(event.currentTarget.value);
                  setError(undefined);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save();
                }}
              />

              <Field>
                <Label id="vanity-channel-label">
                  <Trans>New members land in</Trans>
                </Label>
                <FloatingSelect
                  aria-labelledby="vanity-channel-label"
                  value={channel()}
                  disabled={!unlocked() || pending()}
                  onChange={(event) => setChannel(event.currentTarget.value)}
                >
                  <MenuItem value="">
                    <Trans>First channel everyone can read</Trans>
                  </MenuItem>
                  <For each={textChannels()}>
                    {(entry) => (
                      <MenuItem value={entry.id}>#{entry.name}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </Field>

              <Show when={error()}>
                <Notice data-tone="danger" role="alert">
                  <Icon name="warning-circle" size={18} />
                  <span>{error()}</span>
                </Notice>
              </Show>

              <Actions>
                <Button size="sm" onPress={save} isDisabled={!canSave()}>
                  <Show when={current()} fallback={<Trans>Claim link</Trans>}>
                    <Trans>Save</Trans>
                  </Show>
                </Button>
                <Show when={current()}>
                  <Button size="sm" variant="tonal" onPress={copy}>
                    <Icon name="copy" size={16} />
                    <Show when={copied()} fallback={<Trans>Copy link</Trans>}>
                      <Trans>Copied</Trans>
                    </Show>
                  </Button>
                  <Button
                    size="sm"
                    variant={armed() ? "_error" : "text"}
                    onPress={remove}
                    isDisabled={pending()}
                    onBlur={() => setArmed(false)}
                  >
                    <Show when={armed()} fallback={<Trans>Remove</Trans>}>
                      <Trans>Press again to remove</Trans>
                    </Show>
                  </Button>
                </Show>
              </Actions>
            </SettingsFormPanel>
          </Match>
        </Switch>
      </SettingsSection>
    </Show>
  );
}

const Field = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Label = styled("span", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const Actions = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Notice = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
    "&[data-tone='warning']": {
      background:
        "color-mix(in srgb, var(--z-status-warning) 12%, transparent)",
      "--z-icon-color": "var(--z-status-warning)",
    },
    "&[data-tone='danger']": {
      background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
      "--z-icon-color": "var(--z-danger)",
    },
  },
});
