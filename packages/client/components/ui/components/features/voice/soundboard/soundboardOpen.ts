import { createRoot, createSignal } from "solid-js";

/**
 * Whether the soundboard picker of the call is open. Shared by the call's
 * button and the panel it opens; closes when the call ends.
 */
export const [soundboardOpen, setSoundboardOpen] = createRoot(() =>
  createSignal(false),
);
