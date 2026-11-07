import {
  type Placement,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
} from "@floating-ui/dom";
import { useLingui } from "@lingui/solid/macro";
import { useDevice } from "@revolt/common";
import { useFloating } from "solid-floating-ui";
import {
  type Accessor,
  type JSX,
  type Setter,
  Match,
  Show,
  Switch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
import type { Channel } from "@zrzur/sdk/solid";
import { cva } from "styled-system/css";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker } from "./GifPicker";
import { mediaPickerTrigger } from "./mediaPickerTrigger";
import "./picker.css";

export type MediaPickerProps = {
  ref: Setter<HTMLElement | undefined>;
  onClickGif: (_: unknown, ref?: HTMLDivElement) => void;
  onClickEmoji: (_: unknown, ref?: HTMLDivElement) => void;
};
interface Props {
  children: (trigProps: MediaPickerProps) => JSX.Element;
  onMessage: (content: string) => void;
  onTextReplacement: (node: string) => void;
  channel?: Channel;
  /** Close after one emoji (a field that holds one emoji, not a message) */
  closeOnPick?: boolean;
  /** Where the picker opens next to its button (default: above, at the end) */
  placement?: Placement;
}
export const CompositionMediaPickerContext = createContext(
  null as unknown as Pick<Props, "onMessage" | "onTextReplacement">,
);

export function CompositionMediaPicker(props: Props) {
  const [anchor, setAnchor] = createSignal<HTMLElement>();
  const [show, setShow] = createSignal<"gif" | "emoji">();
  const [altRef, setAltRef] = createSignal<HTMLElement>();
  const [trigger, setTrigger] = createSignal<HTMLElement>();
  function captureTrigger(event: unknown, ref?: HTMLDivElement) {
    const button = mediaPickerTrigger(event);
    if (button instanceof HTMLElement) setTrigger(button);
    setAltRef(ref ?? (button instanceof HTMLElement ? button : undefined));
  }
  return (
    <CompositionMediaPickerContext.Provider
      value={{
        onTextReplacement: (text) => {
          props.onTextReplacement(text);
          if (props.closeOnPick) setShow(undefined);
        },
        onMessage: (content) => {
          props.onMessage(content);
          setShow(undefined);
        },
      }}
    >
      {props.children({
        ref: setAnchor,
        onClickGif: (event, ref) => {
          if (props.channel && !props.channel.havePermission("SendEmbeds"))
            return;
          captureTrigger(event, ref);
          setShow((current) => (current === "gif" ? undefined : "gif"));
        },
        onClickEmoji: (event, ref) => {
          captureTrigger(event, ref);
          setShow((current) => (current === "emoji" ? undefined : "emoji"));
        },
      })}
      <Show when={show()}>
        <Portal mount={document.getElementById("floating")!}>
          <Picker
            channel={props.channel}
            anchor={() => altRef() || anchor()}
            trigger={trigger}
            show={show}
            setShow={setShow}
            placement={props.placement}
          />
        </Portal>
      </Show>
    </CompositionMediaPickerContext.Provider>
  );
}

function Picker(
  props: Pick<Props, "channel"> & {
    anchor: Accessor<HTMLElement | undefined>;
    trigger: Accessor<HTMLElement | undefined>;
    show: Accessor<"gif" | "emoji" | undefined>;
    setShow: Setter<"gif" | "emoji" | undefined>;
    placement?: Placement;
  },
) {
  const device = useDevice();
  const { t } = useLingui();
  const [floating, setFloating] = createSignal<HTMLDivElement>();
  const [phone, setPhone] = createSignal(device.layout() === "phone");
  const allowGifs = () =>
    !props.channel || props.channel.havePermission("SendEmbeds");
  createEffect(() => {
    if (props.show() === "gif" && !allowGifs()) props.setShow(undefined);
  });
  const position = useFloating(() => props.anchor(), floating, {
    // eslint-disable-next-line solid/reactivity
    placement: props.placement ?? "top-end",
    strategy: "fixed",
    // The picker has a fixed size, so only the anchor moving (scroll,
    // window resize) should move it. Re-measuring on every content change
    // (categories -> loading -> results) produced a bad reading that threw
    // the picker into the top-left corner for a moment.
    whileElementsMounted: (reference, floating, update) =>
      autoUpdate(reference, floating, update, {
        elementResize: false,
        layoutShift: false,
      }),
    middleware: [
      offset(6),
      flip({ padding: { top: 64, bottom: 8, left: 8, right: 8 } }),
      shift({ padding: 8 }),
      size({
        padding: { top: 64, bottom: 8, left: 8, right: 8 },
        apply({ availableHeight, elements }) {
          elements.floating.style.setProperty(
            "--z-picker-available-height",
            `${Math.max(0, availableHeight)}px`,
          );
        },
      }),
    ],
  });
  // Positioned only once floating-ui has measured a live anchor. If the
  // anchor is re-rendered away (the composer re-mounting), close instead of
  // jumping to the top-left corner.
  const placed = () =>
    position.x != null && position.y != null && !!props.anchor()?.isConnected;
  createEffect(() => {
    void position.x;
    void position.y;
    const anchor = props.anchor();
    if (anchor && !anchor.isConnected) props.setShow(undefined);
  });

  function close() {
    props.setShow(undefined);
    props.trigger()?.focus({ preventScroll: true });
  }
  function onPointerDown(e: PointerEvent) {
    const target = e.target as Node;
    if (
      !floating()?.contains(target) &&
      !props.anchor()?.contains(target) &&
      !props.trigger()?.contains(target)
    )
      close();
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    close();
    (
      props.trigger() ??
      props.anchor()?.parentElement?.querySelector("button") ??
      props.anchor()
    )?.focus();
  }
  const onResize = () => setPhone(device.layout() === "phone");
  onMount(() => {
    document.addEventListener("pointerdown", onPointerDown);
    // capture: Escape is also "jump to latest" (a keybind on document.body,
    // which would otherwise run first), and closing the picker must not
    // scroll the chat away or refetch it
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
  });
  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", onResize);
  });
  return (
    <div
      ref={setFloating}
      class="z-media-picker"
      data-picker-type={props.show()}
      classList={{ "z-media-picker--phone": phone() }}
      role="dialog"
      aria-label={props.show() === "gif" ? t`GIF picker` : t`Emoji`}
      style={
        phone()
          ? undefined
          : {
              position: position.strategy,
              top: `${position.y ?? 0}px`,
              left: `${position.x ?? 0}px`,
              // never flash at the corner before the first real position
              visibility: placed() ? undefined : "hidden",
            }
      }
    >
      <div class="z-picker-panel">
        <Switch>
          <Match when={props.show() === "gif" && allowGifs()}>
            <GifPicker />
          </Match>
          <Match when={props.show() === "emoji"}>
            <EmojiPicker />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

export const compositionContent = cva({
  base: { flexGrow: 1, minHeight: 0, minWidth: 0 },
});
