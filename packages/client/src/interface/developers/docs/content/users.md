# Users and members

A **user** is a Zrzur account, a **member** is a user inside one server, with a nickname, roles and a timeout.

## What a bot can see about people

A bot sees what members of the same server see: username, display name, avatar, badges, status and the public profile. It never sees e-mail addresses, sessions, settings, privacy choices or who someone is friends with.

- `GET /users/{target}` returns a user the bot can see (it shares a server or a DM with them).
- `GET /users/{target}/profile` may be refused (`403`) when the profile is not visible to the bot.
- Friends and blocks are for people only. Every friend and block endpoint refuses bots with `IsBot`.
- `official` marks an account Zrzur runs, and `official_names` holds its name per language (`ar`, `en`, `de`, with `display_name` as the fallback). `official_bot` marks a bot Zrzur runs itself. Replying to, reacting to, pinning or reporting an official account returns `403 OfficialAccount`.

## Privacy limits

People decide who may message them. A bot is never a friend, so:

| Their "direct messages" setting            | Can the bot start a DM?                      |
| ------------------------------------------ | -------------------------------------------- |
| Everyone                                   | Yes                                          |
| Mutual (default: shares a server or group) | Yes, while the bot shares a server with them |
| Friends                                    | No                                           |

People under 18 always have "Friends", whatever they chose, so a bot cannot start a direct message with them. A server can also pause direct messages between its members who are not friends.

Blocked users never receive a bot's messages, and a person who wrote to the bot first can always get an answer. Where the bot may not start a conversation, opening the DM channel (`GET /users/{target}/dm`) answers `403 DirectMessagesRestricted`; sending into a DM that is already open can be refused the same way, or with `409 Blocked`. Do not retry these errors: post in a server channel instead, without private details.

Group invites have their own setting; bots cannot create groups or add people to them at all.

Age checks for mature channels apply to people only: bots have no age and are not checked. Do not use a bot to show mature content to members who cannot open those channels themselves.

## Members

Member endpoints work on servers the bot is in.

- `GET /servers/{target}/members` returns all members and their users in one response. Prefer the member data in `Ready` and in interactions when you can: fewer requests, and the `servers` rate-limit bucket is small.
- `PATCH /servers/{server_id}/members/{member_id}` changes nicknames, roles, timeouts and voice state. Every change needs its own permission, and the target must rank **below** the bot (and below the moderator, if your bot acts for one).
- `ServerMemberJoin`, `ServerMemberUpdate` and `ServerMemberLeave` events keep a cache up to date.

## Reference: users

```endpoints users

```

## Reference: members

```endpoints members

```
