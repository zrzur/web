import { JSX, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { useInstance } from "@revolt/instance";

import { styled } from "styled-system/jsx";

import { useDesignMotion } from "../NameplateMotion";
import { effectFileUrl, isCommunityRef } from "../userStyle";

import { EFFECT_DURATION_MS, EffectId, isEffectId } from "./effectIds";

/** Files fetched this session, so a second play asks for nothing */
const files = new Map<string, Promise<Blob | undefined>>();
const FILES_KEPT = 16;

/**
 * The file of an uploaded effect. Sent without a session, cookies or a
 * referrer, so the media server can't tell who is looking at whose profile.
 */
function effectFile(url: string) {
  let file = files.get(url);
  if (!file) {
    file = fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" })
      .then((response) => (response.ok ? response.blob() : undefined))
      .catch(() => undefined);
    files.set(url, file);
    // a failed file is asked for again next time
    void file.then((blob) => {
      if (!blob) files.delete(url);
    });
    if (files.size > FILES_KEPT) {
      files.delete(files.keys().next().value as string);
    }
  }
  return file;
}

/** Sharp on high-density screens, without drawing more than needed */
function fit(canvas: HTMLCanvasElement) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  return { width: canvas.width, height: canvas.height };
}

/** Whether this viewer sees effects at all, here and now */
export const useEffectsAllowed = useDesignMotion;

/**
 * One play of a profile effect over its parent, which must be positioned:
 * one of Zrzur's own, drawn here, or an uploaded one, shown from its file.
 * Nothing is logged. Under reduced motion, or with the viewer's own setting
 * off, nothing is fetched or mounted. It takes no clicks, screen readers skip
 * it, and it removes itself when done.
 */
export function ProfileEffect(props: {
  /** One of Zrzur's own, or `c:<id>` of an uploaded effect */
  effect?: string;
  /** File of an uploaded effect (`style.effect_file`) */
  file?: string;
  /** Address of a file that isn't worn yet: a private preview in the studio */
  url?: string;
  /** Change this to play again */
  play?: number;
  /** Shown when nothing is playing */
  idle?: JSX.Element;
}) {
  const instance = useInstance();
  const uploaded = () =>
    props.url ??
    (isCommunityRef(props.effect)
      ? effectFileUrl(instance.mediaUrl, props.file)
      : undefined);
  return (
    <Show
      when={uploaded()}
      fallback={
        <DrawnEffect
          effect={props.effect}
          play={props.play}
          idle={props.idle}
        />
      }
    >
      {(url) => <FileEffect url={url()} play={props.play} idle={props.idle} />}
    </Show>
  );
}

/**
 * An uploaded effect. Browsers share one animation per image address, and a
 * finished one stays on its last frame, so each play gets its own object URL
 * and starts from the first frame. It is removed after the longest time an
 * effect may play, whatever the file says.
 */
function FileEffect(props: { url: string; play?: number; idle?: JSX.Element }) {
  const allowed = useEffectsAllowed();
  const [running, setRunning] = createSignal<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let asked = 0;

  function stop() {
    asked++;
    clearTimeout(timer);
    const current = running();
    setRunning(undefined);
    if (current) URL.revokeObjectURL(current);
  }

  async function start(url: string) {
    const ask = asked;
    const blob = url.startsWith("blob:")
      ? await fetch(url)
          .then((response) => response.blob())
          .catch(() => undefined)
      : await effectFile(url);
    if (!blob || ask !== asked) return;
    setRunning(URL.createObjectURL(blob));
    timer = setTimeout(stop, EFFECT_DURATION_MS);
  }

  createEffect(
    on(
      () => [props.url, props.play, allowed()] as const,
      ([url, , on]) => {
        stop();
        if (on) void start(url);
      },
    ),
  );
  onCleanup(stop);

  return (
    <Show when={running()} keyed fallback={props.idle}>
      {(src) => (
        <FileOverlay
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-testid="profile-effect"
        />
      )}
    </Show>
  );
}

/** One of Zrzur's own effects, drawn on a canvas */
function DrawnEffect(props: {
  effect?: string;
  play?: number;
  idle?: JSX.Element;
}) {
  const allowed = useEffectsAllowed();
  // one value per play: a new one replaces the running canvas, so two effects
  // never run together and pointing at another tile starts that one
  const [running, setRunning] = createSignal<string>();

  createEffect(
    on(
      () => [props.effect, props.play, allowed()],
      () =>
        setRunning(
          allowed() && isEffectId(props.effect)
            ? `${props.effect}:${props.play ?? 0}`
            : undefined,
        ),
    ),
  );

  function start(canvas: HTMLCanvasElement) {
    const id = props.effect as EffectId;
    let frame = 0;
    let first: number | undefined;
    let gone = false;
    let draw: typeof import("./effects").drawEffect | undefined;

    const step = (now: number) => {
      // `ref` runs before the canvas is in the page: only from the first frame
      // on does it have a size
      if (first === undefined) {
        first = now;
        fit(canvas);
      }
      const context = canvas.getContext("2d");
      const elapsed = now - first;
      if (!context || !draw || elapsed >= EFFECT_DURATION_MS) {
        setRunning(undefined);
        return;
      }
      const size = { width: canvas.width, height: canvas.height };
      draw(context, id, elapsed, size.width, size.height);
      frame = requestAnimationFrame(step);
    };

    // the drawings load with the first effect anyone sees
    void import("./effects").then((effects) => {
      if (gone) return;
      draw = effects.drawEffect;
      frame = requestAnimationFrame(step);
    });
    onCleanup(() => {
      gone = true;
      cancelAnimationFrame(frame);
    });
  }

  return (
    <Show when={running()} keyed fallback={props.idle}>
      <Overlay ref={start} aria-hidden="true" data-testid="profile-effect" />
    </Show>
  );
}

/** A still picture of an effect, for picker tiles. Never moves. */
export function EffectStill(props: { effect: EffectId }) {
  return (
    <Still
      aria-hidden="true"
      ref={(canvas: HTMLCanvasElement) => {
        // drawn once the canvas has a size: a tile may be built before it is
        // in the page, and a canvas without a size stays blank
        const observer = new ResizeObserver(() => {
          const context = canvas.getContext("2d");
          if (!context || !canvas.getBoundingClientRect().width) return;
          observer.disconnect();
          void import("./effects").then(({ drawEffectStill }) => {
            const size = fit(canvas);
            drawEffectStill(
              context,
              props.effect,
              size.width,
              size.height,
              Math.min(window.devicePixelRatio || 1, 2),
            );
          });
        });
        observer.observe(canvas);
        onCleanup(() => observer.disconnect());
      }}
    />
  );
}

const FileOverlay = styled("img", {
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 1,
  },
});

const Overlay = styled("canvas", {
  base: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 1,
  },
});

const Still = styled("canvas", {
  base: { display: "block", width: "100%", height: "100%" },
});
