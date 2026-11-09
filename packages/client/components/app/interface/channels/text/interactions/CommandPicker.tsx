import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { i18n } from "@lingui/core";
import { useLingui } from "@lingui/solid/macro";
import type { Channel } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  requestedCommand,
  setRequestedCommand,
} from "@revolt/markdown/plugins/commands";
import { Avatar } from "@revolt/ui";
import {
  commandEditor,
  editCommandText,
  moveCommandCursor,
  setCommandLayout,
} from "@revolt/ui/components/features/texteditor/commandState";
import {
  type OptionSpan,
  RE_CHANNEL_VALUE,
  RE_ROLE_VALUE,
  RE_USER_VALUE,
  parseCommandOptions,
  spanAtCursor,
} from "@revolt/ui/components/features/texteditor/commandText";
import { Icon } from "@revolt/ui/icons/Icon";

import { InteractionError } from "./api";
import { dedupeCommands, typedCommand } from "./commandList";
import {
  AutocompleteTimeout,
  commandsKey,
  interactionState,
  loadCommands,
  requestAutocomplete,
  runCommand,
} from "./store";
import {
  type ApplicationCommand,
  type CommandApplication,
  type CommandOption,
  type DataOption,
  type Localizations,
  type OptionChoice,
  type OptionValue,
  localized,
} from "./types";

type Props = {
  channel: Channel;
  /** Current draft text */
  content: string;
  /** Replace the draft text */
  setContent: (content: string) => void;
};

const SUBCOMMAND_TYPES = ["SubCommand", "SubCommandGroup"];

/** Runs the command being filled in (set while the command bar is shown) */
const [activeRun, setActiveRun] = createSignal<() => void>();
/** Chooses a command typed in full (`/close`, then Enter) when none is chosen */
const [typedChooser, setTypedChooser] = createSignal<() => boolean>();

/**
 * Run the chosen command instead of sending the draft as a message. The
 * message box calls this first, so Enter and the send button run a picked
 * command. A draft that is one command typed in full chooses that command
 * instead of being sent as text. Returns false when nothing was done.
 */
export function runActiveCommand(): boolean {
  const run = activeRun();
  if (run) {
    run();
    return true;
  }
  return typedChooser()?.() ?? false;
}

/** Name in the user's language */
const label = (item: { name: string; name_localizations?: Localizations }) =>
  localized(item.name, item.name_localizations, i18n.locale);

/** The text a command starts with, and its first required option ready to fill */
function commandStart(command: ApplicationCommand, path: string[] = []) {
  let options = command.options ?? [];
  for (const name of path) {
    options = options.find((o) => label(o) === name)?.options ?? [];
  }
  const first = options.find(
    (o) => o.required && !SUBCOMMAND_TYPES.includes(o.type),
  );
  return `/${[label(command), ...path].join(" ")} ${first ? `${label(first)}:` : ""}`;
}

/**
 * Picker shown while the draft starts with `/`, then the bar for the chosen
 * command. Options are typed in the message box as `name:value`.
 * Works with mouse, touch and keyboard (arrows, Enter or Tab, Escape).
 */
export function CommandPicker(props: Props) {
  const { t } = useLingui();
  const client = useClient();
  const locale = () => i18n.locale;

  // the server's commands, or in a DM with a bot that bot's own
  const serverId = () => commandsKey(props.channel);

  // Load when the user starts a command; ApplicationCommandsUpdate clears the
  // stored list, which loads it again the next time
  createEffect(() => {
    const id = serverId();
    if (id && props.content.startsWith("/") && !interactionState.commands[id]) {
      loadCommands(client(), id).catch(() => undefined);
    }
  });
  const commands = () =>
    serverId() ? interactionState.commands[serverId()!] : undefined;

  const [dismissed, setDismissed] = createSignal(false);
  const [active, setActive] = createSignal(0);
  const [chosen, setChosen] = createSignal<ApplicationCommand>();
  // one bot's commands only (the rail on the side); undefined = all bots
  const [appFilter, setAppFilter] = createSignal<string>();

  const query = () => props.content.slice(1).split(/\s/)[0].toLocaleLowerCase();
  const typingCommand = () =>
    !!serverId() &&
    props.content.startsWith("/") &&
    !props.content.includes("\n");

  // Typing again after Escape brings the picker back
  createEffect(
    on(
      () => props.content,
      (content) => {
        if (!content.startsWith("/")) {
          setDismissed(false);
          setChosen(undefined);
          setAppFilter(undefined);
        }
        setActive(0);
      },
    ),
  );

  const channelNsfw = () => (props.channel as { nsfw?: boolean }).nsfw ?? false;
  // every copy, for finding a command by its id
  const everyUsable = () =>
    (commands()?.commands ?? [])
      .filter((command) => command.type === "ChatInput")
      .filter((command) => !command.nsfw || channelNsfw());
  // one entry per bot and name: the list and typing never offer two copies
  const usable = createMemo(() => dedupeCommands(everyUsable()));

  // bots that have at least one command here, in list order
  const apps = createMemo(() => {
    const ids = new Set(usable().map((command) => command.application_id));
    return (commands()?.applications ?? []).filter((app) => ids.has(app._id));
  });

  const matches = createMemo(() => {
    const q = query();
    const only = appFilter();
    return (
      usable()
        .filter((command) => !only || command.application_id === only)
        .map((command) => ({ command, name: label(command) }))
        .filter(
          ({ command, name }) =>
            !q || name.includes(q) || command.name.includes(q),
        )
        .sort((a, b) => {
          const aStarts = a.name.startsWith(q) || a.command.name.startsWith(q);
          const bStarts = b.name.startsWith(q) || b.command.name.startsWith(q);
          return (
            Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name)
          );
        })
        // one bot: all of its commands; all bots: the first 25
        .slice(0, only ? undefined : 25)
    );
  });

  function filterApp(id: string | undefined) {
    setAppFilter(id);
    setActive(0);
  }

  const application = (id: string) =>
    commands()?.applications.find((app) => app._id === id);

  const showList = () =>
    typingCommand() &&
    !dismissed() &&
    !chosen() &&
    (matches().length > 0 || !!appFilter());

  function pick(command: ApplicationCommand, path: string[] = []) {
    setChosen(command);
    props.setContent(commandStart(command, path));
  }

  function close() {
    setDismissed(true);
    setChosen(undefined);
  }

  // The command word was edited away: back to the list
  createEffect(
    on(commandEditor.text, (text) => {
      const command = chosen();
      if (!command) return;
      const word = `/${label(command)}`;
      if (text !== word && !text.startsWith(`${word} `)) setChosen(undefined);
    }),
  );

  // `/name ` typed (or pasted) in full: choose it without the list
  createEffect(
    on(commandEditor.text, (text) => {
      if (chosen() || dismissed() || !serverId()) return;
      const typed = /^\/(\S+)\s/.exec(text)?.[1];
      if (!typed) return;
      const found = usable().filter(
        (command) => label(command) === typed || command.name === typed,
      );
      if (found.length === 1) setChosen(found[0]);
    }),
  );

  // `/name` then Enter with nothing chosen (the list closed, or not loaded
  // yet): choose that command rather than send the text as a message
  // what happened to the last `/name` + Enter that waited for the list;
  // shown above the message box, and the next Enter sends the text
  const [typedNote, setTypedNote] = createSignal<{
    text: string;
    state: "loading" | "missing" | "failed";
  }>();
  createEffect(
    on(
      () => props.content,
      (content) => {
        if (typedNote() && typedNote()!.text !== content) setTypedNote();
      },
    ),
  );

  const chooseTyped = () => {
    const id = serverId();
    if (!id || chosen()) return false;
    const text = props.content;
    if (!/^\/\S+\s*$/.test(text)) return false;
    // the list could not help a moment ago: this Enter sends the text
    const note = typedNote();
    if (note && note.text === text && note.state !== "loading") {
      setTypedNote();
      return false;
    }
    if (note?.state === "loading") return true;
    if (!commands()) {
      // still loading: wait for the list, then choose it if it is there
      setTypedNote({ text, state: "loading" });
      loadCommands(client(), id)
        .then((list) => {
          const command = typedCommand(
            props.content,
            dedupeCommands(
              list.commands.filter(
                (entry) =>
                  entry.type === "ChatInput" && (!entry.nsfw || channelNsfw()),
              ),
            ),
            label,
          );
          if (command && !chosen()) {
            setTypedNote();
            setDismissed(false);
            pick(command);
          } else {
            setTypedNote({ text, state: "missing" });
          }
        })
        .catch(() => setTypedNote({ text, state: "failed" }));
      return true;
    }
    const command = typedCommand(text, usable(), label);
    if (!command) return false;
    setDismissed(false);
    pick(command);
    return true;
  };
  setTypedChooser(() => chooseTyped);
  onCleanup(() => setTypedChooser(undefined));

  // A command mention in a message was clicked: start that command
  createEffect(() => {
    const request = requestedCommand();
    const id = serverId();
    if (!request || !id) return;
    const loaded = commands();
    if (!loaded) {
      loadCommands(client(), id).catch(() => setRequestedCommand(undefined));
      return;
    }
    setRequestedCommand(undefined);
    const command = everyUsable().find((entry) => entry._id === request.id);
    if (!command) return;
    setDismissed(false);
    pick(command, request.path);
    requestAnimationFrame(() =>
      moveCommandCursor(commandStart(command, request.path).length),
    );
  });

  // Keys go to the picker before the editor while the list is open
  const onKey = (event: KeyboardEvent) => {
    if (!showList()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.(".cm-editor")) return;
    const list = matches();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + list.length) % list.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      const entry = list[active()];
      if (entry) pick(entry.command);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  onCleanup(() => document.removeEventListener("keydown", onKey, true));

  return (
    <>
      <Show when={typedNote()}>
        {(note) => (
          <Panel>
            <List aria-live="polite" data-typed-command={note().state}>
              <EmptyLine>
                <Switch>
                  <Match when={note().state === "loading"}>
                    {t`Loading the commands…`}
                  </Match>
                  <Match when={note().state === "missing"}>
                    {t`No command has this name. Press Enter again to send it as a message.`}
                  </Match>
                  <Match when={note().state === "failed"}>
                    {t`Couldn't load the commands. Press Enter again to send it as a message.`}
                  </Match>
                </Switch>
              </EmptyLine>
            </List>
          </Panel>
        )}
      </Show>
      <Show when={showList()}>
        <Panel>
          <Show when={apps().length > 1}>
            <Rail role="toolbar" aria-label={t`Filter commands by app`}>
              <button
                class={railButton()}
                type="button"
                aria-label={t`All apps`}
                aria-pressed={!appFilter()}
                data-active={!appFilter() ? "" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => filterApp(undefined)}
                use:floating={{
                  tooltip: { placement: "right", content: t`All apps` },
                }}
              >
                <Icon name="squares-four" size={20} />
              </button>
              <For each={apps()}>
                {(app) => (
                  <button
                    class={railButton()}
                    type="button"
                    aria-label={app.display_name ?? app.username}
                    aria-pressed={appFilter() === app._id}
                    data-active={appFilter() === app._id ? "" : undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => filterApp(app._id)}
                    use:floating={{
                      tooltip: {
                        placement: "right",
                        content: app.display_name ?? app.username,
                      },
                    }}
                  >
                    <AppAvatar app={app} size={28} />
                  </button>
                )}
              </For>
            </Rail>
          </Show>
          <List role="listbox" aria-label={t`Commands`}>
            <PanelTitle>
              {appFilter()
                ? (application(appFilter()!)?.display_name ??
                  application(appFilter()!)?.username)
                : t`Commands`}
            </PanelTitle>
            <Show when={matches().length === 0}>
              <EmptyLine>{t`No commands match`}</EmptyLine>
            </Show>
            <For each={matches()}>
              {(entry, index) => (
                <CommandRow
                  role="option"
                  aria-selected={index() === active()}
                  data-active={index() === active() ? "" : undefined}
                  onPointerEnter={() => setActive(index())}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(entry.command)}
                >
                  <AppAvatar app={application(entry.command.application_id)} />
                  <CommandText>
                    <strong>
                      <bdi>/{entry.name}</bdi>
                    </strong>
                    <span>
                      {localized(
                        entry.command.description ?? "",
                        entry.command.description_localizations,
                        locale(),
                      )}
                    </span>
                  </CommandText>
                  <AppName>
                    {application(entry.command.application_id)?.display_name ??
                      application(entry.command.application_id)?.username}
                  </AppName>
                </CommandRow>
              )}
            </For>
          </List>
        </Panel>
      </Show>
      <Show when={chosen()} keyed>
        {(command) => (
          <CommandBar
            command={command}
            channel={props.channel}
            app={application(command.application_id)}
            onDone={() => {
              setChosen(undefined);
              props.setContent("");
            }}
            onCancel={close}
          />
        )}
      </Show>
    </>
  );
}

function AppAvatar(props: { app?: CommandApplication; size?: number }) {
  const client = useClient();
  // the bot user knows its picture, or its default one, so bots are told
  // apart even without an uploaded avatar
  const url = () =>
    props.app
      ? client().users.get(props.app._id)?.animatedAvatarURL
      : undefined;
  return (
    <Avatar
      size={props.size ?? 28}
      src={url()}
      fallback={props.app?.username ?? "?"}
    />
  );
}

type Suggestion = {
  key: string;
  label: string;
  detail?: string;
  insert: string;
};

/**
 * Bar above the message box while a command is filled in: the command, its
 * required options, then the optional ones, and a line about the option the
 * cursor is in. Values are typed in the message box as `name:value`; the
 * panel above suggests values for the current option.
 */
function CommandBar(props: {
  command: ApplicationCommand;
  channel: Channel;
  app?: CommandApplication;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const describeError = useError();
  const client = useClient();
  const instance = useInstance();
  const locale = () => i18n.locale;
  const text = commandEditor.text;
  const cursor = commandEditor.cursor;

  const [error, setError] = createSignal<string>();
  const [sending, setSending] = createSignal(false);
  const [showMissing, setShowMissing] = createSignal(false);
  const [highlight, setHighlight] = createSignal(0);
  const [uploading, setUploading] = createSignal(false);
  // values that are shown as a name but sent as something else
  const uploads = new Map<string, string>();
  const autoValues = new Map<string, string | number>();
  const [autoChoices, setAutoChoices] = createSignal<OptionChoice[]>([]);
  // where the bot's suggestions are: asked, none matched, or no answer
  const [autoState, setAutoState] = createSignal<
    "idle" | "loading" | "empty" | "silent" | "failed"
  >("idle");

  const word = () => `/${label(props.command)}`;

  /** Sub-command words after the command, and where options may start */
  const level = createMemo(() => {
    let options = props.command.options ?? [];
    const path: CommandOption[] = [];
    let end = word().length;
    const words = /\s+(\S+)/y;
    words.lastIndex = end;
    let match: RegExpExecArray | null;
    while ((match = words.exec(text()))) {
      const name = match[1];
      const sub = options.find(
        (o) => SUBCOMMAND_TYPES.includes(o.type) && label(o) === name,
      );
      if (!sub) break;
      path.push(sub);
      options = sub.options ?? [];
      end = words.lastIndex;
    }
    return { path, options, prefix: end + 1 };
  });
  const choosingSub = () =>
    level().options.some((o) => SUBCOMMAND_TYPES.includes(o.type));
  const options = () => (choosingSub() ? [] : level().options);
  const byLabel = createMemo(
    () => new Map(options().map((o) => [label(o), o] as const)),
  );

  const spans = createMemo(() =>
    parseCommandOptions(text(), level().prefix, [...byLabel().keys()]),
  );
  const spanOf = (option: CommandOption) =>
    spans().find((span) => span.name === label(option));
  const here = createMemo(() => spanAtCursor(spans(), cursor()));
  const current = () => (here() ? byLabel().get(here()!.name) : undefined);

  // the editor draws the chips
  createEffect(() =>
    setCommandLayout({
      prefix: level().prefix,
      options: options().map((o) => ({
        name: label(o),
        required: !!o.required,
      })),
      showMissing: showMissing(),
    }),
  );
  onCleanup(() => setCommandLayout(undefined));

  /** Put the cursor in an option, adding `name:` at the end if it is not there */
  function goTo(option: CommandOption) {
    const span = spanOf(option);
    if (span) {
      moveCommandCursor(span.value ? span.valueTo : span.nameEnd);
      return;
    }
    const doc = text();
    const gap = doc.length && !/\s$/.test(doc) ? " " : "";
    editCommandText(doc.length, doc.length, `${gap}${label(option)}:`);
  }

  /** Replace the value of an option */
  function fill(span: OptionSpan, insert: string) {
    const doc = text();
    const from = span.value ? span.valueFrom : span.nameEnd;
    const to = span.value ? span.valueTo : span.nameEnd;
    const next = doc.charAt(to);
    const gap = next && /\s/.test(next) ? "" : " ";
    editCommandText(from, to, insert + gap);
  }

  // ----- suggestions for the option the cursor is in -----

  const members = () =>
    client().serverMembers.filter(
      (member) => member.id.server === props.channel.serverId,
    );
  const roles = () => props.channel.server?.orderedRoles ?? [];

  const suggestions = createMemo<Suggestion[]>(() => {
    const option = current();
    const span = here();
    if (!option || !span) return [];
    const typed = span.value;
    if (
      RE_USER_VALUE.test(typed) ||
      RE_ROLE_VALUE.test(typed) ||
      RE_CHANNEL_VALUE.test(typed)
    ) {
      return [];
    }
    const q = typed.toLocaleLowerCase();
    const has = (...texts: (string | undefined)[]) =>
      !q || texts.some((s) => s?.toLocaleLowerCase().includes(q));

    let list: Suggestion[] = [];
    if (option.choices?.length) {
      list = option.choices.map((choice) => ({
        key: String(choice.value),
        label: label(choice),
        insert: label(choice),
      }));
    } else if (option.autocomplete) {
      // the bot already filtered these; once one is picked the bar closes,
      // so Enter sends the command instead of picking it again
      const auto = autoChoices().map((choice) => ({
        key: String(choice.value),
        label: label(choice),
        insert: label(choice),
      }));
      return q && auto.some((s) => s.insert.toLocaleLowerCase() === q)
        ? []
        : auto;
    } else if (option.type === "Boolean") {
      list = [
        { key: "true", label: t`Yes`, insert: t`Yes` },
        { key: "false", label: t`No`, insert: t`No` },
      ];
    } else if (option.type === "Channel") {
      list = (props.channel.server?.channels ?? [])
        .filter(
          (channel) =>
            channel.havePermission("ViewChannel") &&
            (!option.channel_types?.length ||
              option.channel_types.includes(
                channel.isVoice ? "Voice" : "Text",
              )),
        )
        .map((channel) => ({
          key: channel.id,
          label: `#${channel.name}`,
          insert: `<#${channel.id}>`,
        }));
    } else if (option.type === "User" || option.type === "Mentionable") {
      list = members().map((member) => ({
        key: member.id.user,
        label: member.displayName ?? member.user?.username ?? member.id.user,
        detail: member.user?.username,
        insert: `<@${member.id.user}>`,
      }));
    }
    if (option.type === "Role" || option.type === "Mentionable") {
      list = list.concat(
        roles().map((role) => ({
          key: role.id,
          label: `@${role.name}`,
          insert: `<%${role.id}>`,
        })),
      );
    }

    // a value that is already one of the suggestions is chosen
    if (list.some((s) => s.insert.toLocaleLowerCase() === q && q)) return [];
    return list.filter((s) => has(s.label, s.detail)).slice(0, 12);
  });
  createEffect(on(suggestions, () => setHighlight(0)));

  // Autocomplete: newest request wins, older ones are cancelled
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => [current(), here()?.value] as const,
      ([option, typed]) => {
        clearTimeout(timer);
        controller?.abort();
        if (!option?.autocomplete) {
          setAutoState("idle");
          return setAutoChoices([]);
        }
        setAutoState("loading");
        timer = setTimeout(async () => {
          controller = new AbortController();
          const signal = controller.signal;
          const leaf = collect(true).options.filter(
            (o) => o.name !== option.name,
          );
          leaf.push({
            name: option.name,
            type: option.type,
            value: typed ?? "",
          });
          try {
            const choices = await requestAutocomplete(
              client(),
              props.channel.id,
              props.command,
              wrap(leaf),
              option.name,
              signal,
            );
            if (signal.aborted) return;
            for (const choice of choices) {
              autoValues.set(label(choice), choice.value);
            }
            setAutoChoices(choices);
            setAutoState(choices.length ? "idle" : "empty");
          } catch (error) {
            if (signal.aborted) return;
            setAutoChoices([]);
            setAutoState(
              error instanceof AutocompleteTimeout ? "silent" : "failed",
            );
          }
        }, 250);
      },
    ),
  );
  onCleanup(() => {
    clearTimeout(timer);
    controller?.abort();
  });

  function choose(suggestion: Suggestion) {
    const span = here();
    if (span) fill(span, suggestion.insert);
  }

  // ----- turning the typed text into option values -----

  /** Value of one option from its text, or why it is not valid */
  function resolve(
    option: CommandOption,
    raw: string,
  ): { value?: OptionValue; error?: string } {
    const name = label(option);
    const lower = raw.toLocaleLowerCase();
    if (option.choices?.length) {
      const choice = option.choices.find(
        (c) =>
          label(c).toLocaleLowerCase() === lower || String(c.value) === raw,
      );
      return choice
        ? { value: choice.value }
        : { error: t`Choose one of the listed values for "${name}".` };
    }
    if (option.autocomplete && autoValues.has(raw)) {
      return { value: autoValues.get(raw) };
    }
    const byName = <T,>(
      items: T[],
      names: (item: T) => (string | undefined)[],
    ) =>
      items.find((item) =>
        names(item).some(
          (n) => n?.toLocaleLowerCase() === lower.replace(/^[@#]/, ""),
        ),
      );
    switch (option.type) {
      case "Integer":
      case "Number": {
        const number = Number(raw.replace(",", "."));
        if (
          !Number.isFinite(number) ||
          (option.type === "Integer" && !Number.isInteger(number))
        ) {
          return { error: t`"${name}" needs a number.` };
        }
        return { value: number };
      }
      case "Boolean": {
        if ([t`Yes`.toLocaleLowerCase(), "true", "yes"].includes(lower)) {
          return { value: true };
        }
        if ([t`No`.toLocaleLowerCase(), "false", "no"].includes(lower)) {
          return { value: false };
        }
        return { error: t`Choose one of the listed values for "${name}".` };
      }
      case "User":
      case "Role":
      case "Mentionable":
      case "Channel": {
        const id =
          (option.type !== "Role" && option.type !== "Channel"
            ? RE_USER_VALUE.exec(raw)?.[1]
            : undefined) ??
          (option.type === "Role" || option.type === "Mentionable"
            ? RE_ROLE_VALUE.exec(raw)?.[1]
            : undefined) ??
          (option.type === "Channel"
            ? RE_CHANNEL_VALUE.exec(raw)?.[1]
            : undefined) ??
          (option.type === "Channel"
            ? byName(props.channel.server?.channels ?? [], (c) => [c.name])?.id
            : undefined) ??
          (option.type === "User" || option.type === "Mentionable"
            ? byName(members(), (m) => [m.displayName, m.user?.username])?.id
                .user
            : undefined) ??
          (option.type === "Role" || option.type === "Mentionable"
            ? byName(roles(), (r) => [r.name])?.id
            : undefined);
        return id
          ? { value: id }
          : { error: t`Choose "${name}" from the list.` };
      }
      case "Attachment": {
        const id = uploads.get(raw);
        return id ? { value: id } : { error: t`Upload a file for "${name}".` };
      }
      default:
        return { value: raw };
    }
  }

  /** All options with values; `lenient` skips what is missing or invalid */
  function collect(lenient = false): {
    options: DataOption[];
    error?: string;
    option?: CommandOption;
  } {
    const leaf: DataOption[] = [];
    for (const option of options()) {
      const raw = spanOf(option)?.value ?? "";
      if (!raw) {
        if (option.required && !lenient) {
          return { options: [], error: t`Fill in "${label(option)}".`, option };
        }
        continue;
      }
      const result = resolve(option, raw);
      if (result.error) {
        if (lenient) continue;
        return { options: [], error: result.error, option };
      }
      leaf.push({ name: option.name, type: option.type, value: result.value });
    }
    return { options: leaf };
  }

  /** Wrap option values in the chosen sub-command and group */
  function wrap(leaf: DataOption[]): DataOption[] {
    let wrapped = leaf;
    for (const sub of [...level().path].reverse()) {
      wrapped = [{ name: sub.name, type: sub.type, options: wrapped }];
    }
    return wrapped;
  }

  async function run() {
    if (sending()) return;
    if (choosingSub()) {
      setError(t`Choose a sub-command first.`);
      return;
    }
    const result = collect();
    if (result.error) {
      setShowMissing(true);
      setError(result.error);
      if (result.option) goTo(result.option);
      return;
    }
    setSending(true);
    setError(undefined);
    try {
      await runCommand(
        client(),
        props.channel.id,
        props.command,
        wrap(result.options),
      );
      props.onDone();
    } catch (err) {
      setSending(false);
      setError(
        err instanceof InteractionError && err.type === "FailedValidation"
          ? describeError(err)
          : t`The command could not be used.`,
      );
    }
  }
  setActiveRun(() => run);
  onCleanup(() => setActiveRun(undefined));
  createEffect(on(text, () => setError(undefined), { defer: true }));

  async function upload(file: File | undefined) {
    const span = here();
    if (!file || !span) return;
    setUploading(true);
    setError(undefined);
    try {
      const id = await client().uploadFile(
        "attachments",
        file,
        instance.mediaUrl,
      );
      uploads.set(file.name, id);
      fill(span, file.name);
    } catch {
      setError(t`The file could not be uploaded. It may be too large.`);
    } finally {
      setUploading(false);
    }
  }

  function chooseSub(sub: CommandOption) {
    const path = [...level().path.map(label), label(sub)];
    const start = commandStart(props.command, path);
    editCommandText(0, text().length, start);
  }

  // Keys while the bar is shown: arrows and Enter/Tab pick a suggestion,
  // Tab moves to the next option, Escape closes the bar
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest?.(".cm-editor") || event.isComposing) return;
    const list = suggestions();
    const stop = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (list.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      stop();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((i) => (i + delta + list.length) % list.length);
    } else if (list.length && (event.key === "Enter" || event.key === "Tab")) {
      stop();
      choose(list[highlight()] ?? list[0]);
    } else if (event.key === "Tab" && options().length) {
      stop();
      const all = options();
      const index = current() ? all.indexOf(current()!) : -1;
      const step = event.shiftKey ? -1 : 1;
      const next =
        index === -1
          ? (all.find((o) => o.required && !spanOf(o)?.value) ?? all[0])
          : all[(index + step + all.length) % all.length];
      goTo(next);
    } else if (event.key === "Escape") {
      stop();
      props.onCancel();
    }
  };
  document.addEventListener("keydown", onKey, true);
  onCleanup(() => document.removeEventListener("keydown", onKey, true));

  const required = () => options().filter((o) => o.required);
  const optional = () => options().filter((o) => !o.required);
  const describe = (item?: {
    description?: string;
    description_localizations?: Localizations;
  }) =>
    item?.description
      ? localized(item.description, item.description_localizations, locale())
      : "";

  const Chips = (chipProps: { list: CommandOption[] }) => (
    <For each={chipProps.list}>
      {(option) => (
        <Chip
          type="button"
          data-active={current() === option ? "" : undefined}
          data-filled={spanOf(option)?.value ? "" : undefined}
          data-missing={
            showMissing() && option.required && !spanOf(option)?.value
              ? ""
              : undefined
          }
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => goTo(option)}
        >
          <bdi>{label(option)}</bdi>
        </Chip>
      )}
    </For>
  );

  return (
    <Wrap>
      <Show when={choosingSub()}>
        <Stack role="listbox" aria-label={t`Choose a sub-command`}>
          <PanelTitle>{t`Choose a sub-command`}</PanelTitle>
          <For each={level().options}>
            {(sub) => (
              <CommandRow
                role="option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chooseSub(sub)}
              >
                <CommandText>
                  <strong>
                    <bdi>{label(sub)}</bdi>
                  </strong>
                  <span>{describe(sub)}</span>
                </CommandText>
              </CommandRow>
            )}
          </For>
        </Stack>
      </Show>

      <Show
        when={
          current()?.autocomplete &&
          !suggestions().length &&
          autoState() !== "idle"
        }
      >
        <Stack aria-live="polite" data-autocomplete-state={autoState()}>
          <PanelTitle>
            <bdi>{current() ? label(current()!) : ""}</bdi>
          </PanelTitle>
          <EmptyLine>
            <Switch>
              <Match when={autoState() === "loading"}>
                {t`Asking the bot for suggestions…`}
              </Match>
              <Match when={autoState() === "empty"}>
                {t`No suggestions match. You can still type a value.`}
              </Match>
              <Match when={autoState() === "silent"}>
                {t`The bot did not answer. Type a value yourself.`}
              </Match>
              <Match when={autoState() === "failed"}>
                {t`Couldn't get suggestions. Type a value yourself.`}
              </Match>
            </Switch>
          </EmptyLine>
        </Stack>
      </Show>

      <Show when={suggestions().length}>
        <Stack role="listbox" aria-label={current() ? label(current()!) : ""}>
          <PanelTitle>
            <bdi>{current() ? label(current()!) : ""}</bdi>
          </PanelTitle>
          <For each={suggestions()}>
            {(suggestion, index) => (
              <CommandRow
                role="option"
                aria-selected={index() === highlight()}
                data-active={index() === highlight() ? "" : undefined}
                onPointerEnter={() => setHighlight(index())}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(suggestion)}
              >
                <CommandText>
                  <strong>
                    <bdi>{suggestion.label}</bdi>
                  </strong>
                  <Show when={suggestion.detail}>
                    <span>{suggestion.detail}</span>
                  </Show>
                </CommandText>
              </CommandRow>
            )}
          </For>
        </Stack>
      </Show>

      <Show when={current()?.type === "Attachment"}>
        <Panel>
          <FileRow>
            <FileButton
              onMouseDown={(e) => e.preventDefault()}
              data-busy={uploading() ? "" : undefined}
            >
              {uploading() ? t`Uploading…` : t`Choose a file`}
              <input
                type="file"
                hidden
                disabled={uploading()}
                onChange={(e) => {
                  upload(e.currentTarget.files?.[0]);
                  e.currentTarget.value = "";
                }}
              />
            </FileButton>
            <Show when={here()?.value}>
              <span>
                <bdi>{here()!.value}</bdi>
              </span>
            </Show>
          </FileRow>
        </Panel>
      </Show>

      <Bar aria-label={t`Command options`}>
        <BarRow>
          <AppAvatar app={props.app} size={24} />
          <CommandName>
            <bdi>
              {word()}
              <For each={level().path}>{(sub) => <> {label(sub)}</>}</For>
            </bdi>
          </CommandName>
          <Show when={required().length}>
            <Chips list={required()} />
          </Show>
          <Show when={optional().length}>
            <Divider aria-hidden="true" />
            <Muted>{t`optional`}</Muted>
            <Chips list={optional()} />
          </Show>
        </BarRow>
        <BarInfo>
          <Show
            when={error()}
            fallback={
              <span>
                {sending()
                  ? t`Sending…`
                  : describe(current()) || describe(props.command)}
              </span>
            }
          >
            <FormError role="alert">{error()}</FormError>
          </Show>
          <TextButton
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={props.onCancel}
          >
            {t`Cancel`}
          </TextButton>
        </BarInfo>
      </Bar>
    </Wrap>
  );
}

const Wrap = styled("div", {
  base: { display: "flex", flexDirection: "column" },
});

/** Same dock chrome as the message box / account panel below */
const surface = {
  marginInline: 0,
  marginBlockEnd: "var(--z-dock-gap, 8px)",
  borderRadius: "var(--z-dock-radius, 12px)",
  border: "1px solid var(--z-dock-border)",
  boxShadow: "var(--z-dock-lift)",
  background: "var(--z-dock-bg)",
  // the channel's column is tight: without this the list shrinks below its rows
  flexShrink: 0,
} as const;

const Panel = styled("div", {
  base: {
    ...surface,
    display: "flex",
    maxHeight: "min(320px, 50vh)",
    overflow: "hidden",
  },
});

/** One column of rows: sub-commands and option suggestions */
const Stack = styled("div", {
  base: {
    ...surface,
    display: "flex",
    flexDirection: "column",
    maxHeight: "min(320px, 50vh)",
    overflowY: "auto",
    padding: "6px",
  },
});

/** Bots with commands here; one tap shows only that bot's commands */
const Rail = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
    padding: "6px",
    overflowY: "auto",
    borderInlineEnd: "1px solid var(--z-border-subtle)",
  },
});

const railButton = cva({
  base: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    padding: 0,
    border: "none",
    borderRadius: "10px",
    background: "transparent",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-fg-muted)",
    cursor: "pointer",
    "&:hover": { background: "var(--z-nav-hover)" },
    "&[data-active]": {
      background: "var(--z-nav-selected)",
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-fg-primary)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "1px",
    },
    _phone: { width: "44px", height: "44px" },
  },
});

const List = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    padding: "6px",
  },
});

const EmptyLine = styled("div", {
  base: {
    paddingInline: "8px",
    paddingBlock: "8px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
  },
});

const PanelTitle = styled("div", {
  base: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-muted)",
    paddingInline: "8px",
    paddingBlock: "4px",
  },
});

const CommandRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 8px",
    borderRadius: "6px",
    cursor: "pointer",
    flexShrink: 0,
    "&:hover, &[data-active]": { background: "var(--z-nav-hover)" },
  },
});

const CommandText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    flex: 1,
    color: "var(--z-fg-primary)",
    "& span": {
      color: "var(--z-fg-muted)",
      fontSize: "13px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const AppName = styled("span", {
  base: { color: "var(--z-fg-muted)", fontSize: "12px", flexShrink: 0 },
});

const Bar = styled("div", {
  base: {
    ...surface,
    overflow: "hidden",
  },
});

const BarRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  },
});

const CommandName = styled("strong", {
  base: {
    color: "var(--z-fg-primary)",
    fontSize: "15px",
    whiteSpace: "nowrap",
    paddingInlineEnd: "4px",
  },
});

const Chip = styled("button", {
  base: {
    flexShrink: 0,
    minHeight: "32px",
    paddingInline: "12px",
    borderRadius: "8px",
    border: "none",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background 120ms ease, color 120ms ease",
    _hover: { color: "var(--z-fg-primary)" },
    "&[data-filled]": { color: "var(--z-fg-primary)" },
    "&[data-missing]": { color: "var(--z-danger)" },
    "&[data-active]": {
      background: "var(--z-btn-primary-bg)",
      color: "var(--z-on-accent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Divider = styled("span", {
  base: {
    flexShrink: 0,
    width: "1px",
    alignSelf: "stretch",
    marginInline: "4px",
    background: "var(--z-border-subtle)",
  },
});

const Muted = styled("span", {
  base: {
    flexShrink: 0,
    color: "var(--z-fg-muted)",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
});

const BarInfo = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    borderTop: "1px solid var(--z-border-subtle)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    "& > span, & > div": { flex: 1, minWidth: 0 },
  },
});

const FileRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "4px",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    "& > span": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
});

const FileButton = styled("label", {
  base: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    minHeight: "32px",
    paddingInline: "14px",
    borderRadius: "var(--z-radius, 8px)",
    background: "var(--z-btn-primary-bg)",
    color: "var(--z-on-accent)",
    fontWeight: 600,
    cursor: "pointer",
    "&[data-busy]": { opacity: 0.7, cursor: "progress" },
    _focusWithin: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
  },
});

const TextButton = styled("button", {
  base: {
    flexShrink: 0,
    background: "none",
    border: "none",
    color: "var(--z-accent-text)",
    cursor: "pointer",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const FormError = styled("div", {
  base: { color: "var(--z-danger)", fontSize: "13px" },
});
