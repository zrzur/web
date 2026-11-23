# Bots in direct messages

Let people talk to your bot one to one: they open its conversation from its profile, Discover or a link, press Start, and your bot answers.

> This guide uses `@zrzur/sdk/bot`, so run `npm install @zrzur/sdk` in your bot's folder first. See [SDKs](/developers/docs/sdk).

## You will need {#you-will-need}

- Node 22 or newer and a bot token (`YOUR_BOT_TOKEN` below).
- The bot set to **Public** in the Developer Portal. Anyone can then write to it, with no server in common. A private bot is reached only by people who share a server with it.
- The `INTERACTIONS` intent, which is on by default.

```bash
export ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN
export ZRZUR_API_URL=https://api.zrzur.com
export ZRZUR_WS_URL=wss://events.zrzur.com
```

On Windows, in PowerShell:

```powershell PowerShell
$env:ZRZUR_BOT_TOKEN = "YOUR_BOT_TOKEN"
$env:ZRZUR_API_URL = "https://api.zrzur.com"
$env:ZRZUR_WS_URL = "wss://events.zrzur.com"
```

## How a conversation starts {#how-it-starts}

1. The person opens the conversation: **Message** on the bot's profile or its Discover page, or a bot link.
2. While the conversation is empty, Zrzur shows the bot's name, its description, up to five of its global commands and a **Start** button.
3. Pressing Start sends your bot an interaction of type `Start`. From then on your bot may write to the person, as if they had written first. Writing a message works the same way.

Until then your bot cannot write to someone it shares nothing with: `POST /channels/{id}/messages` answers `403`. A person who shares a server with your bot follows their own privacy setting, as before.

## Bot links {#bot-links}

A bot link opens the conversation with Start waiting. Add `start` to pass your bot a short value, for example where the person came from:

```text
https://zrzur.cc/b/YOUR_BOT_ID?start=spring-sale
```

| Part          | Rule                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `YOUR_BOT_ID` | The bot's id, as in its invite link                                    |
| `start`       | 1 to 64 characters of `A-Z`, `a-z`, `0-9`, `_` and `-`. Optional: `?start` alone opens the conversation without a value. Anything else is dropped and the conversation still opens. |

The value arrives once, when the person presses Start.

## The start interaction {#start-interaction}

`InteractionCreate` with `type: "Start"`, in the person's direct message with your bot (no `server_id`). `start.payload` is the link's value and is missing when there was none.

```json
{
  "_id": "01JD0000000000000000000000",
  "type": "Start",
  "application_id": "YOUR_BOT_ID",
  "channel_id": "01JD0000000000000000000001",
  "user": { "_id": "01JD0000000000000000000002", "username": "sami" },
  "start": { "payload": "spring-sale" },
  "token": "INTERACTION_TOKEN"
}
```

Answer it like any interaction, within 3 seconds: a message, a deferred message or a form. See [Interactions](/developers/docs/interactions#time-limits). `bot.on("start", …)` gives you the interaction, and `interaction.startPayload` the value (or `null`).

## The code {#the-code}

```example dm-start.mjs

```

Run it with `node dm-start.mjs`.

## What you should see {#what-you-should-see}

Open `https://zrzur.cc/b/YOUR_BOT_ID?start=spring-sale`, then press **Start**. The bot answers `Welcome! You came from the link "spring-sale".` with a **Show tips** button. Pressing it gives the tip. Its `/help` command is listed on the Start screen and under **Commands** in the message box.

## Stop and block {#stop-and-block}

The person can choose **Stop bot** in the conversation's menu. It blocks your bot: your messages and answers there are refused with `403`, and new interactions from them stop. After **Restart bot** they press Start again, and you get a new `Start` interaction.

## Common errors {#common-errors}

| Error                       | Cause                                                          | Fix                                                   |
| --------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| `DirectMessagesRestricted`  | The bot is private and shares no server with the person        | Make the bot public, or share a server                |
| `403` on sending            | The person has not pressed Start or written yet, or stopped the bot | Wait for `Start` or their first message          |
| `FailedValidation`          | A `start` value with other characters or over 64 characters    | Keep to `A-Z a-z 0-9 _ -`                             |
| `FeatureDisabled`           | Bots in direct messages are off on this server                 | Ask the server's admin                                |

## Next {#next}

- [Buttons, menus and forms](/developers/docs/components)
- [Slash commands](/developers/docs/commands)
