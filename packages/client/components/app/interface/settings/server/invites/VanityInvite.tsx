import { For, Match, Show, Switch, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, VanityEligibility } from "@zrzur/sdk/solid";
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
import { eligibilityFromError } from "./vanityEligibility";
import { vanityState } from "./vanityState";

/**
 * Custom invite link (zrzur.cc/<name>). Official and partner servers may
 * always have one; any other server needs enough members and recent
 * activity (the numbers come from the server). With billing on, the Wings
 * level that unlocks it is a second way in.
 */
export function VanityInvite(props: { server: Server }) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const { navigate } = useSettingsNavigation();

  const [eligibility, setEligibility] = createSignal<VanityEligibility>();
  // an API without the rule (older backend): fall back to the Wings check
  const [noRule, setNoRule] = createSignal(false);

  async function loadEligibility() {
    try {
      setEligibility(await props.server.fetchVanityEligibility());
      setNoRule(false);
    } catch {
      setNoRule(true);
    }
  }

  onMount(() => {
    if (!billingPlans()) refreshBilling(client());
    loadEligibility();
  });

  const current = () => props.server.vanityInvite;
  const required = () => vanityLevel();
  const level = () => props.server.supercharge?.level ?? 0;
  const wingsPath = () =>
    !!billingPlans() && billingAvailable() && !!required();
  const legacyUnlocked = () =>
    (!!billingPlans() && !billingAvailable()) ||
    (!!required() && level() >= required()!.level);
  const unlocked = () =>
    noRule() ? legacyUnlocked() : !!eligibility()?.eligible;
  const loading = () => !noRule() && !eligibility();

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

  const via = () => current()?.via;
  const wingsLink = () => via() === "Wings";
  const state = () =>
    vanityState(current()?.belowLevelSince, new Date(), via());
  const date = (value: Date) =>
    new Intl.DateTimeFormat(i18n().locale, { dateStyle: "medium" }).format(
      value,
    );
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);

  // the rule's numbers, from the server once loaded
  const minMembers = () => number(eligibility()?.minMembers ?? 1000);
  const minMessages = () => number(eligibility()?.minMessages ?? 100);
  const minAuthors = () => number(eligibility()?.minAuthors ?? 20);
  const days = () => number(eligibility()?.days ?? 30);
  const membersOk = () =>
    !!eligibility() && eligibility()!.members >= eligibility()!.minMembers;
  const activityOk = () =>
    !!eligibility() &&
    eligibility()!.messages >= eligibility()!.minMessages &&
    eligibility()!.authors >= eligibility()!.minAuthors;
  // the date the current link ends: the server's own, else worked out here
  const endsAt = () =>
    eligibility()?.linkEndsAt ??
    (state().kind === "grace" ? (state() as { ends: Date }).ends : undefined);

  async function save() {
    if (!canSave()) return;
    setPending(true);
    setError(undefined);
    try {
      await props.server.claimVanityInvite(name(), channel() || undefined);
      setCode(props.server.vanityInvite?.code ?? name());
      setChannel(props.server.vanityInvite?.channel ?? "");
      loadEligibility();
    } catch (err) {
      // the server says what is missing: show it in the panel as well
      const refused = eligibilityFromError(err, eligibility());
      if (refused) setEligibility(refused);
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
      loadEligibility();
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
    <Show when={!noRule() || legacyUnlocked() || required()}>
      <SettingsSection
        title={<Trans>Custom invite link</Trans>}
        description={
          <span data-testid="vanity-rule">
            <Trans>
              Official and partner servers can have one, and so can servers with{" "}
              {minMembers()} members that are active ({minMessages()} messages
              from {minAuthors()} members in {days()} days).
            </Trans>
          </span>
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
          <Match when={loading() && !current()}>
            <SettingsRow
              icon={<Icon name="hourglass" size={20} />}
              title={<Trans>Checking this server…</Trans>}
            />
          </Match>
          <Match when={!unlocked() && !current() && !noRule()}>
            <SettingsFormPanel>
              <Why data-testid="vanity-why">
                <WhyTitle>
                  <Trans>This server can't have a custom link yet</Trans>
                </WhyTitle>
                <Need data-met={membersOk()} data-testid="vanity-need-members">
                  <Icon
                    name={membersOk() ? "check-circle" : "x-circle"}
                    size={20}
                  />
                  <span>
                    <Trans>
                      Members: {number(eligibility()?.members ?? 0)} of{" "}
                      {minMembers()}
                    </Trans>
                  </span>
                </Need>
                <Need
                  data-met={activityOk()}
                  data-testid="vanity-need-activity"
                >
                  <Icon
                    name={activityOk() ? "check-circle" : "x-circle"}
                    size={20}
                  />
                  <span>
                    <Trans>
                      Activity: {number(eligibility()?.messages ?? 0)} of{" "}
                      {minMessages()} messages from{" "}
                      {number(eligibility()?.authors ?? 0)} of {minAuthors()}{" "}
                      members in the last {days()} days
                    </Trans>
                  </span>
                </Need>
              </Why>
              <Show when={wingsPath()}>
                <SettingsRow
                  icon={<Icon name="lock-simple" size={20} />}
                  title={
                    <Trans>
                      Or reach Wings level {required()!.level} (
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
              </Show>
            </SettingsFormPanel>
          </Match>
          <Match when={noRule() && !legacyUnlocked() && !current()}>
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
              <Show when={state().kind === "grace" && !wingsLink()}>
                <Notice
                  data-tone="warning"
                  role="status"
                  data-testid="vanity-ending"
                >
                  <Icon name="warning" size={18} />
                  <span>
                    <Trans>
                      This server no longer meets the rule for a custom link.
                      The link works until {date(endsAt()!)}, then the name is
                      released. Reach {minMembers()} members and stay active to
                      keep it.
                    </Trans>
                  </span>
                </Notice>
              </Show>
              <Show when={state().kind === "grace" && wingsLink()}>
                <Notice data-tone="warning" role="status">
                  <Icon name="warning" size={18} />
                  <span>
                    <Trans>
                      This server is below level {required()?.level}. The link
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
                      Reach level {required()?.level} again to turn it back on.
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
                <Notice
                  data-tone="danger"
                  role="alert"
                  data-testid="vanity-error"
                >
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
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    // 44 px targets on phones
    "@media (max-width: 600px)": {
      "& > button": { minHeight: "44px" },
    },
  },
});

const Why = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const WhyTitle = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: "20px",
    color: "var(--z-fg-primary)",
  },
});

const Need = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-danger)",
    "&[data-met='true']": {
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-status-success)",
    },
  },
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
