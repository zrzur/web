# Deployment

The shape of a bot that runs for months: configuration from the environment, a health check and a clean shutdown.

> This tutorial uses `@zrzur/sdk/bot`, which you cannot download yet. See [SDKs](/developers/docs/sdk). Everything it does works without a library: [Build a complete bot](/developers/docs/tutorial-full-bot).

## Before you start

Create an application, install it in a test server and set three environment variables (see [Getting started](/developers/docs/getting-started)):

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

## The code

```example deploy.mjs

```

Run it with `node deploy.mjs`.

## Try it

Run it under a process manager (systemd, Docker, a PaaS) and point its health check at `http://127.0.0.1:8080/healthz`.

## What it shows

- The bot refuses to start when a variable is missing (exit code 2).
- `/healthz` answers 200 once the gateway is connected, 503 before.
- On SIGTERM it closes the health server and the gateway, then exits.
- Keep the token in the platform's secret store; restart the bot after resetting the token.

> Our tests run this file as a real bot against a Zrzur test server and check that it answers.
