export { DraftMessages } from "./interface/channels/text/DraftMessages";
export { Message, useMessage } from "./interface/channels/text/Message";
export { Messages } from "./interface/channels/text/Messages";

// settings are imported from "@revolt/app/interface/settings" directly, so the
// settings window (loaded on first open) stays out of the start-up bundle
export * from "./menus";
