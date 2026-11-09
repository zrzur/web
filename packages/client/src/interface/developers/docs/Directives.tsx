import { For, JSX, Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { CodeBlock } from "./CodeBlock";
import { EndpointReference, StatusBadge } from "./EndpointReference";
import { exampleSource } from "./examples";
import {
  endpointSlug,
  endpointsFor,
  inventory,
  pageOfSection,
} from "./inventory";
import { Inline, TableWrap } from "./Markdown";
import { useReference } from "./reference";

/**
 * A fenced block whose language names a directive renders generated content
 * from the inventory; any other fence is shown as code.
 */
export function Directive(props: {
  name: string;
  argument: string;
  value: string;
  onNavigate: (href: string) => void;
  fallback: JSX.Element;
}) {
  const { t } = useLingui();
  const reference = useReference();
  return (
    <Switch fallback={props.fallback}>
      <Match when={props.name === "endpoints"}>
        <div>
          <For each={endpointsFor(props.argument.trim())}>
            {(endpoint) => (
              <EndpointReference
                endpoint={endpoint}
                onNavigate={props.onNavigate}
              />
            )}
          </For>
        </div>
      </Match>
      <Match when={props.name === "example"}>
        <Show
          when={exampleSource(props.argument.trim())}
          fallback={<p>{props.argument}</p>}
        >
          {(source) => (
            <CodeBlock
              code={source()}
              language="javascript"
              title={props.argument.trim()}
            />
          )}
        </Show>
      </Match>
      <Match when={props.name === "events"}>
        <EventReference />
      </Match>
      <Match when={props.name === "types"}>
        <TypeReference />
      </Match>
      <Match when={props.name === "client-messages"}>
        <Table
          head={[t`Message`, t`Fields`, t`Meaning`]}
          rows={inventory.gateway.clientMessages.map((message) => [
            <code>{message.name}</code>,
            <code dir="ltr">
              {message.fields.map((field) => field.name).join(", ")}
            </code>,
            <Inline
              text={reference().clientMessages?.[message.name] ?? message.docs}
            />,
          ])}
        />
      </Match>
      <Match when={props.name === "permissions"}>
        <Table
          head={[t`Permission`, t`Bit`, t`Value`, t`Allows`]}
          rows={[...inventory.permissions]
            .sort((a, b) => a.bit - b.bit)
            .map((permission) => [
              <code>{permission.name}</code>,
              String(permission.bit),
              <code>{permission.value}</code>,
              reference().permissions?.[permission.name] ??
                permission.description,
            ])}
        />
      </Match>
      <Match when={props.name === "errors"}>
        <ErrorTable audience={props.argument.trim() || "bots"} />
      </Match>
      <Match when={props.name === "ratelimits"}>
        <Table
          head={[t`Bucket`, t`Requests per window`, t`Applies to`]}
          rows={bucketRows().map(([bucket, limit, where]) => [
            <code>{bucket}</code>,
            `${limit} / ${inventory.rateLimits.windowSeconds} s`,
            <code dir="ltr">{where}</code>,
          ])}
        />
      </Match>
      <Match when={props.name === "unsupported"}>
        <Table
          head={[t`Endpoint`, t`Why bots cannot use it`]}
          rows={inventory.index
            .filter((endpoint) => endpoint.status === "unsupported")
            .map((endpoint) => [
              <a
                href={`/developers/docs/${pageOfSection(endpoint.section)}#${endpointSlug(endpoint)}`}
                onClick={(event) => {
                  event.preventDefault();
                  props.onNavigate(
                    `/developers/docs/${pageOfSection(endpoint.section)}#${endpointSlug(endpoint)}`,
                  );
                }}
              >
                <code dir="ltr">{endpoint.id}</code>
              </a>,
              endpoint.restriction ??
                (endpoint.botRejectedWith
                  ? t`Bots get ${endpoint.botRejectedWith}.`
                  : t`Needs a user session.`),
            ])}
        />
      </Match>
      <Match when={props.name === "coverage"}>
        <Table
          head={[t`Status`, t`Endpoints`, t`Meaning`]}
          rows={(
            [
              [
                "supported",
                t`Bots can use it; checked live against a running server.`,
              ],
              [
                "partial",
                t`Bots can use it with limits, or the live check found a difference.`,
              ],
              [
                "unverified",
                t`The code accepts bot tokens; not checked live yet.`,
              ],
              ["unsupported", t`Bots are refused; listed so you know.`],
            ] as const
          ).map(([status, meaning]) => [
            <StatusBadge status={status} />,
            String(inventory.counts.byStatus[status] ?? 0),
            meaning,
          ])}
        />
      </Match>
    </Switch>
  );
}

/** Every event a bot can receive: meaning, intent, fields, a real sample */
function EventReference() {
  const { t } = useLingui();
  const reference = useReference();
  const events = () =>
    inventory.gateway.events.filter((event) => event.audience !== "users");
  return (
    <For each={events()}>
      {(event) => (
        <section>
          <h3 id={event.name.toLowerCase()} dir="ltr">
            <code>{event.name}</code>
          </h3>
          <p>
            <Inline text={reference().events?.[event.name] ?? event.docs} />
          </p>
          <p>
            <Trans>Intent:</Trans>{" "}
            <code dir="ltr">
              {event.intent === "always" ? t`none needed` : event.intent}
            </code>
          </p>
          <Show when={event.fields?.length}>
            <FieldRows fields={event.fields!} />
          </Show>
          <Show when={event.sample}>
            {(sample) => (
              <CodeBlock
                code={JSON.stringify(sample(), null, 2)}
                language="json"
                title={t`Recorded from a running server`}
              />
            )}
          </Show>
        </section>
      )}
    </For>
  );
}

/** Every type the events refer to */
function TypeReference() {
  return (
    <For each={Object.entries(inventory.gateway.types)}>
      {([name, type]) => (
        <section>
          <h3
            id={`type-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            dir="ltr"
          >
            <code>{name}</code>
          </h3>
          <Show when={type.description}>
            <p lang="en" dir="ltr">
              {type.description}
            </p>
          </Show>
          <Show when={type.values.length}>
            <p dir="ltr">
              <code>{type.values.join(" | ")}</code>
            </p>
          </Show>
          <Show when={type.fields.length}>
            <FieldRows fields={type.fields} />
          </Show>
        </section>
      )}
    </For>
  );
}

function FieldRows(props: {
  fields: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
}) {
  const { t } = useLingui();
  return (
    <Table
      head={[t`Field`, t`Type`, t`Always there`, t`Notes`]}
      rows={props.fields.map((field) => [
        <code dir="ltr">{field.name}</code>,
        <code dir="ltr">{field.type}</code>,
        field.required ? t`Yes` : t`No`,
        <span lang="en" dir="ltr">
          {field.description}
        </span>,
      ])}
    />
  );
}

/** Every error type, with its cause and fix */
function ErrorTable(props: { audience: string }) {
  const { t } = useLingui();
  const reference = useReference();
  return (
    <Table
      head={[t`Error type`, t`HTTP status`, t`Extra fields`, t`Cause`, t`Fix`]}
      rows={inventory.errors
        .filter((error) => error.audience === props.audience)
        .sort((a, b) => a.type.localeCompare(b.type))
        .map((error) => {
          const text = reference().errors?.[error.type];
          return [
            <code dir="ltr">{error.type}</code>,
            String(error.status ?? "—"),
            <code dir="ltr">{error.fields.join(", ")}</code>,
            <Inline text={text?.[0] ?? error.cause} />,
            <Inline text={text?.[1] ?? error.fix} />,
          ];
        })}
    />
  );
}

function bucketRows() {
  const where = new Map<string, Set<string>>();
  for (const endpoint of inventory.index) {
    const set = where.get(endpoint.rateLimit.bucket) ?? new Set();
    set.add(
      `/${endpoint.path.split("/")[1] ?? ""}${endpoint.rateLimit.scope ? ` (${endpoint.rateLimit.scope})` : ""}`,
    );
    where.set(endpoint.rateLimit.bucket, set);
  }
  return [...where.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([bucket, paths]) =>
        [
          bucket,
          inventory.rateLimits.buckets[bucket] ??
            inventory.rateLimits.defaultLimit,
          [...paths].join(", "),
        ] as const,
    );
}

function Table(props: { head: string[]; rows: (JSX.Element | string)[][] }) {
  return (
    <TableWrap tabIndex={0}>
      <table>
        <thead>
          <tr>
            <For each={props.head}>{(cell) => <th scope="col">{cell}</th>}</For>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows}>
            {(row) => (
              <tr>
                <For each={row}>{(cell) => <td>{cell}</td>}</For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </TableWrap>
  );
}
