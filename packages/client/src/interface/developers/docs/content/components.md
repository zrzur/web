# Buttons, menus and forms

Put buttons and select menus on a message, lay out content in blocks, and ask for input with a form. Only bots can send components.

## You will need {#you-will-need}

The `INTERACTIONS` intent. Each click arrives as an `InteractionCreate` of type `Component`, and each form as `ModalSubmit`. Both have the same 3 seconds as a command: see [the time limits](/developers/docs/interactions#time-limits).

## Buttons {#buttons}

A message has `components`, a list of blocks. An `ActionRow` holds up to five buttons, or one select.

```json
{
  "content": "Heads or tails?",
  "components": [
    {
      "type": "ActionRow",
      "components": [
        { "type": "Button", "style": "Primary", "label": "Heads", "custom_id": "flip:heads" },
        { "type": "Button", "style": "Secondary", "label": "Tails", "custom_id": "flip:tails" },
        { "type": "Button", "style": "Link", "label": "Rules", "url": "https://example.com/rules" }
      ]
    }
  ]
}
```

| Field       | Meaning                                                                       |
| ----------- | ----------------------------------------------------------------------------- |
| `style`     | `Primary`, `Secondary`, `Success`, `Danger`, or `Link`                        |
| `label`     | Up to 80 characters. A button needs a `label` or an `emoji`                   |
| `emoji`     | Up to 32 characters, no spaces                                                |
| `custom_id` | Up to 100 characters, sent back to your bot, unique in the message. Not with `Link` |
| `url`       | Only with `Link`. Opens the address and produces no interaction               |
| `disabled`  | Shown but not usable                                                          |
| `restrict`  | Who may use it, see below                                                     |

Put what you need in `custom_id`, such as `flip:heads` or `note:3`, and it comes back in `interaction.component.custom_id`. Answer with `UpdateMessage` to change the message, or `Message` for a new one.

A thread's first message can carry components too; see [Channels and webhooks](/developers/docs/channels#threads).

## Who may click {#restrict}

```json
{ "restrict": { "users": ["USER_ID"], "roles": ["ROLE_ID"] } }
```

Up to 25 ids each. The server refuses clicks from anyone else, so your bot never sees them. Not for `Link` buttons, or for fields in forms.

## Select menus {#selects}

| `type`              | Offers                     | Extra fields                 |
| ------------------- | -------------------------- | ---------------------------- |
| `StringSelect`      | Your own list              | `options`, 1 to 25           |
| `UserSelect`        | Members                    | `default_values`             |
| `RoleSelect`        | Roles                      | `default_values`             |
| `MentionableSelect` | Members and roles          | `default_values`             |
| `ChannelSelect`     | Channels                   | `default_values`, `channel_types` |

All take `custom_id`, `placeholder` (up to 150), `min_values` and `max_values` (0 to 25, default 1), `disabled` and `restrict`.

An entry of `options` has `label` and `value` (each up to 100, one line), and may have `description`, `emoji` and `default`. Values are unique.

```json
{
  "type": "ActionRow",
  "components": [
    {
      "type": "StringSelect",
      "custom_id": "colour",
      "placeholder": "Pick a colour",
      "options": [
        { "label": "Red", "value": "red" },
        { "label": "Blue", "value": "blue" }
      ]
    }
  ]
}
```

The choice arrives in `interaction.component.values`. Users, roles and channels also come as objects in `interaction.component.resolved`.

## Layout blocks {#blocks}

| `type`      | Fields                                                     | Shows                                  |
| ----------- | ---------------------------------------------------------- | -------------------------------------- |
| `ActionRow` | `components`                                               | Buttons or one select                  |
| `Text`      | `content`                                                  | Markdown text                          |
| `Section`   | `text` (1 to 3), `button` or `thumbnail`                   | Paragraphs with something at the end   |
| `Gallery`   | `items` (1 to 10)                                          | Images in a grid                       |
| `File`      | `attachment`, `spoiler`                                    | A file of this message, in place       |
| `Separator` | `divider`, `spacing` (`Small`, `Large`)                    | A gap                                  |
| `Container` | `components`, `accent` (`#RRGGBB`), `spoiler`              | A card around other blocks             |

An image has either `url` or `attachment` (the id of a file on the same message), and may have `description` and `spoiler`. Containers do not nest.

## Limits of a message {#limits}

| What                                                  | Limit |
| ----------------------------------------------------- | ----- |
| Rows at the top level, and inside one container       | 5     |
| Blocks and components together, nested ones included  | 40    |
| Buttons in a row                                      | 5     |
| All text of `Text` and `Section` blocks together      | 4000  |

Clients that do not know a block skip it. Webhooks of no bot can post only blocks nobody can use: text, images, link buttons.

## Forms {#forms}

A form, or modal, opens on the person's screen as the answer to a command or a click. It cannot be the answer to another form, or to autocomplete.

```json
{
  "type": "Modal",
  "modal": {
    "custom_id": "note-form",
    "title": "New note",
    "components": [
      {
        "type": "Field",
        "label": "Title",
        "description": "Short and clear.",
        "component": {
          "type": "TextInput",
          "custom_id": "title",
          "style": "Short",
          "max_length": 80
        }
      }
    ]
  }
}
```

`title` has up to 45 characters. A form has up to 5 fields, and up to 10 blocks with `Text`. A `Field` has `label`, `description` (up to 100) and one `component`:

| `component.type` | Fields                                                              | Value arrives in |
| ---------------- | ------------------------------------------------------------------- | ---------------- |
| `TextInput`      | `style` (`Short`, `Paragraph`), `placeholder`, `required`, `min_length`, `max_length` (up to 4000), `value` | `value` |
| `RadioGroup`     | `options` (up to 10), `required`                                    | `value`          |
| `CheckboxGroup`  | `options` (up to 10), `min_values`, `max_values`, `required`        | `values`         |
| `Checkbox`       | `default`                                                           | `checked`        |
| `FileUpload`     | `min_values`, `max_values` (up to 10), `file_types`, `required`     | `values`, file ids |
| A select         | as above                                                            | `values`         |

`required` is `true` unless you say otherwise. `file_types` lists `image`, `video`, `audio` or an extension such as `.pdf`.

When the person sends the form you get an interaction of type `ModalSubmit`:

```json
{
  "custom_id": "note-form",
  "fields": [{ "custom_id": "title", "value": "Hello" }]
}
```

Answer it within 3 seconds. `UpdateMessage` works only if the form was opened from a button.

A person can close a form and your bot hears nothing, so do not wait for it.

## Common errors {#errors}

| Error              | Cause                                              | Fix                                    |
| ------------------ | -------------------------------------------------- | -------------------------------------- |
| `FailedValidation` | A limit or a rule; `error` says which              | Fix the components                     |
| `InvalidOperation` | `Modal` as the answer to a form                    | Answer with `Message`                  |
| `IsBot`            | A bot tried to click                               | Only people use components             |

## Next {#next}

- [Build a complete bot](/developers/docs/tutorial-full-bot)
- [Games with buttons](/developers/docs/tutorial-games)
