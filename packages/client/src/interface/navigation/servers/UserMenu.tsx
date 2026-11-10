import { autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import { useLingui } from "@lingui/solid/macro";
import { useClient, useUser } from "@revolt/client";
import { writeStatusWithRetry } from "@revolt/common/lib/statusWrite";
import { useError } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Avatar, UserStatus } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { nameStyle } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";
import { useFloating } from "solid-floating-ui";
import {
  Accessor,
  For,
  Show,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";
import { Portal } from "solid-js/web";
import { styled } from "styled-system/jsx";
import {
  type Presence,
  createPresenceUpdater,
  setPendingPresence,
} from "./presenceUpdate";

interface Props {
  anchor: Accessor<HTMLElement | undefined>;
}

/** Account status menu; only confirmed saves change the selected status. */
export function UserMenu(props: Props) {
  const { t } = useLingui();
  const { openModal } = useModals();
  const translateError = useError();
  const client = useClient();
  const user = useUser();
  const state = useState();
  const [show, setShow] = createSignal(false);
  const [menu, setMenu] = createSignal<HTMLDivElement>();
  const [pending, setPending] = createSignal<Presence>();
  const [error, setError] = createSignal<string>();
  const [clearing, setClearing] = createSignal(false);
  const cancellation = new AbortController();
  onCleanup(() => cancellation.abort());
  const current = () => user()?.presence ?? "Invisible";
  const position = useFloating(() => props.anchor(), menu, {
    placement: "top-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(10),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
        },
      }),
    ],
  });

  function close(restoreFocus = false) {
    setShow(false);
    if (restoreFocus) props.anchor()?.focus({ preventScroll: true });
  }
  const updater = createPresenceUpdater({
    save: async (presence) => {
      const account = user();
      if (!account) throw new Error("Account unavailable");
      await account.edit({ status: { presence } });
    },
    pending: (presence) => {
      setPending(presence);
      setPendingPresence(presence);
    },
    retrying: () => {},
    saved: () => {},
    // only a real failure (after the silent rate-limit retries) is shown
    failed: (failure) => {
      setError(
        translateError(failure) ||
          t`Couldn't update your status. Please try again.`,
      );
      setShow(true);
    },
  });
  onCleanup(updater.dispose);

  /** The choice shows at once; saving (and any retry) happens quietly */
  const shown = () => pending() ?? current();

  function select(presence: Presence) {
    setError(undefined);
    if (presence !== shown()) void updater.submit(presence);
    close(true);
  }
  function outside(event: PointerEvent) {
    if (!show()) return;
    const target = event.target as Node;
    if (!props.anchor()?.contains(target) && !menu()?.contains(target)) close();
  }
  document.addEventListener("pointerdown", outside);
  onCleanup(() => document.removeEventListener("pointerdown", outside));

  createEffect(
    on(
      () => props.anchor(),
      (anchor) => {
        if (!anchor) return;
        const toggle = () => {
          setError(undefined);
          setShow((value) => !value);
        };
        const keys = (event: KeyboardEvent) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setShow(true);
            const panel = menu();
            queueMicrotask(() =>
              panel
                ?.querySelector<HTMLElement>("[role='menuitemradio']")
                ?.focus(),
            );
          } else if (event.key === "Escape") close(true);
        };
        anchor.addEventListener("click", toggle);
        anchor.addEventListener("keydown", keys);
        anchor.setAttribute("aria-haspopup", "menu");
        onCleanup(() => {
          anchor.removeEventListener("click", toggle);
          anchor.removeEventListener("keydown", keys);
          anchor.removeAttribute("aria-haspopup");
          anchor.removeAttribute("aria-expanded");
        });
      },
    ),
  );
  createEffect(() =>
    props.anchor()?.setAttribute("aria-expanded", String(show())),
  );

  function menuKeys(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    const items = [
      ...(menu()?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    if (event.key === "ArrowUp")
      next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined && items.length) {
      event.preventDefault();
      items[next].focus();
    }
  }
  const choices = () => [
    {
      value: "Online" as const,
      label: t`Online`,
    },
    {
      value: "Idle" as const,
      label: t`Idle`,
    },
    {
      value: "Focus" as const,
      label: t`Focus`,
    },
    {
      value: "Busy" as const,
      label: t`Do not disturb`,
    },
    {
      value: "Invisible" as const,
      label: t`Invisible`,
    },
  ];
  function openStatus() {
    close();
    openModal({ type: "custom_status", client: client() });
  }
  async function clearStatus() {
    setClearing(true);
    setError(undefined);
    try {
      const account = user();
      if (!account) return;
      await writeStatusWithRetry(
        () => account.edit({ remove: ["StatusText"] }),
        { signal: cancellation.signal },
      );
      close(true);
    } catch (failure) {
      setError(
        translateError(failure) ||
          t`Couldn't clear your status. Please try again.`,
      );
    } finally {
      setClearing(false);
    }
  }

  async function copyId() {
    const id = user()?.id;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      close(true);
    } catch {
      setError(t`Couldn't copy your user ID.`);
    }
  }

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Show when={show()}>
        <Panel
          ref={(element) => {
            setMenu(element);
            queueMicrotask(() => element.focus({ preventScroll: true }));
          }}
          role="menu"
          aria-label={t`Profile and status`}
          tabIndex={-1}
          onKeyDown={menuKeys}
          style={{
            position: position.strategy,
            top: `${position.y ?? 0}px`,
            left: `${position.x ?? 0}px`,
          }}
        >
          <Header>
            <AvatarDecoration
              decoration={user()?.style?.decoration}
              file={user()?.style?.decoration_file}
              size={36}
            >
              <Avatar
                size={36}
                src={user()?.animatedAvatarURL}
                fallback={user()?.username}
                holepunch="bottom-right"
                overlay={<UserStatus.Graphic status={shown()} />}
              />
            </AvatarDecoration>
            <Identity>
              <strong style={nameStyle(user()?.style)}>
                {user()?.displayName ?? user()?.username}
              </strong>
              <span>
                {user()?.username}#
                {/* the own tag stays off screen in streamer mode */}
                {state.settings.streamerMode ? "••••" : user()?.discriminator}
              </span>
            </Identity>
          </Header>
          <For each={choices()}>
            {(choice) => (
              <StatusButton
                type="button"
                role="menuitemradio"
                aria-label={choice.label}
                aria-checked={shown() === choice.value}
                data-presence={choice.value}
                data-selected={shown() === choice.value}
                disabled={clearing()}
                onClick={() => select(choice.value)}
              >
                <Dot>
                  <UserStatus size="14" status={choice.value} />
                </Dot>
                <ChoiceText>
                  <strong>{choice.label}</strong>
                </ChoiceText>
                <Show when={shown() === choice.value}>
                  <Icon name="check" size={16} />
                </Show>
              </StatusButton>
            )}
          </For>
          <Show when={error()}>
            <Notice role="alert" data-error>
              {error()}
            </Notice>
          </Show>
          <Divider />
          <Action
            type="button"
            role="menuitem"
            disabled={!!pending() || clearing()}
            onClick={openStatus}
          >
            <ActionIcon>
              <Icon name="pencil-simple" size={16} />
            </ActionIcon>
            <ActionText>
              {user()?.status?.text || t`Add status text`}
            </ActionText>
          </Action>
          <Show when={user()?.status?.text}>
            <Action
              type="button"
              role="menuitem"
              disabled={!!pending() || clearing()}
              onClick={() => void clearStatus()}
            >
              <ActionIcon>
                <Icon name="trash" size={16} />
              </ActionIcon>
              <ActionText>{t`Clear status`}</ActionText>
            </Action>
          </Show>
          <Show when={state.settings.getValue("advanced:copy_id")}>
            <Action type="button" role="menuitem" onClick={() => void copyId()}>
              <ActionIcon>
                <Icon name="copy" size={16} />
              </ActionIcon>
              <ActionText>{t`Copy user ID`}</ActionText>
            </Action>
          </Show>
        </Panel>
      </Show>
    </Portal>
  );
}

const Panel = styled("div", {
  base: {
    zIndex: 1000,
    width: "min(240px, calc(100vw - 24px))",
    padding: "6px",
    overflowY: "auto",
    overscrollBehavior: "contain",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
    color: "var(--z-fg-primary)",
    boxShadow: "var(--z-popover-lift)",
    outline: "none",
    "--z-icon-color": "var(--z-fg-secondary)",
  },
});
/** Who you are: a quiet card, not a button */
const Header = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px",
    marginBottom: "4px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-fg-primary) 4%, transparent)",
  },
});
const Identity = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong, & span": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& strong": { fontSize: "14px", fontWeight: 600 },
    "& span": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});
const Divider = styled("div", {
  base: {
    height: "1px",
    background: "var(--z-border-subtle)",
    margin: "4px 8px",
  },
});
const StatusButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    minHeight: "36px",
    padding: "6px 10px",
    textAlign: "start",
    cursor: "pointer",
    border: 0,
    borderRadius: "calc(var(--z-radius, 10px) - 2px)",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-accent-text, var(--z-accent))",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    // the chosen status: brighter text and a check, no heavy fill
    "&[data-selected='true']": {
      color: "var(--z-fg-primary)",
      "& strong": { fontWeight: 600 },
    },
  },
});
const Dot = styled("span", {
  base: { width: "18px", flexShrink: 0, display: "grid", placeItems: "center" },
});
const ChoiceText = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    "& strong": { fontSize: "13px", lineHeight: "20px", fontWeight: 500 },
    "& span": {
      fontSize: "11px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
  },
});
const Notice = styled("div", {
  base: {
    margin: "4px 8px",
    padding: "9px 10px",
    borderRadius: "7px",
    background: "var(--z-nav-hover)",
    fontSize: "12px",
    color: "var(--z-fg-secondary)",
    "&[data-error]": { color: "var(--z-status-error)" },
  },
});
const Action = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    minHeight: "38px",
    padding: "6px 10px",
    textAlign: "start",
    border: 0,
    borderRadius: "calc(var(--z-radius, 10px) - 2px)",
    cursor: "pointer",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    _hover: { background: "var(--z-nav-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    _disabled: { opacity: 0.5, cursor: "default" },
  },
});
/** Same soft icon tile as settings rows */
const ActionIcon = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "26px",
    marginInlineStart: "-4px",
  },
});
const ActionText = styled("span", {
  base: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});
