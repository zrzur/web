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

## Reference

```endpoints moderation

```

The [moderation tutorial](/developers/docs/tutorial-moderation) builds `/timeout` and `/purge`.
