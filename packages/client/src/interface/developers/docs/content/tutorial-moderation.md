# Moderation bot

`/timeout` and `/purge`, with the checks a moderation bot needs.

> This tutorial uses `@zrzur/sdk/bot`, which is not on npm yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example moderation.mjs

```

Run it with `node moderation.mjs`.

## Try it

Give the bot Timeout Members and Manage Messages, and put its role above the members it moderates.

## What it shows

- `user_permissions` in the interaction says what the person who asked may do.
- The server refuses targets that rank at or above the bot (`NotElevated`).
- Bulk delete only takes messages younger than a week.
- Answers are private.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
