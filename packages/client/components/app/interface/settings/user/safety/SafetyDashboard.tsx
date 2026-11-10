import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createResource,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useState } from "@revolt/state";
import { useError } from "@revolt/i18n";
import { Dialog, FloatingSelect, MenuItem } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSafetyLabels } from "../../../safety/labels";
import {
  SafetyAccess,
  SafetyActionKind,
  SafetyAppeal,
  SafetyCase,
  SafetyCaseDetails,
  SafetyCategory,
  SafetyPriority,
  SafetyStatus,
  SafetyTargetKind,
  actionsFor,
  nextStatuses,
  safetyApi,
  safetyErrorType,
} from "../../../safety/safetyApi";
import {
  Buttons,
  Empty,
  ErrorText,
  Field,
  Notice,
  Pill,
  Stack,
  Summary,
} from "../../../safety/styles";

import { formatDate } from "./ReportsAndStanding";

type Tab = "queue" | "appeals";

const STATUS_FILTERS: { id: string; statuses: SafetyStatus[] }[] = [
  {
    id: "open",
    statuses: [
      "Submitted",
      "Queued",
      "UnderReview",
      "MoreInfoRequired",
      "Escalated",
    ],
  },
  { id: "appealed", statuses: ["Appealed"] },
  {
    id: "decided",
    statuses: ["ActionTaken", "NoViolation", "Duplicate", "AppealResolved"],
  },
  { id: "closed", statuses: ["Closed"] },
];

const KINDS: SafetyTargetKind[] = [
  "User",
  "Message",
  "Server",
  "Channel",
  "Bot",
  "Application",
  "CommunityItem",
  "Attachment",
  "Invite",
  "Webhook",
  "DiscoverServer",
  "DiscoverBot",
];

const PRIORITIES: SafetyPriority[] = ["Urgent", "High", "Normal", "Low"];

const priorityTone = (priority: SafetyPriority) =>
  ({ Urgent: "danger", High: "warn", Normal: undefined, Low: undefined })[
    priority
  ];

/**
 * Trust & Safety review dashboard. Access is decided by the server from
 * platform permissions (`safety.*`); server roles never count. Every
 * button is re-checked by the API.
 */
export function SafetyDashboard(props: {
  show: boolean;
  onClose: () => void;
  access: SafetyAccess;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSafetyLabels();
  const describeError = useError();

  const [tab, setTab] = createSignal<Tab>("queue");
  const [statusFilter, setStatusFilter] = createSignal("open");
  const [kind, setKind] = createSignal("");
  const [category, setCategory] = createSignal("");
  const [priority, setPriority] = createSignal("");
  const [assignee, setAssignee] = createSignal("");
  const [search, setSearch] = createSignal("");
  const [oldest, setOldest] = createSignal(true);
  const [pages, setPages] = createSignal<string[]>([]);
  const [selected, setSelected] = createSignal<string>();
  const [checked, setChecked] = createSignal<string[]>([]);
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const filter = () => ({
    status: STATUS_FILTERS.find((f) => f.id === statusFilter())?.statuses.join(
      ",",
    ),
    kind: kind() || undefined,
    category: category() || undefined,
    priority: priority() || undefined,
    assignee: assignee() || undefined,
    search: search().trim() || undefined,
    oldest: oldest(),
    before: pages().at(-1),
    limit: 50,
  });

  const [queue, { refetch }] = createResource(filter, (query) =>
    safetyApi.queue(client(), query),
  );
  const cases = () => queue()?.cases ?? [];
  const current = () =>
    cases().find((entry) => entry._id === selected()) ?? cases()[0];

  const [details, { refetch: refetchDetails, mutate: setDetails }] =
    createResource(
      () => (tab() === "queue" ? current()?._id : undefined),
      (id) => safetyApi.details(client(), id),
    );

  const [appeals, { refetch: refetchAppeals }] = createResource(
    () => tab() === "appeals",
    () => safetyApi.appeals(client()),
  );

  // a new filter starts from the first page
  createEffect(
    on(
      [statusFilter, kind, category, priority, assignee, search, oldest],
      () => {
        setPages([]);
        setChecked([]);
      },
      { defer: true },
    ),
  );

  /** Reload after a change; a conflict means someone else was faster */
  async function run(task: () => Promise<unknown>) {
    if (busy()) return;
    setBusy(true);
    setError(undefined);
    try {
      await task();
      await refetch();
      await refetchDetails();
    } catch (failure) {
      const type = safetyErrorType(failure);
      if (typeof failure === "string" && !type) {
        // a local check (see CaseView), already translated
        setError(failure);
        return;
      }
      if (type === "SafetyCaseConflict") {
        setError(t`Someone else changed this case. It has been reloaded.`);
      } else if (type === "MissingPlatformPermission") {
        setError(t`You don't have permission for this.`);
      } else {
        setError(describeError(failure));
      }
      // a failed action can still have saved the copy of the content and so
      // moved the case version on: without this the retry would be refused
      await refetchDetails();
    } finally {
      setBusy(false);
    }
  }

  // j / k move through the queue, r reloads
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target?.closest(
        'input:not([type="checkbox"]), textarea, [contenteditable]',
      )
    )
      return;
    const list = cases();
    const index = list.findIndex((entry) => entry._id === current()?._id);
    if (event.key === "j" && index < list.length - 1) {
      setSelected(list[index + 1]._id);
    } else if (event.key === "k" && index > 0) {
      setSelected(list[index - 1]._id);
    } else if (event.key === "r") {
      void refetch();
    } else {
      return;
    }
    event.preventDefault();
  };
  document.addEventListener("keydown", onKey);
  onCleanup(() => document.removeEventListener("keydown", onKey));

  const name = (id?: string) =>
    id ? (client().users.get(id)?.username ?? id) : "—";

  const toggle = (id: string) =>
    setChecked((list) =>
      list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
    );

  return (
    <Dialog
      tone="security"
      iconName="shield-check"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Trust & Safety</Trans>}
      size="xl"
      // wide enough for the filter row, not the whole screen
      width={960}
      showClose
    >
      <Body>
        <Tabs role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "queue"}
            onClick={() => setTab("queue")}
          >
            <Trans>Reports</Trans>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab() === "appeals"}
            onClick={() => setTab("appeals")}
          >
            <Trans>Appeals</Trans>
          </button>
          <small>
            <Trans>Keys: j / k next and previous, r reload</Trans>
          </small>
        </Tabs>

        <Show when={tab() === "queue"}>
          <Filters>
            <FloatingSelect
              aria-label={t`Status`}
              value={statusFilter()}
              onChange={(e) => setStatusFilter(e.currentTarget.value)}
            >
              <MenuItem value="open">{t`Open reports`}</MenuItem>
              <MenuItem value="appealed">{labels.status.Appealed}</MenuItem>
              <MenuItem value="decided">{t`Decided`}</MenuItem>
              <MenuItem value="closed">{labels.status.Closed}</MenuItem>
            </FloatingSelect>
            <FloatingSelect
              aria-label={t`Type`}
              value={kind()}
              onChange={(e) => setKind(e.currentTarget.value)}
            >
              <MenuItem value="">{t`All types`}</MenuItem>
              <For each={KINDS}>
                {(value) => (
                  <MenuItem value={value}>{labels.kind[value]}</MenuItem>
                )}
              </For>
            </FloatingSelect>
            <FloatingSelect
              aria-label={t`Reason`}
              value={category()}
              onChange={(e) => setCategory(e.currentTarget.value)}
            >
              <MenuItem value="">{t`All reasons`}</MenuItem>
              <For each={Object.keys(labels.category) as SafetyCategory[]}>
                {(value) => (
                  <MenuItem value={value}>
                    {labels.category[value].name}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
            <FloatingSelect
              aria-label={t`Priority`}
              value={priority()}
              onChange={(e) => setPriority(e.currentTarget.value)}
            >
              <MenuItem value="">{t`Any priority`}</MenuItem>
              <For each={PRIORITIES}>
                {(value) => (
                  <MenuItem value={value}>{labels.priority[value]}</MenuItem>
                )}
              </For>
            </FloatingSelect>
            <FloatingSelect
              aria-label={t`Assignee`}
              value={assignee()}
              onChange={(e) => setAssignee(e.currentTarget.value)}
            >
              <MenuItem value="">{t`Anyone`}</MenuItem>
              <MenuItem value="me">{t`Assigned to me`}</MenuItem>
              <MenuItem value="none">{t`Unassigned`}</MenuItem>
            </FloatingSelect>
            <FloatingSelect
              aria-label={t`Sort`}
              value={oldest() ? "oldest" : "newest"}
              onChange={(e) => setOldest(e.currentTarget.value === "oldest")}
            >
              <MenuItem value="oldest">{t`Oldest first`}</MenuItem>
              <MenuItem value="newest">{t`Newest first`}</MenuItem>
            </FloatingSelect>
            <input
              type="search"
              dir="auto"
              placeholder={t`Reference, user or target id`}
              value={search()}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </Filters>

          <Show when={checked().length}>
            <Bulk>
              <span>
                <Trans>{checked().length} selected</Trans>
              </span>
              <Buttons>
                <button
                  type="button"
                  disabled={busy()}
                  onClick={() =>
                    void run(async () => {
                      const result = await safetyApi.bulk(client(), {
                        ids: checked(),
                        assign_self: true,
                        status: "UnderReview",
                      });
                      setChecked(Object.keys(result.failed));
                    })
                  }
                >
                  <Trans>Review myself</Trans>
                </button>
                <For each={["High", "Low"] as SafetyPriority[]}>
                  {(value) => (
                    <button
                      type="button"
                      disabled={busy()}
                      onClick={() =>
                        void run(async () => {
                          await safetyApi.bulk(client(), {
                            ids: checked(),
                            priority: value,
                          });
                          setChecked([]);
                        })
                      }
                    >
                      {labels.priority[value]}
                    </button>
                  )}
                </For>
                <Show when={props.access.action}>
                  <button
                    type="button"
                    data-danger
                    disabled={busy()}
                    onClick={() => {
                      if (
                        !confirm(
                          t`Mark the selected reports as "no violation found"?`,
                        )
                      )
                        return;
                      void run(async () => {
                        const result = await safetyApi.bulk(client(), {
                          ids: checked(),
                          status: "NoViolation",
                        });
                        setChecked(Object.keys(result.failed));
                      });
                    }}
                  >
                    {labels.status.NoViolation}
                  </button>
                </Show>
                <button type="button" onClick={() => setChecked([])}>
                  <Trans>Clear</Trans>
                </button>
              </Buttons>
            </Bulk>
          </Show>

          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>

          <Switch>
            <Match when={queue.loading && !queue.latest}>
              <Empty>
                <Trans>Loading…</Trans>
              </Empty>
            </Match>
            <Match when={queue.error}>
              <Empty>
                <Trans>The queue couldn't be loaded.</Trans>
                <button type="button" onClick={() => void refetch()}>
                  <Trans>Try again</Trans>
                </button>
              </Empty>
            </Match>
            <Match when={!cases().length}>
              <Empty>
                <Icon name="check-circle" size={22} />
                <Trans>Nothing here. The queue is clear.</Trans>
              </Empty>
            </Match>
            <Match when={current()}>
              {(active) => (
                <Layout>
                  <Queue>
                    <For each={cases()}>
                      {(entry) => (
                        <QueueRow
                          aria-current={entry._id === active()._id || undefined}
                        >
                          <input
                            type="checkbox"
                            aria-label={entry.reference}
                            checked={checked().includes(entry._id)}
                            onChange={() => toggle(entry._id)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(entry._id);
                              setError(undefined);
                            }}
                          >
                            <span data-top>
                              <bdi dir="ltr">{entry.reference}</bdi>
                              <Pill data-tone={priorityTone(entry.priority)}>
                                {labels.priority[entry.priority]}
                              </Pill>
                            </span>
                            <strong>
                              {labels.category[entry.category].name}
                            </strong>
                            <small>
                              {labels.kind[entry.target.kind]} ·{" "}
                              {labels.status[entry.status]} ·{" "}
                              <time>{formatDate(entry.created_at)}</time>
                            </small>
                          </button>
                        </QueueRow>
                      )}
                    </For>
                    <Pager>
                      <button
                        type="button"
                        disabled={!pages().length}
                        onClick={() => setPages((list) => list.slice(0, -1))}
                      >
                        <Trans>Previous</Trans>
                      </button>
                      <button
                        type="button"
                        disabled={!queue()?.next}
                        onClick={() =>
                          setPages((list) => [...list, queue()!.next!])
                        }
                      >
                        <Trans>Next</Trans>
                      </button>
                    </Pager>
                  </Queue>

                  <Panel>
                    <Switch>
                      <Match when={details.loading && !details.latest}>
                        <Empty>
                          <Trans>Loading…</Trans>
                        </Empty>
                      </Match>
                      <Match when={details.error}>
                        <Empty>
                          <Trans>This case couldn't be loaded.</Trans>
                          <button
                            type="button"
                            onClick={() => void refetchDetails()}
                          >
                            <Trans>Try again</Trans>
                          </button>
                        </Empty>
                      </Match>
                      <Match when={details.latest}>
                        {(info) => (
                          // keyed: what was typed for one case never goes
                          // out with the next one
                          <Show when={info().case._id} keyed>
                            <CaseView
                              details={info()}
                              access={props.access}
                              busy={busy()}
                              name={name}
                              run={run}
                              onChanged={(next) =>
                                setDetails({ ...info(), case: next })
                              }
                            />
                          </Show>
                        )}
                      </Match>
                    </Switch>
                  </Panel>
                </Layout>
              )}
            </Match>
          </Switch>
        </Show>

        <Show when={tab() === "appeals"}>
          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>
          <Switch>
            <Match when={appeals.loading}>
              <Empty>
                <Trans>Loading…</Trans>
              </Empty>
            </Match>
            <Match when={appeals.error}>
              <Empty>
                <Trans>Appeals couldn't be loaded.</Trans>
                <button type="button" onClick={() => void refetchAppeals()}>
                  <Trans>Try again</Trans>
                </button>
              </Empty>
            </Match>
            <Match when={!appeals()?.length}>
              <Empty>
                <Icon name="check-circle" size={22} />
                <Trans>No appeals waiting.</Trans>
              </Empty>
            </Match>
            <Match when={appeals()}>
              <Stack>
                <For each={appeals()}>
                  {(appeal) => (
                    <AppealCard
                      appeal={appeal}
                      access={props.access}
                      name={name}
                      onDecided={() => void refetchAppeals()}
                    />
                  )}
                </For>
              </Stack>
            </Match>
          </Switch>
        </Show>
      </Body>
    </Dialog>
  );
}

function CaseView(props: {
  details: SafetyCaseDetails;
  access: SafetyAccess;
  busy: boolean;
  name: (id?: string) => string;
  run: (task: () => Promise<unknown>) => Promise<void>;
  onChanged: (next: SafetyCase) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const state = useState();
  const labels = useSafetyLabels();
  const [publicNote, setPublicNote] = createSignal("");
  const [note, setNote] = createSignal("");
  const [actionKind, setActionKind] = createSignal<SafetyActionKind>("Warning");
  const [reason, setReason] = createSignal("");
  const [internal, setInternal] = createSignal("");
  const [days, setDays] = createSignal(7);
  const [duplicateOf, setDuplicateOf] = createSignal("");
  // statement of reasons (DSA Art. 17)
  const [groundType, setGroundType] = createSignal<"Terms" | "Law">("Terms");
  const [law, setLaw] = createSignal("");
  const [provision, setProvision] = createSignal("");
  const [facts, setFacts] = createSignal("");
  const [limitedScope, setLimitedScope] = createSignal(false);
  const [countries, setCountries] = createSignal("");
  const [autoDetected, setAutoDetected] = createSignal(false);
  const [autoDecided, setAutoDecided] = createSignal(false);

  const c = () => props.details.case;
  const me = () => client().user?.id;

  const setStatus = (status: SafetyStatus) =>
    props.run(async () => {
      if (status === "MoreInfoRequired" && !publicNote().trim()) {
        throw t`Write what you need from the reporter first.`;
      }
      const next = await safetyApi.setStatus(client(), c()._id, {
        status,
        public_note: publicNote().trim() || undefined,
        note: note().trim() || undefined,
        version: c().version,
      });
      setPublicNote("");
      setNote("");
      props.onChanged(next);
    });

  const takeAction = () =>
    props.run(async () => {
      if (reason().trim().length < 3) {
        throw t`Write the reason the user will see.`;
      }
      if (facts().trim().length < 3) {
        throw t`Write the facts the user will see.`;
      }
      if (
        groundType() === "Law" &&
        (!law().trim() || !provision().trim())
      ) {
        throw t`Name the law and the provision.`;
      }
      if (limitedScope() && !countries().trim()) {
        throw t`Name the countries, or choose worldwide.`;
      }
      if (
        !confirm(
          t`Take this action? It applies immediately and is recorded on the case.`,
        )
      ) {
        return;
      }
      await safetyApi.act(client(), c()._id, {
        kind: actionKind(),
        public_reason: reason().trim(),
        internal_note: internal().trim() || undefined,
        duration_days: actionKind() === "SuspendAccount" ? days() : undefined,
        version: c().version,
        statement: {
          ground:
            groundType() === "Law"
              ? { type: "Law", law: law().trim(), provision: provision().trim() }
              : { type: "Terms", rule: `rule:${c().category}` },
          facts: facts().trim(),
          territorial_scope: limitedScope() ? countries().trim() : "worldwide",
          automated_detection: autoDetected(),
          automated_decision: autoDecided(),
        },
      });
      setReason("");
      setInternal("");
      setGroundType("Terms");
      setLaw("");
      setProvision("");
      setFacts("");
      setLimitedScope(false);
      setCountries("");
      setAutoDetected(false);
      setAutoDecided(false);
    });

  const decided = () =>
    [
      "ActionTaken",
      "NoViolation",
      "Duplicate",
      "Closed",
      "AppealResolved",
    ].includes(c().status);

  return (
    <Stack>
      <CaseHead>
        <h3>
          <bdi dir="ltr">{c().reference}</bdi>
        </h3>
        <Pill data-tone={priorityTone(c().priority)}>
          {labels.priority[c().priority]}
        </Pill>
        <Pill>{labels.status[c().status]}</Pill>
        <Show when={props.details.distinct_reporters > 1}>
          <Pill data-tone="warn">
            <Trans>{props.details.distinct_reporters} reporters</Trans>
          </Pill>
        </Show>
      </CaseHead>

      <Summary>
        <dt>
          <Trans>Target</Trans>
        </dt>
        <dd>
          {labels.kind[c().target.kind]} · <bdi dir="ltr">{c().target.id}</bdi>
        </dd>
        <dt>
          <Trans>Responsible account</Trans>
        </dt>
        <dd>
          <bdi>{props.name(c().target_owner_id)}</bdi>
        </dd>
        <dt>
          <Trans>Reason</Trans>
        </dt>
        <dd>
          {labels.category[c().category].name}
          <Show when={c().subcategory}>
            {(sub) => <> · {labels.subcategory[sub()] ?? sub()}</>}
          </Show>
        </dd>
        <Show when={c().channel_type}>
          <dt>
            <Trans>Where</Trans>
          </dt>
          <dd>
            {c().channel_type}
            <Show when={c().server_id}>
              {(id) => (
                <>
                  {" · "}
                  <bdi dir="ltr">{id()}</bdi>
                </>
              )}
            </Show>
          </dd>
        </Show>
        <dt>
          <Trans>Reporter</Trans>
        </dt>
        <dd>
          <Show
            when={c().public_reporter}
            fallback={<bdi>{props.name(c().reporter_id)}</bdi>}
          >
            {(who) => (
              <>
                <Trans>Without an account</Trans>
                {": "}
                <bdi>{who().name ?? "-"}</bdi>
                {" · "}
                <bdi dir="ltr">
                  {/* a reporter's address stays off screen in streamer mode */}
                  {state.settings.streamerMode ? "•••@•••" : (who().email ?? "-")}
                </bdi>
                {" · "}
                <bdi dir="auto">{who().location}</bdi>
                <Show when={who().law}>
                  {" · "}
                  <bdi dir="auto">{who().law}</bdi>
                </Show>
              </>
            )}
          </Show>
        </dd>
        <dt>
          <Trans>Assigned</Trans>
        </dt>
        <dd>
          <bdi>{props.name(c().assignee_id)}</bdi>
        </dd>
        <dt>
          <Trans>Filed</Trans>
        </dt>
        <dd>
          <time>{formatDate(c().created_at)}</time>
        </dd>
        <Show when={c().description}>
          <dt>
            <Trans>Reporter says</Trans>
          </dt>
          {/* plain text, never HTML */}
          <dd dir="auto">{c().description}</dd>
        </Show>
      </Summary>

      <Section>
        <strong>
          <Trans>Evidence</Trans>
        </strong>
        <Notice>
          <Trans>
            Snapshot taken when the report was filed. It stays even if the
            content is deleted, until its retention ends. Opening this case is
            recorded.
          </Trans>
        </Notice>
        <Show when={c().legal_hold && !props.details.evidence.length}>
          <ErrorText role="status" data-testid="hold-without-copy">
            <Trans>
              Legal hold is on, but no copy of this content exists. It could not
              be found, or this kind of content cannot be copied. Keep your own
              record of it.
            </Trans>
          </ErrorText>
        </Show>
        <For each={props.details.evidence}>
          {(item) => (
            <Evidence>
              <header>
                <Pill>{labels.kind[item.kind]}</Pill>
                <Show when={item.title}>
                  {(title) => <strong dir="auto">{title()}</strong>}
                </Show>
                <Show when={item.author_id}>
                  {(author) => (
                    <small>
                      <bdi>{props.name(author())}</bdi>
                    </small>
                  )}
                </Show>
                <Show when={item.legal_hold}>
                  <Pill data-tone="warn">
                    <Trans>Legal hold</Trans>
                  </Pill>
                </Show>
              </header>
              <For
                each={(item.context ?? []).filter((m) => m.id < item.object_id)}
              >
                {(m) => (
                  <Context>
                    <bdi>{props.name(m.author_id)}</bdi>:{" "}
                    <span dir="auto">{m.content}</span>
                  </Context>
                )}
              </For>
              <Show when={item.content}>
                {(content) => <Content dir="auto">{content()}</Content>}
              </Show>
              <For
                each={(item.context ?? []).filter((m) => m.id > item.object_id)}
              >
                {(m) => (
                  <Context>
                    <bdi>{props.name(m.author_id)}</bdi>:{" "}
                    <span dir="auto">{m.content}</span>
                  </Context>
                )}
              </For>
              <Show when={item.files?.length}>
                <ul>
                  <For each={item.files ?? []}>
                    {(file) => (
                      <li>
                        <Icon name="file-text" size={14} />
                        <bdi dir="auto">{file.filename}</bdi>
                        <small>
                          {file.content_type} · {Math.ceil(file.size / 1024)} KB
                        </small>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={Object.keys(item.metadata ?? {}).length}>
                <Meta>
                  <For each={Object.entries(item.metadata ?? {})}>
                    {([key, value]) => (
                      <span>
                        {key}: <bdi dir="auto">{value}</bdi>
                      </span>
                    )}
                  </For>
                </Meta>
              </Show>
            </Evidence>
          )}
        </For>
      </Section>

      <Section>
        <strong>
          <Trans>Triage</Trans>
        </strong>
        <Buttons>
          <Show when={c().assignee_id !== me()}>
            <button
              type="button"
              disabled={props.busy}
              onClick={() =>
                void props.run(async () =>
                  props.onChanged(
                    await safetyApi.edit(client(), c()._id, {
                      assignee_id: me(),
                      version: c().version,
                    }),
                  ),
                )
              }
            >
              <Trans>Assign to me</Trans>
            </button>
          </Show>
          <Show when={c().assignee_id}>
            <button
              type="button"
              disabled={props.busy}
              onClick={() =>
                void props.run(async () =>
                  props.onChanged(
                    await safetyApi.edit(client(), c()._id, {
                      assignee_id: "",
                      version: c().version,
                    }),
                  ),
                )
              }
            >
              <Trans>Unassign</Trans>
            </button>
          </Show>
          <FloatingSelect
            aria-label={t`Priority`}
            value={c().priority}
            disabled={props.busy}
            onChange={(e) => {
              const value = e.currentTarget.value as SafetyPriority;
              void props.run(async () =>
                props.onChanged(
                  await safetyApi.edit(client(), c()._id, {
                    priority: value,
                    version: c().version,
                  }),
                ),
              );
            }}
          >
            <For each={PRIORITIES}>
              {(value) => (
                <MenuItem value={value}>{labels.priority[value]}</MenuItem>
              )}
            </For>
          </FloatingSelect>
          <Show when={props.access.manage}>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => {
                const hold = !c().legal_hold;
                if (
                  hold &&
                  !confirm(
                    t`Keep this evidence past its retention period? Only do this when legally required.`,
                  )
                )
                  return;
                void props.run(() =>
                  safetyApi.edit(client(), c()._id, {
                    legal_hold: hold,
                    version: c().version,
                  }),
                );
              }}
            >
              {c().legal_hold
                ? t`Lift legal hold`
                : t`Legal hold`}
            </button>
          </Show>
        </Buttons>

        <Field>
          <span>
            <Trans>Message to the reporter (more information, decision)</Trans>
          </span>
          <textarea
            dir="auto"
            maxLength={500}
            value={publicNote()}
            onInput={(e) => setPublicNote(e.currentTarget.value)}
          />
        </Field>
        <Field>
          <span>
            <Trans>Internal note (reviewers only)</Trans>
          </span>
          <textarea
            dir="auto"
            maxLength={2000}
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
        <Buttons>
          <button
            type="button"
            disabled={props.busy || !note().trim()}
            onClick={() =>
              void props.run(async () => {
                await safetyApi.note(client(), c()._id, note().trim());
                setNote("");
              })
            }
          >
            <Trans>Add note</Trans>
          </button>
          <For each={nextStatuses(c().status)}>
            {(status) => (
              <button
                type="button"
                data-primary={status === "UnderReview" || undefined}
                disabled={props.busy}
                onClick={() => void setStatus(status)}
              >
                {labels.status[status]}
              </button>
            )}
          </For>
        </Buttons>

        <Show when={!decided()}>
          <Inline>
            <input
              dir="ltr"
              placeholder={t`Original case id`}
              value={duplicateOf()}
              onInput={(e) => setDuplicateOf(e.currentTarget.value)}
            />
            <button
              type="button"
              disabled={props.busy || !duplicateOf().trim()}
              onClick={() =>
                void props.run(async () => {
                  const marked = await safetyApi.edit(client(), c()._id, {
                    duplicate_of: duplicateOf().trim(),
                    version: c().version,
                  });
                  await safetyApi.setStatus(client(), c()._id, {
                    status: "Duplicate",
                    version: marked.version,
                  });
                  setDuplicateOf("");
                })
              }
            >
              <Trans>Mark as duplicate</Trans>
            </button>
          </Inline>
        </Show>
      </Section>

      <Show
        when={
          props.access.action && (!decided() || c().status === "ActionTaken")
        }
      >
        <Section>
          <strong>
            <Trans>Take action</Trans>
          </strong>
          <Notice>
            <Trans>
              Actions are never automatic. Check the evidence first. The
              affected user sees only the reason below, never the reporter or
              your notes.
            </Trans>
          </Notice>
          <Inline>
            <FloatingSelect
              aria-label={t`Action`}
              value={actionKind()}
              onChange={(e) =>
                setActionKind(e.currentTarget.value as SafetyActionKind)
              }
            >
              <For each={actionsFor(c().target.kind)}>
                {(value) => (
                  <MenuItem
                    value={value}
                    disabled={value === "BanAccount" && !props.access.manage}
                  >
                    {labels.action[value]}
                  </MenuItem>
                )}
              </For>
            </FloatingSelect>
            <Show when={actionKind() === "SuspendAccount"}>
              <input
                type="number"
                min={1}
                max={365}
                aria-label={t`Days`}
                value={days()}
                onInput={(e) => setDays(Number(e.currentTarget.value) || 1)}
              />
            </Show>
          </Inline>
          <Field>
            <span>
              <Trans>Reason shown to the user</Trans>
            </span>
            <textarea
              dir="auto"
              maxLength={500}
              value={reason()}
              onInput={(e) => setReason(e.currentTarget.value)}
            />
          </Field>
          <Field>
            <span>
              <Trans>Facts shown to the user</Trans>
            </span>
            <textarea
              dir="auto"
              maxLength={1000}
              value={facts()}
              onInput={(e) => setFacts(e.currentTarget.value)}
            />
            <small>
              <Trans>
                What happened, in short plain sentences, in the user's
                language if you can. No internal ids.
              </Trans>
            </small>
          </Field>
          <Inline role="group" aria-label={t`Ground`}>
            <button
              type="button"
              aria-pressed={groundType() === "Terms"}
              data-primary={groundType() === "Terms" || undefined}
              onClick={() => setGroundType("Terms")}
            >
              <Trans>Breaks our rules</Trans>
            </button>
            <button
              type="button"
              aria-pressed={groundType() === "Law"}
              data-primary={groundType() === "Law" || undefined}
              onClick={() => setGroundType("Law")}
            >
              <Trans>Illegal under a law</Trans>
            </button>
          </Inline>
          <Show when={groundType() === "Law"}>
            <Field>
              <span>
                <Trans>Law</Trans>
              </span>
              <input
                dir="auto"
                maxLength={200}
                value={law()}
                onInput={(e) => setLaw(e.currentTarget.value)}
              />
            </Field>
            <Field>
              <span>
                <Trans>Provision</Trans>
              </span>
              <input
                dir="auto"
                maxLength={200}
                value={provision()}
                onInput={(e) => setProvision(e.currentTarget.value)}
              />
            </Field>
          </Show>
          <Inline role="group" aria-label={t`Where it applies`}>
            <button
              type="button"
              aria-pressed={!limitedScope()}
              data-primary={!limitedScope() || undefined}
              onClick={() => setLimitedScope(false)}
            >
              <Trans>Worldwide</Trans>
            </button>
            <button
              type="button"
              aria-pressed={limitedScope()}
              data-primary={limitedScope() || undefined}
              onClick={() => setLimitedScope(true)}
            >
              <Trans>Only some countries</Trans>
            </button>
          </Inline>
          <Show when={limitedScope()}>
            <Field>
              <span>
                <Trans>Countries</Trans>
              </span>
              <input
                dir="auto"
                maxLength={200}
                value={countries()}
                onInput={(e) => setCountries(e.currentTarget.value)}
              />
            </Field>
          </Show>
          <Field>
            <span>
              <Trans>Automation</Trans>
            </span>
            <label>
              <input
                type="checkbox"
                checked={autoDetected()}
                onChange={(e) => setAutoDetected(e.currentTarget.checked)}
              />{" "}
              <Trans>Automated tools found this content</Trans>
            </label>
            <label>
              <input
                type="checkbox"
                checked={autoDecided()}
                onChange={(e) => setAutoDecided(e.currentTarget.checked)}
              />{" "}
              <Trans>The decision was made by automated means</Trans>
            </label>
          </Field>
          <Field>
            <span>
              <Trans>Internal note</Trans>
            </span>
            <textarea
              dir="auto"
              maxLength={2000}
              value={internal()}
              onInput={(e) => setInternal(e.currentTarget.value)}
            />
          </Field>
          <Buttons>
            <button
              type="button"
              data-danger
              disabled={props.busy}
              onClick={() => void takeAction()}
            >
              <Trans>Apply action</Trans>
            </button>
          </Buttons>
        </Section>
      </Show>

      <Show when={props.details.actions.length}>
        <Section>
          <strong>
            <Trans>Actions</Trans>
          </strong>
          <For each={props.details.actions}>
            {(action) => (
              <Evidence>
                <header>
                  <strong>{labels.action[action.kind]}</strong>
                  <small>
                    <bdi>{props.name(action.actor_id)}</bdi> ·{" "}
                    <time>{formatDate(action.created_at)}</time>
                  </small>
                  <Show when={action.revoked}>
                    <Pill data-tone="ok">
                      <Trans>Reversed</Trans>
                    </Pill>
                  </Show>
                </header>
                <p dir="auto">{action.public_reason}</p>
                <Show when={action.internal_note}>
                  {(text) => <Context dir="auto">{text()}</Context>}
                </Show>
                <Show when={!action.revoked && props.access.action}>
                  <Buttons>
                    <button
                      type="button"
                      disabled={props.busy}
                      onClick={() => {
                        const why = prompt(
                          t`Why are you reversing this action?`,
                        );
                        if (!why || why.trim().length < 3) return;
                        void props.run(() =>
                          safetyApi.revoke(client(), action._id, why.trim()),
                        );
                      }}
                    >
                      <Trans>Reverse</Trans>
                    </button>
                  </Buttons>
                </Show>
              </Evidence>
            )}
          </For>
        </Section>
      </Show>

      <Show when={props.details.related.length}>
        <Section>
          <strong>
            <Trans>Other reports about this</Trans>
          </strong>
          <ul>
            <For each={props.details.related}>
              {(other) => (
                <li>
                  <bdi dir="ltr">{other.reference}</bdi> ·{" "}
                  {labels.category[other.category].name} ·{" "}
                  {labels.status[other.status]}
                </li>
              )}
            </For>
          </ul>
        </Section>
      </Show>

      <Section>
        <strong>
          <Trans>History</Trans>
        </strong>
        <ol>
          <For each={props.details.log}>
            {(entry) => (
              <li>
                <time>{formatDate(entry.created_at)}</time>
                <span>
                  <bdi>
                    {entry.actor_id === "system"
                      ? t`System`
                      : props.name(entry.actor_id)}
                  </bdi>
                </span>
                <strong>{entry.event}</strong>
                <Show when={entry.from || entry.to}>
                  <span>
                    {entry.from ?? ""} → {entry.to ?? ""}
                  </span>
                </Show>
                <Show when={entry.text}>
                  {(text) => <q dir="auto">{text()}</q>}
                </Show>
              </li>
            )}
          </For>
        </ol>
      </Section>
    </Stack>
  );
}

function AppealCard(props: {
  appeal: SafetyAppeal;
  access: SafetyAccess;
  name: (id?: string) => string;
  onDecided: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const labels = useSafetyLabels();
  const describeError = useError();
  const [note, setNote] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function decide(overturn: boolean) {
    if (busy()) return;
    if (note().trim().length < 3) {
      setError(t`Write the answer the user will see.`);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await safetyApi.decideAppeal(client(), props.appeal._id, {
        overturn,
        note: note().trim(),
      });
      props.onDecided();
    } catch (failure) {
      setError(
        safetyErrorType(failure) === "MissingPlatformPermission"
          ? t`Another reviewer must decide appeals against your own actions.`
          : describeError(failure),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Evidence>
      <header>
        <Pill data-tone="accent">{labels.appeal[props.appeal.status]}</Pill>
        <small>
          <bdi>{props.name(props.appeal.user_id)}</bdi> ·{" "}
          <time>{formatDate(props.appeal.created_at)}</time>
        </small>
      </header>
      <Content dir="auto">{props.appeal.statement}</Content>
      <Show when={props.access.action && props.appeal.status === "Pending"}>
        <Field>
          <span>
            <Trans>Answer to the user</Trans>
          </span>
          <textarea
            dir="auto"
            maxLength={1000}
            value={note()}
            onInput={(e) => setNote(e.currentTarget.value)}
          />
        </Field>
        <Show when={error()}>
          <ErrorText role="alert">{error()}</ErrorText>
        </Show>
        <Buttons>
          <button
            type="button"
            disabled={busy()}
            onClick={() => void decide(false)}
          >
            <Trans>Keep the action</Trans>
          </button>
          <button
            type="button"
            data-primary
            disabled={busy()}
            onClick={() => void decide(true)}
          >
            <Trans>Overturn and reverse</Trans>
          </button>
        </Buttons>
      </Show>
    </Evidence>
  );
}

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    // sized to its content: an empty queue is a short window, a long one
    // scrolls inside the dialog's height cap
    color: "var(--z-fg-primary)",
  },
});

const Tabs = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    "& button": {
      height: "32px",
      paddingInline: "14px",
      border: "none",
      borderRadius: "999px",
      background: "transparent",
      color: "var(--z-fg-secondary)",
      font: "inherit",
      fontWeight: 650,
      cursor: "pointer",
    },
    "& button[aria-selected='true']": {
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
    },
    "& small": {
      marginInlineStart: "auto",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Filters = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    // each menu takes a share of the row and wraps on narrow screens
    "& > div": { flex: "1 1 150px", width: "auto", minWidth: 0 },
    "& input": {
      height: "32px",
      paddingInline: "8px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      flex: "1 1 180px",
      minWidth: 0,
    },
  },
});

const Bulk = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "12px",
    background: "color-mix(in srgb, var(--z-accent) 10%, transparent)",
    fontSize: "13px",
  },
});

const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 340px) minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
    "@media (max-width: 760px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Queue = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "68vh",
    overflowY: "auto",
  },
});

const QueueRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "8px",
    borderRadius: "10px",
    border: "1px solid transparent",
    "&[aria-current]": {
      borderColor: "var(--z-accent)",
      background: "color-mix(in srgb, var(--z-accent) 8%, transparent)",
    },
    "& input": { marginTop: "4px" },
    "& > button": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: "3px",
      border: "none",
      background: "transparent",
      color: "inherit",
      font: "inherit",
      textAlign: "start",
      cursor: "pointer",
      padding: 0,
    },
    "& [data-top]": {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
    },
    "& strong": { fontSize: "14px" },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Pager = styled("div", {
  base: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "6px",
    "& button": {
      height: "28px",
      paddingInline: "10px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "8px",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      cursor: "pointer",
      _disabled: { opacity: 0.4, cursor: "default" },
    },
  },
});

const Panel = styled("div", {
  base: {
    minWidth: 0,
    maxHeight: "72vh",
    overflowY: "auto",
    padding: "12px",
    borderRadius: "14px",
    background: "color-mix(in srgb, var(--z-bg-input) 45%, transparent)",
  },
});

const CaseHead = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    "& h3": { margin: 0, fontSize: "16px" },
  },
});

const Section = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& > strong": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-secondary)",
    },
    "& ol, & ul": {
      margin: 0,
      paddingInlineStart: "18px",
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      fontSize: "13px",
    },
    "& li": { display: "flex", flexWrap: "wrap", gap: "6px" },
    "& time": { color: "var(--z-fg-muted)" },
    "& q": { color: "var(--z-fg-secondary)" },
  },
});

const Evidence = styled("article", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    "& header": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
    "& p": { margin: 0, fontSize: "14px", overflowWrap: "anywhere" },
    "& ul": {
      margin: 0,
      paddingInlineStart: "4px",
      listStyle: "none",
      fontSize: "13px",
    },
  },
});

const Content = styled("div", {
  base: {
    padding: "8px 10px",
    borderRadius: "8px",
    background: "var(--z-bg-input)",
    fontSize: "14px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

const Context = styled("div", {
  base: {
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
});

const Meta = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Inline = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    "& input, & select": {
      height: "32px",
      paddingInline: "8px",
      borderRadius: "var(--z-radius, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
    },
    "& input": { flex: "1 1 160px", minWidth: 0 },
    "& button": {
      height: "32px",
      paddingInline: "12px",
      border: "1px solid var(--z-border-subtle)",
      borderRadius: "var(--z-radius, 10px)",
      background: "transparent",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      cursor: "pointer",
      _disabled: { opacity: 0.5 },
    },
  },
});
