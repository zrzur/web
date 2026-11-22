// Rich presence from a game: tell the Zrzur desktop app what the player is
// doing, so their friends see "Playing <your game>" with the details.
// Node 22.3 or newer, `npm install @zrzur/sdk`. The Zrzur desktop app must
// be running on the same computer, with "Share what you are doing" on.
import { ZrzurRpc } from "@zrzur/sdk/rpc";

const rpc = new ZrzurRpc({
  clientId: process.env.ZRZUR_RPC_CLIENT_ID ?? "my-game",
});
await rpc.connect();
console.log("Connected to the Zrzur desktop app");

const startedAt = Date.now();
let round = 1;

async function show() {
  await rpc.setActivity({
    name: "My Game",
    details: "Ranked match",
    state: `Round ${round} of 12`,
    timestamps: { start: startedAt },
    buttons: [{ label: "Get the game", url: "https://example.com/my-game" }],
  });
  console.log(`Showing round ${round}`);
}

await show();

// change it when something happens in the game, not on a timer: Zrzur
// takes 5 changes in 20 seconds
const timer = setInterval(async () => {
  round += 1;
  await show();
  if (round === 3) {
    clearInterval(timer);
    await rpc.setActivity(null);
    console.log("Cleared");
    rpc.close();
  }
}, 10_000);
