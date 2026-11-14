# Start your bot

In about ten minutes you will have a bot that answers a slash command in your own test server. You need a Zrzur account, a server of your own and Node.js 22.3 or newer.

## 1. Create an application {#create-an-application}

In the Developer Portal, choose New application, give it a name and choose Create. The application comes with a bot account. [Open My applications](/developers)

## 2. Copy the token {#copy-the-token}

The token appears once, right after you create the application. Copy it now. Whoever has the token controls the bot.

> Keep the token in an environment variable or a secret store. Never put it in code, in a repository or in a screenshot. If it leaks, reset it at once.

## 3. Install the bot in a test server {#install-the-bot}

On the Overview tab of your application choose Add to a server, and pick a server where you have Manage Server. [More about installing](/developers/docs/applications#install)

Do this before the first run. A bot that is not in the server gets 403 MissingPermission when it writes to one of its channels, which looks like a missing permission. [Is the bot in that server?](/developers/docs/errors#not-installed)

## 4. Install the library {#get-the-sdk}

Make a folder for your bot and install `@zrzur/sdk`, the official library:

```bash Terminal
mkdir my-bot
cd my-bot
npm install @zrzur/sdk
```

It keeps the gateway connection for you and answers commands. The API is plain HTTP and WebSocket, so a bot also works with no library at all: [Without a library](/developers/docs/raw-http). [About the SDKs](/developers/docs/sdk)

## 5. Write your first bot {#first-bot}

Save this as hello.mjs in that folder. It registers /hello and answers it.

```example hello.mjs
```

## 6. Run it {#run-it}

Set the token, then start the bot:

```bash Terminal
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
node hello.mjs
```

When the terminal shows ready, type /hello in a channel of your test server. The bot answers Hello and your name.

## 7. Receive events {#gateway}

The bot keeps a WebSocket connection to the gateway. Commands, button clicks, new messages and member changes arrive there as events. [Gateway](/developers/docs/gateway)

## 8. Build a real bot {#deploy}

This bot knows only one command. The complete bot has commands, buttons, a form, moderation, saved data, error handling and reconnects, in one file and without a library. [Build a complete bot](/developers/docs/tutorial-full-bot)

## Next steps {#next-steps}

- [Slash commands](/developers/docs/commands)
- [Buttons, menus and forms](/developers/docs/components)
- [Errors](/developers/docs/errors)
- [Rate limits](/developers/docs/rate-limits)
