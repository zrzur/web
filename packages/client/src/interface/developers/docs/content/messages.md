# Messages

A bot sends, edits and deletes its own messages, reacts, pins, and, with **Manage Messages**, deletes other people's messages.

## Send a message

```json
POST /channels/{target}/messages
{
  "content": "Hello!",
  "embeds": [{ "title": "Rules", "description": "Be kind.", "colour": "#E0195F" }],
  "replies": [{ "id": "01J…", "mention": false }],
  "attachments": ["<file id from the file server>"]
}
```

- **Limits**: `GET /` lists them for each server (by default 2000 characters, 5 attachments, 10 embeds, 5 replies, 20 different reactions per message).
- **Idempotency**: send an `Idempotency-Key` header with a unique value. If the request is retried with the same key, the message is not sent twice.
- **Silent messages**: `flags: 1` sends without push or desktop notifications.
- **Masquerade**: `masquerade: { name, avatar }` shows another name and avatar on the message (needs Masquerade; a `colour` also needs Manage Roles).
- **Components**: buttons, selects and layout blocks; only bots can send them. See [Commands and interactions](/developers/docs/components).
- **Mentions**: `<@user id>` pings a user, `<%role id>` a role (needs Mention Roles), `@everyone` and `@online` need Mention Everyone.

## Reply {#reply}

`replies` answers earlier messages, up to 5. `id` is the message, `mention` says whether its author gets a ping, and `fail_if_not_exists: false` still sends if that message is gone.

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/messages" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "content": "Thanks!", "replies": [{ "id": "MESSAGE_ID", "mention": false }] }'
```

## Edit and delete {#edit}

`PATCH /channels/{target}/messages/{msg}` takes `content`, `embeds` and `components`. A bot edits only its own messages. `DELETE /channels/{target}/messages/{msg}` deletes the bot's own, or any message with Manage Messages. An edit never pings anyone again.

## Embeds {#embeds}

An embed is a card under the message. Sending one needs Send Embeds.

| Field           | Meaning                                       |
| --------------- | --------------------------------------------- |
| `title`         | Title                                         |
| `description`   | Text, with Markdown                           |
| `url`           | Address the title links to                    |
| `colour`        | A CSS colour, such as `#E0195F`               |
| `icon_url`      | Small image next to the title                 |
| `media`         | Id of a file you uploaded, shown as an image  |
| `image_url`     | Address of a large image                      |
| `thumbnail_url` | Address of a small image at the side          |
| `author`        | `name`, `url`, `icon_url`                     |
| `fields`        | Up to 25, each with `name`, `value`, `inline` |
| `footer`        | `text`, `icon_url`                            |
| `timestamp`     | A date, shown at the bottom                   |

The exact fields and limits are in the [reference below](/developers/docs/messages#post-channels-target-messages).

## Attachments {#attachments}

A message refers to files by id. Upload first, then send. Each id can be used once: a second use answers `404 NotFound`. Sending needs Upload Files.

```bash
curl -X POST "https://cdn.zrzur.com/attachments" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -F "file=@report.csv;type=text/csv"
# answer: { "id": "FILE_ID" }

curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/messages" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "content": "Here it is", "attachments": ["FILE_ID"] }'
```

See [Files](/developers/docs/files) for sizes and types.

## Read messages

`GET /channels/{target}/messages` returns up to 100 messages; page with `before`, `after` or `nearby`. Add `include_users=true` to get the authors in the same response. Reading needs View Channel and Read Message History.

Text search is for people only; bots get `IsBot`, because it would let them read what their intents hide. Bots can list pinned messages (see [Pins and reactions](/developers/docs/messages#pins-and-reactions)). The mentions inbox is for people only too.

## Bulk delete

`DELETE /channels/{target}/messages/bulk` deletes up to 100 messages at once. Messages older than a week cannot be bulk deleted; delete them one by one.

## Direct messages

`GET /users/{target}/dm` opens (or returns) the DM channel with a user. Whether the bot may write there depends on that person's privacy settings and blocks, see [Users and members](/developers/docs/users#privacy-limits).

## Reference

```endpoints messages

```

## Pins and reactions

`PUT /channels/{target}/messages/{msg}/reactions/{emoji}` adds the bot's reaction, and `DELETE` on the same path removes it. The emoji is written in the path, URL-encoded (`%F0%9F%91%8D` for a thumbs up), or as the id of a custom emoji. `POST /channels/{target}/messages/{msg}/pin` pins a message. `POST /channels/{target}/search` with `pinned: true` lists pinned messages. Other search is for people only: bots get `IsBot`, because it would let them read what their intents hide.
