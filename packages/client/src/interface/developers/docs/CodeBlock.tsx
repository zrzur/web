import { For, JSX, Show, createMemo, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Element, ElementContent, Root } from "hast";
import { common, createLowlight } from "lowlight";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

const lowlight = createLowlight(common);
const ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  js: "javascript",
  mjs: "javascript",
  ts: "typescript",
  http: "http",
};

/**
 * Token classes get our own prefix: the global hljs-* colours are not in a
 * cascade layer, so they would always beat the theme colours below.
 */
const tokenClass = (className: unknown) =>
  Array.isArray(className)
    ? className.map((name) => String(name).replace(/^hljs-/, "tok-")).join(" ")
    : undefined;

/** hast from lowlight → Solid nodes (no innerHTML) */
function renderHast(nodes: ElementContent[]): JSX.Element {
  return (
    <For each={nodes}>
      {(node) => {
        if (node.type === "text") return node.value;
        if (node.type !== "element") return null;
        const element = node as Element;
        const className = element.properties?.className;
        return (
          <span class={tokenClass(className)}>
            {renderHast(element.children)}
          </span>
        );
      }}
    </For>
  );
}

/**
 * Code with syntax highlighting and a copy button. Always left-to-right,
 * also in Arabic.
 */
export function CodeBlock(props: {
  code: string;
  language?: string;
  title?: string;
}) {
  const { t } = useLingui();
  const [copied, setCopied] = createSignal(false);

  const highlighted = createMemo(() => {
    const language = ALIASES[props.language ?? ""] ?? props.language;
    try {
      if (language && lowlight.registered(language)) {
        return (lowlight.highlight(language, props.code) as Root)
          .children as ElementContent[];
      }
    } catch {
      // fall through to plain text
    }
    return null;
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Figure dir="ltr">
      <Bar>
        <span>{props.title ?? props.language ?? ""}</span>
        <CopyButton
          type="button"
          onClick={copy}
          aria-label={copied() ? t`Copied` : t`Copy code`}
        >
          <Icon name={copied() ? "check" : "copy"} size={16} />
          <span aria-live="polite">{copied() ? t`Copied` : t`Copy`}</span>
        </CopyButton>
      </Bar>
      <Pre tabIndex={0}>
        <code>
          <Show when={highlighted()} fallback={props.code}>
            {(nodes) => renderHast(nodes())}
          </Show>
        </code>
      </Pre>
    </Figure>
  );
}

const Figure = styled("figure", {
  base: {
    margin: 0,
    borderRadius: "var(--z-radius-md, 8px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    overflow: "hidden",
    minWidth: 0,
    maxWidth: "100%",
  },
});

const Bar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "4px 4px 4px 12px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    fontFamily: "var(--fonts-monospace, monospace)",
  },
});

const CopyButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    minHeight: "28px",
    padding: "0 8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "none",
    background: "none",
    color: "var(--z-fg-secondary)",
    fontSize: "12px",
    cursor: "pointer",
    _hover: { background: "var(--z-hover)", color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    _active: { background: "var(--z-btn-pressed)" },
    _phone: { minHeight: "44px", minWidth: "44px", justifyContent: "center" },
  },
});

const Pre = styled("pre", {
  base: {
    margin: 0,
    padding: "12px 16px",
    overflowX: "auto",
    fontSize: "13px",
    lineHeight: 1.55,
    fontFamily: "var(--fonts-monospace, monospace)",
    color: "var(--z-fg-primary)",
    tabSize: 2,
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "-2px",
    },
    // token colours: each kind keeps one theme colour
    "& .tok-keyword": {
      color: "var(--z-accent-text)",
    },
    "& .tok-built_in": {
      color: "var(--z-accent-text)",
    },
    "& .tok-literal": {
      color: "var(--z-accent-text)",
    },
    "& .tok-meta": {
      color: "var(--z-accent-text)",
    },
    "& .tok-string": { color: "var(--z-status-success)" },
    "& .tok-regexp": { color: "var(--z-status-success)" },
    "& .tok-attr": { color: "var(--z-status-success)" },
    "& .tok-number": { color: "var(--z-status-warning)" },
    "& .tok-symbol": { color: "var(--z-status-warning)" },
    "& .tok-bullet": { color: "var(--z-status-warning)" },
    "& .tok-title": {
      color: "var(--z-link)",
    },
    "& .tok-name": {
      color: "var(--z-link)",
    },
    "& .tok-variable": {
      color: "var(--z-link)",
    },
    "& .tok-params": {
      color: "var(--z-link)",
    },
    "& .tok-comment": { color: "var(--z-fg-muted)", fontStyle: "italic" },
    "& .tok-quote": { color: "var(--z-fg-muted)", fontStyle: "italic" },
  },
});
