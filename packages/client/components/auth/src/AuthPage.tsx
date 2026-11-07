import {
  JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onCleanup,
  onMount,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import {
  ContextMenu,
  ContextMenuButton,
  ContextMenuDivider,
} from "@revolt/app/menus/ContextMenu";
import { useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { brandMarkSrc } from "@revolt/common/lib/brandMark";
import { SOURCE_CODE_URL } from "@revolt/common/lib/buildInfo";
import { A, useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { IconButton, iconSize } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { dark_mode as MdDarkMode } from "@revolt/ui/icons/legacy";

import { BrandName } from "@revolt/ui/components/design/BrandName";
import { Sky } from "@revolt/ui/components/design/Sky";
import { BubbleMood, BubbleProvider, FlowBase, FlowBubble } from "./flows/Flow";

import GitHub from "./flows/github.svg?component-solid";

const Root = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-frame)",
    overflow: "hidden",
  },
});

// Only the page scrolls; desktop window controls stay outside this viewport.
const PageViewport = styled("div", {
  base: {
    flex: "1 1 0",
    minHeight: 0,
    overflowX: "hidden",
    overflowY: "auto",
  },
});

/** One calm column under the flock; the sky runs behind the top of it */
const Page = styled("main", {
  base: {
    position: "relative",
    isolation: "isolate",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    width: "100%",
    minHeight: "100%",
    padding: "16px 24px",
    _phone: { padding: "8px 16px 16px" },
  },
});

const SkyBand = styled("div", {
  base: {
    position: "absolute",
    zIndex: -1,
    insetInline: 0,
    top: 0,
    height: "320px",
    overflow: "hidden",
    _phone: { height: "176px" },
  },
});

/** The lockup: the mark, unchanged, and the name as text */
const Brand = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
    "& img": { display: "block", objectFit: "contain" },
  },
});

const Topbar = styled("header", {
  base: {
    display: "flex",
    alignItems: "center",
    minHeight: "48px",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const TopbarActions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    "@media (max-width: 460px)": { gap: "8px" },
  },
});

const AccountSwitch = styled("div", {
  base: {
    display: "flex",
    "&[hidden]": { display: "none" },
    alignItems: "center",
    gap: "12px",
    fontSize: "13px",
    lineHeight: "20px",
    whiteSpace: "nowrap",

    "& span": {
      color: "var(--z-fg-secondary)",
    },

    "& a": {
      display: "inline-flex",
      alignItems: "center",
      // 44 px tap target on phones (phone rules)
      _phone: { minHeight: "44px" },
      minHeight: "36px",
      boxSizing: "border-box",
      paddingInline: "12px",
      // sits on the sky: a solid fill keeps the words clear of the birds
      background: "var(--z-bg-frame)",
      color: "var(--z-fg-primary)",
      border: "1px solid var(--z-btn-outline-border)",
      borderRadius: "10px",
      fontWeight: 600,
      textDecoration: "none",
      transition: "background-color 120ms ease",
      _motionReduce: { transition: "none" },
    },

    "& a:hover": { background: "var(--z-nav-hover)" },
    "& a:active": { background: "var(--z-nav-selected)" },

    "@media (max-width: 600px)": {
      "& span": { display: "none" },
    },
  },
});

const FlowWrap = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
    paddingBlock: "40px 32px",
    _phone: { alignItems: "flex-start", paddingBlock: "32px 16px" },
  },
});

const FlowStack = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    width: "100%",
    maxWidth: "400px",
    margin: "auto 0",
  },
});

const Footer = styled("footer", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    minHeight: "44px",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    lineHeight: "20px",

    "& nav": {
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },

    "& a": {
      display: "inline-flex",
      alignItems: "center",
      // 24 px target (WCAG 2.5.8), 44 px on phones
      minHeight: "24px",
      _phone: { minHeight: "44px", minWidth: "44px", justifyContent: "center" },
      color: "inherit",
      textDecoration: "none",
    },

    "& a:hover": { color: "var(--z-fg-primary)" },
  },
});

const Socials = styled("nav", {
  base: {
    "& a": {
      display: "grid",
      height: "28px",
      minWidth: "28px",
      placeItems: "center",
      _phone: { height: "44px", minWidth: "44px" },
    },

    "& svg": {
      color: "inherit",
    },
  },
});

let hasMountedAuthFlow = false;

/**
 * How long after the last keystroke the bubble keeps showing typing
 */
const TYPING_IDLE_MS = 1000;

/**
 * How long the bubble shows an error before settling again
 */
const ERROR_FLASH_MS = 900;

/**
 * How long the bubble shows a success before settling again
 */
const SUCCESS_FLASH_MS = 1400;

/**
 * Shared layout for every logged-out account flow.
 */
export function AuthPage(props: { children?: JSX.Element }) {
  const { t } = useLingui();
  const state = useState();
  const location = useLocation();
  const { lifecycle } = useClientLifecycle();
  const isCreate = () => location.pathname.includes("/login/create");

  const [typing, setTyping] = createSignal(false);
  const [pendingSubmits, setPendingSubmits] = createSignal(0);
  const [erroring, setErroring] = createSignal(false);
  const [succeeding, setSucceeding] = createSignal(false);
  const [errorCount, setErrorCount] = createSignal(0);
  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let successTimer: ReturnType<typeof setTimeout> | undefined;

  onCleanup(() => {
    clearTimeout(typingTimer);
    clearTimeout(errorTimer);
    clearTimeout(successTimer);
  });

  // most important first: errors, waiting on the server, success, typing
  const bubbleMood = createMemo<BubbleMood>(() => {
    if (erroring()) return "error";
    if (pendingSubmits() > 0 || lifecycle.state() === State.LoggingIn)
      return "submitting";
    if (succeeding()) return "success";
    if (typing()) return "typing";
    return "idle";
  });

  const bubbleControls = {
    beginSubmit() {
      setPendingSubmits((count) => count + 1);

      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        setPendingSubmits((count) => count - 1);
      };
    },
    flashError() {
      clearTimeout(successTimer);
      setSucceeding(false);
      setErroring(true);
      setErrorCount((count) => count + 1);
      clearTimeout(errorTimer);
      errorTimer = setTimeout(() => setErroring(false), ERROR_FLASH_MS);
    },
    flashSuccess() {
      clearTimeout(errorTimer);
      setErroring(false);
      setSucceeding(true);
      clearTimeout(successTimer);
      successTimer = setTimeout(() => setSucceeding(false), SUCCESS_FLASH_MS);
    },
  };

  /**
   * Dev-only: keep typing for a couple of seconds
   */
  function debugType() {
    const smash = setInterval(onFlowInput, 150);
    setTimeout(() => clearInterval(smash), 2000);
  }

  /**
   * Dev-only: pretend the server takes a while to answer
   */
  function debugSubmit() {
    setTimeout(bubbleControls.beginSubmit(), 2500);
  }

  /**
   * Dev-only: play every mood back to back
   */
  function debugChaos() {
    onFlowInput();
    setTimeout(() => {
      const finish = bubbleControls.beginSubmit();
      setTimeout(() => {
        finish();
        bubbleControls.flashError();
        setTimeout(() => {
          const finishAgain = bubbleControls.beginSubmit();
          setTimeout(() => {
            finishAgain();
            bubbleControls.flashSuccess();
          }, 1500);
        }, 800);
      }, 1500);
    }, 900);
  }

  /**
   * Treat any input inside the current flow as typing
   */
  function onFlowInput() {
    setTyping(true);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping(false), TYPING_IDLE_MS);
  }
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let flowElement: HTMLDivElement | undefined;
  let bubbleElement: HTMLDivElement | undefined;
  let activeFlowAnimation: Animation | undefined;
  let activeBubbleAnimation: Animation | undefined;
  let bubbleTop: number | undefined;
  // until the first layout settles (e.g. web fonts swapping in), the bubble
  // snaps to its position instead of gliding into view
  let bubbleSettled = false;

  /**
   * Glide the shared bubble to its new position when the flow below it
   * changes height, starting from wherever it is currently drawn.
   */
  function followFlowHeight() {
    if (!bubbleElement) return;

    const nextTop = bubbleElement.offsetTop;
    const previousTop = bubbleTop;
    bubbleTop = nextTop;

    if (
      !bubbleSettled ||
      previousTop === undefined ||
      previousTop === nextTop ||
      reduceMotion
    )
      return;

    // offset of an in-flight glide, relative to the previous position
    const inFlight = new DOMMatrixReadOnly(
      getComputedStyle(bubbleElement).transform,
    ).m42;

    activeBubbleAnimation?.cancel();
    activeBubbleAnimation = bubbleElement.animate(
      [
        { transform: `translateY(${previousTop + inFlight - nextTop}px)` },
        { transform: "translateY(0)" },
      ],
      {
        duration: 140,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
    );
  }

  onMount(() => {
    followFlowHeight();

    const observer = new ResizeObserver(followFlowHeight);
    observer.observe(flowElement!);
    onCleanup(() => observer.disconnect());

    document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          bubbleTop = bubbleElement?.offsetTop;
          bubbleSettled = true;
        }),
      ),
    );
  });

  createEffect(
    on(
      () => location.pathname,
      () => {
        const shouldAnimate = hasMountedAuthFlow;
        hasMountedAuthFlow = true;

        if (shouldAnimate && !reduceMotion) {
          requestAnimationFrame(() => {
            activeFlowAnimation?.cancel();
            activeFlowAnimation = flowElement?.animate(
              [
                {
                  opacity: 0,
                  transform: "translate3d(20px, 6px, 0)",
                },
                {
                  opacity: 1,
                  transform: "translate3d(0, 0, 0)",
                },
              ],
              {
                duration: 280,
                easing: "cubic-bezier(0.05, 0.7, 0.1, 1)",
              },
            );
          });
        }
      },
    ),
  );

  return (
    <Root>
      {/* desktop app only: window controls and drag area, no page title */}
      <Show when={window.native}>
        <Titlebar bare />
      </Show>
      <PageViewport data-auth-scroll>
        <Page>
          <SkyBand>
            <Sky />
          </SkyBand>
            <Topbar>
              <Brand>
                <img
                  src={brandMarkSrc(state.theme.activeTheme.darkMode)}
                  alt=""
                  width={32}
                  height={32}
                />
                <BrandName />
              </Brand>

              <TopbarActions>
                {/* signed in already (username or age step): no switching */}
                <AccountSwitch
                  hidden={[State.Onboarding, State.AgeRequired].includes(
                    lifecycle.state(),
                  )}
                >
                  <Show
                    when={isCreate()}
                    fallback={
                      <>
                        <span>
                          <Trans>New to Zrzur?</Trans>
                        </span>
                        <A href="/login/create">
                          <Trans>Create account</Trans>
                        </A>
                      </>
                    }
                  >
                    <span>
                      <Trans>Already have an account?</Trans>
                    </span>
                    <A href="/login/auth">
                      <Trans>Log in</Trans>
                    </A>
                  </Show>
                </AccountSwitch>

                <IconButton
                  aria-label={t`Toggle colour theme`}
                  onPress={() =>
                    state.theme.setMode(
                      state.theme.activeTheme.darkMode ? "light" : "dark",
                    )
                  }
                >
                  <MdDarkMode {...iconSize("20px")} />
                </IconButton>
              </TopbarActions>
            </Topbar>

            <FlowWrap>
              <FlowStack>
                <FlowBubble
                  ref={bubbleElement}
                  mood={bubbleMood()}
                  errorCount={errorCount()}
                  contextMenu={
                    import.meta.env.DEV
                      ? () => (
                          <ContextMenu>
                            <ContextMenuButton
                              icon={<Symbol size={16}>keyboard</Symbol>}
                              onClick={debugType}
                            >
                              Typing
                            </ContextMenuButton>
                            <ContextMenuButton
                              icon={<Symbol size={16}>hourglass_empty</Symbol>}
                              onClick={debugSubmit}
                            >
                              Submitting
                            </ContextMenuButton>
                            <ContextMenuButton
                              icon={<Symbol size={16}>error</Symbol>}
                              onClick={() => bubbleControls.flashError()}
                            >
                              Error
                            </ContextMenuButton>
                            <ContextMenuButton
                              icon={<Symbol size={16}>check_circle</Symbol>}
                              onClick={() => bubbleControls.flashSuccess()}
                            >
                              Success
                            </ContextMenuButton>
                            <ContextMenuDivider />
                            <ContextMenuButton
                              icon={<Symbol size={16}>play_arrow</Symbol>}
                              onClick={debugChaos}
                            >
                              <Trans>Play all</Trans>
                            </ContextMenuButton>
                          </ContextMenu>
                        )
                      : undefined
                  }
                />
                <div
                  ref={flowElement}
                  style={{ width: "100%" }}
                  onInput={onFlowInput}
                >
                  <BubbleProvider value={bubbleControls}>
                    <FlowBase>{props.children}</FlowBase>
                  </BubbleProvider>
                </div>
              </FlowStack>
            </FlowWrap>

            <Footer>
              <nav aria-label={t`Legal`}>
                {/* the legal pages and the guide live on the website */}
                <a
                  href="https://zrzur.com/legal/terms"
                  target="_blank"
                  rel="noopener"
                >
                  <Trans>Terms</Trans>
                </a>
                <a
                  href="https://zrzur.com/legal/privacy"
                  target="_blank"
                  rel="noopener"
                >
                  <Trans>Privacy</Trans>
                </a>
                <a
                  href="https://zrzur.com/guide"
                  target="_blank"
                  rel="noopener"
                >
                  <Trans>Help</Trans>
                </a>
              </nav>
              <Socials aria-label={t`Social links`}>
                <a
                  href={SOURCE_CODE_URL}
                  target="_blank"
                  aria-label="GitHub"
                >
                  <GitHub width={20} height={20} />
                </a>
              </Socials>
            </Footer>
        </Page>
      </PageViewport>
    </Root>
  );
}
