import { ErrorBoundary, Show, Suspense, createMemo, lazy } from "solid-js";

import { useClient } from "@revolt/client";

import { pluginsEnabled } from "./enabled";

const PluginHostRoot = lazy(() => import("./PluginHostRoot"));

/**
 * Starts the plugin host only when the server says plugins are open. The
 * host's code isn't even loaded otherwise. The answer is known once the client
 * is ready, and it stays through reconnects so the host isn't restarted.
 */
export function PluginHostGate() {
  const client = useClient();
  const open = createMemo<boolean>(
    (opened) => opened || (client().ready() && pluginsEnabled(client())),
    false,
  );

  return (
    <Show when={open()}>
      {/* own boundaries: loading or breaking it never affects the chat */}
      <ErrorBoundary fallback={null}>
        <Suspense>
          <PluginHostRoot />
        </Suspense>
      </ErrorBoundary>
    </Show>
  );
}
