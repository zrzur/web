# Authentication

Which token goes where. To make a token, see [Applications and tokens](/developers/docs/applications). To protect it, see [Keeping tokens safe](/developers/docs/security).

## Bot tokens

Every application has one bot token. Send it in the `x-bot-token` header on every REST request:

```bash
curl https://api.zrzur.com/users/@me -H "x-bot-token: YOUR_BOT_TOKEN"
```

The gateway takes the same token, either in its first message (`Authenticate`) or as `?token=` in the URL. See [Gateway](/developers/docs/gateway).

> The token is a password. Keep it in an environment variable or a secret store, never in code, logs or screenshots. It is shown once, when it is made. You can reset it in the Developer Portal: your application → **Overview** → **Reset token**. After a reset the old token stops working at once.

## Which header does what

| Header            | Who uses it             | Accepted on                                                                                                      |
| ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `x-bot-token`     | Bots                    | Every endpoint marked "Bot token" in this reference                                                              |
| `x-session-token` | People, through the app | Everything, including account settings                                                                           |
| none              | Anyone                  | Public endpoints, interaction callbacks (the token is in the path), webhook execution (the token is in the path) |

If both a bot token and a session token are sent, the bot token is used. A token that is missing, wrong, or belongs to a suspended bot gets `401` with the error type `InvalidSession`.

## Interaction and webhook tokens

- **Interaction tokens** come with each `InteractionCreate` event. They are valid for 15 minutes and only for that interaction's callback, edits and follow-ups. No header is needed: the token is part of the path.
- **Webhook tokens** belong to one webhook and start with `zrzur_wh_`. Whoever has the webhook URL can post to its channel, so treat it like a bot token. It is shown once, when it is made; a lost one can only be replaced.

## Bots and their owners

Creating, editing, resetting and deleting a bot is done by its **owner** in the Developer Portal, with the owner's own login. A bot token cannot manage applications. Deleting a bot cannot be undone, so the owner confirms it again with their password, authenticator code or recovery code.

```endpoints authentication

```

## OAuth2 {#oauth2}

Signing people in to your website, and install links, are on the [OAuth2](/developers/docs/oauth2) page.
