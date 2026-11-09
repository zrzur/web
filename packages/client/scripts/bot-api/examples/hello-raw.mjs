// Hello World without any library: Node 22+, fetch and WebSocket only.
//
//   ZRZUR_BOT_TOKEN=YOUR_BOT_TOKEN node hello-raw.mjs

const token = process.env.ZRZUR_BOT_TOKEN;
const api = process.env.ZRZUR_API_URL ?? "https://api.zrzur.com";
const ws = process.env.ZRZUR_WS_URL ?? "wss://events.zrzur.com";

if (!token) {
  console.error("Set ZRZUR_BOT_TOKEN first.");
  process.exit(2);
}

/** An interaction's token is in its path: it must never reach a log */
const masked = (path) =>
  path.replace(/(\/interactions\/[^/]+\/)[^/]+/, "$1***");

async function rest(method, path, body) {
  const response = await fetch(api + path, {
    method,
    headers: {
      "x-bot-token": token,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(
      `${method} ${masked(path)}: ${response.status} ${await response.text()}`,
    );
  return response.status === 204 ? null : response.json();
}

// 1. Who am I? A bot's application id is its user id.
const me = await rest("GET", "/users/@me");

// 2. Register the global /hello command (PUT replaces the whole list).
await rest("PUT", `/applications/${me._id}/commands`, [
  { name: "hello", description: "Say hello" },
]);

// 3. Connect to the gateway and answer interactions.
const socket = new WebSocket(`${ws}/?version=1&format=json`);
// intents 33 = SERVERS (1) + INTERACTIONS (32): commands, nothing else
socket.addEventListener("open", () =>
  socket.send(JSON.stringify({ type: "Authenticate", token, intents: 33 })),
);

async function handle(event) {
  if (event.type === "Ready") console.log(`ready as ${me.username}`);
  if (
    event.type === "InteractionCreate" &&
    event.interaction.command?.name === "hello"
  ) {
    const { _id, token: interactionToken } = event.interaction;
    // answer within 3 seconds
    await rest("POST", `/interactions/${_id}/${interactionToken}/callback`, {
      type: "Message",
      data: { content: "Hello from Zrzur!" },
    });
  }
}

socket.addEventListener("message", ({ data }) => {
  const event = JSON.parse(data);
  // several events can arrive together in one Bulk packet
  for (const item of event.type === "Bulk" ? event.v : [event])
    handle(item).catch(console.error);
});

// keep the connection alive
setInterval(
  () => socket.send(JSON.stringify({ type: "Ping", data: Date.now() })),
  20_000,
);
