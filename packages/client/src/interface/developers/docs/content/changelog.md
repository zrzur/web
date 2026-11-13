# API changelog

What changed in the Bot API and in these pages, newest first. The version is the one `GET /` reports in `zrzur`.

```bash
curl "https://api.zrzur.com/"
# answer, shortened: { "zrzur": "26.0.0", ... }
```

Every entry says whether existing bots must change. A removal is announced here with its date before it happens. Follow it in a feed reader: [RSS feed](/developers/api-changelog.xml).

## Since 26.0.0 {#since-26-0-0}

**Live on `api.zrzur.com`, checked on 2026-11-13.** `GET /` still reports `26.0.0`. Existing bots keep working: nothing below removes a field or changes one.

- **Gateway: resume.** Every packet after `Ready` carries `seq`, counted per session from 1. Send `Authenticate` with `"resumable": true` and `Ready` carries `session_id`. After a drop the session is kept for 2 minutes, with at most its last 1000 events and 4 MiB of them. On a new socket, send `Resume` as the first message: the events after `seq` arrive in order, then `Resumed`. If the session is gone you get `InvalidSession` with `"resumable": false`; then send `Authenticate` on the same socket and catch up over REST. `GET /gateway/schema` lists the close codes and the resume limits. See [Gateway](/developers/docs/gateway#resume).
- **A bot reads its own settings.** `GET /bots/{bot_id}` with the bot's own id and token returns its `privileged_intents`. Another bot's id answers `IsBot`.
- **Clearer intent refusals.** The `4014` close reason names what the server read, for example `Disallowed intents: MESSAGE_CONTENT (switched on: none)`. If the server cannot read the bot's settings, it sends `InternalError` and closes with `1013`: try again later, do not stop.
- **Threads: a richer first message.** `POST /channels/{target}/threads` takes `embeds` and `components` next to `content`, with the rules of sending a message: Send Embeds applies, and a role ping without Mention Roles is refused with `403 MissingPermission` and no thread is kept. See [Channels](/developers/docs/channels#threads).
- **"Not installed" answers 404.** `GET /channels/{target}` answers `404 NotFound` to anyone who is not in the channel's server, like the server itself and like a channel that does not exist. Members without access still get `403 MissingPermission`. See [Errors](/developers/docs/errors#not-installed).
- **Commands in a direct message.** A person can use a bot's global commands that need no server permission in their direct message with the bot.
- **Command rules per server.** People with Manage Server and Manage Roles can allow or deny an app's commands for roles, members and channels: `GET` and `PUT /servers/{server_id}/applications/{application_id}/permissions`, and `PUT /servers/{server_id}/applications/{application_id}/commands/{command_id}/permissions`.
- **Polls, scheduled events, soundboard and stages.** New routes and gateway events, listed in the reference of [Messages](/developers/docs/messages#polls), [Servers](/developers/docs/servers), [Voice calls](/developers/docs/voice) and in the [Event reference](/developers/docs/events). Two new permissions: `UseSoundboard` and `ManageSoundboard`. Polls, forwarding and scheduled events are switched on per installation (`features` in `GET /`); on `api.zrzur.com` they were off when this page was checked.
- **SDK: rate limits and resume.** The SDK resumes by default for bots, waits out a `429`, and waits for the reset when a bucket is empty. It is not on npm yet; see [SDKs](/developers/docs/sdk).

## Documentation, 2026-11-09 {#docs-2026-11-09}

No change to the API. These pages now say what a bot author had to find out by trying:

- The docs open at once, without signing in and without waiting for a connection.
- [Event reference](/developers/docs/events#channels): the channel types, and how to tell a direct message from a server message.
- [Gateway](/developers/docs/gateway#intent-off): what to do when a privileged intent is off, and when a switch counts.
- [Without a library](/developers/docs/raw-http): the Node example sends `intents: 33`, like the text and the Python example.
- [Channels and webhooks](/developers/docs/channels): plain HTTP comes first, the body of `POST /servers/{server}/channels` with `private` and `category`, and the rules of a thread's first message.
- [Slash commands](/developers/docs/commands#attachments): where an `Attachment` option's file arrives, and why its id cannot be sent again.
- [Messages](/developers/docs/messages#read-messages): channel links `<#id>`, the answer of `GET /channels/{target}/messages` and its order.
- [Overview](/developers/docs/overview#base-urls): a sample `GET /` answer.
- [Errors](/developers/docs/errors#not-installed): which answer means "the bot is not in that server".
- The reference names only the bot SDK, and its status badge agrees with the check below it.

## 26.0.0 (2026-11-08) {#v26-0-0}

The first Zrzur release. Everything in these pages describes it.

- **Interactions:** slash commands with options, choices, sub-commands, localised names and autocomplete; user and message menu commands; buttons, selects and forms; private, deferred and follow-up answers. Buttons and forms also work in a direct message with the bot.
- **Interactions over HTTP**, signed requests to your own address.
- **Gateway intents** decide what a connection receives. `MESSAGE_CONTENT`, `SERVER_MEMBERS` and `PRESENCE` are privileged and switched on in the Developer Portal. `GET /gateway/schema` describes every event.
- **Threads and forums:** `POST` and `GET /channels/{target}/threads`, `PATCH /channels/{target}/thread`, with the permissions `CreateThreads`, `CreateForumPosts` and `SendMessageInThreads`.
- **Over REST:** `POST /channels/{target}/typing`, and pinned messages through `POST /channels/{target}/search` with `pinned: true`.
- **Webhooks:** tokens are shown once, start with `zrzur_wh_` and can be replaced.
- **Rate limits:** a `429` body has `retry_after` in milliseconds and `global`. Every error has a stable `type`.
- **OAuth2** with PKCE.

## Next {#next}

- [Status and coverage](/developers/docs/coverage)
- [Errors](/developers/docs/errors)
