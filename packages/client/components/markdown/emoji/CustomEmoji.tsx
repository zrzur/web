import { ComponentProps, Show, createSignal, splitProps } from "solid-js";

import {
  saveData,
  smallPreviewUrl,
  smallPreviews,
} from "@revolt/common/lib/saveData";
import { useInstance } from "@revolt/instance";
import { EmojiBase } from "./EmojiBase";

/**
 * Display custom emoji
 */
export function CustomEmoji(
  props: { id: string } & Omit<
    ComponentProps<typeof EmojiBase>,
    "loading" | "class" | "draggable" | "src"
  >,
) {
  const [local, remote] = splitProps(props, ["id"]);
  const { mediaUrl } = useInstance();
  const [failedId, setFailedId] = createSignal<string>();

  return (
    <Show
      when={failedId() !== local.id}
      fallback={
        <span
          class="emoji"
          role="img"
          aria-label={`Unavailable custom emoji :${local.id}:`}
          style={{
            display: "inline-grid",
            "place-items": "center",
            width: "var(--emoji-size)",
            height: "var(--emoji-size)",
            "vertical-align": "middle",
          }}
        >
          ◇
        </span>
      }
    >
      <EmojiBase
        {...remote}
        loading="lazy"
        class="emoji"
        draggable={false}
        // Save data: the small still preview (64 px, an animated emoji as
        // one frame) where the media server makes it
        src={
          saveData() && smallPreviews(mediaUrl)
            ? smallPreviewUrl(`${mediaUrl}/emojis/${local.id}`)
            : `${mediaUrl}/emojis/${local.id}`
        }
        alt={`:${local.id}:`}
        onError={() => setFailedId(local.id)}
      />
    </Show>
  );
}
