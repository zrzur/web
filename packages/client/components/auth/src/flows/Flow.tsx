import {
  JSX,
  Match,
  Show,
  Switch,
  createContext,
  createEffect,
  on,
  onMount,
  useContext,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { A } from "@revolt/routing";
import { Button } from "@revolt/ui";
import { floating } from "@revolt/ui/directives";
import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Card that holds every logged-out flow, so login, sign-up, reset and
 * verify share one width, padding, type scale and action layout. On
 * phones the page itself is the surface, so the card drops its frame.
 */
export const FlowBase = styled("div", {
  base: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    padding: "24px",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-sidebar)",
    border: "1px solid var(--z-border-soft)",
    borderRadius: "14px",

    "@media (max-width: 480px)": {
      padding: 0,
      background: "transparent",
      border: "none",
      boxShadow: "none",
    },
  },
});

const Heading = styled("div", {
  base: {
    "& h1": {
      margin: 0,
      color: "var(--z-header-primary, var(--z-fg-primary))",
      fontSize: "22px",
      fontWeight: 700,
      lineHeight: "30px",
    },

    "& p": {
      margin: "4px 0 0",
      color: "var(--z-fg-secondary)",
      fontSize: "15px",
      lineHeight: "24px",
    },
  },
});

/**
 * Row at the end of a flow: an optional way back on the inline start, then
 * the primary action, which takes the remaining width
 */
const Actions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    marginTop: "8px",

    "& > :not([data-back])": { flex: "1 1 auto", minWidth: 0 },
  },
});

const backStyle = {
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  minHeight: "44px",
  paddingInline: "12px",
  border: "none",
  borderRadius: "10px",
  background: "transparent",
  color: "var(--z-fg-secondary)",
  font: "inherit",
  fontSize: "15px",
  fontWeight: 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
  "--z-icon-color": "currentColor",
  transition:
    "background-color var(--z-motion-fast, 120ms) ease, color var(--z-motion-fast, 120ms) ease",
  _motionReduce: { transition: "none" },
  _hover: { color: "var(--z-fg-primary)", background: "var(--z-nav-hover)" },
  _focusVisible: { outline: "2px solid var(--z-focus)", outlineOffset: "2px" },
  // the arrow points the way back in right-to-left languages too
  "& > .z-icon": { _rtl: { transform: "scaleX(-1)" } },
} as const;

const BackLink = styled(A, { base: backStyle });
const BackButton = styled("button", { base: backStyle });

/**
 * The actions of a flow: "Back" (a link or a handler) and the primary action
 */
export function FlowActions(props: {
  /** Where "Back" goes, or what it does */
  back?: string | (() => void);
  /** Label for the way back (default "Back") */
  backLabel?: JSX.Element;
  children?: JSX.Element;
}) {
  const label = () => (
    <>
      <Icon name="arrow-left" size={18} />
      {props.backLabel ?? <Trans>Back</Trans>}
    </>
  );

  return (
    <Actions>
      <Show when={props.back}>
        {(back) => {
          const target = back();
          return typeof target === "string" ? (
            <BackLink href={target} data-back>
              {label()}
            </BackLink>
          ) : (
            <BackButton type="button" onClick={target} data-back>
              {label()}
            </BackButton>
          );
        }}
      </Show>
      {props.children}
    </Actions>
  );
}

/**
 * Quiet links under a flow's actions (forgot password, resend link)
 */
export const FlowLinks = styled("nav", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "4px 16px",
    width: "100%",

    "& a": {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "32px",
      paddingInline: "4px",
      borderRadius: "var(--z-radius-xs, 4px)",
      color: "var(--z-link)",
      fontSize: "14px",
      fontWeight: 500,
      textDecoration: "none",
      _phone: { minHeight: "44px" },
      _hover: { textDecoration: "underline" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
  },
});

/** Flow text that isn't a heading (notices, explanations) */
export const FlowText = styled("p", {
  base: {
    margin: 0,
    color: "var(--z-fg-secondary)",
    fontSize: "15px",
    lineHeight: "22px",
  },
});

const ButtonSlot = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    "& > button": { width: "100%" },
  },
});

const Spinner = styled("span", {
  base: {
    width: "16px",
    height: "16px",
    flexShrink: 0,
    borderRadius: "50%",
    border: "2px solid currentColor",
    borderInlineEndColor: "transparent",
    animation: "spin 700ms linear infinite",
    // no spinning with reduced motion: a still ring still says "waiting"
    _motionReduce: { animation: "none", opacity: 0.7 },
  },
});

const VisuallyHidden = styled("span", {
  base: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    clip: "rect(0 0 0 0)",
    whiteSpace: "nowrap",
  },
});

/**
 * Primary button of a flow, 44 px high. While waiting on the server it
 * shows a spinner and says so to screen readers; a press while busy does
 * nothing (forms also refuse a second submit). It isn't greyed out, as
 * nothing is wrong.
 */
export function AuthButton(props: {
  type?: "submit" | "button";
  status?: "ready" | "submitting" | "success";
  onPress?: () => void;
  children: JSX.Element;
}) {
  const { t } = useLingui();
  const busy = () =>
    props.status === "submitting" || props.status === "success";

  return (
    <ButtonSlot>
      <Button
        type={props.type ?? "button"}
        size="xl"
        onPress={() => !busy() && props.onPress?.()}
      >
        <Switch>
          <Match when={props.status === "submitting"}>
            <Spinner aria-hidden="true" />
          </Match>
          <Match when={props.status === "success"}>
            <Icon name="check-circle" size={18} aria-hidden="true" />
          </Match>
        </Switch>
        {props.children}
      </Button>
      <VisuallyHidden role="status">
        {props.status === "submitting" ? t`Please wait…` : ""}
      </VisuallyHidden>
    </ButtonSlot>
  );
}

/**
 * Development-only shortcuts (mock submissions) appear with ?mock in the
 * address, so they never cover the real screens while testing
 */
export function showDevMocks() {
  return (
    import.meta.env.DEV && new URLSearchParams(location.search).has("mock")
  );
}

const Bubble = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    width: "62px",
    height: "50px",
    marginBottom: "16px",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-soft)",
    boxSizing: "border-box",
    borderRadius: "14px",
    borderEndStartRadius: "6px",
    transition: "background 240ms ease",
    // rapid clicks on the bubble shouldn't select text around it
    userSelect: "none",

    "& span": {
      width: "6px",
      height: "6px",
      background: "var(--z-fg-secondary)",
      borderRadius: "50%",
      transition: "background 240ms ease",
      // looping motion for each mood is driven from FlowBubble
      animation:
        "authDotIn 420ms cubic-bezier(0.2, 0.9, 0.3, 1.2) calc(80ms + var(--dot) * 120ms) both",
    },

    "& span:nth-child(1)": { "--dot": "0" },
    "& span:nth-child(2)": { "--dot": "1" },
    "& span:nth-child(3)": { "--dot": "2" },

    '&[data-mood="error"]': {
      background: "var(--z-danger-muted, var(--md-sys-color-error-container))",
    },

    '&[data-mood="error"] span': {
      background: "var(--z-danger, var(--md-sys-color-on-error-container))",
    },

    "& svg": {
      position: "absolute",
      inset: 0,
      margin: "auto",
      width: "22px",
      height: "22px",
      fill: "none",
      stroke: "var(--z-live)",
      strokeWidth: 2.6,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeDasharray: 1,
      strokeDashoffset: 1,
      opacity: 0,
      // fade out first, then reset the stroke once it can't be seen
      transition: "opacity 150ms ease, stroke-dashoffset 0s linear 150ms",
    },

    '&[data-mood="success"]': {
      background: "var(--z-live-muted)",
    },

    '&[data-mood="success"] svg': {
      opacity: 1,
      strokeDashoffset: 0,
      // draw the check once the dots have gathered in the middle
      transition:
        "opacity 80ms ease 160ms, stroke-dashoffset 340ms cubic-bezier(0.2, 0, 0, 1) 160ms",
    },

    "@media (prefers-reduced-motion: reduce)": {
      "& span": {
        animation: "none",
      },

      '&[data-mood="submitting"] span': {
        opacity: 0.5,
      },

      '&[data-mood="success"] span': {
        opacity: 0,
      },

      "& svg, &[data-mood='success'] svg": {
        transition: "none",
      },
    },
  },
});

/**
 * What the bubble is currently reacting to
 */
export type BubbleMood = "idle" | "typing" | "submitting" | "success" | "error";

/**
 * Distance between neighbouring dot centres (dot size + gap)
 */
const DOT_SPACING = 11;

/**
 * Radius of the ring the dots spin around while loading
 */
const SPIN_RADIUS = 8;

/**
 * Keyframes that carry a dot one full turn around the bubble's centre, a
 * third of a turn from its neighbours
 */
function spinKeyframes(index: number): Keyframe[] {
  const steps = 24;
  // offset from the dot's resting place in the row to the bubble's centre
  const toCentre = (1 - index) * DOT_SPACING;

  return Array.from({ length: steps + 1 }, (_, step) => {
    const angle = 2 * Math.PI * (step / steps + (index - 1) / 3) - Math.PI / 2;
    const x = toCentre + SPIN_RADIUS * Math.cos(angle);
    const y = SPIN_RADIUS * Math.sin(angle);
    return { translate: `${x.toFixed(2)}px ${y.toFixed(2)}px`, opacity: 1 };
  });
}

/**
 * Looping motion for each mood, applied to every dot with a stagger
 */
const DOT_MOTION: Record<
  BubbleMood,
  {
    keyframes: Keyframe[] | ((index: number) => Keyframe[]);
    duration: number;
    stagger: number;
    iterations?: number;
    easing?: string;
  }
> = {
  // slow, gentle float
  idle: {
    keyframes: [
      { translate: "0 0", opacity: 1 },
      { translate: "0 -3px", opacity: 1 },
      { translate: "0 0", opacity: 1 },
    ],
    duration: 1600,
    stagger: 240,
  },
  // dots stay put and pulse in sequence, like a typing indicator
  typing: {
    keyframes: [
      { translate: "0 0", opacity: 0.3 },
      { translate: "0 0", opacity: 1, offset: 0.4 },
      { translate: "0 0", opacity: 0.3 },
    ],
    duration: 1200,
    stagger: 200,
  },
  // dots gather into a ring and spin while waiting on the server
  submitting: {
    keyframes: spinKeyframes,
    duration: 900,
    stagger: 0,
    easing: "linear",
  },
  // dots gather in the middle and fade so the check can draw in their place
  success: {
    keyframes: (index) => [
      { translate: `${(1 - index) * DOT_SPACING}px 0`, opacity: 0 },
    ],
    duration: 1,
    stagger: 0,
    iterations: 1,
  },
  // dots settle while the bubble shakes
  error: {
    keyframes: [{ translate: "0 0", opacity: 1 }],
    duration: 1,
    stagger: 0,
    iterations: 1,
  },
};

/**
 * How long a dot takes to ease from its current position into a new mood
 */
const MOOD_BRIDGE_MS = 220;

/**
 * Delay before the idle float starts, so it follows the entry animation
 */
const ENTRY_MS = 500;

/**
 * A click within this long of the last reaction finishing counts towards the
 * bubble's annoyance; a longer pause starts over
 */
const POKE_STREAK_MS = 2000;

/**
 * Click in a streak at which the dots get dizzy, then give up and scatter
 */
const POKE_DIZZY_AT = 3;
const POKE_SCATTER_AT = 4;

/**
 * How far dots may stray from the bubble's centre while scattered, keeping
 * them inside its edges
 */
const SCATTER_BOUNDS = { x: 24, y: 17 };

/**
 * Moods in which the bubble reacts to being clicked
 */
const POKEABLE: BubbleMood[] = ["idle", "typing"];

interface BubbleControls {
  /**
   * Show a submission as in flight until the returned function is called
   */
  beginSubmit(): () => void;

  /**
   * Briefly show that something went wrong
   */
  flashError(): void;

  /**
   * Briefly show that something worked
   */
  flashSuccess(): void;
}

const BubbleContext = createContext<BubbleControls>();

export const BubbleProvider = BubbleContext.Provider;

/**
 * Let a flow tell the shared bubble what is happening
 */
export function useFlowBubble() {
  return useContext(BubbleContext);
}

/**
 * Chat bubble shown above every logged-out flow.
 */
export function FlowBubble(props: {
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void);
  mood: BubbleMood;
  /**
   * Changes every time an error is flashed, so repeat errors shake again
   */
  errorCount: number;
  /**
   * Context menu opened by right-clicking the bubble
   */
  contextMenu?: () => JSX.Element;
}) {
  let bubble: HTMLDivElement | undefined;
  const dots: HTMLSpanElement[] = [];
  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // click reactions, layered on top of whatever the dots are doing
  let pokes = 0;
  // when the current reaction finishes; clicks until then are ignored
  let reactingUntil = 0;
  let reactions: Animation[] = [];

  function stopReactions() {
    reactions.forEach((animation) => animation.cancel());
    reactions = [];
  }

  /**
   * Play an animation on top of the current mood, cancelled on mood change
   */
  function react(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    reactions.push(
      element.animate(keyframes, { composite: "add", ...options }),
    );
  }

  /**
   * React to a click, more dramatically the more it gets clicked
   */
  function poke(event: MouseEvent) {
    if (event.button !== 0 || reduceMotion()) return;
    if (!POKEABLE.includes(props.mood)) return;

    const now = performance.now();
    if (now < reactingUntil) return;

    pokes = now - reactingUntil < POKE_STREAK_MS ? pokes + 1 : 1;
    stopReactions();

    if (pokes >= POKE_SCATTER_AT) {
      pokes = 0;
      scatter();
    } else if (pokes >= POKE_DIZZY_AT) {
      dizzy();
    } else {
      hop(pokes);
    }

    const longest = Math.max(
      ...reactions.map((animation) =>
        Number(animation.effect?.getComputedTiming().endTime ?? 0),
      ),
    );
    reactingUntil = now + longest;
  }

  /**
   * Dots jump with fright and the bubble flinches, higher on a second poke
   */
  function hop(level: number) {
    const height = 6 + level * 2;

    dots.forEach((dot, index) =>
      react(
        dot,
        [
          { translate: "0 0" },
          { translate: `0 -${height}px`, offset: 0.35 },
          { translate: "0 1px", offset: 0.75 },
          { translate: "0 0" },
        ],
        { duration: 380, delay: index * 25, easing: "ease-out" },
      ),
    );

    react(
      bubble!,
      [
        { rotate: "0deg" },
        { rotate: "-4deg", offset: 0.3 },
        { rotate: "0deg" },
      ],
      { duration: 320, easing: "ease-out" },
    );
  }

  /**
   * Each dot spins in a small circle around its own spot, like dizzy eyes,
   * while the bubble wobbles
   */
  function dizzy() {
    const radius = 3;
    const steps = 16;

    dots.forEach((dot, index) =>
      react(
        dot,
        // a circle that passes through the dot's own position
        Array.from({ length: steps + 1 }, (_, step) => {
          const angle = (2 * Math.PI * step) / steps;
          const x = radius * Math.sin(angle);
          const y = radius * (Math.cos(angle) - 1);
          return { translate: `${x.toFixed(2)}px ${y.toFixed(2)}px` };
        }),
        {
          duration: 420,
          iterations: 2,
          delay: index * 40,
          easing: "linear",
        },
      ),
    );

    react(
      bubble!,
      [
        { rotate: "0deg" },
        { rotate: "6deg" },
        { rotate: "-5deg" },
        { rotate: "3deg" },
        { rotate: "0deg" },
      ],
      { duration: 700, easing: "ease-in-out" },
    );
  }

  /**
   * Dots bounce around the inside of the bubble, then gather back into their
   * row
   */
  function scatter() {
    const duration = 1400;
    const bounces = 4;
    const random = (limit: number) => (Math.random() * 2 - 1) * limit;

    dots.forEach((dot, index) => {
      // offset from the dot's resting place in the row to the bubble's centre
      const toCentre = (1 - index) * DOT_SPACING;
      const stops = Array.from({ length: bounces }, (_, bounce) => ({
        translate: `${(toCentre + random(SCATTER_BOUNDS.x)).toFixed(1)}px ${random(SCATTER_BOUNDS.y).toFixed(1)}px`,
        offset: ((bounce + 1) / (bounces + 2)) * 0.9,
        easing: "cubic-bezier(0.3, 0.7, 0.4, 1)",
      }));

      react(
        dot,
        [
          { translate: "0 0", easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" },
          ...stops,
          // settle back with a little overshoot
          { translate: "0 2px", offset: 0.9, easing: "ease-out" },
          { translate: "0 0" },
        ],
        { duration, delay: index * 30 },
      );
    });

    // the bubble shakes itself off once the dots are back
    react(
      bubble!,
      [
        { rotate: "0deg", offset: 0 },
        { rotate: "0deg", offset: 0.82 },
        { rotate: "-3deg", offset: 0.88 },
        { rotate: "3deg", offset: 0.94 },
        { rotate: "0deg" },
      ],
      { duration: duration + 100 },
    );
  }

  /**
   * Swap every dot into the motion for a mood, easing from where it is now
   */
  function applyMood(mood: BubbleMood, initial: boolean) {
    const motion = DOT_MOTION[mood];

    // something real is happening, so stop fooling around
    if (!POKEABLE.includes(mood)) {
      stopReactions();
      pokes = 0;
      reactingUntil = 0;
    }

    dots.forEach((dot, index) => {
      const keyframes =
        typeof motion.keyframes === "function"
          ? motion.keyframes(index)
          : motion.keyframes;
      const style = getComputedStyle(dot);
      const current = { translate: style.translate, opacity: style.opacity };

      for (const animation of dot.getAnimations()) {
        // keep the CSS entry animation, replace the previous mood
        if (!(animation instanceof CSSAnimation)) animation.cancel();
      }

      const lead = initial ? ENTRY_MS : MOOD_BRIDGE_MS;

      dot.animate(keyframes, {
        duration: motion.duration,
        delay: lead + index * motion.stagger,
        iterations: motion.iterations ?? Infinity,
        easing: motion.easing ?? "ease-in-out",
        // hold the first frame during the stagger delay so nothing jumps,
        // except on first load, where it would hide the CSS fade-in
        fill: initial ? "forwards" : "both",
      });

      if (!initial) {
        // created last so it wins while blending into the new loop
        dot.animate([current, keyframes[0]], {
          duration: MOOD_BRIDGE_MS,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        });
      }
    });
  }

  onMount(() => {
    if (!reduceMotion()) applyMood(props.mood, true);
  });

  createEffect(
    on(
      () => props.mood,
      (mood) => {
        if (!reduceMotion()) applyMood(mood, false);
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      () => props.errorCount,
      () => {
        if (reduceMotion()) return;

        bubble?.animate(
          [
            { translate: "0 0" },
            { translate: "-5px 0" },
            { translate: "4px 0" },
            { translate: "-3px 0" },
            { translate: "2px 0" },
            { translate: "0 0" },
          ],
          { duration: 380, easing: "ease-out" },
        );
      },
      { defer: true },
    ),
  );

  return (
    <Bubble
      ref={(el) => {
        bubble = el;
        if (typeof props.ref === "function") props.ref(el);
        // apply the floating directive by hand, as directives can't be put on
        // a styled component; floating reads the accessor inside its effects
        if (props.contextMenu)
          // eslint-disable-next-line solid/reactivity
          floating(el, () => ({ contextMenu: props.contextMenu }));
      }}
      data-mood={props.mood}
      aria-hidden="true"
      onClick={poke}
    >
      <span ref={(el) => (dots[0] = el)} />
      <span ref={(el) => (dots[1] = el)} />
      <span ref={(el) => (dots[2] = el)} />
      <svg viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength="1" />
      </svg>
    </Bubble>
  );
}

/**
 * Common heading for all logged-out flows.
 */
export function FlowTitle(props: {
  children: JSX.Element;
  subtitle?: JSX.Element;
}) {
  return (
    <Heading>
      <h1>{props.children}</h1>
      <Show when={props.subtitle}>
        <p>{props.subtitle}</p>
      </Show>
    </Heading>
  );
}
