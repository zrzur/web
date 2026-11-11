import { createFormControl, createFormGroup } from "solid-forms";
import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { Server } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime } from "ulid";

import { useClient } from "@revolt/client";
import { TranslatedError } from "@revolt/i18n/errors";
import { Markdown } from "@revolt/markdown";
import {
  Avatar,
  Checkbox,
  Dialog,
  DialogProps,
  Form2,
  Ripple,
  TextField,
  Time,
} from "@revolt/ui";
import { BotLabel } from "@revolt/ui/components/features/profiles/BotLabel";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import {
  askedGroups,
  askedPermissions,
  hasBit,
  inviteQuery,
  toggleBit,
} from "./addBotPermissions";
import { usePermissionTitles } from "./permissionTitles";

/** Permissions that let a bot change the server or remove people */
const SENSITIVE = [2 ** 1, 2 ** 2, 2 ** 3, 2 ** 6, 2 ** 7, 2 ** 37];

/**
 * Add a bot, in two steps. First: who the bot is, what adding it allows, and
 * the server (or group) it goes to. Then, for a server: every permission it
 * asks for, each one untickable, and what we know about the bot. A group has
 * no permissions, so it is added from the first step.
 */
export function AddBotModal(props: DialogProps & Modals & { type: "add_bot" }) {
  const { t } = useLingui();
  const client = useClient();
  const titles = usePermissionTitles();

  // what the link asks for, else the bot's own default permissions
  // eslint-disable-next-line solid/reactivity
  const asked = askedPermissions(props.invite, props.permissions) ?? 0;
  // the person adding the bot may untick any of them
  const [granted, setGranted] = createSignal(asked);
  const [error, setError] = createSignal<unknown>();
  const [step, setStep] = createSignal<"place" | "permissions">("place");
  const [busy, setBusy] = createSignal(false);

  const has = (bit: number) => hasBit(asked, bit);

  // every permission asked for, grouped by what it touches; none is hidden
  const groups = () =>
    askedGroups(asked).map((group) => ({
      title: titles.group(group.id),
      bits: group.bits,
    }));

  const [filter, setFilter] = createSignal("");
  const filterLowercase = createMemo(() => filter().toLowerCase());

  const places = createMemo(() => {
    const instance = client();
    return [
      ...instance.servers
        .filter((server) => server.havePermission("ManageServer"))
        // this won't always work, but we might as well try:
        .filter((server) => !server.getMember(props.invite.id)),
      ...instance.channels
        .filter((channel) => channel.type === "Group")
        .filter((channel) => !channel.recipientIds.has(props.invite.id)),
    ]
      .filter((place) => place.name.toLowerCase().includes(filterLowercase()))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ item, value: item.id }));
  });

  const form = createFormGroup({
    id: createFormControl([] as string[], { required: true }),
  });
  const chosen = () =>
    places().find((entry) => entry.value === form.controls.id.value[0])?.item;
  const toServer = () => chosen() instanceof Server;

  async function add() {
    const place = chosen();
    if (!place || busy()) return;
    setError(undefined);
    setBusy(true);
    try {
      // straight to the API so errors reach the user and the ticked
      // permissions are granted on a server
      const query = inviteQuery(place instanceof Server, granted());
      await client().api.post(
        `/bots/${props.invite.id as ""}/invite${query as ""}`,
        place instanceof Server ? { server: place.id } : { group: place.id },
      );
      props.onClose();
    } catch (failure) {
      // shown here, in the same dialog
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  const submit = Form2.useSubmitHandler(form, async () => {
    if (step() === "place" && toServer()) setStep("permissions");
    else await add();
  });

  const botAvatar = () =>
    props.invite.avatar?.previewUrl ??
    `${client().options.baseURL}/users/${props.invite.id}/default_avatar`;

  return (
    <Dialog
      size="sm"
      show={props.show}
      onClose={props.onClose}
      actions={
        step() === "place"
          ? [
              { text: <Trans>Cancel</Trans> },
              {
                text: toServer() ? (
                  <Trans>Continue</Trans>
                ) : (
                  <Trans>Add bot</Trans>
                ),
                onClick: () => {
                  if (toServer()) setStep("permissions");
                  else void add();
                  return false;
                },
                isDisabled: !Form2.canSubmit(form) || busy(),
                isLoading: busy(),
              },
            ]
          : [
              {
                text: <Trans>Back</Trans>,
                onClick: () => {
                  setError(undefined);
                  setStep("place");
                  return false;
                },
              },
              {
                text: <Trans>Add bot</Trans>,
                onClick: () => {
                  void add();
                  return false;
                },
                isDisabled: busy(),
                isLoading: busy(),
              },
            ]
      }
      isDisabled={busy()}
    >
      <form onSubmit={submit} data-add-bot data-step={step()}>
        <Body>
          <Pair aria-hidden="true">
            <Avatar
              size={64}
              src={botAvatar()}
              fallback={props.invite.username}
            />
            <Dots>
              <span />
              <span />
              <span />
            </Dots>
            <Avatar
              size={64}
              src={client().user?.animatedAvatarURL}
              fallback={client().user?.displayName ?? client().user?.username}
            />
          </Pair>
          <Who>
            <NameLine>
              <BotName>{props.invite.username}</BotName>
              <BotLabel verified={props.invite.verified} />
            </NameLine>
            <Switch>
              <Match when={step() === "place"}>
                <Lead>
                  <Trans>wants to join one of your servers</Trans>
                </Lead>
              </Match>
              <Match when={chosen()}>
                {(place) => (
                  <Lead>
                    <Trans>
                      What it may do on <bdi>{place().name}</bdi>
                    </Trans>
                  </Lead>
                )}
              </Match>
            </Switch>
          </Who>

          <Show when={step() === "place"}>
            <Panel>
              <PanelTitle>
                <Trans>This lets the bot:</Trans>
              </PanelTitle>
              <Allow>
                <li>
                  <Icon name="check-circle" size={18} />
                  <Trans>Join the server you choose</Trans>
                </li>
                <li>
                  <Icon name="check-circle" size={18} />
                  <Trans>Add its commands there</Trans>
                </li>
              </Allow>

              <Show when={props.invite.description}>
                <div use:scrollable={{ class: description() }}>
                  <Markdown content={props.invite.description} />
                </div>
              </Show>

              <Divider />
              <PanelTitle>
                <Trans>Add to server</Trans>
              </PanelTitle>
              <TextField
                value={filter()}
                variant="filled"
                placeholder={t`Search for groups...`}
                onKeyUp={(e) => setFilter(e.currentTarget.value)}
              />
              <Show
                when={places().length || filter()}
                fallback={
                  <Hint>
                    <Trans>
                      You have no server to add it to: you need Manage Server
                      there.
                    </Trans>
                  </Hint>
                }
              >
                <Form2.VirtualSelect
                  control={form.controls.id}
                  items={places()}
                  // as tall as the list, up to four rows
                  selectHeight={`${Math.min(Math.max(places().length, 1), 4) * 44}px`}
                >
                  {(item, selected) => (
                    <Item selected={selected}>
                      <Ripple />
                      <Avatar
                        src={item.animatedIconURL}
                        fallback={item.name}
                        size={24}
                        shape={
                          item instanceof Server ? "circle" : "rounded-square"
                        }
                      />
                      <span>{item.name}</span>
                    </Item>
                  )}
                </Form2.VirtualSelect>
              </Show>
              <Hint>
                <Trans>You need Manage Server on that server.</Trans>
              </Hint>
            </Panel>
          </Show>

          <Show when={step() === "permissions"}>
            <Panel>
              <Show
                when={groups().length}
                fallback={
                  <Hint>
                    <Trans>The bot will not be granted any permissions.</Trans>
                  </Hint>
                }
              >
                <PanelTitle>
                  <Trans>On a server the bot gets:</Trans>
                </PanelTitle>
                <Hint>
                  <Trans>Untick anything you do not want to give it.</Trans>
                </Hint>
                <Show when={SENSITIVE.some(has)}>
                  <Legend>
                    <Icon name="warning" size={12} />
                    <Trans>
                      Lets the bot change the server or remove people.
                    </Trans>
                  </Legend>
                </Show>
                <PermList>
                  <For each={groups()}>
                    {(entry) => (
                      <PermGroup>
                        <GroupTitle>{entry.title}</GroupTitle>
                        <For each={entry.bits}>
                          {(bit) => (
                            <Perm data-sensitive={SENSITIVE.includes(bit)}>
                              <Checkbox
                                name={`permission-${bit}`}
                                checked={hasBit(granted(), bit)}
                                onChange={() =>
                                  setGranted((value) => toggleBit(value, bit))
                                }
                              >
                                <span>{titles.name(bit)}</span>
                                <Show when={SENSITIVE.includes(bit)}>
                                  <Icon name="warning" size={14} />
                                </Show>
                              </Checkbox>
                            </Perm>
                          )}
                        </For>
                      </PermGroup>
                    )}
                  </For>
                </PermList>
              </Show>

              <Divider />
              <Facts>
                <li>
                  <Icon name="shield-check" size={16} />
                  <Show
                    when={props.invite.verified}
                    fallback={<Trans>This bot is not verified by Zrzur.</Trans>}
                  >
                    <Trans>Zrzur verified who runs this bot.</Trans>
                  </Show>
                </li>
                <Show when={props.invite.creator}>
                  {(creator) => (
                    <li>
                      <Icon name="user" size={16} />
                      <Trans>
                        Made by{" "}
                        <bdi>{creator().displayName ?? creator().username}</bdi>
                      </Trans>
                    </li>
                  )}
                </Show>
                <li>
                  <Icon name="clock" size={16} />
                  <Trans>
                    Registered since{" "}
                    <Time
                      format="calendar"
                      value={decodeTime(props.invite.id)}
                    />
                  </Trans>
                </li>
              </Facts>
            </Panel>
          </Show>

          <Show when={error()}>
            <TranslatedError error={error()} />
          </Show>
        </Body>
      </form>
    </Dialog>
  );
}

const Body = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const Pair = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    paddingBlockStart: "8px",
  },
});

const Dots = styled("div", {
  base: {
    display: "flex",
    gap: "5px",
    "& span": {
      width: "5px",
      height: "5px",
      borderRadius: "50%",
      background: "color-mix(in srgb, var(--z-accent) 70%, transparent)",
    },
    "& span:nth-child(2)": { opacity: 0.7 },
    "& span:nth-child(3)": { opacity: 0.45 },
  },
});

const Who = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    textAlign: "center",
    minWidth: 0,
  },
});

const NameLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },
});

const BotName = styled("h2", {
  base: {
    margin: 0,
    fontSize: "20px",
    lineHeight: "28px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const Lead = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",
  },
});

const Panel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "var(--z-radius-md, 14px)",
    background: "var(--z-bg-nav, var(--z-bg-sidebar))",
    border: "1px solid var(--z-border-subtle)",
    minWidth: 0,
  },
});

const PanelTitle = styled("div", {
  base: {
    fontSize: "14px",
    fontWeight: 650,
    color: "var(--z-fg-primary)",
  },
});

const Allow = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-success, var(--z-accent))",
    },
  },
});

const Divider = styled("hr", {
  base: {
    width: "100%",
    margin: "4px 0",
    border: "none",
    borderTop: "1px solid var(--z-border-subtle)",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

const description = cva({
  base: {
    maxHeight: "96px",
    padding: "10px 12px",
    borderRadius: "var(--z-radius, 10px)",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-raised)",
  },
});

const Item = styled("div", {
  base: {
    height: "44px",
    display: "flex",
    position: "relative",
    alignItems: "center",
    gap: "10px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius, 10px)",
    color: "var(--z-fg-primary)",
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  variants: {
    selected: {
      true: {
        background: "color-mix(in srgb, var(--z-accent) 18%, transparent)",
        boxShadow: "inset 0 0 0 1px var(--z-accent)",
      },
    },
  },
});

const PermList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "260px",
    overflowY: "auto",
    paddingInlineEnd: "4px",
  },
});

const PermGroup = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "6px" },
});

const GroupTitle = styled("div", {
  base: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "var(--z-fg-muted)",
  },
});

const Perm = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    minWidth: 0,
    fontSize: "14px",
    lineHeight: "22px",
    color: "var(--z-fg-primary)",
    "& span": { minWidth: 0, overflowWrap: "anywhere" },
    // a permission that lets the bot change the server or remove people
    "&[data-sensitive='true']": { "--z-icon-color": "var(--z-status-warning)" },
    "&[data-sensitive='true'] svg": {
      flexShrink: 0,
      color: "var(--z-status-warning)",
    },
  },
});

const Legend = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-status-warning)",
  },
});

const Facts = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
      "--z-icon-color": "var(--z-fg-muted)",
    },
  },
});
