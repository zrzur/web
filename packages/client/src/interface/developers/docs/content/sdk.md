# SDKs

`@zrzur/sdk` is the official Zrzur library for apps and bots: TypeScript, ESM, Node 22.3 or newer (or Deno 2.2 or newer, or a browser). One package, three entry points:

| Import             | What                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `@zrzur/sdk/bot`   | Bots: slash commands, buttons, selects, forms, autocomplete, private and deferred replies, embeds, collectors, uploads         |
| `@zrzur/sdk`       | The core both build on: the HTTP client (every route typed from the API's OpenAPI document), the gateway, the API types, events |
| `@zrzur/sdk/solid` | The live client of the Zrzur app (SolidJS): stores for servers, channels and messages                                         |

SolidJS is only needed for `@zrzur/sdk/solid`; a bot never downloads it.

Install it from npm, with Node 22.3 or newer:

```bash
npm install @zrzur/sdk
```

The package is [@zrzur/sdk on npm](https://www.npmjs.com/package/@zrzur/sdk), and its source is at [github.com/zrzur/sdk-js](https://github.com/zrzur/sdk-js). A bot also works with no library at all: [Build a complete bot](/developers/docs/tutorial-full-bot) needs none, and [Without a library](/developers/docs/raw-http) has every call.

## @zrzur/sdk/bot (for bots)

```js
import { Client } from "@zrzur/sdk/bot";

// Zrzur's own servers by default; a self-hosted server passes { apiUrl, wsUrl }
const client = new Client();
await client.login(process.env.ZRZUR_TOKEN);
```

| Area            | Methods                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Commands | `client.command`, `client.component`, `client.modal`, `client.autocomplete`, `client.syncCommands`, `client.fetchCommands`, `client.createCommand`, `client.fetchCommand`, `client.editCommand`, `client.deleteCommand` |
| Answers         | `i.reply`, `i.defer`, `i.update`, `i.deferUpdate`, `i.showModal`, `i.respond`, `i.editReply`, `i.followUp`, `i.deleteReply`                   |
| Events          | `client.on(type)`, `client.onMessage`, `client.onMemberJoin`, `client.onMemberLeave`, `client.onReaction`                                     |
| Messages | `client.messages.send`, `reply`, `fetch`, `fetchMany`, `edit`, `delete`, `bulkDelete`, `react`, `unreact`, `clearReactions`, `pin`, `unpin`, `pins` |
| Members         | `client.members.fetch`, `fetchAll`, `edit`, `addRole`, `removeRole`, `timeout`, `kick`, `ban`, `unban`                                         |
| Roles | `client.roles.create`, `edit`, `setPermissions`, `delete` |
| Channels | `client.channels.fetch`, `create`, `edit`, `delete`, `setPermissions`, `setMemberPermissions`, `createInvite`, `typing` |
| Servers | `client.servers.fetch`, `ensureCategory` |
| Threads, forums | `client.threads.create`, `list`, `edit`, `archive`, `reopen`; `client.forums.create`, `post`, `posts`, `setTags` |
| Invites | `client.invites.create`, `fetch`, `list`, `delete` |
| Users           | `client.users.fetch`, `openDM`, `sendDM`                                                                                                     |
| Webhooks        | `client.webhooks.create`, `list`, `listForServer`, `fetch`, `fetchWithToken`, `edit`, `regenerateToken`, `delete`, `send`, `sendSlack`, `fetchMessage`, `editMessage`, `deleteMessage` |
| Collectors      | `message.createMessageComponentCollector`, `message.awaitMessageComponent`, `interaction.awaitModalSubmit`                                   |
| Emojis          | `client.emojis.list`, `fetch`, `find`, `create`, `delete`                                                                                     |
| Voice           | `client.voice.nodes`, `client.voice.join`                                                                                                    |
| Connection | `client.login`, `client.loginHttp`, `client.listen`, `client.destroy`, `client.setStatus`, `client.typing` |
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

## Other languages {#other-languages}

The [Bot API document](/developers/bot-api.openapi.json) describes every route a bot can use, as OpenAPI 3.0, with the types they take and return. OpenAPI Generator makes a client from it in Python, Go, Java, C#, Rust, PHP and more. It needs Java 11 or newer.

```bash
curl -o zrzur-bot.json https://app.zrzur.com/developers/bot-api.openapi.json
npx @openapitools/openapi-generator-cli generate -i zrzur-bot.json -g python -o zrzur-bot
```

- The client calls `https://api.zrzur.com`, the first server in the document. A self-hosted server is the address you give the client instead.
- A bot signs in with the `BotToken` scheme, the `x-bot-token` header.
- The gateway is not part of it. `GET /gateway/schema` describes its events as JSON Schema; connect as in [Gateway](/developers/docs/gateway).
- `GET /openapi.json` on the API is the whole API, the app's own routes too. The Bot API document is the part a bot can call.
- For TypeScript, use `@zrzur/sdk`: it is generated from the same API and adds the gateway and the bot helpers.

## Without an SDK

Every feature is plain HTTP and WebSocket. See [Without a library](/developers/docs/raw-http).
