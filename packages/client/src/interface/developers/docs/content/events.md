# Event reference

Every event a bot can receive, with its fields. The samples were recorded from a running server, then ids were replaced.

Events arrive as JSON objects with a `type`. Fields marked as not always there are left out when empty. A few events carry an object directly, so `Message` has `content` next to `type`.

Other events exist for the Zrzur apps. Bots never receive them, so they are not listed here. `GET /gateway/schema` has them all.

```events

```

## Types {#types}

The objects named in the tables above. Dates are ISO 8601 text. Ids are 26 characters long.

```types

```

## Channels and direct messages {#channels}

A `Message` names its channel in `channel` and has no `server` field. To know where it was written, look the channel up. Keep the channels from `Ready` (`channels`) and from `ChannelCreate`, change them on `ChannelUpdate` and drop them on `ChannelDelete`. For a channel you do not know yet, call `GET /channels/{target}`.

| `channel_type`  | What it is                                                         | Fields to read                                                                               |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `TextChannel`   | A channel of a server: text, voice, announcement, forum or thread  | `server`. `voice` is set on a voice channel, `forum` on a forum, `parent` and `thread` on a thread |
| `DirectMessage` | A direct message between your bot and one person                   | `recipients` (two user ids: your bot and the person), `active`, `last_message_id`             |
| `Group`         | A group of people. Bots are not added to groups                    | `recipients`, `owner`, `name`                                                                |
| `SavedMessages` | A person's own notes. Bots never see them                          | `user`                                                                                       |

A message is a direct message when its channel's `channel_type` is `DirectMessage`. The person is the id in `recipients` that is not your bot's.

```json
{
  "channel_type": "DirectMessage",
  "_id": "01J0000000000000000000DM00",
  "active": true,
  "recipients": ["01J00000000000000000000BOT", "01J0000000000000000000USER"],
  "last_message_id": "01J00000000000000000000MSG"
}
```

When a person opens a direct message with your bot for the first time, `ChannelCreate` with the `DirectMessage` arrives, before any message in it. Direct messages and groups reach your bot with or without the `SERVERS` intent, in `Ready` and as `ChannelCreate`. Their messages need `DIRECT_MESSAGES`.
