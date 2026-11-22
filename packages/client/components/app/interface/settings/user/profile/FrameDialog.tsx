import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Avatar, Dialog } from "@revolt/ui";
import { FramedCard } from "@revolt/ui/components/features/profiles/frames/ProfileFrame";
import { PROFILE_FRAME_IDS } from "@revolt/ui/components/features/profiles/frames/builtinFrames";
import { isCommunityRef } from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { useStyleLabels } from "./styleLabels";

/**
 * Choose the frame drawn around your whole profile card. Zrzur's own frames
 * are here; a creator's frame is put on from Designs and shows here as the
 * one you wear.
 */
export function FrameDialog(props: {
  show: boolean;
  onClose: () => void;
  name: string;
  handle: string;
  avatar?: string;
  value?: string;
  file?: string;
  onApply: (frame: string | undefined, file?: string) => void;
}) {
  const { t } = useLingui();
  const labels = useStyleLabels();
  /* eslint-disable solid/reactivity */
  const [choice, setChoice] = createSignal(props.value);
  const [file, setFile] = createSignal(props.file);
  /* eslint-enable solid/reactivity */
  const pick = (id: string | undefined, image?: string) => {
    setChoice(id);
    setFile(image);
  };

  /** a small profile card, framed */
  const Card = (card: { frame?: string; file?: string; big?: boolean }) => (
    <FramedCard frame={card.frame} file={card.file} phone={false}>
      <Mini data-big={card.big ? "" : undefined}>
        <MiniBanner />
        <MiniAvatar>
          <Avatar
            size={card.big ? 56 : 32}
            src={props.avatar}
            fallback={props.name}
          />
        </MiniAvatar>
        <strong>
          <bdi>{props.name}</bdi>
        </strong>
        <Show when={card.big}>
          <small>
            <bdi>@{props.handle}</bdi>
          </small>
        </Show>
      </Mini>
    </FramedCard>
  );

  return (
    <Dialog
      tone="edit"
      iconName="user-focus"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>Change profile frame</Trans>}
      description={
        <Trans>
          A frame around your whole profile card. Everyone who opens your
          profile sees it.
        </Trans>
      }
      size="xl"
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Apply</Trans>,
          isDisabled: choice() === props.value,
          onClick: () => props.onApply(choice(), file()),
        },
      ]}
    >
      <Split>
        <Grid role="list" aria-label={t`Profile frames`}>
          <Tile
            type="button"
            role="listitem"
            aria-pressed={!choice()}
            data-testid="profile-frame-none"
            onClick={() => pick(undefined)}
          >
            <Card />
            <span>{t`None`}</span>
            <Show when={!choice()}>
              <Check>
                <Icon name="check" size={12} />
              </Check>
            </Show>
          </Tile>
          {/* the creator's frame you wear: kept, or taken off with None */}
          <Show when={isCommunityRef(props.value) && props.value}>
            {(worn) => (
              <Tile
                type="button"
                role="listitem"
                aria-pressed={choice() === worn()}
                onClick={() => pick(worn(), props.file)}
              >
                <Card frame={worn()} file={props.file} />
                <span>{labels.frame(worn())}</span>
                <Show when={choice() === worn()}>
                  <Check>
                    <Icon name="check" size={12} />
                  </Check>
                </Show>
              </Tile>
            )}
          </Show>
          <For each={PROFILE_FRAME_IDS}>
            {(id) => (
              <Tile
                type="button"
                role="listitem"
                aria-pressed={choice() === id}
                data-testid={`profile-frame-${id}`}
                onClick={() => pick(id)}
              >
                <Card frame={id} />
                <span>{labels.frame(id)}</span>
                <Show when={choice() === id}>
                  <Check>
                    <Icon name="check" size={12} />
                  </Check>
                </Show>
              </Tile>
            )}
          </For>
        </Grid>

        <Preview>
          <Card frame={choice()} file={file()} big />
          <Note>
            <Trans>
              The frame goes round your card and your full profile. It never
              covers your name, your buttons or what you wrote.
            </Trans>
          </Note>
        </Preview>
      </Split>
    </Dialog>
  );
}

const Split = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: "20px",
    alignItems: "start",
    "@media (max-width: 720px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    alignContent: "start",
    gap: "12px",
    maxHeight: "min(460px, 55dvh)",
    overflowY: "auto",
    padding: "4px",
  },
});

const Tile = styled("button", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "8px",
    // room for the frame, which reaches past the small card
    padding: "60px 28px 12px",
    minHeight: "44px",
    border: "1px solid var(--z-btn-surface-border)",
    borderRadius: "var(--z-radius, 10px)",
    background: "var(--z-bg-raised)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "center",
    cursor: "pointer",
    overflow: "hidden",
    _hover: { borderColor: "var(--z-border-strong)" },
    "&[aria-pressed='true']": {
      borderColor: "var(--z-accent)",
      boxShadow: "inset 0 0 0 1px var(--z-accent)",
    },
    "&:active": { boxShadow: "var(--z-btn-pressed)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
    "& > span": { marginBlockStart: "36px" },
  },
});

const Check = styled("span", {
  base: {
    position: "absolute",
    top: "6px",
    insetInlineEnd: "6px",
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "var(--z-accent-fill, var(--z-accent))",
    color: "var(--z-on-accent, #fff)",
    "--z-icon-color": "currentColor",
  },
});

const Preview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    // the frame's crest and foot reach past the card
    padding: "96px 32px 16px",
    borderRadius: "calc(var(--z-radius, 10px) + 4px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    overflow: "hidden",
  },
});

const Note = styled("p", {
  base: {
    margin: "28px 0 0",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
  },
});

const Mini = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    paddingBottom: "12px",
    overflow: "hidden",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-floating, var(--z-bg-raised))",
    "& strong": {
      marginTop: "6px",
      maxWidth: "100%",
      paddingInline: "8px",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "13px",
      fontWeight: 700,
    },
    "& small": { fontSize: "13px", color: "var(--z-fg-muted)" },
    "&[data-big]": {
      paddingBottom: "20px",
      "& strong": { fontSize: "18px" },
    },
  },
});

const MiniBanner = styled("div", {
  base: {
    alignSelf: "stretch",
    height: "40px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--z-accent) 40%, var(--z-bg-raised)), var(--z-bg-raised))",
    "[data-big] > &": { height: "72px" },
  },
});

const MiniAvatar = styled("div", {
  base: {
    marginTop: "-20px",
    padding: "3px",
    borderRadius: "50%",
    background: "var(--z-bg-floating, var(--z-bg-raised))",
    lineHeight: 0,
    "[data-big] > &": { marginTop: "-32px" },
  },
});
