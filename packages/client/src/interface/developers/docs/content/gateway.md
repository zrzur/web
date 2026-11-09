# Gateway

The gateway is a WebSocket that pushes events to your bot. Keep one connection open per bot process.

## You will need {#you-will-need}

Node 22 or newer has `WebSocket` built in. Any WebSocket client works. You need your bot token (`YOUR_BOT_TOKEN`).

## Connect {#connect}

```text
wss://events.zrzur.com/?version=1&format=json
```

| Query parameter | Values                                                            | Default    |
| --------------- | ----------------------------------------------------------------- | ---------- |
| `version`       | `1`                                                               | `1`        |
| `format`        | `json`, `msgpack`                                                 | `json`     |
| `token`         | your bot token, instead of `Authenticate`                         | none       |
| `intents`       | the sum of your intents, instead of the field in `Authenticate`   | see below  |
| `ready`         | fields to include in `Ready`, e.g. `ready=servers&ready=channels` | everything |

With `format=msgpack` both sides send binary frames.

Prefer `Authenticate` to `?token=`: addresses end up in logs. Send it within 15 seconds:

```json
{ "type": "Authenticate", "token": "YOUR_BOT_TOKEN", "intents": 33 }
```

The server answers, in this order:

1. `Authenticated`: the token is good.
2. `Ready`: your starting data. Events flow only after this one.

Anything else you send is limited to 1 MiB per message.

## When the gateway refuses you {#refused}

| What you receive                                                     | Cause                                       | What to do                               |
| -------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| `{ "type": "Error", "data": { "type": "InvalidSession" } }`, closes  | Wrong or reset token, suspended bot, or no `Authenticate` in 15 seconds | Stop. Do not reconnect in a loop          |
| `{ "type": "Error", "data": { "type": "MissingIntent", "intent": "SERVER_MEMBERS" } }`, closes with code `4014` | A privileged intent that is off | Switch it on in the Developer Portal and connect again, or [connect without it](/developers/docs/gateway#intent-off) |

## Stay connected {#stay-connected}

Send a `Ping` every 20 seconds:

```json
{ "type": "Ping", "data": 1730000000000 }
```

The server answers `Pong` with the same `data`. `data` is a number, or a list of bytes.

The Zrzur gateway itself never closes a quiet bot connection, but proxies and home routers do, and a dead line gives no sign. So the ping is how **you** find out: when no `Pong` came for 60 seconds, close the socket and connect again.

## Reconnect {#reconnect}

A connection can end at any time: a deployment on our side, a network problem, your laptop sleeping. Plan for it.

1. When the socket closes, wait 1 second, and double the wait after each failure, up to 30 seconds. Add a little randomness so many bots do not return at once.
2. Connect and send `Authenticate` again. You get a new `Ready`.
3. Reset the wait after `Ready`.
4. Do not retry on `InvalidSession` or code `4014`: the same request fails again. Stop and tell a person.

## Resume is not supported {#resume}

There is no resume and there are no sequence numbers yet; both are planned for the next release (see the [changelog](/developers/docs/changelog)). Events sent while you were away are gone. After each `Ready`, fetch over REST what your bot cannot miss, such as recent messages of a channel (`GET /channels/{target}/messages` with `after` and `sort=Oldest`, see [Messages](/developers/docs/messages#read-messages)). A command used while your bot was away fails for the person who used it, and they can try again.

## Sharding is not supported {#sharding}

A connection receives everything your intents cover. There is no way to split servers between connections. A bot process that grows too large cannot be divided yet; keep the work you do per event small, and move slow work to a queue. See [Running in production](/developers/docs/production).

Two connections with the same token both work, and both receive everything. An `InteractionCreate` then reaches both, so only run two during a restart.

## Bulk packets {#bulk}

Several events can arrive in one packet:

```json
{
  "type": "Bulk",
  "v": [{ "type": "ServerMemberUpdate" }, { "type": "InteractionCreate" }]
}
```

Always unpack `Bulk` and handle each event. A bot that ignores it misses events, including command uses.

## What you can send {#client-messages}

```client-messages

```

## Intents {#intents}

Intents say what a connection receives. The gateway applies them, so a bot never gets what it did not ask for. Add the numbers of the ones you want and send the sum. Without `intents` the bot gets all free intents, `63`.

| Intent            | Value  | Receives                                                                 |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| `SERVERS`         | `1`    | Server, server channel, role, emoji and webhook events; servers and their channels in `Ready`. Direct messages and groups arrive either way, in `Ready` and as `ChannelCreate` |
| `SERVER_MESSAGES` | `2`    | Messages and typing in server channels                                   |
| `DIRECT_MESSAGES` | `4`    | Messages and typing in direct messages and groups                        |
| `REACTIONS`       | `8`    | Reactions being added and removed                                        |
| `VOICE_STATES`    | `16`   | People joining and leaving voice channels, calls, voice states in `Ready` |
| `INTERACTIONS`    | `32`   | `InteractionCreate`                                                      |
| `MESSAGE_CONTENT` | `1024` | Privileged. Text, embeds, files and components of messages               |
| `SERVER_MEMBERS`  | `2048` | Privileged. Members joining, leaving and changing; the member list       |
| `PRESENCE`        | `4096` | Privileged. Who is online, and their status                              |

A bot that only answers commands needs `SERVERS + INTERACTIONS = 33`. Without `INTERACTIONS` your bot cannot hear commands.

Privileged intents are switched on for the bot in the Developer Portal. Asking for one that is off closes the connection with code `4014`. Past 100 servers, only the privileged intents Zrzur approved stay on: the others are left out of the connection without closing it, and the REST rules below apply.

The same rules hold over REST:

- Without `MESSAGE_CONTENT` a message has no text, embeds, files or components, unless the bot wrote it, is mentioned in it, or it is a direct message with the bot.
- Without `SERVER_MEMBERS` the member list and member search answer `MissingIntent`. One member (`GET /servers/{target}/members/{member}`) still works.
- Without `PRESENCE` every user shows as offline, without a status. The bot still sees itself.

A change of a bot's intents takes effect on its next connection.

## When a privileged intent is off {#intent-off}

A switch in the Developer Portal is saved the moment you flip it, and the portal says so. The gateway reads the switches when a connection starts, so an open connection keeps the intents it started with: close the socket and connect again. The token stays the same. REST reads them on every request, so REST answers follow a switch at once.

`MissingIntent` names the intents that are off. If your bot can work without one, connect again without it instead of stopping:

```js
const MESSAGE_CONTENT = 1024;
// SERVERS + SERVER_MESSAGES + DIRECT_MESSAGES + INTERACTIONS + MESSAGE_CONTENT
let intents = 1 + 2 + 4 + 32 + MESSAGE_CONTENT;

function connect() {
  const socket = new WebSocket("wss://events.zrzur.com/?version=1&format=json");
  socket.addEventListener("open", () =>
    socket.send(
      JSON.stringify({
        type: "Authenticate",
        token: process.env.ZRZUR_BOT_TOKEN,
        intents,
      }),
    ),
  );
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === "Error" && event.data.type === "MissingIntent")
      console.warn(`Switched off in the Developer Portal: ${event.data.intent}`);
  });
  socket.addEventListener("close", ({ code }) => {
    if (code === 4014 && intents & MESSAGE_CONTENT) {
      // go on without message text: mentions and direct messages keep theirs
      intents &= ~MESSAGE_CONTENT;
      connect();
    }
  });
}

connect();
```

Without `MESSAGE_CONTENT` your bot still reads messages that mention it, its own messages and direct messages with it. Add the reconnect loop from [Reconnect](/developers/docs/gateway#reconnect) for every other close.

## Machine-readable schema {#schema}

`GET /gateway/schema` on the API returns every event (`server`) and everything a client can send (`client`) as JSON Schema, with the intents. It is generated from the types the gateway uses.

## Full example {#full-example}

The [complete bot](/developers/docs/tutorial-full-bot) has all of this: intents, ping, watchdog, `Bulk`, backoff and the two cases where it stops.

## Next {#next}

- [Event reference](/developers/docs/events)
- [Slash commands](/developers/docs/commands)
