import { For, JSX, Match, Switch, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Heading, RootContent, Table } from "mdast";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

import { CodeBlock } from "./CodeBlock";
import { Directive } from "./Directives";
import { hrefHere, leavesHere } from "./here";
import { headingId, headingText, parseMarkdown, textOf } from "./markdownTree";

/**
 * Render a documentation page. Fences named `endpoints`, `events`,
 * `permissions`, `errors`, `ratelimits`, `unsupported` and `example` insert
 * generated content; see Directives.tsx.
 */
export function Markdown(props: {
  source: string;
  onNavigate: (href: string) => void;
}) {
  const tree = createMemo(() => parseMarkdown(props.source));
  return <Nodes nodes={tree().children} onNavigate={props.onNavigate} />;
}

/** One line of reference text: `code` stays code, nothing else is parsed */
export function Inline(props: { text: string }) {
  return (
    <For each={props.text.split(/(`[^`]+`)/)}>
      {(part) =>
        part.startsWith("`") ? <code dir="ltr">{part.slice(1, -1)}</code> : part
      }
    </For>
  );
}

function Nodes(props: {
  nodes: RootContent[];
  onNavigate: (href: string) => void;
}): JSX.Element {
  return (
    <For each={props.nodes}>
      {(node, at) => {
        const before = props.nodes[at() - 1];
        // the list under "Next": the pages to read now, as cards
        return node.type === "list" &&
          before?.type === "heading" &&
          headingId(before) === NEXT ? (
          <NextCards list={node} onNavigate={props.onNavigate} />
        ) : (
          <Node node={node} onNavigate={props.onNavigate} />
        );
      }}
    </For>
  );
}

/** Anchor of the section that ends a page with what to read next */
export const NEXT = "next";

/** The pages to read next, one card each */
function NextCards(props: {
  list: RootContent;
  onNavigate: (href: string) => void;
}) {
  const links = () => {
    const found: { url: string; text: string }[] = [];
    const visit = (node: RootContent) => {
      if (node.type === "link")
        found.push({ url: node.url, text: textOf(node) });
      else if ("children" in node)
        (node.children as RootContent[]).forEach(visit);
    };
    visit(props.list);
    return found;
  };
  return (
    <Cards>
      <For each={links()}>
        {(link) => (
          <a
            href={hrefHere(link.url)}
            onClick={(event) => {
              if (leavesHere(hrefHere(link.url))) return;
              if (event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              props.onNavigate(link.url);
            }}
          >
            <span class="words">{link.text}</span>
            <Icon name="arrow-right" size={16} class="arrow" />
          </a>
        )}
      </For>
    </Cards>
  );
}

function Node(props: {
  node: RootContent;
  onNavigate: (href: string) => void;
}): JSX.Element {
  const children = () =>
    "children" in props.node ? (
      <Nodes
        nodes={props.node.children as RootContent[]}
        onNavigate={props.onNavigate}
      />
    ) : null;

  return (
    <Switch fallback={children()}>
      <Match when={props.node.type === "heading" && (props.node as Heading)}>
        {(heading) => {
          const id = headingId(heading());
          const content = (
            <Nodes nodes={heading().children} onNavigate={props.onNavigate} />
          );
          return (
            <Switch fallback={<h4 id={id}>{content}</h4>}>
              <Match when={heading().depth === 1}>
                <h1 id={id}>{content}</h1>
              </Match>
              <Match when={heading().depth === 2}>
                <h2 id={id}>
                  {content}
                  <SectionLink id={id} />
                </h2>
              </Match>
              <Match when={heading().depth === 3}>
                <h3 id={id}>
                  {content}
                  <SectionLink id={id} />
                </h3>
              </Match>
            </Switch>
          );
        }}
      </Match>
      <Match when={props.node.type === "paragraph"}>
        <p>{children()}</p>
      </Match>
      <Match when={props.node.type === "text" && props.node}>
        {(node) => headingText((node() as { value: string }).value)}
      </Match>
      <Match when={props.node.type === "strong"}>
        <strong>{children()}</strong>
      </Match>
      <Match when={props.node.type === "emphasis"}>
        <em>{children()}</em>
      </Match>
      <Match when={props.node.type === "delete"}>
        <del>{children()}</del>
      </Match>
      <Match when={props.node.type === "inlineCode" && props.node}>
        {(node) => <code dir="ltr">{(node() as { value: string }).value}</code>}
      </Match>
      <Match when={props.node.type === "break"}>
        <br />
      </Match>
      <Match when={props.node.type === "thematicBreak"}>
        <hr />
      </Match>
      <Match when={props.node.type === "blockquote"}>
        <Note>
          <Icon name="info" size={18} class="mark" />
          <div>{children()}</div>
        </Note>
      </Match>
      <Match when={props.node.type === "list" && props.node}>
        {(node) => {
          const list = node() as {
            ordered?: boolean | null;
            start?: number | null;
          };
          // steps split by a code block go on counting: "4." after three
          const start = list.start ?? 1;
          return list.ordered ? (
            <ol
              start={start}
              style={start > 1 ? { "counter-reset": `step ${start - 1}` } : {}}
            >
              {children()}
            </ol>
          ) : (
            <ul>{children()}</ul>
          );
        }}
      </Match>
      <Match when={props.node.type === "listItem" && props.node}>
        {(node) => {
          // tight list items render their paragraph inline
          const item = node() as { children: RootContent[] };
          const inner =
            item.children.length === 1 && item.children[0].type === "paragraph"
              ? (item.children[0] as { children: RootContent[] }).children
              : item.children;
          return (
            <li>
              <Nodes nodes={inner} onNavigate={props.onNavigate} />
            </li>
          );
        }}
      </Match>
      <Match when={props.node.type === "link" && props.node}>
        {(node) => {
          const link = node() as { url: string };
          // where the page lives here: in the app or on the docs site
          const href = hrefHere(link.url);
          // other sites open beside this one; files such as the changelog
          // feed are not pages of the app: the browser opens them itself
          const external = /^https?:\/\//.test(href);
          return (
            <a
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noreferrer noopener" : undefined}
              onClick={(event) => {
                if (leavesHere(href) || event.ctrlKey || event.metaKey) return;
                event.preventDefault();
                props.onNavigate(link.url);
              }}
            >
              {children()}
            </a>
          );
        }}
      </Match>
      <Match when={props.node.type === "table" && (props.node as Table)}>
        {(table) => (
          <TableWrap tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <For each={table().children[0]?.children ?? []}>
                    {(cell) => (
                      <th scope="col">
                        <Nodes
                          nodes={cell.children}
                          onNavigate={props.onNavigate}
                        />
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={table().children.slice(1)}>
                  {(row) => (
                    <tr>
                      <For each={row.children}>
                        {(cell) => (
                          <td>
                            <Nodes
                              nodes={cell.children}
                              onNavigate={props.onNavigate}
                            />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </TableWrap>
        )}
      </Match>
      <Match when={props.node.type === "code" && props.node}>
        {(node) => {
          const code = node() as {
            lang?: string | null;
            meta?: string | null;
            value: string;
          };
          return (
            <Directive
              name={code.lang ?? ""}
              argument={code.meta ?? ""}
              value={code.value}
              onNavigate={props.onNavigate}
              fallback={
                <CodeBlock
                  code={code.value}
                  language={code.lang ?? undefined}
                  title={code.meta ?? undefined}
                />
              }
            />
          );
        }}
      </Match>
      <Match when={props.node.type === "html" && props.node}>
        {/* raw HTML is shown as text, never rendered */}
        {(node) => <code>{(node() as { value: string }).value}</code>}
      </Match>
    </Switch>
  );
}

/** The "#" beside a section title: its own address, for sharing */
function SectionLink(props: { id: string }) {
  const { t } = useLingui();
  return (
    <a
      class="anchor"
      href={`#${props.id}`}
      aria-label={t`Link to this section`}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        history.replaceState(history.state, "", `#${props.id}`);
        document.getElementById(props.id)?.scrollIntoView({ block: "start" });
      }}
    >
      #
    </a>
  );
}

const Cards = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
    "& a": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      minHeight: "56px",
      padding: "12px 16px",
      borderRadius: "var(--z-radius-md, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-box-bg)",
      color: "var(--z-fg-primary) !important",
      textDecoration: "none !important",
      fontWeight: 600,
      _hover: { borderColor: "var(--z-border-strong)" },
      _focusVisible: { outline: "2px solid var(--z-focus)" },
    },
    "& .words": { flex: 1, minWidth: 0 },
    "& .arrow": {
      flexShrink: 0,
      "--z-icon-color": "var(--z-fg-muted)",
    },
    "& a:hover .arrow": { "--z-icon-color": "var(--z-accent)" },
  },
});

export const Note = styled("aside", {
  base: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
    padding: "12px 16px",
    borderRadius: "var(--z-radius-md, 8px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-accent)",
    "& .mark": { flexShrink: 0, marginBlockStart: "3px" },
    "& > div": { flex: 1, minWidth: 0 },
    "& p": { margin: 0 },
    "& p + p": { marginBlockStart: "8px" },
  },
});

export const TableWrap = styled("div", {
  base: {
    overflowX: "auto",
    maxWidth: "100%",
    borderRadius: "var(--z-radius-md, 8px)",
    border: "1px solid var(--z-border-subtle)",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
    "& table": { borderCollapse: "collapse", width: "100%", fontSize: "14px" },
    "& th": {
      padding: "8px 12px",
      textAlign: "start",
      verticalAlign: "top",
      borderBlockEnd: "1px solid var(--z-border-subtle)",
      color: "var(--z-fg-muted)",
      fontWeight: 600,
      fontSize: "12px",
      whiteSpace: "nowrap",
      background: "var(--z-box-bg)",
    },
    "& td": {
      padding: "8px 12px",
      textAlign: "start",
      verticalAlign: "top",
      borderBlockEnd: "1px solid var(--z-border-subtle)",
    },
    "& tr:last-child td": { borderBlockEnd: "none" },
    // a name in a table is read whole: the table scrolls instead
    "& td:first-child code": {
      whiteSpace: "nowrap",
      overflowWrap: "normal",
    },
  },
});
