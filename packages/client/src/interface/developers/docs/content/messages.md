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
- **Components**: buttons, selects and layout blocks; only bots can send them. See [Buttons, menus and forms](/developers/docs/components).
- **Mentions**: `<@user id>` pings a user, `<%role id>` a role (needs Mention Roles), `@everyone` pings every member who can see the channel and `@here` only those who are online (`@online` is the same); both need Mention Everyone. Without the permission the whole message is refused with `MissingPermission`, it is not sent without the ping. On a self-hosted server with `mass_mentions_enabled = false`, role, `@everyone` and `@here` mentions are sent without notifying anyone instead.
- **Formatting**: bold, underline, headings, spoilers, coloured code and more, see [Formatting](/developers/docs/messages#formatting).
- **Channel links**: `<#channel id>` shows a link to a channel or thread. It notifies nobody.

## Reply {#reply}

`replies` answers earlier messages, up to 5. `id` is the message, `mention` says whether its author gets a ping, and `fail_if_not_exists: false` still sends if that message is gone.

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/messages" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "content": "Thanks!", "replies": [{ "id": "MESSAGE_ID", "mention": false }] }'
```

## Edit and delete {#edit}

`PATCH /channels/{target}/messages/{msg}` takes `content`, `embeds` and `components`. A bot edits only its own messages. `DELETE /channels/{target}/messages/{msg}` deletes the bot's own, or any message with Manage Messages. An edit never pings anyone again. `DELETE /channels/{target}/messages/{msg}/embeds` removes the link previews from a message for everyone and keeps them from coming back; the author can do it, and so can anyone with Manage Messages. Embeds a bot sent on purpose stay.

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

A message refers to files by id. Upload first, then send. Each id can be used once: a second use answers `404 NotFound`. Sending needs Upload Files. A file a person gave your bot through a command's `Attachment` option is already used by that command; see [Slash commands](/developers/docs/commands#attachments).

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

`GET /channels/{target}/messages` returns 50 messages, or up to 100 with `limit`. Reading needs View Channel and Read Message History.

| Query           | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `limit`         | 1 to 100. Default 50                                                                      |
| `before`        | A message id: only older messages                                                         |
| `after`         | A message id: only newer messages                                                         |
| `sort`          | `Latest` (the default, newest first) or `Oldest` (oldest first). `Relevance` answers `InvalidOperation` |
| `nearby`        | A message id: messages around it, that message included. `before`, `after` and `sort` are ignored |
| `include_users` | `true` adds the authors                                                                   |

The answer is a list of messages. With `include_users=true` it is an object instead: `{ "messages": [...], "users": [...], "members": [...] }`. `members` is there in server channels only.

To catch up after a reconnect, ask for `after` your last message with `sort=Oldest`: you get the next messages in order. With the default order you would get the newest ones, and a gap would stay in the middle. Repeat with the id of the last message you got until fewer than `limit` come back.

```bash
curl "https://api.zrzur.com/channels/CHANNEL_ID/messages?after=LAST_SEEN_ID&sort=Oldest&limit=100" \
  -H "x-bot-token: YOUR_BOT_TOKEN"
```

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

## Polls {#polls}

A message can carry a poll (`poll` in the message you send: a question, 2 to 10 answers, a duration of 1, 4, 8, 24, 72, 168 or 336 hours, single or multiple choice). Posting one needs Send Messages and Send Embeds. Polls are switched on per server installation (`features.polls` in `GET /`); where they are off, sending one answers `FeatureDisabled`. A message's `poll` shows how many chose each answer; `poll.me` lists the answers the reader chose.

Who voted is never sent to everyone: poll events (`MessagePollVoteAdd`, `MessagePollVoteRemove`, `MessagePollEnd`) carry counts only. `/channels/{target}/messages/{msg}/polls/answers/{answer}/voters` (GET) lists the people who chose an answer, a page at a time, to anyone who can read the message (View Channel and Read Message History), so a voter is visible to everyone in the channel who asks. Bots cannot vote (`IsBot`); they can read voters and end their own polls (`/channels/{target}/messages/{msg}/polls/end`, POST). A vote on a poll that has ended answers `PollEnded`.

## Formatting {#formatting}

Message text, embed descriptions and field values, and `Text` components take the same formatting people type, the same marks as Discord:

- `**bold**`, `*italic*` (or `_italic_`), `__underline__`, `~~strikethrough~~`, and together, such as `__***~~all~~***__`.
- `# Title`, `## Section` and `### Heading` at the start of a line; `-# small text` for a small, muted line.
- `> quote` quotes one line; `>>> quote` quotes everything after it, to the end of the message.
- `- item`, `* item` and `1. item` make lists; two spaces in front nest an item.
- `||spoiler||` hides text until it is clicked.
- `[text](https://zrzur.com)` is a link with its own text.
- `` `code` `` and code blocks with a language for highlighting (`js`, `python`, `json`…). `diff` colours `-` and `+` lines, `fix` writes the block in yellow, `ansi` colours text (below).
- `<t:1796151600:R>` shows a moment in each reader's own time zone and language. The letter picks the form: `t`, `T`, `d`, `D`, `f`, `F`, `s`, `S` or `R` (in 3 days).
- `\` in front of a mark writes the mark itself: `\*not italic\*`.

People can also type `/shrug`, `/tableflip`, `/unflip`, `/me` and `/spoiler`. These change their own text before it is sent and never reach a bot; where a bot has a command with the same name, the bot's command is used.

### Coloured text {#ansi}

In a code block marked `ansi`, codes written as ESC `[` number `m` colour the text after them: `30` to `37` the text (grey, red, green, yellow, blue, pink, cyan, white), `40` to `47` the background, `1` bold, `4` underline, `0` back to plain. ESC is the character `\u001b`.

```js
const esc = "\u001b[";
const fence = "`".repeat(3);
await channel.sendMessage(
  `${fence}ansi\n${esc}31mFailed${esc}0m 2  ${esc}32mPassed${esc}0m 40\n${fence}`,
);
```
