# Games with buttons

`/coinflip` posts two buttons that only the player can press; the message updates in place.

> This tutorial uses `@zrzur/sdk/bot`, which is not on npm yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example games.mjs

```

Run it with `node games.mjs`.

## Try it

Run `/coinflip` and press a button. Ask someone else to press it too: the server refuses them.

## What it shows

- `restrict` limits a button to certain users or roles on the server side.
- `i.update()` changes the message the button is on; `components: []` removes the buttons.
- Points and games must stay free: no betting, no buying or selling of points.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
