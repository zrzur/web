import type { Channel } from "@zrzur/sdk/solid";

/** One line of a saved conversation */
export function transcriptLine(
  at: Date,
  author: string,
  content: string,
  attachments: number,
): string {
  const time = at.toISOString().replace("T", " ").slice(0, 16);
  const files = attachments ? ` [${attachments} file(s)]` : "";
  return `[${time}] ${author}: ${content.replace(/\r?\n/g, "\n    ")}${files}`;
}

/**
 * The messages of a ticket as plain text, oldest first (at most 1000). The
 * reader's own client fetches them, so it holds only what they may read.
 */
export async function ticketTranscript(channel: Channel): Promise<string> {
  const lines: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < 10; page++) {
    const messages = await channel.fetchMessages({ limit: 100, before });
    for (const message of messages) {
      lines.push(
        transcriptLine(
          message.createdAt,
          message.author?.displayName ??
            message.username ??
            message.authorId ??
            "?",
          // the server's first words are a system message: its text
          // is not in `content`
          message.content ||
            (message.systemMessage as { content?: string } | undefined)
              ?.content ||
            "",
          message.attachments?.length ?? 0,
        ),
      );
    }
    if (messages.length < 100) break;
    before = messages[messages.length - 1].id;
  }
  const ticket = channel.ticket;
  const head = [
    `${channel.name}${ticket?.kind ? ` (${ticket.kind})` : ""}`,
    channel.description ?? "",
    "",
  ].filter((line, index) => line || index === 2);
  return [...head, ...lines.reverse()].join("\n") + "\n";
}

/** Hand the text to the browser as a file to save */
export function saveText(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
