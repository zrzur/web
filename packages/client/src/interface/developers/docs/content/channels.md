# Channels

Server channels are `TextChannel` (text, also announcement channels) and `VoiceChannel`. A bot also sees the DMs it is part of. Groups are for people only.

## Create and change channels

- `POST /servers/{server}/channels` creates a text or voice channel (needs Manage Channel).
- `PATCH /channels/{target}` renames, sets a description, slowmode, NSFW flag or icon.
- `DELETE /channels/{target}` deletes a server channel. On a DM it closes the DM for the bot.
- `PUT /channels/{target}/permissions/{role_id}` and `.../default` set channel overrides (needs Manage Permissions). See [Roles and permissions](/developers/docs/roles).

Announcement channels only accept messages from members with Manage Messages.

## Threads

A thread is a channel inside a text channel and uses that channel's permissions.

```js
const thread = await bot.threads.create(channelId, { name: "Release", content: "First message" });
await bot.messages.send(thread._id, "In the thread");
await bot.threads.list(channelId);
await bot.threads.archive(thread._id);
```

The same with plain HTTP:

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/threads" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "name": "Release", "content": "First message" }'
```

A thread is a channel, so `POST /channels/{target}/messages` writes into it. `GET /channels/{target}/threads` lists them, and `PATCH /channels/{target}/thread` archives or locks one.

`POST /channels/{id}/threads` starts one from a message (`message`) or with a first message (`content`). A new message reopens an archived thread. Locking needs Manage Messages.

Three permissions decide who starts and writes. Each is read on the parent channel with its overrides, and Send Messages is needed as well: `CreateThreads` starts a thread in a text channel, `CreateForumPosts` starts a post in a forum, and `SendMessageInThreads` writes in threads and forum posts. Without one, the call answers `MissingPermission`. Using a bot command in a thread counts as writing there.

A server can switch threads or forums off: `threads_disabled` and `forums_disabled` in `PATCH /servers/{target}`. Then nobody can add anything, the owner included: messages, edits, reactions and pins answer `ThreadsDisabled` or `ForumsDisabled`. Everything stays readable, and people can still delete their messages and remove reactions.

## Forums

A forum holds posts only. Each post is a thread with a title, a first message and up to five tags.

```js
const forum = await bot.forums.create(serverId, { name: "questions" });
await bot.forums.setTags(forum._id, [{ id: "help", name: "Help" }], { required: true });
await bot.forums.post(forum._id, { title: "How do I start?", content: "Read the guide.", tags: ["help"] });
```

## Invites

Bots create and manage invites like people do, with the same permissions: Invite Others to create one, Manage Server to list and remove them. They never join through one: that answers `IsBot`.

```js
const invite = await bot.invites.create(channelId, { max_uses: 3 });
await bot.invites.list(serverId);
await bot.invites.delete(invite._id);
```

## Typing

`bot.typing(channelId)` shows "is typing…" for a few seconds. It uses the gateway when connected. Without a gateway connection it calls `POST /channels/{id}/typing`, limited to 5 per 10 seconds per channel.

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
