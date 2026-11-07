# SDKs

`@zrzur/sdk` is the official Zrzur library for apps and bots: TypeScript, ESM, Node 22 or newer (or Deno, or a browser). One package, three entry points:

| Import             | What                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | Bots: slash commands, buttons, selects, forms, autocomplete, private and deferred replies, embeds, collectors, uploads         |
| `@zrzur/sdk`       | The core both build on: the HTTP client (every route typed from the API's OpenAPI document), the gateway, the API types, events |
| `@zrzur/sdk/solid` | The live client of the Zrzur app (SolidJS): stores for servers, channels and messages                                         |

SolidJS is only needed for `@zrzur/sdk/solid`; a bot never downloads it.

> **You cannot download it yet.** `@zrzur/sdk` is not on npm, and its repository is not public yet. This page shows what it will offer. Until then build with Node alone: [Build a complete bot](/developers/docs/tutorial-full-bot) needs no library, and [Without a library](/developers/docs/raw-http) has every call.

There is also `@zrzur/bot`, an older, smaller library with the same interface for bots. It is not published either. New bots should wait for `@zrzur/sdk/bot`.

## @zrzur/sdk/bot (for bots)

```js
import { Client } from "@zrzur/sdk/bot";

// Zrzur's own servers by default; a self-hosted server passes { apiUrl, wsUrl }
const client = new Client();
await client.login(process.env.ZRZUR_TOKEN);
```

| Area            | Methods                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Commands        | `client.command`, `client.component`, `client.modal`, `client.autocomplete`, `client.syncCommands`, `client.fetchCommands`                    |
| Answers         | `i.reply`, `i.defer`, `i.update`, `i.deferUpdate`, `i.showModal`, `i.respond`, `i.editReply`, `i.followUp`, `i.deleteReply`                   |
| Events          | `client.on(type)`, `client.onMessage`, `client.onMemberJoin`, `client.onMemberLeave`, `client.onReaction`                                     |
| Messages        | `client.messages.send`, `reply`, `fetch`, `fetchMany`, `edit`, `delete`, `bulkDelete`, `react`, `unreact`, `clearReactions`, `pin`, `unpin`   |
| Members         | `client.members.fetch`, `fetchAll`, `edit`, `addRole`, `removeRole`, `timeout`, `kick`, `ban`, `unban`                                         |
| Roles, channels | `client.roles.*`, `client.channels.*`                                                                                                        |
| Users           | `client.users.fetch`, `openDM`, `sendDM`                                                                                                     |
| Webhooks        | `client.webhooks.create`, `list`, `listForServer`, `fetch`, `fetchWithToken`, `edit`, `regenerateToken`, `delete`, `send`, `sendSlack`, `fetchMessage`, `editMessage`, `deleteMessage` |
| Collectors      | `message.createMessageComponentCollector`, `message.awaitMessageComponent`, `interaction.awaitModalSubmit`                                   |
| Emojis          | `client.emojis.list`, `fetch`, `find`, `create`, `delete`                                                                                     |
| Voice           | `client.voice.nodes`, `client.voice.join`                                                                                                    |
| Anything else   | `client.rest.get(path)`, `post`, `put`, `patch`, `delete` (typed for every route), `client.rest.uploadFile(tag, data, name, type)`          |

Errors from the API are thrown as `ApiError` with `status`, `type`, `detail` and, after a 429, `retryAfter`. Short rate limits are waited out; after a global limit every request waits until it resets. The gateway unpacks `Bulk` packets and reconnects with backoff.

Each endpoint in this reference names the SDK method that calls it, when there is one.

## @zrzur/sdk (the core)

```js
import { Api, Gateway, Intents } from "@zrzur/sdk";

const api = new Api({ baseURL: "https://api.zrzur.com", authentication: { bot: process.env.ZRZUR_TOKEN } });
const me = await api.get("/users/@me");
```

Use it for tools that need only the HTTP API or the gateway, in any framework.

## @zrzur/sdk/solid (for apps)

The client the Zrzur app is built on: a user client with live stores for servers, channels and messages. It can log in with a bot token, but it has no interaction API (commands, components, forms). Use it for tools that act like an app; use `@zrzur/sdk/bot` for bots.

## Without an SDK

Every feature is plain HTTP and WebSocket. See [Without a library](/developers/docs/raw-http).
