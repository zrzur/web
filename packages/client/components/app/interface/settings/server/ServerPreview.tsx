import { Show, createEffect, createSignal, onCleanup } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Avatar } from "@revolt/ui";

import type { ProfileDraft } from "./Overview";

/** Address of a picture that is either already uploaded or still a file */
function useImage(value: () => string | File[] | null | undefined) {
  const [url, setUrl] = createSignal<string>();
  createEffect(() => {
    const current = value();
    if (Array.isArray(current) && current[0]) {
      const object = URL.createObjectURL(current[0]);
      setUrl(object);
      onCleanup(() => URL.revokeObjectURL(object));
    } else {
      setUrl(typeof current === "string" ? current : undefined);
    }
  });
  return url;
}

/**
 * How the server looks in an invite and in Discover. It follows what is
 * typed in the profile fields, before anything is saved.
 */
export function ServerPreview(props: {
  server: Server;
  draft?: ProfileDraft;
}) {
  const banner = useImage(() => props.draft?.banner ?? props.server.bannerURL);
  const icon = useImage(
    () => props.draft?.icon ?? props.server.animatedIconURL,
  );
  const name = () => props.draft?.name ?? props.server.name;
  const description = () =>
    props.draft?.description ?? props.server.description ?? "";

  return (
    <Card aria-label={name()} data-testid="server-preview">
      <Label>
        <Trans>Preview</Trans>
      </Label>
      <Banner style={banner() ? { "background-image": `url(${banner()})` } : {}} />
      <Body>
        <IconSlot>
          <Avatar
            size={56}
            shape="rounded-square"
            src={icon()}
            fallback={name() || props.server.name}
          />
        </IconSlot>
        <Name dir="auto">{name()}</Name>
        <Show when={description().trim()}>
          <Description dir="auto">{description()}</Description>
        </Show>
      </Body>
    </Card>
  );
}

const Card = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "var(--z-radius-lg, 14px)",
    background: "var(--z-bg-card, var(--z-bg-panel))",
    border: "1px solid var(--z-border-soft)",
  },
});

const Label = styled("span", {
  base: {
    padding: "12px 16px 8px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const Banner = styled("div", {
  base: {
    height: "96px",
    background: "var(--z-bg-input)",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "0 16px 16px",
  },
});

const IconSlot = styled("div", {
  base: {
    marginTop: "-28px",
    width: "fit-content",
    borderRadius: "var(--z-radius-md, 10px)",
    border: "3px solid var(--z-bg-card, var(--z-bg-panel))",
    background: "var(--z-bg-card, var(--z-bg-panel))",
  },
});

const Name = styled("strong", {
  base: {
    fontSize: "16px",
    lineHeight: "22px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const Description = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
    lineClamp: 3,
    overflow: "hidden",
    overflowWrap: "anywhere",
  },
});
