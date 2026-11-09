# API changelog

What changed in the Bot API and in these pages, newest first. The version is the one `GET /` reports in `zrzur`.

```bash
curl "https://api.zrzur.com/"
# answer, shortened: { "zrzur": "26.0.0", ... }
```

Every entry says whether existing bots must change. A removal is announced here with its date before it happens.

## Coming in the next release {#upcoming}

Not available yet. Do not build on these until they appear under a version below.

- **Gateway: resume.** Events get a sequence number, and a bot that lost its connection can resume it and receive what it missed, instead of fetching it over REST. The [Gateway](/developers/docs/gateway#resume) page will show how.
- **A bot reads its own settings.** `GET /bots/{target}` with the bot's own id and token will return its `privileged_intents`, so a bot can check what its owner switched on.
- **Clearer intent refusals.** The `4014` close will name the intents that are switched on. A connection that fails for another reason will close without `4014`, so a bot tries again instead of stopping.
- **Threads: a richer first message.** `POST /channels/{target}/threads` will take `embeds` and `components` for the first message, with the same rules as sending a message.
- **"Not installed" answers 404.** A channel of a server your bot is not in will answer `404 NotFound`, like the server itself. Today it answers `403 MissingPermission`.
- **SDK: rate limits.** The SDK will wait out a `429` and try again by itself.

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
