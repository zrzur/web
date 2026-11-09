# Without a library

Everything a bot does is plain HTTPS and WebSocket. This page shows the calls, so you can write a bot in any language.

## You will need {#you-will-need}

An HTTP client and a WebSocket client. `curl` is enough for the first steps. `YOUR_BOT_TOKEN` stands for your token.

## Make a request {#request}

```bash
curl "https://api.zrzur.com/users/@me" -H "x-bot-token: YOUR_BOT_TOKEN"
```

`_id` in the answer is your bot's id, and also its application id.

Bodies are JSON, with `content-type: application/json`. Answers are JSON, or empty with `204`.

## Send a message {#send}

```bash
curl -X POST "https://api.zrzur.com/channels/CHANNEL_ID/messages" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -H "content-type: application/json" \
  -d '{ "content": "Hello!" }'
```

## Upload a file {#upload}

```bash
curl -X POST "https://cdn.zrzur.com/attachments" \
  -H "x-bot-token: YOUR_BOT_TOKEN" \
  -F "file=@report.csv;type=text/csv"
```

The answer is `{ "id": "FILE_ID" }`. Send it in `attachments` of a message.

## The whole loop {#loop}

1. `PUT /applications/{application_id}/commands` with your commands.
2. Open `wss://events.zrzur.com/?version=1&format=json`.
3. Send `{ "type": "Authenticate", "token": "YOUR_BOT_TOKEN", "intents": 33 }`.
4. Every 20 seconds send `{ "type": "Ping", "data": 1 }`.
5. For each packet: if `type` is `Bulk`, handle each item of `v`.
6. On `InteractionCreate`, within 3 seconds, `POST /interactions/{interaction_id}/{token}/callback`.
7. When the socket closes, wait and start again at step 2.

## Node {#node}

Node 22 has `fetch` and `WebSocket` built in. This is a complete bot in one file:

```example hello-raw.mjs

```

The [complete bot](/developers/docs/tutorial-full-bot) adds rate limits, retries, reconnects and saved data.

## Python {#python}

Python needs the `websockets` package (`pip install websockets`). The standard library is enough for HTTP.

```python
import asyncio, json, os, urllib.request
import websockets

TOKEN = os.environ["ZRZUR_BOT_TOKEN"]
API = "https://api.zrzur.com"

def rest(method, path, body=None):
    request = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"x-bot-token": TOKEN, "content-type": "application/json"},
    )
    with urllib.request.urlopen(request) as response:
        data = response.read()
        return json.loads(data) if data else None

async def main():
    me = rest("GET", "/users/@me")
    rest("PUT", f"/applications/{me['_id']}/commands",
         [{"name": "hello", "description": "Say hello"}])

    async with websockets.connect("wss://events.zrzur.com/?version=1&format=json") as socket:
        await socket.send(json.dumps({"type": "Authenticate", "token": TOKEN, "intents": 33}))

        async def ping():
            while True:
                await asyncio.sleep(20)
                await socket.send(json.dumps({"type": "Ping", "data": 1}))
        asyncio.create_task(ping())

        async for raw in socket:
            packet = json.loads(raw)
            for event in packet["v"] if packet["type"] == "Bulk" else [packet]:
                if event["type"] == "Ready":
                    print("ready")
                if event["type"] == "InteractionCreate":
                    i = event["interaction"]
                    rest("POST", f"/interactions/{i['_id']}/{i['token']}/callback",
                         {"type": "Message", "data": {"content": "Hello from Python!"}})

asyncio.run(main())
```

This short version does not reconnect. Add the loop from [Gateway](/developers/docs/gateway#reconnect).

## Machine-readable descriptions {#schemas}

| Address                 | What                                       |
| ----------------------- | ------------------------------------------ |
| `GET /openapi.json`     | Every REST route, as OpenAPI 3             |
| `GET /gateway/schema`   | Every gateway event, as JSON Schema        |
| `GET /`                 | Addresses and limits of this server        |

Generate a client from them in your own language.

## Next {#next}

- [Build a complete bot](/developers/docs/tutorial-full-bot)
- [Errors](/developers/docs/errors)
