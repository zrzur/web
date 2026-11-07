import { For, JSX, Show, createSignal } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { File } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";

import type { MediaItem } from "./types";

/**
 * Where an image of a bot's blocks comes from: a file of the same message,
 * or a web link loaded through the media proxy. Without the proxy, web
 * images are not loaded at all, so a bot cannot learn readers' addresses.
 */
export function useMediaSource(attachments: () => File[] | undefined) {
  const client = useClient();
  return (item: MediaItem) => {
    if (item.attachment) {
      const file = attachments()?.find((f) => f.id === item.attachment);
      const src = file?.createFileURL();
      return file && src ? { src, file } : undefined;
    }
    if (item.url && /^https?:\/\//i.test(item.url)) {
      const proxied = client().proxyFile(item.url);
      return proxied && proxied !== item.url ? { src: proxied } : undefined;
    }
    return undefined;
  };
}

/**
 * Hides its content behind a blur until the reader asks to see it
 */
export function Veil(props: { hidden?: boolean; children: JSX.Element }) {
  const { t } = useLingui();
  const [shown, setShown] = createSignal(false);
  const veiled = () => !!props.hidden && !shown();

  return (
    <VeilRoot data-veiled={veiled() || undefined}>
      <div aria-hidden={veiled() || undefined} inert={veiled() || undefined}>
        {props.children}
      </div>
      <Show when={veiled()}>
        <VeilButton type="button" onClick={() => setShown(true)}>
          {t`Spoiler`}
        </VeilButton>
      </Show>
    </VeilRoot>
  );
}

/**
 * One to ten images: one fills the width, two sit side by side, three put
 * the first one large, four make a square, more fill rows of three.
 */
export function Gallery(props: { items: MediaItem[]; attachments?: File[] }) {
  const source = useMediaSource(() => props.attachments);
  return (
    <Grid data-count={Math.min(props.items.length, 5)}>
      <For each={props.items}>
        {(item) => (
          <Veil hidden={item.spoiler}>
            <MediaImage item={item} source={source(item)} />
          </Veil>
        )}
      </For>
    </Grid>
  );
}

/** Small square image at the end of a section */
export function Thumbnail(props: { item: MediaItem; attachments?: File[] }) {
  const source = useMediaSource(() => props.attachments);
  return (
    <ThumbBox>
      <Veil hidden={props.item.spoiler}>
        <MediaImage item={props.item} source={source(props.item)} />
      </Veil>
    </ThumbBox>
  );
}

function MediaImage(props: {
  item: MediaItem;
  source?: { src: string; file?: File };
}) {
  const { t } = useLingui();
  const { openModal } = useModals();
  return (
    <Show
      when={props.source}
      fallback={
        <Missing role="img" aria-label={props.item.description ?? t`Image`}>
          {t`Image not available`}
        </Missing>
      }
    >
      {(source) => (
        <Image
          src={source().src}
          alt={props.item.description ?? ""}
          title={props.item.description}
          loading="lazy"
          referrerPolicy="no-referrer"
          data-zoom={source().file ? "" : undefined}
          onClick={() =>
            source().file &&
            openModal({ type: "image_viewer", file: source().file })
          }
        />
      )}
    </Show>
  );
}

const VeilRoot = styled("div", {
  base: {
    position: "relative",
    minWidth: 0,
    height: "100%",
    "& > div": { height: "100%", transition: "filter 0.2s ease" },
    "&[data-veiled] > div": {
      filter: "blur(28px) saturate(0.6)",
      pointerEvents: "none",
      userSelect: "none",
    },
  },
});

const VeilButton = styled("button", {
  base: {
    position: "absolute",
    insetBlockStart: "50%",
    insetInlineStart: "50%",
    transform: "translate(-50%, -50%)",
    paddingInline: "14px",
    minHeight: "32px",
    borderRadius: "999px",
    border: "none",
    background: "rgb(0 0 0 / 0.72)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    _hover: { background: "rgb(0 0 0 / 0.85)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "[dir=rtl] &": { transform: "translate(50%, -50%)" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gap: "4px",
    borderRadius: "8px",
    overflow: "hidden",
    width: "100%",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gridAutoRows: "140px",
    "&[data-count='1']": { gridTemplateColumns: "1fr", gridAutoRows: "auto" },
    "&[data-count='1'] img": { height: "auto", maxHeight: "360px" },
    "&[data-count='2']": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gridAutoRows: "200px",
    },
    // three: the first one large, two stacked next to it
    "&[data-count='3']": {
      gridTemplateColumns: "2fr 1fr",
      gridTemplateRows: "repeat(2, 130px)",
      "& > :first-child": { gridRow: "span 2" },
    },
    "&[data-count='4']": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gridAutoRows: "150px",
    },
    _phone: { gridAutoRows: "110px" },
  },
});

const Image = styled("img", {
  base: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    background: "var(--z-bg-input)",
    "&[data-zoom]": { cursor: "zoom-in" },
  },
});

const Missing = styled("div", {
  base: {
    display: "grid",
    placeItems: "center",
    height: "100%",
    minHeight: "80px",
    padding: "8px",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-muted)",
    fontSize: "12px",
    textAlign: "center",
  },
});

const ThumbBox = styled("div", {
  base: {
    flexShrink: 0,
    width: "84px",
    height: "84px",
    borderRadius: "8px",
    overflow: "hidden",
  },
});
