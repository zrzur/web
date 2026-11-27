# Channels

Every server channel has `channel_type: "TextChannel"`: text, voice (with `voice`), announcement, forum (with `forum`) and thread (with `parent` and `thread`). A bot also sees the direct messages it is part of (`DirectMessage`). Groups are for people only. The [Event reference](/developers/docs/events#channels) lists the fields and shows how to tell a direct message from a server channel.

The examples use plain HTTP. The SDK lines after them need `@zrzur/sdk` (`npm install @zrzur/sdk`); see [SDKs](/developers/docs/sdk).

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

- It takes `content` (up to 2000 characters), `embeds` and `components`. Other message fields, such as `attachments`, are ignored without an error. Embeds need Send Embeds. A forum post still needs `content`.
- Send Messages and the mention rules apply. A role mention without Mention Roles, or `@everyone` without Mention Everyone, refuses the whole call with `403 MissingPermission`, and no thread is kept. The thread is made first and removed again, so your bot can get `ChannelCreate` and then `ChannelDelete` for it. Start the thread without the ping, then ping in a second message.
- On a self-hosted server whose operator set `mass_mentions_enabled = false`, role, `@everyone` and `@here` mentions are not refused: the message is sent and nobody is notified.

A card with buttons can be the first message of a thread:

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/threads" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "name": "ticket-0001", "embeds": [{ "title": "Ticket 0001", "description": "Opened by <@USER_ID>" }], "components": [{ "type": "ActionRow", "components": [{ "type": "Button", "style": "Danger", "label": "Close ticket", "custom_id": "ticket:close" }] }] }'
# answer: { "_id": "THREAD_ID", "channel_type": "TextChannel", "parent": "CHANNEL_ID", ... }
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

A webhook posts into one channel without a bot or a gateway connection: a CI job, a form or a feed. Making them, sending through them, their limits and their events have their own page: [Webhooks](/developers/docs/webhooks).

## Reference

```endpoints channels

```
