import { For, Show, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Dialog } from "@revolt/ui";
import { ProfilePreview } from "@revolt/ui/components/features/profiles/frames/ProfilePreview";
import { PROFILE_FRAME_IDS } from "@revolt/ui/components/features/profiles/frames/builtinFrames";
import {
  type UserStyle,
  isCommunityRef,
} from "@revolt/ui/components/features/profiles/userStyle";
import { Icon } from "@revolt/ui/icons/Icon";

import { useStyleLabels } from "./styleLabels";

/**
 * Choose the frame drawn around your whole profile card. Every choice is
 * your own whole profile card, as people will see it, wearing that frame. Zrzur's
 * own frames are here; a creator's frame is put on from Designs and shows
 * here as the one you wear.
 */
export function FrameDialog(props: {
  show: boolean;
  onClose: () => void;
  /** whose profile: the card shown is theirs */
  user: User;
  /** the look being edited, so the preview has the colours and decoration too */
  style: UserStyle;
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

  /** your profile card wearing a frame (or none) */
  const Card = (card: { frame?: string; file?: string }) => (
    <ProfilePreview
      user={props.user}
      // every choice at the same size, "None" too
      sizeAs={PROFILE_FRAME_IDS[0]}
      style={{
        ...props.style,
        profile_frame: card.frame,
        profile_frame_file: card.file,
      }}
    />
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
      <Stack>
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
        <Note>
          <Trans>
            The frame goes round your card and your full profile. It never
            covers your name, your buttons or what you wrote.
          </Trans>
        </Note>
      </Stack>
    </Dialog>
  );
}

const Stack = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const Grid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    alignContent: "start",
    gap: "12px",
    maxHeight: "min(520px, 60dvh)",
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
    padding: "12px 12px 12px",
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
  },
});

const Check = styled("span", {
  base: {
    position: "absolute",
    top: "6px",
    insetInlineEnd: "6px",
    zIndex: 3,
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

const Note = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
  },
});
