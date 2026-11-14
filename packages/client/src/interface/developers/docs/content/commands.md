# Slash commands

Register commands that people type as `/name`, with options, sub-commands and names in their language.

## You will need {#you-will-need}

Your bot token (`YOUR_BOT_TOKEN`) and its id (`YOUR_BOT_ID`). The bot's id is shown in the Developer Portal, and in `GET /users/@me` as `_id`.

## Global or per server {#scope}

| Scope  | Route                                                         | Reaches                  |
| ------ | ------------------------------------------------------------- | ------------------------ |
| Global | `PUT /applications/{application_id}/commands`                 | Every server with the bot |
| Server | `PUT /applications/{application_id}/servers/{server_id}/commands` | One server               |

A change reaches people at once in both scopes. Use a test server while you build, so that people elsewhere do not see half-finished commands. The bot must be installed in that server.

If the same name exists in both scopes, people see both.

## Register {#register}

`PUT` replaces the whole list. It is the easiest way to keep commands in step with your code: send your list every time the bot starts. Unchanged commands keep their ids. Commands you left out are deleted.

```bash
curl -X PUT "https://api.zrzur.com/applications/YOUR_BOT_ID/commands" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '[{ "name": "ping", "description": "Check that the bot is awake" }]'
```

`POST /applications/{application_id}/commands` adds one command, `PATCH /applications/{application_id}/commands/{command_id}` changes one, `DELETE` removes one. Without code, open your application in the Developer Portal, tab **Commands**: a form adds, changes and deletes commands, with options, choices, names in other languages and who may use them, and shows a preview. **Import JSON** and **Export JSON** there take and give the same list as `PUT`. Saving in the portal replaces the global list, like `PUT`, so a bot that sends its list at start-up overwrites what you saved.

## A command {#fields}

| Field                       | Meaning                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `name`                      | 1 to 32 lowercase letters of any script, digits, `-` or `_`                                             |
| `description`               | 1 to 100 characters. Required for slash commands, empty for the two menu types                          |
| `type`                      | `ChatInput` (default, the `/` command), `User` or `Message` (see below)                                 |
| `options`                   | Up to 25 options                                                                                        |
| `name_localizations`        | Names by language                                                                                       |
| `description_localizations` | Descriptions by language                                                                                |
| `default_member_permissions` | Permission bits a member needs to see and use the command                                              |
| `nsfw`                      | Only usable in channels marked as mature                                                                |

The server fills in `_id`, `application_id` and `version`. `version` changes with each update. A person who still has an older version open gets asked to reload.

## Limits {#limits}

| What                                                  | Limit |
| ----------------------------------------------------- | ----- |
| Slash commands per application and scope              | 100   |
| `User` commands, `Message` commands                   | 5 each |
| Options on each level                                 | 25    |
| Choices of an option                                  | 25    |
| Name, in characters                                   | 32    |
| Description, choice name, choice value                | 100   |
| Localised texts per field                             | 30    |
| All names, descriptions and choices together, translations included | 8000  |

## Options {#options}

```json
{
  "name": "roll",
  "description": "Roll a die",
  "options": [
    {
      "type": "Integer",
      "name": "sides",
      "description": "How many sides",
      "required": true,
      "min_value": 2,
      "max_value": 100
    }
  ]
}
```

| Option `type` | The bot receives                    | Extra fields                                      |
| ------------- | ----------------------------------- | ------------------------------------------------- |
| `String`      | text                                | `min_length`, `max_length` (up to 6000), `choices`, `autocomplete` |
| `Integer`     | a whole number                      | `min_value`, `max_value`, `choices`, `autocomplete` |
| `Number`      | a number                            | `min_value`, `max_value`, `choices`, `autocomplete` |
| `Boolean`     | `true` or `false`                   |                                                   |
| `User`        | a user id                           |                                                   |
| `Role`        | a role id                           |                                                   |
| `Channel`     | a channel id                        | `channel_types`: `Text`, `Voice`                  |
| `Mentionable` | a user or role id                   |                                                   |
| `Attachment`  | a file id                           |                                                   |

The rules the server checks when you register:

- `required` options come before optional ones.
- `choices` and `autocomplete` exclude each other.
- Numbers stay within 9007199254740991, so JavaScript can hold them.

The server checks required options, limits and choices before your bot sees the interaction. For `User`, `Role`, `Channel`, `Mentionable` and `Attachment` the value is an id, and the full object arrives in `command.resolved`, under `users` (with `members` in a server), `roles`, `channels` or `attachments`, keyed by that id.

## Files from an option {#attachments}

An `Attachment` option's value is a file id. The file arrives in `command.resolved.attachments`:

```json
{
  "type": "Command",
  "command": {
    "name": "report",
    "options": [{ "name": "file", "type": "Attachment", "value": "FILE_ID" }],
    "resolved": {
      "attachments": {
        "FILE_ID": {
          "_id": "FILE_ID",
          "tag": "attachments",
          "filename": "screenshot.png",
          "content_type": "image/png",
          "size": 48213,
          "metadata": { "type": "Image", "width": 1280, "height": 720 }
        }
      }
    }
  }
}
```

Download it from `https://cdn.zrzur.com/attachments/FILE_ID/screenshot.png` (the `tag`, the id and the `filename`). The command has used the id, so it cannot go into your bot's own message: that answers `404 NotFound`. To post the file, send its address, or download it and [upload a copy](/developers/docs/files).

## Sub-commands {#sub-commands}

Group actions under one name: `/note add`, `/note list`.

```json
{
  "name": "note",
  "description": "Notes for this server",
  "options": [
    { "type": "SubCommand", "name": "add", "description": "Write a new note" },
    {
      "type": "SubCommandGroup",
      "name": "admin",
      "description": "For moderators",
      "options": [
        { "type": "SubCommand", "name": "clear", "description": "Delete all notes" }
      ]
    }
  ]
}
```

Rules:

- `SubCommand` can hold normal options. A `SubCommandGroup` holds only sub-commands.
- A group sits at the top level. Nothing nests deeper than one group.
- Sub-commands and plain options cannot mix on one level.
- A sub-command takes `name`, `description` and `options`, and nothing else.

The chosen path arrives in the options, and the values inside it:

```json
{
  "name": "note",
  "options": [
    {
      "name": "add",
      "type": "SubCommand",
      "options": [{ "name": "title", "type": "String", "value": "Hello" }]
    }
  ]
}
```

## Names in other languages {#localisation}

Give each text per language. The keys are language tags: `ar`, `de`, `pt-BR`.

```json
{
  "name": "ping",
  "name_localizations": { "ar": "فحص", "de": "pruefen" },
  "description": "Check that the bot is awake",
  "description_localizations": {
    "ar": "تحقق من أن البوت يعمل",
    "de": "Prüfen, ob der Bot läuft"
  }
}
```

Options and choices take the same fields. Localised names follow the same rules as `name`, so Arabic letters are allowed. The interaction always carries the base `name`, so your code has one case per command. It also carries the person's language in `locale`, so you can answer in it.

## Who can use a command {#who}

`default_member_permissions` is a number: add the values of the permissions a member needs, from the [permission table](/developers/docs/roles#permission-bits). A member without all of them does not see the command, and a request gets `MissingPermission`. `256` is Timeout Members; Manage Messages (`8388608`) plus Kick Members (`64`) is `8388672`. In the Developer Portal you pick the permissions from a list instead. Your bot should still check `user_permissions`: an admin can change roles, and a command is not a security wall for what your bot itself does.

The people who run a server can add their own rules for your commands, in the server's settings: allow or deny the whole app or one command for a role, a member or a channel. Those rules are read before `default_member_permissions`; a rule for one command comes before a rule for the app, a rule for a member before one for a role, and a deny on any role beats an allow. The server owner passes member and role rules. In a direct message with the bot there is no server, so only commands without `default_member_permissions` work there.

## Menu commands {#menu-commands}

`"type": "User"` and `"type": "Message"` show a command in the menu of a user or a message. They have no description and no options, and their name can have capitals and spaces. The target arrives in `command.target_id`.

## Common errors {#errors}

| Error                  | Cause                                                | Fix                                         |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `FailedValidation`     | A rule above is broken; `error` says which            | Fix the list. Nothing was saved             |
| `CommandAlreadyExists` | `POST` with a name in use                            | Use `PUT` or `PATCH`                        |
| `TooManyCommands`      | Limit reached                                        | Delete commands                             |
| `UnknownCommand`       | The id is gone                                       | `GET` the list                              |

## Reference {#reference}

The routes are listed under [Answering interactions](/developers/docs/interactions#reference).

## Next {#next}

- [Answering interactions](/developers/docs/interactions)
- [Commands with options](/developers/docs/tutorial-commands)
