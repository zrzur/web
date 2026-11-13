# Errors

Every error type the API can return, with its cause and its fix.

## Error format {#format}

Every error is JSON with a `type`, sometimes with more fields:

```json
{ "type": "MissingPermission", "permission": "ManageMessages" }
{ "type": "FailedValidation", "error": "content: length must be between 0 and 2000" }
{ "type": "FileTooLarge", "max": 20000000 }
```

Branch on `type`, never on the text. Types are stable: they are never renamed or removed. New ones can appear in newer servers, so treat an unknown type as a general failure.

## What to do with an error {#what-to-do}

| Status       | Meaning                  | What to do                                            |
| ------------ | ------------------------ | ----------------------------------------------------- |
| `400`, `422` | The request is wrong     | Fix it. The same request fails again                  |
| `401`        | The token is wrong       | Stop the bot and check the token                      |
| `403`        | The bot may not do this  | Tell the person. Do not retry                         |
| `404`        | It is gone               | Forget it                                             |
| `409`        | A conflict               | Fetch the current state                               |
| `429`        | Too many requests        | See [Rate limits](/developers/docs/rate-limits)       |
| `5xx`        | Our side failed          | Retry with a growing delay, three to five times       |

Errors raised by the web server itself (no token, unknown route, a body that is not JSON) are JSON too. Check the status before you parse a body, because a proxy in between can still answer with HTML.

## Is the bot in that server? {#not-installed}

A bot sees only the servers it was installed in. For a server it is not in, the answers differ by route:

| Call                                                         | Answer                    |
| ------------------------------------------------------------ | ------------------------- |
| `GET /servers/{target}`                                      | `404 NotFound`            |
| `GET /channels/{target}` for one of its channels             | `404 NotFound`            |
| `POST /channels/{target}/messages` for one of its channels   | `403 MissingPermission`   |

So a `403 MissingPermission` when your bot writes to a channel id someone gave it can mean that the bot is not installed there. Ask `GET /channels/{target}`: `404 NotFound` means the bot is not in that server (or the channel does not exist), so install the bot first, with the invite link from the Developer Portal. A `403 MissingPermission` there means the bot is in the server and cannot see the channel: a private channel needs View Channel for one of the bot's roles.

## Errors a bot can get {#bot-errors}

```errors bots

```

## Errors of account routes {#account-errors}

Bots rarely see these. They belong to routes for people, such as signing in.

```errors accounts

```

## OAuth2 errors {#oauth2-errors}

`POST /oauth2/token` follows the OAuth2 standard and answers with `error` and `error_description` instead of `type`. See [OAuth2](/developers/docs/oauth2).

## Next {#next}

- [Rate limits](/developers/docs/rate-limits)
- [Running in production](/developers/docs/production)
