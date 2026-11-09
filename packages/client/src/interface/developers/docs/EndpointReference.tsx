import { For, JSX, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { CodeBlock } from "./CodeBlock";
import {
  type Endpoint,
  type Status,
  botSdk,
  curlExample,
  endpointSlug,
  fieldsOf,
  permissionLabel,
  plainText,
  resolveSchema,
  responseExample,
  typeLabel,
} from "./inventory";
import { TableWrap } from "./Markdown";

/**
 * Full reference of one endpoint. Every field comes from the inventory, so
 * the page always says the same as the code.
 */
export function EndpointReference(props: {
  endpoint: Endpoint;
  onNavigate: (href: string) => void;
}) {
  const { t } = useLingui();
  const e = () => props.endpoint;
  const auth = (): Record<string, string> => ({
    "user-or-bot": t`Bot token (x-bot-token) or user session (x-session-token).`,
    "user-only": t`User session only. Bots are refused.`,
    "session-only": t`User session only. Bots are refused.`,
    "interaction-token": t`No header: the interaction id and token in the path authenticate the call (valid 15 minutes).`,
    "webhook-token": t`No header: the webhook id and token in the path authenticate the call.`,
    public: t`None. Anyone can call it; a token is ignored.`,
    "public-user-only": t`Optional user session. Bots are refused.`,
  });
  const levels = (): Record<string, string> => ({
    live: t`Verified live: called with a bot token on a running Zrzur server.`,
    integration: t`Local integration test.`,
    "type-checked": t`Type-checked only.`,
    mocked: t`Mocked test only.`,
    untested: t`Untested: derived from the source code only.`,
    failed: t`The last live check failed.`,
  });
  const pathParams = () => e().parameters.filter((p) => p.in === "path");
  const queryParams = () => e().parameters.filter((p) => p.in === "query");
  const headers = () => e().parameters.filter((p) => p.in === "header");
  const bodyFields = () => fieldsOf(e().requestBody);
  const responseSchema = () => e().response?.schema;
  const example = () => responseExample(e());

  return (
    <Card id={endpointSlug(e())} aria-labelledby={`${endpointSlug(e())}-title`}>
      <Head>
        <h3 id={`${endpointSlug(e())}-title`}>{e().title}</h3>
        <StatusBadge status={e().status} />
      </Head>
      <Route dir="ltr">
        <Method data-method={e().method}>{e().method}</Method>
        <code>{e().path}</code>
      </Route>
      <Show when={e().description}>
        <p>{plainText(e().description)}</p>
      </Show>

      <Fields>
        <dt>
          <Trans>Authentication</Trans>
        </dt>
        <dd>{auth()[e().auth.mode] ?? e().auth.mode}</dd>

        <dt>
          <Trans>Permissions</Trans>
        </dt>
        <dd>
          <Show
            when={e().permissions.length}
            fallback={t`None beyond access to the resource.`}
          >
            <For each={e().permissions}>
              {(p, i) => (
                <>
                  {i() ? ", " : ""}
                  {permissionLabel(p)}
                </>
              )}
            </For>
          </Show>
        </dd>

        <dt>
          <Trans>Path parameters</Trans>
        </dt>
        <dd>
          <Show when={pathParams().length} fallback={t`None.`}>
            <ParamList params={pathParams()} />
          </Show>
        </dd>

        <dt>
          <Trans>Query parameters</Trans>
        </dt>
        <dd>
          <Show when={queryParams().length} fallback={t`None.`}>
            <ParamList params={queryParams()} />
          </Show>
        </dd>

        <dt>
          <Trans>Headers</Trans>
        </dt>
        <dd>
          <Show
            when={headers().length}
            fallback={t`Only the authentication header.`}
          >
            <ParamList params={headers()} />
          </Show>
        </dd>

        <dt>
          <Trans>Request body</Trans>
        </dt>
        <dd>
          <Show when={e().requestBody} fallback={t`None.`}>
            <code>{typeLabel(e().requestBody)}</code>
            <Show when={bodyFields().length}>
              <FieldTable fields={bodyFields()} />
            </Show>
          </Show>
        </dd>

        <dt>
          <Trans>Response</Trans>
        </dt>
        <dd>
          <Show when={e().response} fallback={t`Not documented.`}>
            {(response) => (
              <>
                <code>{response().status}</code>{" "}
                <Show
                  when={responseSchema()}
                  fallback={response().status === 204 ? t`No content.` : null}
                >
                  <code>{typeLabel(responseSchema())}</code>
                  <Show when={resolveSchema(responseSchema())?.description}>
                    {(text) => <> — {plainText(text())}</>}
                  </Show>
                </Show>
              </>
            )}
          </Show>
        </dd>

        <dt>
          <Trans>Errors</Trans>
        </dt>
        <dd>
          <Show
            when={e().errors.length}
            fallback={t`Only the common errors (see Errors).`}
          >
            <For each={e().errors}>
              {(error, i) => (
                <>
                  {i() ? ", " : ""}
                  <code>{error.type}</code>
                  {error.status ? ` (${error.status})` : ""}
                </>
              )}
            </For>
          </Show>
        </dd>

        <dt>
          <Trans>Rate limit</Trans>
        </dt>
        <dd>
          <code>{e().rateLimit.bucket}</code>:{" "}
          {t`${e().rateLimit.limit} requests per ${e().rateLimit.windowSeconds} s`}
          {e().rateLimit.scope === "per server"
            ? ` · ${t`per server`}`
            : e().rateLimit.scope === "per channel"
              ? ` · ${t`per channel`}`
              : ` · ${t`per token`}`}
        </dd>

        <dt>SDK</dt>
        <dd>
          <Show
            when={botSdk(e()).length}
            fallback={t`No helper yet; call it with client.rest.req (@zrzur/sdk/bot) or fetch.`}
          >
            <For each={botSdk(e())}>
              {(fn, i) => (
                <>
                  {i() ? ", " : ""}
                  <code>{fn.fn}</code> <Muted>({fn.package})</Muted>
                </>
              )}
            </For>
          </Show>
        </dd>

        <dt>
          <Trans>Gateway events</Trans>
        </dt>
        <dd>
          <Show when={e().events.length} fallback={t`None.`}>
            <For each={e().events}>
              {(event, i) => (
                <>
                  {i() ? ", " : ""}
                  <code>{event}</code>
                </>
              )}
            </For>
          </Show>
        </dd>

        <dt>
          <Trans>Restrictions</Trans>
        </dt>
        <dd>
          <Show when={e().restrictions.length} fallback={t`None known.`}>
            <ul>
              <For each={e().restrictions}>{(text) => <li>{text}</li>}</For>
            </ul>
          </Show>
        </dd>

        <dt>
          <Trans>Status</Trans>
        </dt>
        <dd>
          {levels()[e().verification.level] ?? e().verification.level}
          {e().verification.checked ? ` (${e().verification.checked})` : ""}
        </dd>

        <dt>
          <Trans>Source</Trans>
        </dt>
        <dd>
          <code dir="ltr">{e().source}</code>
        </dd>
      </Fields>

      <details>
        <summary>
          <Trans>Example</Trans>
        </summary>
        <Examples>
          <CodeBlock
            code={curlExample(e())}
            language="bash"
            title={t`Request`}
          />
          <Show when={example()}>
            {(json) => (
              <CodeBlock
                code={json()}
                language="json"
                title={t`Response (recorded live)`}
              />
            )}
          </Show>
        </Examples>
      </details>
    </Card>
  );
}

function ParamList(props: { params: Endpoint["parameters"] }) {
  const { t } = useLingui();
  return (
    <ul>
      <For each={props.params}>
        {(param) => (
          <li>
            <code>{param.name}</code> <Muted>{typeLabel(param.schema)}</Muted>
            {param.required ? ` · ${t`required`}` : ""}
            {param.description ? ` — ${plainText(param.description)}` : ""}
          </li>
        )}
      </For>
    </ul>
  );
}

function FieldTable(props: { fields: ReturnType<typeof fieldsOf> }) {
  const { t } = useLingui();
  return (
    <TableWrap tabIndex={0} style={{ "margin-block-start": "8px" }}>
      <table>
        <thead>
          <tr>
            <th scope="col">
              <Trans>Field</Trans>
            </th>
            <th scope="col">
              <Trans>Type</Trans>
            </th>
            <th scope="col">
              <Trans>Notes</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={props.fields}>
            {(field) => (
              <tr>
                {/* names and types never break inside a word */}
                <td style={{ "white-space": "nowrap" }}>
                  <code style={{ "overflow-wrap": "normal" }}>
                    {field.name}
                  </code>
                </td>
                <td style={{ "white-space": "nowrap" }}>
                  <code style={{ "overflow-wrap": "normal" }}>
                    {field.type}
                  </code>
                  {field.required ? ` · ${t`required`}` : ""}
                </td>
                <td style={{ "min-width": "200px" }}>
                  {[field.description, field.limits]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </TableWrap>
  );
}

export function StatusBadge(props: { status: Status }): JSX.Element {
  const { t } = useLingui();
  const labels = (): Record<Status, string> => ({
    supported: t`Supported`,
    partial: t`Partial`,
    unverified: t`Unverified`,
    unsupported: t`Not for bots`,
  });
  return <Badge data-status={props.status}>{labels()[props.status]}</Badge>;
}

const Card = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    marginBlockEnd: "16px",
    borderRadius: "var(--z-radius-lg, 12px)",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-border-subtle)",
    minWidth: 0,
    scrollMarginTop: "16px",
    "& p": { margin: 0 },
    "& details > summary": {
      cursor: "pointer",
      color: "var(--z-accent-text)",
      fontWeight: 600,
      minHeight: "24px",
      _focusVisible: { outline: "2px solid var(--z-focus)" },
      _phone: { minHeight: "44px", display: "flex", alignItems: "center" },
    },
  },
});

const Head = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
    "& h3": { margin: 0, fontSize: "16px", fontWeight: 650 },
  },
});

const Route = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    fontSize: "14px",
    "& code": { wordBreak: "break-all" },
  },
});

const Method = styled("span", {
  base: {
    padding: "2px 8px",
    borderRadius: "var(--z-radius-sm, 6px)",
    border: "1px solid var(--z-border-strong)",
    fontFamily: "var(--fonts-monospace, monospace)",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
  },
});

const Badge = styled("span", {
  base: {
    padding: "2px 8px",
    borderRadius: "var(--z-radius-pill, 999px)",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    border: "1px solid currentColor",
    "&[data-status=supported]": { color: "var(--z-status-success)" },
    "&[data-status=partial]": { color: "var(--z-status-warning)" },
    "&[data-status=unverified]": { color: "var(--z-fg-secondary)" },
    "&[data-status=unsupported]": { color: "var(--z-status-error)" },
  },
});

const Fields = styled("dl", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(120px, 160px) minmax(0, 1fr)",
    gap: "8px 16px",
    margin: 0,
    fontSize: "14px",
    "& dt": { color: "var(--z-fg-muted)", fontWeight: 600 },
    "& dd": {
      margin: 0,
      minWidth: 0,
      color: "var(--z-fg-secondary)",
      overflowWrap: "anywhere",
    },
    "& ul": { margin: 0, paddingInlineStart: "18px" },
    _phone: {
      gridTemplateColumns: "minmax(0, 1fr)",
      "& dd": { marginBlockEnd: "8px" },
    },
  },
});

const Examples = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBlockStart: "8px",
  },
});

const Muted = styled("span", { base: { color: "var(--z-fg-muted)" } });
