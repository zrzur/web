import {
  type Accessor,
  type JSX,
  Show,
  createEffect,
  createSignal,
  on,
  onMount,
  children as resolveChildren,
  untrack,
} from "solid-js";

import { useMotion } from "./engine";
import type { MotionArea } from "./presets";

/**
 * Like <Show>, but the content animates in and stays mounted while it
 * animates out. The animation runs on the first element of the content.
 *
 * Function children receive the last shown value, so content can keep
 * rendering while it leaves.
 */
export function MotionPresence<T>(props: {
  when: T | undefined | null | false;
  area: MotionArea | ((value: T) => MotionArea | undefined);
  /**
   * Use the backdrop keyframes
   */
  backdrop?: boolean;
  /**
   * Phone sheet: rise from the bottom edge
   */
  sheet?: boolean;
  /**
   * Animate content that is already shown when this first renders
   * (default true). Off for parts that come with their page, like the
   * member list.
   */
  appear?: boolean;
  children: JSX.Element | ((value: Accessor<T>) => JSX.Element);
}) {
  const motion = useMotion();
  const [mounted, setMounted] = createSignal(!!props.when);
  let firstMount = true;
  let shown = !!props.when;
  const [last, setLast] = createSignal<T | undefined>(
    props.when ? (props.when as T) : undefined,
  );
  let element: Element | undefined;
  let token = 0;

  const options = () => ({ backdrop: props.backdrop, sheet: props.sheet });
  const area = () =>
    typeof props.area === "function" ? props.area(last() as T) : props.area;

  createEffect(
    on(
      () => props.when,
      (value) => {
        if (value) setLast(() => value as T);
        // only a change between shown and hidden animates, not a new value
        if (!!value === shown) return;
        shown = !!value;

        const current = ++token;
        if (value) {
          if (mounted()) {
            // shown again while leaving: turn the exit around
            const name = untrack(area);
            if (element && name) {
              motion.play(element, name, "enter", options());
            }
          } else {
            setMounted(true);
          }
        } else if (mounted()) {
          const name = untrack(area);
          const target = element;
          if (!target || !name) {
            setMounted(false);
            return;
          }
          motion.play(target, name, "exit", options()).then(() => {
            if (current === token && !props.when) setMounted(false);
          });
        }
      },
      { defer: true },
    ),
  );

  return (
    <Show when={mounted()}>
      {(() => {
        const content = resolveChildren(() => {
          const child = props.children;
          return typeof child === "function" && child.length > 0
            ? (child as (value: Accessor<T>) => JSX.Element)(
                last as Accessor<T>,
              )
            : (child as JSX.Element);
        });

        onMount(() => {
          element = content
            .toArray()
            .find((node): node is Element => node instanceof Element);
          const appear = !firstMount || props.appear !== false;
          firstMount = false;
          const name = untrack(area);
          if (element && name && appear) {
            motion.play(element, name, "enter", options());
          }
        });

        return content();
      })()}
    </Show>
  );
}
