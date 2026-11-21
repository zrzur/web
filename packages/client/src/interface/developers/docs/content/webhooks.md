# Webhooks

A webhook posts messages into one channel. It needs no bot, no gateway connection and no library: one HTTP request with its address is enough, so it suits a CI job, a monitoring script, a form or a news feed. A bot can make webhooks too, and only webhooks a bot made can carry buttons and menus.

> **Webhooks are switched on per server installation.** `GET /` on the API shows `features.webhooks`. Where it is `false`, creating or listing webhooks answers `FeatureDisabled` and every `/webhooks/...` address answers `404 NotFound`. On `api.zrzur.com` it was `false` when this page was checked (2026-11-14).

A webhook posts into one channel without a gateway connection. Create one with a bot token or in server settings (needs Manage Webhooks). The answer has `token` and `url`. They are shown once: the server keeps only a hash, so save them now. A lost token can only be replaced.

```bash
curl -X POST "https://api.zrzur.com/webhooks/$WEBHOOK_ID/$WEBHOOK_TOKEN?wait=true" \
  -H "content-type: application/json" \
  -d '{"content": "Build finished", "username": "CI"}'
```

Anyone with the address can post, so treat it like a password. Tokens start with `zrzur_wh_`, so secret scanners can find a leaked one. `POST /webhooks/{webhook_id}/token` makes a new token; the old one stops at once.

## Sending

`POST /webhooks/{webhook_id}/{token}` answers `204`. With `?wait=true` it returns the message.

| Field              | Meaning                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `content`          | Up to 2000 characters. A message needs at least one of `content`, `embeds`, `attachments`, `components`        |
| `username`         | Name on this message, 1 to 80 characters. The webhook mark stays                                               |
| `avatar_url`       | Avatar on this message, a public web address. Clients load it through the media proxy, which checks it          |
| `embeds`           | Up to 10, 6000 characters in total. `type` is ignored: embeds are always rich                                  |
| `allowed_mentions` | Which mentions may notify anyone. `{ "parse": [] }` turns them all off                                         |
| `flags`            | `4` hides link previews, `4096` sends without a notification                                                   |
| `thread_id`        | Query parameter: post into this thread of the webhook's channel                                                |
| `thread_name`      | Forum: start a thread with this name. `applied_tags` sets its tags. A forum without either answers `ForumThreadRequired` |

Embeds take `title` (256), `description` (4096), `url`, `color` (a number) or `colour` (CSS text), `timestamp`, `author` (name 256), `footer` (text 2048), up to 25 `fields` (name 256, value 1024), `image.url`, `thumbnail.url`.

To send files, use `multipart/form-data` with `files[0]`, `files[1]`, ... and the JSON body in `payload_json`. Each file passes the same checks as a member's upload. Up to 5 files of 20 MB; refer to one from an embed with `attachment://name.png`. A webhook without Upload Files gets `403`, never a message without its files.

`@everyone`, `@online` and role mentions notify people only if the webhook has the matching permission and `allowed_mentions` allows them. New webhooks have neither permission, and the text is still posted. Edits never notify anyone.

Interactive components work only on webhooks a bot created, and clicks go to that bot. Other webhooks can post links, text and media.

## Editing a webhook

`PATCH /webhooks/{webhook_id}` with Manage Webhooks changes the name, avatar, permissions and channel, and takes `X-Audit-Log-Reason`. With the token, `PATCH /webhooks/{webhook_id}/{token}` changes only the name and avatar; `permissions` or `channel_id` there answer `403`. `GET` with the token leaves out who made it. Names have 1 to 80 characters and cannot contain hidden characters or pass for Zrzur, its staff or a verified bot.

## Its own messages

`GET`, `PATCH` and `DELETE /webhooks/{webhook_id}/{token}/messages/{message_id}` work on messages this webhook sent, and no others.

In a thread a webhook needs `SendMessageInThreads`, and `CreateForumPosts` to start a forum post. What the roles of its creator deny is denied to it too. Where threads or forums are switched off it can't send or edit, but it can delete its own messages.

## Limits

Each channel has up to 15 webhooks (`TooManyChannelWebhooks`) and each server up to 1000 (`TooManyServerWebhooks`).

One webhook sends 5 messages in 2 seconds, and all webhooks of a channel 30 a minute. Over that, the answer is `429` with `{ "type": "RateLimited", "retry_after": 1200, "global": false }` (milliseconds) and the `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset-After` and `Retry-After` headers. After 20 wrong tokens in a minute an address waits, even with a right token.

AutoMod reads webhook messages and their embeds, on edits too. Moderators can delete and report them like any message.

## Other formats

- `POST /webhooks/{webhook_id}/{token}/github` takes GitHub deliveries: set the content type to `application/json` or form. It shows `commit_comment`, `create`, `delete`, `fork`, `issue_comment`, `issues`, `member`, `public`, `pull_request`, `pull_request_review`, `pull_request_review_comment`, `push`, `release`, `watch`, `check_run`, `check_suite`, `discussion`, `discussion_comment` and `star`. Every other event answers `204`.
- `POST /webhooks/{webhook_id}/{token}/slack` takes `text`, `attachments`, `blocks`, `username` and `icon_url`. It returns the message unless `?wait=false`.

Nothing from these two formats notifies anyone.

## Making and managing webhooks {#managing}

All of these need **Manage Webhooks** in the channel, and work with a bot token or a person's session.

| Request | What it does |
| --- | --- |
| `POST /channels/{channel_id}/webhooks` | Make a webhook: `{ "name": "CI", "avatar": "<file id>" }`. The answer has `token` and `url`, shown this once |
| `GET /channels/{channel_id}/webhooks` | The webhooks of one channel, without tokens |
| `GET /servers/{target}/webhooks` | The webhooks of every channel of the server where you have Manage Webhooks, newest first, without tokens |
| `GET /webhooks/{webhook_id}` | One webhook, with who made it |
| `PATCH /webhooks/{webhook_id}` | Name, avatar, permissions, or move it to another channel of the server |
| `POST /webhooks/{webhook_id}/token` | A new token: the old one stops at once. Keep the `token` of the answer |
| `POST /webhooks/{webhook_id}/test` | Post a test message without the token: `{ "content": "Test" }`, 1 to 200 characters. It sends no notification and mentions nobody, and returns the message |
| `DELETE /webhooks/{webhook_id}` | Remove it. Its messages stay |

With the token instead (no login): `GET`, `PATCH` (name and avatar only) and `DELETE /webhooks/{webhook_id}/{token}`.

A new token and a test message count in a small bucket of their own, `webhook_manage`: 5 per 10 seconds for each webhook. They do not use up the room of the messages sent through it.

## Events {#events}

The gateway sends `WebhookCreate`, `WebhookUpdate` and `WebhookDelete` only to those who may manage the channel's webhooks, and to bots only with the `SERVERS` intent. Messages sent through a webhook arrive as ordinary `Message` events, with `webhook: { name, avatar }` on the message. See the [Event reference](/developers/docs/events).

## Common errors {#errors}

| Error | Cause | Fix |
| --- | --- | --- |
| `401 NotAuthenticated` or `404 NotFound` | The token is wrong or was replaced | Use the latest token; make a new one if it is lost |
| `403 MissingPermission` | No Manage Webhooks (managing), or the webhook lacks Upload Files (files) | Give the permission in the channel |
| `400 TooManyChannelWebhooks` | 15 webhooks in this channel already | Remove one you no longer use |
| `429 RateLimited` | More than 5 messages in 2 seconds, or 30 a minute in the channel | Wait `retry_after` milliseconds |
| `400 FeatureDisabled` | Webhooks are switched off on this server installation | Ask its operator |

## Reference

```endpoints webhooks

```
