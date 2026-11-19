import { For, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Server, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar, TextField } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Choose members of a server by name: type, press a name to add it, press a
 * chosen name to take it away. Used for the invited people of an event and
 * for its helpers.
 */
export function MemberPicker(props: {
  server: Server;
  label: string;
  /** Chosen user ids */
  value: string[];
  onChange: (ids: string[]) => void;
  /** How many may be chosen */
  max: number;
  /** Members that can't be chosen here (e.g. yourself) */
  exclude?: string[];
  testId: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const [query, setQuery] = createSignal("");
  const [found, setFound] = createSignal<User[]>([]);
  const [searching, setSearching] = createSignal(false);
  const [failed, setFailed] = createSignal(false);

  // names of people chosen before (an event being edited): asked for once
  createEffect(
    on(
      () => props.value,
      (ids) => {
        for (const id of ids) {
          if (!client().users.get(id))
            void client()
              .users.fetch(id)
              .catch(() => undefined);
        }
      },
    ),
  );

  // The server's search reads usernames and server nicknames only. People
  // know each other by display name, so the first members of the server are
  // loaded once and matched here too; in a server larger than this page, a
  // member further down is found by username.
  let firstPage: Promise<User[]> | undefined;
  const firstMembers = () =>
    (firstPage ??= props.server
      .fetchMembersPage({ limit: 200 })
      .then((page) => page.users)
      .catch(() => []));

  // one request after the typing rests, and only the last answer counts
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asked = 0;
  onCleanup(() => clearTimeout(timer));
  const search = (text: string) => {
    setQuery(text);
    clearTimeout(timer);
    const name = text.trim();
    if (!name) {
      asked++;
      setFound([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer = setTimeout(async () => {
      const mine = ++asked;
      try {
        const lower = name.toLowerCase();
        const [near, searched] = await Promise.all([
          firstMembers(),
          props.server
            .queryMembersExperimental(name)
            .then((result) => result.users),
        ]);
        if (mine !== asked) return;
        const matches = near.filter(
          (user) =>
            user.displayName.toLowerCase().includes(lower) ||
            user.username.toLowerCase().includes(lower),
        );
        const seen = new Set(matches.map((user) => user.id));
        setFailed(false);
        setFound(
          [...matches, ...searched.filter((user) => !seen.has(user.id))]
            .filter((user) => !user.bot)
            .slice(0, 8),
        );
      } catch {
        if (mine !== asked) return;
        setFailed(true);
        setFound([]);
      } finally {
        if (mine === asked) setSearching(false);
      }
    }, 250);
  };

  const full = () => props.value.length >= props.max;
  const choices = () =>
    found().filter(
      (user) =>
        !props.value.includes(user.id) && !props.exclude?.includes(user.id),
    );
  const nameOf = (id: string) =>
    client().users.get(id)?.displayName ?? t`Member`;

  const add = (user: User) => {
    if (full() || props.value.includes(user.id)) return;
    props.onChange([...props.value, user.id]);
    search("");
  };

  return (
    <Box data-testid={props.testId}>
      <Show when={props.value.length}>
        <Chosen aria-label={props.label}>
          <For each={props.value}>
            {(id) => (
              <Chip
                type="button"
                onClick={() =>
                  props.onChange(props.value.filter((other) => other !== id))
                }
                aria-label={t`Remove ${nameOf(id)}`}
                data-testid={`${props.testId}-chosen`}
              >
                <Avatar
                  size={20}
                  src={client().users.get(id)?.avatarURL}
                  fallback={nameOf(id)}
                />
                <span>{nameOf(id)}</span>
                <Icon name="x" size={12} />
              </Chip>
            )}
          </For>
        </Chosen>
      </Show>
      <Show
        when={!full()}
        fallback={
          <Hint>
            <Trans>That is the most you can choose here: {props.max}.</Trans>
          </Hint>
        }
      >
        <TextField
          variant="outlined"
          label={props.label}
          placeholder={t`Type a name or username`}
          value={query()}
          onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) =>
            search(event.currentTarget.value)
          }
          autocomplete="off"
          data-testid={`${props.testId}-search`}
        />
      </Show>
      <Show when={query().trim() && !full()}>
        <Results role="listbox" aria-label={t`Members found`}>
          <For
            each={choices()}
            fallback={
              <Hint aria-live="polite">
                <Show when={!searching()} fallback={<Trans>Searching…</Trans>}>
                  <Show
                    when={failed()}
                    fallback={<Trans>No member with this name.</Trans>}
                  >
                    <Trans>The search did not work. Try again.</Trans>
                  </Show>
                </Show>
              </Hint>
            }
          >
            {(user) => (
              <Result
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => add(user)}
                data-testid={`${props.testId}-result`}
              >
                <Avatar
                  size={24}
                  src={user.avatarURL}
                  fallback={user.displayName}
                />
                <span>{user.displayName}</span>
                <small>@{user.username}</small>
              </Result>
            )}
          </For>
        </Results>
      </Show>
    </Box>
  );
}

const Box = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
});

const Chosen = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "6px" },
});

const Chip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    maxWidth: "100%",
    minHeight: "28px",
    paddingBlock: "2px",
    paddingInline: "4px 10px",
    border: "none",
    borderRadius: "999px",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-muted)",
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&:hover": { background: "var(--z-hover)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Results = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "176px",
    overflowY: "auto",
    padding: "6px",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-input)",
  },
});

const Result = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    paddingInline: "8px",
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "transparent",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
    textAlign: "start",
    cursor: "pointer",
    "& span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": {
      marginInlineStart: "auto",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
      direction: "ltr",
    },
    "&:hover": { background: "var(--z-hover)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    padding: "4px 8px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});
