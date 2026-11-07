# Build a complete bot

In about 30 minutes you have a real bot: slash commands, buttons, a form, moderation, saved data, plain error messages, and a connection that comes back by itself.

## You will need {#you-will-need}

- Node 22 or newer. Check with `node --version`. Nothing else: no library to install.
- A Zrzur account and a server of your own to test in. Create the server in the app.
- Intents: `SERVERS` and `INTERACTIONS`. Both are free, and the code asks for them.

## What the bot does {#what}

| Command                    | Who          | Shows                                         |
| -------------------------- | ------------ | --------------------------------------------- |
| `/ping`                    | everyone     | A private reply                               |
| `/note add`                | everyone     | A form; the note is saved to a file           |
| `/note list`               | everyone     | Notes, with Older and Newer buttons           |
| `/warn member reason`      | moderators   | A saved warning                               |
| `/timeout member minutes`  | moderators   | A real timeout, with a deferred reply         |

## Steps {#steps}

### 1. Make an empty folder {#step-1}

```bash
mkdir my-bot
cd my-bot
```

### 2. Create the application {#step-2}

Open the [Developer Portal](/developers), choose **New application**, enter a name, accept the bot rules and choose **Create**. Copy the token: it is shown once. See [Applications and tokens](/developers/docs/applications).

### 3. Install the bot in your server, with Timeout Members {#step-3}

Open the tab **OAuth2** of your application. In **URL generator**, tick `bot.install`, and under **Bot permissions** tick **Timeout Members**. Open the **Invite link**, pick your server and confirm.

### 4. Move the bot's role up {#step-4}

A bot can only time out members who rank below it. In your server open **Server settings → Roles** and drag the role with the bot's name above the roles of ordinary members.

### 5. Find your server's id {#step-5}

The address of your server in the app is `/server/SERVER_ID`. Copy that id. While you test, commands go to this server only.

### 6. Save the code {#step-6}

Save the file below as `full-bot.mjs` in your folder.

```example full-bot.mjs

```

### 7. Start it {#step-7}

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_TEST_SERVER=YOUR_SERVER_ID
node full-bot.mjs
```

In Windows PowerShell, use `$env:ZRZUR_BOT_TOKEN = "YOUR_BOT_TOKEN"`. On a self-hosted server, also set `ZRZUR_API_URL` and `ZRZUR_WS_URL`.

## What you should see {#what-you-should-see}

In the terminal:

```json
{"time":"2026-11-06T07:02:51.503Z","level":"info","message":"commands registered","count":4}
{"time":"2026-11-06T07:02:51.576Z","level":"info","message":"ready","servers":1}
```

In your server, type `/` in a channel. The four commands appear with your bot's name. Then try them:

1. `/ping` answers `Pong!`, seen only by you.
2. `/note add` opens a form. Fill it in and send it. The answer is `Saved.`
3. A file `bot-data.json` is now in your folder.
4. `/note list` shows the note. Add a second note, and the buttons work.
5. `/warn` picks a member and a reason, and counts the warnings.
6. `/timeout` silences a member. You cannot time out the server's owner: try it and read the error.
7. Press Ctrl+C and start the bot again. Your notes are still there.
8. Turn your network off and on. The terminal shows `disconnected`, then `ready`, and the commands work again.

## How it works {#how}

**Saved data.** `save()` writes the whole data to a second file and renames it. A crash never leaves half a file. A JSON file is enough for one small bot; a real database fits a larger one, and only `save()` and the loading at the start change.

**`rest()`.** Every call goes through one function. It waits after a `429`, pauses everything after a global one, retries on network errors and on `5xx`, and throws `ApiError` for the rest. See [Rate limits](/developers/docs/rate-limits).

**`COMMANDS`.** The list is sent with `PUT` at each start. Without `ZRZUR_TEST_SERVER` the commands become global. See [Slash commands](/developers/docs/commands).

**`optionsOf()`.** Values of a sub-command sit one level deeper than plain options. This function flattens them.

**`onCommand()`.** Each path gives one first answer: `reply` for a message, `Modal` for the form. `/timeout` first answers `DeferredMessage`, and later edits the original with `PATCH`. See [Answering interactions](/developers/docs/interactions).

**`custom_id`.** A button carries the page number in `note:3`. The bot holds no state for it, so buttons keep working after a restart.

**`hasBit()`.** `default_member_permissions` hides moderation commands from members, but the bot still checks its own permission in `app_permissions_string` first, to give a clear answer.

**`outranks()`.** The server only compares the target with the bot. Without this check a moderator could silence someone above them through the bot, so it compares the two people first. A lower rank number is higher.

**`onInteraction()`.** One `try` around each interaction. The person reads plain words from `explain()`, and your log has the details. If the first answer already went out, the error edits it. A second first answer would fail.

**`connect()`.** The `Ping` timer finds dead lines. The `close` handler waits 1, 2, 4 ... 30 seconds and connects again, and `Ready` resets the wait. It stops on `InvalidSession` and on `4014`, because retrying cannot help. See [Gateway](/developers/docs/gateway).

## Common errors {#errors}

| What you see                        | Cause                                         | Fix                                                  |
| ----------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `Set ZRZUR_BOT_TOKEN first.`        | The variable is not set in this terminal      | Step 7                                               |
| `the token was refused, stopping`   | Wrong or reset token                          | Copy the token again, or reset it                    |
| `could not start`, `ApplicationNotInstalled` | The server id in `ZRZUR_TEST_SERVER` is wrong, or the bot is not there | Step 3 and 5 |
| Commands do not appear              | The bot is not in this server                 | Step 3                                               |
| "I need the Timeout Members permission." | The link had no permission               | Step 3 again, or give the bot's role that permission |
| "That member ranks at or above me." | The bot's role is too low                    | Step 4                                               |
| "That member ranks at or above you." | You rank at or below that member            | Ask someone higher                                   |
| "That member cannot be timed out."  | It is the server's owner (`InvalidOperation`) | Pick another member                                  |
| The bot did not answer              | The bot was not running                       | Start it                                             |

## Next {#next}

- [Running in production](/developers/docs/production)
- [Buttons, menus and forms](/developers/docs/components)
