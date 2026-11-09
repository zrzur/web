import {
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
import {
  Button,
  Checkbox,
  FloatingSelect,
  MenuItem,
  Segmented,
  TextField,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type ChannelType,
  type CommandData,
  type CommandDraft,
  type CommandType,
  type OptionDraft,
  type OptionType,
  type Problem,
  type RegisteredCommand,
  FORM_LOCALES,
  LIMITS,
  ListChangedError,
  OPTION_TYPES,
  blankChoice,
  blankCommand,
  blankOption,
  clip,
  exportCommands,
  fromCommand,
  hasPermission,
  isNumeric,
  isSubcommand,
  parseCommandList,
  rawData,
  signatureOf,
  takesChoices,
  toData,
  togglePermission,
  validateCommandSet,
} from "./commandForm";

/**
 * Text typed into a field, cut at `max` characters as the server counts
 * them (a native maxlength counts UTF-16 units and splits an emoji)
 */
function clipInput(event: { currentTarget: HTMLInputElement }, max: number) {
  const value = clip(event.currentTarget.value, max);
  if (value !== event.currentTarget.value) event.currentTarget.value = value;
  return value;
}

export type PermissionNames = readonly (readonly [number, string])[];

/**
 * The Commands tab of an application: the bot's global commands as a list,
 * a form to add or change one (options, choices, names in ar/en/de, who may
 * use it, menu commands) with a preview, and JSON import and export for
 * those who keep their commands in a file.
 *
 * Saving sends the whole list with `PUT`, as a bot does at start-up, so the
 * server checks the set at once; deleting uses the command's own route.
 */
export function CommandManager(props: {
  commands: RegisteredCommand[] | undefined;
  permissionNames: PermissionNames;
  save: (commands: CommandData[]) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /** The server's list now, read right before a save */
  reload: () => Promise<RegisteredCommand[]>;
  docsLink?: JSX.Element;
}) {
  const { t } = useLingui();
  const [editing, setEditing] = createSignal<CommandDraft>();
  const [notice, setNotice] = createSignal<string>();
  const [error, setError] = createSignal<unknown>();
  const [confirming, setConfirming] = createSignal<string>();

  const list = () => props.commands ?? [];
  const count = (type: CommandType) =>
    list().filter((command) => (command.type ?? "ChatInput") === type).length;

  /**
   * Save only if nobody changed the list since `baseline` was read (the
   * bot itself at start-up, another tab): otherwise their change would be
   * overwritten without a word
   */
  async function saveChecked(list: CommandData[], baseline: string) {
    const fresh = await props.reload();
    const now = signatureOf(fresh);
    if (now !== baseline) throw new ListChangedError(now);
    await props.save(list);
  }

  function open(draft: CommandDraft) {
    setNotice(undefined);
    setError(undefined);
    setEditing(draft);
  }

  async function remove(command: RegisteredCommand) {
    if (confirming() !== command._id) {
      setConfirming(command._id);
      return;
    }
    setConfirming(undefined);
    setError(undefined);
    try {
      await props.remove(command._id);
      setNotice(t`Command deleted.`);
    } catch (err) {
      setError(err);
    }
  }

  return (
    <Root>
      <Show
        when={editing()}
        fallback={
          <>
            <Head>
              <div>
                <h3>
                  <Trans>Commands</Trans>
                </h3>
                <Muted>
                  {t`${count("ChatInput")} of ${LIMITS.chatInput} slash commands · ${count("User") + count("Message")} menu commands`}
                </Muted>
              </div>
              <Button
                size="sm"
                variant="filled"
                onPress={() => open(blankCommand())}
              >
                <Icon name="plus" size={16} />
                <Trans>New command</Trans>
              </Button>
            </Head>
            <Muted>
              <Trans>
                If your bot sends its list when it starts, that list replaces
                what you save here.
              </Trans>
            </Muted>
            {props.docsLink}
            <Show when={notice()}>
              <Notice role="status">{notice()}</Notice>
            </Show>
            <Show when={error()}>
              <ErrorBox role="alert">
                <TranslatedError error={error()} />
              </ErrorBox>
            </Show>
            <Switch>
              <Match when={props.commands === undefined}>
                <Muted>
                  <Trans>Loading…</Trans>
                </Muted>
              </Match>
              <Match when={!list().length}>
                <Empty>
                  <Trans>
                    No commands yet. Add one here, or let your bot register its
                    list when it starts.
                  </Trans>
                </Empty>
              </Match>
              <Match when={list().length}>
                <Cards>
                  <For each={list()}>
                    {(command) => (
                      <CommandCard
                        command={command}
                        confirming={confirming() === command._id}
                        onEdit={() => open(fromCommand(command))}
                        onDelete={() => void remove(command)}
                      />
                    )}
                  </For>
                </Cards>
              </Match>
            </Switch>
            <JsonTools
              commands={list()}
              onImport={async (commands, baseline) => {
                await saveChecked(commands, baseline);
                setNotice(t`Commands imported and saved.`);
              }}
            />
          </>
        }
      >
        {(draft) => (
          <CommandEditor
            initial={draft()}
            others={list()}
            permissionNames={props.permissionNames}
            onCancel={() => setEditing(undefined)}
            onSave={async (commands, baseline) => {
              await saveChecked(commands, baseline);
              setEditing(undefined);
              setNotice(t`Saved. People see the change at once.`);
            }}
          />
        )}
      </Show>
    </Root>
  );
}

/** Names of the option types, in the form's words */
function useOptionTypeNames(): Record<OptionType, string> {
  const { t } = useLingui();
  return {
    String: t`Text`,
    Integer: t`Whole number`,
    Number: t`Number`,
    Boolean: t`Yes or no`,
    User: t`User`,
    Role: t`Role`,
    Channel: t`Channel`,
    Mentionable: t`User or role`,
    Attachment: t`File`,
    SubCommand: t`Sub-command`,
    SubCommandGroup: t`Sub-command group`,
  };
}

function useCommandTypeNames(): Record<CommandType, string> {
  const { t } = useLingui();
  return {
    ChatInput: t`Slash command`,
    User: t`User menu`,
    Message: t`Message menu`,
  };
}

/** A problem in plain words */
export function useProblemText() {
  const { t } = useLingui();
  return (problem: Problem) => {
    const max = problem.max ?? 0;
    switch (problem.rule) {
      case "nameLength":
      case "descriptionLength":
      case "choiceNameLength":
      case "choiceValueLength":
        return t`Use 1 to ${max} characters.`;
      case "nameChars":
        return t`Use lowercase letters, digits, - and _ only, without spaces.`;
      case "menuNameSpaces":
        return t`No spaces at the start or the end.`;
      case "controlChars":
        return t`Remove the hidden control characters.`;
      case "tooManyLocalizations":
        return t`At most ${max} languages.`;
      case "badLocale":
        return t`A language tag is not valid.`;
      case "subcommandExtras":
        return t`A sub-command takes only a name, a description and options.`;
      case "groupNotTop":
        return t`Groups can only be at the top level.`;
      case "groupEmpty":
        return t`A group needs at least one sub-command.`;
      case "groupOnlySubcommands":
        return t`A group holds only sub-commands.`;
      case "subcommandTooDeep":
        return t`Sub-commands go at most one group deep.`;
      case "subcommandNested":
        return t`A sub-command cannot hold sub-commands.`;
      case "optionsOnlyForSubcommands":
        return t`Only sub-commands and groups hold options.`;
      case "choicesNotAllowed":
        return t`Only text and number options take choices.`;
      case "choicesAndAutocomplete":
        return t`Use choices or suggestions while typing, not both.`;
      case "choiceCount":
        return t`Give 1 to ${max} choices.`;
      case "duplicateChoice":
        return t`Two choices have this name.`;
      case "choiceValueType":
        return t`The value must fit the option type.`;
      case "autocompleteNotAllowed":
        return t`Only text and number options can suggest while typing.`;
      case "minMaxType":
      case "lengthType":
      case "channelTypesType":
        return t`This option type has no such limit.`;
      case "bound":
        return t`Enter a number between -9007199254740991 and 9007199254740991.`;
      case "boundWhole":
        return t`Enter a whole number.`;
      case "minAboveMax":
        return t`The minimum is larger than the maximum.`;
      case "lengthRange":
        return t`Lengths go from 0 to ${max}, and the minimum is not above the maximum.`;
      case "channelTypes":
        return t`Pick each channel type once.`;
      case "tooManyOptions":
        return t`At most ${max} options on each level.`;
      case "mixedSubcommands":
        return t`Sub-commands and plain options cannot be mixed on one level.`;
      case "duplicateOption":
        return t`Two options have this name.`;
      case "requiredAfterOptional":
        return t`Required options come before optional ones.`;
      case "menuNoDescription":
      case "menuNoOptions":
        return t`Menu commands have no description and no options.`;
      case "totalCharacters":
        return t`All names, descriptions and choices together have more than ${max} characters.`;
      case "negativePermissions":
        return t`Pick the permissions from the list.`;
      case "duplicateCommand":
        return t`A command of this type already has this name.`;
      case "badShape":
        return t`This entry has a field of the wrong type.`;
      case "tooManyCommands":
        return t`At most ${max} commands of this type.`;
    }
  };
}

function CommandCard(props: {
  command: RegisteredCommand;
  confirming: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLingui();
  const types = useCommandTypeNames();
  const type = () => props.command.type ?? "ChatInput";
  return (
    <Card data-testid="command-card">
      <CardText>
        <strong dir="auto">
          <bdi>
            {type() === "ChatInput"
              ? `/${props.command.name}`
              : props.command.name}
          </bdi>
        </strong>
        <Muted>
          {types[type()]}
          <Show when={props.command.options?.length}>
            {" · "}
            {t`${props.command.options!.length} options`}
          </Show>
          <Show when={props.command.default_member_permissions}>
            {" · "}
            <Trans>Limited by permissions</Trans>
          </Show>
        </Muted>
        <Show when={props.command.description}>
          <span dir="auto">{props.command.description}</span>
        </Show>
      </CardText>
      <CardActions>
        <Button size="sm" variant="tonal" onPress={props.onEdit}>
          <Trans>Edit</Trans>
        </Button>
        <Button size="sm" variant="_error" onPress={props.onDelete}>
          {props.confirming ? t`Confirm delete` : t`Delete`}
        </Button>
      </CardActions>
    </Card>
  );
}

/** Where an option sits: its index on each level */
type Path = number[];

function optionAt(draft: CommandDraft, path: Path): OptionDraft {
  let list = draft.options;
  let option = list[path[0]];
  for (const index of path.slice(1)) {
    list = option.options;
    option = list[index];
  }
  return option;
}

function listAt(draft: CommandDraft, parent: Path): OptionDraft[] {
  return parent.length ? optionAt(draft, parent).options : draft.options;
}

function CommandEditor(props: {
  initial: CommandDraft;
  others: RegisteredCommand[];
  permissionNames: PermissionNames;
  onCancel: () => void;
  onSave: (commands: CommandData[], baseline: string) => Promise<void>;
}) {
  const { t } = useLingui();
  const types = useCommandTypeNames();
  const problemText = useProblemText();
  // the editor starts from a copy of the command
  // what the command was when the editor opened, to tell if it changed
  // eslint-disable-next-line solid/reactivity -- read once, on purpose
  const opened = JSON.stringify(toData(props.initial));
  const [draft, setDraft] = createStore<CommandDraft>(props.initial);
  const dirty = () => JSON.stringify(toData(draft)) !== opened;
  // Esc on a changed command asks first; a second Esc leaves
  const [leaving, setLeaving] = createSignal(false);
  const [tried, setTried] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  // the list as it was when the editor opened; a save checks it first
  // eslint-disable-next-line solid/reactivity -- read once, on purpose
  const [baseline, setBaseline] = createSignal(signatureOf(props.others));
  const [changed, setChanged] = createSignal(false);

  /** The whole list as it would be saved, this command in its place */
  const nextList = createMemo(() => {
    const mine = toData(draft);
    // commands nobody edits go back exactly as the server has them
    const others = props.others.filter((c) => c._id !== draft.id).map(rawData);
    const at = props.others.findIndex((c) => c._id === draft.id);
    const list = [...others];
    list.splice(at === -1 ? list.length : at, 0, mine);
    return { list, index: at === -1 ? list.length - 1 : at };
  });

  /** Problems of this command, with paths inside it */
  const problems = createMemo(() => {
    const { list, index } = nextList();
    const prefix = `${index}.`;
    return validateCommandSet(list)
      .filter((p) => p.path === `${index}` || p.path.startsWith(prefix))
      .map((p) => ({
        ...p,
        path: p.path === `${index}` ? "" : p.path.slice(prefix.length),
      }));
  });

  /** Problems in other commands block saving too (rare: a bot's own list) */
  const otherProblems = createMemo(() => {
    const { list, index } = nextList();
    return validateCommandSet(list).filter(
      (p) => p.path !== `${index}` && !p.path.startsWith(`${index}.`),
    );
  });

  const errorAt = (path: string) =>
    tried()
      ? problems()
          .filter((p) => p.path === path)
          .map(problemText)
          .join(" ") || undefined
      : undefined;

  async function save() {
    setTried(true);
    setError(undefined);
    if (problems().length || otherProblems().length || busy()) return;
    setBusy(true);
    setChanged(false);
    try {
      await props.onSave(nextList().list, baseline());
    } catch (err) {
      if (err instanceof ListChangedError) {
        // reloaded: the next save checks against what is there now
        setBaseline(err.signature);
        setChanged(true);
      } else setError(err);
    } finally {
      setBusy(false);
    }
  }

  const edit = (path: Path, change: (option: OptionDraft) => void) =>
    setDraft(produce((d) => change(optionAt(d, path))));
  const editList = (parent: Path, change: (list: OptionDraft[]) => void) =>
    setDraft(produce((d) => change(listAt(d, parent))));

  return (
    <Editor
      aria-label={t`Edit command`}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void save();
        } else if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          if (dirty() && !leaving()) setLeaving(true);
          else props.onCancel();
        } else if (event.key !== "Shift") setLeaving(false);
      }}
    >
      <Head>
        <h3>{draft.id ? t`Edit command` : t`New command`}</h3>
        <Muted>
          <Trans>Ctrl+Enter saves · Esc goes back</Trans>
        </Muted>
      </Head>

      <Columns>
        <FormColumn>
          <Show
            when={!draft.id}
            fallback={
              <Muted>
                {t`Type: ${types[draft.type]}. The type of a saved command cannot change.`}
              </Muted>
            }
          >
            <Group>
              <legend>{t`Type`}</legend>
              <Segmented<CommandType>
                aria-label={t`Type`}
                value={draft.type}
                onChange={(type) => setDraft("type", type)}
                options={[
                  { value: "ChatInput", label: types.ChatInput },
                  { value: "User", label: types.User },
                  { value: "Message", label: types.Message },
                ]}
              />
              <Muted>
                {draft.type === "ChatInput"
                  ? t`People type it after / in a server channel.`
                  : draft.type === "User"
                    ? t`Shown in the menu of a member, under Apps.`
                    : t`Shown in the menu of a message, under Apps.`}
              </Muted>
            </Group>
          </Show>

          <TextField
            label={t`Name`}
            value={draft.name}
            autoFocus
            onInput={(e) => setDraft("name", clipInput(e, LIMITS.name))}
            error={errorAt("name")}
            helper={
              draft.type === "ChatInput"
                ? t`Lowercase letters of any script, digits, - and _.`
                : t`Capitals and spaces are allowed.`
            }
          />
          <Show when={draft.type === "ChatInput"}>
            <TextField
              label={t`Description`}
              value={draft.description}
              onInput={(e) =>
                setDraft("description", clipInput(e, LIMITS.description))
              }
              error={errorAt("description")}
            />
          </Show>

          <Localized
            names={draft.name_localizations}
            descriptions={
              draft.type === "ChatInput"
                ? draft.description_localizations
                : undefined
            }
            onName={(locale, value) =>
              setDraft("name_localizations", locale, value)
            }
            onDescription={(locale, value) =>
              setDraft("description_localizations", locale, value)
            }
            errorAt={(field, locale) => errorAt(`${field}.${locale}`)}
          />

          <Show when={draft.type === "ChatInput"}>
            <Section>
              <SectionHead>
                <h4>
                  <Trans>Options</Trans>
                </h4>
                <Muted>{t`${draft.options.length} of ${LIMITS.options}`}</Muted>
              </SectionHead>
              <Show when={errorAt("options")}>
                {(text) => <FieldError>{text()}</FieldError>}
              </Show>
              <OptionList
                options={draft.options}
                parent={[]}
                depth={0}
                errorAt={errorAt}
                edit={edit}
                editList={editList}
              />
            </Section>
          </Show>

          <Section>
            <SectionHead>
              <h4>
                <Trans>Who can use it</Trans>
              </h4>
            </SectionHead>
            <Muted>
              {draft.default_member_permissions
                ? t`Only members with all the permissions picked below see and use it. Your bot should still check them.`
                : t`Everyone who can write in the channel. Pick permissions to limit it.`}
            </Muted>
            <Permissions
              role="group"
              aria-label={t`Default member permissions`}
            >
              <For each={props.permissionNames}>
                {([bit, name]) => (
                  <Checkbox
                    checked={hasPermission(
                      draft.default_member_permissions,
                      bit,
                    )}
                    onChange={() =>
                      setDraft(
                        "default_member_permissions",
                        togglePermission(draft.default_member_permissions, bit),
                      )
                    }
                  >
                    {name}
                  </Checkbox>
                )}
              </For>
            </Permissions>
            <Checkbox
              checked={draft.nsfw}
              onChange={(e) => setDraft("nsfw", e.currentTarget.checked)}
            >
              <Trans>Only in channels marked for adults</Trans>
            </Checkbox>
          </Section>
        </FormColumn>

        <Preview draft={draft} />
      </Columns>

      <Show when={tried() && (problems().length || otherProblems().length)}>
        <ErrorBox role="alert">
          <strong>
            <Trans>Fix these before saving:</Trans>
          </strong>
          <ul>
            <For each={[...problems(), ...otherProblems()]}>
              {(problem) => <li>{problemText(problem)}</li>}
            </For>
          </ul>
        </ErrorBox>
      </Show>
      <Show when={leaving()}>
        <ErrorBox role="alert">
          <Trans>Press Esc again to discard your changes.</Trans>
        </ErrorBox>
      </Show>
      <Show when={changed()}>
        <ErrorBox role="alert">
          <Trans>
            The list changed since you opened it. It was reloaded: check it and
            save again.
          </Trans>
        </ErrorBox>
      </Show>
      <Show when={error()}>
        <ErrorBox role="alert">
          <TranslatedError error={error()} />
        </ErrorBox>
      </Show>

      <Actions>
        <Button size="sm" variant="tonal" onPress={props.onCancel}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          size="sm"
          variant="filled"
          isDisabled={busy()}
          onPress={() => void save()}
        >
          {busy() ? t`Saving…` : t`Save command`}
        </Button>
      </Actions>
    </Editor>
  );
}

/** Names (and descriptions) in Arabic, English and German */
function Localized(props: {
  names: Record<string, string>;
  descriptions?: Record<string, string>;
  onName: (locale: string, value: string) => void;
  onDescription: (locale: string, value: string) => void;
  errorAt: (
    field: "name_localizations" | "description_localizations",
    locale: string,
  ) => string | undefined;
}) {
  const { t } = useLingui();
  const languages = (): Record<string, string> => ({
    ar: t`Arabic`,
    en: t`English`,
    de: t`German`,
  });
  return (
    <Disclosure>
      <summary>
        <Trans>Names in other languages</Trans>
      </summary>
      <Muted>
        <Trans>
          People see the name in their language. Your bot always gets the main
          name.
        </Trans>
      </Muted>
      <For each={FORM_LOCALES}>
        {(locale) => (
          <LocaleRow lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
            <TextField
              label={`${languages()[locale]}: ${t`name`}`}
              value={props.names[locale] ?? ""}
              onInput={(e) => props.onName(locale, clipInput(e, LIMITS.name))}
              error={props.errorAt("name_localizations", locale)}
            />
            <Show when={props.descriptions}>
              {(descriptions) => (
                <TextField
                  label={`${languages()[locale]}: ${t`description`}`}
                  value={descriptions()[locale] ?? ""}
                  onInput={(e) =>
                    props.onDescription(
                      locale,
                      clipInput(e, LIMITS.description),
                    )
                  }
                  error={props.errorAt("description_localizations", locale)}
                />
              )}
            </Show>
          </LocaleRow>
        )}
      </For>
    </Disclosure>
  );
}

function OptionList(props: {
  options: OptionDraft[];
  parent: Path;
  /** Type of the option these sit in, none at the top level */
  parentType?: OptionType;
  depth: number;
  errorAt: (path: string) => string | undefined;
  edit: (path: Path, change: (option: OptionDraft) => void) => void;
  editList: (parent: Path, change: (list: OptionDraft[]) => void) => void;
}) {
  const { t } = useLingui();
  const prefix = () =>
    props.parent.length
      ? `options.${props.parent.join(".options.")}.options`
      : "options";
  // a group holds only sub-commands, a sub-command no sub-commands
  const allowed = (): OptionType[] =>
    props.parentType === "SubCommandGroup"
      ? ["SubCommand"]
      : props.parentType === "SubCommand"
        ? OPTION_TYPES.filter((type) => !isSubcommand(type))
        : OPTION_TYPES;
  return (
    <>
      <For each={props.options}>
        {(option, index) => (
          <OptionEditor
            option={option}
            path={[...props.parent, index()]}
            at={`${prefix()}.${index()}`}
            depth={props.depth}
            first={index() === 0}
            last={index() === props.options.length - 1}
            allowed={allowed()}
            errorAt={props.errorAt}
            edit={props.edit}
            editList={props.editList}
            onMove={(delta) =>
              props.editList(props.parent, (list) => {
                const [moved] = list.splice(index(), 1);
                list.splice(index() + delta, 0, moved);
              })
            }
            onRemove={() =>
              props.editList(props.parent, (list) => {
                list.splice(index(), 1);
              })
            }
          />
        )}
      </For>
      <Show when={props.options.length < LIMITS.options}>
        <div>
          <Button
            size="sm"
            variant="tonal"
            onPress={() =>
              props.editList(props.parent, (list) => {
                list.push(blankOption(allowed()[0]));
              })
            }
          >
            <Icon name="plus" size={16} />
            {t`Add option`}
          </Button>
        </div>
      </Show>
    </>
  );
}

function OptionEditor(props: {
  option: OptionDraft;
  path: Path;
  at: string;
  depth: number;
  first: boolean;
  last: boolean;
  allowed: OptionType[];
  errorAt: (path: string) => string | undefined;
  edit: (path: Path, change: (option: OptionDraft) => void) => void;
  editList: (parent: Path, change: (list: OptionDraft[]) => void) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLingui();
  const names = useOptionTypeNames();
  const set = (change: (option: OptionDraft) => void) =>
    props.edit(props.path, change);
  const type = () => props.option.type;
  const label = () => props.option.name || t`New option`;

  return (
    <OptionBox data-testid="option-editor" aria-label={label()}>
      <OptionHead>
        <FloatingSelect
          label={t`Option type`}
          value={type()}
          onChange={(e) =>
            set((o) => {
              o.type = e.currentTarget.value as OptionType;
            })
          }
        >
          <For each={props.allowed}>
            {(option) => <MenuItem value={option}>{names[option]}</MenuItem>}
          </For>
        </FloatingSelect>
        <RowButtons>
          <Button
            size="xs"
            variant="text"
            isDisabled={props.first}
            aria-label={t`Move up`}
            onPress={() => props.onMove(-1)}
          >
            <Icon name="caret-up" size={16} />
          </Button>
          <Button
            size="xs"
            variant="text"
            isDisabled={props.last}
            aria-label={t`Move down`}
            onPress={() => props.onMove(1)}
          >
            <Icon name="caret-down" size={16} />
          </Button>
          <Button
            size="xs"
            variant="text"
            aria-label={t`Remove option ${label()}`}
            onPress={props.onRemove}
          >
            <Icon name="trash" size={16} />
          </Button>
        </RowButtons>
      </OptionHead>

      <Pair>
        <TextField
          label={t`Option name`}
          value={props.option.name}
          onInput={(e) => {
            const value = clipInput(e, LIMITS.name);
            set((o) => {
              o.name = value;
            });
          }}
          error={props.errorAt(`${props.at}.name`)}
        />
        <TextField
          label={t`Option description`}
          value={props.option.description}
          onInput={(e) => {
            const value = clipInput(e, LIMITS.description);
            set((o) => {
              o.description = value;
            });
          }}
          error={props.errorAt(`${props.at}.description`)}
        />
      </Pair>
      <Show when={props.errorAt(props.at)}>
        {(text) => <FieldError>{text()}</FieldError>}
      </Show>

      <Localized
        names={props.option.name_localizations}
        descriptions={props.option.description_localizations}
        onName={(locale, value) =>
          set((o) => {
            o.name_localizations[locale] = value;
          })
        }
        onDescription={(locale, value) =>
          set((o) => {
            o.description_localizations[locale] = value;
          })
        }
        errorAt={(field, locale) =>
          props.errorAt(`${props.at}.${field}.${locale}`)
        }
      />

      <Show when={!isSubcommand(type())}>
        <Checkbox
          checked={props.option.required}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            set((o) => {
              o.required = checked;
            });
          }}
        >
          <Trans>Required</Trans>
        </Checkbox>
        <Show when={props.errorAt(`${props.at}.required`)}>
          {(text) => <FieldError>{text()}</FieldError>}
        </Show>
      </Show>

      <Show when={type() === "String"}>
        <Pair>
          <NumberField
            label={t`Shortest text`}
            value={props.option.min_length}
            onInput={(value) =>
              set((o) => {
                o.min_length = value;
              })
            }
          />
          <NumberField
            label={t`Longest text`}
            value={props.option.max_length}
            onInput={(value) =>
              set((o) => {
                o.max_length = value;
              })
            }
            error={props.errorAt(`${props.at}.max_length`)}
          />
        </Pair>
      </Show>

      <Show when={isNumeric(type())}>
        <Pair>
          <NumberField
            label={t`Smallest value`}
            value={props.option.min_value}
            onInput={(value) =>
              set((o) => {
                o.min_value = value;
              })
            }
            error={props.errorAt(`${props.at}.min_value`)}
          />
          <NumberField
            label={t`Largest value`}
            value={props.option.max_value}
            onInput={(value) =>
              set((o) => {
                o.max_value = value;
              })
            }
            error={props.errorAt(`${props.at}.max_value`)}
          />
        </Pair>
      </Show>

      <Show when={type() === "Channel"}>
        <Group>
          <legend>{t`Channel types`}</legend>
          <Muted>
            <Trans>None picked: every channel.</Trans>
          </Muted>
          <Inline>
            <For each={["Text", "Voice"] as ChannelType[]}>
              {(kind) => (
                <Checkbox
                  checked={props.option.channel_types.includes(kind)}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    set((o) => {
                      o.channel_types = checked
                        ? [...o.channel_types, kind]
                        : o.channel_types.filter((k) => k !== kind);
                    });
                  }}
                >
                  {kind === "Text" ? t`Text channels` : t`Voice channels`}
                </Checkbox>
              )}
            </For>
          </Inline>
        </Group>
      </Show>

      <Show when={takesChoices(type())}>
        <Checkbox
          checked={props.option.autocomplete}
          disabled={props.option.choices.length > 0}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            set((o) => {
              o.autocomplete = checked;
            });
          }}
        >
          <Trans>Suggest values while people type (your bot answers)</Trans>
        </Checkbox>
        <Show when={!props.option.autocomplete}>
          <Choices
            option={props.option}
            at={props.at}
            errorAt={props.errorAt}
            set={set}
          />
        </Show>
      </Show>

      <Show when={isSubcommand(type())}>
        <Nested>
          <OptionList
            options={props.option.options}
            parent={props.path}
            parentType={type()}
            depth={props.depth + 1}
            errorAt={props.errorAt}
            edit={props.edit}
            editList={props.editList}
          />
        </Nested>
      </Show>
    </OptionBox>
  );
}

function Choices(props: {
  option: OptionDraft;
  at: string;
  errorAt: (path: string) => string | undefined;
  set: (change: (option: OptionDraft) => void) => void;
}) {
  const { t } = useLingui();
  return (
    <Group>
      <legend>{t`Choices`}</legend>
      <Muted>
        <Trans>People pick one of these. None: they type any value.</Trans>
      </Muted>
      <Show when={props.errorAt(`${props.at}.choices`)}>
        {(text) => <FieldError>{text()}</FieldError>}
      </Show>
      <For each={props.option.choices}>
        {(choice, index) => (
          <ChoiceRow>
            <TextField
              label={t`Shown as`}
              value={choice.name}
              onInput={(e) => {
                const value = clipInput(e, LIMITS.choiceName);
                props.set((o) => {
                  o.choices[index()].name = value;
                });
              }}
              error={props.errorAt(`${props.at}.choices.${index()}.name`)}
            />
            <TextField
              label={t`Value sent to the bot`}
              value={choice.value}
              dir="ltr"
              onInput={(e) => {
                const value = clipInput(e, LIMITS.choiceValue);
                props.set((o) => {
                  o.choices[index()].value = value;
                });
              }}
              error={props.errorAt(`${props.at}.choices.${index()}.value`)}
            />
            <Button
              size="xs"
              variant="text"
              aria-label={t`Remove choice`}
              onPress={() =>
                props.set((o) => {
                  o.choices.splice(index(), 1);
                })
              }
            >
              <Icon name="trash" size={16} />
            </Button>
          </ChoiceRow>
        )}
      </For>
      <Show when={props.option.choices.length < LIMITS.choices}>
        <div>
          <Button
            size="sm"
            variant="tonal"
            onPress={() =>
              props.set((o) => {
                o.choices.push(blankChoice());
              })
            }
          >
            <Icon name="plus" size={16} />
            {t`Add choice`}
          </Button>
        </div>
      </Show>
    </Group>
  );
}

function NumberField(props: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  error?: string;
}) {
  return (
    <TextField
      label={props.label}
      value={props.value}
      inputmode="decimal"
      dir="ltr"
      onInput={(e) => props.onInput(e.currentTarget.value)}
      error={props.error}
    />
  );
}

/** How the command looks to people, in a language of choice */
function Preview(props: { draft: CommandDraft }) {
  const { t, i18n } = useLingui();
  const types = useOptionTypeNames();
  const [lang, setLang] = createSignal<"ar" | "en" | "de">(
    (["ar", "de"] as const).find((l) => i18n().locale.startsWith(l)) ?? "en",
  );
  const name = () =>
    props.draft.name_localizations[lang()]?.trim() ||
    props.draft.name ||
    t`name`;
  const description = () =>
    props.draft.description_localizations[lang()]?.trim() ||
    props.draft.description;
  const optionName = (option: OptionDraft) =>
    option.name_localizations[lang()]?.trim() || option.name || "…";

  return (
    <PreviewBox aria-label={t`Preview`}>
      <SectionHead>
        <h4>
          <Trans>Preview</Trans>
        </h4>
        <Segmented<"ar" | "en" | "de">
          aria-label={t`Preview language`}
          value={lang()}
          onChange={setLang}
          options={[
            { value: "ar", label: "العربية" },
            { value: "en", label: "English" },
            { value: "de", label: "Deutsch" },
          ]}
        />
      </SectionHead>
      <PreviewStage dir={lang() === "ar" ? "rtl" : "ltr"} lang={lang()}>
        <Show
          when={props.draft.type === "ChatInput"}
          fallback={
            <MenuMock>
              <small>
                {props.draft.type === "User"
                  ? t`Member menu · Apps`
                  : t`Message menu · Apps`}
              </small>
              <span data-testid="preview-name">
                <Icon name="robot" size={16} />
                <bdi>{name()}</bdi>
              </span>
            </MenuMock>
          }
        >
          <PickerRow>
            <strong data-testid="preview-name">
              <bdi>/{name()}</bdi>
            </strong>
            <Show when={description()}>
              <span>{description()}</span>
            </Show>
          </PickerRow>
          <Show when={props.draft.options.length}>
            <Chips>
              <For each={props.draft.options}>
                {(option) => (
                  <Chip data-required={option.required ? "" : undefined}>
                    <bdi>{optionName(option)}</bdi>
                    {option.required ? " *" : ""}
                    <small>{types[option.type]}</small>
                  </Chip>
                )}
              </For>
            </Chips>
          </Show>
          <Show when={props.draft.default_member_permissions}>
            <small>
              <Trans>Members without the permissions do not see it.</Trans>
            </small>
          </Show>
        </Show>
      </PreviewStage>
    </PreviewBox>
  );
}

/** Advanced: the list as JSON, out and in */
function JsonTools(props: {
  commands: RegisteredCommand[];
  onImport: (commands: CommandData[], baseline: string) => Promise<void>;
}) {
  const { t } = useLingui();
  const problemText = useProblemText();
  const [source, setSource] = createSignal("");
  const [problem, setProblem] = createSignal<string>();
  const [error, setError] = createSignal<unknown>();
  const [confirm, setConfirm] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const json = () => exportCommands(props.commands.map(rawData));
  // the list when the import was checked; replacing checks it again
  const [baseline, setBaseline] = createSignal("");
  const [changed, setChanged] = createSignal(false);

  async function importList() {
    setProblem(undefined);
    setError(undefined);
    const parsed = parseCommandList(source());
    if (!parsed.ok) {
      setConfirm(false);
      setProblem(
        parsed.reason === "notJson"
          ? t`This is not valid JSON.`
          : parsed.reason === "notList"
            ? t`Paste a list: [ { … }, { … } ].`
            : parsed.reason === "badShape"
              ? t`Entry ${(parsed.index ?? 0) + 1} has a field of the wrong type. The Slash commands page shows each field.`
              : t`Every entry needs at least a name.`,
      );
      return;
    }
    const problems = validateCommandSet(parsed.commands);
    if (problems.length) {
      setConfirm(false);
      const [first] = problems;
      const index = Number(first.path.split(".")[0]);
      const name = parsed.commands[index]?.name ?? "";
      setProblem(`${name ? `${name}: ` : ""}${problemText(first)}`);
      return;
    }
    if (!confirm()) {
      setBaseline(signatureOf(props.commands));
      setChanged(false);
      setConfirm(true);
      return;
    }
    setConfirm(false);
    try {
      await props.onImport(parsed.commands, baseline());
      setSource("");
    } catch (err) {
      if (err instanceof ListChangedError) setChanged(true);
      else setError(err);
    }
  }

  return (
    <Disclosure>
      <summary>
        <Trans>Advanced: JSON import and export</Trans>
      </summary>
      <Muted>
        <Trans>
          The same list your bot sends with PUT to its commands route. Importing
          replaces every global command.
        </Trans>
      </Muted>
      <TextField
        label={t`Export`}
        value={json()}
        rows={6}
        readonly
        dir="ltr"
        spellcheck={false}
      />
      <div>
        <Button
          size="sm"
          variant="tonal"
          onPress={() =>
            void navigator.clipboard?.writeText(json()).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied() ? t`Copied` : t`Copy JSON`}
        </Button>
      </div>
      <TextField
        label={t`Import`}
        value={source()}
        rows={6}
        dir="ltr"
        spellcheck={false}
        placeholder={'[{ "name": "hello", "description": "Say hello" }]'}
        onInput={(e) => {
          setSource(e.currentTarget.value);
          setConfirm(false);
        }}
        error={problem()}
      />
      <Show when={changed()}>
        <ErrorBox role="alert">
          <Trans>
            The list changed since you opened it. It was reloaded: check it and
            save again.
          </Trans>
        </ErrorBox>
      </Show>
      <Show when={error()}>
        <ErrorBox role="alert">
          <TranslatedError error={error()} />
        </ErrorBox>
      </Show>
      <div>
        <Button
          size="sm"
          variant={confirm() ? "_error" : "tonal"}
          isDisabled={!source().trim()}
          onPress={() => void importList()}
        >
          {confirm() ? t`Replace all commands` : t`Check and import`}
        </Button>
      </div>
    </Disclosure>
  );
}

const Root = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    "& h3": { margin: 0, fontSize: "18px", fontWeight: 600 },
  },
});

const Muted = styled("span", {
  base: { color: "var(--z-fg-muted)", fontSize: "13px", lineHeight: 1.5 },
});

const Empty = styled("p", {
  base: {
    margin: 0,
    padding: "16px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px dashed var(--z-border-subtle)",
    color: "var(--z-fg-secondary)",
  },
});

const Notice = styled("p", {
  base: {
    margin: 0,
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-card-bg)",
    borderInlineStart: "4px solid var(--z-status-success)",
    color: "var(--z-fg-primary)",
  },
});

const ErrorBox = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-card-bg)",
    borderInlineStart: "4px solid var(--z-danger)",
    color: "var(--z-fg-primary)",
    "& ul": { margin: "8px 0 0", paddingInlineStart: "20px" },
  },
});

const FieldError = styled("span", {
  base: { color: "var(--z-danger)", fontSize: "13px" },
});

const Cards = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px" },
});

const Card = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    minWidth: 0,
    flexWrap: "wrap",
  },
});

const CardText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    flex: "1 1 240px",
    "& strong": { fontWeight: 600, overflowWrap: "anywhere" },
    "& span": { overflowWrap: "anywhere" },
  },
});

const CardActions = styled("div", {
  base: { display: "flex", gap: "8px", flexShrink: 0 },
});

const Editor = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Columns = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 320px)",
    gap: "24px",
    alignItems: "start",
    mdDown: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const FormColumn = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingBlockStart: "12px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
  },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    "& h4": { margin: 0, fontSize: "15px", fontWeight: 600 },
  },
});

const Group = styled("fieldset", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    border: "none",
    margin: 0,
    padding: 0,
    minWidth: 0,
    "& legend": {
      padding: 0,
      marginBlockEnd: "8px",
      fontSize: "13px",
      fontWeight: 600,
      color: "var(--z-fg-secondary)",
    },
  },
});

const Permissions = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "8px 16px",
  },
});

const Inline = styled("div", {
  base: { display: "flex", gap: "16px", flexWrap: "wrap" },
});

const Disclosure = styled("details", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-subtle)",
    "& > summary": {
      cursor: "pointer",
      fontWeight: 600,
      minHeight: "24px",
      color: "var(--z-fg-primary)",
      _focusVisible: { outline: "2px solid var(--z-focus)" },
      _phone: { minHeight: "44px", display: "flex", alignItems: "center" },
    },
    "&[open] > summary": { marginBlockEnd: "12px" },
    "& > *:not(summary)": { marginBlockEnd: "12px" },
  },
});

const LocaleRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
});

const OptionBox = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    minWidth: 0,
  },
});

const OptionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    "& > :first-child": { flex: "1 1 200px", minWidth: 0 },
  },
});

const RowButtons = styled("div", {
  base: { display: "flex", gap: "4px", flexShrink: 0 },
});

const Pair = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },
});

const ChoiceRow = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "end",
    _phone: { gridTemplateColumns: "minmax(0, 1fr) auto" },
  },
});

const Nested = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    paddingInlineStart: "12px",
    borderInlineStart: "2px solid var(--z-border-subtle)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
});

const PreviewBox = styled("aside", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-subtle)",
    position: "sticky",
    insetBlockStart: "12px",
    minWidth: 0,
    mdDown: { position: "static" },
  },
});

const PreviewStage = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-input)",
    minWidth: 0,
    "& small": { color: "var(--z-fg-muted)", fontSize: "12px" },
  },
});

const PickerRow = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& strong": { fontWeight: 600, overflowWrap: "anywhere" },
    "& span": { color: "var(--z-fg-secondary)", overflowWrap: "anywhere" },
  },
});

const Chips = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px" },
});

const Chip = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "4px",
    padding: "4px 8px",
    borderRadius: "var(--z-radius-full, 999px)",
    border: "1px solid var(--z-border-strong)",
    fontSize: "13px",
    "&[data-required]": { borderColor: "var(--z-accent)" },
  },
});

const MenuMock = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& > span": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "var(--z-radius-sm, 6px)",
      background: "var(--z-nav-hover)",
    },
  },
});
