import {
  type JSXElement,
  Accessor,
  createContext,
  createEffect,
  lazy,
  onCleanup,
  Show,
  Suspense,
  untrack,
  useContext,
} from "solid-js";

import type { Client, User } from "@zrzur/sdk/solid";

import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { fetchLatestChangelog } from "@revolt/modal/modals/changelogFeed";
import { useState } from "@revolt/state";

import ClientController, { State } from "./Controller";
import {
  accountAge,
  refreshAccountAge,
  resetAccountAge,
  shouldAskForAge,
} from "./age";
import { consumeReturnedOrder, refreshBilling, resetBilling } from "./billing";

export type { default as ClientController } from "./Controller";

const AgePrompt = lazy(() =>
  import("./AgePrompt").then((m) => ({ default: m.AgePrompt })),
);

export { useNotifications } from "./NotificationsController";
export {
  type PlaybackResult,
  type SoundKey,
  SOUND_ASSETS,
  SoundContext,
  SoundController,
  useSound,
} from "./Sounds";

const clientContext = createContext(null! as ClientController);

/**
 * Mount the modal controller
 */
export function ClientContext(props: { children: JSXElement }) {
  const { openModal } = useModals();
  const state = useState();
  const instance = useInstance();

  const controller = new ClientController(state, instance);
  onCleanup(() => controller.dispose());

  let fetchedChangelog = false;
  createEffect(() => {
    if (!controller.isLoggedIn() || fetchedChangelog) return;
    fetchedChangelog = true;

    fetchLatestChangelog().then((changelog) => {
      if (!changelog) return;
      if (state["release-notes"].lastSeenId === changelog.id) return;

      state["release-notes"].markSeen(changelog.id, changelog.published_at);

      openModal({
        type: "changelog",
        changelog,
      });
    });
  });

  // Plus and supercharges: load once signed in, and again when your own
  // badges change (Plus started, ended or was gifted to you)
  createEffect(() => {
    if (!controller.isLoggedIn()) return resetBilling();
    // the user object arrives with the first Ready, once connected
    if (controller.lifecycle.state() !== State.Connected) return;
    const client = instance.client;
    if (!client.user) return;
    refreshBilling(client);

    // back from the payment page: show how the payment stands (asked from
    // the API, never taken from the address)
    const returned = consumeReturnedOrder();
    if (returned) {
      openModal({ type: "billing_checkout_status", orderId: returned });
    }

    const onUserUpdate = (user: User, previous: { badges?: number }) => {
      if (user.self && user.badges !== previous.badges) refreshBilling(client);
    };
    client.on("userUpdate", onUserUpdate);
    onCleanup(() => client.removeListener("userUpdate", onUserUpdate));
  });

  // Age: load once connected, and again when it changes on another device.
  // Accounts without one are never asked here; the age gate and Settings
  // open the prompt when needed (the month and year are asked at sign-up).
  createEffect(() => {
    if (!controller.isLoggedIn()) return resetAccountAge();
    if (controller.lifecycle.state() !== State.Connected) return;
    const client = instance.client;
    if (untrack(accountAge) === undefined) refreshAccountAge(client);

    const onAgeUpdate = () => {
      refreshAccountAge(client);
    };
    client.on("accountAgeUpdate", onAgeUpdate);
    onCleanup(() => client.removeListener("accountAgeUpdate", onAgeUpdate));
  });

  createEffect(() => {
    const policy = controller.lifecycle.policyAttentionRequired();
    if (policy) {
      const [changes, acknowledge] = policy;

      openModal({
        type: "policy_change",
        changes,
        acknowledge,
      });
    }
  });

  return (
    <clientContext.Provider value={controller}>
      {props.children}
      <Show when={controller.isLoggedIn() && shouldAskForAge()}>
        <Suspense>
          <AgePrompt
            client={instance.client}
            onRefused={() => controller.logout()}
          />
        </Suspense>
      </Show>
    </clientContext.Provider>
  );
}

/**
 * Get various lifecycle objects
 * @returns Lifecycle information
 */
export function useClientLifecycle() {
  return useContext(clientContext);
}

/**
 * Get the currently active client
 * @returns Client
 */
export function useClient(): Accessor<Client> {
  const instance = useInstance();
  return () => instance.client;
}

/**
 * Get the currently logged in user
 * @returns User
 */
export function useUser(): Accessor<User | undefined> {
  const instance = useInstance();
  return () => instance.client.user;
}

/**
 * Plain API client with no authentication
 * @returns API Client
 */
export function useApi() {
  return useContext(clientContext).api;
}

export const IS_DEV = import.meta.env.DEV;
