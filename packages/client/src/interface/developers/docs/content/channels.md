# Channels

Every server channel has `channel_type: "TextChannel"`: text, voice (with `voice`), announcement, forum (with `forum`) and thread (with `parent` and `thread`). A bot also sees the direct messages it is part of (`DirectMessage`). Groups are for people only. The [Event reference](/developers/docs/events#channels) lists the fields and shows how to tell a direct message from a server channel.

The examples use plain HTTP. The SDK lines after them need the SDK, which is not published yet; see [SDKs](/developers/docs/sdk).

## Create and change channels

`POST /servers/{server}/channels` creates a channel (needs Manage Channel). A staff-only ticket channel in a category:

```bash
curl -X POST "https://api.zrzur.com/servers/SERVER_ID/channels" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "type": "Text", "name": "ticket-0001", "description": "Support ticket", "category": "CATEGORY_ID", "private": true }'
```

| Field          | Meaning                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `type`         | `Text` (the default), `Voice` or `Forum`                                                                    |
| `name`         | 1 to 32 characters                                                                                          |
| `description`  | Up to 1024 characters                                                                                       |
| `nsfw`         | Only for adults                                                                                             |
| `announcement` | Text channels: only members with Manage Messages post                                                       |
| `category`     | Id of a category of this server. The channel follows the category's permissions. A category the server does not have answers `404 NotFound`, and nothing is made |
| `private`      | `true` denies View Channel to `@everyone` in this channel, and it does not follow its category's permissions. Roles that have View Channel, in the server or in this channel, still see it |

The answer is the new channel. Check that a role of your bot has View Channel, or your bot cannot use a private channel it made. To let the staff in, give their role View Channel on the channel with `PUT /channels/{target}/permissions/{role_id}`.

- `PATCH /channels/{target}` renames, sets a description, slowmode, NSFW flag or icon.
- `DELETE /channels/{target}` deletes a server channel. On a DM it closes the DM for the bot.
- `PUT /channels/{target}/permissions/{role_id}` and `.../default` set channel overrides (needs Manage Permissions). See [Roles and permissions](/developers/docs/roles).

Announcement channels only accept messages from members with Manage Messages.

## Threads

A thread is a channel inside a text channel and uses that channel's permissions. Start one with a name and a first message:

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/threads" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "name": "Release", "content": "First message" }'
```

The answer is the thread: a channel with `parent` set. So `POST /channels/{target}/messages` writes into it. `GET /channels/{target}/threads` lists them, and `PATCH /channels/{target}/thread` archives or locks one.

`POST /channels/{target}/threads` starts one from a message (`message`), with a first message (`content`), or empty (only `name`). A new message reopens an archived thread. Locking needs Manage Messages.

The first message follows the rules of every message your bot sends:

- It takes `content` only, up to 2000 characters. Other fields, such as `embeds`, `components` or `attachments`, are ignored without an error: the thread starts with the text alone. `embeds` and `components` come in the next release (see the [changelog](/developers/docs/changelog#upcoming)).
- Send Messages and the mention rules apply. A role mention without Mention Roles, or `@everyone` without Mention Everyone, refuses the whole call with `403 MissingPermission`, and no thread is kept. The thread is made first and removed again, so your bot can get `ChannelCreate` and then `ChannelDelete` for it. Start the thread without the ping, then ping in a second message.
- On a self-hosted server whose operator set `mass_mentions_enabled = false`, role, `@everyone` and `@online` mentions are not refused: the message is sent and nobody is notified.

For a card with buttons at the top of a thread, start the thread with only a name, then send the card into it:

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/threads" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "name": "ticket-0001" }'
# answer: { "_id": "THREAD_ID", "channel_type": "TextChannel", "parent": "CHANNEL_ID", ... }

curl -X POST "https://api.zrzur.com/channels/THREAD_ID/messages" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "embeds": [{ "title": "Ticket 0001", "description": "Opened by <@USER_ID>" }], "components": [{ "type": "ActionRow", "components": [{ "type": "Button", "style": "Danger", "label": "Close ticket", "custom_id": "ticket:close" }] }] }'
```

With the SDK:

```js
const thread = await bot.threads.create(channelId, { name: "Release", content: "First message" });
await bot.messages.send(thread._id, "In the thread");
await bot.threads.list(channelId);
await bot.threads.archive(thread._id);
```

Three permissions decide who starts and writes. Each is read on the parent channel with its overrides, and Send Messages is needed as well: `CreateThreads` starts a thread in a text channel, `CreateForumPosts` starts a post in a forum, and `SendMessageInThreads` writes in threads and forum posts. Without one, the call answers `MissingPermission`. Using a bot command in a thread counts as writing there.

A server can switch threads or forums off: `threads_disabled` and `forums_disabled` in `PATCH /servers/{target}`. Then nobody can add anything, the owner included: messages, edits, reactions and pins answer `ThreadsDisabled` or `ForumsDisabled`. Everything stays readable, and people can still delete their messages and remove reactions.

## Forums

A forum holds posts only. Each post is a thread with a title, a first message and up to five tags. Make a forum with `"type": "Forum"` in `POST /servers/{server}/channels`, and post into it:

```bash
curl -X POST "https://api.zrzur.com/channels/FORUM_ID/threads" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "name": "How do I start?", "content": "Read the guide.", "tags": ["help"] }'
```

A post needs `content`, and its `tags` must be tags of that forum. With the SDK:

```js
const forum = await bot.forums.create(serverId, { name: "questions" });
await bot.forums.setTags(forum._id, [{ id: "help", name: "Help" }], { required: true });
await bot.forums.post(forum._id, { title: "How do I start?", content: "Read the guide.", tags: ["help"] });
```

## Invites

Bots create and manage invites like people do, with the same permissions: Invite Others to create one, Manage Server to list and remove them. They never join through one: that answers `IsBot`.

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/invites" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "max_uses": 3 }'
```

The answer has the invite code in `_id`. `GET /servers/{target}/invites` lists them and `DELETE /invites/{target}` removes one. With the SDK:

```js
const invite = await bot.invites.create(channelId, { max_uses: 3 });
await bot.invites.list(serverId);
await bot.invites.delete(invite._id);
```

## Typing

`POST /channels/{target}/typing` shows "is typing…" for a few seconds, limited to 5 per 10 seconds per channel. The SDK's `bot.typing(channelId)` uses the gateway when connected, and this route without one.

## Webhooks

A webhook posts into one channel without a gateway connection. Create one with a bot token or in server settings (needs Manage Webhooks). The answer has `token` and `url`. They are shown once: the server keeps only a hash, so save them now. A lost token can only be replaced.

```bash
curl -X POST "https://api.zrzur.com/webhooks/$WEBHOOK_ID/$WEBHOOK_TOKEN?wait=true" \
  -H "content-type: application/json" \
  -d '{"content": "Build finished", "username": "CI"}'
```

Anyone with the address can post, so treat it like a password. Tokens start with `zrzur_wh_`, so secret scanners can find a leaked one. `POST /webhooks/{webhook_id}/token` makes a new token; the old one stops at once.

### Sending

`POST /webhooks/{webhook_id}/{token}` answers `204`. With `?wait=true` it returns the message.

| Field              | Meaning                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `content`          | Up to 2000 characters. A message needs at least one of `content`, `embeds`, `attachments`, `components`        |
| `username`         | Name on this message, 1 to 80 characters. The webhook mark stays                                               |
| `avatar_url`       | Avatar on this message, a public web address. Clients load it through the media proxy, which checks it          |
| `embeds`           | Up to 10, 6000 characters in total. `type` is ignored: embeds are always rich                                  |
| `allowed_mentions` | Which mentions may notify anyone. `{ "parse": [] }` turns them all off                                         |
| `flags`            | `4` hides link previews, `4096` sends without a notification                                                   |
| `thread_id`        | Query parameter: post into this thread of the webhook's channel                                                |
| `thread_name`      | Forum: start a thread with this name. `applied_tags` sets its tags. A forum without either answers `ForumThreadRequired` |

Embeds take `title` (256), `description` (4096), `url`, `color` (a number) or `colour` (CSS text), `timestamp`, `author` (name 256), `footer` (text 2048), up to 25 `fields` (name 256, value 1024), `image.url`, `thumbnail.url`.

To send files, use `multipart/form-data` with `files[0]`, `files[1]`, ... and the JSON body in `payload_json`. Each file passes the same checks as a member's upload. Up to 5 files of 20 MB; refer to one from an embed with `attachment://name.png`. A webhook without Upload Files gets `403`, never a message without its files.

`@everyone`, `@online` and role mentions notify people only if the webhook has the matching permission and `allowed_mentions` allows them. New webhooks have neither permission, and the text is still posted. Edits never notify anyone.

Interactive components work only on webhooks a bot created, and clicks go to that bot. Other webhooks can post links, text and media.

### Editing a webhook

`PATCH /webhooks/{webhook_id}` with Manage Webhooks changes the name, avatar, permissions and channel, and takes `X-Audit-Log-Reason`. With the token, `PATCH /webhooks/{webhook_id}/{token}` changes only the name and avatar; `permissions` or `channel_id` there answer `403`. `GET` with the token leaves out who made it. Names have 1 to 80 characters and cannot contain hidden characters or pass for Zrzur, its staff or a verified bot.

### Its own messages

`GET`, `PATCH` and `DELETE /webhooks/{webhook_id}/{token}/messages/{message_id}` work on messages this webhook sent, and no others.

In a thread a webhook needs `SendMessageInThreads`, and `CreateForumPosts` to start a forum post. What the roles of its creator deny is denied to it too. Where threads or forums are switched off it can't send or edit, but it can delete its own messages.

### Limits

Each channel has up to 15 webhooks (`TooManyChannelWebhooks`) and each server up to 1000 (`TooManyServerWebhooks`).

One webhook sends 5 messages in 2 seconds, and all webhooks of a channel 30 a minute. Over that, the answer is `429` with `{ "type": "RateLimited", "retry_after": 1200, "global": false }` (milliseconds) and the `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-After` and `Retry-After` headers. After 20 wrong tokens in a minute an address waits, even with a right token.

AutoMod reads webhook messages and their embeds, on edits too. Moderators can delete and report them like any message.

### Other formats

- `POST /webhooks/{webhook_id}/{token}/github` takes GitHub deliveries: set the content type to `application/json` or form. It shows `commit_comment`, `create`, `delete`, `fork`, `issue_comment`, `issues`, `member`, `public`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `push`, `release`, `watch`, `check_run`, `check_suite`, `discussion`, `discussion_comment` and `star`. Every other event answers `204`.
- `POST /webhooks/{webhook_id}/{token}/slack` takes `text`, `attachments`, `blocks`, `username` and `icon_url`. It returns the message unless `?wait=false`.

Nothing from these two formats notifies anyone.

## Reference

```endpoints channels

```
