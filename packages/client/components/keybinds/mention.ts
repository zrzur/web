/**
 * Shift+click on a person, a role or a channel writes a mention of it into
 * the message box, at the cursor, with a space after it. The open message
 * box registers where the text goes; with none open, the click does what
 * it always did.
 *
 * Phones keep their long press: a tap never carries Shift.
 */

export type MentionKind = "user" | "role" | "channel";

/** Server ids are ULIDs: 26 characters of Crockford base 32 */
const ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** The text of a mention, as messages write it */
export function mentionText(kind: MentionKind, id: string): string | undefined {
  if (!ID.test(id)) return;
  const sigil = kind === "user" ? "@" : kind === "role" ? "%" : "#";
  return `<${sigil}${id}> `;
}

/** A mention token on its own, as `mentionText` writes it */
export const MENTION_TOKEN = /^<[@%#][0-9A-HJKMNP-TV-Z]{26}> $/;

/**
 * Whether the text that goes in front of a mention needs a space first,
 * so "hi" and the mention don't run together
 * @param before The character just before the cursor ("" at the start)
 */
export function needsLeadingSpace(before: string): boolean {
  return before !== "" && !/\s/.test(before);
}

/** Takes the text; false when it can't (no right to write here) */
type Target = (text: string) => boolean;
const targets: Target[] = [];

/**
 * Where mentions go (the message box calls this when it opens). The last
 * one registered wins; returns the function that removes it.
 */
export function setMentionTarget(target: Target): () => void {
  targets.push(target);
  return () => {
    const at = targets.lastIndexOf(target);
    if (at >= 0) targets.splice(at, 1);
  };
}

/** Whether a message box is open to take a mention */
export function canInsertMention() {
  return targets.length > 0;
}

/**
 * Write a mention into the open message box
 * @returns Whether it went in
 */
export function insertMention(kind: MentionKind, id: string): boolean {
  const text = mentionText(kind, id);
  const target = targets.at(-1);
  if (!text || !target) return false;
  return target(text);
}

type ClickLike = Pick<
  MouseEvent,
  "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "button"
>;

/** Whether a click is the "mention this" click: Shift and the main button only */
export function isMentionClick(event: ClickLike): boolean {
  return (
    event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    event.button === 0
  );
}

/** A channel's id from a link to it (`…/channel/<id>`, no message part) */
export function channelFromHref(href: string | null | undefined) {
  const match = /\/channel\/([0-9A-HJKMNP-TV-Z]{26})\/?(?:[?#].*)?$/.exec(
    href ?? "",
  );
  return match?.[1];
}

/**
 * What a Shift+click on this element mentions: a role or channel marked
 * with `data-mention-role` / `data-mention-channel`, or a link to a channel
 */
export function mentionAt(
  target: Element | null,
): { kind: MentionKind; id: string } | undefined {
  const marked = target?.closest<HTMLElement>(
    "[data-mention-role],[data-mention-channel],[data-mention-user]",
  );
  if (marked) {
    const { mentionRole, mentionChannel, mentionUser } = marked.dataset;
    if (mentionUser) return { kind: "user", id: mentionUser };
    if (mentionRole) return { kind: "role", id: mentionRole };
    if (mentionChannel) return { kind: "channel", id: mentionChannel };
  }
  const link = target?.closest<HTMLAnchorElement>("a[href]");
  const channel = channelFromHref(link?.getAttribute("href"));
  if (channel) return { kind: "channel", id: channel };
}

let listening = false;

/**
 * Listen for Shift+clicks on roles, channels and marked people everywhere
 * (once; people with a profile card are handled by `use:floating`). Runs
 * before the element's own click, so a channel link doesn't open (or open
 * a new window, which is what Shift+click on a link does in a browser).
 */
export function listenForMentionClicks() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener(
    "click",
    (event) => {
      if (!isMentionClick(event) || !canInsertMention()) return;
      const found = mentionAt(event.target as Element | null);
      if (!found) return;
      if (!insertMention(found.kind, found.id)) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
