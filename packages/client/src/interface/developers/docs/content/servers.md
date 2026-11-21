# Servers

A bot joins a server when someone with Manage Server installs it. It can read the server, change its settings with the right permissions, manage emojis and leave.

## What a bot cannot do

- Create servers or join them by invite (`IsBot`). Server admins install bots.
- Mark servers or channels as read.
- Use Discover, billing, Feather or Wings.

## Server settings

`PATCH /servers/{target}` changes the name, description, icon, banner, categories and system message channels (needs Manage Server). Some fields (for example verification flags) can only be changed by Zrzur staff.

`categories` replaces the whole list. To change one category's title or note without touching the others, use `PATCH /servers/{target}/categories/{category_id}` with `{ "title": "Help", "description": "Ask here" }` (an empty `description` removes the note; needs Manage Channels). Its channels and permissions stay as they are. Category permissions have their own routes: `PUT /servers/{target}/categories/{category_id}/permissions/{role_id}` and `.../permissions/default`, with `{ "permissions": { "allow": 0, "deny": 0 } }`.

## When someone joins {#on-join}

`GET /servers/{target}/on_join` reads, and `PUT` replaces, the roles every new member gets and the server's welcome message. Up to five roles, only roles of this server that no bot owns, and none at or above the caller's own rank; changing the roles needs Manage Roles, the message Manage Server.

## AutoMod {#automod}

AutoMod checks messages before they are posted. `GET /servers/{target}/automod` reads the rules; `PUT` replaces all of them, at most 10. Both need Manage Server.

```json
PUT /servers/{target}/automod
{
  "rules": [
    {
      "id": "invites",
      "name": "No invite links",
      "enabled": true,
      "trigger": { "type": "LinkSpam", "allowed_domains": ["zrzur.com"], "new_member_minutes": 60 },
      "actions": { "block": true, "alert_channel": "<channel id>", "timeout_minutes": 10 },
      "exempt_roles": ["<role id>"],
      "exempt_channels": []
    }
  ]
}
```

| Trigger (`type`) | Matches |
| --- | --- |
| `Keywords` | Words and phrases in `words`; `*` at the start or end matches part of a word, `allow` lists words that never match. Arabic letters are compared without hamza forms, ta marbuta, alif maqsura, tashkeel and tatweel |
| `MentionSpam` | More than `max` different mentions in one message |
| `LinkSpam` | Links from members who joined less than `new_member_minutes` ago, and links to domains outside `allowed_domains` |
| `RepeatedMessages` | The same text in `channels` channels within `seconds` |

`block` keeps the message out (the member sees the rule's name), `alert_channel` tells moderators there, `timeout_minutes` times the member out. AutoMod reads webhook messages and edits too. A bot that moderates on its own still sees every message it may read; AutoMod only adds rules the server keeps itself.

## Soundboard {#soundboard}

A server's sounds play into voice calls (see [Voice calls](/developers/docs/voice#soundboard)). `GET /servers/{target}/soundboard` lists them and the limit: 8 sounds, and 8 more for each Wings level. With Manage Soundboard a bot can:

- add an uploaded sound: upload the file with the tag `sounds`, then `PUT /servers/{target}/soundboard/{sound_id}` with the upload id as `sound_id` and a body of `name`, the length `duration_ms` and optionally `emoji` and `volume`;
- add a ready-made one from the library (`GET /soundboard/library`): `PUT /servers/{target}/soundboard/library/{library_id}`; each library sound is on a server once;
- rename it, change its emoji or volume with `PATCH`, and remove it with `DELETE` (its file goes too).

`GET /soundboard/library/{id}/audio?v=<version>` is the file of a library sound; with the version from the list it is cached for good. The gateway sends `SoundboardSoundCreate`, `SoundboardSoundUpdate` and `SoundboardSoundDelete`.

## Scheduled events {#events}

Bots may plan and run a server's events like people with Manage Events. `GET /servers/{target}/events` lists the scheduled and active ones the bot may see, soonest first; `POST` schedules one, or saves a draft with `draft: true`. The other routes under `/servers/{target}/events/{event}` edit, start, end, cancel or delete an event, list who answered, and manage its share link and invitation links. The gateway sends `ServerEventCreate`, `ServerEventUpdate`, `ServerEventDelete` and `ServerEventInterest`. Only accepting an invitation to an event (`POST /invites/event/{code}`) is for people: a bot gets `IsBot`.

## Server tools {#tools}

| Route | What it does | Needs |
| --- | --- | --- |
| `GET /servers/{target}/insights?days=30` | Daily joins, leaves, members, messages, active members and voice minutes for 7, 30 or 90 days, where joins came from and the busiest channels. Counts from 1 to 4 come as `null` | Manage Server |
| `PUT /servers/{target}/safety/pause` | Refuse every invite and Discover join, and / or stop DMs between members who are not friends, for 1, 6, 12 or 24 hours; `0` ends a pause | Manage Server |
| `PUT /servers/{server_id}/vanity` | Claim or change the server's own invite link (`zrzur.cc/<code>`); `DELETE` frees it. `VanityTaken` when another server has it | Manage Server and the Wings level that unlocks it |

## Emojis

Upload the image to the file server with the tag `emojis` (up to 500 KB by default), then create the emoji with the returned id:

```json
PUT /custom/emoji/{emoji_id}
{ "name": "party", "parent": { "type": "Server", "id": "<server id>" } }
```

Needs Manage Customisation. Names use `a-z`, `0-9` and `_`.

## Installed applications

`GET /servers/{server_id}/applications` lists the bots installed in a server, `GET /servers/{server_id}/commands` the commands members can use there.

## Leaving

`DELETE /servers/{target}` makes the bot leave. Members see `ServerMemberLeave`; the bot gets `ServerDelete` for that server.

## Reference

```endpoints servers

```
