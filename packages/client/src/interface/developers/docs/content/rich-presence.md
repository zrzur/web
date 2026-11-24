# Rich presence for games and apps

Show "Playing My Game" with your game's details under the player's name, through the Zrzur desktop app on the same computer.

This is for games and apps the person runs, not for bots: a bot can never set what a person is doing. Nothing goes over the network from your game; the desktop app passes it on, and only while the person shares their activity.

## You will need

- Node 22.3 or newer and `npm install @zrzur/sdk` (or any language that can open a named pipe or a Unix socket).
- The Zrzur desktop app running on the same computer, with Settings → Activity → "Share what you are doing" on.

## Steps

1. Pick a short id for your app, for example `my-game`. Letters, digits, `.`, `_` and `-`, at most 64 characters.
2. Connect with `new ZrzurRpc({ clientId })` and `connect()`. It finds the desktop app on the pipe `zrzur-ipc-0` to `zrzur-ipc-9`.
3. Call `setActivity({ details, state, timestamps, buttons })` when something changes in the game.
4. Call `setActivity(null)` to clear it, and `close()` when the game quits. Closing also clears it.

## Full example

```js
// Rich presence from a game: tell the Zrzur desktop app what the player is
// doing, so their friends see "Playing <your game>" with the details.
// Node 22.3 or newer, `npm install @zrzur/sdk`. The Zrzur desktop app must
// be running on the same computer, with "Share what you are doing" on.
import { ZrzurRpc } from "@zrzur/sdk/rpc";

const rpc = new ZrzurRpc({
  clientId: process.env.ZRZUR_RPC_CLIENT_ID ?? "my-game",
});
await rpc.connect();
console.log("Connected to the Zrzur desktop app");

const startedAt = Date.now();
let round = 1;

async function show() {
  await rpc.setActivity({
    name: "My Game",
    details: "Ranked match",
    state: `Round ${round} of 12`,
    timestamps: { start: startedAt },
    buttons: [{ label: "Get the game", url: "https://example.com/my-game" }],
  });
  console.log(`Showing round ${round}`);
}

await show();

// change it when something happens in the game, not on a timer: Zrzur
// takes 5 changes in 20 seconds
const timer = setInterval(async () => {
  round += 1;
  await show();
  if (round === 3) {
    clearInterval(timer);
    await rpc.setActivity(null);
    console.log("Cleared");
    rpc.close();
  }
}, 10_000);
```

Run it with `node rich-presence.mjs` while the desktop app is open.

## What you should see

```text
Connected to the Zrzur desktop app
Showing round 1
Showing round 2
Showing round 3
Cleared
```

Friends see "Playing My Game", "Ranked match", "Round 1 of 12" and the time since the start, in the member list and on the profile.

## The activity

| Field | Limit | Notes |
| --- | --- | --- |
| `name` | 1 to 128 characters | Left out: the desktop app uses the program's name |
| `details`, `state` | 128 characters each | One line each |
| `timestamps.start`, `timestamps.end` | milliseconds or seconds since 1970 | The app shows the time since the start, or the time left |
| `assets.large_image`, `assets.small_image` | `https://` only | Shown through Zrzur's image proxy; other picture keys are left out |
| `buttons` | 2, label 32 characters, `https://` links | People see a link warning before the link opens |
| `type` | 0 Playing, 1 Streaming, 2 Listening, 3 Watching, 5 Competing | Playing when left out |

Texts go through Zrzur's word list. An activity the server refuses is not shown, and your game gets no error for it.

## The protocol

Without the SDK: open the pipe `\\?\pipe\zrzur-ipc-0` on Windows, or the socket `zrzur-ipc-0` in `$XDG_RUNTIME_DIR` (or `$TMPDIR`) on macOS and Linux. Every frame is an 8-byte header, the opcode and the length of the body (both 32-bit little endian), then the body as UTF-8 JSON.

| Opcode | Meaning |
| --- | --- |
| 0 | Handshake: `{"v":1,"client_id":"my-game"}` |
| 1 | Frame: `{"cmd":"SET_ACTIVITY","nonce":"1","args":{"pid":1234,"activity":{...}}}` |
| 2 | Close |
| 3, 4 | Ping and pong |

The desktop app answers the handshake with a `READY` frame and each `SET_ACTIVITY` with a frame carrying the same `nonce`. The `READY` frame never tells your app who is signed in. A frame over 64 KiB, or anything that is not this protocol, closes the connection.

## Limits

- The server takes 5 changes in 20 seconds per person. Change the activity when the game changes, not on a timer.
- The person sees your app in Settings → Activity → Connected apps and can block it.
- Nothing is stored: the activity goes when your app clears it, closes, or the person goes offline.

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `The Zrzur desktop app is not running` | No pipe answers | Start the desktop app, or try again later |
| `The Zrzur desktop app did not answer` | The app is busy or sharing is off | Try again later; nothing is shown while sharing is off |
| `clientId: 1 to 64 letters...` | The id has spaces or other characters | Use letters, digits, `.`, `_` or `-` |

## Next

- [SDK](/developers/docs/sdk)
- [Users and members](/developers/docs/users)
