import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { Avatar, Checkbox, Dialog, Segmented, Toggle } from "@revolt/ui";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import { useEffectsAllowed } from "@revolt/ui/components/features/profiles/effects/ProfileEffect";
import { NAMEPLATES } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import {
  COMMUNITY_MAX_DIMENSION,
  COMMUNITY_TYPES,
  CREATOR_TERMS_VERSION,
  CommunityItem,
  CommunityKind,
  CommunityPermissions,
  StudioTab,
  artFit,
  can,
  checkCommunityFile,
  communityApi,
  effectProblem,
  isRankRefusal,
  kindOf,
  parseTags,
  studioBuckets,
} from "./communityApi";
import {
  CommunityImage,
  DecorationArt,
  EffectArt,
  Field,
  NameplateArt,
  StatusBadge,
  useCommunityPermissions,
  useConfirm,
  useDate,
} from "./CommunityParts";
import { CreatorSuspension } from "./CreatorSuspension";
import { TemplateWords, downloadTemplate, plateMarks } from "./studioTemplates";

const CREATOR_TERMS_URL = "https://zrzur.com/legal/creator-terms";

/** Avatar sizes the live preview shows a decoration at */
const PREVIEW_SIZES = [24, 40, 64, 96];
const PLATE_MARKS = plateMarks();

/**
 * Creator Studio: a creator's own designs in every state, and the form to
 * submit a new one or revise an existing one. Only for users staff made
 * creators; the server checks again on every request.
 */
export function CreatorStudio(props: {
  show: boolean;
  onClose: () => void;
  perms: CommunityPermissions;
  avatar?: string;
  name: string;
  /** a full page inside Designs instead of a window */
  page?: boolean;
}) {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const confirm = useConfirm();
  const access = useCommunityPermissions();

  const [view, setView] = createSignal<"mine" | "new">("mine");
  const [bucket, setBucket] = createSignal<StudioTab>("drafts");
  const [editing, setEditing] = createSignal<CommunityItem>();
  const [startKind, setStartKind] = createSignal<CommunityKind>("decorations");
  // an image dropped on a start card goes straight onto the bench
  const [dropped, setDropped] = createSignal<File>();
  const [error, setError] = createSignal<string>();
  // only creators have designs; a visitor has no session to ask with
  const [mine, { refetch, mutate }] = createResource(
    () => !!props.perms.creator,
    () => communityApi.mine(client()),
  );
  const buckets = createMemo(() =>
    studioBuckets(mine.error ? [] : (mine() ?? [])),
  );
  const canSubmit = () => can(props.perms, "cosmetics.submit");
  // suspended: they see their designs and change nothing (owner, 2026-11-06)
  const readOnly = () =>
    !!props.perms.creator && props.perms.creator !== "Active";
  const suspended = () => props.perms.creator === "Suspended";
  const wornBy = () =>
    buckets().published.reduce((sum, item) => sum + (item.popularity ?? 0), 0);

  const tabs = () =>
    [
      { id: "drafts", label: t`Drafts` },
      { id: "published", label: t`Published` },
    ] as const;

  function replace(item: CommunityItem) {
    mutate((list) => {
      const rest = (list ?? []).filter((entry) => entry._id !== item._id);
      return item.status === "Archived" ? rest : [item, ...rest];
    });
  }

  async function run(action: () => Promise<CommunityItem>) {
    setError(undefined);
    try {
      replace(await action());
    } catch (failure) {
      setError(describeError(failure));
      if (isRankRefusal(failure)) access.refresh();
    }
  }

  // words printed on the template images, in the person's language
  const guide = (): TemplateWords => ({
    avatar: t`Avatar`,
    keepClear: t`Avatar (keep clear)`,
    around: t`Draw around the circle`,
    name: t`Name`,
    cropped: t`Cropped`,
    ltrLanguages: t`Left-to-right languages`,
    rtlLanguages: t`Right-to-left languages`,
    fullFromHere: t`Fully seen from here`,
    fullUpToHere: t`Fully seen up to here`,
    bothDirections: t`Seen in both directions, never fully`,
    effectText: t`Keep this readable: leave it mostly transparent`,
    effectRules: t`4 seconds, one play, no flashing`,
  });
  const direction = () =>
    document.documentElement.dir === "rtl" ? "rtl" : ("ltr" as const);

  function start(kind: CommunityKind, file?: File) {
    setEditing(undefined);
    setStartKind(kind);
    setDropped(file);
    setView("new");
  }

  /** the words on a start card, by kind */
  const starters = (): {
    kind: CommunityKind;
    title: string;
    text: string;
  }[] => [
    {
      kind: "decorations",
      title: t`Avatar decoration`,
      text: t`A frame drawn over the avatar. Square image, 1024 × 1024 px. The avatar fills the middle two thirds, so leave that circle transparent.`,
    },
    {
      kind: "nameplates",
      title: t`Nameplate`,
      text: t`Shown behind the name in the member list. 1024 × 192 px; 16 px are cropped at the top and bottom. It fades toward the avatar, on the left or the right by language; the image itself never flips.`,
    },
    {
      kind: "effects",
      title: t`Profile effect`,
      text: t`A transparent animation that plays once over a profile. 576 × 1024 px, up to 4 seconds, up to 2 MB. Reviewers look at it before it goes live.`,
    },
  ];

  const content = (
    <Body data-page={props.page ? "" : undefined}>
      {/* on the bench the canvas gets the page */}
      <Show when={view() === "mine"}>
        <StudioHead>
          <div>
            {/* as a page, Designs gives it the title and these words */}
            <Show when={!props.page}>
              <p>
                <Trans>
                  Make decorations, nameplates and effects for everyone. Designs
                  go live with your name on them; effects go to a reviewer
                  first, and reviewers can take down anything that breaks the
                  rules.
                </Trans>
              </p>
            </Show>
          </div>
          <Stats>
            <Stat>
              <strong>{buckets().published.length}</strong>
              <span>
                <Trans>Published</Trans>
              </span>
            </Stat>
            <Stat>
              <strong>{buckets().drafts.length}</strong>
              <span>
                <Trans>Drafts</Trans>
              </span>
            </Stat>
            <Stat>
              <strong>{wornBy()}</strong>
              <span>
                <Trans>Worn by</Trans>
              </span>
            </Stat>
          </Stats>
        </StudioHead>
      </Show>

      <Show when={props.perms.creator === "Revoked"}>
        <Banner role="status">
          <Icon name="info" size={16} />
          <Trans>
            You're no longer a creator. Your published designs stay up, but you
            can't submit new ones.
          </Trans>
        </Banner>
      </Show>

      <Show when={suspended()}>
        <CreatorSuspension />
      </Show>

      <Show when={view() === "mine" && !props.perms.creator}>
        <Banner role="status">
          <Icon name="info" size={16} />
          <Trans>
            Publishing is open to verified creators. Anyone can download a
            template and test an image here; nothing is uploaded.
          </Trans>
        </Banner>
      </Show>

      <Show when={error()}>
        <ErrorText role="alert">{error()}</ErrorText>
      </Show>

      <Switch>
        <Match when={view() === "new" && !readOnly()}>
          <BackLink type="button" onClick={() => setView("mine")}>
            <Icon name="arrow-left" size={16} />
            <Show when={props.perms.creator} fallback={<Trans>Back</Trans>}>
              <Trans>Your designs</Trans>
            </Show>
          </BackLink>
          <SubmissionForm
            item={editing()}
            kind={startKind()}
            file={dropped()}
            canSubmit={canSubmit()}
            avatar={props.avatar}
            name={props.name}
            onDone={(item) => {
              replace(item);
              setBucket(
                item.status === "Published" && !item.pending
                  ? "published"
                  : "drafts",
              );
              setView("mine");
            }}
            onCancel={() => setView("mine")}
          />
        </Match>
        <Match when={true}>
          <Show when={!readOnly()}>
            <StudioSection>
              <h2>
                <Trans>Start a design</Trans>
              </h2>
              <Starters>
                <For each={starters()}>
                  {(starter) => (
                    <Starter
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.dataset.over = "true";
                      }}
                      onDragLeave={(e) => delete e.currentTarget.dataset.over}
                      onDrop={(e) => {
                        e.preventDefault();
                        delete e.currentTarget.dataset.over;
                        const file = e.dataTransfer?.files[0];
                        if (file) start(starter.kind, file);
                      }}
                    >
                      <StarterArt>
                        <TemplatePreview
                          kind={starter.kind}
                          avatar={props.avatar}
                          name={props.name}
                        />
                      </StarterArt>
                      <StarterText>
                        <strong>{starter.title}</strong>
                        <span>{starter.text}</span>
                      </StarterText>
                      <StarterActions>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadTemplate(
                              starter.kind,
                              guide(),
                              direction(),
                            )
                          }
                        >
                          <Icon name="download-simple" size={16} />
                          <Trans>Template</Trans>
                        </button>
                        <button
                          type="button"
                          data-primary={canSubmit() ? "" : undefined}
                          onClick={() => start(starter.kind)}
                        >
                          <Icon name="upload-simple" size={16} />
                          <Show
                            when={canSubmit()}
                            fallback={<Trans>Test an image</Trans>}
                          >
                            <Trans>Upload design</Trans>
                          </Show>
                        </button>
                      </StarterActions>
                    </Starter>
                  )}
                </For>
              </Starters>
              <Hint>
                <Trans>
                  Templates are guides: draw on a copy, then export without the
                  guide marks. PNG, animated PNG, GIF or WebP, up to 2.5 MB and
                  1024 px on each side, or a WebM of up to 8 MB. Animations play
                  up to 12 seconds.
                </Trans>
              </Hint>
              <Hint>
                <Trans>
                  Effects play once, with no sound and a transparent background.
                  Animated PNG, GIF, WebP or WebM only. Files set to repeat,
                  files that flash, and files that cover more than half of the
                  profile are refused automatically.
                </Trans>
              </Hint>
              <Hint>
                <Trans>
                  A WebM becomes an animated image when you upload it: its
                  transparency stays, its sound is dropped, and the image must
                  fit the limits above.
                </Trans>
              </Hint>
            </StudioSection>
          </Show>

          <Show when={props.perms.creator}>
            <StudioSection>
              <h2>
                <Trans>Your designs</Trans>
              </h2>
              <Tabs role="tablist" aria-label={t`Your designs`}>
                <For each={tabs()}>
                  {(tab) => (
                    <Tab
                      type="button"
                      role="tab"
                      aria-selected={bucket() === tab.id}
                      onClick={() => setBucket(tab.id)}
                    >
                      {tab.label}
                      <span>{buckets()[tab.id].length}</span>
                    </Tab>
                  )}
                </For>
              </Tabs>
              <Switch>
                <Match when={mine.loading}>
                  <Empty>
                    <Trans>Loading…</Trans>
                  </Empty>
                </Match>
                <Match when={mine.error}>
                  <Empty>
                    <Trans>Your designs couldn't be loaded.</Trans>
                    <button type="button" onClick={() => void refetch()}>
                      <Trans>Try again</Trans>
                    </button>
                  </Empty>
                </Match>
                <Match when={true}>
                  <Designs>
                    <For
                      each={buckets()[bucket()]}
                      fallback={
                        <Empty>
                          <Show
                            when={bucket() === "drafts"}
                            fallback={<Trans>Nothing published yet.</Trans>}
                          >
                            <Show
                              when={canSubmit()}
                              fallback={<Trans>No drafts.</Trans>}
                            >
                              <Trans>
                                No drafts. Start a design above and save it as a
                                draft to finish later.
                              </Trans>
                            </Show>
                          </Show>
                        </Empty>
                      }
                    >
                      {(item) => {
                        const revision = () =>
                          bucket() !== "published" ? item.pending : undefined;
                        const status = () => revision()?.status ?? item.status;
                        const note = () =>
                          revision()
                            ? revision()!.review_note
                            : item.review_note;
                        const editable = () =>
                          canSubmit() && item.status !== "Suspended";
                        return (
                          <DesignCard>
                            <DesignArt
                              data-wide={
                                item.kind === "Nameplate" ? "" : undefined
                              }
                              data-tall={
                                item.kind === "Effect" ? "" : undefined
                              }
                            >
                              <CommunityImage
                                item={item}
                                file={revision()?.file}
                                private={suspended()}
                              >
                                {(url) =>
                                  item.kind === "Decoration" ? (
                                    <DecorationArt
                                      url={url}
                                      avatar={props.avatar}
                                      name={props.name}
                                      size={64}
                                    />
                                  ) : item.kind === "Effect" ? (
                                    <EffectArt url={url} label={item.name} />
                                  ) : (
                                    <NameplateArt
                                      url={url}
                                      avatar={props.avatar}
                                      name={props.name}
                                    />
                                  )
                                }
                              </CommunityImage>
                            </DesignArt>
                            <Info>
                              <strong>
                                <bdi>{revision()?.name ?? item.name}</bdi>
                              </strong>
                              <span>
                                <StatusBadge status={status()} />
                                <Show when={revision()}>
                                  <small>
                                    <Trans>
                                      New version {revision()!.revision}
                                    </Trans>
                                  </small>
                                </Show>
                                <Show when={item.status === "Published"}>
                                  <small>
                                    <Trans>Worn by {item.popularity}</Trans>
                                  </small>
                                </Show>
                                <Show when={item.published_at}>
                                  <small>{date(item.published_at)}</small>
                                </Show>
                              </span>
                              <Show when={note()}>
                                <Note dir="auto">
                                  <Icon name="chat-circle" size={14} />
                                  {note()}
                                </Note>
                              </Show>
                            </Info>
                            <Show when={readOnly()}>
                              <RowActions>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void communityApi
                                      .download(client(), item._id)
                                      .catch(() =>
                                        setError(
                                          t`The copy could not be downloaded.`,
                                        ),
                                      )
                                  }
                                >
                                  <Icon name="download-simple" size={14} />
                                  <Trans>Download a copy</Trans>
                                </button>
                              </RowActions>
                            </Show>
                            <Show when={!readOnly()}>
                              <RowActions>
                                <Show when={editable()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditing(item);
                                      setView("new");
                                    }}
                                  >
                                    <Icon name="pencil-simple" size={14} />
                                    <Trans>Edit</Trans>
                                  </button>
                                </Show>
                                <Show
                                  when={
                                    canSubmit() &&
                                    bucket() === "drafts" &&
                                    status() !== "PendingReview"
                                  }
                                >
                                  <button
                                    type="button"
                                    data-primary
                                    onClick={() =>
                                      void run(() =>
                                        communityApi.submit(client(), item._id),
                                      )
                                    }
                                  >
                                    <Icon name="rocket-launch" size={14} />
                                    <Show
                                      when={item.kind === "Effect"}
                                      fallback={<Trans>Publish</Trans>}
                                    >
                                      <Trans>Send for review</Trans>
                                    </Show>
                                  </button>
                                </Show>
                                <Show when={item.status !== "Archived"}>
                                  <button
                                    type="button"
                                    data-danger={confirm.armed() === item._id}
                                    title={t`Archive`}
                                    onClick={() => {
                                      if (confirm.press(item._id))
                                        void run(() =>
                                          communityApi.archive(
                                            client(),
                                            item._id,
                                          ),
                                        );
                                    }}
                                  >
                                    <Icon name="archive" size={14} />
                                    <Show
                                      when={confirm.armed() === item._id}
                                      fallback={<Trans>Archive</Trans>}
                                    >
                                      <Trans>Archive?</Trans>
                                    </Show>
                                  </button>
                                </Show>
                              </RowActions>
                            </Show>
                          </DesignCard>
                        );
                      }}
                    </For>
                  </Designs>
                </Match>
              </Switch>
            </StudioSection>
          </Show>
        </Match>
      </Switch>
    </Body>
  );

  return (
    <Show
      when={props.page}
      fallback={
        <Dialog
          tone="create"
          iconName="sparkle"
          show={props.show}
          onClose={props.onClose}
          title={<Trans>Creator Studio</Trans>}
          size="xl"
        >
          {content}
        </Dialog>
      }
    >
      {content}
    </Show>
  );
}

/** What a template is for, shown with a real decoration or nameplate */
function TemplatePreview(props: {
  kind: CommunityKind;
  avatar?: string;
  name: string;
}) {
  return (
    <Show
      when={props.kind === "decorations"}
      fallback={
        <Show
          when={props.kind === "nameplates"}
          fallback={<Icon name="sparkle" size={48} />}
        >
          <PlateSample
            style={{
              background: NAMEPLATES.find((plate) => plate.id === "sunset")
                ?.background,
            }}
          >
            <Avatar size={32} src={props.avatar} fallback={props.name} />
            <span dir="auto">{props.name}</span>
          </PlateSample>
        </Show>
      }
    >
      <AvatarDecoration decoration="laurel" size={72}>
        <Avatar size={72} src={props.avatar} fallback={props.name} />
      </AvatarDecoration>
    </Show>
  );
}

/**
 * The bench: a new design, or a change to one of yours. The image lies
 * large on a canvas beside the form, on every size and on dark or light,
 * with the guide marks one switch away, before anything is uploaded.
 */
function SubmissionForm(props: {
  item?: CommunityItem;
  /** type chosen on the Studio start cards */
  kind?: CommunityKind;
  /** an image dropped on a start card */
  file?: File;
  /** false: test an image only, nothing can be saved */
  canSubmit: boolean;
  avatar?: string;
  name: string;
  onDone: (item: CommunityItem) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const access = useCommunityPermissions();

  /* eslint-disable solid/reactivity */
  const source = props.item?.pending ?? props.item;
  const [kind, setKind] = createSignal<CommunityKind>(
    props.item ? kindOf(props.item) : (props.kind ?? "decorations"),
  );
  const isEffect = () => kind() === "effects";
  // never ticked for them: a new promise for each effect (L-20)
  const [promised, setPromised] = createSignal(false);
  const [thirdParty, setThirdParty] = createSignal("");
  const [aiParts, setAiParts] = createSignal("");
  const [name, setName] = createSignal(source?.name ?? "");
  const [description, setDescription] = createSignal(source?.description ?? "");
  const [tags, setTags] = createSignal((source?.tags ?? []).join(", "));
  /* eslint-enable solid/reactivity */
  const [file, setFile] = createSignal<File>();
  const [preview, setPreview] = createSignal<string>();
  const [size, setSize] = createSignal<{ width: number; height: number }>();
  const [problem, setProblem] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [ground, setGround] = createSignal<"dark" | "light">("dark");
  const [guides, setGuides] = createSignal(false);
  const [over, setOver] = createSignal(false);

  onCleanup(() => {
    const url = preview();
    if (url) URL.revokeObjectURL(url);
  });

  let input!: HTMLInputElement;

  function pick(picked: File | undefined) {
    setProblem(undefined);
    if (!picked) return;
    const issue = checkCommunityFile(picked, kind());
    if (issue === "type") {
      setProblem(t`Use a PNG, animated PNG, GIF, WebP or WebM file.`);
      return;
    }
    if (issue === "webm-size") {
      setProblem(t`That WebM is too big. The limit is 8 MB.`);
      return;
    }
    if (issue === "size") {
      setProblem(
        isEffect()
          ? t`That effect is too big. The limit is 2 MB.`
          : t`That image is too big. The limit is 2.5 MB.`,
      );
      return;
    }
    const url = URL.createObjectURL(picked);
    // a video can't be measured or shown as an image: the server makes the
    // image when it is uploaded
    if (picked.type === "video/webm") {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        const old = preview();
        if (old) URL.revokeObjectURL(old);
        setFile(picked);
        setPreview(url);
        setSize({ width: video.videoWidth, height: video.videoHeight });
        if (!name()) setName(picked.name.replace(/\.[^.]+$/, "").slice(0, 32));
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        setProblem(
          t`That WebM can't be read. Export it again and try once more.`,
        );
      };
      video.src = url;
      return;
    }
    const image = new Image();
    image.onload = () => {
      if (
        image.naturalWidth > COMMUNITY_MAX_DIMENSION ||
        image.naturalHeight > COMMUNITY_MAX_DIMENSION
      ) {
        URL.revokeObjectURL(url);
        setProblem(
          t`That image is too large. Keep it within ${COMMUNITY_MAX_DIMENSION} × ${COMMUNITY_MAX_DIMENSION} pixels.`,
        );
        return;
      }
      const old = preview();
      if (old) URL.revokeObjectURL(old);
      setFile(picked);
      setPreview(url);
      setSize({ width: image.naturalWidth, height: image.naturalHeight });
      if (!name()) setName(picked.name.replace(/\.[^.]+$/, "").slice(0, 32));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setProblem(t`That file isn't an image we can read.`);
    };
    image.src = url;
  }

  onMount(() => pick(props.file));

  const fit = () => {
    const known = size();
    return known ? artFit(kind(), known.width, known.height) : undefined;
  };
  const hasImage = () => !!file() || !!props.item;
  const ready = () => name().trim().length >= 2 && hasImage();
  // an effect with a new file, or going to review, carries the promise
  const needsPromise = (submit: boolean) => isEffect() && (submit || !!file());

  /** plain words for what the machine check found */
  const effectRefusal = (failure: unknown) => {
    switch (effectProblem(failure)) {
      case "flashing":
        return t`This effect flashes too much to be safe for people with photosensitive epilepsy. Keep to 3 flashes a second or fewer, or make the flashing part smaller.`;
      case "too_solid":
        return t`This effect covers too much of the profile. Keep at least half of each frame transparent so text stays readable.`;
      case "blank":
        return t`There's nothing to see in this file. Every frame is transparent.`;
      case "unreadable":
        return t`This file couldn't be checked, so it can't be used. Export it again and try once more.`;
      case "not_animated":
        return t`An effect has to move. This file has only one frame.`;
      case "repeats":
        return t`This file is set to repeat. Export it to play once.`;
      case "too_fast":
        return t`Some frames are too short. Each frame must show for at least 33 ms.`;
      case "shape":
        return t`An effect has the shape of a profile: 9 by 16, such as 576 × 1024 px.`;
      case "too_many_frames":
        return t`This effect has too many frames. The limit is 120.`;
      case "too_long":
        return t`This effect is too long. The limit is 4 seconds.`;
      case "too_many_pixels":
        return t`That image is too large. Keep it within ${COMMUNITY_MAX_DIMENSION} × ${COMMUNITY_MAX_DIMENSION} pixels.`;
      case "webm":
        return t`That WebM can't be read. Use VP8 or VP9, at most ${COMMUNITY_MAX_DIMENSION} px on each side, and export it again.`;
      case "webm_slow":
        return t`That WebM couldn't be turned into an image in time. Try a shorter one, or try again in a moment.`;
      default:
        return undefined;
    }
  };

  async function save(submit: boolean) {
    if (!ready()) return;
    if (needsPromise(submit) && !promised()) {
      setProblem(t`Confirm that you may share this effect first.`);
      return;
    }
    setBusy(true);
    setProblem(undefined);
    try {
      const uploaded = file()
        ? await client().uploadFile(
            isEffect() ? "effects" : "decorations",
            file()!,
            instance.mediaUrl,
          )
        : undefined;
      const body = {
        name: name().trim(),
        description: description().trim(),
        tags: parseTags(tags()),
        submit,
        ...(isEffect() && promised()
          ? {
              rights: {
                confirmed: true,
                terms_version: CREATOR_TERMS_VERSION,
                third_party: thirdParty().trim() || undefined,
                ai_parts: aiParts().trim() || undefined,
              },
            }
          : {}),
      };
      const item = props.item
        ? await communityApi.edit(client(), props.item._id, {
            ...body,
            file: uploaded,
          })
        : await communityApi.create(client(), kind(), {
            ...body,
            file: uploaded!,
          });
      props.onDone(item);
    } catch (failure) {
      setProblem(effectRefusal(failure) ?? describeError(failure));
      if (isRankRefusal(failure)) access.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** the art in every place it will be seen */
  const canvas = (url: string) => (
    <>
      <CanvasTools>
        <Segmented
          aria-label={t`Background`}
          value={ground()}
          onChange={setGround}
          options={[
            { value: "dark", label: t`On dark` },
            { value: "light", label: t`On light` },
          ]}
        />
        <GuideSwitch>
          <span id="studio-guides">
            <Trans>Guide marks</Trans>
          </span>
          <Toggle
            checked={guides()}
            onChange={() => setGuides(!guides())}
            aria-labelledby="studio-guides"
          />
        </GuideSwitch>
      </CanvasTools>
      <PreviewArt
        url={url}
        video={file()?.type === "video/webm"}
        kind={kind()}
        avatar={props.avatar}
        name={props.name}
        guides={guides()}
      />
      <CanvasFoot>
        <button type="button" onClick={() => input.click()}>
          <Icon name="upload-simple" size={16} />
          <Trans>Replace the image</Trans>
        </button>
        <Show when={size()}>
          {(known) => (
            <small dir="ltr">
              {known().width} × {known().height}
            </small>
          )}
        </Show>
      </CanvasFoot>
    </>
  );

  return (
    <Form>
      <Canvas
        aria-label={t`Preview`}
        data-ground={ground()}
        data-over={over()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer?.files[0]);
        }}
      >
        <Show
          when={preview()}
          fallback={
            <Show
              when={props.item}
              fallback={
                <Drop type="button" onClick={() => input.click()}>
                  <Icon name="upload-simple" size={24} />
                  <strong>
                    <Trans>Drop your image here</Trans>
                  </strong>
                  <span>
                    <Trans>or choose a file</Trans>
                  </span>
                  <small>
                    <Trans>
                      PNG, animated PNG, GIF, WebP or WebM · up to 2.5 MB, WebM
                      8 MB · {COMMUNITY_MAX_DIMENSION} px
                    </Trans>
                  </small>
                </Drop>
              }
            >
              {(item) => (
                <CommunityImage item={item()} file={item().pending?.file}>
                  {(url) => canvas(url)}
                </CommunityImage>
              )}
            </Show>
          }
        >
          {(url) => canvas(url())}
        </Show>
      </Canvas>
      <input
        ref={input}
        type="file"
        accept={COMMUNITY_TYPES.join(",")}
        hidden
        onChange={(e) => {
          pick(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <Sheet>
        <Show when={!props.item}>
          <Field label={<Trans>Type</Trans>}>
            <Segmented
              aria-label={t`Type`}
              value={kind()}
              onChange={setKind}
              options={[
                { value: "decorations", label: t`Avatar decoration` },
                { value: "nameplates", label: t`Nameplate` },
                { value: "effects", label: t`Profile effect` },
              ]}
            />
          </Field>
        </Show>
        <Show when={props.item?.status === "Published"}>
          <Hint>
            <Show
              when={isEffect()}
              fallback={
                <Trans>
                  Publishing replaces the live version straight away, also for
                  people wearing it. Save a draft to keep working on it first.
                </Trans>
              }
            >
              <Trans>
                The live version stays up until a reviewer approves the new one.
              </Trans>
            </Show>
          </Hint>
        </Show>
        <Field
          label={<Trans>Name</Trans>}
          hint={<Counter value={name()} limit={32} />}
        >
          <input
            value={name()}
            maxLength={32}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </Field>
        <Field
          label={<Trans>Description</Trans>}
          hint={<Counter value={description()} limit={280} />}
        >
          <textarea
            rows={3}
            maxLength={280}
            value={description()}
            onInput={(e) => setDescription(e.currentTarget.value)}
          />
        </Field>
        <Field
          label={<Trans>Tags</Trans>}
          hint={<Trans>Up to 8, separated by commas</Trans>}
        >
          <input
            value={tags()}
            onInput={(e) => setTags(e.currentTarget.value)}
          />
        </Field>

        <Checks aria-label={t`Before you publish`}>
          <Check on={hasImage()}>
            <Trans>An image is on the canvas</Trans>
          </Check>
          <Check on={name().trim().length >= 2}>
            <Trans>It has a name of at least 2 letters</Trans>
          </Check>
          <Show when={fit()}>
            <Advice role="status">
              <Icon name="warning-circle" size={16} />
              <Show
                when={fit() === "square"}
                fallback={
                  <Show
                    when={fit() === "tall"}
                    fallback={
                      <Trans>
                        This image is not wide enough for a nameplate; it will
                        be cropped. 1024 × 192 px fits best.
                      </Trans>
                    }
                  >
                    <Trans>
                      An effect has the shape of a profile: 9 by 16, such as 576
                      × 1024 px.
                    </Trans>
                  </Show>
                }
              >
                <Trans>
                  This image is not square, so it will look stretched around the
                  avatar. 1024 × 1024 px fits best.
                </Trans>
              </Show>
            </Advice>
          </Show>
        </Checks>

        <Show when={isEffect() && props.canSubmit}>
          <Field
            label={<Trans>Parts made by others</Trans>}
            hint={<Trans>Who made them and under which licence, if any</Trans>}
          >
            <input
              data-testid="effect-third-party"
              maxLength={280}
              value={thirdParty()}
              onInput={(e) => setThirdParty(e.currentTarget.value)}
            />
          </Field>
          <Field
            label={<Trans>Parts made with AI tools</Trans>}
            hint={<Trans>Which parts and which tool, if any</Trans>}
          >
            <input
              data-testid="effect-ai-parts"
              maxLength={280}
              value={aiParts()}
              onInput={(e) => setAiParts(e.currentTarget.value)}
            />
          </Field>
          <Pledge>
            <Checkbox
              data-testid="effect-promise"
              checked={promised()}
              onChange={(e) => setPromised(e.currentTarget.checked)}
            >
              <Trans>
                I made this or hold the rights to it, it shows no real person,
                and I accept the{" "}
                <a
                  href={`${CREATOR_TERMS_URL}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={(e) => e.stopPropagation()}
                >
                  Creator Terms
                </a>
                .
              </Trans>
            </Checkbox>
          </Pledge>
        </Show>

        <Show when={problem()}>
          <ErrorText role="alert">{problem()}</ErrorText>
        </Show>
        <Show
          when={props.canSubmit}
          fallback={
            <FormActions>
              <button type="button" onClick={() => props.onCancel()}>
                <Trans>Back</Trans>
              </button>
            </FormActions>
          }
        >
          <small>
            <Show
              when={isEffect()}
              fallback={
                <Trans>
                  Only publish work you made or have the right to share. It is
                  public as soon as you publish it.
                </Trans>
              }
            >
              <Trans>
                A reviewer looks at your effect first. It goes live when they
                approve it. Effects are free.
              </Trans>
            </Show>
          </small>
          <FormActions>
            <button type="button" onClick={() => props.onCancel()}>
              <Trans>Cancel</Trans>
            </button>
            <button
              type="button"
              disabled={busy() || !ready()}
              onClick={() => void save(false)}
            >
              <Trans>Save draft</Trans>
            </button>
            <button
              type="button"
              data-primary
              disabled={busy() || !ready()}
              onClick={() => void save(true)}
            >
              <Show
                when={busy()}
                fallback={
                  <Show when={isEffect()} fallback={<Trans>Publish</Trans>}>
                    <Trans>Send for review</Trans>
                  </Show>
                }
              >
                <Show when={isEffect()} fallback={<Trans>Publishing…</Trans>}>
                  <Trans>Checking and sending…</Trans>
                </Show>
              </Show>
            </button>
          </FormActions>
        </Show>
      </Sheet>
    </Form>
  );
}

/** "12 / 32" under a field; turns amber near the limit */
function Counter(props: { value: string; limit: number }) {
  return (
    <CounterText data-near={props.value.length >= props.limit - 4}>
      {props.value.length} / {props.limit}
    </CounterText>
  );
}

/** One line of the list before publishing */
function Check(props: { on: boolean; children: JSX.Element }) {
  return (
    <CheckLine data-on={props.on}>
      <Icon name={props.on ? "check-circle" : "circle"} size={16} />
      <span>{props.children}</span>
    </CheckLine>
  );
}

/** The art raw, with where the avatar and the name will sit */
function Guides(props: { url: string; kind: CommunityKind }) {
  // an effect has nothing to line up with: it fills the profile
  if (props.kind === "effects") return <EffectArt url={props.url} />;
  return (
    <Show
      when={props.kind === "decorations"}
      fallback={
        <GuidePlate
          style={{
            "--crop": PLATE_MARKS.crop,
            "--avatar-inset": PLATE_MARKS.avatarInset,
            "--avatar-size": PLATE_MARKS.avatarSize,
            "--name-inset": PLATE_MARKS.nameInset,
            "--name-size": PLATE_MARKS.nameSize,
            "--name-edge": PLATE_MARKS.nameEdge,
          }}
        >
          <img src={props.url} alt="" draggable={false} />
          <i data-side="start" />
          <i data-side="end" />
          <b data-side="start" />
          <b data-side="end" />
        </GuidePlate>
      }
    >
      <GuideRing>
        <img src={props.url} alt="" draggable={false} />
        <i />
      </GuideRing>
    </Show>
  );
}

/** The image on several avatar sizes and in a message, or behind two names */
function PreviewArt(props: {
  url: string;
  /** a WebM not uploaded yet: the image is only made on upload */
  video?: boolean;
  kind: CommunityKind;
  avatar?: string;
  name: string;
  guides: boolean;
}) {
  const allowed = useEffectsAllowed();
  return (
    <Show
      when={!props.video}
      fallback={
        <WebmPreview
          data-testid="webm-preview"
          src={props.url}
          muted
          playsinline
          autoplay={allowed()}
          loop={props.kind !== "effects"}
          controls={!allowed()}
        />
      }
    >
      <Show
        when={!props.guides}
        fallback={<Guides url={props.url} kind={props.kind} />}
      >
        <Show when={props.kind === "effects"}>
          <EffectBench>
            <EffectArt url={props.url} />
          </EffectBench>
        </Show>
        <Show
          when={props.kind === "decorations"}
          fallback={
            <Show when={props.kind === "nameplates"}>
              <Plates>
                <NameplateArt
                  url={props.url}
                  avatar={props.avatar}
                  name="سارة الزرزور"
                />
                <NameplateArt
                  url={props.url}
                  avatar={props.avatar}
                  name="Sara Zrzur"
                />
                <NameplateArt
                  url={props.url}
                  avatar={props.avatar}
                  name={props.name}
                  small
                />
              </Plates>
            </Show>
          }
        >
          <Hero>
            <DecorationArt
              url={props.url}
              avatar={props.avatar}
              name={props.name}
              size={160}
            />
          </Hero>
          <Sizes>
            <For each={PREVIEW_SIZES}>
              {(size) => (
                <DecorationArt
                  url={props.url}
                  avatar={props.avatar}
                  name={props.name}
                  size={size}
                />
              )}
            </For>
          </Sizes>
        </Show>
      </Show>
    </Show>
  );
}

const WebmPreview = styled("video", {
  base: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "360px",
    marginInline: "auto",
  },
});

const EffectBench = styled("div", {
  base: { height: "360px", maxWidth: "100%", marginInline: "auto" },
});

const Pledge = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& a": { color: "var(--z-link)" },
    _phone: { minHeight: "44px" },
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    minWidth: 0,
    containerType: "inline-size",
    "&[data-page]": {
      gap: "32px",
      position: "relative",
      marginBlockStart: "32px",
    },
  },
});

const StudioHead = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "24px",
    "& > div:first-child": { flex: "1 1 360px", minWidth: 0 },
    "& h1": {
      margin: "0 0 8px",
      fontSize: "clamp(28px, 4vw, 40px)",
      lineHeight: "1.2",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      maxWidth: "640px",
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Stats = styled("div", {
  base: { display: "flex", gap: "32px" },
});

const Stat = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    "& strong": {
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      color: "var(--z-fg-primary)",
    },
    "& span": { fontSize: "13px", color: "var(--z-fg-muted)" },
  },
});

const BackLink = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: 0,
    border: "none",
    background: "none",
    color: "var(--z-fg-secondary)",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    // direction icons turn by themselves in right-to-left (styles.css)
    _hover: { color: "var(--z-fg-primary)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const StudioSection = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& > h2": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "30px",
      fontWeight: 700,
    },
  },
});

const Starters = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
});

/** a new design: a drop target as much as a card */
const Starter = styled("article", {
  base: {
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-designs-edge, var(--z-border-subtle))",
    background: "var(--z-designs-surface, var(--z-card-bg))",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    transition: "border-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    "&[data-over='true']": { borderColor: "var(--z-focus)" },
  },
});

const StarterArt = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    height: "176px",
    borderRadius: "var(--z-shape-button, 10px)",
    background: "var(--z-designs-art-ground, var(--z-bg-input))",
  },
});

const StarterText = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& strong": { fontSize: "18px", lineHeight: "26px", fontWeight: 700 },
    "& span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const StarterActions = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    marginTop: "auto",
    "& button": {
      flex: 1,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      height: "40px",
      borderRadius: "var(--z-shape-button, 10px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-primary)",
      font: "inherit",
      fontSize: "14px",
      fontWeight: 600,
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      transition: "background-color 120ms cubic-bezier(0.2, 0, 0, 1)",
      _hover: { background: "var(--z-nav-selected)" },
      _phone: { height: "44px" },
    },
    "& button[data-primary]": {
      border: "none",
      background: "var(--z-accent-fill)",
      color: "var(--z-on-accent)",
      _hover: { background: "var(--z-accent-hover)" },
      "&:active": { background: "var(--z-accent-pressed)" },
    },
    "& button:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

/** a nameplate at the size it has in a member list */
const PlateSample = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "min(100% - 32px, 280px)",
    aspectRatio: "448 / 84",
    paddingInline: "12px",
    boxSizing: "border-box",
    borderRadius: "var(--z-shape-button, 10px)",
    color: "#fff",
    fontWeight: 600,
    textShadow: "0 1px 2px rgb(0 0 0 / 0.5)",
  },
});

/** plain text tabs on a hairline, like the settings pages */
const Tabs = styled("div", {
  base: {
    display: "flex",
    gap: "24px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const Tab = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    paddingBlock: "0 10px",
    paddingInline: 0,
    marginBottom: "-1px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "none",
    color: "var(--z-fg-muted)",
    font: "inherit",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
    "& > span": {
      minWidth: "20px",
      height: "20px",
      paddingInline: "6px",
      borderRadius: "999px",
      fontSize: "12px",
      lineHeight: "20px",
      background: "var(--z-bg-input)",
      color: "var(--z-fg-secondary)",
    },
    _hover: { color: "var(--z-fg-primary)" },
    "&[aria-selected='true']": {
      color: "var(--z-fg-primary)",
      borderBottomColor: "var(--z-accent)",
    },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "4px",
    },
  },
});

const Designs = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "16px",
    // the empty note spans the whole row
    "& > :only-child": { gridColumn: "1 / -1" },
  },
});

const DesignCard = styled("article", {
  base: {
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-designs-edge, var(--z-btn-surface-border))",
    background: "var(--z-designs-surface, var(--z-card-bg))",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px",
  },
});

const DesignArt = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    height: "120px",
    borderRadius: "12px",
    background: "var(--z-bg-input)",
    "&[data-wide] > *": { width: "calc(100% - 20px)" },
  },
});

const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    lineHeight: "20px",
    "--z-icon-color": "var(--z-fg-muted)",
    "& > svg, & > span:first-child": { flexShrink: 0 },
  },
});

const Info = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    minWidth: 0,
    "& strong": {
      fontSize: "14px",
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
    },
    "& > span": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const Note = styled("p", {
  base: {
    display: "flex",
    gap: "6px",
    margin: 0,
    padding: "6px 8px",
    borderRadius: "8px",
    background: "var(--z-bg-input)",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    textAlign: "start",
    "--z-icon-color": "currentColor",
  },
});

const button = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  height: "36px",
  paddingInline: "12px",
  border: "1px solid var(--z-border-subtle)",
  borderRadius: "var(--z-radius, 10px)",
  background: "transparent",
  color: "var(--z-fg-primary)",
  font: "inherit",
  fontSize: "13px",
  fontWeight: 650,
  cursor: "pointer",
  whiteSpace: "nowrap",
  "--z-icon-color": "currentColor",
  _disabled: { opacity: 0.5, cursor: "not-allowed" },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
  _phone: { height: "44px" },
} as const;

const RowActions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    justifyContent: "flex-end",
    "& button": button,
    "& button[data-primary]": {
      border: "none",
      color: "var(--z-on-accent)",
      background: "var(--z-accent-fill)",
    },
    "& button[data-danger='true']": {
      borderColor: "var(--z-danger, #F27488)",
      color: "var(--z-danger, #F27488)",
    },
  },
});

const Empty = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "32px 16px",
    borderRadius: "12px",
    border: "1px dashed var(--z-border-strong)",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--z-fg-muted)",
    "& button": button,
  },
});

const ErrorText = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-danger, #F27488)" },
});

/** the bench: the canvas large, the form beside it; one column when narrow */
const Form = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: "24px",
    alignItems: "start",
    "@container (max-width: 800px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Sheet = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
    "& > small": {
      fontSize: "12px",
      lineHeight: "16px",
      color: "var(--z-fg-muted)",
    },
    "& input, & textarea": { _phone: { fontSize: "16px" } },
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
  },
});

const FormActions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    "& button": button,
    "& button[data-primary]": {
      border: "none",
      color: "var(--z-on-accent)",
      background: "var(--z-accent-fill)",
      _hover: { background: "var(--z-accent-hover)" },
      "&:active": { background: "var(--z-accent-pressed)" },
    },
    _phone: { "& button": { flex: "1 1 auto" } },
  },
});

/**
 * The canvas: always dark or light on purpose, whatever the theme, so the
 * art can be judged on both grounds
 */
const Canvas = styled("section", {
  base: {
    position: "sticky",
    top: "80px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    minWidth: 0,
    minHeight: "420px",
    padding: "16px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-designs-art-ground, var(--z-bg-input))",
    color: "var(--z-designs-on-art, var(--z-fg-primary))",
    transition: "border-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    "&[data-ground='light']": {
      background: "var(--z-designs-art-light, var(--z-bg-raised))",
      color: "var(--z-designs-on-light, var(--z-fg-primary))",
    },
    "&[data-over='true']": { borderColor: "var(--z-focus)" },
    "@container (max-width: 800px)": {
      position: "static",
      minHeight: "280px",
    },
  },
});

const CanvasTools = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const GuideSwitch = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    color: "inherit",
  },
});

const CanvasFoot = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginTop: "auto",
    "& button": {
      ...button,
      color: "inherit",
      border: "1px solid currentColor",
      background: "transparent",
    },
    "& small": { fontSize: "13px", opacity: 0.72 },
  },
});

/** the empty canvas is itself the way to add an image */
const Drop = styled("button", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "32px 16px",
    border: "1px dashed var(--z-border-strong)",
    borderRadius: "var(--z-shape-button, 10px)",
    background: "none",
    color: "inherit",
    font: "inherit",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    transition: "border-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    "& svg": { marginBottom: "8px" },
    "& strong": { fontSize: "18px", lineHeight: "26px", fontWeight: 700 },
    "& span": { fontSize: "15px", color: "var(--z-accent-text)" },
    "& small": { marginTop: "8px", fontSize: "12px", opacity: 0.72 },
    _hover: { borderColor: "currentColor" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const Hero = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    paddingBlock: "40px 24px",
  },
});

const GuideRing = styled("div", {
  base: {
    position: "relative",
    alignSelf: "center",
    width: "min(100%, 320px)",
    aspectRatio: "1",
    outline: "1px dashed currentColor",
    "& img": { display: "block", width: "100%", height: "100%" },
    // the avatar is two thirds of the artwork, centred
    "& i": {
      position: "absolute",
      inset: "16.67%",
      borderRadius: "50%",
      border: "2px dashed var(--z-focus)",
    },
  },
});

const GuidePlate = styled("div", {
  base: {
    position: "relative",
    aspectRatio: "1024 / 192",
    outline: "1px dashed currentColor",
    marginBlock: "auto",
    "& img": { display: "block", width: "100%", height: "100%" },
    // what the member row crops
    "&::before, &::after": {
      content: '""',
      position: "absolute",
      insetInline: 0,
      height: "var(--crop)",
      background: "rgb(0 0 0 / 0.5)",
      pointerEvents: "none",
    },
    "&::before": { top: 0 },
    "&::after": { bottom: 0 },
    // where the avatar and the name sit, in both directions
    "& i": {
      position: "absolute",
      top: "50%",
      width: "var(--avatar-size)",
      aspectRatio: "1",
      translate: "0 -50%",
      borderRadius: "50%",
      border: "2px dashed var(--z-focus)",
    },
    "& b": {
      position: "absolute",
      insetBlock: "var(--name-edge)",
      width: "var(--name-size)",
      border: "2px dashed var(--z-focus)",
      borderRadius: "4px",
    },
    "& i[data-side='start']": { left: "var(--avatar-inset)" },
    "& i[data-side='end']": { right: "var(--avatar-inset)" },
    "& b[data-side='start']": { left: "var(--name-inset)" },
    "& b[data-side='end']": { right: "var(--name-inset)" },
  },
});

const Checks = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "12px",
    borderRadius: "var(--z-shape-button, 10px)",
    background: "var(--z-bg-raised)",
  },
});

const CheckLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "24px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-fg-muted)",
    "&[data-on='true']": {
      color: "var(--z-fg-primary)",
      "--z-icon-color": "var(--z-presence-online)",
    },
  },
});

const Advice = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-warning, var(--z-fg-secondary))",
    "--z-icon-color": "currentColor",
    "& > svg, & > span:first-child": { flexShrink: 0, marginTop: "2px" },
  },
});

const CounterText = styled("span", {
  base: {
    "&[data-near='true']": { color: "var(--z-warning, var(--z-fg-primary))" },
  },
});

const Sizes = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: "14px",
    padding: "8px",
  },
});

const Plates = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBlock: "auto",
  },
});
