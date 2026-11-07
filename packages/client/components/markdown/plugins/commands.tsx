import { createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { Handler } from "mdast-util-to-hast";
import { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { RE_COMMAND_MENTION } from "./commandMention";
import { mention } from "./mentions";

export { RE_COMMAND_MENTION };

/**
 * Command a mention asked the composer to open: the command picker
 * of the channel being viewed picks it up
 */
const [requestedCommand, setRequestedCommand] = createSignal<{
  id: string;
  path: string[];
}>();
export { requestedCommand, setRequestedCommand };

export function RenderCommandMention(props: {
  name: string;
  command: string;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  const words = () => props.name.split(" ");

  return (
    <button
      type="button"
      class={mention({ isLink: !props.disabled })}
      style={{ "padding-inline-start": "6px", border: "none", font: "inherit" }}
      disabled={props.disabled}
      title={t`Use this command`}
      onClick={() =>
        setRequestedCommand({ id: props.command, path: words().slice(1) })
      }
    >
      <bdi>/{props.name}</bdi>
    </button>
  );
}

export const remarkCommandMentions: Plugin = () => (tree) => {
  visit(
    tree,
    "text",
    (
      node: { type: "text"; value: string },
      idx,
      parent: { children: unknown[] },
    ) => {
      const elements = node.value.split(RE_COMMAND_MENTION);
      if (elements.length === 1) return; // no matches

      const newNodes: unknown[] = [{ type: "text", value: elements.shift()! }];
      for (let i = 0; i < elements.length / 3; i++) {
        newNodes.push({
          type: "commandMention",
          name: elements[i * 3],
          command: elements[i * 3 + 1],
        });
        newNodes.push({ type: "text", value: elements[i * 3 + 2] });
      }

      parent.children.splice(idx, 1, ...newNodes);
      return idx + newNodes.length;
    },
  );
};

export const commandMentionHandler: Handler = (h, node) => {
  return {
    type: "element" as const,
    tagName: "commandMention",
    children: [],
    properties: {
      name: node.name,
      command: node.command,
    },
  };
};
