/**
 * Addresses that open a dialog over the page the person is on:
 * `/settings`, `/invite/{code}`, `/bot/{id}` (and its short form `/b/{id}`).
 * A bot link with `?start` (`/b/{id}?start=ref`) opens the conversation with
 * the bot instead, where Start sends the bot `ref`.
 *
 * Inside the running app a link to one of them never leaves the page: the
 * app's layout (Interface.tsx) stops the move and calls `openDialogAt`. The
 * routes below are for a page that is loaded at such an address; they open the
 * same dialog and then show the last page the person was on.
 *
 * The dialog is opened while the route is set up, not in `onMount`: when the
 * router is already switching pages it moves on to the page behind the dialog
 * before this route is ever mounted, so `onMount` only ran on a full page load
 * and a clicked link did nothing.
 */
import { Navigate, useNavigate, useParams } from "@solidjs/router";
import { PublicChannelInvite } from "@zrzur/sdk/solid";

import {
  botDmsOn,
  startOf,
  waitForStart,
} from "@revolt/app/interface/channels/text/interactions/botLinks";
import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import { useState } from "@revolt/state";

type Client = ReturnType<typeof useClient>;
type Modals = Pick<ReturnType<typeof useModals>, "openModal" | "showError">;
/** Move to a page of the app (the router's navigate) */
type Go = (path: string) => void;

/** A dialog an address stands for */
export type DialogAddress =
  | { kind: "settings" }
  | { kind: "invite"; code: string }
  | { kind: "bot"; code: string; search: string }
  | { kind: "bot-start"; code: string; payload?: string };

/**
 * Read the dialog out of an in-app address (`/invite/Dm8w7T5p`,
 * `/bot/{id}?permissions=8`); undefined for every other page, and for a code
 * that could change the request path.
 */
export function dialogAddress(to: string): DialogAddress | undefined {
  const [path, search = ""] = to.split("#")[0].split("?");
  if (path === "/settings") return { kind: "settings" };
  const found = /^\/(invite|bot|b)\/([^/]+)\/?$/.exec(path);
  if (!found) return undefined;
  let code: string;
  try {
    code = decodeURIComponent(found[2]);
  } catch {
    return undefined;
  }
  if (!isInviteCode(code)) return undefined;
  if (found[1] === "invite") return { kind: "invite", code };
  const start = startOf(search);
  return start
    ? { kind: "bot-start", code, payload: start.payload }
    : { kind: "bot", code, search };
}

/**
 * What a bot link with ?start stands for here: with bots in DMs off on this
 * server, the Add bot dialog, as before
 */
export function effectiveAddress(
  address: DialogAddress,
  client: ReturnType<Client>,
): DialogAddress {
  return address.kind === "bot-start" && !botDmsOn(client)
    ? { kind: "bot", code: address.code, search: "" }
    : address;
}

/** Open the dialog of an address; a failed request is shown as an error */
export function openDialogAt(
  given: DialogAddress,
  client: Client,
  { openModal, showError }: Modals,
  go?: Go,
) {
  // after this pass: a change made while the router is switching pages
  // belongs to that switch and is dropped with it
  queueMicrotask(() => {
    const address = effectiveAddress(given, client());
    // a page loaded at the link has nothing behind it: go home
    const leaveLink = () => {
      if (/^\/(b|bot)\//.test(window.location.pathname)) go?.("/");
    };
    if (address.kind === "settings") {
      openModal({ type: "settings", config: "user" });
    } else if (address.kind === "bot-start") {
      // the conversation with the bot, Start waiting with the link's payload
      client()
        .users.fetch(address.code)
        .then((user) => {
          // the id of a person: their profile, never a conversation
          if (!user.bot) {
            openModal({ type: "user_profile", user });
            leaveLink();
            return;
          }
          return user.openDM().then((channel) => {
            waitForStart(channel.id, address.payload);
            go?.(channel.path);
          });
        })
        .catch((error) => {
          showError(error);
          leaveLink();
        });
    } else if (address.kind === "invite") {
      client()
        // TODO: add a helper to stoat.js for this
        .api.get(`/invites/${address.code as ""}`)
        .then((invite) => PublicChannelInvite.from(client(), invite))
        .then((invite) => openModal({ type: "invite", invite }))
        .catch(showError);
    } else {
      client()
        // kept by the SDK: the bot's card and this dialog share one request
        .bots.fetchPublic(address.code)
        .then((invite) => {
          // invite links from the Developer Portal carry the permissions
          const asked = Number(
            new URLSearchParams(address.search).get("permissions"),
          );
          openModal({
            type: "add_bot",
            invite,
            permissions:
              Number.isSafeInteger(asked) && asked > 0 ? asked : undefined,
          });
        })
        .catch(showError);
    }
  });
}

/**
 * Redirect PWA start to the last active path
 */
export function PWARedirect() {
  const state = useState();
  return <Navigate href={state.layout.getLastActivePath()} />;
}

/**
 * Open settings and redirect to last active path
 */
export function SettingsRedirect() {
  openDialogAt({ kind: "settings" }, useClient(), useModals());
  return <PWARedirect />;
}

/**
 * Open invite and redirect to last active path
 */
export function InviteRedirect() {
  const params = useParams();
  const address = dialogAddress(`/invite/${params.code ?? ""}`);
  if (address) openDialogAt(address, useClient(), useModals());
  return <PWARedirect />;
}

/**
 * Open bot invite and redirect to last active path
 */
export function BotRedirect() {
  const params = useParams();
  const navigate = useNavigate();
  const address = dialogAddress(
    `/bot/${params.code ?? ""}${window.location.search}`,
  );
  const client = useClient();
  if (address) openDialogAt(address, client, useModals(), navigate);
  // a bot link with ?start goes straight to the conversation, in one move:
  // passing the last page first left that page half set up when it was the
  // same conversation, and the bot's answer did not show until a reload
  if (address && effectiveAddress(address, client()).kind === "bot-start")
    return null;
  return <PWARedirect />;
}
