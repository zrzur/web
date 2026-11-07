// Games with buttons: `/coinflip` asks heads or tails; only the player can
// answer, and the message updates in place with the result.

import { Client } from "@zrzur/sdk/bot";

const bot = new Client({
  token: process.env.ZRZUR_BOT_TOKEN,
  apiUrl: process.env.ZRZUR_API_URL,
  wsUrl: process.env.ZRZUR_WS_URL,
});

bot.command("coinflip", (i) =>
  i.reply({
    content: "Heads or tails?",
    components: [
      // `restrict` makes the server refuse clicks from anyone else
      {
        type: "button",
        style: "primary",
        label: "Heads",
        customId: "flip:heads",
        restrict: { users: [i.user._id] },
      },
      {
        type: "button",
        style: "secondary",
        label: "Tails",
        customId: "flip:tails",
        restrict: { users: [i.user._id] },
      },
    ],
  }),
);

bot.component("flip:", (i) => {
  const guess = i.customId.split(":")[1];
  const result = Math.random() < 0.5 ? "heads" : "tails";
  // update the message the button is on and remove the buttons
  return i.update({
    content: `You said ${guess}, it was ${result}. ${guess === result ? "You win!" : "Try again."}`,
    components: [],
  });
});

await bot.login();
await bot.syncCommands([{ name: "coinflip", description: "Flip a coin" }]);
console.log("ready");
