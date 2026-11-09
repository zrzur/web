import { createFormControl, createFormGroup } from "solid-forms";
import { For, Show, createMemo, createSignal } from "solid-js";

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
  Column,
  Dialog,
  DialogProps,
  Form2,
  Ripple,
  Text,
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
 * Modal to join a server
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

  const has = (bit: number) => hasBit(asked, bit);
  const permissionName = (bit: number) => titles.name(bit);

  // every permission asked for, grouped by what it touches; none is hidden
  const groups = () =>
    askedGroups(asked).map((group) => ({
      title: titles.group(group.id),
      bits: group.bits,
    }));

  const [filter, setFilter] = createSignal("");

  const filterLowercase = createMemo(() => filter().toLowerCase());

  const availableGroups = createMemo(() => {
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
      .filter((group) => group.name.toLowerCase().includes(filterLowercase()))
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ item, value: item.id }));
  });

  const group = createFormGroup({
    id: createFormControl([] as string[], {
      required: true,
    }),
  });

  async function onSubmit() {
    setError(undefined);
    try {
      const entry = availableGroups().find(
        (entry) => entry.value === group.controls.id.value[0],
      )!;

      // straight to the API so errors reach the user and the ticked
      // permissions are granted on a server
      const query = inviteQuery(entry.item instanceof Server, granted());
      await client().api.post(
        `/bots/${props.invite.id as ""}/invite${query as ""}`,
        entry.item instanceof Server
          ? { server: entry.item.id }
          : { group: entry.item.id },
      );

      props.onClose();
    } catch (error) {
      // shown here, in the same dialog
      setError(error);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      size="sm"
      tone="invite"
      iconName="robot"
      show={props.show}
      onClose={props.onClose}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Add</Trans>,
          onClick: () => {
            onSubmit(); // doesn't go through submitHandler!
            //             much like other modals don't either
            return false;
          },
          isDisabled: !Form2.canSubmit(group),
        },
      ]}
      isDisabled={group.isPending}
    >
      <form onSubmit={submit}>
        <Column>
          <Header>
            <Avatar
              size={48}
              src={
                props.invite.avatar?.previewUrl ??
                `${client().options.baseURL}/users/${props.invite.id}/default_avatar`
              }
              fallback={props.invite.username}
            />
            <HeaderText>
              <TitleLine>
                <Text class="title">{props.invite.username}</Text>
                <BotLabel verified={props.invite.verified} />
              </TitleLine>
              <Show when={props.invite.creator}>
                {(creator) => (
                  <Text class="label" size="small">
                    <Trans>
                      Made by{" "}
                      <bdi>{creator().displayName ?? creator().username}</bdi>
                    </Trans>
                  </Text>
                )}
              </Show>
              <Text class="label" size="small">
                <Trans>
                  Registered since{" "}
                  <Time format="calendar" value={decodeTime(props.invite.id)} />
                </Trans>
              </Text>
            </HeaderText>
          </Header>

          <Show when={props.invite.description}>
            <div use:scrollable={{ class: description() }}>
              <Markdown content={props.invite.description} />
              <ProvidedBy>
                <Text class="label" size="small">
                  <Trans>Description provided by {props.invite.username}</Trans>
                </Text>
                <CoverText>
                  <div />
                </CoverText>
              </ProvidedBy>
            </div>
          </Show>

          <TextField
            value={filter()}
            variant="filled"
            placeholder={t`Search for groups...`}
            onKeyUp={(e) => setFilter(e.currentTarget.value)}
          />

          <Form2.VirtualSelect
            control={group.controls.id}
            items={availableGroups()}
            // as tall as the list, up to four rows
            selectHeight={`${Math.min(Math.max(availableGroups().length, 1), 4) * 40}px`}
          >
            {(item, selected) => (
              <Item selected={selected}>
                <Ripple />
                <Avatar
                  src={item.animatedIconURL}
                  fallback={item.name}
                  size={24}
                  shape={item instanceof Server ? "circle" : "rounded-square"}
                />{" "}
                <span>{item.name}</span>
              </Item>
            )}
          </Form2.VirtualSelect>

          <Show
            when={groups().length}
            fallback={
              <Note>
                <Trans>The bot will not be granted any permissions.</Trans>
              </Note>
            }
          >
            <Perms>
              <PermsTitle>
                <Trans>On a server the bot gets:</Trans>
              </PermsTitle>
              <PermsHint>
                <Trans>Untick anything you do not want to give it.</Trans>
              </PermsHint>
              <Show when={SENSITIVE.some(has)}>
                <Legend>
                  <Icon name="warning" size={12} />
                  <Trans>
                    Lets the bot change the server or remove people.
                  </Trans>
                </Legend>
              </Show>
              <For each={groups()}>
                {(entry) => (
                  <PermGroup>
                    <GroupTitle>{entry.title}</GroupTitle>
                    <PermGrid>
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
                              <span>{permissionName(bit)}</span>
                              <Show when={SENSITIVE.includes(bit)}>
                                <Icon name="warning" size={14} />
                              </Show>
                            </Checkbox>
                          </Perm>
                        )}
                      </For>
                    </PermGrid>
                  </PermGroup>
                )}
              </For>
            </Perms>
          </Show>

          <Show when={error()}>
            <TranslatedError error={error()} />
          </Show>

          <Note data-verified={!!props.invite.verified}>
            <Show
              when={props.invite.verified}
              fallback={<Trans>This bot is not verified by Zrzur.</Trans>}
            >
              <Trans>Zrzur verified who runs this bot.</Trans>
            </Show>
          </Note>
        </Column>
      </form>
    </Dialog>
  );
}

const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
});

const TitleLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    minWidth: 0,
  },
});

const PermsHint = styled("div", {
  base: {
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const HeaderText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
});

const description = cva({
  base: {
    position: "relative",
    maxHeight: "120px",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-lg)",
    color: "var(--md-sys-color-on-secondary-container)",
    background: "var(--md-sys-color-secondary-container)",
  },
});

const ProvidedBy = styled("div", {
  base: {
    bottom: 0,
    position: "sticky",
    background: "var(--md-sys-color-secondary-container)",
  },
});

const CoverText = styled("div", {
  base: {
    position: "relative",

    "& *": {
      top: 0,
      width: "100%",
      position: "absolute",
      height: "var(--gap-md)",
      background: "var(--md-sys-color-secondary-container)",
    },
  },
});

const Item = styled("div", {
  base: {
    height: "40px",
    display: "flex",
    position: "relative",
    alignItems: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-sm)",
  },
  variants: {
    selected: {
      true: {
        color: "var(--md-sys-color-on-primary)",
        background: "var(--md-sys-color-primary)",
      },
    },
  },
});

const Perms = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxHeight: "220px",
    overflowY: "auto",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "var(--z-card-bg, #1D1F2D)",
    border: "1px solid var(--z-border-subtle, rgba(255,255,255,0.08))",
  },
});

const PermsTitle = styled("div", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-fg-primary, #F2F3F8)",
  },
});

const PermGroup = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "4px" },
});

const GroupTitle = styled("div", {
  base: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--z-fg-muted, #979BB1)",
  },
});

const PermGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "4px 12px",
    _phone: { gridTemplateColumns: "1fr" },
  },
});

const Perm = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& span": { minWidth: 0, overflowWrap: "anywhere" },
    // a permission that lets the bot change the server or remove people
    "&[data-sensitive='true']": {
      "--z-icon-color": "var(--z-status-warning)",
    },
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
    color: "var(--z-fg-muted, #979BB1)",
    "--z-icon-color": "var(--z-status-warning, #F3B96B)",
    "& > :first-child": {
      flexShrink: 0,
      color: "var(--z-status-warning, #F3B96B)",
    },
  },
});

const Note = styled("div", {
  base: {
    fontSize: "12px",
    textAlign: "center",
    color: "var(--z-fg-muted, #979BB1)",
  },
});
