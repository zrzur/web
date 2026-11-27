import {
  ErrorBoundary,
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Button,
  Checkbox,
  FloatingSelect,
  MenuItem,
  Segmented,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  type CommunityItem,
  type CommunityKind,
  type CommunityPermissions,
  COMMUNITY_MAX_DIMENSION,
  CREATOR_TERMS_VERSION,
  communityApi,
  communityErrorType,
  isDailyLimit,
} from "../communityApi";

import { type PreviewPlace, LivePreview, PREVIEW_PLACES } from "./LivePreview";
import {
  type PackItem,
  type PackProblem,
  PACK_MAX_ITEMS,
  designsLeft,
  kindOfItem,
  packItems,
  packProblem,
  packTooBig,
} from "./packModel";
import {
  Actions,
  Callout,
  Crumbs,
  Page,
  PageHead,
  useStudioWords,
} from "./parts";
import { Bar } from "./StudioEditor";
import { type RightsAnswers, emptyRights, rightsInput } from "./studioModel";
import { ZipError, listZip, readZipEntry } from "./zip";

const CREATOR_TERMS_URL = "https://zrzur.com/legal/creator-terms";

type Sent = "waiting" | "sending" | "sent" | "failed" | "limit";

type Row = PackItem & {
  /** a picture of it, once taken out of the archive */
  url?: string;
  sent?: Sent;
  error?: string;
};

/** Bytes of full pictures a pack keeps for its previews */
const PICTURE_BUDGET = 150_000_000;

/** A small still picture of a design, for the previews of a big pack */
async function still(bitmap: ImageBitmap) {
  const scale = Math.min(1, 192 / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(bitmap.width * scale)),
    Math.max(1, Math.round(bitmap.height * scale)),
  );
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.convertToBlob({ type: "image/png" });
}

/** Plain rate limits are waited out; a refusal is not */
async function patiently<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const { status, type, retryAfter } = (error ?? {}) as {
        status?: number;
        type?: string;
        retryAfter?: number;
      };
      const plain = !type || type === "Unknown" || type === "RateLimited";
      if (status !== 429 || !plain || attempt >= 6) throw error;
      await new Promise((done) =>
        setTimeout(done, Math.min(30_000, retryAfter ?? 2_000)),
      );
    }
  }
}

/**
 * A pack of ready designs from one ZIP: every image in it is listed with
 * its picture, a name to edit and its type, checked by the same rules as a
 * single design, and sent one after another as drafts or published.
 */
export function StudioPack(props: {
  perms: CommunityPermissions;
  /** designs the creator keeps now (not withdrawn) */
  kept: number;
  effects: boolean;
  frames: boolean;
  dialog: boolean;
  onLeave: () => void;
  onBack: () => void;
  /** the creator's own picture and name, for the preview */
  avatar?: string;
  name: string;
  /** the designs that were made, newest first */
  onSent: (items: CommunityItem[]) => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const err = useError();
  const words = useStudioWords();

  const [archive, setArchive] = createSignal<File>();
  const [rows, setRows] = createStore<Row[]>([]);
  const [packKind, setPackKind] = createSignal<CommunityKind>("decorations");
  const [failure, setFailure] = createSignal<string>();
  const [cut, setCut] = createSignal(false);
  const [reading, setReading] = createSignal(false);
  const [sending, setSending] = createSignal<"drafts" | "publish">();
  const [finished, setFinished] = createSignal(false);
  const [publish, setPublish] = createSignal(false);
  const [rights, setRights] = createSignal<RightsAnswers>(emptyRights());
  const [dragging, setDragging] = createSignal(false);
  /** the design shown in the preview (its path in the archive) */
  const [looking, setLooking] = createSignal<string>();
  const [place, setPlace] = createSignal<PreviewPlace>();

  /** what this pack is still read for; a new pick stops the old reading */
  let reads = 0;
  let input: HTMLInputElement | undefined;

  const urls = new Set<string>();
  const forget = () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
  };
  onCleanup(forget);

  const kinds = createMemo(() => {
    const open: CommunityKind[] = ["decorations", "nameplates"];
    if (props.effects) open.push("effects");
    if (props.frames) open.push("frames");
    return open;
  });

  const kindOf = (row: Row) => kindOfItem(row, packKind());
  const problemOf = (row: Row): PackProblem | "closed" | undefined =>
    kinds().includes(kindOf(row)) ? packProblem(row, kindOf(row)) : "closed";

  // what was sent already is never sent twice
  const chosen = () => rows.filter((row) => row.include && row.sent !== "sent");
  const ready = () => chosen().filter((row) => !problemOf(row));
  const blocked = () => chosen().length - ready().length;
  const left = () => designsLeft(props.perms, props.kept);
  /** what will go out: as many ready ones as the limits allow */
  const going = () => {
    const room = left();
    return room === undefined ? ready() : ready().slice(0, room);
  };
  const over = () => ready().length - going().length;
  const hasEffect = () => going().some((row) => kindOf(row) === "effects");
  const promise = () => rightsInput(rights());
  const counts = () => ({
    sent: rows.filter((row) => row.sent === "sent").length,
    failed: rows.filter((row) => row.sent === "failed").length,
    limit: rows.filter((row) => row.sent === "limit").length,
  });

  async function open(file: File | undefined) {
    if (!file || sending()) return;
    const read = ++reads;
    forget();
    setRows([]);
    setFailure(undefined);
    setFinished(false);
    setCut(false);
    setArchive(file);
    setReading(true);
    try {
      const entries = await listZip(file);
      if (read !== reads) return;
      const items = packItems(entries);
      setCut(packTooBig(entries));
      if (!items.length) {
        setFailure(t`No designs in this ZIP. Use PNG, GIF or WebP files.`);
        return;
      }
      setRows(items);
      // pictures and sizes, one file at a time: a big pack never sits in
      // memory at once
      // the first ~150 MB keep their own picture (it moves, as it will on
      // a profile); after that a small still one, so a pack of any size
      // stays light
      let kept = 0;
      for (const [index, item] of items.entries()) {
        if (read !== reads) return;
        if (item.entry.size > 8_000_000 || item.entry.encrypted) {
          setRows(index, { width: 0, height: 0 });
          continue;
        }
        try {
          const blob = await readZipEntry(file, item.entry, item.type);
          if (read !== reads) return;
          const bitmap = await createImageBitmap(blob);
          const size = { width: bitmap.width, height: bitmap.height };
          let shown: Blob = blob;
          if (kept + blob.size > PICTURE_BUDGET) {
            shown = await still(bitmap);
          } else {
            kept += blob.size;
          }
          bitmap.close();
          const url = URL.createObjectURL(shown);
          urls.add(url);
          setRows(index, { url, ...size });
        } catch {
          setRows(index, { width: 0, height: 0 });
        }
      }
    } catch (error) {
      if (read !== reads) return;
      setArchive(undefined);
      setFailure(
        error instanceof ZipError && error.reason === "not-zip"
          ? t`That isn't a ZIP file.`
          : t`This ZIP can't be read. It may be damaged.`,
      );
    } finally {
      if (read === reads) setReading(false);
    }
  }

  async function send() {
    const file = archive();
    const list = going();
    const publishing = publish();
    if (!file || !list.length || sending()) return;
    if (publishing && !promise()) return;
    setSending(publishing ? "publish" : "drafts");
    setFinished(false);
    const made: CommunityItem[] = [];
    const ids = new Set(list.map((row) => row.id));
    setRows(
      produce((all) => {
        for (const row of all) {
          row.error = undefined;
          row.sent = ids.has(row.id) ? "waiting" : undefined;
        }
      }),
    );

    const at = (id: string) => rows.findIndex((row) => row.id === id);
    let stopped = false;
    for (const row of list) {
      const index = at(row.id);
      if (stopped) {
        setRows(index, "sent", "limit");
        continue;
      }
      setRows(index, "sent", "sending");
      const kind = kindOf(row);
      try {
        const blob = await readZipEntry(file, row.entry, row.type);
        const upload = new File(
          [blob],
          row.entry.path.split("/").pop() ?? "design",
          { type: row.type },
        );
        const fileId = await patiently(() =>
          client().uploadFile(
            kind === "effects" ? "effects" : "decorations",
            upload,
            instance.mediaUrl,
          ),
        );
        const item = await patiently(() =>
          communityApi.create(client(), kind, {
            name: row.name.trim(),
            file: fileId,
            submit: publishing,
            ...(publishing ? { rights: promise() } : {}),
          }),
        );
        made.unshift(item);
        setRows(index, "sent", "sent");
      } catch (error) {
        const type = communityErrorType(error);
        if (isDailyLimit(error) || type === "TooManyCommunityItems") {
          stopped = true;
          setRows(index, { sent: "limit" });
        } else {
          setRows(index, { sent: "failed", error: err(error) });
        }
      }
    }
    setSending(undefined);
    setFinished(true);
    if (made.length) props.onSent(made);
  }

  const problemWords = (problem: PackProblem | "closed") =>
    ({
      name: t`Name needs 2 to 32 characters`,
      type: t`Format not allowed`,
      size: t`File too large`,
      "webm-size": t`File too large`,
      dimension: t`Larger than ${COMMUNITY_MAX_DIMENSION} px`,
      shape: t`Must be 9:16`,
      "frame-size": t`Must be 800 × 1020 px`,
      unreadable: t`Can't be read`,
      closed: t`This type isn't open yet`,
    })[problem];

  const kindWords = (kind: CommunityKind) => words.kind(kind);

  const allOn = () => rows.length > 0 && rows.every((row) => row.include);
  const someOn = () => rows.some((row) => row.include);
  const toggleAll = (on: boolean) =>
    setRows(
      produce((all) => {
        for (const row of all) if (row.sent !== "sent") row.include = on;
      }),
    );
  const unlimited = () => !!props.perms.unlimited_designs;

  const limitText = () =>
    unlimited()
      ? t`No limits`
      : props.perms.max_designs_per_day
        ? `${props.perms.designs_today ?? 0} / ${props.perms.max_designs_per_day}`
        : `${props.kept} / ${props.perms.max_designs ?? 50}`;

  /** what the preview shows: the design picked, else the first one */
  const shown = () =>
    rows.find((row) => row.id === looking() && row.url) ??
    rows.find((row) => row.url);
  const look = (row: Row) => {
    setLooking(row.id);
    setPlace(undefined);
  };
  const placesOf = (row: Row) => PREVIEW_PLACES[kindOf(row)];
  const placeOf = (row: Row) => {
    const wanted = place();
    return wanted && placesOf(row).includes(wanted) ? wanted : placesOf(row)[0];
  };
  const placeWords = (id: PreviewPlace) =>
    ({
      profile: t`Profile`,
      members: t`Member list`,
      message: t`Message`,
      sizes: t`Sizes`,
    })[id];

  const yesNo = (value: boolean | undefined) =>
    value === undefined ? undefined : value ? "yes" : "no";

  return (
    <Page data-dialog={props.dialog ? "" : undefined} data-testid="studio-pack">
      <Show when={!props.dialog}>
        <Crumbs aria-label={t`You are here`}>
          <button type="button" onClick={() => props.onLeave()}>
            <Trans>Designs</Trans>
          </button>
          <span aria-hidden="true">/</span>
          <button type="button" onClick={() => props.onBack()}>
            <Trans>Creator Studio</Trans>
          </button>
          <span aria-hidden="true">/</span>
          <b>
            <Trans>Upload pack</Trans>
          </b>
        </Crumbs>
      </Show>

      <PageHead>
        <div>
          <h1>
            <Trans>Upload pack</Trans>
          </h1>
        </div>
      </PageHead>

      <input
        ref={input}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        hidden
        data-testid="pack-input"
        onChange={(event) => {
          void open(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <Layout>
        <Body
          data-over={dragging() ? "" : undefined}
          onDragOver={(event: DragEvent) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event: DragEvent) => {
            if (
              !(event.currentTarget as HTMLElement).contains(
                event.relatedTarget as Node | null,
              )
            )
              setDragging(false);
          }}
          onDrop={(event: DragEvent) => {
            event.preventDefault();
            setDragging(false);
            void open(event.dataTransfer?.files?.[0]);
          }}
        >
          <SettingsSection title={<Trans>Pack</Trans>}>
            <SettingsRow
              icon={<Icon name="archive" size={20} />}
              title={
                <Show
                  when={archive()}
                  fallback={<Trans>Drop your ZIP file here</Trans>}
                >
                  {(file) => <bdi>{file().name}</bdi>}
                </Show>
              }
              description={
                <Show
                  when={reading()}
                  fallback={<Trans>PNG, animated PNG, GIF or WebP</Trans>}
                >
                  <Trans>Reading…</Trans>
                </Show>
              }
              control={() => (
                <Button
                  variant={archive() ? "tonal" : "filled"}
                  data-testid="pack-choose"
                  isDisabled={!!sending()}
                  onPress={() => input?.click()}
                >
                  <Show
                    when={archive()}
                    fallback={<Trans>Choose a file</Trans>}
                  >
                    <Trans>Choose another</Trans>
                  </Show>
                </Button>
              )}
            />
            <SettingsRow
              icon={<Icon name="squares-four" size={20} />}
              title={<Trans>Type</Trans>}
              description={<Trans>For files outside a type folder</Trans>}
              control={(ids) => (
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={packKind()}
                  disabled={!!sending()}
                  onChange={(event) =>
                    setPackKind(event.currentTarget.value as CommunityKind)
                  }
                >
                  <For each={kinds()}>
                    {(kind) => (
                      <MenuItem value={kind}>{kindWords(kind)}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              )}
            />
            <SettingsRow
              icon={<Icon name="paper-plane-tilt" size={20} />}
              title={<Trans>Send as</Trans>}
              control={(ids) => (
                <Segmented
                  aria-labelledby={ids.labelId}
                  value={publish() ? "publish" : "drafts"}
                  onChange={(value) => setPublish(value === "publish")}
                  options={[
                    { value: "drafts", label: t`Drafts` },
                    { value: "publish", label: t`Publish` },
                  ]}
                />
              )}
            />
            <SettingsRow
              icon={<Icon name={unlimited() ? "crown" : "clock"} size={20} />}
              title={
                <Show
                  when={unlimited() || !props.perms.max_designs_per_day}
                  fallback={<Trans>Made today</Trans>}
                >
                  <Trans>Of your design limit</Trans>
                </Show>
              }
              control={() => (
                <Figure data-testid="pack-limit" dir="auto">
                  <bdi dir={unlimited() ? undefined : "ltr"}>{limitText()}</bdi>
                </Figure>
              )}
            />
          </SettingsSection>

          <Show when={failure()}>
            <Callout tone="error">{failure()!}</Callout>
          </Show>
          <Show when={cut()}>
            <Callout tone="warning">
              <Trans>Only the first {PACK_MAX_ITEMS} designs are listed.</Trans>
            </Callout>
          </Show>

          <Show when={rows.length}>
            <SettingsSection
              title={<Trans>Designs</Trans>}
              aside={
                <Head>
                  <Count>
                    {chosen().length + counts().sent} / {rows.length}
                  </Count>
                  <Checkbox
                    data-testid="pack-all"
                    checked={allOn()}
                    indeterminate={someOn() && !allOn()}
                    disabled={!!sending()}
                    onChange={(event) => toggleAll(event.currentTarget.checked)}
                  >
                    <Trans>Select all</Trans>
                  </Checkbox>
                </Head>
              }
            >
              <Grid role="list">
                <For each={rows}>
                  {(row, index) => (
                    <Card
                      role="listitem"
                      data-off={row.include ? undefined : ""}
                      data-bad={row.include && problemOf(row) ? "" : undefined}
                      data-sent={row.sent}
                    >
                      <Picture
                        role="button"
                        tabIndex={0}
                        aria-label={t`Preview ${row.name}`}
                        aria-pressed={shown()?.id === row.id}
                        data-looking={shown()?.id === row.id ? "" : undefined}
                        onClick={() => look(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            look(row);
                          }
                        }}
                      >
                        <Show
                          when={row.url}
                          fallback={<Icon name="image" size={24} />}
                        >
                          <img src={row.url} alt="" />
                        </Show>
                        <Look aria-hidden="true">
                          <Icon name="eye" size={16} />
                        </Look>
                        <Pick onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            aria-label={t`Include ${row.name}`}
                            checked={row.include}
                            disabled={!!sending() || row.sent === "sent"}
                            onChange={(event) =>
                              setRows(
                                index(),
                                "include",
                                event.currentTarget.checked,
                              )
                            }
                          />
                        </Pick>
                      </Picture>
                      <input
                        class="name"
                        aria-label={t`Name`}
                        dir="auto"
                        maxLength={32}
                        value={row.name}
                        disabled={!!sending() || row.sent === "sent"}
                        onInput={(event) =>
                          setRows(index(), "name", event.currentTarget.value)
                        }
                      />
                      <FloatingSelect
                        aria-label={t`Type`}
                        value={kindOf(row)}
                        disabled={!!sending() || row.sent === "sent"}
                        onChange={(event) =>
                          setRows(
                            index(),
                            "kind",
                            event.currentTarget.value as CommunityKind,
                          )
                        }
                      >
                        <For each={kinds()}>
                          {(kind) => (
                            <MenuItem value={kind}>{kindWords(kind)}</MenuItem>
                          )}
                        </For>
                      </FloatingSelect>
                      <State>
                        <Switch
                          fallback={
                            <Show
                              when={row.include && problemOf(row)}
                              fallback={
                                <span>
                                  <Show
                                    when={row.width}
                                    fallback={<Trans>Ready</Trans>}
                                  >
                                    <bdi dir="ltr">
                                      {row.width} × {row.height}
                                    </bdi>
                                  </Show>
                                </span>
                              }
                            >
                              {(problem) => (
                                <span data-tone="bad">
                                  {problemWords(problem())}
                                </span>
                              )}
                            </Show>
                          }
                        >
                          <Match when={row.sent === "waiting"}>
                            <span>
                              <Trans>Waiting</Trans>
                            </span>
                          </Match>
                          <Match when={row.sent === "sending"}>
                            <span>
                              <Trans>Sending…</Trans>
                            </span>
                          </Match>
                          <Match when={row.sent === "sent"}>
                            <span data-tone="sent">
                              <Icon name="check" size={14} />{" "}
                              <Trans>Sent</Trans>
                            </span>
                          </Match>
                          <Match when={row.sent === "limit"}>
                            <span data-tone="bad">
                              <Trans>Limit reached</Trans>
                            </span>
                          </Match>
                          <Match when={row.sent === "failed"}>
                            <span data-tone="bad" title={row.error}>
                              {row.error ?? t`Failed`}
                            </span>
                          </Match>
                        </Switch>
                      </State>
                    </Card>
                  )}
                </For>
              </Grid>
            </SettingsSection>
          </Show>

          <Show when={publish() && rows.length}>
            <SettingsSection title={<Trans>Rights</Trans>}>
              <SettingsRow
                title={<Trans>Did you make this work?</Trans>}
                control={(ids) => (
                  <Segmented
                    aria-labelledby={ids.labelId}
                    value={rights().own ?? ("" as "mine")}
                    onChange={(value) =>
                      setRights((now) => ({
                        ...now,
                        own: value,
                        others: value === "licensed" ? undefined : now.others,
                      }))
                    }
                    options={[
                      { value: "mine", label: t`Yes, I made it myself` },
                      {
                        value: "licensed",
                        label: t`I hold a licence to share it`,
                      },
                    ]}
                  />
                )}
              />
              <Show when={rights().own !== "licensed"}>
                <SettingsRow
                  title={<Trans>Does it include parts made by others?</Trans>}
                  control={(ids) => (
                    <Segmented
                      aria-labelledby={ids.labelId}
                      value={yesNo(rights().others) ?? ("" as "no")}
                      onChange={(value) =>
                        setRights((now) => ({
                          ...now,
                          others: value === "yes",
                        }))
                      }
                      options={[
                        { value: "no", label: t`No` },
                        { value: "yes", label: t`Yes` },
                      ]}
                    />
                  )}
                />
              </Show>
              <Show when={rights().own === "licensed" || rights().others}>
                <SettingsRow
                  title={<Trans>Source and licence</Trans>}
                  control={(ids) => (
                    <TextInput
                      aria-labelledby={ids.labelId}
                      maxLength={280}
                      value={rights().othersText}
                      onInput={(event) =>
                        setRights((now) => ({
                          ...now,
                          othersText: event.currentTarget.value,
                        }))
                      }
                    />
                  )}
                />
              </Show>
              <SettingsRow
                title={<Trans>Does it include parts made with AI tools?</Trans>}
                control={(ids) => (
                  <Segmented
                    aria-labelledby={ids.labelId}
                    value={yesNo(rights().ai) ?? ("" as "no")}
                    onChange={(value) =>
                      setRights((now) => ({ ...now, ai: value === "yes" }))
                    }
                    options={[
                      { value: "no", label: t`No` },
                      { value: "yes", label: t`Yes` },
                    ]}
                  />
                )}
              />
              <Show when={rights().ai}>
                <SettingsRow
                  title={<Trans>Which parts and which tool</Trans>}
                  control={(ids) => (
                    <TextInput
                      aria-labelledby={ids.labelId}
                      maxLength={280}
                      value={rights().aiText}
                      onInput={(event) =>
                        setRights((now) => ({
                          ...now,
                          aiText: event.currentTarget.value,
                        }))
                      }
                    />
                  )}
                />
              </Show>
              <Confirm>
                <Checkbox
                  checked={rights().confirmed}
                  onChange={(event) =>
                    setRights((now) => ({
                      ...now,
                      confirmed: event.currentTarget.checked,
                    }))
                  }
                >
                  <Show
                    when={hasEffect()}
                    fallback={
                      <Trans>
                        I confirm this is true, the work shows no real person
                        without their consent, and I accept the{" "}
                        <a
                          href={CREATOR_TERMS_URL}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Creator Terms
                        </a>{" "}
                        (version {CREATOR_TERMS_VERSION}).
                      </Trans>
                    }
                  >
                    <Trans>
                      I confirm this is true, the work shows no real person, and
                      I accept the{" "}
                      <a
                        href={CREATOR_TERMS_URL}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Creator Terms
                      </a>{" "}
                      (version {CREATOR_TERMS_VERSION}).
                    </Trans>
                  </Show>
                </Checkbox>
              </Confirm>
            </SettingsSection>
          </Show>
          {/* under everything, never over the designs */}
          <Bar style={{ position: "static" }}>
            <Summary role="status">
              <Show when={blocked() > 0}>
                <Plural
                  value={blocked()}
                  one="# needs fixing"
                  other="# need fixing"
                />
              </Show>
              <Show when={blocked() > 0 && over() > 0}>{" · "}</Show>
              <Show when={over() > 0}>
                <Plural
                  value={over()}
                  one="# over your limit"
                  other="# over your limit"
                />
              </Show>
              <Show when={finished()}>
                <Show when={blocked() > 0 || over() > 0}>{" · "}</Show>
                <Trans>
                  {counts().sent} sent, {counts().failed} failed
                </Trans>
              </Show>
            </Summary>
            <Actions>
              <Button
                variant="text"
                isDisabled={!!sending()}
                onPress={() => props.onBack()}
              >
                <Trans>Back</Trans>
              </Button>
              <Button
                variant="filled"
                data-testid="pack-send"
                isDisabled={
                  !!sending() ||
                  reading() ||
                  !going().length ||
                  (publish() && !promise())
                }
                onPress={() => void send()}
              >
                <Switch
                  fallback={
                    <Show
                      when={publish()}
                      fallback={
                        <Plural
                          value={going().length}
                          one="Save # draft"
                          other="Save # drafts"
                        />
                      }
                    >
                      <Plural
                        value={going().length}
                        one="Publish # design"
                        other="Publish # designs"
                      />
                    </Show>
                  }
                >
                  <Match when={sending()}>
                    <Trans>
                      Sending {counts().sent + counts().failed + 1} of{" "}
                      {going().length}…
                    </Trans>
                  </Match>
                </Switch>
              </Button>
            </Actions>
          </Bar>
        </Body>

        <Aside>
          <AsideTitle>
            <Trans>Preview</Trans>
          </AsideTitle>
          <Show
            when={shown()}
            fallback={
              <Empty>
                <Icon name="sparkle" size={28} />
                <span>
                  <Trans>Your designs show up here</Trans>
                </span>
              </Empty>
            }
          >
            {(row) => (
              <PreviewBox>
                <Show when={placesOf(row()).length > 1}>
                  <Places>
                    <Segmented
                      aria-label={t`Where it shows`}
                      value={placeOf(row())}
                      onChange={setPlace}
                      options={placesOf(row()).map((id) => ({
                        value: id,
                        label: placeWords(id),
                      }))}
                    />
                  </Places>
                </Show>
                {/* a fresh try for each design and place: one that failed
                    does not keep the others from showing */}
                <Show
                  when={row().url && `${row().url}|${placeOf(row())}`}
                  keyed
                >
                  {(_key) => (
                    <ErrorBoundary
                      fallback={(error: unknown) => {
                        console.warn("Pack preview failed", error);
                        return (
                          <Empty>
                            <img src={row().url} alt="" class="art" />
                          </Empty>
                        );
                      }}
                    >
                      <LivePreview
                        kind={kindOf(row())}
                        url={row().url!}
                        place={placeOf(row())}
                        ground="dark"
                        avatar={props.avatar}
                        name={props.name}
                      />
                    </ErrorBoundary>
                  )}
                </Show>
                <Caption>
                  <strong dir="auto">{row().name || "—"}</strong>
                  <span>{kindWords(kindOf(row()))}</span>
                </Caption>
              </PreviewBox>
            )}
          </Show>
        </Aside>
      </Layout>
    </Page>
  );
}

/** the settings Profile page: sections on the start side, the preview beside */
const Layout = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: "32px",
    alignItems: "start",
  },
});

const Aside = styled("aside", {
  base: {
    position: "sticky",
    insetBlockStart: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
});

const AsideTitle = styled("h2", {
  base: {
    margin: 0,
    paddingInline: "2px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const PreviewBox = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    boxShadow: "var(--z-box-shadow)",
    // the preview's own stage fits the column
    "& [data-testid='studio-preview']": {
      minHeight: "360px",
      padding: "32px 16px",
    },
  },
});

const Places = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
    padding: "12px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
  },
});

const Caption = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "& strong": {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
    },
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    minHeight: "360px",
    padding: "24px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background:
      "radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--z-accent-fill) 12%, transparent), transparent 70%), var(--z-box-bg)",
    color: "var(--z-fg-muted)",
    fontSize: "14px",
    "--z-icon-color": "var(--z-accent-text)",
    "& .art": { maxWidth: "70%", maxHeight: "300px", objectFit: "contain" },
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
    width: "100%",
    borderRadius: "var(--z-box-radius)",
    outline: "2px dashed transparent",
    outlineOffset: "8px",
    transition: "outline-color 120ms",
    "&[data-over]": { outlineColor: "var(--z-focus)" },
  },
});

const Figure = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--z-fg-primary)",
  },
});

const Head = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "16px" },
});

const TextInput = styled("input", {
  base: {
    width: "260px",
    height: "36px",
    paddingInline: "10px",
    borderRadius: "var(--z-radius-sm, 8px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "14px",
    _focusVisible: { outline: "2px solid var(--z-focus)" },
  },
});

const Confirm = styled("div", {
  base: {
    padding: "14px 16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    fontSize: "14px",
  },
});

const Count = styled("span", {
  base: {
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    fontVariantNumeric: "tabular-nums",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
    gap: "12px",
    padding: "16px",
  },
});

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    padding: "8px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    transition: "opacity 120ms, border-color 120ms",
    "&[data-off]": { opacity: 0.45 },
    "&[data-bad]": { borderColor: "var(--z-danger)" },
    "&[data-sent='sent']": { borderColor: "var(--z-status-success)" },
    "& .name": {
      width: "100%",
      height: "32px",
      paddingInline: "8px",
      borderRadius: "var(--z-radius-sm, 8px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-sidebar)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "13px",
      fontWeight: 600,
      minWidth: 0,
      _focusVisible: { outline: "2px solid var(--z-focus)" },
    },
    "& > button, & > div > button": { width: "100%" },
  },
});

const Picture = styled("div", {
  base: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    aspectRatio: "1",
    borderRadius: "var(--z-radius-sm, 8px)",
    overflow: "hidden",
    cursor: "pointer",
    color: "var(--z-fg-muted)",
    outline: "2px solid transparent",
    outlineOffset: "-2px",
    transition: "outline-color 120ms",
    "&[data-looking]": { outlineColor: "var(--z-accent-fill)" },
    _focusVisible: { outlineColor: "var(--z-focus)" },
    // a checkerboard shows what is transparent
    backgroundColor: "var(--z-bg-sidebar)",
    backgroundImage:
      "conic-gradient(color-mix(in srgb, var(--z-fg-primary) 6%, transparent) 25%, transparent 0 50%, color-mix(in srgb, var(--z-fg-primary) 6%, transparent) 0 75%, transparent 0)",
    backgroundSize: "16px 16px",
    "& img": {
      maxWidth: "100%",
      maxHeight: "100%",
      objectFit: "contain",
    },
  },
});

/** shown on hover and on the design in the preview: it opens there */
const Look = styled("span", {
  base: {
    position: "absolute",
    insetBlockStart: "6px",
    insetInlineEnd: "6px",
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "color-mix(in srgb, #000 55%, transparent)",
    color: "#fff",
    opacity: 0,
    transition: "opacity 120ms",
    "--z-icon-color": "currentColor",
    "[role='button']:hover > &, [role='button']:focus-visible > &, [data-looking] > &":
      { opacity: 1 },
    // touch: the tile shows it opens a preview
    "@media (hover: none)": { opacity: 1 },
  },
});

const Pick = styled("div", {
  base: {
    position: "absolute",
    insetBlockStart: "6px",
    insetInlineStart: "6px",
  },
});

const State = styled("div", {
  base: {
    minHeight: "18px",
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    "& [data-tone='bad']": { color: "var(--z-danger)" },
    "& [data-tone='sent']": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      color: "var(--z-status-success)",
      "--z-icon-color": "currentColor",
    },
  },
});

const Summary = styled("span", {
  base: { fontSize: "13px", color: "var(--z-fg-muted)" },
});
