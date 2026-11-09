/**
 * Commands of a bot as the Developer Portal edits them: the form's drafts,
 * the JSON the API takes, and the rules the server checks.
 *
 * The rules are a copy of `validate_command` and `validate_command_set` in
 * the backend (crates/core/models/src/v0/applications.rs) with the same
 * limits, so the form says what is wrong before anything is sent. The server
 * stays the judge: its answer is shown too. Unlike the server, which stops
 * at the first problem, this lists every problem with the field it is in.
 */

export type CommandType = "ChatInput" | "User" | "Message";

export type OptionType =
  | "SubCommand"
  | "SubCommandGroup"
  | "String"
  | "Integer"
  | "Number"
  | "Boolean"
  | "User"
  | "Role"
  | "Channel"
  | "Mentionable"
  | "Attachment";

export type ChannelType = "Text" | "Voice";

type Localizations = Record<string, string>;

/** A choice as the API takes it */
export interface ChoiceData {
  name: string;
  name_localizations?: Localizations | null;
  value: string | number;
}

/** An option as the API takes it */
export interface OptionData {
  type: OptionType;
  name: string;
  name_localizations?: Localizations | null;
  description: string;
  description_localizations?: Localizations | null;
  required?: boolean;
  choices?: ChoiceData[] | null;
  options?: OptionData[] | null;
  channel_types?: ChannelType[] | null;
  min_value?: number | null;
  max_value?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  autocomplete?: boolean;
}

/** A command as `PUT /applications/{id}/commands` takes it */
export interface CommandData {
  type?: CommandType;
  name: string;
  name_localizations?: Localizations | null;
  description?: string;
  description_localizations?: Localizations | null;
  options?: OptionData[];
  default_member_permissions?: number | null;
  nsfw?: boolean;
}

/** A registered command, as the API returns it */
export interface RegisteredCommand extends CommandData {
  _id: string;
  version: string;
}

/** Registration limits, per application and scope (`command_limits`) */
export const LIMITS = {
  chatInput: 100,
  user: 5,
  message: 5,
  options: 25,
  choices: 25,
  localizations: 30,
  name: 32,
  description: 100,
  choiceName: 100,
  choiceValue: 100,
  stringLength: 6000,
  totalCharacters: 8000,
  safeInteger: 9_007_199_254_740_991,
} as const;

/** Languages the form offers names in; any other tag survives an edit */
export const FORM_LOCALES = ["ar", "en", "de"] as const;

export const OPTION_TYPES: OptionType[] = [
  "String",
  "Integer",
  "Number",
  "Boolean",
  "User",
  "Role",
  "Channel",
  "Mentionable",
  "Attachment",
  "SubCommand",
  "SubCommandGroup",
];

export const isSubcommand = (type: OptionType) =>
  type === "SubCommand" || type === "SubCommandGroup";
export const takesChoices = (type: OptionType) =>
  type === "String" || type === "Integer" || type === "Number";
export const isNumeric = (type: OptionType) =>
  type === "Integer" || type === "Number";

const LIMIT_OF: Record<CommandType, number> = {
  ChatInput: LIMITS.chatInput,
  User: LIMITS.user,
  Message: LIMITS.message,
};

/* ------------------------------------------------------------------ */
/* Problems                                                            */
/* ------------------------------------------------------------------ */

export type Rule =
  | "nameLength"
  | "nameChars"
  | "menuNameSpaces"
  | "descriptionLength"
  | "controlChars"
  | "tooManyLocalizations"
  | "badLocale"
  | "subcommandExtras"
  | "groupNotTop"
  | "groupEmpty"
  | "groupOnlySubcommands"
  | "subcommandTooDeep"
  | "subcommandNested"
  | "optionsOnlyForSubcommands"
  | "choicesNotAllowed"
  | "choicesAndAutocomplete"
  | "choiceCount"
  | "choiceNameLength"
  | "duplicateChoice"
  | "choiceValueLength"
  | "choiceValueType"
  | "autocompleteNotAllowed"
  | "minMaxType"
  | "bound"
  | "boundWhole"
  | "minAboveMax"
  | "lengthType"
  | "lengthRange"
  | "channelTypesType"
  | "channelTypes"
  | "tooManyOptions"
  | "mixedSubcommands"
  | "duplicateOption"
  | "requiredAfterOptional"
  | "menuNoDescription"
  | "menuNoOptions"
  | "totalCharacters"
  | "negativePermissions"
  | "duplicateCommand"
  | "tooManyCommands"
  | "badShape";

export interface Problem {
  /** Field the problem is in: `name`, `options.0.choices.2.value`, … */
  path: string;
  rule: Rule;
  /** The limit that was crossed, when there is one */
  max?: number;
}

/** Characters as the server counts them (Unicode scalar values) */
export const chars = (text: string) => [...text].length;

const RE_COMMAND_NAME = /^[\p{Ll}\p{Lm}\p{Lo}\p{M}\p{N}_-]+$/u;
const RE_LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;
const RE_CONTROL = /\p{Cc}/u;

type Check = (path: string, text: string, out: Problem[]) => void;

const checkChatName: Check = (path, name, out) => {
  const length = chars(name);
  if (length === 0 || length > LIMITS.name)
    out.push({ path, rule: "nameLength", max: LIMITS.name });
  else if (!RE_COMMAND_NAME.test(name)) out.push({ path, rule: "nameChars" });
};

const checkMenuName: Check = (path, name, out) => {
  const length = chars(name);
  if (length === 0 || length > LIMITS.name)
    out.push({ path, rule: "nameLength", max: LIMITS.name });
  else if (name.trim() !== name || RE_CONTROL.test(name))
    out.push({ path, rule: "menuNameSpaces" });
};

const checkDescription: Check = (path, text, out) => {
  const length = chars(text);
  if (length === 0 || length > LIMITS.description)
    out.push({ path, rule: "descriptionLength", max: LIMITS.description });
  else if (RE_CONTROL.test(text)) out.push({ path, rule: "controlChars" });
};

const checkChoiceName: Check = (path, text, out) => {
  const length = chars(text);
  if (length === 0 || length > LIMITS.choiceName)
    out.push({ path, rule: "choiceNameLength", max: LIMITS.choiceName });
};

/** Checks locale keys and each value, and returns their length */
function checkLocalizations(
  path: string,
  map: Localizations | null | undefined,
  check: Check,
  out: Problem[],
) {
  if (!map) return 0;
  const entries = Object.entries(map);
  if (entries.length > LIMITS.localizations)
    out.push({ path, rule: "tooManyLocalizations", max: LIMITS.localizations });
  let total = 0;
  for (const [locale, value] of entries) {
    if (!RE_LOCALE.test(locale)) out.push({ path, rule: "badLocale" });
    check(`${path}.${locale}`, value, out);
    total += chars(value);
  }
  return total;
}

function checkBound(
  path: string,
  value: number,
  integer: boolean,
  out: Problem[],
) {
  if (!Number.isFinite(value) || Math.abs(value) > LIMITS.safeInteger)
    out.push({ path, rule: "bound" });
  else if (integer && !Number.isInteger(value))
    out.push({ path, rule: "boundWhole" });
}

const given = <T>(value: T | null | undefined): value is T =>
  value !== undefined && value !== null;

function validateOption(
  option: OptionData,
  path: string,
  depth: number,
  out: Problem[],
): number {
  let total = 0;
  checkChatName(`${path}.name`, option.name, out);
  checkDescription(`${path}.description`, option.description, out);
  total += chars(option.name) + chars(option.description);
  total += checkLocalizations(
    `${path}.name_localizations`,
    option.name_localizations,
    checkChatName,
    out,
  );
  total += checkLocalizations(
    `${path}.description_localizations`,
    option.description_localizations,
    checkDescription,
    out,
  );

  const type = option.type;
  if (isSubcommand(type)) {
    if (
      option.required ||
      given(option.choices) ||
      given(option.channel_types) ||
      given(option.min_value) ||
      given(option.max_value) ||
      given(option.min_length) ||
      given(option.max_length) ||
      option.autocomplete
    )
      out.push({ path, rule: "subcommandExtras" });

    const children = option.options ?? [];
    if (type === "SubCommandGroup") {
      if (depth !== 0) out.push({ path, rule: "groupNotTop" });
      if (!children.length) out.push({ path, rule: "groupEmpty" });
      if (children.some((child) => child.type !== "SubCommand"))
        out.push({ path, rule: "groupOnlySubcommands" });
    } else {
      if (depth > 1) out.push({ path, rule: "subcommandTooDeep" });
      if (children.some((child) => isSubcommand(child.type)))
        out.push({ path, rule: "subcommandNested" });
    }
    return (
      total + validateOptionList(children, `${path}.options`, depth + 1, out)
    );
  }

  if (given(option.options))
    out.push({ path: `${path}.options`, rule: "optionsOnlyForSubcommands" });

  if (given(option.choices)) {
    const choicesPath = `${path}.choices`;
    if (!takesChoices(type))
      out.push({ path: choicesPath, rule: "choicesNotAllowed" });
    else {
      if (option.autocomplete)
        out.push({ path: choicesPath, rule: "choicesAndAutocomplete" });
      if (!option.choices.length || option.choices.length > LIMITS.choices)
        out.push({
          path: choicesPath,
          rule: "choiceCount",
          max: LIMITS.choices,
        });
      const names = new Set<string>();
      option.choices.forEach((choice, index) => {
        const at = `${choicesPath}.${index}`;
        checkChoiceName(`${at}.name`, choice.name, out);
        if (names.has(choice.name))
          out.push({ path: `${at}.name`, rule: "duplicateChoice" });
        names.add(choice.name);
        total += chars(choice.name);
        total += checkLocalizations(
          `${at}.name_localizations`,
          choice.name_localizations,
          checkChoiceName,
          out,
        );
        const value = choice.value;
        if (type === "String") {
          if (typeof value !== "string")
            out.push({ path: `${at}.value`, rule: "choiceValueType" });
          else if (!chars(value) || chars(value) > LIMITS.choiceValue)
            out.push({
              path: `${at}.value`,
              rule: "choiceValueLength",
              max: LIMITS.choiceValue,
            });
        } else if (
          typeof value !== "number" ||
          Number.isNaN(value) ||
          (type === "Integer" && !Number.isInteger(value))
        )
          out.push({ path: `${at}.value`, rule: "choiceValueType" });
        else checkBound(`${at}.value`, value, false, out);
      });
    }
  }

  if (option.autocomplete && !takesChoices(type))
    out.push({ path: `${path}.autocomplete`, rule: "autocompleteNotAllowed" });

  if (given(option.min_value) || given(option.max_value)) {
    if (!isNumeric(type)) out.push({ path, rule: "minMaxType" });
    else {
      const integer = type === "Integer";
      if (given(option.min_value))
        checkBound(`${path}.min_value`, option.min_value, integer, out);
      if (given(option.max_value))
        checkBound(`${path}.max_value`, option.max_value, integer, out);
      if (
        given(option.min_value) &&
        given(option.max_value) &&
        option.min_value > option.max_value
      )
        out.push({ path: `${path}.min_value`, rule: "minAboveMax" });
    }
  }

  if (given(option.min_length) || given(option.max_length)) {
    if (type !== "String") out.push({ path, rule: "lengthType" });
    else {
      const min = option.min_length ?? 0;
      const max = option.max_length ?? LIMITS.stringLength;
      if (
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 0 ||
        max === 0 ||
        max > LIMITS.stringLength ||
        min > max
      )
        out.push({
          path: `${path}.max_length`,
          rule: "lengthRange",
          max: LIMITS.stringLength,
        });
    }
  }

  if (given(option.channel_types)) {
    if (type !== "Channel") out.push({ path, rule: "channelTypesType" });
    else if (
      !option.channel_types.length ||
      new Set(option.channel_types).size !== option.channel_types.length
    )
      out.push({ path: `${path}.channel_types`, rule: "channelTypes" });
  }

  return total;
}

function validateOptionList(
  options: OptionData[],
  path: string,
  depth: number,
  out: Problem[],
): number {
  if (options.length > LIMITS.options)
    out.push({ path, rule: "tooManyOptions", max: LIMITS.options });
  if (
    options.some((o) => isSubcommand(o.type)) &&
    options.some((o) => !isSubcommand(o.type))
  )
    out.push({ path, rule: "mixedSubcommands" });

  let total = 0;
  const names = new Set<string>();
  let seenOptional = false;
  options.forEach((option, index) => {
    const at = `${path}.${index}`;
    if (names.has(option.name))
      out.push({ path: `${at}.name`, rule: "duplicateOption" });
    names.add(option.name);
    if (!isSubcommand(option.type)) {
      if (option.required && seenOptional)
        out.push({ path: `${at}.required`, rule: "requiredAfterOptional" });
      seenOptional ||= !option.required;
    }
    total += validateOption(option, at, depth, out);
  });
  return total;
}

/** Every rule `validate_command` checks, with the field of each problem */
export function validateCommand(command: CommandData): Problem[] {
  const out: Problem[] = [];
  let total = 0;
  const type = command.type ?? "ChatInput";
  const description = command.description ?? "";
  if (type === "ChatInput") {
    checkChatName("name", command.name, out);
    checkDescription("description", description, out);
    total += checkLocalizations(
      "name_localizations",
      command.name_localizations,
      checkChatName,
      out,
    );
    total += checkLocalizations(
      "description_localizations",
      command.description_localizations,
      checkDescription,
      out,
    );
    total += validateOptionList(command.options ?? [], "options", 0, out);
  } else {
    checkMenuName("name", command.name, out);
    total += checkLocalizations(
      "name_localizations",
      command.name_localizations,
      checkMenuName,
      out,
    );
    if (description || given(command.description_localizations))
      out.push({ path: "description", rule: "menuNoDescription" });
    if (command.options?.length)
      out.push({ path: "options", rule: "menuNoOptions" });
  }

  total += chars(command.name) + chars(description);
  if (total > LIMITS.totalCharacters)
    out.push({
      path: "",
      rule: "totalCharacters",
      max: LIMITS.totalCharacters,
    });

  if ((command.default_member_permissions ?? 0) < 0)
    out.push({
      path: "default_member_permissions",
      rule: "negativePermissions",
    });

  return out;
}

/**
 * The rules of one scope's whole list (`validate_command_set`): every
 * command, names unique per type, and the per-type limits. Paths start with
 * the command's index.
 */
export function validateCommandSet(commands: CommandData[]): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<string>();
  const counts: Partial<Record<CommandType, number>> = {};
  commands.forEach((command, index) => {
    // imported JSON can hold anything: a wrong shape is a problem, not a crash
    if (!isCommandShape(command)) {
      out.push({ path: `${index}`, rule: "badShape" });
      return;
    }
    for (const problem of validateCommand(command))
      out.push({ ...problem, path: `${index}.${problem.path}` });
    const type = command.type ?? "ChatInput";
    const key = `${type}\u0000${command.name}`;
    if (seen.has(key))
      out.push({ path: `${index}.name`, rule: "duplicateCommand" });
    seen.add(key);
    counts[type] = (counts[type] ?? 0) + 1;
    if (counts[type]! === LIMIT_OF[type] + 1)
      out.push({
        path: `${index}`,
        rule: "tooManyCommands",
        max: LIMIT_OF[type],
      });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Drafts: what the form holds while someone types                     */
/* ------------------------------------------------------------------ */

export interface ChoiceDraft {
  key: string;
  name: string;
  /** As typed; read as a number for number options */
  value: string;
  name_localizations: Localizations;
}

export interface OptionDraft {
  key: string;
  type: OptionType;
  name: string;
  description: string;
  name_localizations: Localizations;
  description_localizations: Localizations;
  required: boolean;
  autocomplete: boolean;
  choices: ChoiceDraft[];
  min_value: string;
  max_value: string;
  min_length: string;
  max_length: string;
  channel_types: ChannelType[];
  options: OptionDraft[];
}

export interface CommandDraft {
  /** Id of the registered command, none for a new one */
  id?: string;
  type: CommandType;
  name: string;
  description: string;
  name_localizations: Localizations;
  description_localizations: Localizations;
  options: OptionDraft[];
  default_member_permissions: number | null;
  nsfw: boolean;
}

let keys = 0;
/** Stable key of a list row, so typing never rebuilds it */
export const newKey = () => `k${++keys}`;

export const blankCommand = (): CommandDraft => ({
  type: "ChatInput",
  name: "",
  description: "",
  name_localizations: {},
  description_localizations: {},
  options: [],
  default_member_permissions: null,
  nsfw: false,
});

export const blankOption = (type: OptionType = "String"): OptionDraft => ({
  key: newKey(),
  type,
  name: "",
  description: "",
  name_localizations: {},
  description_localizations: {},
  required: false,
  autocomplete: false,
  choices: [],
  min_value: "",
  max_value: "",
  min_length: "",
  max_length: "",
  channel_types: [],
  options: [],
});

export const blankChoice = (): ChoiceDraft => ({
  key: newKey(),
  name: "",
  value: "",
  name_localizations: {},
});

const text = (value: number | null | undefined) =>
  given(value) ? String(value) : "";

function optionDraft(option: OptionData): OptionDraft {
  return {
    ...blankOption(option.type),
    name: option.name,
    description: option.description ?? "",
    name_localizations: { ...option.name_localizations },
    description_localizations: { ...option.description_localizations },
    required: !!option.required,
    autocomplete: !!option.autocomplete,
    choices: (option.choices ?? []).map((choice) => ({
      key: newKey(),
      name: choice.name,
      value: String(choice.value),
      name_localizations: { ...choice.name_localizations },
    })),
    min_value: text(option.min_value),
    max_value: text(option.max_value),
    min_length: text(option.min_length),
    max_length: text(option.max_length),
    channel_types: [...(option.channel_types ?? [])],
    options: (option.options ?? []).map(optionDraft),
  };
}

/** The form's copy of a command (registered or imported) */
export function fromCommand(
  command: CommandData & { _id?: string },
): CommandDraft {
  return {
    id: command._id,
    type: command.type ?? "ChatInput",
    name: command.name,
    description: command.description ?? "",
    name_localizations: { ...command.name_localizations },
    description_localizations: { ...command.description_localizations },
    options: (command.options ?? []).map(optionDraft),
    default_member_permissions: command.default_member_permissions ?? null,
    nsfw: !!command.nsfw,
  };
}

/** Localised texts that were typed; empty fields are left out */
function filled(map: Localizations) {
  const entries = Object.entries(map)
    .map(([locale, value]) => [locale, value.trim()] as const)
    .filter(([, value]) => value);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** A number field: empty is "not set", anything else must be a number */
function number(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function optionData(draft: OptionDraft): OptionData {
  const data: OptionData = {
    type: draft.type,
    name: draft.name.trim(),
    description: draft.description.trim(),
  };
  const names = filled(draft.name_localizations);
  if (names) data.name_localizations = names;
  const descriptions = filled(draft.description_localizations);
  if (descriptions) data.description_localizations = descriptions;

  if (isSubcommand(draft.type)) {
    data.options = draft.options.map(optionData);
    return data;
  }
  if (draft.required) data.required = true;
  if (takesChoices(draft.type)) {
    if (draft.choices.length)
      data.choices = draft.choices.map((choice) => {
        const out: ChoiceData = {
          name: choice.name.trim(),
          value:
            draft.type === "String"
              ? choice.value
              : (number(choice.value) ?? Number.NaN),
        };
        const localized = filled(choice.name_localizations);
        if (localized) out.name_localizations = localized;
        return out;
      });
    else if (draft.autocomplete) data.autocomplete = true;
  }
  if (isNumeric(draft.type)) {
    const min = number(draft.min_value);
    const max = number(draft.max_value);
    if (min !== undefined) data.min_value = min;
    if (max !== undefined) data.max_value = max;
  }
  if (draft.type === "String") {
    const min = number(draft.min_length);
    const max = number(draft.max_length);
    if (min !== undefined) data.min_length = min;
    if (max !== undefined) data.max_length = max;
  }
  if (draft.type === "Channel" && draft.channel_types.length)
    data.channel_types = [...draft.channel_types];
  return data;
}

/**
 * What the API takes for a draft. Fields that do not belong to the type
 * are left out (a menu command has no description or options), so
 * switching the type in the form never leaves hidden values behind.
 */
export function toData(draft: CommandDraft): CommandData {
  const data: CommandData = { type: draft.type, name: draft.name.trim() };
  const names = filled(draft.name_localizations);
  if (names) data.name_localizations = names;
  if (draft.type === "ChatInput") {
    data.description = draft.description.trim();
    const descriptions = filled(draft.description_localizations);
    if (descriptions) data.description_localizations = descriptions;
    if (draft.options.length) data.options = draft.options.map(optionData);
  }
  if (draft.default_member_permissions)
    data.default_member_permissions = draft.default_member_permissions;
  if (draft.nsfw) data.nsfw = true;
  return data;
}

/** A registered command as the API takes it back (for a full `PUT`) */
export const dataOf = (command: RegisteredCommand): CommandData =>
  toData(fromCommand(command));

const DATA_FIELDS = [
  "type",
  "name",
  "name_localizations",
  "description",
  "description_localizations",
  "options",
  "default_member_permissions",
  "nsfw",
] as const;

/**
 * A registered command exactly as the server has it, without the fields the
 * server adds: what a full `PUT` sends for a command nobody edited, so it
 * keeps its id and version
 */
export function rawData(command: RegisteredCommand): CommandData {
  const out: Record<string, unknown> = {};
  for (const field of DATA_FIELDS) {
    const value = command[field];
    if (value !== undefined && value !== null) out[field] = value;
  }
  return out as unknown as CommandData;
}

/** What the server's list is now: every id with its revision */
export const signatureOf = (commands: RegisteredCommand[]) =>
  commands
    .map((command) => `${command._id}:${command.version}`)
    .sort()
    .join(",");

/** The list on the server changed since the form read it */
export class ListChangedError extends Error {
  constructor(readonly signature: string) {
    super("ListChanged");
  }
}

/* ------------------------------------------------------------------ */
/* Permissions                                                          */
/* ------------------------------------------------------------------ */

/** Bits go past 2^31, where `&` and `|` would cut them: use division */
export const hasPermission = (value: number | null, bit: number) =>
  Math.floor((value ?? 0) / bit) % 2 === 1;

/** Switch one permission; no permission left means "everyone" (`null`) */
export function togglePermission(value: number | null, bit: number) {
  const next = hasPermission(value, bit)
    ? (value ?? 0) - bit
    : (value ?? 0) + bit;
  return next === 0 ? null : next;
}

/* ------------------------------------------------------------------ */
/* JSON import                                                          */
/* ------------------------------------------------------------------ */

export type ParseResult =
  | { ok: true; commands: CommandData[] }
  | {
      ok: false;
      reason: "notJson" | "notList" | "notCommand" | "badShape";
      /** Index of the first command with a wrong shape */
      index?: number;
    };

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown) => typeof value === "string";
const optional = (value: unknown, check: (value: unknown) => boolean) =>
  value === undefined || value === null || check(value);
const isTextMap = (value: unknown) =>
  isObject(value) && Object.values(value).every(isText);
const isNumber = (value: unknown) => typeof value === "number";
const isFlag = (value: unknown) => typeof value === "boolean";

function isChoiceShape(value: unknown) {
  return (
    isObject(value) &&
    isText(value.name) &&
    (isText(value.value) || isNumber(value.value)) &&
    optional(value.name_localizations, isTextMap)
  );
}

function isOptionShape(value: unknown): boolean {
  return (
    isObject(value) &&
    isText(value.type) &&
    isText(value.name) &&
    isText(value.description) &&
    optional(value.name_localizations, isTextMap) &&
    optional(value.description_localizations, isTextMap) &&
    optional(value.required, isFlag) &&
    optional(value.autocomplete, isFlag) &&
    optional(value.min_value, isNumber) &&
    optional(value.max_value, isNumber) &&
    optional(value.min_length, isNumber) &&
    optional(value.max_length, isNumber) &&
    optional(
      value.choices,
      (list) => Array.isArray(list) && list.every(isChoiceShape),
    ) &&
    optional(
      value.channel_types,
      (list) => Array.isArray(list) && list.every(isText),
    ) &&
    optional(
      value.options,
      (list) => Array.isArray(list) && list.every(isOptionShape),
    )
  );
}

/** Every field has the type the API expects (values are checked later) */
export function isCommandShape(value: unknown): value is CommandData {
  return (
    isObject(value) &&
    isText(value.name) &&
    optional(value.type, isText) &&
    optional(value.description, isText) &&
    optional(value.name_localizations, isTextMap) &&
    optional(value.description_localizations, isTextMap) &&
    optional(value.default_member_permissions, isNumber) &&
    optional(value.nsfw, isFlag) &&
    optional(
      value.options,
      (list) => Array.isArray(list) && list.every(isOptionShape),
    )
  );
}

/** Read the JSON list `PUT` takes; the rules are checked separately */
export function parseCommandList(source: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return { ok: false, reason: "notJson" };
  }
  if (!Array.isArray(value)) return { ok: false, reason: "notList" };
  if (
    !value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as { name?: unknown }).name === "string",
    )
  )
    return { ok: false, reason: "notCommand" };
  const index = value.findIndex((item) => !isCommandShape(item));
  if (index !== -1) return { ok: false, reason: "badShape", index };
  return { ok: true, commands: value as CommandData[] };
}

/** The list as JSON, for export (what `PUT` takes) */
export const exportCommands = (commands: CommandData[]) =>
  JSON.stringify(commands, null, 2);
