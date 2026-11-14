# Applications and tokens

Create a bot in the Developer Portal, change its settings and install it in a server.

## You will need {#you-will-need}

A Zrzur account. Sign up in the app if you have none. Bots have owners. An account can create 7 bots a week: each creation counts for 7 days, and deleting a bot does not give the creation back.

## Create an application {#create}

An application and its bot are one thing: the application id, the bot id and the bot's user id are the same value.

1. Open the [Developer Portal](/developers). It asks you to sign in. You also find it under **Settings → Developer Portal**.
2. Choose **New application**.
3. Enter a username for the bot. Read the bot rules, turn on the switch that says you accept them, then choose **Create**.
4. The token appears once. Copy it now and keep it safe: Zrzur stores only a fingerprint of it and cannot show it again.

> You can always make a new token (see below), but the old one stops working at that moment.

## The Overview tab {#overview-tab}

| Setting            | What it does                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Public bot         | On: anyone with Manage Server can install it. Off: only you can, and others get `BotIsPrivate`                   |
| Show your name on the bot's page | On: people who open the bot's invite page see that you made it. Off by default                     |
| Privileged intents | Switches for Message content, Server members and Presence. Each switch is saved at once and counts from the bot's next gateway connection. See [Intents](/developers/docs/gateway#intents) and [when an intent is off](/developers/docs/gateway#intent-off)       |
| Username           | The bot's name                                                                                                   |
| Bot ID             | The id you use in `/applications/{id}/...` routes                                                                |
| Add to a server    | Installs the bot in one of your servers                                                                          |
| Invite link        | A link to share, `/bot/<bot id>` in the app                                                                      |
| Reset token        | Makes a new token. It asks you to confirm your identity. The old token stops at once                            |
| HTTP interactions  | Receive commands at your own address. See [Interactions over HTTP](/developers/docs/http-interactions)           |
| Delete bot         | Deletes the bot for good. It asks you to confirm your identity                                                   |

## The Commands tab {#commands-tab}

Lists the bot's global commands. A form adds, changes and deletes them, with options, names in other languages and who may use them, and shows a preview; **Import JSON** and **Export JSON** take and give the whole list. If your bot sends its list when it starts, that list replaces what you save here. See [Slash commands](/developers/docs/commands).

## Install the bot in a server {#install}

A bot does nothing until it is in a server. The person who installs it needs **Manage Server** there. To give the bot permissions at the same time they also need **Manage Roles** and every permission they give.

The quickest way, for your own test server:

1. Open your application, tab **Overview**, and choose **Add to a server**.
2. Pick the server.

To install with chosen permissions, or to let others install it:

1. Open your application, tab **OAuth2**, part **URL generator**.
2. Tick `bot.install` and the permissions the bot needs.
3. Copy the **Invite link** and open it, or send it to the server's admin.
4. The person picks a server and confirms.

The permissions become a role named after the bot. Zrzur creates and manages that role: people can raise it, but they cannot delete it while the bot is there. Ask only for what the bot uses.

```text
Reply to commands     nothing extra
Send messages         SendMessage, ViewChannel (members have these by default)
Moderate              KickMembers, BanMembers, TimeoutMembers, ManageMessages
```

The bot gets a role only if the link has permissions. With **Add to a server** it is a plain member with the server's default permissions.

After installing, move the bot's role above the members it should moderate. See [Ranking](/developers/docs/roles#ranking).

## Server limit and verification {#limits}

An unverified bot can join 100 servers. After that installing fails with `BotNeedsVerification`. Past 100 servers it keeps only the privileged intents Zrzur approved. On the **Overview** tab, choose **Verification** and describe the bot. The same request as a call, for the owner, signed in:

```bash
curl -X POST "https://api.zrzur.com/bots/YOUR_BOT_ID/verification" \
  -H "x-session-token: YOUR_SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "statement": "Keeps notes and warnings for one gaming community.",
    "website": "https://example.com/bot",
    "support": "https://example.com/help",
    "privacy_policy_url": "https://example.com/privacy",
    "terms_of_service_url": "https://example.com/terms",
    "intents": 0
  }'
```

| Field       | Required | Meaning                                                                    |
| ----------- | -------- | -------------------------------------------------------------------------- |
| `statement` | yes      | 20 to 1000 characters: what the bot does, who uses it, how it handles data |
| `website`   | no       | Website or documentation, `https://`, up to 200 characters                 |
| `support`   | no       | Where users get help, `https://`, up to 200 characters                     |
| `privacy_policy_url` | yes | The bot's privacy policy, `https://`, up to 200 characters. Also saved on the bot |
| `terms_of_service_url` | yes | The bot's terms, `https://`, up to 200 characters. Also saved on the bot |
| `intents`   | no       | Sum of the privileged intents the bot needs. Approval approves them        |

One request can be open at a time, and after a denial you can ask again a week later. `GET /bots/{target}/verification` answers `verified`, `request` with its `status` (`Pending`, `Approved`, `Denied` or `Revoked`), and `can_apply_at`.

## Common errors {#errors}

| Error                  | Cause                                         | Fix                                            |
| ---------------------- | --------------------------------------------- | ---------------------------------------------- |
| `BotIsPrivate`         | The bot is private and you are not its owner  | Turn on Public bot                             |
| `AlreadyInServer`      | The bot is already there                      | Nothing to do                                  |
| `MissingPermission`    | You lack Manage Server or Manage Roles        | Ask the server's owner                         |
| `BotNeedsVerification` | 100 servers reached                           | Ask for verification                           |
| `ReachedMaximumBots`   | Your account owns too many bots               | Delete a bot you do not use                    |
| `TooManyBotCreations`  | 7 bots created in the last 7 days             | Wait until `resets_at` (milliseconds). Reset the token of a bot you have instead |

## Next {#next}

- [Start your bot](/developers/docs/getting-started)
- [Keeping tokens safe](/developers/docs/security)
