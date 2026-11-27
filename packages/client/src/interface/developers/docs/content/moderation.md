# Moderation

Bots can kick, ban, time out, delete messages in bulk and read the audit log. The server enforces everything; your bot should still check the person who asked.

## Rules the server enforces

- The bot needs the matching permission: Kick Members, Ban Members, Timeout Members, Manage Messages, View Audit Logs.
- The target must rank below the bot. The server owner cannot be kicked, banned or timed out.
- A timeout is an end time (`timeout`, ISO 8601). Members who hold Timeout Members themselves cannot be timed out (`IsElevated`), and nobody can time out themselves. End a timeout early with `remove: ["Timeout"]`.
- A ban can delete the user's messages from the last 7 days (`delete_message_seconds`, at most 604800).
- Bulk delete takes up to 100 messages younger than a week.

## Rules your bot should add

1. **Check the person, not just the bot.** Use `user_permissions` from the interaction (see [Roles and permissions](/developers/docs/roles#permission-strings)).
2. **Compare ranks.** Refuse when the target ranks at or above the person who asked.
3. **Refuse obvious mistakes:** acting on yourself, on the bot, or on the owner.
4. **Write a reason.** Reasons appear in the audit log.
5. **Answer privately.** Moderation replies are best `ephemeral`.

## Kick, ban, time out {#actions}

```bash
# kick
curl -X DELETE "https://api.zrzur.com/servers/SERVER_ID/members/USER_ID" \
  -H "x-bot-token: YOUR_BOT_TOKEN" -H "X-Audit-Log-Reason: Spam"

# ban
curl -X PUT "https://api.zrzur.com/servers/SERVER_ID/bans/USER_ID" \
  -H "x-bot-token: YOUR_BOT_TOKEN" -H "content-type: application/json" \
  -d '{ "reason": "Spam", "delete_message_seconds": 86400 }'

# time out until a date
curl -X PATCH "https://api.zrzur.com/servers/SERVER_ID/members/USER_ID" \
  -H "x-bot-token: YOUR_BOT_TOKEN" -H "content-type: application/json" \
  -d '{ "timeout": "2026-12-01T12:00:00Z" }'
```

The header `X-Audit-Log-Reason` puts a reason in the audit log. It works on every moderation route.

## Audit log

`GET /servers/{target}/audit_logs` lists who did what. Actions done by your bot appear with the bot as the actor.

Filter it with `user` (who acted), `target` (who or what it was done to), `type` (the action), `before` and `after` (entry ids) and `limit`. Page backwards with `before` set to the oldest id you got.

## Bans {#bans}

`GET /servers/{target}/bans` lists the bans with the banned users; `DELETE /servers/{target}/bans/{user_id}` lifts one. Bans need Ban Members. A banned user cannot join again until the ban is lifted.

## Join requests {#join-requests}

A server that lets people in only after a look (`access`) keeps their requests. With Manage Join Requests a bot can work through them: `GET /servers/{target}/join_requests` lists the pending ones, oldest first, with the lobby answers; `POST /servers/{target}/join_requests/{applicant}/approve` makes the person a member, `.../reject` refuses them. Approving fails when someone else decided already, or when the person can't join (banned, a full server, age). The applicant's own routes (`GET` and `DELETE /servers/{target}/join_requests/@me`) are for people.

## Keeping a server safe {#safety}

- [AutoMod](/developers/docs/servers#automod) keeps messages out before they are posted, with rules the server stores.
- `PUT /servers/{target}/safety/pause` stops invites, Discover joins and DMs between strangers for a few hours during a raid ([Servers](/developers/docs/servers#tools)).
- The `servers` bucket allows 5 actions per 10 seconds per server, so a bot that answers a raid should act on the worst accounts first and expect `429` ([Rate limits](/developers/docs/rate-limits#buckets)).

## Reference

```endpoints moderation

```

The [moderation tutorial](/developers/docs/tutorial-moderation) builds `/timeout` and `/purge`.
