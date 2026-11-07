# Rate limits

How many requests a bot may send, how to read the headers, and what to do after a `429`.

## The three limits {#limits}

1. **Buckets.** Each route counts against a bucket, in a window of 10 seconds. The table below lists them.
2. **Global.** A bot makes at most 50 requests a second, across all routes.
3. **Refused requests.** One address that collects 10 000 answers of `401` or `403` within 10 minutes is blocked for 10 minutes. This stops token guessing; a healthy bot never gets near it.

Bots are counted by their id, so the limits are the same from any address and do not change with more processes.

## The headers {#headers}

Every response says where you stand. These values come from a real answer of `GET /users/@me`:

```text
x-ratelimit-limit: 20
x-ratelimit-remaining: 13
x-ratelimit-reset-after: 3766
x-ratelimit-bucket: 7575212770586562519
```

| Header                    | Meaning                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `X-RateLimit-Limit`       | Requests allowed in the window                                          |
| `X-RateLimit-Remaining`   | Requests left                                                           |
| `X-RateLimit-Reset-After` | Milliseconds until the window resets                                    |
| `X-RateLimit-Bucket`      | An id of this bucket. It is a number, not the bucket's name             |
| `X-RateLimit-Global`      | `true` when the global limit was the one hit                            |
| `Retry-After`             | On a `429` only: seconds to wait, rounded up                            |

## After a 429 {#after-429}

A rate limit is a `429` without a `type`:

```json
{ "retry_after": 3531, "global": false }
```

`retry_after` is in **milliseconds**.

- `global: false`: wait that long, then repeat this request. Others can go on.
- `global: true`: the bot hit its 50 a second. **Pause every request** until the time is over, not only this one.

```js
let pausedUntil = 0;

async function call(path, init) {
  const wait = pausedUntil - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  const response = await fetch(`https://api.zrzur.com${path}`, init);
  if (response.status !== 429) return response;

  const body = await response.json();
  if (body.type) throw new Error(body.type); // a refusal, see below
  if (body.global) pausedUntil = Date.now() + body.retry_after;
  await new Promise((r) => setTimeout(r, body.retry_after));
  return call(path, init);
}
```

A `429` **with** a `type` is a refusal to show to a person, not one to wait out. `InSlowmode` means the channel's slowmode, and `RateLimited` is a webhook's limit.

## Buckets {#buckets}

```ratelimits

```

`/servers` and `/channels` count per server and per channel. The `servers` bucket allows only 5 requests per 10 seconds per server, shared by reads and writes. Member lists (`GET /servers/{target}/members`) have their own bucket of 15, `member_list`. A busy moderation bot reaches it quickly: keep members in a cache fed by `Ready` and member events, and use the member data that comes with interactions.

`/interactions/{interaction_id}/{token}/...` has a bucket of 10 per interaction, which is plenty.

## Other limits {#other}

| What                        | Limit                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| One webhook                 | 5 messages in 2 seconds                                               |
| All webhooks of a channel   | 30 messages a minute                                                  |
| Typing over HTTP            | 5 per 10 seconds per channel                                          |
| Interactions                | 3 seconds to answer, 15 minutes to finish                             |

## Next {#next}

- [Errors](/developers/docs/errors)
- [Running in production](/developers/docs/production)
