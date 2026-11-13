# Answering interactions

Every use of a slash command, a menu command, a button, a select, a form or autocomplete reaches your bot as an **interaction**. This page shows how to answer in time.

## You will need {#you-will-need}

A running gateway connection with the `INTERACTIONS` intent, or an [HTTP address](/developers/docs/http-interactions). Commands work in server channels, and in a direct message with the bot for its global commands that need no server permission. Buttons, selects and forms work in that direct message too; `server_id` and `member` are then absent.

## The time limits {#time-limits}

| Limit                                    | Time       | What happens after it                                                   |
| ---------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| First answer                             | 3 seconds  | The person sees that the bot did not answer. A late callback gets `InteractionExpired` |
| Edits and follow-ups                     | 15 minutes | The token stops working: `InteractionExpired` or `UnknownInteraction`   |

The event carries both as `respond_by` and `expires_at`. Follow the event's times, not your own clock.

If the work takes longer than a moment, answer `DeferredMessage` first. It shows "thinking" and gives you the 15 minutes.

If your bot is not connected when someone uses a command, the event is lost, and the person sees the failure after 3 seconds.

## The event {#the-event}

```json
{
  "type": "InteractionCreate",
  "interaction": {
    "_id": "01JC0000000000000000000013",
    "version": 1,
    "application_id": "01JC0000000000000000000001",
    "type": "Command",
    "token": "YOUR_INTERACTION_TOKEN",
    "user": { "_id": "01JC0000000000000000000012", "username": "example_user" },
    "member": { "_id": { "server": "01JC0000000000000000000003", "user": "01JC0000000000000000000012" } },
    "server_id": "01JC0000000000000000000003",
    "channel_id": "01JC0000000000000000000004",
    "user_permissions_string": "2276038022144",
    "app_permissions_string": "4398045478879",
    "locale": "ar",
    "command": { "id": "01JC0000000000000000000014", "name": "ping", "type": "ChatInput", "options": [] },
    "respond_by": "2026-11-06T07:04:12.432Z",
    "expires_at": "2026-11-06T07:19:09.432Z"
  }
}
```

| Field                     | Meaning                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `type`                    | `Command`, `Component`, `ModalSubmit` or `Autocomplete`                                |
| `token`                   | Valid for this interaction only. Treat it like a password until `expires_at`           |
| `user`, `member`          | Who did it                                                                             |
| `user_permissions_string` | Their permissions in this channel. Use this one in JavaScript, not `user_permissions`  |
| `app_permissions_string`  | Your bot's permissions in this channel                                                 |
| `locale`                  | Their language, if the app sent it                                                     |
| `command`                 | With `Command` and `Autocomplete`: `name`, `options`, `resolved`, `target_id`, `focused` |
| `component`               | With `Component`: `custom_id`, `component_type`, `values`, `resolved`                  |
| `modal`                   | With `ModalSubmit`: `custom_id`, `fields`, `resolved`                                  |
| `message_id`              | The message the component is on                                                        |
| `message_ephemeral`       | `true` when that message is private                                                    |

The permission numbers are too large for a JavaScript number, so read them as `BigInt`:

```js
const canTimeout = (BigInt(interaction.user_permissions_string) >> 8n) & 1n;
```

## Answer {#answer}

Send one first answer. No token header is needed: the path holds the token.

```bash
curl -X POST "https://api.zrzur.com/interactions/INTERACTION_ID/YOUR_INTERACTION_TOKEN/callback" \
  -H "content-type: application/json" \
  -d '{ "type": "Message", "data": { "content": "Pong!" } }'
```

| Callback `type`      | When                                                                              | Body                               |
| -------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| `Message`            | Reply now                                                                         | `data`                             |
| `DeferredMessage`    | The work takes longer than 3 seconds. Shows "thinking"                            | `data.ephemeral` if it stays private |
| `UpdateMessage`      | Buttons and selects: change the message the component is on                       | `data`                             |
| `DeferredUpdate`     | Buttons and selects: acknowledge now, change the message later                    | none                               |
| `Modal`              | Open a form. Not as an answer to a form or to autocomplete                        | `modal`                            |
| `AutocompleteResult` | Suggestions. The only answer to `Autocomplete`                                    | `choices`, up to 25                |

`data` takes `content`, `embeds`, `components` and `ephemeral`. Answering twice gets `InteractionAlreadyAcknowledged`.

## Private replies {#ephemeral}

`"ephemeral": true` shows a reply to that person only. It is never stored in the channel, so it disappears when they reload. The choice is made once: a deferred answer stays as private as you said when deferring.

## Deferred replies {#deferred}

```bash
# 1. within 3 seconds
curl -X POST "https://api.zrzur.com/interactions/INTERACTION_ID/YOUR_INTERACTION_TOKEN/callback" \
  -H "content-type: application/json" \
  -d '{ "type": "DeferredMessage", "data": { "ephemeral": true } }'

# 2. within 15 minutes
curl -X PATCH "https://api.zrzur.com/interactions/INTERACTION_ID/YOUR_INTERACTION_TOKEN/original" \
  -H "content-type: application/json" \
  -d '{ "content": "Done." }'
```

## Follow-ups {#follow-ups}

After the first answer you can send up to 5 more messages for the same interaction, until the token ends:

```bash
curl -X POST "https://api.zrzur.com/interactions/INTERACTION_ID/YOUR_INTERACTION_TOKEN/followups" \
  -H "content-type: application/json" \
  -d '{ "content": "One more thing.", "ephemeral": true }'
```

The answer has the new message's `_id`. A follow-up has its own `ephemeral` choice, and cannot come after a `Modal` answer.

| To                       | Route                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| Edit the first answer    | `PATCH /interactions/{interaction_id}/{token}/original`            |
| Delete the first answer  | `DELETE /interactions/{interaction_id}/{token}/original`           |
| Edit a follow-up         | `PATCH /interactions/{interaction_id}/{token}/messages/{message_id}` |
| Delete a follow-up       | `DELETE /interactions/{interaction_id}/{token}/messages/{message_id}` |

## Autocomplete {#autocomplete}

An option with `"autocomplete": true` asks your bot for suggestions while the person types. `command.focused` names the option, and its `value` holds the text so far, up to 100 characters.

```json
{
  "type": "AutocompleteResult",
  "choices": [{ "name": "Apricot", "value": "apricot" }]
}
```

Answer quickly, as each keystroke can send one. An `Autocomplete` interaction takes only this answer, and no others take it.

## Common errors {#errors}

| Error                            | Cause                                            | Fix                                                |
| -------------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `InteractionExpired`             | Over the 3 seconds, or the 15 minutes             | Defer first                                        |
| `InteractionAlreadyAcknowledged` | A second first answer                            | Use a follow-up, or edit                           |
| `InvalidOperation`               | The answer does not fit, such as `UpdateMessage` on a command | Check the table above               |
| `TooManyFollowups`               | More than 5                                      | Edit a message instead                             |
| `UnknownInteraction`             | Wrong id or token                                | Use the event's values                             |

## Reference {#reference}

```endpoints interactions

```

## Next {#next}

- [Buttons, menus and forms](/developers/docs/components)
- [Build a complete bot](/developers/docs/tutorial-full-bot)
