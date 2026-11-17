import { lazyRetry } from "@revolt/ui/components/utils/lazyRetry";

export { CategoryContextMenu } from "./CategoryContextMenu";
export { ChannelContextMenu } from "./ChannelContextMenu";
export { ServerContextMenu } from "./ServerContextMenu";
export { ServerFolderContextMenu } from "./ServerFolderContextMenu";
export { ServerSidebarContextMenu } from "./ServerSidebarContextMenu";
export { UserContextMenu } from "./UserContextMenu";

/**
 * The message menu, loaded when a menu first opens: nobody needs it for the
 * first paint, and it is not part of the installed shell
 */
export const MessageContextMenu = lazyRetry(
  () =>
    import("./MessageContextMenu").then((m) => ({
      default: m.MessageContextMenu,
    })),
  () => null,
);
