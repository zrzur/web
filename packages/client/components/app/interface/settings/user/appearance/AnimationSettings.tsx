import {
  type JSX,
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import {
  Button,
  FloatingSelect,
  MenuItem,
  Segmented,
  SettingsRow,
  SettingsSection,
  Slider,
  Toggle,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import {
  type MotionArea,
  type MotionDirection,
  type MotionEasing,
  type MotionMode,
  type MotionPhase,
  type MotionStyle,
  type ReduceMotion,
  AREA_DEFINITIONS,
  DIRECTIONAL_STYLES,
  MAX_DURATION,
  MOTION_AREAS,
  MOTION_DIRECTIONS,
  MOTION_EASINGS,
  playMotion,
} from "@revolt/ui/motion";

/**
 * Pause between the preview's open and close, in ms
 */
const PREVIEW_HOLD_MS = 700;
const PREVIEW_REST_MS = 250;

/**
 * Appearance → Animations: how each part of the app moves
 */
export function AnimationSettings() {
  const state = useState();
  const { t } = useLingui();
  const [selected, setSelected] = createSignal<MotionArea>("popouts");

  const areaText = (area: MotionArea) =>
    ({
      servers: {
        name: t`Switching servers`,
        description: t`The channel list and page when you open another server.`,
      },
      channels: {
        name: t`Switching channels`,
        description: t`The page when you open another channel or conversation.`,
      },
      settings: {
        name: t`Settings pages`,
        description: t`Each settings page as it opens.`,
      },
      popouts: {
        name: t`Popouts`,
        description: t`Profile cards and suggestions while you type.`,
      },
      contextMenus: {
        name: t`Context menus`,
        description: t`Menus that open with a right-click.`,
      },
      tooltips: {
        name: t`Tooltips`,
        description: t`Small labels that appear when you point at a button.`,
      },
      messages: {
        name: t`New and deleted messages`,
        description: t`Messages from others as they arrive, and messages as they are removed.`,
      },
      channelList: {
        name: t`Channel categories`,
        description: t`Channel rows when you open or close a category.`,
      },
      modals: {
        name: t`Dialogs`,
        description: t`Windows that open on top of the app.`,
      },
      backdrop: {
        name: t`Dialog background`,
        description: t`The dimmed page behind a dialog.`,
      },
      panels: {
        name: t`Side panels`,
        description: t`Member list, search results and pinned messages.`,
      },
    })[area];

  const styleName = (style: MotionStyle) =>
    ({
      none: t`None`,
      fade: t`Fade`,
      slide: t`Slide`,
      scale: t`Scale`,
      blur: t`Blur`,
      rise: t`Rise`,
      glide: t`Glide`,
      pop: t`Pop`,
      unfold: t`Unfold`,
    })[style];

  const easingName = (easing: MotionEasing) =>
    ({
      smooth: t`Smooth`,
      settle: t`Soft landing`,
      accelerate: t`Speed up`,
      even: t`Even`,
      bouncy: t`Bouncy`,
      linear: t`Steady`,
    })[easing];

  const directionName = (direction: MotionDirection) =>
    ({
      up: t`From below`,
      down: t`From above`,
      start: t`From the start`,
      end: t`From the end`,
    })[direction];

  const settings = () => state.motion.area(selected());
  const definition = () => AREA_DEFINITIONS[selected()];
  const hasExit = () => definition().phases.includes("exit");

  /*
   * Live preview: plays the selected part's opening, then its closing,
   * with the real settings. Replays whenever a setting changes.
   */
  let target: HTMLElement | undefined;
  let run = 0;
  const wait = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function play() {
    const id = ++run;
    const area = selected();
    const element = target;
    if (!element) return;
    const options = { backdrop: area === "backdrop" };
    const step = (phase: MotionPhase) =>
      playMotion(state.motion, element, area, phase, options);

    await step("enter");
    if (id !== run || !AREA_DEFINITIONS[area].phases.includes("exit")) return;
    await wait(PREVIEW_HOLD_MS);
    if (id !== run) return;
    await step("exit");
    if (id !== run) return;
    await wait(PREVIEW_REST_MS);
    if (id !== run) return;
    await step("enter");
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  createEffect(
    on(
      () => [
        selected(),
        JSON.stringify(settings()),
        state.motion.reduced,
        state.motion.active,
      ],
      () => {
        clearTimeout(timer);
        timer = setTimeout(play, 120);
      },
    ),
  );
  onCleanup(() => {
    clearTimeout(timer);
    run++;
  });

  /**
   * Controls for one phase ("both" in the simple view)
   */
  const phaseControls = (phase: MotionPhase | "both") => {
    const value = () => settings()[phase === "both" ? "enter" : phase];
    const set = (patch: Parameters<typeof state.motion.setPhase>[2]) =>
      state.motion.setPhase(selected(), phase, patch);
    const disabled = () => !settings().enabled;

    return (
      <>
        <SettingsRow
          icon={<Icon name="sparkle" size={20} />}
          title={<Trans>Style</Trans>}
          disabled={disabled()}
          control={(ids) => (
            <SelectBox>
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={value().style}
                disabled={disabled()}
                onChange={(event) =>
                  set({ style: event.currentTarget.value as MotionStyle })
                }
              >
                <For each={definition().styles}>
                  {(style) => (
                    <MenuItem value={style}>{styleName(style)}</MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </SelectBox>
          )}
        />
        <Show when={DIRECTIONAL_STYLES.includes(value().style)}>
          <SettingsRow
            icon={<Icon name="compass" size={20} />}
            title={<Trans>Direction</Trans>}
            disabled={disabled()}
            control={(ids) => (
              <SelectBox>
                <FloatingSelect
                  aria-labelledby={ids.labelId}
                  value={value().direction}
                  disabled={disabled()}
                  onChange={(event) =>
                    set({
                      direction: event.currentTarget.value as MotionDirection,
                    })
                  }
                >
                  <For each={[...MOTION_DIRECTIONS]}>
                    {(direction) => (
                      <MenuItem value={direction}>
                        {directionName(direction)}
                      </MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectBox>
            )}
          />
        </Show>
        <SettingsRow
          icon={<Icon name="timer" size={20} />}
          title={<Trans>Duration</Trans>}
          disabled={disabled()}
          control={() => (
            <SliderBox>
              <Slider
                aria-label={t`Duration`}
                min={0}
                max={MAX_DURATION}
                step={10}
                value={value().duration}
                labelFormatter={(v) => t`${v} ms`}
                onInput={(event) =>
                  set({ duration: Number(event.currentTarget.value) })
                }
              />
            </SliderBox>
          )}
        />
        <SettingsRow
          icon={<Icon name="waveform" size={20} />}
          title={<Trans>Speed curve</Trans>}
          disabled={disabled()}
          control={(ids) => (
            <SelectBox>
              <FloatingSelect
                aria-labelledby={ids.labelId}
                value={value().easing}
                disabled={disabled()}
                onChange={(event) =>
                  set({ easing: event.currentTarget.value as MotionEasing })
                }
              >
                <For each={[...MOTION_EASINGS]}>
                  {(easing) => (
                    <MenuItem value={easing}>{easingName(easing)}</MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </SelectBox>
          )}
        />
      </>
    );
  };

  return (
    <SettingsSection
      title={<Trans>Animations</Trans>}
      description={
        <Trans>
          Choose how each part of Zrzur moves. The preview shows every change
          right away.
        </Trans>
      }
    >
      <SettingsRow
        icon={<Icon name="sparkle" size={20} />}
        title={<Trans>Use animations</Trans>}
        description={
          <Switch>
            <Match when={state.motion.mode === "off"}>
              <Trans>Nothing moves. This is the default.</Trans>
            </Match>
            <Match when={state.motion.mode === "auto" && state.motion.lowPower}>
              <Trans>
                Only on strong devices. This device is not strong enough, so
                animations stay off.
              </Trans>
            </Match>
            <Match when={state.motion.mode === "auto"}>
              <Trans>
                Only on strong devices. This device is strong enough, so
                animations play.
              </Trans>
            </Match>
            <Match when={state.motion.mode === "on"}>
              <Trans>Animations always play, with the settings below.</Trans>
            </Match>
          </Switch>
        }
        control={(ids) => (
          <Segmented<MotionMode>
            aria-labelledby={ids.labelId}
            value={state.motion.mode}
            onChange={(value) => state.motion.setMode(value)}
            options={[
              { value: "off", label: <Trans>Off</Trans> },
              { value: "auto", label: <Trans>Automatic</Trans> },
              { value: "on", label: <Trans>On</Trans> },
            ]}
          />
        )}
      />

      <Show when={state.motion.mode !== "off"}>
        <SettingsRow
          icon={<Icon name="person-arms-spread" size={20} />}
          title={<Trans>Reduce motion</Trans>}
          description={
            <>
              <Trans>Swaps movement and zoom for short fades.</Trans>{" "}
              <Show
                when={state.motion.deviceReduced}
                fallback={<Trans>Your device allows full motion.</Trans>}
              >
                <Trans>Your device asks for less motion.</Trans>
              </Show>
            </>
          }
          control={(ids) => (
            <Segmented<ReduceMotion>
              aria-labelledby={ids.labelId}
              value={state.motion.reduce}
              onChange={(value) => state.motion.setReduce(value)}
              options={[
                { value: "system", label: <Trans>Follow device</Trans> },
                { value: "on", label: <Trans>Reduce</Trans> },
                { value: "off", label: <Trans>Full</Trans> },
              ]}
            />
          )}
        />
        <SettingsRow
          icon={<Icon name="sliders-horizontal" size={20} />}
          title={<Trans>Separate opening and closing</Trans>}
          description={
            <Trans>
              Set how things appear and how they leave on their own.
            </Trans>
          }
          onClick={() => state.motion.setAdvanced(!state.motion.advanced)}
          control={(ids) => (
            <Toggle
              checked={state.motion.advanced}
              onChange={() => state.motion.setAdvanced(!state.motion.advanced)}
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
          )}
        />

        <Editor>
          <AreaPicker
            areas={[...MOTION_AREAS]}
            value={selected()}
            onChange={setSelected}
            label={t`Part of the app`}
            name={(area) => areaText(area).name}
            off={(area) => !state.motion.area(area).enabled}
            offLabel={t`Off`}
          />

          <Stage aria-hidden="true">
            <Preview area={selected()} ref={(el) => (target = el)} />
          </Stage>

          <PreviewBar>
            <Switch fallback={<span>{areaText(selected()).description}</span>}>
              <Match when={!state.motion.active}>
                <span>
                  <Trans>
                    Animations are off on this device, so the preview stays
                    still.
                  </Trans>
                </span>
              </Match>
              <Match when={state.motion.reduced}>
                <span>
                  <Trans>
                    Motion is reduced, so the preview shows a short fade.
                  </Trans>
                </span>
              </Match>
            </Switch>
            <Button variant="tonal" size="sm" onPress={() => play()}>
              <Icon name="play" size={16} />
              <Trans>Play preview</Trans>
            </Button>
          </PreviewBar>
        </Editor>

        <SettingsRow
          icon={<Icon name="eye" size={20} />}
          title={<Trans>Animate this part</Trans>}
          description={areaText(selected()).name}
          onClick={() =>
            state.motion.setEnabled(selected(), !settings().enabled)
          }
          control={(ids) => (
            <Toggle
              checked={settings().enabled}
              onChange={() =>
                state.motion.setEnabled(selected(), !settings().enabled)
              }
              aria-labelledby={ids.labelId}
              aria-describedby={ids.descriptionId}
            />
          )}
        />

        <Show when={state.motion.advanced} fallback={phaseControls("both")}>
          <PhaseTitle>
            <Trans>Opening</Trans>
          </PhaseTitle>
          {phaseControls("enter")}
          <PhaseTitle>
            <Trans>Closing</Trans>
          </PhaseTitle>
          <Show
            when={hasExit()}
            fallback={
              <PhaseNote>
                <Trans>This part only animates as it opens.</Trans>
              </PhaseNote>
            }
          >
            {phaseControls("exit")}
          </Show>
        </Show>

        <Resets>
          <Button
            variant="text"
            size="sm"
            onPress={() => state.motion.reset(selected())}
          >
            <Icon name="arrow-counter-clockwise" size={16} />
            <Trans>Reset this part</Trans>
          </Button>
          <Button variant="text" size="sm" onPress={() => state.motion.reset()}>
            <Trans>Reset all animations</Trans>
          </Button>
        </Resets>
      </Show>
    </SettingsSection>
  );
}

/**
 * Chips to pick the part of the app to edit (a radio group)
 */
function AreaPicker(props: {
  areas: MotionArea[];
  value: MotionArea;
  onChange: (area: MotionArea) => void;
  label: string;
  name: (area: MotionArea) => string;
  off: (area: MotionArea) => boolean;
  offLabel: string;
}) {
  let group!: HTMLDivElement;

  function move(delta: number) {
    const index = props.areas.indexOf(props.value);
    const next =
      props.areas[(index + delta + props.areas.length) % props.areas.length];
    props.onChange(next);
    queueMicrotask(() =>
      (group.querySelector("[aria-checked='true']") as HTMLElement)?.focus(),
    );
  }

  return (
    <Chips
      ref={group}
      role="radiogroup"
      aria-label={props.label}
      onKeyDown={(e) => {
        const rtl = getComputedStyle(group).direction === "rtl";
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(rtl && e.key === "ArrowRight" ? -1 : 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(rtl && e.key === "ArrowLeft" ? 1 : -1);
        }
      }}
    >
      <For each={props.areas}>
        {(area) => (
          <Chip
            type="button"
            role="radio"
            aria-checked={area === props.value}
            tabIndex={area === props.value ? 0 : -1}
            data-off={props.off(area) || undefined}
            onClick={() => props.onChange(area)}
          >
            {props.name(area)}
            <Show when={props.off(area)}>
              <ChipOff>{props.offLabel}</ChipOff>
            </Show>
          </Chip>
        )}
      </For>
    </Chips>
  );
}

/**
 * A small drawing of the selected part, made of plain shapes. The element
 * passed to ref is the one that animates.
 */
function Preview(props: {
  area: MotionArea;
  ref: (element: HTMLElement) => void;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.area === "servers"}>
        <Frame>
          <Rail>
            <Dot />
            <Dot data-active />
            <Dot />
          </Rail>
          <Mover ref={props.ref} style={{ display: "flex", flex: 1 }}>
            <List>
              <Line style={{ width: "70%" }} />
              <Line style={{ width: "55%" }} data-active />
              <Line style={{ width: "62%" }} />
            </List>
            <Chat>
              <MessageShape />
              <MessageShape short />
            </Chat>
          </Mover>
        </Frame>
      </Match>
      <Match when={props.area === "channels"}>
        <Frame>
          <List>
            <Line style={{ width: "60%" }} />
            <Line style={{ width: "72%" }} data-active />
            <Line style={{ width: "50%" }} />
          </List>
          <Chat ref={props.ref}>
            <MessageShape />
            <MessageShape short />
            <MessageShape />
          </Chat>
        </Frame>
      </Match>
      <Match when={props.area === "settings"}>
        <Frame>
          <List>
            <Line style={{ width: "64%" }} />
            <Line style={{ width: "52%" }} data-active />
            <Line style={{ width: "70%" }} />
          </List>
          <Chat ref={props.ref}>
            <Line style={{ width: "40%", height: "10px" }} />
            <Card>
              <Line style={{ width: "80%" }} />
              <Line style={{ width: "65%" }} />
            </Card>
          </Chat>
        </Frame>
      </Match>
      <Match when={props.area === "popouts"}>
        <Centre>
          <Popover ref={props.ref} style={{ width: "160px" }}>
            <Avatar />
            <Line style={{ width: "70%", height: "10px" }} />
            <Line style={{ width: "90%" }} />
            <Line style={{ width: "60%" }} />
          </Popover>
        </Centre>
      </Match>
      <Match when={props.area === "contextMenus"}>
        <Centre>
          <Popover ref={props.ref} style={{ width: "150px", gap: "6px" }}>
            <For each={[78, 64, 70, 50]}>
              {(width, index) => (
                <MenuRow data-active={index() === 1 || undefined}>
                  <Line style={{ width: `${width}%` }} />
                </MenuRow>
              )}
            </For>
          </Popover>
        </Centre>
      </Match>
      <Match when={props.area === "tooltips"}>
        <Centre style={{ "flex-direction": "column", gap: "8px" }}>
          <Bubble ref={props.ref}>
            <Line
              style={{ width: "64px", background: "var(--z-fg-secondary)" }}
            />
          </Bubble>
          <IconShape />
        </Centre>
      </Match>
      <Match when={props.area === "messages"}>
        <Chat style={{ height: "100%", "justify-content": "flex-end" }}>
          <MessageShape short />
          <MessageShape />
          <div ref={props.ref}>
            <MessageShape highlight />
          </div>
        </Chat>
      </Match>
      <Match when={props.area === "channelList"}>
        <List style={{ width: "100%", "max-width": "220px" }}>
          <Line style={{ width: "45%", height: "6px", opacity: 0.7 }} />
          <div ref={props.ref} style={{ display: "grid", gap: "8px" }}>
            <Line style={{ width: "70%" }} />
            <Line style={{ width: "58%" }} data-active />
            <Line style={{ width: "66%" }} />
          </div>
        </List>
      </Match>
      <Match when={props.area === "modals" || props.area === "backdrop"}>
        <Frame>
          <List>
            <Line style={{ width: "60%" }} />
            <Line style={{ width: "70%" }} />
          </List>
          <Chat>
            <MessageShape />
            <MessageShape short />
          </Chat>
          <Show
            when={props.area === "backdrop"}
            fallback={
              <Overlay>
                <Card ref={props.ref} style={{ width: "150px" }}>
                  <Line style={{ width: "60%", height: "10px" }} />
                  <Line style={{ width: "90%" }} />
                  <Button64 />
                </Card>
              </Overlay>
            }
          >
            <Overlay ref={props.ref} data-dim>
              <Card style={{ width: "150px" }}>
                <Line style={{ width: "60%", height: "10px" }} />
                <Line style={{ width: "90%" }} />
                <Button64 />
              </Card>
            </Overlay>
          </Show>
        </Frame>
      </Match>
      <Match when={props.area === "panels"}>
        <Frame>
          <Chat>
            <MessageShape />
            <MessageShape short />
            <MessageShape />
          </Chat>
          <Panel ref={props.ref}>
            <For each={[0, 1, 2, 3]}>
              {() => (
                <PanelRow>
                  <Avatar small />
                  <Line style={{ width: "60%" }} />
                </PanelRow>
              )}
            </For>
          </Panel>
        </Frame>
      </Match>
    </Switch>
  );
}

const Editor = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderBottom: "1px solid var(--z-border-subtle)",
  },
});

const Chips = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const Chip = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "32px",
    paddingInline: "12px",
    borderRadius: "var(--z-radius-pill, 999px)",
    border: "1px solid var(--z-border-strong)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    cursor: "pointer",
    transition:
      "background-color var(--z-motion-fast, 0.12s) ease, color var(--z-motion-fast, 0.12s) ease, border-color var(--z-motion-fast, 0.12s) ease",

    "&:hover:not([aria-checked='true'])": {
      background: "var(--z-hover)",
      color: "var(--z-fg-primary)",
    },
    "&:active:not([aria-checked='true'])": {
      background: "var(--z-btn-pressed, var(--z-hover))",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "&[aria-checked='true']": {
      background: "var(--z-accent-fill, var(--z-accent))",
      borderColor: "var(--z-accent-fill, var(--z-accent))",
      color: "var(--z-on-accent)",
    },
    _phone: { minHeight: "44px", fontSize: "14px" },
  },
});

const ChipOff = styled("span", {
  base: {
    fontSize: "11px",
    paddingInline: "6px",
    borderRadius: "var(--z-radius-pill, 999px)",
    background: "var(--z-bg-input)",
    color: "var(--z-fg-secondary)",
  },
});

const Stage = styled("div", {
  base: {
    position: "relative",
    height: "176px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-chat)",
    padding: "12px",
  },
});

const PreviewBar = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    _phone: { flexDirection: "column", alignItems: "stretch" },
  },
});

const PhaseTitle = styled("div", {
  base: {
    padding: "16px 16px 4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const PhaseNote = styled("div", {
  base: {
    padding: "8px 16px 16px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
  },
});

const Resets = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "12px 16px",
    borderTop: "1px solid var(--z-border-subtle)",
  },
});

const SliderBox = styled("div", {
  base: { width: "min(240px, 40vw)" },
});

const SelectBox = styled("div", {
  base: { width: "min(220px, 38vw)" },
});

/* preview shapes */

const Frame = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "flex",
    overflow: "hidden",
  },
});

const Mover = styled("div", { base: {} });

const Rail = styled("div", {
  base: {
    width: "44px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    paddingTop: "12px",
    background: "var(--z-bg-rail)",
  },
});

const Dot = styled("div", {
  base: {
    width: "26px",
    height: "26px",
    borderRadius: "9px",
    background: "var(--z-bg-raised)",
    "&[data-active]": { background: "var(--z-accent)" },
  },
});

const List = styled("div", {
  base: {
    width: "34%",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "14px 12px",
    background: "var(--z-bg-sidebar)",
  },
});

const Line = styled("div", {
  base: {
    height: "8px",
    borderRadius: "999px",
    background: "var(--z-slate-3, var(--z-fg-disabled))",
    "&[data-active]": { background: "var(--z-accent)" },
  },
});

const Chat = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px",
    background: "var(--z-bg-chat)",
  },
});

function MessageShape(props: { short?: boolean; highlight?: boolean }) {
  return (
    <MessageRow data-highlight={props.highlight || undefined}>
      <Avatar small />
      <div style={{ flex: 1, display: "grid", gap: "6px" }}>
        <Line style={{ width: "30%", background: "var(--z-fg-muted)" }} />
        <Line style={{ width: props.short ? "45%" : "80%" }} />
      </div>
    </MessageRow>
  );
}

const MessageRow = styled("div", {
  base: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
    padding: "6px",
    borderRadius: "8px",
    "&[data-highlight]": { background: "var(--z-hover)" },
  },
});

const Avatar = styled("div", {
  base: {
    width: "28px",
    height: "28px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "var(--z-accent-muted, var(--z-bg-raised))",
  },
  variants: {
    small: { true: { width: "22px", height: "22px" } },
  },
});

const Centre = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
});

const Popover = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-popover-border, var(--z-border-strong))",
    background: "var(--z-popover-bg, var(--z-bg-raised))",
    boxShadow: "var(--z-popover-lift, var(--z-shadow-md))",
  },
});

const MenuRow = styled("div", {
  base: {
    padding: "6px 8px",
    borderRadius: "6px",
    "&[data-active]": { background: "var(--z-hover)" },
  },
});

const Bubble = styled("div", {
  base: {
    padding: "8px 10px",
    borderRadius: "8px",
    background: "var(--z-bg-floating, var(--z-bg-raised))",
    border: "1px solid var(--z-border-strong)",
  },
});

const IconShape = styled("div", {
  base: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "var(--z-bg-raised)",
    border: "1px solid var(--z-border-subtle)",
  },
});

const Overlay = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    "&[data-dim]": { background: "var(--z-scrim, rgba(6, 8, 12, 0.6))" },
  },
});

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-modal, var(--z-bg-raised))",
  },
});

const Button64 = styled("div", {
  base: {
    alignSelf: "flex-end",
    width: "64px",
    height: "18px",
    borderRadius: "6px",
    background: "var(--z-accent-fill, var(--z-accent))",
  },
});

const Panel = styled("div", {
  base: {
    width: "36%",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px 12px",
    background: "var(--z-bg-members, var(--z-bg-sidebar))",
    borderInlineStart: "1px solid var(--z-border-subtle)",
  },
});

const PanelRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});
