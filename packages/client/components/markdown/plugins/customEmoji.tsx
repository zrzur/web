import { Match, Switch, createSignal } from "solid-js";

import { Handler } from "mdast-util-to-hast";
import { RE_CUSTOM_EMOJI } from "@zrzur/sdk/solid";
import { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { useClient } from "@revolt/client";

import { CustomEmoji } from "../emoji";

/**
 * Render a custom emoji
 *
 * Fall back to text if the emoji does not exist; no hover tooltip.
 */
export function RenderCustomEmoji(props: { id: string }) {
  const [exists, setExists] = createSignal(true);

  const client = useClient();

  /**
   * Resolve emoji
   */
  const emoji = () => client()!.emojis.get(props.id);

  return (
    <Switch fallback={<span>{`:${emoji()?.name ?? props.id}:`}</span>}>
      <Match when={exists()}>
        <CustomEmoji id={props.id} onError={() => setExists(false)} />
      </Match>
    </Switch>
  );
}

export const remarkCustomEmoji: Plugin = () => (tree) => {
  visit(
    tree,
    "text",
    (
      node: { type: "text"; value: string },
      idx,
      parent: { children: unknown[] },
    ) => {
      const elements = node.value.split(RE_CUSTOM_EMOJI);
      if (elements.length === 1) return; // no matches

      // Generate initial node
      const newNodes: (
        | { type: "text"; value: string }
        | {
            type: "customEmoji";
            id: string;
          }
      )[] = [
        {
          type: "text",
          value: elements.shift()!,
        },
      ];

      // Process all timestamps
      for (let i = 0; i < elements.length / 2; i++) {
        // Insert components
        newNodes.push({
          type: "customEmoji",
          id: elements[i * 2],
        });

        newNodes.push({
          type: "text",
          value: elements[i * 2 + 1],
        });
      }

      parent.children.splice(idx, 1, ...newNodes);
      return idx + newNodes.length;
    },
  );
};

export const customEmojiHandler: Handler = (h, node) => {
  return {
    type: "element" as const,
    tagName: "customEmoji",
    children: [],
    properties: {
      id: node.id,
    },
  };
};
