import type { API } from "@zrzur/sdk/solid";

/**
 * What `GET /invites/{code}` answers for a server, with the fields a server
 * that has the short join path adds (older servers leave them out)
 */
export type ServerInviteInfo = Extract<API.InviteResponse, { type: "Server" }> & {
  server_description?: string;
  inside?: { name: string; voice?: boolean }[];
  invites_paused?: boolean;
  /** the server's own custom link: nobody in particular invited */
  custom_link?: boolean;
};

/** What `POST /auth/account/join` answers */
export type JoinByLinkResponse =
  | {
      result: "Entered";
      session: { _id: string; token: string; user_id: string };
      joined?:
        | { type: "Server"; server: { _id: string } }
        | { type: "JoinRequest" }
        | { type: "Group"; channel: { _id: string } };
      join_error?: string;
      confirm_by: string;
    }
  | { result: "CheckEmail" };

/** Why an invite link leads nowhere, as the page words it */
export type DeadReason = "ended" | "paused" | "offline";

/**
 * Read the failure of `GET /invites/{code}`. A link that is unknown, used up
 * or past its date all answer NotFound: "ended" covers the three. Anything
 * else (no connection, a server error) says nothing about the link.
 */
export function deadReason(error: unknown): DeadReason {
  const type =
    typeof error === "string" ? error : (error as { type?: string })?.type;
  if (type === "InvitesPaused") return "paused";
  if (type === "NotFound" || type === "InvalidOperation") return "ended";
  return "offline";
}

/**
 * Where a person lands after joining: the invite's own channel, so the
 * conversation is on screen with the message box
 */
export function arrivalPath(serverId: string, channelId: string) {
  return `/server/${serverId}/channel/${channelId}`;
}

/** A rounded member count for the page ("1,284") in the person's language */
export function memberCount(count: number, locale: string) {
  try {
    return new Intl.NumberFormat(locale).format(Math.max(0, count));
  } catch {
    return String(Math.max(0, count));
  }
}

const PENDING_KEY = "zrzur:pending-invite";
/** how long a pending invite is kept (24 hours) */
export const PENDING_MS = 24 * 60 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): Store | undefined {
  try {
    return window.localStorage;
  } catch {
    // storage switched off (private mode, an in-app browser): nothing is
    // remembered and the page still works
    return undefined;
  }
}

/**
 * Remember the invite a person was looking at before they went to log in,
 * so they come back to it afterwards. Only the code and a time are kept.
 */
export function rememberInvite(code: string, now = Date.now(), s = store()) {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) return;
  try {
    s?.setItem(PENDING_KEY, JSON.stringify({ code, at: now }));
  } catch {
    // storage full or refused
  }
}

/** The remembered invite, if it is under a day old; reading it forgets it */
export function takePendingInvite(now = Date.now(), s = store()) {
  try {
    const raw = s?.getItem(PENDING_KEY);
    s?.removeItem(PENDING_KEY);
    if (!raw) return undefined;
    const { code, at } = JSON.parse(raw) as { code?: unknown; at?: unknown };
    if (typeof code !== "string" || typeof at !== "number") return undefined;
    if (!/^[A-Za-z0-9-]{1,64}$/.test(code)) return undefined;
    if (now - at > PENDING_MS || at > now + 60_000) return undefined;
    return code;
  } catch {
    return undefined;
  }
}

/** Forget the remembered invite (the person joined, or the link is dead) */
export function forgetInvite(s = store()) {
  try {
    s?.removeItem(PENDING_KEY);
  } catch {
    // nothing to forget
  }
}

/** How long is left, in whole days or hours, never below one hour */
export function timeLeft(confirmBy: string, now = Date.now()) {
  const hours = Math.max(
    1,
    Math.ceil((new Date(confirmBy).getTime() - now) / 3_600_000),
  );
  return hours >= 24
    ? { unit: "days" as const, count: Math.ceil(hours / 24) }
    : { unit: "hours" as const, count: hours };
}
