import {
  For,
  JSX,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Button,
  Checkbox,
  Dialog,
  Radio2,
  Segmented,
  Slider,
  Toggle,
} from "@revolt/ui";
import { FRAME_TYPES } from "@revolt/ui/components/features/profiles/frames/communityFrame";
import { Icon } from "@revolt/ui/icons/Icon";

import { CommunityImage, Field } from "../CommunityParts";
import {
  type CommunityItem,
  type CommunityKind,
  COMMUNITY_MAX_DIMENSION,
  COMMUNITY_TYPES,
  CREATOR_TERMS_VERSION,
  checkCommunityFile,
  communityApi,
  effectProblem,
  isRankRefusal,
  kindOf,
  parseTags,
} from "../communityApi";

import { type PreviewPlace, LivePreview, PREVIEW_PLACES } from "./LivePreview";
import { SpecFacts } from "./StudioHome";
import {
  type FileCheck,
  type FileFacts,
  fileChecks,
  fileRefused,
  isAnimated,
  pixelFacts,
} from "./fileCheck";
import {
  type Fit,
  FIT_DEFAULT,
  FIT_SCALE,
  FIT_SHIFT,
  clampFit,
  fitChanged,
  fitRect,
  needsRedraw,
  renderFit,
} from "./fit";
import {
  FRAME_MAX_FRAMES,
  frameCover,
  frameCoverOfFrames,
  isFrameSize,
} from "./frameCheck";
import { downloadFrameKit } from "./frameKit";
import { framePictures } from "./framePictures";
import {
  Actions,
  Callout,
  Crumbs,
  Page,
  PageHead,
  Panel,
  SpecList,
  useStudioWords,
} from "./parts";
import {
  type RightsAnswers,
  type StepFacts,
  type StudioStep,
  STUDIO_STEPS,
  firstOpenStep,
  rightsFromStored,
  rightsInput,
  rightsMissing,
  stepDone,
  stepOpen,
} from "./studioModel";

const CREATOR_TERMS_URL = "https://zrzur.com/legal/creator-terms";

/** side of the small canvas the pixels are measured on */
const MEASURE = 160;

/**
 * A new design, or a new version of one, in six steps: type, file, preview
 * and fit, details, rights, send. Nothing is uploaded before the creator
 * saves a draft or sends it.
 */
export function StudioEditor(props: {
  /** a design being changed; without it a new one */
  item?: CommunityItem;
  kind?: CommunityKind;
  /** open at this step if the ones before it are done */
  step?: StudioStep;
  /** this server takes effects */
  effects: boolean;
  /** this server takes profile frames */
  frames?: boolean;
  /** open the guide to designing a profile frame */
  onFrameGuide?: () => void;
  avatar?: string;
  name: string;
  dialog?: boolean;
  onLeave: () => void;
  onBack: () => void;
  /** a draft was saved: the list should know it */
  onSaved: (item: CommunityItem) => void;
  /** sent or published */
  onDone: (item: CommunityItem) => void;
  onRankRefused: () => void;
}) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const describeError = useError();
  const words = useStudioWords();

  /* eslint-disable solid/reactivity */
  const source = props.item?.pending ?? props.item;
  const [kind, setKind] = createSignal<CommunityKind | undefined>(
    props.item ? kindOf(props.item) : props.kind,
  );
  const [saved, setSaved] = createSignal<CommunityItem | undefined>(props.item);
  const [name, setName] = createSignal(source?.name ?? "");
  // the name follows the file until the creator types one
  const [nameTyped, setNameTyped] = createSignal(!!source?.name);
  const [description, setDescription] = createSignal(source?.description ?? "");
  const [tags, setTags] = createSignal((source?.tags ?? []).join(", "));
  const [rights, setRights] = createSignal<RightsAnswers>(
    rightsFromStored(props.item?.rights),
  );
  /* eslint-enable solid/reactivity */

  const [file, setFile] = createSignal<File>();
  const [original, setOriginal] = createSignal<string>();
  const [fitted, setFitted] = createSignal<string>();
  const [facts, setFacts] = createSignal<FileFacts>();
  const [fit, setFit] = createSignal<Fit>(FIT_DEFAULT);
  const [problem, setProblem] = createSignal<string>();
  const [busy, setBusy] = createSignal<"draft" | "send">();
  const [dirty, setDirty] = createSignal(false);
  const [savedAt, setSavedAt] = createSignal<number>();
  const [leaving, setLeaving] = createSignal(false);
  const [over, setOver] = createSignal(false);
  const [ground, setGround] = createSignal<"dark" | "light">("dark");
  const [guides, setGuides] = createSignal(false);
  const [place, setPlace] = createSignal<PreviewPlace>("profile");

  let input!: HTMLInputElement;
  /** the picked still image, kept to redraw it into its frame */
  let picture: HTMLImageElement | undefined;
  /** the file id of what was last uploaded, and what it was made from */
  let uploaded: { key: string; id: string } | undefined;

  const isEffect = () => kind() === "effects";
  /** a profile frame: a still or moving picture on a fixed template, never refitted */
  const isFrame = () => kind() === "frames";
  const isVideo = () => file()?.type === "video/webm";
  const animated = () => !!facts()?.animated || isVideo();
  /** a still image the creator just picked can be moved in its frame */
  const canFit = () => !!file() && !animated() && !isEffect() && !isFrame();
  const redraw = () => {
    const known = facts();
    const type = kind();
    return (
      !!known &&
      !!type &&
      canFit() &&
      needsRedraw(type, known.width, known.height, fit(), false)
    );
  };

  const checks = createMemo<FileCheck[]>(() => {
    const known = facts();
    const type = kind();
    return known && type ? fileChecks(type, known) : [];
  });
  /** the stored promise still covers this version: same image, same terms */
  const rightsKept = () =>
    !file() &&
    !!saved()?.rights &&
    saved()!.rights!.terms_version === CREATOR_TERMS_VERSION;

  const stepFacts = (): StepFacts => ({
    kind: kind(),
    hasImage: !!file() || !!saved(),
    fileRefused: fileRefused(checks()),
    name: name(),
    rights: rights(),
    rightsKept: rightsKept(),
  });

  /* eslint-disable-next-line solid/reactivity */
  const wanted = props.step;
  const [step, setStep] = createSignal<StudioStep>(
    wanted && stepOpen(wanted, stepFacts())
      ? wanted
      : props.item
        ? "preview"
        : firstOpenStep(stepFacts()),
  );
  const index = () => STUDIO_STEPS.indexOf(step());
  const go = (to: StudioStep) => {
    if (!stepOpen(to, stepFacts())) return;
    setProblem(undefined);
    setStep(to);
  };

  createEffect(
    on(kind, (type) => {
      if (type && !PREVIEW_PLACES[type].includes(place()))
        setPlace(PREVIEW_PLACES[type][0]);
    }),
  );

  const stepLabel = (id: StudioStep) =>
    ({
      type: t`Type`,
      file: t`File`,
      preview: t`Preview and fit`,
      details: t`Details`,
      rights: t`Rights`,
      send: t`Send`,
    })[id];

  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);
  const weight = (bytes: number) =>
    bytes >= 1_000_000
      ? t`${new Intl.NumberFormat(i18n().locale, { maximumFractionDigits: 1 }).format(bytes / 1_000_000)} MB`
      : t`${number(Math.max(1, Math.round(bytes / 1000)))} KB`;

  function release() {
    for (const url of [original(), fitted()]) if (url) URL.revokeObjectURL(url);
  }
  onCleanup(release);

  /** what the pixels say, measured on what will be uploaded */
  function measure(image: CanvasImageSource, width: number, height: number) {
    const type = kind();
    if (!type) return {};
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return {};
      // a frame is checked pixel for pixel, as the server checks it
      if (type === "frames") {
        if (!isFrameSize(width, height)) return {};
        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, width, height);
        return { frameCover: frameCover(data, width, height) };
      }
      if (canFit()) {
        const rect = fitRect(type, width, height, fit());
        const scale = MEASURE / Math.max(rect.frame.width, rect.frame.height);
        canvas.width = Math.max(1, Math.round(rect.frame.width * scale));
        canvas.height = Math.max(1, Math.round(rect.frame.height * scale));
        context.drawImage(
          image,
          rect.x * scale,
          rect.y * scale,
          rect.width * scale,
          rect.height * scale,
        );
      } else {
        const scale = MEASURE / Math.max(width, height);
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      return pixelFacts(data, canvas.width, canvas.height, type);
    } catch {
      // a canvas the browser won't read: the server still checks the file
      return {};
    }
  }

  function accept(picked: File, url: string, known: FileFacts) {
    release();
    setFitted(undefined);
    setFit(FIT_DEFAULT);
    setFile(picked);
    setOriginal(url);
    setFacts(known);
    setDirty(true);
    uploaded = undefined;
    if (!nameTyped())
      setName(
        picked.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .trim()
          .slice(0, 32),
      );
    // a new image needs a new promise
    setRights((answers) => ({ ...answers, confirmed: false }));
    setStep(fileRefused(checks()) ? "file" : "preview");
  }

  function pick(picked: File | undefined) {
    setProblem(undefined);
    const type = kind();
    if (!picked || !type) return;
    const issue = checkCommunityFile(picked, type);
    if (issue === "type") {
      setProblem(
        type === "frames"
          ? t`Use a PNG, animated PNG, WebP or GIF file.`
          : t`Use a PNG, animated PNG, GIF, WebP or WebM file.`,
      );
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
    const base = { name: picked.name, type: picked.type, bytes: picked.size };
    // a video can't be measured as an image: the server makes the image
    if (picked.type === "video/webm") {
      const video = document.createElement("video");
      video.onloadedmetadata = () => {
        picture = undefined;
        accept(picked, url, {
          ...base,
          width: video.videoWidth,
          height: video.videoHeight,
        });
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
    image.onload = async () => {
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
      const bytes = await picked.arrayBuffer();
      const moves = isAnimated(new Uint8Array(bytes), picked.type);
      picture = image;
      // fit starts fresh for the new file, so measure after accepting it
      accept(picked, url, {
        ...base,
        width: image.naturalWidth,
        height: image.naturalHeight,
        animated: moves,
      });
      setFacts((known) =>
        known
          ? {
              ...known,
              ...measure(image, image.naturalWidth, image.naturalHeight),
            }
          : known,
      );
      if (fileRefused(checks())) setStep("file");
      // a moving frame: every picture keeps the card clear, not only the first
      if (
        moves &&
        kind() === "frames" &&
        isFrameSize(image.naturalWidth, image.naturalHeight)
      ) {
        const cover = await frameCoverOfFrames(
          framePictures(
            bytes,
            picked.type,
            image.naturalWidth,
            image.naturalHeight,
          ),
          image.naturalWidth,
          image.naturalHeight,
        ).catch(() => undefined);
        // another file picked meanwhile
        if (!cover?.pixels || file() !== picked) return;
        setFacts((known) => (known ? { ...known, frameCover: cover } : known));
        if (fileRefused(checks())) setStep("file");
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setProblem(t`That file isn't an image we can read.`);
    };
    image.src = url;
  }

  // the still image redrawn into its frame, a moment after the last change
  createEffect(
    on([fit, file, kind], () => {
      const known = facts();
      const type = kind();
      const image = picture;
      const picked = file();
      if (!known || !type || !image || !picked || !redraw()) {
        const old = fitted();
        if (old) URL.revokeObjectURL(old);
        setFitted(undefined);
        return;
      }
      const timer = setTimeout(() => {
        void renderFit(
          image,
          type,
          known.width,
          known.height,
          fit(),
          picked.name,
        )
          .then((drawn) => {
            const old = fitted();
            if (old) URL.revokeObjectURL(old);
            setFitted(URL.createObjectURL(drawn));
            setFacts((now) =>
              now
                ? { ...now, ...measure(image, known.width, known.height) }
                : now,
            );
          })
          .catch(() => undefined);
      }, 120);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  const changeFit = (change: Partial<Fit>) => {
    setFit((now) => clampFit({ ...now, ...change }));
    setDirty(true);
  };

  /** plain words for what the machine check found */
  const refusal = (failure: unknown) => {
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
        return isFrame()
          ? t`This frame has too many pictures. The limit is ${number(FRAME_MAX_FRAMES)}.`
          : t`This effect has too many frames. The limit is 120.`;
      case "too_long":
        return t`This effect is too long. The limit is 4 seconds.`;
      case "too_many_pixels":
        return t`That image is too large. Keep it within ${COMMUNITY_MAX_DIMENSION} × ${COMMUNITY_MAX_DIMENSION} pixels.`;
      case "webm":
        return t`That WebM can't be read. Use VP8 or VP9, at most ${COMMUNITY_MAX_DIMENSION} px on each side, and export it again.`;
      case "webm_slow":
        return t`That WebM couldn't be turned into an image in time. Try a shorter one, or try again in a moment.`;
      case "covers_content":
        return t`The art covers the card's content. Keep the card clear 20 px in from its edge; only the crest window over the middle of the banner may be drawn on.`;
      case "frame_size":
        return t`A frame file is exactly 800 × 1020 px. Start from the template in the frame kit.`;
      case "frame_still":
        // a server from before moving frames were allowed
        return t`Moving frames are not open yet. Export one picture as PNG or WebP.`;
      default:
        return undefined;
    }
  };

  /** the server's `rights: required`, whatever shape the error came in */
  const rightsRefused = (failure: unknown) => {
    try {
      const body = typeof failure === "string" ? JSON.parse(failure) : failure;
      return !!(body as { fields?: { field?: string }[] })?.fields?.some(
        (entry) => entry.field === "rights",
      );
    } catch {
      return false;
    }
  };

  /** upload what is on the canvas, once per image and fit */
  async function upload() {
    const picked = file();
    const type = kind();
    const known = facts();
    if (!picked || !type || !known) return undefined;
    const key = `${picked.name}:${picked.size}:${picked.lastModified}:${JSON.stringify(fit())}`;
    if (uploaded?.key === key) return uploaded.id;
    const body =
      redraw() && picture
        ? await renderFit(
            picture,
            type,
            known.width,
            known.height,
            fit(),
            picked.name,
          )
        : picked;
    const id = await client().uploadFile(
      type === "effects" ? "effects" : "decorations",
      body,
      instance.mediaUrl,
    );
    uploaded = { key, id };
    return id;
  }

  async function save(send: boolean) {
    const type = kind();
    if (!type || busy()) return;
    if (!stepDone("details", stepFacts()) || !stepDone("file", stepFacts()))
      return;
    const promise = rightsKept() ? undefined : rightsInput(rights());
    if (send && !promise && !rightsKept()) {
      go("rights");
      setProblem(t`Answer the questions about your rights first.`);
      return;
    }
    setBusy(send ? "send" : "draft");
    setProblem(undefined);
    try {
      const fileId = await upload();
      const body = {
        name: name().trim(),
        description: description().trim(),
        tags: parseTags(tags()),
        submit: send,
        ...(promise ? { rights: promise } : {}),
      };
      const existing = saved();
      const item = existing
        ? await communityApi.edit(client(), existing._id, {
            ...body,
            file: fileId,
          })
        : await communityApi.create(client(), type, { ...body, file: fileId! });
      setSaved(item);
      // what is on the canvas is now the stored image
      if (fileId) {
        setFile(undefined);
        picture = undefined;
        uploaded = undefined;
        setFit(FIT_DEFAULT);
      }
      setDirty(false);
      setSavedAt(Date.now());
      if (send) props.onDone(item);
      else props.onSaved(item);
    } catch (failure) {
      if (rightsRefused(failure)) {
        setStep("rights");
        setProblem(t`Answer the questions about your rights first.`);
      } else {
        const words = refusal(failure);
        if (words) setStep("file");
        setProblem(words ?? describeError(failure));
      }
      if (isRankRefusal(failure)) props.onRankRefused();
    } finally {
      setBusy(undefined);
    }
  }

  const canSave = () =>
    stepDone("file", stepFacts()) && stepDone("details", stepFacts());

  function next() {
    const at = index();
    if (step() === "send") return void save(true);
    if (!stepDone(step(), stepFacts())) return;
    go(STUDIO_STEPS[at + 1]);
  }
  const back = () => (index() > 0 ? go(STUDIO_STEPS[index() - 1]) : leave());
  const leave = () => (dirty() ? setLeaving(true) : props.onBack());

  // G guide marks, D background, Ctrl/Cmd+Enter next step or send
  onMount(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        next();
        return;
      }
      if (typing || event.ctrlKey || event.metaKey) return;
      if (step() !== "preview") return;
      const key = event.key.toLowerCase();
      if (key === "g" && !isEffect()) {
        event.preventDefault();
        setGuides((on) => !on);
      } else if (key === "d") {
        event.preventDefault();
        setGround((now) => (now === "dark" ? "light" : "dark"));
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  /** words beside a check that is not ok */
  const checkWords = (check: FileCheck): JSX.Element => {
    const known = facts()!;
    switch (check.id) {
      case "size":
        return (
          <span dir="ltr">
            {known.width} × {known.height}
          </span>
        );
      case "format":
        return <span dir="ltr">{known.type.split("/")[1].toUpperCase()}</span>;
      case "weight":
        return <>{weight(known.bytes)}</>;
      case "transparent":
        return check.state === "ok" ? (
          <Trans>Yes</Trans>
        ) : check.reason === "too-solid" ? (
          <Trans>Covers too much</Trans>
        ) : (
          <Trans>No clear area</Trans>
        );
      case "safe":
        return (
          <Switch>
            <Match when={check.reason === "covers-banner"}>
              <Trans>Covers the banner</Trans>
            </Match>
            <Match when={check.reason === "covers-name"}>
              <Trans>Covers the name area</Trans>
            </Match>
            <Match when={check.reason === "covers-text"}>
              <Trans>Covers the text area</Trans>
            </Match>
            <Match when={isFrame()}>
              <Trans>Card content clear</Trans>
            </Match>
            <Match when={check.state === "ok"}>
              <Trans>Clear of the face</Trans>
            </Match>
            <Match when={true}>
              <Trans>Part covers the face</Trans>
            </Match>
          </Switch>
        );
      case "motion":
        return isFrame() ? (
          check.reason === "frame-moves" ? (
            <Trans>Moves, allowed</Trans>
          ) : (
            <Trans>Still picture</Trans>
          )
        ) : check.reason === "video" ? (
          <Trans>Made on upload</Trans>
        ) : check.state === "ok" ? (
          <Trans>Animated</Trans>
        ) : (
          <Trans>Does not move</Trans>
        );
    }
  };
  const checkLabel = (id: FileCheck["id"]) =>
    ({
      size: t`Size`,
      format: t`Format`,
      weight: t`File size`,
      transparent: t`Transparent background`,
      safe: t`Safe area`,
      motion: t`Animation`,
    })[id];
  /** what to do about the first check that is not ok */
  const advice = () => {
    const check = checks().find((entry) => entry.state !== "ok");
    if (!check && checks().some((entry) => entry.reason === "frame-moves"))
      return t`People who turn motion off see it as a still picture.`;
    switch (check?.reason) {
      case "square":
        return t`This image is not square. It is cropped to the frame; move it with the fit controls, or use 1024 × 1024 px.`;
      case "wide":
        return t`This image is not wide enough for a nameplate. It is cropped to the frame; 1024 × 192 px fits best.`;
      case "tall":
        return t`An effect has the shape of a profile: 9 by 16, such as 576 × 1024 px.`;
      case "small":
        return t`This image is small and may look soft. The full size is best.`;
      case "no-clear":
        return t`The background is filled, so it will hide the avatar. Export with a transparent background.`;
      case "over-face":
        return t`The avatar fills the middle two thirds. Scale the art, or show the guide marks to see the circle.`;
      case "too-solid":
        return t`This effect covers too much of the profile. Keep at least half of each frame transparent so text stays readable.`;
      case "still":
        return t`An effect has to move. This file has only one frame.`;
      case "frame-size":
        return t`A frame file is exactly 800 × 1020 px. Start from the template in the frame kit.`;
      case "frame-moves":
        return undefined;
      case "covers-banner":
        return t`The art covers the banner. Keep the card clear 20 px in from its edge; only the crest window over the middle of the banner may be drawn on.`;
      case "covers-name":
        return t`The art covers the name area. Keep the card clear 20 px in from its edge, where the avatar and the name sit.`;
      case "covers-text":
        return t`The art covers the text area. Keep the card clear 20 px in from its edge, down to its foot.`;
      default:
        return undefined;
    }
  };

  const title = () =>
    props.item ? (
      <bdi>{name() || props.item.name}</bdi>
    ) : (
      <Show when={kind()} fallback={<Trans>New design</Trans>}>
        {(type) => <Trans>New design: {words.kind(type())}</Trans>}
      </Show>
    );

  /**
   * The art wherever it comes from: the canvas, or the stored image. The
   * address is read where it is drawn, so a replaced or refitted image shows
   * at once.
   */
  const Stage = (stage: { children: (url: () => string) => JSX.Element }) => (
    <Show
      when={fitted() ?? original()}
      fallback={
        <Show when={saved()}>
          {(item) => (
            <CommunityImage item={item()} file={item().pending?.file}>
              {(url) => stage.children(() => url)}
            </CommunityImage>
          )}
        </Show>
      }
    >
      {(url) => stage.children(url)}
    </Show>
  );

  const preview = (fixedPlace?: PreviewPlace) => (
    <Stage>
      {(url) => (
        <LivePreview
          kind={kind()!}
          url={url()}
          video={isVideo()}
          place={fixedPlace ?? place()}
          ground={ground()}
          guides={!fixedPlace && guides()}
          avatar={props.avatar}
          name={props.name}
        />
      )}
    </Stage>
  );

  const dropZone = {
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      pick(event.dataTransfer?.files[0]);
    },
  };

  const placeLabel = (id: PreviewPlace) =>
    ({
      profile: t`Profile card`,
      members: t`Member list`,
      message: t`Chat message`,
      sizes: t`All sizes`,
    })[id];

  const sendsToReview = () => isEffect();
  const afterSending = () =>
    sendsToReview() ? (
      <Trans>
        A reviewer looks at it first. It goes live when they approve it.
      </Trans>
    ) : props.item?.status === "Published" ? (
      <Trans>
        It replaces the live version at once, also for people wearing it.
      </Trans>
    ) : (
      <Trans>It goes live at once, with your name on it.</Trans>
    );

  return (
    <Page
      data-dialog={props.dialog ? "" : undefined}
      data-testid="studio-editor"
    >
      <Crumbs aria-label={t`You are here`}>
        <Show when={!props.dialog}>
          <button type="button" onClick={() => props.onLeave()}>
            <Trans>Designs</Trans>
          </button>
          <span aria-hidden="true">/</span>
        </Show>
        <button type="button" onClick={leave}>
          <Trans>Creator Studio</Trans>
        </button>
        <span aria-hidden="true">/</span>
        <b>{title()}</b>
      </Crumbs>

      <PageHead>
        <div>
          <h1 data-testid="studio-editor-title">{title()}</h1>
        </div>
      </PageHead>

      <Steps aria-label={t`Steps`}>
        <For each={STUDIO_STEPS}>
          {(id, at) => (
            <li>
              <button
                type="button"
                data-testid={`studio-step-${id}`}
                data-state={
                  step() === id
                    ? "now"
                    : stepDone(id, stepFacts()) && id !== "send"
                      ? "done"
                      : "todo"
                }
                aria-current={step() === id ? "step" : undefined}
                // the type of a saved design is fixed
                disabled={
                  !stepOpen(id, stepFacts()) || (id === "type" && !!saved())
                }
                onClick={() => go(id)}
              >
                <b aria-hidden="true">
                  <Show
                    when={
                      step() !== id &&
                      stepDone(id, stepFacts()) &&
                      id !== "send"
                    }
                    fallback={number(at() + 1)}
                  >
                    <Icon name="check" size={14} />
                  </Show>
                </b>
                <span>{stepLabel(id)}</span>
              </button>
            </li>
          )}
        </For>
      </Steps>

      <input
        ref={input}
        type="file"
        data-testid="studio-file"
        accept={(isFrame() ? FRAME_TYPES : COMMUNITY_TYPES).join(",")}
        hidden
        onChange={(event) => {
          pick(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <Show when={problem()}>
        <Callout tone="error" testid="studio-problem">
          {problem()}
        </Callout>
      </Show>

      <Switch>
        {/* 1. type */}
        <Match when={step() === "type"}>
          <Radio2
            aria-label={t`Type`}
            value={kind()}
            onChange={(event) => {
              setKind(event.currentTarget.value as CommunityKind);
              setDirty(true);
            }}
          >
            <TypeCards>
              <For
                each={(
                  ["decorations", "nameplates", "effects", "frames"] as const
                ).filter(
                  (entry) =>
                    (entry !== "effects" || props.effects) &&
                    (entry !== "frames" || props.frames),
                )}
              >
                {(entry) => (
                  <TypeCard
                    data-testid={`studio-type-${entry}`}
                    data-on={kind() === entry}
                  >
                    <Radio2.Option value={entry}>
                      <strong>{words.kind(entry)}</strong>
                    </Radio2.Option>
                    <p>
                      <Switch>
                        <Match when={entry === "decorations"}>
                          <Trans>
                            A frame drawn over the avatar, everywhere it shows.
                          </Trans>
                        </Match>
                        <Match when={entry === "nameplates"}>
                          <Trans>Art behind the name in the member list.</Trans>
                        </Match>
                        <Match when={entry === "frames"}>
                          <Trans>
                            Art round the whole profile card, drawn on our
                            template.
                          </Trans>
                        </Match>
                        <Match when={true}>
                          <Trans>
                            A transparent animation that plays once over a
                            profile. A reviewer looks at it first.
                          </Trans>
                        </Match>
                      </Switch>
                    </p>
                    <SpecFacts kind={entry} />
                    <Show when={entry === "frames" && props.onFrameGuide}>
                      <GuideLink
                        type="button"
                        data-testid="studio-frame-guide"
                        onClick={() => props.onFrameGuide?.()}
                      >
                        <Icon name="books" size={16} />
                        <Trans>How to design a frame</Trans>
                      </GuideLink>
                    </Show>
                  </TypeCard>
                )}
              </For>
            </TypeCards>
          </Radio2>
        </Match>

        {/* 2. file */}
        <Match when={step() === "file"}>
          <Split>
            <StageBox data-over={over()} {...dropZone}>
              <Drop
                type="button"
                data-testid="studio-drop"
                onClick={() => input.click()}
              >
                <Icon name="upload-simple" size={24} />
                <strong>
                  <Trans>Drop your file here</Trans>
                </strong>
                <span>
                  <Trans>or choose a file</Trans>
                </span>
              </Drop>
              <Show when={facts()}>
                <StageFoot>
                  <span dir="auto">{facts()!.name}</span>
                </StageFoot>
              </Show>
            </StageBox>
            <Side>
              <Panel>
                <h2>
                  <Trans>What this type needs</Trans>
                </h2>
                <SpecFacts kind={kind()!} />
                <Show when={isFrame()}>
                  <Actions>
                    <Show when={props.onFrameGuide}>
                      <Button
                        variant="tonal"
                        size="sm"
                        data-testid="studio-file-frame-guide"
                        onPress={() => props.onFrameGuide?.()}
                      >
                        <Icon name="books" size={16} />
                        <Trans>How to design a frame</Trans>
                      </Button>
                    </Show>
                    <Button
                      variant="tonal"
                      size="sm"
                      data-testid="studio-frame-kit"
                      onPress={() => downloadFrameKit("kit")}
                    >
                      <Icon name="download-simple" size={16} />
                      <Trans>Frame kit</Trans>
                    </Button>
                  </Actions>
                </Show>
              </Panel>
              <Show when={checks().length}>{checkPanel()}</Show>
            </Side>
          </Split>
        </Match>

        {/* 3. preview and fit */}
        <Match when={step() === "preview"}>
          <Split>
            <StageBox data-over={over()} {...dropZone}>
              <StageBar>
                <Show when={PREVIEW_PLACES[kind()!].length > 1}>
                  <Segmented
                    aria-label={t`Where it shows`}
                    value={place()}
                    onChange={(value) => {
                      setPlace(value);
                      setGuides(false);
                    }}
                    options={PREVIEW_PLACES[kind()!].map((id) => ({
                      value: id,
                      label: placeLabel(id),
                    }))}
                  />
                </Show>
                <Segmented
                  aria-label={t`Background`}
                  value={ground()}
                  onChange={setGround}
                  options={[
                    { value: "dark", label: t`Dark` },
                    { value: "light", label: t`Light` },
                  ]}
                />
              </StageBar>
              {preview()}
              <StageFoot>
                <Show when={facts()} fallback={<span />}>
                  {(known) => (
                    <span dir="ltr">
                      {known().width} × {known().height}
                    </span>
                  )}
                </Show>
                <Show when={!isEffect() && !isVideo()}>
                  <GuideSwitch>
                    <span id="studio-guides-label">
                      <Show
                        when={isFrame()}
                        fallback={<Trans>Guide marks</Trans>}
                      >
                        <Trans>Show guides</Trans>
                      </Show>
                    </span>
                    <Toggle
                      checked={guides()}
                      onChange={() => setGuides(!guides())}
                      aria-labelledby="studio-guides-label"
                    />
                  </GuideSwitch>
                </Show>
              </StageFoot>
            </StageBox>
            <Side>
              <Show when={checks().length}>{checkPanel()}</Show>
              <Panel>
                <h2>
                  <Trans>Fit</Trans>
                </h2>
                <Show
                  when={canFit()}
                  fallback={
                    <p>
                      <Show
                        when={!isFrame()}
                        fallback={
                          <Trans>
                            A frame is laid round the card exactly as you drew
                            it, so there is nothing to fit.
                          </Trans>
                        }
                      >
                        <Show
                          when={file()}
                          fallback={
                            <Trans>
                              Replace the image to move or scale it in its
                              frame.
                            </Trans>
                          }
                        >
                          <Trans>
                            Fit works on still images. Animated files are shown
                            as they are.
                          </Trans>
                        </Show>
                      </Show>
                    </p>
                  }
                >
                  <Field label={<Trans>Scale</Trans>}>
                    <Slider
                      data-testid="studio-fit-scale"
                      aria-label={t`Scale`}
                      min={FIT_SCALE.min}
                      max={FIT_SCALE.max}
                      value={fit().scale}
                      labelFormatter={(value) => `${number(value)}%`}
                      onInput={(event) =>
                        changeFit({ scale: event.currentTarget.value })
                      }
                    />
                  </Field>
                  <Field label={<Trans>Left and right</Trans>}>
                    <Slider
                      data-testid="studio-fit-x"
                      aria-label={t`Left and right`}
                      min={FIT_SHIFT.min}
                      max={FIT_SHIFT.max}
                      value={fit().x}
                      labelFormatter={(value) => number(value)}
                      onInput={(event) =>
                        changeFit({ x: event.currentTarget.value })
                      }
                    />
                  </Field>
                  <Field label={<Trans>Up and down</Trans>}>
                    <Slider
                      data-testid="studio-fit-y"
                      aria-label={t`Up and down`}
                      min={FIT_SHIFT.min}
                      max={FIT_SHIFT.max}
                      value={fit().y}
                      labelFormatter={(value) => number(value)}
                      onInput={(event) =>
                        changeFit({ y: event.currentTarget.value })
                      }
                    />
                  </Field>
                </Show>
                <Actions>
                  <Show when={canFit() && fitChanged(fit())}>
                    <Button
                      variant="tonal"
                      size="sm"
                      onPress={() => setFit(FIT_DEFAULT)}
                    >
                      <Trans>Reset</Trans>
                    </Button>
                  </Show>
                  <Button
                    variant="tonal"
                    size="sm"
                    data-testid="studio-replace"
                    onPress={() => input.click()}
                  >
                    <Icon name="upload-simple" size={16} />
                    <Trans>Replace the image</Trans>
                  </Button>
                </Actions>
              </Panel>
              <Keys>
                <span>
                  <kbd>G</kbd>{" "}
                  <Show when={isFrame()} fallback={<Trans>Guide marks</Trans>}>
                    <Trans>Show guides</Trans>
                  </Show>
                </span>
                <span>
                  <kbd>D</kbd> <Trans>Dark or light</Trans>
                </span>
              </Keys>
            </Side>
          </Split>
        </Match>

        {/* 4. details */}
        <Match when={step() === "details"}>
          <Split>
            <Panel>
              <h2>
                <Trans>Name and words</Trans>
              </h2>
              <p>
                <Trans>
                  Write them in your own language. They show on the design's
                  public page.
                </Trans>
              </p>
              <Field
                label={<Trans>Name</Trans>}
                hint={<Counter value={name()} limit={32} />}
              >
                <input
                  data-testid="studio-name"
                  value={name()}
                  maxLength={32}
                  onInput={(event) => {
                    setName(event.currentTarget.value);
                    setNameTyped(true);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field
                label={<Trans>Description</Trans>}
                hint={<Counter value={description()} limit={280} />}
              >
                <textarea
                  data-testid="studio-description"
                  rows={3}
                  maxLength={280}
                  value={description()}
                  onInput={(event) => {
                    setDescription(event.currentTarget.value);
                    setDirty(true);
                  }}
                />
              </Field>
              <Field
                label={<Trans>Tags</Trans>}
                hint={<Trans>Up to 8, separated by commas</Trans>}
              >
                <input
                  data-testid="studio-tags"
                  value={tags()}
                  onInput={(event) => {
                    setTags(event.currentTarget.value);
                    setDirty(true);
                  }}
                />
              </Field>
            </Panel>
            <Side>
              <StageBox>{preview(PREVIEW_PLACES[kind()!][0])}</StageBox>
            </Side>
          </Split>
        </Match>

        {/* 5. rights */}
        <Match when={step() === "rights"}>
          <Split>
            <Questions data-testid="studio-rights">
              <Show when={rightsKept()}>
                <Callout tone="info" title={<Trans>Already confirmed</Trans>}>
                  <Trans>
                    You confirmed your rights to this image. Replacing the image
                    asks again.
                  </Trans>
                </Callout>
              </Show>
              <Show when={!rightsKept()}>
                <Question>
                  <h2>
                    <Trans>1. Did you make this work?</Trans>
                  </h2>
                  <p>
                    <Trans>
                      Publish only what you made yourself or hold a clear
                      licence to share.
                    </Trans>
                  </p>
                  <Radio2
                    aria-label={t`Did you make this work?`}
                    value={rights().own}
                    onChange={(event) =>
                      setRights((now) => ({
                        ...now,
                        own: event.currentTarget.value as "mine" | "licensed",
                      }))
                    }
                  >
                    <Options>
                      <Option
                        data-testid="rights-own-mine"
                        data-on={rights().own === "mine"}
                      >
                        <Radio2.Option value="mine">
                          <Trans>Yes, I made it myself</Trans>
                        </Radio2.Option>
                      </Option>
                      <Option
                        data-testid="rights-own-licensed"
                        data-on={rights().own === "licensed"}
                      >
                        <Radio2.Option value="licensed">
                          <Trans>I hold a licence to share it</Trans>
                        </Radio2.Option>
                      </Option>
                    </Options>
                  </Radio2>
                </Question>

                <Question>
                  <h2>
                    <Trans>2. Does it include parts made by others?</Trans>
                  </h2>
                  <p>
                    <Trans>
                      Such as a font or a drawing under an open licence. Name
                      the source and the licence.
                    </Trans>
                  </p>
                  <Show when={rights().own !== "licensed"}>
                    <Radio2
                      aria-label={t`Does it include parts made by others?`}
                      value={
                        rights().others === undefined
                          ? undefined
                          : rights().others
                            ? "yes"
                            : "no"
                      }
                      onChange={(event) =>
                        setRights((now) => ({
                          ...now,
                          others: event.currentTarget.value === "yes",
                        }))
                      }
                    >
                      <Options>
                        <Option
                          data-testid="rights-others-no"
                          data-on={rights().others === false}
                        >
                          <Radio2.Option value="no">
                            <Trans>No</Trans>
                          </Radio2.Option>
                        </Option>
                        <Option
                          data-testid="rights-others-yes"
                          data-on={rights().others === true}
                        >
                          <Radio2.Option value="yes">
                            <Trans>Yes</Trans>
                          </Radio2.Option>
                        </Option>
                      </Options>
                    </Radio2>
                  </Show>
                  <Show when={rights().own === "licensed" || rights().others}>
                    <Field
                      label={<Trans>Source and licence</Trans>}
                      hint={<Counter value={rights().othersText} limit={280} />}
                    >
                      <input
                        data-testid="rights-others-text"
                        maxLength={280}
                        value={rights().othersText}
                        onInput={(event) =>
                          setRights((now) => ({
                            ...now,
                            othersText: event.currentTarget.value,
                          }))
                        }
                      />
                    </Field>
                  </Show>
                </Question>

                <Question>
                  <h2>
                    <Trans>3. Does it include parts made with AI tools?</Trans>
                  </h2>
                  <p>
                    <Trans>
                      Allowed if you have the right to use them and say so here.
                    </Trans>
                  </p>
                  <Radio2
                    aria-label={t`Does it include parts made with AI tools?`}
                    value={
                      rights().ai === undefined
                        ? undefined
                        : rights().ai
                          ? "yes"
                          : "no"
                    }
                    onChange={(event) =>
                      setRights((now) => ({
                        ...now,
                        ai: event.currentTarget.value === "yes",
                      }))
                    }
                  >
                    <Options>
                      <Option
                        data-testid="rights-ai-no"
                        data-on={rights().ai === false}
                      >
                        <Radio2.Option value="no">
                          <Trans>No</Trans>
                        </Radio2.Option>
                      </Option>
                      <Option
                        data-testid="rights-ai-yes"
                        data-on={rights().ai === true}
                      >
                        <Radio2.Option value="yes">
                          <Trans>Yes</Trans>
                        </Radio2.Option>
                      </Option>
                    </Options>
                  </Radio2>
                  <Show when={rights().ai}>
                    <Field
                      label={<Trans>Which parts and which tool</Trans>}
                      hint={<Counter value={rights().aiText} limit={280} />}
                    >
                      <input
                        data-testid="rights-ai-text"
                        maxLength={280}
                        value={rights().aiText}
                        onInput={(event) =>
                          setRights((now) => ({
                            ...now,
                            aiText: event.currentTarget.value,
                          }))
                        }
                      />
                    </Field>
                  </Show>
                </Question>

                <Question>
                  <Checkbox
                    data-testid="rights-confirm"
                    checked={rights().confirmed}
                    onChange={(event) =>
                      setRights((now) => ({
                        ...now,
                        confirmed: event.currentTarget.checked,
                      }))
                    }
                  >
                    {/* the Creator Terms: no real person in an effect; elsewhere
                        only with that person's consent */}
                    <Show
                      when={isEffect()}
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
                        I confirm this is true, the work shows no real person,
                        and I accept the{" "}
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
                </Question>
              </Show>
            </Questions>
            <Side>{summary()}</Side>
          </Split>
        </Match>

        {/* 6. send */}
        <Match when={step() === "send"}>
          <Split>
            <StageBox>{preview(PREVIEW_PLACES[kind()!][0])}</StageBox>
            <Side>
              {summary()}
              <Callout tone="info" title={<Trans>What happens next</Trans>}>
                {afterSending()}
              </Callout>
            </Side>
          </Split>
        </Match>
      </Switch>

      <Bar>
        <Saved data-testid="studio-saved" role="status">
          <Switch>
            <Match when={busy() === "draft"}>
              <Trans>Saving the draft…</Trans>
            </Match>
            <Match when={dirty()}>
              <Trans>Changes not saved yet</Trans>
            </Match>
            <Match when={savedAt()}>
              <Icon name="check-circle" size={16} />
              <Trans>Draft saved</Trans>
            </Match>
          </Switch>
        </Saved>
        <Actions>
          <Button
            variant="text"
            data-testid="studio-prev"
            isDisabled={!!busy()}
            onPress={back}
          >
            <Show when={index() > 0} fallback={<Trans>Cancel</Trans>}>
              <Trans>Back</Trans>
            </Show>
          </Button>
          <Show when={canSave() && step() !== "type"}>
            <Button
              variant="tonal"
              data-testid="studio-save-draft"
              isDisabled={!!busy() || (!dirty() && !!saved())}
              onPress={() => void save(false)}
            >
              <Trans>Save draft</Trans>
            </Button>
          </Show>
          <Button
            variant="filled"
            data-testid="studio-next"
            isDisabled={
              !!busy() ||
              !stepDone(step() === "send" ? "rights" : step(), stepFacts())
            }
            onPress={next}
          >
            <Switch>
              <Match when={busy() === "send"}>
                <Show
                  when={sendsToReview()}
                  fallback={<Trans>Publishing…</Trans>}
                >
                  <Trans>Checking and sending…</Trans>
                </Show>
              </Match>
              <Match when={step() === "send"}>
                <Show when={sendsToReview()} fallback={<Trans>Publish</Trans>}>
                  <Trans>Send for review</Trans>
                </Show>
              </Match>
              <Match when={true}>
                <Trans>Next: {stepLabel(STUDIO_STEPS[index() + 1])}</Trans>
              </Match>
            </Switch>
          </Button>
        </Actions>
      </Bar>

      <Dialog
        show={leaving()}
        onClose={() => setLeaving(false)}
        title={<Trans>Leave without saving?</Trans>}
        actions={[
          { text: <Trans>Keep working</Trans> },
          {
            text: <Trans>Leave</Trans>,
            onClick: () => {
              setLeaving(false);
              props.onBack();
            },
          },
        ]}
      >
        <Trans>What you changed since the last saved draft will be lost.</Trans>
      </Dialog>
    </Page>
  );

  function checkPanel() {
    return (
      <Panel data-testid="studio-checks">
        <h2>
          <Trans>File check</Trans>
        </h2>
        <SpecList>
          <For each={checks()}>
            {(check) => (
              <div data-check={check.id}>
                <dt>{checkLabel(check.id)}</dt>
                <dd
                  data-state={
                    check.reason === "frame-moves" ? "info" : check.state
                  }
                >
                  {checkWords(check)}
                  <Icon
                    name={
                      check.reason === "frame-moves"
                        ? "info"
                        : check.state === "ok"
                          ? "check-circle"
                          : "warning-circle"
                    }
                    size={16}
                  />
                </dd>
              </div>
            )}
          </For>
        </SpecList>
        <Show when={advice()}>
          <p data-testid="studio-advice">{advice()}</p>
        </Show>
      </Panel>
    );
  }

  function summary() {
    const stored = () => (rightsKept() ? saved()?.rights : undefined);
    const promised = () => rightsInput(rights());
    return (
      <Panel data-testid="studio-summary">
        <h2>
          <Trans>Design summary</Trans>
        </h2>
        <SpecList>
          <div>
            <dt>
              <Trans>Name</Trans>
            </dt>
            <dd>
              <bdi>{name().trim() || "—"}</bdi>
            </dd>
          </div>
          <div>
            <dt>
              <Trans>Type</Trans>
            </dt>
            <dd>{words.kind(kind()!)}</dd>
          </div>
          <Show when={parseTags(tags()).length}>
            <div>
              <dt>
                <Trans>Tags</Trans>
              </dt>
              <dd dir="auto">{parseTags(tags()).join(", ")}</dd>
            </div>
          </Show>
          <Show when={step() === "send"}>
            <div>
              <dt>
                <Trans>Parts made by others</Trans>
              </dt>
              <dd dir="auto">
                {(stored()?.third_party ?? promised()?.third_party) || (
                  <Trans>None</Trans>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <Trans>Parts made with AI tools</Trans>
              </dt>
              <dd dir="auto">
                {(stored()?.ai_parts ?? promised()?.ai_parts) || (
                  <Trans>None</Trans>
                )}
              </dd>
            </div>
          </Show>
          <div>
            <dt>
              <Trans>After sending</Trans>
            </dt>
            <dd>
              <Show
                when={sendsToReview()}
                fallback={<Trans>Goes live at once</Trans>}
              >
                <Trans>Waits for a reviewer</Trans>
              </Show>
            </dd>
          </div>
        </SpecList>
        <Show
          when={
            step() === "rights" &&
            !rightsKept() &&
            rightsMissing(rights()).length
          }
        >
          <p>
            <Trans>Answer every question to go on.</Trans>
          </p>
        </Show>
      </Panel>
    );
  }
}

/** "12 / 32" under a field; turns amber near the limit */
function Counter(props: { value: string; limit: number }) {
  return (
    <CounterText data-near={props.value.length >= props.limit - 4} dir="ltr">
      {props.value.length} / {props.limit}
    </CounterText>
  );
}

const CounterText = styled("span", {
  base: {
    fontVariantNumeric: "tabular-nums",
    "&[data-near='true']": { color: "var(--z-status-warning)" },
  },
});

const Steps = styled("ol", {
  base: {
    background: "var(--z-box-bg)",
    border: "var(--z-box-border)",
    borderRadius: "var(--z-box-radius)",
    display: "flex",
    gap: "4px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    overflowX: "auto",
    scrollbarWidth: "none",
    "& li": { flex: "1 0 auto" },
    "& button": {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      width: "100%",
      height: "44px",
      paddingInline: "12px",
      border: "none",
      borderRadius: "var(--z-radius, 10px)",
      background: "none",
      font: "inherit",
      fontSize: "14px",
      color: "var(--z-fg-muted)",
      whiteSpace: "nowrap",
      cursor: "pointer",
      "--z-icon-color": "currentColor",
      _disabled: { cursor: "default" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "-2px",
      },
    },
    "& b": {
      display: "grid",
      placeItems: "center",
      flex: "none",
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      fontSize: "12px",
      fontWeight: 600,
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-secondary)",
    },
    "& button[data-state='done']": { color: "var(--z-fg-secondary)" },
    "& button[data-state='done'] b": {
      background: "none",
      border: "1px solid var(--z-status-success)",
      color: "var(--z-status-success)",
    },
    "& button[data-state='now']": {
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-primary)",
      fontWeight: 600,
    },
    "& button[data-state='now'] b": {
      background: "var(--z-accent-fill)",
      color: "var(--z-on-accent)",
    },
    "@container (max-width: 760px)": {
      "& li": { flex: "none" },
      "& button:not([data-state='now']) span": { display: "none" },
    },
  },
});

const Split = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: "24px",
    alignItems: "start",
    "@container (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Side = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 },
});

const StageBox = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-sidebar)",
    overflow: "hidden",
    transition: "border-color 120ms cubic-bezier(0.2, 0, 0, 1)",
    "&[data-over='true']": { borderColor: "var(--z-focus)" },
  },
});

const StageBar = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 16px",
    borderBlockEnd: "1px solid var(--z-border-subtle)",
    "& > *": { maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none" },
  },
});

const StageFoot = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "48px",
    padding: "8px 16px",
    borderBlockStart: "1px solid var(--z-border-subtle)",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    "& > span": { minWidth: 0, overflowWrap: "anywhere" },
  },
});

const GuideSwitch = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "32px",
    fontWeight: 500,
    color: "var(--z-fg-secondary)",
    _phone: { minHeight: "44px" },
  },
});

const Drop = styled("button", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    minHeight: "360px",
    margin: "16px",
    padding: "24px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px dashed var(--z-border-strong)",
    background: "none",
    font: "inherit",
    color: "var(--z-fg-primary)",
    cursor: "pointer",
    "--z-icon-color": "var(--z-fg-secondary)",
    "& strong": { marginBlockStart: "8px", fontSize: "18px", fontWeight: 600 },
    "& span": { fontSize: "14px", color: "var(--z-accent-text)" },
    _hover: { borderColor: "var(--z-focus)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "240px" },
  },
});

const TypeCards = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
});

const TypeCard = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "20px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    "&[data-on='true']": {
      borderColor: "var(--z-accent-fill)",
      background:
        "color-mix(in srgb, var(--z-accent-fill) 8%, var(--z-bg-sidebar))",
    },
    "& > label": { minHeight: "32px" },
    "& strong": { fontSize: "18px", lineHeight: "26px", fontWeight: 600 },
    "& > p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
    },
    _phone: { padding: "16px", "& > label": { minHeight: "44px" } },
  },
});

/** a quiet way to the frame guide, under the frame's type card */
const GuideLink = styled("button", {
  base: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "32px",
    padding: "0 4px",
    border: "none",
    borderRadius: "6px",
    background: "none",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--z-accent-text)",
    cursor: "pointer",
    "--z-icon-color": "currentColor",
    _hover: { textDecoration: "underline" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    _phone: { minHeight: "44px" },
  },
});

const Questions = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 },
});

const Question = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "20px",
    borderRadius: "var(--z-box-radius)",
    border: "var(--z-box-border)",
    background: "var(--z-box-bg)",
    "& h2": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      fontWeight: 600,
    },
    "& > p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "22px",
      color: "var(--z-fg-secondary)",
    },
    "& a": { color: "var(--z-link)" },
    _phone: { padding: "16px" },
  },
});

const Options = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginBlockStart: "4px",
  },
});

const Option = styled("div", {
  base: {
    flex: "1 1 200px",
    display: "flex",
    alignItems: "center",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-raised)",
    "&[data-on='true']": {
      borderColor: "var(--z-accent-fill)",
      background: "color-mix(in srgb, var(--z-accent-fill) 14%, transparent)",
    },
    "& > label": { flex: 1, minHeight: "44px", paddingInline: "12px" },
  },
});

const Bar = styled("div", {
  base: {
    position: "sticky",
    bottom: "12px",
    zIndex: 2,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "var(--z-shape-card, 14px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-floating, var(--z-bg-raised))",
    boxShadow: "var(--z-shadow-floating, 0 12px 32px rgb(0 0 0 / 0.45))",
    _phone: { bottom: "8px" },
  },
});

const Saved = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "20px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-status-success)",
    _phone: { width: "100%" },
  },
});

const Keys = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 20px",
    fontSize: "13px",
    lineHeight: "24px",
    color: "var(--z-fg-muted)",
    "& kbd": {
      fontFamily: "var(--z-font-mono, monospace)",
      fontSize: "12px",
      paddingInline: "6px",
      borderRadius: "var(--z-radius-xs, 6px)",
      border: "1px solid var(--z-border-subtle)",
      background: "var(--z-bg-raised)",
      color: "var(--z-fg-secondary)",
    },
    _phone: { display: "none" },
  },
});
