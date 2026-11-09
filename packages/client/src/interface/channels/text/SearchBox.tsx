import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  on,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";

import { useLingui } from "@lingui/solid/macro";
import { Channel } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSearchLabels } from "./searchLabels";
import {
  HAS_VALUES,
  SEARCH_KEYS,
  quoteValue,
  replaceToken,
  tokenAt,
} from "./searchSyntax";

interface Suggestion {
  /** What replaces the word under the caret */
  insert: string;
  label: string;
  detail?: string;
  avatar?: string;
}

/** A day as YYYY-MM-DD in local time */
function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** People of this conversation or server: id, shown name, username */
export function searchPeople(
  channel: Channel,
  client: ReturnType<ReturnType<typeof useClient>>,
) {
  if (channel.serverId) {
    return client.serverMembers
      .filter((member) => member.id.server === channel.serverId)
      .map((member) => ({
        id: member.id.user,
        name: member.displayName ?? member.user?.username ?? "",
        username: member.user?.username,
        avatar: member.animatedAvatarURL,
      }));
  }
  return (channel.recipients ?? []).map((user) => ({
    id: user.id,
    name: user.displayName,
    username: user.username,
    avatar: user.animatedAvatarURL,
  }));
}

/** Text channels of the server that can hold messages */
export function searchChannels(channel: Channel) {
  return (channel.server?.channels ?? []).filter(
    (c) =>
      c.type === "TextChannel" && !c.isVoice && c.havePermission("ViewChannel"),
  );
}

/**
 * Message search field: words plus filters (`from:`, `has:` …), with
 * suggestions for the filter under the caret. Searches on Enter.
 */
export function SearchBox(props: {
  channel: Channel;
  value: string;
  onCommit: (value: string) => void;
  onClear: () => void;
  phone?: boolean;
  autofocus?: boolean;
  placeholder: string;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSearchLabels();
  const listId = createUniqueId();

  let input!: HTMLInputElement;
  let field!: HTMLLabelElement;
  const [draft, setDraft] = createSignal(untrack(() => props.value));
  const [caret, setCaret] = createSignal(untrack(() => props.value.length));
  const [open, setOpen] = createSignal(false);
  const [active, setActive] = createSignal(-1);
  const [rect, setRect] = createSignal<DOMRect>();

  createEffect(
    on(
      () => props.value,
      (value) => setDraft(value),
      { defer: true },
    ),
  );

  const suggestions = createMemo<Suggestion[]>(() => {
    const at = tokenAt(draft(), caret());
    const partial = at.partial.toLowerCase();
    const starts = (text?: string) =>
      !!text && text.toLowerCase().includes(partial);

    switch (at.key) {
      case null:
        return SEARCH_KEYS.filter(
          (key) =>
            (key !== "in" || !!props.channel.serverId) &&
            key.startsWith(partial),
        ).map((key) => ({
          insert: `${key}:`,
          label: `${key}:`,
          detail: labels.hint(key),
        }));
      case "from":
      case "mentions":
        return searchPeople(props.channel, client())
          .filter(
            (person) =>
              !partial || starts(person.name) || starts(person.username),
          )
          .slice(0, 8)
          .map((person) => ({
            insert: `${at.key}:${quoteValue(person.username ?? person.name)}`,
            label: person.name,
            detail: person.username ? `@${person.username}` : undefined,
            avatar: person.avatar,
          }));
      case "in":
        return searchChannels(props.channel)
          .filter((channel) => !partial || starts(channel.name))
          .slice(0, 8)
          .map((channel) => ({
            insert: `in:${quoteValue(channel.name)}`,
            label: `#${channel.name}`,
          }));
      case "has":
        return HAS_VALUES.filter((value) => value.startsWith(partial)).map(
          (value) => ({
            insert: `has:${value}`,
            label: labels.has(value),
            detail: `has:${value}`,
          }),
        );
      case "pinned":
        return [
          { insert: "pinned:true", label: labels.yes, detail: "pinned:true" },
          { insert: "pinned:false", label: labels.no, detail: "pinned:false" },
        ];
      default: {
        const today = new Date();
        const yesterday = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() - 1,
        );
        return [
          {
            insert: `${at.key}:${isoDay(today)}`,
            label: t`Today`,
            detail: isoDay(today),
          },
          {
            insert: `${at.key}:${isoDay(yesterday)}`,
            label: t`Yesterday`,
            detail: isoDay(yesterday),
          },
        ];
      }
    }
  });

  const showList = () => open() && suggestions().length > 0;

  function track() {
    setCaret(input.selectionStart ?? draft().length);
    setRect(field.getBoundingClientRect());
  }

  function choose(suggestion: Suggestion) {
    const at = tokenAt(draft(), caret());
    const next = replaceToken(draft(), at.start, at.end, suggestion.insert);
    setDraft(next.text);
    setActive(-1);
    queueMicrotask(() => {
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
      track();
    });
  }

  function commit() {
    setOpen(false);
    const value = draft().trim();
    if (value) props.onCommit(value);
    else props.onClear();
  }

  function onKeyDown(event: KeyboardEvent) {
    const list = suggestions();
    if (event.key === "ArrowDown" && showList()) {
      event.preventDefault();
      setActive((active() + 1) % list.length);
    } else if (event.key === "ArrowUp" && showList()) {
      event.preventDefault();
      setActive((active() - 1 + list.length) % list.length);
    } else if (
      (event.key === "Enter" || event.key === "Tab") &&
      showList() &&
      active() >= 0
    ) {
      event.preventDefault();
      choose(list[active()]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape" && showList()) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  /** Under the field, starting where the field starts, inside the screen */
  const position = () => {
    const box = rect();
    if (!box) return {};
    const width = Math.min(Math.max(box.width, 300), window.innerWidth - 24);
    const rtl = document.documentElement.dir === "rtl";
    const start = rtl
      ? Math.min(window.innerWidth - box.right, window.innerWidth - width - 12)
      : Math.min(box.left, window.innerWidth - width - 12);
    return {
      top: `${box.bottom + 4}px`,
      width: `${width}px`,
      [rtl ? "right" : "left"]: `${Math.max(12, start)}px`,
    };
  };

  return (
    <>
      <SearchField ref={field} data-phone={props.phone ? "" : undefined}>
        <Icon name="magnifying-glass" size={16} />
        <input
          ref={(el) => {
            input = el;
            if (props.autofocus) queueMicrotask(() => el.focus());
          }}
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          spellcheck={false}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList()}
          aria-controls={listId}
          aria-activedescendant={
            active() >= 0 ? `${listId}-${active()}` : undefined
          }
          placeholder={props.placeholder}
          aria-label={t`Search messages`}
          value={draft()}
          onInput={(e) => {
            setDraft(e.currentTarget.value);
            setActive(-1);
            setOpen(true);
            track();
          }}
          onFocus={() => {
            setOpen(true);
            track();
          }}
          onClick={track}
          onKeyUp={(e) => {
            if (e.key.startsWith("Arrow") && !e.key.match(/Up|Down/)) track();
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        <Show when={draft()}>
          <button
            type="button"
            aria-label={t`Clear search`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setDraft("");
              props.onClear();
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </Show>
      </SearchField>
      <Show when={showList()}>
        <Portal>
          <List
            id={listId}
            role="listbox"
            aria-label={t`Search filters`}
            style={position()}
          >
            <For each={suggestions()}>
              {(suggestion, index) => (
                <Option
                  id={`${listId}-${index()}`}
                  role="option"
                  aria-selected={index() === active()}
                  data-active={index() === active() ? "" : undefined}
                  // keep the caret in the field
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(suggestion);
                  }}
                  onMouseEnter={() => setActive(index())}
                >
                  <Show when={suggestion.avatar !== undefined}>
                    <Avatar src={suggestion.avatar} size={24} />
                  </Show>
                  <span class="label">{suggestion.label}</span>
                  <Show when={suggestion.detail}>
                    <span class="detail">{suggestion.detail}</span>
                  </Show>
                </Option>
              )}
            </For>
          </List>
        </Portal>
      </Show>
    </>
  );
}

const List = styled("ul", {
  base: {
    position: "fixed",
    zIndex: 100,
    margin: 0,
    padding: "4px",
    listStyle: "none",
    maxHeight: "min(320px, 60vh)",
    overflowY: "auto",
    borderRadius: "var(--z-radius-md)",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
    boxShadow: "var(--z-popover-lift)",
  },
});

const Option = styled("li", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "36px",
    paddingInline: "12px",
    paddingBlock: "4px",
    borderRadius: "var(--z-radius-sm)",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    _phone: { minHeight: "44px", fontSize: "15px" },
    "&[data-active]": { background: "var(--z-float-hover)" },
    "& .label": { fontWeight: 500, flexShrink: 0 },
    "& .detail": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: "var(--z-fg-muted)",
    },
  },
});

/** Rounded search field: magnifier inside, grows while in use */
export const SearchField = styled("label", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    height: "32px",
    width: "200px",
    marginInlineStart: "4px",
    paddingInline: "10px 6px",
    borderRadius: "var(--z-shape-field, var(--z-radius, 10px))",
    // same recessed field language as TextField / composer
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-muted)",
    cursor: "text",
    transition:
      "width 160ms ease, border-color 160ms ease, box-shadow 220ms ease, color 160ms ease",
    "--z-icon-color": "currentColor",
    _motionReduce: { transition: "none" },

    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 18%, transparent)",
    },
    "&:focus-within, &:has(input:not(:placeholder-shown))": {
      width: "300px",
      borderColor: "var(--z-accent)",
      color: "var(--z-accent)",
      boxShadow: "var(--z-field-focus-shadow)",
    },

    // phones: share the header with the title instead of a fixed width
    _phone: {
      "&[data-phone]": { height: "40px", fontSize: "16px" },
      flex: "1 1 120px",
      minWidth: 0,
      width: "auto",
      "&:focus-within, &:has(input:not(:placeholder-shown))": {
        width: "auto",
      },
    },

    "& input": {
      flex: 1,
      minWidth: 0,
      height: "100%",
      padding: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
    },
    "& input::placeholder": { color: "var(--z-fg-muted)" },
    "& input::-webkit-search-cancel-button": { display: "none" },

    "& button": {
      display: "grid",
      placeItems: "center",
      width: "22px",
      height: "22px",
      padding: 0,
      border: "none",
      borderRadius: "6px",
      background: "transparent",
      color: "inherit",
      cursor: "pointer",
      _hover: {
        background: "var(--z-bg-raised)",
        color: "var(--z-fg-primary)",
      },
    },
  },
});
