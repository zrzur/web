# Keeping tokens safe

A bot token is a password. Whoever has it acts as your bot in every server it is in.

## The rules {#rules}

1. Keep the token out of your code. Read it from an environment variable or a secret store.
2. Never put it in Git, in a screenshot, in a chat or in a support request.
3. Never log it. Log the bot's id instead.
4. Use `Authenticate` on the gateway, not `?token=` in the address: addresses end up in logs.
5. Run the bot with a token of its own. Use a second bot for testing.

## Keep it out of Git {#git}

```bash
echo ".env" >> .gitignore
echo "ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN" > .env
node --env-file=.env full-bot.mjs
```

`node --env-file` is built into Node 22.

## If a token leaks {#leak}

1. Open your application in the [Developer Portal](/developers), tab **Overview**, and choose **Reset token**.
2. Confirm your identity. The old token stops at once, and open connections end.
3. Put the new token in your secret store and restart the bot.
4. Read the server's audit log for what the bot did. Actions of your bot show the bot as the actor.

Treat a token that was in a public repository as stolen, even if you removed it a minute later.

## Other secrets {#others}

| Secret                     | Lives for          | If it leaks                                                         |
| -------------------------- | ------------------ | ------------------------------------------------------------------- |
| Bot token                  | until you reset it | Reset it                                                            |
| Interaction token          | 15 minutes         | Only works on one interaction. Keep it out of logs                  |
| Webhook address            | until replaced     | `POST /webhooks/{webhook_id}/token` makes a new one. Starts with `zrzur_wh_` |
| Signing secret             | until replaced     | Make a new one in **HTTP interactions**                             |
| OAuth2 client secret       | until reset        | Reset it on the **OAuth2** tab                                      |
| OAuth2 access token        | 1 hour             | `POST /oauth2/revoke`                                               |
| OAuth2 refresh token       | 30 days            | `POST /oauth2/revoke`. A reused one ends the whole chain            |

## Protect the people who use your bot {#people}

- Trust nothing in a message, a `custom_id` or a form as if it came from you. Anyone who can see a button can send what it sends.
- Before you act for a person, check `user_permissions_string`. The bot's permissions are not theirs.
- Stop a mention in your output with `allowed_mentions` on webhooks, or by not repeating text you did not write.
- Store as little as you can. Delete a user's data on `UserPlatformWipe`, and a server's data when the bot leaves.
- Ask only for the intents and permissions you use.

## Next {#next}

- [Running in production](/developers/docs/production)
- [Authentication](/developers/docs/authentication)
