# Interactions over HTTP

Receive commands, buttons and forms at your own HTTPS address, without a gateway connection.

> **This is off where the server's `signing_key` setting is empty or under 32 bytes.** Making a secret or saving an address then answers `FeatureDisabled`, and bots use the gateway. On a self-hosted server, the admin sets `api.interactions.signing_key`.

## You will need

- Node 22 or newer, and a public HTTPS address.
- Your bot token (`YOUR_BOT_TOKEN`) and its signing secret (`YOUR_SIGNING_SECRET`).
- No intents: interactions arrive whatever the gateway intents are.

## Steps

1. Open your bot in the Developer Portal and choose **HTTP interactions**. Make a signing secret and copy it. It is shown once.
2. Start the example below on your server, with the secret in `ZRZUR_SIGNING_SECRET`.
3. Enter your address in the same dialog, save and confirm your password. Zrzur sends it two test requests first, in either order: one with a wrong signature, which it must refuse, and a signed `Ping`, which it must answer with `{"type":"Pong"}`. The SDK does both for you.

From now on the gateway no longer receives this bot's interactions. Remove the address to go back.

## Full example

```example http-interactions.mjs

```

## What you should see

`ready as <your bot>` on the console, then `Hello <name>, over HTTP!` in the channel when someone uses `/hello`.

## What a request looks like

Each request is a `POST` with the same JSON as `InteractionCreate`'s `interaction`, and three headers:

| Header              | Meaning                                                   |
| ------------------- | --------------------------------------------------------- |
| `X-Zrzur-Timestamp` | Seconds since the epoch when it was signed                |
| `X-Zrzur-Signature` | `v1=` and the hex HMAC-SHA256 of the signed text          |
| `X-Zrzur-Delivery`  | Id of this delivery, for your logs. **Not signed**        |

The signed text is `v1:<timestamp>:<raw body>`. Without the SDK:

1. Refuse the request with `401` if the timestamp is more than 300 seconds from your clock.
2. Compute the HMAC-SHA256 of the signed text with your secret and compare it in constant time (`crypto.timingSafeEqual` in Node, `hmac.compare_digest` in Python). Never compare with `==`.
3. Refuse an `_id` from the signed body that you have already handled in the last ten minutes: that is a captured request sent again. Do not use `X-Zrzur-Delivery` for this: it is not signed, so anyone can change it.
4. Answer `{"type":"Ping"}` with `{"type":"Pong"}`.

A bot that was disabled, or whose owner was suspended, receives nothing, and its address cannot be changed.

Check against this example. With the secret `zrzur_sign_f27c5773e21ddeceaeb5e956dc45c16451f737addd5c0e4472f61060bca9b030`, the timestamp `1700000000` and the body `{"type":"Ping"}`, the signature is `v1=928e5ffdc88564103b59f5485a6bfa7e1a633dca64f397396606a314f572c4d3`.

## How to answer

Answer within 3 seconds, in one of two ways:

- `202` or `204` with no body, then call `POST /interactions/{id}/{token}/callback` as with the gateway. The SDK does this.
- `200` with the body you would send to that route, for example `{"type":"Message","data":{"content":"Hello"}}`.

Any other status, a timeout, a redirect or an answer over 1 MiB fails the interaction, and the person sees that it failed. Redirects are not followed.

## Common errors

Saving an address fails with `SignedDeliveryRejected`, and `reason` says why:

| `reason`                 | Cause                                       | Fix                                       |
| ------------------------ | ------------------------------------------- | ----------------------------------------- |
| `invalid_url`            | Not `https`, or holds a password            | Use a plain `https://` address            |
| `blocked_address`        | The address is private or blocked           | Use a public address                      |
| `not_reachable`          | Nothing answered                            | Check that the server runs and is public  |
| `timed_out`              | No answer in 3 seconds                      | Answer faster                             |
| `accepts_bad_signatures` | The request with a wrong signature passed   | Check signatures, answer `401`            |
| `bad_status`             | The `Ping` did not get `200`                | Answer `Ping` with `200`                  |
| `bad_answer`             | The `Ping` did not get `{"type":"Pong"}`    | Send exactly that JSON                    |
| `answer_too_large`       | The answer is over 1 MiB                    | Send a smaller answer                     |

`FeatureDisabled` means this server has no signing key configured, or one under 32 bytes. `InvalidOperation` means the bot has no signing secret yet.

## Next

- [Answering interactions](/developers/docs/interactions)
- [Errors](/developers/docs/errors)
