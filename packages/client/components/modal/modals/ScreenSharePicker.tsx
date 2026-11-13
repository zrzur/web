import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { createFormControl } from "solid-forms";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import {
  ScreenShareContent,
  ScreenShareQualityName,
} from "@revolt/state/stores/Voice";
import {
  Column,
  Dialog,
  DialogProps,
  FloatingSelect,
  Form2,
  MenuItem,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { ContentChoice, offeredQuality } from "./ScreenShareSettings";
import {
  type PickerSource,
  type SourceKind,
  firstChoice,
  moveChoice,
  sourceKind,
  sourcesOf,
} from "./screenSharePickerList";

/**
 * Desktop app: choose what to share. Screens and windows are two tabs of
 * previews; one is always chosen, so "Start sharing" works at once. Below:
 * quality, what the picture is tuned for, and sound.
 */
export function ScreenSharePickerModal(
  props: DialogProps & Modals & { type: "screen_share_picker" },
) {
  const { voice } = useState();
  const { t } = useLingui();

  const sources = () => props.sources as PickerSource[];
  const [chosen, setChosen] = createSignal(firstChoice(sources()));
  const [tab, setTab] = createSignal<SourceKind>(
    sourceKind(sources().find((source) => source.idx === chosen())),
  );
  const shown = createMemo(() => sourcesOf(sources(), tab()));
  /** Previews and icons that failed to load fall back to a symbol */
  const [broken, setBroken] = createSignal<ReadonlySet<string>>(new Set());
  const failed = (url: string) => setBroken((set) => new Set(set).add(url));
  const usable = (url: string | undefined) =>
    url && !broken().has(url) ? url : undefined;

  const [quality, setQuality] = createSignal<ScreenShareQualityName>(
    offeredQuality(props.qualities, voice.screenShareQuality),
  );
  const content = createFormControl<ScreenShareContent>(
    voice.screenShareContent,
  );
  const audio = createFormControl(voice.screenShareAudio);

  const label = (source: PickerSource) =>
    sourceKind(source) === "screen"
      ? (source.screenCount ?? 1) > 1
        ? t`Screen ${source.screenNumber ?? 1}`
        : t`Entire screen`
      : source.name || t`Untitled window`;

  let started = false;
  function start() {
    if (started || chosen() < 0) return;
    started = true;
    props.callback(chosen(), quality(), audio.value, content.value);
    props.onClose();
  }

  function openTab(kind: SourceKind) {
    setTab(kind);
    // a choice is always visible: the first one of the tab
    const list = sourcesOf(sources(), kind);
    if (list.length && !list.some((source) => source.idx === chosen()))
      setChosen(list[0].idx);
  }

  let grid: HTMLDivElement | undefined;
  function onGridKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      return start();
    }
    const columns = grid
      ? getComputedStyle(grid).gridTemplateColumns.split(" ").length
      : 1;
    const rtl = !!grid && getComputedStyle(grid).direction === "rtl";
    const next = moveChoice(shown(), chosen(), event.key, columns, rtl);
    if (next === undefined) return;
    event.preventDefault();
    setChosen(next);
    grid
      ?.querySelector<HTMLElement>(`[data-source="${next}"]`)
      ?.focus({ preventScroll: false });
  }

  const tabs: {
    kind: SourceKind;
    name: () => string;
    icon: "monitor" | "squares-four";
  }[] = [
    { kind: "screen", name: () => t`Screens`, icon: "monitor" },
    { kind: "window", name: () => t`Windows`, icon: "squares-four" },
  ];

  return (
    <Dialog
      tone="settings"
      iconName="monitor"
      minWidth={720}
      show={props.show}
      onClose={() => {
        if (!started) props.onCancel();
        props.onClose();
      }}
      title={t`Share your screen`}
      actions={[
        { text: <Trans>Cancel</Trans> },
        {
          text: <Trans>Start sharing</Trans>,
          isDisabled: chosen() < 0,
          onClick: () => {
            start();
            return false;
          },
        },
      ]}
    >
      <Column gap="lg">
        <Tabs role="tablist" aria-label={t`What to share`}>
          <For each={tabs}>
            {(item) => (
              <Tab
                type="button"
                role="tab"
                aria-selected={tab() === item.kind}
                data-testid={`share-tab-${item.kind}`}
                onClick={() => openTab(item.kind)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.name()}</span>
                <Count>{sourcesOf(sources(), item.kind).length}</Count>
              </Tab>
            )}
          </For>
        </Tabs>

        <Show
          when={shown().length}
          fallback={
            <Empty>
              <Icon
                name={tab() === "screen" ? "monitor" : "squares-four"}
                size={28}
              />
              <span>
                {tab() === "screen"
                  ? t`No screen can be shared right now.`
                  : t`No open window can be shared right now. Open the app you want to show, then try again.`}
              </span>
            </Empty>
          }
        >
          <Grid
            ref={grid}
            role="radiogroup"
            aria-label={tab() === "screen" ? t`Screens` : t`Windows`}
            onKeyDown={onGridKey}
          >
            <For each={shown()}>
              {(source) => (
                <Card
                  type="button"
                  role="radio"
                  aria-checked={chosen() === source.idx}
                  tabIndex={chosen() === source.idx ? 0 : -1}
                  data-source={source.idx}
                  data-testid="share-source"
                  title={label(source)}
                  onClick={() => setChosen(source.idx)}
                  onDblClick={() => {
                    setChosen(source.idx);
                    start();
                  }}
                >
                  <Preview>
                    <Show
                      when={usable(source.thumbnail)}
                      fallback={
                        <Show
                          when={usable(source.image)}
                          fallback={
                            <Icon
                              name={
                                sourceKind(source) === "screen"
                                  ? "monitor"
                                  : "squares-four"
                              }
                              size={32}
                            />
                          }
                        >
                          {(url) => (
                            <BigIcon
                              src={url()}
                              alt=""
                              draggable={false}
                              onError={() => failed(url())}
                            />
                          )}
                        </Show>
                      }
                    >
                      {(url) => (
                        <Shot
                          src={url()}
                          alt=""
                          draggable={false}
                          onError={() => failed(url())}
                        />
                      )}
                    </Show>
                  </Preview>
                  <Caption>
                    <Show
                      when={
                        sourceKind(source) === "window" && usable(source.image)
                      }
                      fallback={
                        <Icon
                          name={
                            sourceKind(source) === "screen"
                              ? "monitor"
                              : "squares-four"
                          }
                          size={16}
                        />
                      }
                    >
                      {(url) => (
                        <SmallIcon
                          src={url() as string}
                          alt=""
                          draggable={false}
                          onError={() => failed(url() as string)}
                        />
                      )}
                    </Show>
                    <Name dir="auto">{label(source)}</Name>
                  </Caption>
                </Card>
              )}
            </For>
          </Grid>
        </Show>
        <Show when={tab() === "window" && shown().length}>
          <Hint>
            <Trans>A minimised window is not listed. Open it first.</Trans>
          </Hint>
        </Show>

        <Options>
          <Option>
            <OptionLabel id="share-quality-label">
              <Trans>Quality</Trans>
            </OptionLabel>
            <Show
              when={props.qualities.length > 1}
              fallback={
                <OptionValue>{props.qualities[0]?.fullName}</OptionValue>
              }
            >
              <SelectWidth>
                <FloatingSelect
                  aria-labelledby="share-quality-label"
                  value={quality()}
                  onChange={(e) =>
                    setQuality(e.currentTarget.value as ScreenShareQualityName)
                  }
                >
                  <For each={props.qualities}>
                    {(item) => (
                      <MenuItem value={item.name}>{item.fullName}</MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </SelectWidth>
            </Show>
          </Option>
          <ContentChoice control={content} />
          <Column gap="sm">
            <Form2.Checkbox control={audio}>
              <Trans>Share audio</Trans>
            </Form2.Checkbox>
            <small>
              <Trans>Others hear what plays on your computer.</Trans>
            </small>
          </Column>
        </Options>
      </Column>
    </Dialog>
  );
}

const Tabs = styled("div", {
  base: {
    display: "flex",
    gap: "4px",
    padding: "4px",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-bg-input, var(--md-sys-color-surface-container))",
  },
});

const Tab = styled("button", {
  base: {
    flex: "1 1 0",
    minWidth: 0,
    minHeight: "36px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    paddingInline: "12px",
    border: 0,
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "transparent",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    font: "inherit",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    "&:hover": { color: "var(--z-fg-primary, var(--md-sys-color-on-surface))" },
    "&[aria-selected='true']": {
      background:
        "var(--z-bg-raised, var(--md-sys-color-surface-container-high))",
      color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "1px",
    },
    "@media (max-width: 600px)": { minHeight: "44px" },
  },
});

const Count = styled("span", {
  base: {
    minWidth: "20px",
    paddingInline: "6px",
    borderRadius: "var(--z-radius-pill, 999px)",
    background: "var(--z-border-subtle, rgb(255 255 255 / 0.08))",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    fontSize: "12px",
    lineHeight: "20px",
    textAlign: "center",
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))",
    gap: "12px",
    // room for the focus ring and the selected frame
    padding: "4px",
    maxHeight: "min(44vh, 392px)",
    overflowY: "auto",
    "@media (max-width: 600px)": {
      gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    },
  },
});

const Card = styled("button", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px",
    border:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    borderRadius: "var(--z-radius-md, 10px)",
    background: "var(--z-card-bg, var(--md-sys-color-surface-container))",
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface))",
    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    "&:hover": {
      borderColor: "var(--z-border-strong, var(--md-sys-color-outline))",
      color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    },
    "&[aria-checked='true']": {
      borderColor: "var(--z-accent, var(--md-sys-color-primary))",
      boxShadow: "0 0 0 1px var(--z-accent, var(--md-sys-color-primary))",
      color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
    },
  },
});

const Preview = styled("span", {
  base: {
    aspectRatio: "16 / 9",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-app, #0d0e16)",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
  },
});

const Shot = styled("img", {
  base: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
});

const BigIcon = styled("img", {
  base: {
    width: "48px",
    height: "48px",
    objectFit: "contain",
  },
});

const Caption = styled("span", {
  base: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "20px",
  },
});

const SmallIcon = styled("img", {
  base: {
    flex: "0 0 auto",
    width: "16px",
    height: "16px",
    objectFit: "contain",
  },
});

const Name = styled("span", {
  base: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const Empty = styled("div", {
  base: {
    minHeight: "160px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "24px",
    borderRadius: "var(--z-radius-md, 10px)",
    border:
      "1px dashed var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    fontSize: "14px",
    textAlign: "center",
  },
});

const Hint = styled("small", {
  base: {
    marginBlockStart: "-8px",
    color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
    fontSize: "13px",
  },
});

const Options = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    paddingBlockStart: "16px",
    borderBlockStart:
      "1px solid var(--z-border-subtle, var(--md-sys-color-outline-variant))",
    "& small": {
      color: "var(--z-fg-muted, var(--md-sys-color-on-surface-variant))",
      fontSize: "13px",
    },
  },
});

const Option = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});

const OptionLabel = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--z-fg-primary, var(--md-sys-color-on-surface))",
  },
});

const OptionValue = styled("span", {
  base: {
    fontSize: "14px",
    color: "var(--z-fg-secondary, var(--md-sys-color-on-surface))",
  },
});

const SelectWidth = styled("div", {
  base: {
    width: "min(240px, 50vw)",
  },
});
