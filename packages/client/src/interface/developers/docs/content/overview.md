# Zrzur Bot API

A bot is a Zrzur account that a program controls. It sits in servers like a member, reads and sends messages, answers slash commands, shows buttons and forms, moderates, posts files and can join voice channels. People install it; your code runs on your own computer or server.

These pages are all you need. Start with [Start your bot](/developers/docs/getting-started), then build the [complete bot](/developers/docs/tutorial-full-bot).

## How a bot works {#how-a-bot-works}

1. You create an **application** in the Developer Portal. It comes with a bot user and a **token**, the password of the bot.
2. Someone with Manage Server **installs** the bot in a server and gives it permissions.
3. Your program calls the **REST API** over HTTPS with the token in the `x-bot-token` header. This is how a bot acts.
4. Your program keeps one **gateway** connection open, a WebSocket. This is how a bot hears: commands, button clicks, messages and member changes arrive there as events.

## The path from nothing to a finished bot {#the-path}

1. [Start your bot](/developers/docs/getting-started): an application, a token, a first command.
2. [Applications and tokens](/developers/docs/applications): every setting of the Developer Portal, and how to install a bot.
3. [Gateway](/developers/docs/gateway): connect, stay connected, come back after a failure.
4. [Slash commands](/developers/docs/commands), [Answering interactions](/developers/docs/interactions) and [Buttons, menus and forms](/developers/docs/components).
5. [Messages](/developers/docs/messages), [Roles and permissions](/developers/docs/roles), [Moderation](/developers/docs/moderation).
6. [Errors](/developers/docs/errors), [Rate limits](/developers/docs/rate-limits), [Keeping tokens safe](/developers/docs/security), [Running in production](/developers/docs/production).

## Base URLs {#base-urls}

| Service             | URL                     |
| ------------------- | ----------------------- |
| REST API            | `https://api.zrzur.com` |
| Gateway (WebSocket) | `wss://events.zrzur.com`    |
| Files               | `https://cdn.zrzur.com` |
| Voice (LiveKit)     | `wss://voice.zrzur.com` |

Self-hosted servers use their own addresses. `GET /` on the API returns them, with the limits of that server. Read these fields (the answer has more; this one is shortened):

```json
{
  "zrzur": "26.0.0",
  "ws": "wss://events.zrzur.com",
  "app": "https://app.zrzur.com",
  "features": {
    "autumn": { "enabled": true, "url": "https://cdn.zrzur.com" },
    "january": { "enabled": true, "url": "https://api.zrzur.com/january" },
    "livekit": {
      "enabled": true,
      "nodes": [{ "name": "fra", "lat": 50.11, "lon": 8.68, "public_url": "wss://voice.zrzur.com" }]
    },
    "webhooks": false,
    "forwarding": false,
    "polls": false,
    "server_events": false,
    "limits": {
      "default": { "message_length": 2000, "message_attachments": 5, "file_upload_size_limits": { "attachments": 20000000 } }
    }
  }
}
```

| Field                              | What it is                                   |
| ---------------------------------- | -------------------------------------------- |
| `zrzur`                            | Version of the server; see the [API changelog](/developers/docs/changelog) |
| `ws`                               | Gateway address                              |
| `features.autumn.url`              | File server: uploads and downloads           |
| `features.january.url`             | Media proxy for link previews                |
| `features.livekit.nodes[].public_url` | Voice server                              |
| `features.limits.default`          | Limits of an account, such as message length |
| `features.webhooks`, `features.forwarding`, `features.polls`, `features.server_events` | Whether this installation has webhooks, message forwarding, polls and scheduled events switched on. Where one is `false`, its routes answer `FeatureDisabled` (webhook addresses: `404 NotFound`) |
| `app`                              | Web app, for links you show people           |

```endpoints getting-started

```

## What is not supported {#not-supported}

- **Sharding.** One bot keeps one connection, or several connections that each receive everything. Events cannot be split between processes.
- **Slash commands in groups, and server commands in direct messages.** In a direct message with the bot, a person can use the bot's global commands that need no server permission. Buttons, selects and forms work there too.
- **Webhooks, polls, forwarding and scheduled events** where the installation has them switched off. `GET /` says which are on; see [Base URLs](/developers/docs/overview#base-urls).
- **Interactions over HTTP** on a server where the setting `signing_key` is empty. There the routes answer `FeatureDisabled`, and bots use the gateway.
- **Bots creating bots or servers, joining by invite, or having friends.** People do those. The [coverage page](/developers/docs/coverage) lists every endpoint bots are refused.

## What each status means {#status}

Each endpoint in this reference shows one of these marks.

```coverage

```
