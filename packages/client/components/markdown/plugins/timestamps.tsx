import { type Dayjs } from "dayjs";
import type { Handler } from "mdast-util-to-hast";
import { Plugin } from "unified";
import { visit } from "unist-util-visit";

import { dayjs, timeLocale } from "@revolt/i18n/dayjs";

import { time as Time } from "../elements";

import {
  formatTimestamp,
  timestampFormat,
  timestampSeconds,
  timestampTitle,
  useRelativeClock,
} from "./timestampFormat";

export function RenderTimestamp(props: { format: string; date: Dayjs }) {
  const format = () => timestampFormat(props.format);

  // relative times follow one shared clock, only while they are on screen
  const tick = format() === "R" ? useRelativeClock() : () => 0;
  const value = () => {
    tick();
    return formatTimestamp(props.date, format());
  };

  return (
    <time
      class={Time()}
      dateTime={props.date.toISOString()}
      use:floating={{
        tooltip: {
          placement: "top",
          content: timestampTitle(props.date),
        },
      }}
    >
      {value()}
    </time>
  );
}

/**
 * Regex for matching timestamps
 */
export const RE_TIMESTAMP = /<t:([0-9]+)(?::(\w))?>/g;

export const remarkTimestamps: Plugin = () => (tree) => {
  visit(
    tree,
    "text",
    (
      node: { type: "text"; value: string },
      idx,
      parent: { children: unknown[] },
    ) => {
      const elements = node.value.split(RE_TIMESTAMP);
      if (elements.length === 1) return; // no matches

      // Generate initial node
      const newNodes: (
        | { type: "text"; value: string }
        | {
            type: "timestamp";
            format: string;
            date: Dayjs;
          }
      )[] = [
        {
          type: "text",
          value: elements.shift()!,
        },
      ];

      // Process all timestamps
      for (let i = 0; i < elements.length / 3; i++) {
        // a number that is no real moment stays as the text that was written
        const seconds = timestampSeconds(elements[i * 3]);
        if (seconds === undefined) {
          const letter = elements[i * 3 + 1];
          newNodes.push({
            type: "text",
            value: `<t:${elements[i * 3]}${letter ? `:${letter}` : ""}>`,
          });
        } else {
          newNodes.push({
            type: "timestamp",
            format: elements[i * 3 + 1],
            date: dayjs.unix(seconds).locale(timeLocale()[1]),
          });
        }

        newNodes.push({
          type: "text",
          value: elements[i * 3 + 2],
        });
      }

      parent.children.splice(idx, 1, ...newNodes);
      return idx + newNodes.length;
    },
  );
};

export const timestampHandler: Handler = (h, node) => {
  return {
    type: "element" as const,
    tagName: "timestamp",
    children: [],
    properties: {
      format: node.format,
      date: node.date,
    },
  };
};
