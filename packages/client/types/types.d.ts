import type { SolidOptions } from "solid-dnd-directive";
import { Setter } from "solid-js";

import type { Placement } from "@floating-ui/dom";
import type { Channel, Client, ServerMember, ServerRole, User } from "@zrzur/sdk/solid";

declare global {
  interface Window {
    __TAURI__: object;
  }
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      dndzone: SolidOptions & {
        transformDraggedElement?: () => (element?: HTMLElement) => void;
        useCursorForDetection?: boolean | (() => boolean);
        dropAnimationDisabled?: boolean | (() => boolean);
      };

      scrollable:
        | true
        | {
            /**
             * Colour customisation
             */
            palette?: "default" | "settings";

            /**
             * Scroll direction
             */
            direction?: "x" | "y";

            /**
             * Offset to apply to top of scroll container
             */
            offsetTop?: number;

            /**
             * Whether to only show scrollbar on hover
             */
            showOnHover?: boolean;

            /**
             * Pass-through class names
             */
            class?: string;
          };
      invisibleScrollable:
        | true
        | {
            /**
             * Scroll direction
             */
            direction?: "x" | "y";

            /**
             * Pass-through class names
             */
            class?: string;
          };
      floating: {
        tooltip?: {
          /**
           * Where the tooltip should be placed
           */
          placement: Placement;

          /**
           * A press on a touch screen opens it too, for tooltips that are
           * the only way to read something; the next press closes it
           */
          press?: boolean;
        } & (
          | {
              /**
               * Tooltip content
               */
              content: Component;

              /**
               * Aria label fallback
               */
              aria: string;
            }
          | {
              /**
               * Tooltip content
               */
              content: string | undefined;

              /**
               * Content is used as aria fallback
               */
              aria?: undefined;
            }
        );
        userCard?: {
          /**
           * User to display
           */
          user: User;

          /**
           * Member to display
           */
          member?: ServerMember;

          /**
           * Bot to display
           */
          bot?: { owner?: string };
        };
        contextMenu?: Component;
        contextMenuHandler?: "click" | "contextmenu";
        /**
         * Anchor the context menu to the element (dropdown) instead of the cursor
         */
        contextMenuPlacement?: "bottom-start" | "bottom" | "bottom-end";
        autoComplete?: {
          state: Accessor<AutoCompleteState>;
          selection: Accessor<number>;
          setSelection: Setter<number>;
          select: (index: number) => void;
        };
      };
      autoComplete:
        | true
        | {
            client?: Client;
            onKeyDown?: (
              event: KeyboardEvent & { currentTarget: HTMLTextAreaElement },
            ) => void;
            searchSpace?: {
              users?: User[];
              members?: ServerMember[];
              channels?: Channel[];
              roles?: ServerRole[];
            };
          };
    }
  }
}

declare const __ZRZUR_BUILD__:
  | {
      version: string;
      commit: string;
      tag: string;
      repo: string;
      sourceUrl: string;
    }
  | undefined;
