# API changelog

What changed in the Bot API and in these pages, newest first. The version is the one `GET /` reports in `zrzur`.

```bash
curl "https://api.zrzur.com/"
# answer, shortened: { "zrzur": "26.0.0", ... }
```

Every entry says whether existing bots must change. A removal is announced here with its date before it happens. Follow it in a feed reader: [RSS feed](/developers/api-changelog.xml).

## Coming in the next release {#upcoming}

**In the next release, not yet on app.zrzur.com.** Do not build on these until they appear under a version below.

- **Gateway: resume.** Every event carries `seq`, counted per session from 1. Send `Authenticate` with `"resumable": true` and `Ready` carries `session_id`. After a drop the session is kept for 2 minutes, with at most its last 1000 events and 4 MiB of them; if what you missed no longer fits, `Resume` answers `InvalidSession`. On a new socket, send `{ "type": "Resume", "token": "YOUR_BOT_TOKEN", "session_id": "…", "seq": 41 }` as the first message: the events after `seq` arrive in order, then `Resumed`. If the session is gone you get `InvalidSession` with `"resumable": false`; then send `Authenticate` on the same socket and catch up over REST. Some events can be left out of a replay, so `seq` can have gaps. `GET /gateway/schema` will list the close codes and the resume limits.
- **A bot reads its own settings.** `GET /bots/{target}` with the bot's own id and token returns its `privileged_intents`. Another bot's id still answers `IsBot`.
- **Clearer intent refusals.** The `4014` close reason names what the server read, for example `Disallowed intents: MESSAGE_CONTENT (switched on: none)`. If the server cannot read the bot's settings, it sends `InternalError` and closes with `1013`: try again later, do not stop.
- **Threads: a richer first message.** `POST /channels/{target}/threads` takes `embeds` and `components` next to `content`, with the rules of sending a message: Send Embeds applies, and a role ping without Mention Roles is refused with `403 MissingPermission` (`permission: MentionRoles`) and no thread is made.
- **"Not installed" answers 404.** `GET /channels/{target}` answers `404 NotFound` to anyone who is not in the channel's server, like the server itself and like a channel that does not exist. Members without access still get `403 MissingPermission`.
- **SDK: rate limits and resume.** The SDK resumes by default for bots, waits out a `429`, and waits for the reset when a bucket is empty.

Existing bots keep working. Nothing above removes a field or changes one.

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
