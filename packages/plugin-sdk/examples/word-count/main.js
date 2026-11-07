// Word Count — a worker plugin. It runs in Zrzur's sandbox: no network,
// no page, no storage of its own. It only sees a message when you choose
// "Count words" on it.

let counted = 0;

zrzur.messageActions.register("count", (message) => {
  const words = message.content.trim().split(/\s+/).filter(Boolean).length;
  counted++;
  zrzur.notifications.show(
    zrzur.locale.startsWith("ar")
      ? `عدد الكلمات: ${words}`
      : `${words} ${words === 1 ? "word" : "words"}`,
  );
});

zrzur.commands.register("stats", () =>
  zrzur.ui.showPanel({
    title: zrzur.locale.startsWith("ar") ? "عدّاد الكلمات" : "Word Count",
    blocks: [
      {
        type: "text",
        text: zrzur.locale.startsWith("ar")
          ? `عددت كلمات ${counted} رسالة في هذه الجلسة.`
          : `Counted ${counted} message(s) this session.`,
      },
      { type: "button", label: zrzur.locale.startsWith("ar") ? "تصفير" : "Reset", handler: "reset" },
    ],
  }),
);

zrzur.ui.onButton("reset", () => {
  counted = 0;
});
