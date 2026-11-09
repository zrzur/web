import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  type CommandData,
  type OptionData,
  LIMITS,
  blankCommand,
  blankOption,
  clip,
  fromCommand,
  hasPermission,
  parseCommandList,
  toData,
  togglePermission,
  validateCommand,
  validateCommandSet,
} from "./commandForm";

/**
 * The rules mirror `validate_command` and `validate_command_set` in the
 * backend (crates/core/models/src/v0/applications.rs), test for test, so the
 * form refuses what the server would refuse, before anything is sent.
 */

const option = (type: OptionData["type"], name: string): OptionData => ({
  type,
  name,
  description: "desc",
});

const hello = (): CommandData => ({
  name: "hello",
  description: "Say hello",
});

const rules = (command: CommandData) =>
  validateCommand(command).map((problem) => problem.rule);

describe("validateCommand (backend parity)", () => {
  it("accepts simple and Arabic names", () => {
    expect(validateCommand(hello())).toEqual([]);
    expect(
      validateCommand({
        ...hello(),
        name: "مرحبا",
        name_localizations: { ar: "أهلا" },
      }),
    ).toEqual([]);
  });

  it("rejects bad names", () => {
    for (const name of ["", "Hello", "with space", "a".repeat(33)])
      expect(validateCommand({ ...hello(), name }), name).not.toEqual([]);
    expect(
      rules({ ...hello(), name_localizations: { "not a locale": "x" } }),
    ).toContain("badLocale");
  });

  it("counts characters, not UTF-16 units", () => {
    // 32 Arabic letters with marks are fine, 33 are not
    expect(rules({ ...hello(), name: "ب".repeat(32) })).toEqual([]);
    expect(rules({ ...hello(), name: "ب".repeat(33) })).toContain("nameLength");
  });

  it("keeps context menus without description or options", () => {
    const menu: CommandData = { type: "User", name: "Report User" };
    expect(validateCommand(menu)).toEqual([]);
    expect(rules({ ...menu, description: "x" })).toContain("menuNoDescription");
    expect(rules({ ...menu, options: [option("String", "x")] })).toContain(
      "menuNoOptions",
    );
    expect(rules({ ...menu, name: " Report" })).toContain("menuNameSpaces");
  });

  it("checks sub-command structure", () => {
    const sub = { ...option("SubCommand", "set") };
    sub.options = [option("String", "value")];
    const group = { ...option("SubCommandGroup", "config"), options: [sub] };

    expect(validateCommand({ ...hello(), options: [group, sub] })).toEqual([]);
    expect(
      rules({ ...hello(), options: [sub, option("String", "x")] }),
    ).toContain("mixedSubcommands");
    expect(
      rules({ ...hello(), options: [{ ...group, options: [group] }] }),
    ).not.toEqual([]);
    expect(
      rules({ ...hello(), options: [{ ...sub, required: true }] }),
    ).toContain("subcommandExtras");
    expect(
      rules({ ...hello(), options: [{ ...group, options: [] }] }),
    ).toContain("groupEmpty");
  });

  it("checks option rules", () => {
    const required = { ...option("String", "a"), required: true };
    expect(
      rules({ ...hello(), options: [option("String", "b"), required] }),
    ).toContain("requiredAfterOptional");
    expect(rules({ ...hello(), options: [required, required] })).toContain(
      "duplicateOption",
    );

    const choices: OptionData = {
      ...option("Integer", "n"),
      choices: [{ name: "one", value: "1" }],
    };
    expect(rules({ ...hello(), options: [choices] })).toContain(
      "choiceValueType",
    );
    const fixed = { ...choices, choices: [{ name: "one", value: 1 }] };
    expect(validateCommand({ ...hello(), options: [fixed] })).toEqual([]);
    expect(
      rules({ ...hello(), options: [{ ...fixed, autocomplete: true }] }),
    ).toContain("choicesAndAutocomplete");

    const bounds = { ...option("Integer", "n"), min_value: 5, max_value: 1 };
    expect(rules({ ...hello(), options: [bounds] })).toContain("minAboveMax");
    expect(
      rules({
        ...hello(),
        options: [{ ...option("Integer", "n"), max_value: 1.5 }],
      }),
    ).toContain("boundWhole");
    expect(
      rules({
        ...hello(),
        options: [{ ...option("Boolean", "b"), max_length: 5 }],
      }),
    ).toContain("lengthType");
    expect(
      rules({
        ...hello(),
        options: [
          { ...option("Channel", "c"), channel_types: ["Text", "Text"] },
        ],
      }),
    ).toContain("channelTypes");
  });

  it("checks the limits the server checks", () => {
    expect(
      rules({
        ...hello(),
        options: Array.from({ length: LIMITS.options + 1 }, (_, i) =>
          option("String", `o${i}`),
        ),
      }),
    ).toContain("tooManyOptions");
    expect(
      rules({
        ...hello(),
        options: [
          {
            ...option("String", "s"),
            max_length: LIMITS.stringLength + 1,
          },
        ],
      }),
    ).toContain("lengthRange");
    expect(
      rules({
        ...hello(),
        options: [{ ...option("Number", "n"), min_value: 2 ** 53 }],
      }),
    ).toContain("bound");
    expect(rules({ ...hello(), default_member_permissions: -1 })).toContain(
      "negativePermissions",
    );
    expect(rules({ ...hello(), description: "" })).toContain(
      "descriptionLength",
    );
  });

  it("counts every name, description and choice towards 8000", () => {
    const long = "x".repeat(100);
    const many = Array.from({ length: 25 }, (_, i) => ({
      name: `${long.slice(3)}${String(i).padStart(3, "0")}`,
      value: `v${i}`,
    }));
    const options = Array.from({ length: 4 }, (_, i) => ({
      ...option("String", `o${i}`),
      description: long,
      choices: many,
    }));
    expect(rules({ ...hello(), options })).toContain("totalCharacters");
  });

  it("names the field of each problem", () => {
    const [problem] = validateCommand({
      ...hello(),
      options: [{ ...option("String", "Bad Name") }],
    });
    expect(problem.path).toBe("options.0.name");
  });
});

describe("validateCommandSet", () => {
  it("refuses duplicates of one type and too many menu commands", () => {
    expect(validateCommandSet([hello(), hello()])[0]?.rule).toBe(
      "duplicateCommand",
    );
    const user: CommandData = { type: "User", name: "hello" };
    expect(validateCommandSet([hello(), user])).toEqual([]);
    const many = Array.from({ length: 6 }, (_, i) => ({
      ...user,
      name: `u${i}`,
    }));
    expect(validateCommandSet(many).map((p) => p.rule)).toContain(
      "tooManyCommands",
    );
  });
});

describe("form drafts", () => {
  it("round-trips a registered command without losing fields", () => {
    const registered = {
      _id: "01CMD",
      application_id: "01BOT",
      version: "v1",
      type: "ChatInput" as const,
      name: "roll",
      name_localizations: { ar: "نرد", de: "wuerfeln" },
      description: "Roll a die",
      description_localizations: { ar: "ارمِ النرد" },
      default_member_permissions: 8388608,
      nsfw: false,
      options: [
        {
          type: "Integer" as const,
          name: "sides",
          description: "How many sides",
          required: true,
          min_value: 2,
          max_value: 100,
        },
        {
          type: "String" as const,
          name: "colour",
          description: "Colour",
          choices: [
            { name: "Red", value: "red", name_localizations: { de: "Rot" } },
          ],
        },
      ],
    };
    const data = toData(fromCommand(registered));
    expect(data).toEqual({
      type: "ChatInput",
      name: "roll",
      name_localizations: { ar: "نرد", de: "wuerfeln" },
      description: "Roll a die",
      description_localizations: { ar: "ارمِ النرد" },
      default_member_permissions: 8388608,
      options: [
        {
          type: "Integer",
          name: "sides",
          description: "How many sides",
          required: true,
          min_value: 2,
          max_value: 100,
        },
        {
          type: "String",
          name: "colour",
          description: "Colour",
          choices: [
            { name: "Red", value: "red", name_localizations: { de: "Rot" } },
          ],
        },
      ],
    });
  });

  it("sends numbers as numbers and leaves out what is empty", () => {
    const draft = blankCommand();
    draft.name = "roll";
    draft.description = "Roll";
    draft.name_localizations.ar = "  ";
    const sides = blankOption("Integer");
    sides.name = "sides";
    sides.description = "Sides";
    sides.min_value = "2";
    sides.choices = [];
    draft.options = [sides];
    expect(toData(draft)).toEqual({
      type: "ChatInput",
      name: "roll",
      description: "Roll",
      options: [
        { type: "Integer", name: "sides", description: "Sides", min_value: 2 },
      ],
    });
  });

  it("turns a menu command into one without description or options", () => {
    const draft = blankCommand();
    draft.type = "Message";
    draft.name = "Translate";
    draft.description = "left over";
    draft.options = [blankOption("String")];
    expect(toData(draft)).toEqual({ type: "Message", name: "Translate" });
  });

  it("reads a typed choice value by the option type", () => {
    const draft = blankCommand();
    draft.name = "n";
    draft.description = "n";
    const count = blankOption("Integer");
    count.name = "count";
    count.description = "Count";
    count.choices = [
      { key: "a", name: "Two", value: "2", name_localizations: {} },
    ];
    draft.options = [count];
    expect(toData(draft).options?.[0].choices).toEqual([
      { name: "Two", value: 2 },
    ]);
    count.choices[0].value = "two";
    expect(validateCommand(toData(draft)).map((p) => p.rule)).toContain(
      "choiceValueType",
    );
  });
});

describe("permissions", () => {
  it("adds and removes bits above 2^31 exactly", () => {
    const manageMessages = 2 ** 23;
    const mentionEveryone = 2 ** 37;
    let value = togglePermission(null, manageMessages);
    value = togglePermission(value, mentionEveryone);
    expect(value).toBe(manageMessages + mentionEveryone);
    expect(hasPermission(value, mentionEveryone)).toBe(true);
    value = togglePermission(value, mentionEveryone);
    expect(value).toBe(manageMessages);
    expect(togglePermission(value, manageMessages)).toBeNull();
  });
});

describe("parseCommandList", () => {
  it("takes the JSON list PUT takes", () => {
    const result = parseCommandList(
      '[{ "name": "hello", "description": "Say hello" }]',
    );
    expect(result).toEqual({
      ok: true,
      commands: [{ name: "hello", description: "Say hello" }],
    });
  });

  it("refuses wrong shapes in words instead of throwing", () => {
    for (const source of [
      '[{ "name": "a", "description": "b", "options": "x" }]',
      '[{ "name": "a", "description": "b", "options": [null] }]',
      '[{ "name": "a", "description": "b", "options": [{ "type": "String", "name": "o", "description": "d", "choices": 3 }] }]',
      '[{ "name": "a", "description": 5 }]',
    ]) {
      const result = parseCommandList(source);
      expect(result, source).toMatchObject({ ok: false, reason: "badShape" });
      expect(() => validateCommandSet(JSON.parse(source))).not.toThrow();
    }
  });

  it("says why a text is not a command list", () => {
    expect(parseCommandList("{").ok).toBe(false);
    expect(parseCommandList('{ "name": "x" }')).toMatchObject({
      ok: false,
      reason: "notList",
    });
    expect(parseCommandList("[1]")).toMatchObject({
      ok: false,
      reason: "notCommand",
    });
  });
});

describe("server parity details", () => {
  it("treats U+FEFF as the server does: not a space, not a control", () => {
    expect(validateCommand({ type: "User", name: "﻿Report" })).toEqual([]);
    expect(
      validateCommand({ type: "User", name: " Report" }).map((p) => p.rule),
    ).toContain("menuNameSpaces");
  });

  it("clips typed text by characters, not UTF-16 units", () => {
    expect(clip("😀".repeat(33), 32)).toBe("😀".repeat(32));
    expect(clip("ب".repeat(10), 32)).toBe("ب".repeat(10));
  });

  it("lists the editor's keys in the shortcuts screen", () => {
    const screen = readFileSync(
      join(import.meta.dirname, "../Keybinds.tsx"),
      "utf8",
    );
    expect(screen).toContain("Save a command");
    expect(screen).toContain("Leave the command editor");
  });
});
