# Servers

A bot joins a server when someone with Manage Server installs it. It can read the server, change its settings with the right permissions, manage emojis and leave.

## What a bot cannot do

- Create servers or join them by invite (`IsBot`). Server admins install bots.
- Mark servers or channels as read.
- Use Discover, billing, Feather or Wings.

## Server settings

`PATCH /servers/{target}` changes the name, description, icon, banner, categories and system message channels (needs Manage Server). Some fields (for example verification flags) can only be changed by Zrzur staff.

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
