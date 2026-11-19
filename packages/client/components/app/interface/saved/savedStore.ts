/**
 * Calls for the private saved list and the reminders, and the little the
 * app remembers of them between screens: which messages are known to be
 * saved (so the menu can offer "Remove from saved") and the reminders that
 * came due while the app was open.
 *
 * The routes are not in the SDK's typed table yet, so they are called by
 * path; the answers put their messages and authors into the SDK's caches
 * like any other fetch.
 */
import { batch, createSignal } from "solid-js";

import type { API, Client, Message } from "@zrzur/sdk/solid";

export type SavedEntry = {
  message: string;
  channel: string;
  saved_at: number;
  available: boolean;
};

export type Reminder = {
  _id: string;
  message: string;
  channel: string;
  due_at: number;
  created_at: number;
  delivered_at?: number | null;
  available: boolean;
};

type Carried = { messages: API.Message[]; users: API.User[] };

export type SavedPage = Carried & {
  entries: SavedEntry[];
  total: number;
  max: number;
};

export type RemindersAnswer = Carried & {
  reminders: Reminder[];
  max_active: number;
  max_active_plus: number;
};

export type ReminderDueEvent = {
  type: "MessageReminderDue";
  reminder: Reminder;
  message?: API.Message;
  user?: API.User;
};

type RawApi = {
  get(path: string, params?: object): Promise<unknown>;
  put(path: string, body?: object): Promise<unknown>;
  post(path: string, body?: object): Promise<unknown>;
  patch(path: string, body?: object): Promise<unknown>;
  delete(path: string): Promise<unknown>;
};

const raw = (client: Client) => client.api as unknown as RawApi;

/** Put the messages and authors an answer carries into the caches */
function keep(client: Client, data: Partial<Carried>) {
  batch(() => {
    for (const user of data.users ?? [])
      client.users.getOrCreate(user._id, user);
    for (const message of data.messages ?? [])
      client.messages.getOrCreate(message._id, message);
  });
}

/** The cached message of an entry or reminder, when it is available */
export function messageOf(
  client: Client,
  item: { message: string; available: boolean },
): Message | undefined {
  return item.available ? client.messages.get(item.message) : undefined;
}

const [savedIds, setSavedIds] = createSignal<ReadonlySet<string>>(new Set());

/** Whether this message is known to be in the saved list */
export const isKnownSaved = (id: string) => savedIds().has(id);

function mark(ids: string[], saved: boolean) {
  const next = new Set(savedIds());
  for (const id of ids) {
    if (saved) next.add(id);
    else next.delete(id);
  }
  setSavedIds(next);
}

export async function fetchSaved(
  client: Client,
  options: { before?: number; query?: string; limit?: number } = {},
): Promise<SavedPage> {
  const params: Record<string, string | number> = {
    limit: options.limit ?? 30,
  };
  if (options.before !== undefined) params.before = options.before;
  if (options.query) params.query = options.query;
  const page = (await raw(client).get("/users/@me/saved", params)) as SavedPage;
  keep(client, page);
  mark(
    page.entries.map((entry) => entry.message),
    true,
  );
  return page;
}

export async function saveMessage(client: Client, id: string) {
  await raw(client).put(`/users/@me/saved/${id}`);
  mark([id], true);
}

export async function unsaveMessage(client: Client, id: string) {
  await raw(client).delete(`/users/@me/saved/${id}`);
  mark([id], false);
}

export async function fetchReminders(client: Client): Promise<RemindersAnswer> {
  const answer = (await raw(client).get(
    "/users/@me/reminders",
  )) as RemindersAnswer;
  keep(client, answer);
  // what the list holds replaces what arrived live
  setArrived([]);
  return answer;
}

export function createReminder(client: Client, message: string, at: Date) {
  return raw(client).post("/users/@me/reminders", {
    message,
    due_at: at.getTime(),
  }) as Promise<Reminder>;
}

export function moveReminder(client: Client, id: string, at: Date) {
  return raw(client).patch(`/users/@me/reminders/${id}`, {
    due_at: at.getTime(),
  }) as Promise<Reminder>;
}

export async function removeReminder(client: Client, id: string) {
  await raw(client).delete(`/users/@me/reminders/${id}`);
  setArrived(arrived().filter((reminder) => reminder._id !== id));
}

const [arrived, setArrived] = createSignal<Reminder[]>([]);

/** Reminders that came due while the app was open and were not looked at */
export const arrivedReminders = arrived;

/** Bumped when a reminder is set, moved or removed: open lists read again */
const [changes, setChanges] = createSignal(0);
export const reminderChanges = changes;
export const remindersChanged = () => setChanges(changes() + 1);

const attached = new WeakSet<Client>();

/**
 * Listen for reminders coming due, once per client. `onDue` runs for each
 * one (the place that shows the notice).
 */
export function attachReminders(
  client: Client,
  onDue: (reminder: Reminder, message: Message | undefined) => void,
) {
  if (attached.has(client)) return;
  attached.add(client);
  client.events.on("event", (event) => {
    const due = event as unknown as ReminderDueEvent;
    if (due.type !== "MessageReminderDue" || !due.reminder) return;
    keep(client, {
      users: due.user ? [due.user] : [],
      messages: due.message ? [due.message] : [],
    });
    setArrived([
      due.reminder,
      ...arrived().filter((reminder) => reminder._id !== due.reminder._id),
    ]);
    remindersChanged();
    onDue(due.reminder, messageOf(client, due.reminder));
  });
}
