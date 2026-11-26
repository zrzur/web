import { JSX, Show, createEffect, createSignal, on, onCleanup } from "solid-js";

import { useInstance } from "@revolt/instance";

import { styled } from "styled-system/jsx";

import { useDesignMotion } from "../NameplateMotion";
import { isCommunityRef } from "../userStyle";
import { effectFileUrl } from "../userStyleExtras";

import { EFFECT_DURATION_MS } from "./effectIds";

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

/** Whether this viewer sees effects at all, here and now */
export const useEffectsAllowed = useDesignMotion;

/**
 * One play of a profile effect over its parent, which must be positioned: a
 * creator's uploaded effect, shown from its file. Nothing is logged. Under reduced motion, or with the viewer's own setting
 * off, nothing is fetched or mounted. It takes no clicks, screen readers skip
 * it, and it removes itself when done.
 */
export function ProfileEffect(props: {
  /** `c:<id>` of an uploaded effect; anything else shows nothing */
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
    <Show when={uploaded()} fallback={props.idle}>
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
