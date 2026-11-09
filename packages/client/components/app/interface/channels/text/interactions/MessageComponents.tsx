import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  on,
  onCleanup,
} from "solid-js";

import { i18n } from "@lingui/core";
import { useLingui } from "@lingui/solid/macro";
import { Icon } from "@revolt/ui/icons/Icon";
import { useFloating } from "solid-floating-ui";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import { autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import type { File, Message } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Markdown } from "@revolt/markdown";
import { useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import { Attachment } from "@revolt/ui";

import { useInteractionErrorText } from "./errorText";
import { Gallery, Thumbnail, Veil } from "./MediaBlocks";
import { type Restriction, restrictionAllows } from "./restriction";
import { interactionState, useComponent } from "./store";
import type {
  ButtonStyle,
  ChannelKind,
  Component,
  ComponentBlock,
  SelectOption,
} from "./types";

type Props = {
  /** Components as sent by the bot; unknown block types are skipped */
  blocks: unknown[] | undefined;
  channelId: string;
  /** Channel message id, or ephemeral message id */
  messageId: string;
  serverId?: string;
  /** Files of the same message, which blocks may show in place */
  attachments?: File[];
  message?: Message;
};

type Context = Omit<Props, "blocks">;

/** Blocks this client knows how to show in a message */
const MESSAGE_BLOCKS = new Set([
  "ActionRow",
  "Text",
  "Section",
  "Gallery",
  "File",
  "Separator",
  "Container",
]);

function knownBlocks(blocks: unknown[] | undefined): ComponentBlock[] {
  return (blocks ?? []).filter((block) =>
    MESSAGE_BLOCKS.has((block as ComponentBlock)?.type),
  ) as ComponentBlock[];
}

/**
 * Ids of the message's files that its blocks show in place; the plain
 * attachment list leaves them out so nothing appears twice.
 */
export function placedAttachments(blocks: unknown[] | undefined) {
  const ids = new Set<string>();
  const visit = (list: ComponentBlock[]) => {
    for (const block of list) {
      if (block.type === "File") ids.add(block.attachment);
      if (block.type === "Gallery")
        block.items.forEach((i) => i.attachment && ids.add(i.attachment));
      if (block.type === "Section" && block.thumbnail?.attachment)
        ids.add(block.thumbnail.attachment);
      if (block.type === "Container") visit(knownBlocks(block.components));
    }
  };
  visit(knownBlocks(blocks));
  return ids;
}

/**
 * Blocks of a bot's message: rows of buttons or a select, text, sections,
 * image galleries, files, separators and cards that group them.
 *
 * Text goes through the normal message Markdown, never HTML. Using a
 * component sends one interaction; it shows progress until the bot answers.
 */
export function MessageComponents(props: Props) {
  const blocks = createMemo(() => knownBlocks(props.blocks));

  // A pressed button is disabled while the bot works, and the bot's update
  // builds the controls anew: both drop the keyboard's place. Remember it by
  // position (bots often put the page in the custom id) and put it back.
  let root: HTMLDivElement | undefined;
  let lastAt = -1;
  const controls = () =>
    root
      ? [...root.querySelectorAll<HTMLElement>("button, a[href]")].filter(
          (el) => !el.closest("[data-folded]"),
        )
      : [];
  const usable = (el: HTMLElement) =>
    !(el as HTMLButtonElement).disabled &&
    el.getAttribute("aria-disabled") !== "true";
  function restore() {
    if (lastAt < 0) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (lastAt < 0 || (active && active !== document.body)) return;
      const list = controls();
      const target = [...list.keys()]
        .filter((i) => usable(list[i]))
        .sort((a, b) => Math.abs(a - lastAt) - Math.abs(b - lastAt))[0];
      if (target !== undefined) list[target].focus({ preventScroll: true });
    });
  }
  const forget = (event: PointerEvent) => {
    if (!root?.contains(event.target as Node)) lastAt = -1;
  };
  document.addEventListener("pointerdown", forget);
  onCleanup(() => document.removeEventListener("pointerdown", forget));
  createEffect(on(blocks, restore, { defer: true }));
  createEffect(
    on(
      () =>
        Object.keys(interactionState.busy).some((key) =>
          key.startsWith(`${props.messageId}:`),
        ),
      (busy) => !busy && restore(),
      { defer: true },
    ),
  );

  return (
    <Show when={blocks().length}>
      <div
        ref={root}
        onFocusIn={(event) => {
          lastAt = controls().indexOf(event.target as HTMLElement);
        }}
        onFocusOut={(event) => {
          // moved elsewhere on purpose: forget; lost to a re-render: keep
          const next = event.relatedTarget as Node | null;
          if (next && !root?.contains(next)) lastAt = -1;
        }}
      >
        <Blocks blocks={blocks()} context={props} />
      </div>
    </Show>
  );
}

function Blocks(props: { blocks: ComponentBlock[]; context: Context }) {
  return (
    <Rows>
      <For each={props.blocks}>
        {(block) => <BlockView block={block} context={props.context} />}
      </For>
    </Rows>
  );
}

function BlockView(props: { block: ComponentBlock; context: Context }) {
  const component = (component: Component) => (
    <ComponentView
      component={component}
      channelId={props.context.channelId}
      messageId={props.context.messageId}
      serverId={props.context.serverId}
    />
  );

  return (
    <Switch>
      <Match when={props.block.type === "ActionRow" && props.block}>
        {(row) => (
          <Row>
            <For each={row().components}>{component}</For>
          </Row>
        )}
      </Match>
      <Match when={props.block.type === "Text" && props.block}>
        {(text) => (
          <BlockText>
            <Markdown content={text().content} />
          </BlockText>
        )}
      </Match>
      <Match when={props.block.type === "Section" && props.block}>
        {(section) => (
          <SectionRow>
            <BlockText>
              <For each={section().text}>
                {(paragraph) => <Markdown content={paragraph} />}
              </For>
            </BlockText>
            <Show when={section().button}>
              {(button) => component(button())}
            </Show>
            <Show when={section().thumbnail}>
              {(item) => (
                <Thumbnail
                  item={item()}
                  attachments={props.context.attachments}
                />
              )}
            </Show>
          </SectionRow>
        )}
      </Match>
      <Match when={props.block.type === "Gallery" && props.block}>
        {(gallery) => (
          <Gallery
            items={gallery().items}
            attachments={props.context.attachments}
          />
        )}
      </Match>
      <Match when={props.block.type === "File" && props.block}>
        {(block) => (
          <Show
            when={props.context.attachments?.find(
              (file) => file.id === block().attachment,
            )}
          >
            {(file) => (
              <Veil hidden={block().spoiler}>
                <Attachment file={file()} message={props.context.message} />
              </Veil>
            )}
          </Show>
        )}
      </Match>
      <Match when={props.block.type === "Separator" && props.block}>
        {(separator) => (
          <Separator
            role={separator().divider === false ? "none" : "separator"}
            data-line={separator().divider === false ? undefined : ""}
            data-large={separator().spacing === "Large" ? "" : undefined}
          />
        )}
      </Match>
      <Match when={props.block.type === "Container" && props.block}>
        {(card) => (
          <Card
            data-accent={card().accent ? "" : undefined}
            style={{ "--accent": safeColour(card().accent) }}
          >
            <Veil hidden={card().spoiler}>
              <Blocks
                blocks={knownBlocks(card().components).filter(
                  (block) => block.type !== "Container",
                )}
                context={props.context}
              />
            </Veil>
          </Card>
        )}
      </Match>
    </Switch>
  );
}

/** Only `#RRGGBB`, as the server already checks */
function safeColour(colour?: string) {
  return colour && /^#[0-9a-f]{6}$/i.test(colour) ? colour : undefined;
}

function ComponentView(props: {
  component: Component;
  channelId: string;
  messageId: string;
  serverId?: string;
}) {
  const client = useClient();
  const state = useState();
  const { openModal } = useModals();
  const { t } = useLingui();

  /** The bot limited this to some people or roles, and not this reader:
   * shown as not for them instead of failing after the click */
  const allowed = () => {
    const me = client().user?.id;
    const roles =
      props.serverId && me
        ? (client().serverMembers.getByKey({ server: props.serverId, user: me })
            ?.roles ?? [])
        : [];
    return restrictionAllows(
      (props.component as { restrict?: Restriction }).restrict,
      me,
      roles,
    );
  };
  const notForYou = () =>
    allowed() ? undefined : t`Only some people can use this.`;

  /** Sites the reader has not trusted yet open only after a warning */
  function warnBeforeLeaving(event: MouseEvent, href: string) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      event.preventDefault();
      return;
    }
    if (state.linkSafety.isTrusted(url)) return;
    event.preventDefault();
    openModal({ type: "link_warning", url, display: url.toString() });
  }

  const busy = () =>
    "custom_id" in props.component &&
    !!props.component.custom_id &&
    !!interactionState.busy[`${props.messageId}:${props.component.custom_id}`];

  const use = (values?: string[]) => {
    const customId = (props.component as { custom_id?: string }).custom_id;
    if (!customId) return;
    useComponent(
      client(),
      props.channelId,
      props.messageId,
      customId,
      values,
    ).catch(() => {
      // the failure is shown next to this component (componentErrors)
    });
  };

  const errorText = useInteractionErrorText();
  const failure = () => {
    const customId = (props.component as { custom_id?: string }).custom_id;
    return customId
      ? interactionState.componentErrors[`${props.messageId}:${customId}`]
      : undefined;
  };

  return (
    <>
      <Switch>
        <Match when={props.component.type === "Button" && props.component}>
          {(button) => (
            <Switch>
              <Match when={button().style === "Link" && button().url}>
                {(url) => (
                  <LinkButton
                    href={safeUrl(url())}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    aria-disabled={button().disabled}
                    onClick={(event) => warnBeforeLeaving(event, url())}
                  >
                    <ButtonContent
                      emoji={button().emoji}
                      label={button().label}
                    />
                    <Icon name="arrow-square-out" size={16} />
                  </LinkButton>
                )}
              </Match>
              <Match when={button().style !== "Link"}>
                <ActionButton
                  type="button"
                  tone={button().style as Exclude<ButtonStyle, "Link">}
                  disabled={button().disabled || busy() || !allowed()}
                  aria-busy={busy()}
                  title={notForYou()}
                  data-restricted={allowed() ? undefined : ""}
                  // emoji-only buttons are square, so game boards line up
                  data-square={
                    !button().label?.replace(/[\s\u200b]/g, "") || undefined
                  }
                  onClick={() => use()}
                >
                  <ButtonContent
                    emoji={button().emoji}
                    label={button().label}
                  />
                  <Show when={busy()}>
                    <Spinner aria-hidden="true" data-spinner />
                  </Show>
                </ActionButton>
              </Match>
            </Switch>
          )}
        </Match>
        <Match when={isSelect(props.component)}>
          <SelectMenu
            component={
              {
                ...(props.component as SelectComponent),
                disabled:
                  (props.component as SelectComponent).disabled || !allowed(),
              } as SelectComponent
            }
            serverId={props.serverId}
            busy={busy()}
            title={notForYou()}
            onSubmit={use}
          />
        </Match>
      </Switch>
      <Show when={failure()}>
        <ComponentError role="alert" data-component-error>
          <Icon name="warning-circle" size={14} />
          <span>{errorText(failure())}</span>
        </ComponentError>
      </Show>
    </>
  );
}

/** Why the button or menu next to it did not work */
const ComponentError = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    gap: "4px",
    minWidth: 0,
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-status-error)",
    "--z-icon-color": "var(--z-status-error)",
    "& svg": { flexShrink: 0 },
  },
});

/** Only http(s) links, as the server already checks */
function safeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}

function ButtonContent(props: { emoji?: string; label?: string }) {
  return (
    <>
      <Show when={props.emoji}>
        {/* an element, so a waiting button can hide it */}
        <span data-emoji>
          {/* with no label, the emoji is the button's name for screen readers */}
          <EmojiView emoji={props.emoji!} decorative={!!props.label} />
        </span>
      </Show>
      <Show when={props.label}>
        <span>{props.label}</span>
      </Show>
    </>
  );
}

/**
 * Unicode emoji as text, custom emoji by id as an image. Decorative (the
 * default) next to a label; otherwise screen readers read it as the name.
 */
export function EmojiView(props: { emoji: string; decorative?: boolean }) {
  const decorative = () => props.decorative ?? true;
  const client = useClient();
  const isCustom = () => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(props.emoji);
  const custom = () =>
    isCustom() ? client().emojis.get(props.emoji) : undefined;

  // emoji of servers this user is not in are not loaded yet
  createEffect(() => {
    if (isCustom() && !custom()) {
      client()
        .emojis.fetch(props.emoji)
        .catch(() => {});
    }
  });

  return (
    <Show
      when={custom()}
      fallback={
        <Show
          when={!isCustom()}
          fallback={<EmojiPlaceholder aria-hidden="true" />}
        >
          <span aria-hidden={decorative() ? "true" : undefined}>
            {props.emoji}
          </span>
        </Show>
      }
    >
      {(emoji) => (
        <EmojiImage
          src={emoji().url}
          alt={decorative() ? "" : `:${emoji().name}:`}
        />
      )}
    </Show>
  );
}

export type SelectComponent = Extract<
  Component,
  {
    type:
      | "StringSelect"
      | "UserSelect"
      | "RoleSelect"
      | "MentionableSelect"
      | "ChannelSelect";
  }
>;

export function isSelect(component: Component): component is SelectComponent {
  return (
    component.type === "StringSelect" ||
    component.type === "UserSelect" ||
    component.type === "RoleSelect" ||
    component.type === "MentionableSelect" ||
    component.type === "ChannelSelect"
  );
}

/**
 * Searchable single or multiple choice list for every select kind.
 *
 * User, role and channel selects offer what this client already knows of the
 * server; the server checks every chosen id again.
 *
 * In a message, choosing sends the choice at once (`onSubmit`). In a form,
 * `onChange` gets every change and the form sends it with the rest.
 */
export function SelectMenu(props: {
  component: SelectComponent;
  serverId?: string;
  busy?: boolean;
  /** Why it is disabled, shown on hover */
  title?: string;
  onSubmit?: (values: string[]) => void;
  onChange?: (values: string[]) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const listId = createUniqueId();
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [active, setActive] = createSignal(0);

  const min = () => props.component.min_values ?? 1;
  const max = () => props.component.max_values ?? 1;
  const multiple = () => max() > 1;

  const options = createMemo<MenuOption[]>(() => {
    const component = props.component;
    const server = props.serverId
      ? client().servers.get(props.serverId)
      : undefined;
    switch (component.type) {
      case "StringSelect":
        return component.options;
      case "RoleSelect":
        return roleOptions(server);
      case "UserSelect":
        return memberOptions(client(), props.serverId);
      case "MentionableSelect":
        return [
          ...memberOptions(client(), props.serverId),
          ...roleOptions(server),
        ];
      case "ChannelSelect":
        return channelOptions(server, component.channel_types);
    }
  });

  const initial = () => {
    const component = props.component;
    if (component.type === "StringSelect") {
      return component.options.filter((o) => o.default).map((o) => o.value);
    }
    return component.default_values ?? [];
  };
  const [selected, setSelected] = createSignal<string[]>(initial());
  /** What was last sent (or given by the bot): closing the list without
   * confirming goes back to it, so the field never shows unsent picks */
  let committed = initial();
  // the bot changed the menu (a new message version): start from its defaults
  createEffect(
    on(
      () => props.component,
      () => {
        committed = initial();
        setSelected(committed);
      },
      { defer: true },
    ),
  );
  createEffect(
    on(open, (isOpen, wasOpen) => {
      if (isOpen) setActive(0);
      else if (wasOpen && !props.onChange) setSelected(committed);
    }),
  );
  const full = () => multiple() && selected().length >= max();

  const filtered = createMemo(() => {
    const q = query().trim().toLocaleLowerCase();
    if (!q) return options();
    return options().filter(
      (option) =>
        option.label.toLocaleLowerCase().includes(q) ||
        option.description?.toLocaleLowerCase().includes(q),
    );
  });

  const chosen = () => options().filter((o) => selected().includes(o.value));
  const summary = () => {
    const chosen = options().filter((o) => selected().includes(o.value));
    if (!chosen.length)
      return props.component.placeholder ?? t`Make a selection`;
    // the reader's own list format: "A, B" in English
    return new Intl.ListFormat(i18n.locale, {
      style: "short",
      type: "unit",
    }).format(chosen.map((o) => o.label));
  };

  function toggle(value: string) {
    if (!multiple()) {
      setSelected([value]);
      props.onChange?.([value]);
      submit([value]);
      return;
    }
    setSelected((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : current.length < max()
          ? [...current, value]
          : current,
    );
    props.onChange?.(selected());
  }

  function submit(values = selected()) {
    if (props.onChange) {
      setOpen(false);
      return;
    }
    if (values.length < min() || values.length > max()) return;
    committed = values;
    setOpen(false);
    props.onSubmit?.(values);
  }

  // the list floats above the page, placed like the app's own dropdowns
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const [panel, setPanel] = createSignal<HTMLDivElement>();
  const position = useFloating(anchor, panel, {
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 8 }),
      size({
        apply({ rects, elements, availableHeight, availableWidth }) {
          Object.assign(elements.floating.style, {
            width: `${Math.min(rects.reference.width, availableWidth)}px`,
            "--z-select-max-height": `${Math.max(0, availableHeight)}px`,
          });
        },
      }),
    ],
  });

  const onOutside = (event: PointerEvent) => {
    const target = event.target as Node;
    if (open() && !anchor()?.contains(target) && !panel()?.contains(target))
      setOpen(false);
  };
  document.addEventListener("pointerdown", onOutside);
  onCleanup(() => document.removeEventListener("pointerdown", onOutside));

  // keep the highlighted option in view while moving with the keys
  createEffect(
    on(active, (index) => {
      if (!open()) return;
      document
        .getElementById(`${listId}-${index}`)
        ?.scrollIntoView({ block: "nearest" });
    }),
  );

  function onKeyDown(event: KeyboardEvent) {
    const list = filtered();
    const move = (index: number) => {
      event.preventDefault();
      setActive(Math.max(0, Math.min(index, list.length - 1)));
    };
    const inSearch = event.target instanceof HTMLInputElement;
    if (event.key === "ArrowDown") move(active() + 1);
    else if (event.key === "ArrowUp") move(active() - 1);
    else if (event.key === "Home" && !inSearch) move(0);
    else if (event.key === "End" && !inSearch) move(list.length - 1);
    else if (event.key === "PageDown") move(active() + 6);
    else if (event.key === "PageUp") move(active() - 6);
    else if (event.key === " " && !inSearch && multiple()) {
      event.preventDefault();
      if (list[active()]) toggle(list[active()].value);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (multiple() && event.ctrlKey) submit();
      else if (list[active()]) toggle(list[active()].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      anchor()?.focus();
    }
  }

  return (
    <SelectRoot data-form={props.onChange ? "" : undefined}>
      <SelectTrigger
        ref={setAnchor}
        type="button"
        data-open={open() || undefined}
        disabled={props.component.disabled || props.busy}
        title={props.title}
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={open() ? listId : undefined}
        aria-busy={props.busy}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          // the arrow keys open the list, as in other menus
          if (
            !open() &&
            (event.key === "ArrowDown" || event.key === "ArrowUp")
          ) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <TriggerValue data-placeholder={!chosen().length || undefined}>
          <Show when={chosen().length === 1 && chosen()[0].emoji}>
            <EmojiView emoji={chosen()[0].emoji!} />
          </Show>
          <span>{summary()}</span>
        </TriggerValue>
        <Show when={props.busy} fallback={<Icon name="caret-down" size={16} />}>
          <Spinner aria-hidden="true" />
        </Show>
      </SelectTrigger>
      <Portal mount={document.getElementById("floating")!}>
        <Presence>
          <Show when={open()}>
            <Motion
              ref={setPanel}
              style={{
                position: position.strategy,
                top: `${position.y ?? 0}px`,
                left: `${position.x ?? 0}px`,
                "z-index": "1000",
              }}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, easing: [0.87, 0, 0.13, 1] }}
            >
              <SelectPanel onKeyDown={onKeyDown}>
                <Show when={options().length > 6}>
                  <SearchInput
                    // `autofocus` does not fire in the floating layer
                    ref={(el) => requestAnimationFrame(() => el.focus())}
                    type="search"
                    placeholder={t`Search`}
                    value={query()}
                    onInput={(e) => {
                      setQuery(e.currentTarget.value);
                      setActive(0);
                    }}
                  />
                </Show>
                <OptionList
                  id={listId}
                  role="listbox"
                  aria-label={
                    props.component.placeholder ?? t`Make a selection`
                  }
                  aria-multiselectable={multiple()}
                  aria-activedescendant={
                    filtered().length ? `${listId}-${active()}` : undefined
                  }
                  tabindex={options().length > 6 ? -1 : 0}
                  ref={(el) =>
                    options().length <= 6 &&
                    requestAnimationFrame(() => el.focus())
                  }
                >
                  <For
                    each={filtered()}
                    fallback={<Empty>{t`Nothing found`}</Empty>}
                  >
                    {(option, index) => (
                      <OptionRow
                        id={`${listId}-${index()}`}
                        role="option"
                        aria-selected={selected().includes(option.value)}
                        // at the limit, the others wait until one is removed
                        aria-disabled={
                          (full() && !selected().includes(option.value)) ||
                          undefined
                        }
                        data-active={index() === active() ? "" : undefined}
                        onPointerEnter={() => setActive(index())}
                        onClick={() => toggle(option.value)}
                      >
                        <Switch>
                          <Match when={option.avatar}>
                            {(src) => <OptionAvatar src={src()} alt="" />}
                          </Match>
                          <Match when={option.colour}>
                            {(colour) => (
                              <OptionDot
                                aria-hidden="true"
                                style={{ background: colour() }}
                              />
                            )}
                          </Match>
                          <Match when={option.emoji}>
                            <OptionEmoji>
                              <EmojiView emoji={option.emoji!} />
                            </OptionEmoji>
                          </Match>
                        </Switch>
                        <OptionText>
                          <span>{option.label}</span>
                          <Show when={option.description}>
                            <small>{option.description}</small>
                          </Show>
                        </OptionText>
                        <Show when={selected().includes(option.value)}>
                          <Icon name="check" size={16} />
                        </Show>
                      </OptionRow>
                    )}
                  </For>
                </OptionList>
                <Show when={multiple()}>
                  <PanelFooter>
                    <small>{t`${selected().length} of ${max()} selected`}</small>
                    <ActionButton
                      type="button"
                      tone="Primary"
                      data-small
                      disabled={!props.onChange && selected().length < min()}
                      onClick={() => submit()}
                    >
                      {props.onChange ? t`Done` : t`Confirm`}
                    </ActionButton>
                  </PanelFooter>
                </Show>
              </SelectPanel>
            </Motion>
          </Show>
        </Presence>
      </Portal>
    </SelectRoot>
  );
}

type ClientLike = ReturnType<ReturnType<typeof useClient>>;
type ServerLike = ReturnType<ClientLike["servers"]["get"]>;

/** An entry of the open list: members bring their picture, roles their colour */
type MenuOption = SelectOption & { avatar?: string; colour?: string };

function roleOptions(server: ServerLike): MenuOption[] {
  return (
    server?.orderedRoles?.map((role) => ({
      label: role.name,
      value: role.id,
      colour: role.colour ?? undefined,
    })) ?? []
  );
}

function memberOptions(client: ClientLike, serverId?: string): MenuOption[] {
  if (!serverId) return [];
  return client.serverMembers
    .filter((member) => member.id.server === serverId)
    .map((member) => {
      const username = member.user?.username;
      const label = member.displayName ?? username ?? member.id.user;
      return {
        label,
        value: member.id.user,
        // the username only adds something when a nickname is shown
        description: username && username !== label ? username : undefined,
        avatar: member.avatarURL ?? member.user?.avatarURL,
      };
    });
}

function channelOptions(
  server: ServerLike,
  kinds?: ChannelKind[],
): SelectOption[] {
  return (
    server?.channels
      .filter(
        (channel) =>
          channel.type === "TextChannel" &&
          channel.havePermission("ViewChannel"),
      )
      .filter((channel) => {
        if (!kinds?.length) return true;
        const kind: ChannelKind = channel.isVoice ? "Voice" : "Text";
        return kinds.includes(kind);
      })
      .map((channel) => ({ label: `#${channel.name}`, value: channel.id })) ??
    []
  );
}

const Rows = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBlockStart: "6px",
    maxWidth: "min(100%, 520px)",
  },
});

/** Bot text: the message's own Markdown, a little tighter */
const BlockText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: 1,
    overflowWrap: "anywhere",
  },
});

/** Text with a button or thumbnail at the end of the line */
const SectionRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    "& > button, & > a": { flexShrink: 0, marginBlockStart: "2px" },
  },
});

const Separator = styled("div", {
  base: {
    marginBlock: "2px",
    "&[data-large]": { marginBlock: "10px" },
    "&[data-line]": {
      height: "1px",
      background: "var(--z-border-subtle)",
    },
  },
});

/**
 * A bot's card: one step above the chat surface with a soft border; the
 * optional colour strip runs down the start edge (right in Arabic).
 */
const Card = styled("div", {
  base: {
    position: "relative",
    padding: "14px 16px",
    borderRadius: "8px",
    // a step above the chat, so the card reads as raised, never as a hole
    background: "color-mix(in srgb, var(--z-bg-raised) 55%, var(--z-bg-chat))",
    border: "1px solid var(--z-border-subtle)",
    overflow: "hidden",
    // the blocks inside (card > veil > content > blocks) start at the padding
    "& > div > div > div": { marginBlockStart: 0, gap: "8px" },
    "&[data-accent]": {
      paddingInlineStart: "18px",
      _before: {
        content: '""',
        position: "absolute",
        insetBlock: 0,
        insetInlineStart: 0,
        width: "4px",
        background: "var(--accent)",
      },
    },
  },
});

const Row = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    // a grid of square buttons is a game board: same layout in every language
    // (fit-content keeps it at the start of the message in RTL too)
    "&:has(> [data-square])": { direction: "ltr", width: "fit-content" },
  },
});

/**
 * Bot buttons: flat and solid, one colour per meaning (main, grey,
 * success, danger, link), crisp 4px corners, the same height in a row.
 * Hover brightens a little, pressing settles 1px, disabled fades out.
 */
const buttonBase = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: "32px",
  minWidth: "60px",
  // links too get the 44 px phone target buttons already have
  _phone: { minHeight: "44px" },
  paddingInline: "16px",
  borderRadius: "4px",
  border: "none",
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: "16px",
  cursor: "pointer",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "--z-icon-color": "currentColor",
  transition: "filter 0.12s ease, background-color 0.12s ease",
  _hover: { filter: "brightness(1.1)" },
  "&:active:not(:disabled)": { transform: "translateY(1px)" },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
  // faded, colourless and inert: a disabled button never looks like a
  // live one (a played square on a game board keeps its colour)
  _disabled: { opacity: 0.45, cursor: "not-allowed", filter: "saturate(0.2)" },
  // waiting for the bot: the spinner covers the label, the width stays
  "&[aria-busy=true] > :not([data-spinner])": { visibility: "hidden" },
  "&[data-square]": {
    width: "40px",
    minWidth: "40px",
    height: "40px",
    paddingInline: 0,
    fontSize: "18px",
    _disabled: { opacity: 0.7, filter: "none" },
  },
} as const;

/** Grey: the quiet choice next to a main one */
const secondary = {
  background: "color-mix(in srgb, var(--z-fg-primary) 12%, var(--z-bg-raised))",
  color: "var(--z-fg-primary)",
} as const;

const ActionButton = styled("button", {
  base: buttonBase,
  variants: {
    tone: {
      Primary: {
        background: "var(--z-accent-fill, #E0195F)",
        color: "var(--z-on-accent, #fff)",
      },
      Secondary: secondary,
      Success: {
        background: "var(--z-status-success)",
        color: "#0D0E16",
      },
      // tinted, not filled: the raspberry of main actions and the red of
      // leaving or deleting must never be mistaken for each other
      Danger: {
        background:
          "color-mix(in srgb, var(--z-danger) 16%, var(--z-bg-raised))",
        color: "var(--z-danger)",
        boxShadow:
          "inset 0 0 0 1px color-mix(in srgb, var(--z-danger) 45%, transparent)",
        _hover: {
          filter: "none",
          background:
            "color-mix(in srgb, var(--z-danger) 26%, var(--z-bg-raised))",
        },
      },
    },
  },
});

/** Opens a website: grey, with the external link mark */
const LinkButton = styled("a", {
  base: {
    ...buttonBase,
    ...secondary,
    textDecoration: "none",
    "&[aria-disabled=true]": { opacity: 0.5, pointerEvents: "none" },
  },
});

const Spinner = styled("span", {
  base: {
    position: "absolute",
    insetInlineStart: "calc(50% - 7px)",
    top: "calc(50% - 7px)",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderBlockStartColor: "transparent",
    animation: "spin 0.8s linear infinite",
  },
});

const EmojiImage = styled("img", {
  base: { width: "18px", height: "18px", objectFit: "contain" },
});

/** Space kept for a custom emoji while it loads (or if it was deleted) */
const EmojiPlaceholder = styled("span", {
  base: {
    display: "inline-block",
    width: "1.25em",
    height: "1.25em",
    borderRadius: "4px",
    background: "var(--z-bg-input)",
  },
});

const SelectRoot = styled("div", {
  // in a message the field stays compact; in a form it fills the width
  base: { width: "min(100%, 400px)", "&[data-form]": { width: "100%" } },
});

/** The app's select field: the text-field surface, accent ring when open */
const SelectTrigger = styled("button", {
  base: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minHeight: "36px",
    padding: "7px 10px 7px 12px",
    borderRadius: "8px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-icon-muted)",
    fontFamily: "inherit",
    fontSize: "14px",
    textAlign: "start",
    cursor: "pointer",
    transition: "border-color 0.12s ease, box-shadow 0.12s ease",
    "& > svg": { flexShrink: 0, transition: "transform 0.16s ease" },
    _hover: {
      borderColor: "color-mix(in srgb, var(--z-fg-muted) 45%, transparent)",
    },
    "&:focus-visible, &[data-open]": {
      outline: "none",
      borderColor: "var(--z-accent)",
      boxShadow: "0 0 0 3px var(--z-accent-muted)",
    },
    "&[data-open] > svg": { transform: "rotate(180deg)" },
    _disabled: { opacity: 0.45, cursor: "not-allowed" },
  },
});

const TriggerValue = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    "& > span:last-child": {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "&[data-placeholder]": { color: "var(--z-fg-muted)" },
  },
});

/** The app's dropdown panel */
const SelectPanel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "min(340px, 50dvh, var(--z-select-max-height, 50dvh))",
    boxSizing: "border-box",
    borderRadius: "12px",
    padding: "6px",
    background: "var(--z-popover-bg)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
  },
});

const SearchInput = styled("input", {
  base: {
    width: "100%",
    minHeight: "32px",
    paddingInline: "10px",
    borderRadius: "8px",
    fontFamily: "inherit",
    fontSize: "13px",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    border: "1px solid var(--z-field-border)",
    _placeholder: { color: "var(--z-fg-muted)" },
    _focusVisible: { outline: "none", borderColor: "var(--z-accent)" },
  },
});

const OptionList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minHeight: 0,
    overflowY: "auto",
    outline: "none",
  },
});

/** A row like the app's menu items: accent wash on hover, check when chosen */
const OptionRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
    minHeight: "36px",
    padding: "7px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-accent)",
    "& > svg": { flexShrink: 0, marginInlineStart: "auto" },
    "&[data-active]": {
      background: "color-mix(in srgb, var(--z-accent) 18%, transparent)",
    },
    "&[aria-disabled=true]": { opacity: 0.45, cursor: "not-allowed" },
  },
});

const OptionAvatar = styled("img", {
  base: {
    flexShrink: 0,
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "var(--z-bg-input)",
  },
});

/** A role's colour, as in the member list */
const OptionDot = styled("span", {
  base: {
    flexShrink: 0,
    width: "12px",
    height: "12px",
    marginInline: "4px",
    borderRadius: "50%",
  },
});

const OptionEmoji = styled("span", {
  base: {
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    width: "20px",
    fontSize: "16px",
  },
});

const OptionText = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    fontWeight: 500,
    "& small": {
      color: "var(--z-fg-muted)",
      fontWeight: 400,
      fontSize: "12px",
      lineHeight: "16px",
    },
  },
});

const Empty = styled("div", {
  base: { padding: "8px 10px", color: "var(--z-fg-muted)", fontSize: "13px" },
});

const PanelFooter = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    paddingBlockStart: "6px",
    paddingInline: "4px",
    borderBlockStart: "1px solid var(--z-popover-border)",
    color: "var(--z-fg-muted)",
    fontSize: "12px",
    "& > button[data-small]": {
      minHeight: "28px",
      paddingInline: "12px",
      fontSize: "13px",
    },
  },
});
