/**
 * Addresses that open a dialog over the page the person is on:
 * `/settings`, `/invite/{code}`, `/bot/{id}` (and its short form `/b/{id}`).
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
import { Navigate, useParams } from "@solidjs/router";
import { PublicChannelInvite } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { isInviteCode } from "@revolt/modal/modals/inviteLink";
import { useState } from "@revolt/state";

type Client = ReturnType<typeof useClient>;
type Modals = Pick<ReturnType<typeof useModals>, "openModal" | "showError">;

/** A dialog an address stands for */
export type DialogAddress =
  | { kind: "settings" }
  | { kind: "invite"; code: string }
  | { kind: "bot"; code: string; search: string };

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
  return found[1] === "invite"
    ? { kind: "invite", code }
    : { kind: "bot", code, search };
}

/** Open the dialog of an address; a failed request is shown as an error */
export function openDialogAt(
  address: DialogAddress,
  client: Client,
  { openModal, showError }: Modals,
) {
  // after this pass: a change made while the router is switching pages
  // belongs to that switch and is dropped with it
  queueMicrotask(() => {
    if (address.kind === "settings") {
      openModal({ type: "settings", config: "user" });
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
  const address = dialogAddress(
    `/bot/${params.code ?? ""}${window.location.search}`,
  );
  if (address) openDialogAt(address, useClient(), useModals());
  return <PWARedirect />;
}
