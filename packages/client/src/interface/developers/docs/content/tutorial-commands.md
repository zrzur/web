# Commands with options

Options with limits, private answers, answers that take longer than 3 seconds, and suggestions while typing.

> This tutorial uses `@zrzur/sdk/bot`, so run `npm install @zrzur/sdk` in your bot's folder first. See [SDKs](/developers/docs/sdk). Everything it does also works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example commands.mjs

```

Run it with `node commands.mjs`.

## Try it

Try `/roll sides:20`, `/secret text:hi`, `/slow` and start typing `/fruit name:ap`.

## What it shows

- The server enforces `min_value` and `max_value`; the bot never sees invalid numbers.
- `ephemeral: true` replies are only shown to the person who asked and are never stored.
- `i.defer()` acknowledges at once; `i.editReply()` finishes the answer later.
- Autocomplete handlers return at most 25 choices.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
