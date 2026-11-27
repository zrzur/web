# Applications and tokens

Create a bot in the Developer Portal, change its settings and install it in a server.

## You will need {#you-will-need}

A Zrzur account. Sign up in the app if you have none. Bots have owners. An account can create 7 bots a week: each creation counts for 7 days, and deleting a bot does not give the creation back.

## Create an application {#create}

An application and its bot are one thing: the application id, the bot id and the bot's user id are the same value. It is also the OAuth2 client id.

1. Open the [Developer Portal](/developers). It asks you to sign in. You also find it under **Settings → Developer Portal**.
2. Choose **New application**.
3. Enter a name for the bot. Read the bot rules, tick the box that says you accept them, then choose **Create**.
4. The token appears once. Copy it now and keep it safe: Zrzur stores only a fingerprint of it and cannot show it again.

> You can always make a new token (see [Bot](/developers/docs/applications#bot-tab)), but the old one stops working at that moment.

## Your application's page {#tabs}

Open an application from **My applications**. Its name, whether it is public or private, and its **application id** with a copy button are at the top, on every tab. The tabs below hold everything else, each thing in one place.

| Tab          | What is there                                                                    |
| ------------ | -------------------------------------------------------------------------------- |
| General      | The bot's profile, its username, who may install it, deleting it                 |
| Bot          | The token, HTTP interactions and privileged intents                               |
| Commands     | The bot's global commands, with a form                                            |
| Install      | Adding the bot to your server, and the invite link with its permissions           |
| OAuth2       | Sign in with Zrzur for your own app: client secret, redirects, sign-in link       |
| Verification | Asking Zrzur to verify the bot                                                    |
| Discover     | Listing the bot on Discover, where people find bots                               |

## General {#general-tab}

| Setting                          | What it does                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Avatar and banner                | The bot's pictures. A GIF or animated WebP banner plays on its profile and invite page          |
| Display name, pronouns, bio      | What people see on the bot's profile                                                           |
| Username                         | The bot's handle                                                                               |
| Public bot                       | On: anyone with Manage Server can install it. Off: only you can, and others get `BotIsPrivate` |
| Show your name on the bot's page | On: people who open the bot's invite page see that you made it. Off by default                 |
| Delete bot                       | Deletes the bot for good. It asks you to confirm your identity                                 |

## Bot {#bot-tab}

| Setting            | What it does                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reset token        | Makes a new token. It asks you to confirm your identity. The old token stops at once                                                                                                                                 |
| HTTP interactions  | Receive commands at your own address. See [Interactions over HTTP](/developers/docs/http-interactions)                                                                                                               |
| Privileged intents | Switches for Message content, Server members and Presence. Each switch is saved at once and counts from the bot's next gateway connection. See [Intents](/developers/docs/gateway#intents) and [when an intent is off](/developers/docs/gateway#intent-off) |

## Commands {#commands-tab}

Lists the bot's global commands. A form adds, changes and deletes them, with options, names in other languages and who may use them, and shows a preview; **Import JSON** and **Export JSON** take and give the whole list. If your bot sends its list when it starts, that list replaces what you save here. See [Slash commands](/developers/docs/commands).

## Install the bot in a server {#install}

A bot does nothing until it is in a server. The person who installs it needs **Manage Server** there. To give the bot permissions at the same time they also need **Manage Roles** and every permission they give.

For your own server, open your application, tab **Install**, and choose **Add to a server**. Pick the server, then untick any permission you do not want the bot to have, and confirm.

To let others install it, use the invite link on the same tab:

1. Tick the permissions the bot needs. The link below changes with them.
2. Copy the **Link** and send it to the server's admin, or open it yourself.
3. The person picks a server, sees every permission the bot asks for, can untick any of them, and confirms.

The permissions become a role named after the bot. Zrzur creates and manages that role: people can raise it, but they cannot delete it while the bot is there. Ask only for what the bot uses.

```text
Reply to commands     nothing extra
Send messages         SendMessage, ViewChannel (members have these by default)
Moderate              KickMembers, BanMembers, TimeoutMembers, ManageMessages
```

A link without permissions gives the bot its **default permissions**: the `default_permissions` you set with `PATCH /bots/{bot_id}`. The installer gives only the part they hold themselves, and only with Manage Roles; without it the bot joins without a role. `?permissions=0`, or every permission unticked, gives no role.

After installing, move the bot's role above the members it should moderate. See [Ranking](/developers/docs/roles#ranking).

## Server limit and verification {#limits}

An unverified bot can join 100 servers. After that installing fails with `BotNeedsVerification`. Past 100 servers it keeps only the privileged intents Zrzur approved.

Any bot can ask to be verified, whatever its size. You need a confirmed e-mail address and to be 18 or older. On the **Verification** tab, describe the bot and give its links; the tab shows what the Zrzur team looks at (your own lines, the bot's age and its servers that count) and the privileged intents the request asks for, which are the ones switched on in the **Bot** tab. The bot's servers and age never stop a request: the team weighs them in the review.

The same request as a call, for the owner, signed in:

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

| Field                  | Required | Meaning                                                                            |
| ---------------------- | -------- | ---------------------------------------------------------------------------------- |
| `statement`            | yes      | 20 to 1000 characters: what the bot does, who uses it, how it handles data         |
| `website`              | no       | Website or documentation, `https://`, up to 200 characters                         |
| `support`              | no       | Where users get help, `https://`, up to 200 characters                             |
| `privacy_policy_url`   | yes      | The bot's privacy policy, `https://`, up to 200 characters. Also saved on the bot  |
| `terms_of_service_url` | yes      | The bot's terms, `https://`, up to 200 characters. Also saved on the bot           |
| `intents`              | no       | Sum of the privileged intents the bot needs. Approval approves them                |

One request can be open at a time, and after a denial you can ask again a week later. `GET /bots/{target}/verification` answers:

| Field          | Meaning                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`     | Whether the bot is verified                                                                                                                              |
| `request`      | The latest request, with its `status`: `Pending`, `Approved`, `Denied` or `Revoked`, and the team's `decision_note`                                     |
| `can_apply_at` | After a denial: when you can ask again (milliseconds). Missing when you can ask now                                                                     |
| `checks`       | What the team looks at, one line each: `code`, `met` (missing when a person decides), `value` and `needed`. Only `owner`, `bot_active`, `email` and `adult` stop a request |

A refused request answers `FailedValidation` with `not_eligible:` and the codes of the lines that are not met, for example `not_eligible:email`.

## Common errors {#errors}

| Error                  | Cause                                          | Fix                                                                              |
| ---------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `BotIsPrivate`         | The bot is private and you are not its owner   | Turn on Public bot                                                               |
| `AlreadyInServer`      | The bot is already there                       | Nothing to do                                                                    |
| `MissingPermission`    | You lack Manage Server or Manage Roles         | Ask the server's owner                                                           |
| `BotNeedsVerification` | 100 servers reached                            | Ask for verification                                                             |
| `ReachedMaximumBots`   | Your account owns too many bots                | Delete a bot you do not use                                                      |
| `TooManyBotCreations`  | 7 bots created in the last 7 days              | Wait until `resets_at` (milliseconds). Reset the token of a bot you have instead |

## Next {#next}

- [Start your bot](/developers/docs/getting-started)
- [Keeping tokens safe](/developers/docs/security)
