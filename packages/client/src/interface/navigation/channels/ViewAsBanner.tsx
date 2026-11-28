import { For, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { type Server, stopViewingAs, viewingAs } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { Icon } from "@revolt/ui/icons/Icon";

/**
 * Shown while the server is viewed as roles ("View server as this role" in
 * a role's settings): which roles, and the way back to your own view
 */
export function ViewAsBanner(props: { server: Server }) {
  const view = () => viewingAs(props.server.id);
  const roles = () =>
    (view()?.roleIds ?? [])
      .map((id) => props.server.roles.get(id))
      .filter((role) => role);

  return (
    <Show when={view()}>
      <Banner role="status" data-view-as>
        <Icon name="eye" size={18} />
        <Text>
          <Trans>Viewing as</Trans>{" "}
          <Show when={roles().length} fallback={<b>@everyone</b>}>
            <For each={roles()}>
              {(role, index) => (
                <>
                  <b style={{ color: role!.colour ?? undefined }}>
                    {role!.name}
                  </b>
                  {index() < roles().length - 1 ? ", " : ""}
                </>
              )}
            </For>
          </Show>
        </Text>
        <Exit type="button" onClick={stopViewingAs}>
          <Trans>Exit</Trans>
        </Exit>
      </Banner>
    </Show>
  );
}

const Banner = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginInline: "8px",
    marginBlock: "8px 4px",
    paddingBlock: "8px",
    paddingInline: "10px",
    borderRadius: "10px",
    background: "color-mix(in srgb, var(--z-accent) 16%, transparent)",
    color: "var(--z-fg)",
    fontSize: "13px",
    lineHeight: "18px",
    "--z-icon-color": "currentColor",
  },
});

const Text = styled("span", {
  base: {
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
});

const Exit = styled("button", {
  base: {
    flexShrink: 0,
    border: "none",
    borderRadius: "8px",
    paddingBlock: "4px",
    paddingInline: "10px",
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
    color: "var(--z-on-accent)",
    background: "var(--z-accent-fill)",
    _hover: { filter: "brightness(1.08)" },
    _focusVisible: {
      outline: "2px solid var(--z-focus, var(--z-accent))",
      outlineOffset: "2px",
    },
  },
});
