# Running in production

Keep a bot running for months: where to host it, how it recovers, what to log.

## You will need {#you-will-need}

A machine that stays on, with Node 22 or newer. A small virtual server is enough for most bots. Your own laptop is fine for testing only: the bot stops when it sleeps.

A bot makes outgoing connections only. It needs no open port, unless you use [HTTP interactions](/developers/docs/http-interactions) or a health check from outside.

## Run it as a service {#service}

Something must start the bot at boot and again after a crash. With systemd:

```ini
# /etc/systemd/system/zrzur-bot.service
[Unit]
Description=Zrzur bot
After=network-online.target

[Service]
WorkingDirectory=/srv/bot
ExecStart=/usr/bin/node full-bot.mjs
EnvironmentFile=/srv/bot/.env
Restart=always
RestartSec=5
User=bot

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now zrzur-bot
journalctl -u zrzur-bot -f
```

Docker works the same way: `docker run --restart=always --env-file .env`.

## Stop cleanly {#shutdown}

On `SIGTERM`, close the gateway and let running work finish. Save your data with a write to a second file, then a rename, so that a crash in the middle never leaves half a file.

## Reconnect {#reconnect}

Reconnecting is your bot's job. Follow [Gateway: Reconnect](/developers/docs/gateway#reconnect), and watch for silence, with a `Ping` every 20 seconds and a limit of 60 seconds without `Pong`.

Stop for good only on an `Error` event of type `InvalidSession` and on close code `4014`. Anything else is temporary. A bot that exits on those two needs a person, so make sure your process manager does not hammer the gateway: `RestartSec=5` waits between tries.

Ask for a resumable session, and after a drop send `Resume` first: a short drop then loses nothing (see [Resume after a drop](/developers/docs/gateway#resume)). After a new `Ready`, fetch what you cannot miss.

## Log what helps {#logging}

Write one line per event, as JSON, to standard output. Your service manager keeps it.

```json
{"time":"2026-11-06T07:02:51.576Z","level":"info","message":"ready","servers":1}
{"time":"2026-11-06T07:02:51.728Z","level":"info","message":"interaction","kind":"Command","name":"ping","ms":20}
```

Log the time, the interaction type, the command, how long it took, and the error `type`. Never log tokens or message text.

Alert on these:

- `ready` lines coming often: the connection is unstable.
- Interactions slower than 2 seconds: you are close to the limit of 3.
- `429` answers: you are sending too much.
- `InvalidSession`: the token changed.

## Do slow work outside the handler {#slow-work}

Answer `DeferredMessage`, put the work in a queue, and edit the answer when it is done. Do not block the gateway loop: a bot that stops reading its socket misses its own `Pong`.

## Check that it lives {#health}

A small HTTP address tells a monitor the bot is up. See the [Deployment tutorial](/developers/docs/tutorial-deploy).

## Growing {#growing}

- Past 100 servers you need verification. See [Server limit and verification](/developers/docs/applications#limits).
- Sharding does not exist. One process receives everything, so keep your handlers small.
- Cache what events tell you instead of fetching it. The `servers` bucket is small.

## Updates {#updates}

A restart costs a few seconds, and commands used in that time fail. Register commands on start only if they changed: `PUT` is safe, but it counts against a rate limit.

## Checklist {#checklist}

- The token is in a secret store, and not in Git.
- The bot restarts by itself after a crash and after a reboot.
- It reconnects with a growing wait.
- It stops on `InvalidSession` and `4014`.
- It logs as JSON, without secrets.
- Slow work is deferred.
- It obeys `429`, and a global `429` pauses everything.

## Next {#next}

- [Build a complete bot](/developers/docs/tutorial-full-bot)
- [Keeping tokens safe](/developers/docs/security)
