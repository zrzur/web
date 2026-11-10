/**
 * Polls: the rules the server applies to a new poll, and the arithmetic of
 * the results. Kept apart from the components so they can be tested alone.
 */
import type { API } from "@zrzur/sdk/solid";

/** Hours a poll may stay open: 1 h, 4 h, 8 h, 24 h, 3 days, 1 week, 2 weeks */
export const POLL_DURATIONS = [1, 4, 8, 24, 72, 168, 336] as const;
export type PollDuration = (typeof POLL_DURATIONS)[number];
/** Longest question, in characters */
export const QUESTION_MAX = 300;
/** Longest answer, in characters */
export const ANSWER_MAX = 55;
/** Fewest answers */
export const ANSWERS_MIN = 2;
/** Most answers */
export const ANSWERS_MAX = 10;

/** One answer row while the poll is written; `key` keeps the row stable */
export type DraftAnswer = { key: string; text: string; emoji?: string };

/** The parts of a poll the results read */
type Counted = { answers: { id: number; text: string; count?: number }[] };

const length = (text: string) => [...text].length;

/**
 * What still stops the poll from being sent, if anything
 * @returns "question" (empty or too long), "answers" (fewer than two or more
 *   than ten filled in) or "answer" (one is too long)
 */
export function draftProblem(
  question: string,
  answers: DraftAnswer[],
): "question" | "answers" | "answer" | undefined {
  if (!question.trim() || length(question) > QUESTION_MAX) return "question";
  const filled = answers.filter((answer) => answer.text.trim());
  if (filled.length < ANSWERS_MIN || filled.length > ANSWERS_MAX)
    return "answers";
  if (filled.some((answer) => length(answer.text) > ANSWER_MAX))
    return "answer";
  return undefined;
}

/**
 * The poll as the server takes it: text trimmed, empty rows left out
 */
export function toDataPoll(
  question: string,
  answers: DraftAnswer[],
  duration: number,
  multiple: boolean,
): API.DataPoll {
  return {
    question: question.trim(),
    answers: answers
      .filter((answer) => answer.text.trim())
      .map((answer) =>
        answer.emoji
          ? { text: answer.text.trim(), emoji: answer.emoji }
          : { text: answer.text.trim() },
      ),
    duration,
    allow_multiselect: multiple,
  };
}

/**
 * The list with one item moved; a move off either end changes nothing
 */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Every vote of every answer */
export function pollTotal(poll: Counted): number {
  return poll.answers.reduce((sum, answer) => sum + (answer.count ?? 0), 0);
}

/**
 * Whole percentages per answer that add up to 100 (largest remainder), so
 * three equal answers read 33, 33 and 34 rather than 33 three times
 */
export function pollPercents(poll: Counted): number[] {
  const total = pollTotal(poll);
  if (!total) return poll.answers.map(() => 0);
  const exact = poll.answers.map(
    (answer) => ((answer.count ?? 0) * 100) / total,
  );
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - floors[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index]++;
    left--;
  }
  return floors;
}

/** Pressing an answer chooses it, or takes it back if it is yours */
export function voteAction(
  poll: { me?: number[] | null },
  answer: number,
): "vote" | "unvote" {
  return poll.me?.includes(answer) ? "unvote" : "vote";
}

/** The author ends their own open poll; Manage Messages ends anyone's */
export function canEndPoll(who: {
  author: boolean;
  manage: boolean;
  closed: boolean;
}): boolean {
  return !who.closed && (who.author || who.manage);
}

/** The part of the client this reads: the server's root config */
type ConfiguredClient =
  | { configuration?: { features?: { polls?: boolean } } | undefined }
  | null
  | undefined;

/**
 * Are polls on for this server (`features.polls_enabled`)? Only a clear yes
 * counts: unknown or missing means off.
 */
export function pollsEnabled(client: ConfiguredClient): boolean {
  return client?.configuration?.features?.polls === true;
}
