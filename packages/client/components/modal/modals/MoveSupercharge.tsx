import { For, Show, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { billingApi, storeOverview } from "@revolt/client/billing";
import { Avatar, Dialog, DialogProps } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { Modals } from "../types";

import { useBillingError } from "./billingErrors";

/**
 * Put one of your supercharges on a server (or move it to another one)
 */
export function MoveSuperchargeModal(
  props: DialogProps & Modals & { type: "move_supercharge" },
) {
  const { t } = useLingui();
  const client = useClient();
  const describe = useBillingError();
  const [target, setTarget] = createSignal<string>();
  const [filter, setFilter] = createSignal("");
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const servers = createMemo(() => {
    const query = filter().trim().toLowerCase();
    return client()
      .servers.toList()
      .filter((server) => server.id !== props.supercharge.server_id)
      .filter((server) => !query || server.name.toLowerCase().includes(query))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  });

  async function move() {
    if (!target()) return;
    setPending(true);
    setError(undefined);
    try {
      storeOverview(
        await billingApi.supercharge(client(), {
          server: target()!,
          supercharge: props.supercharge._id,
        }),
      );
      props.onClose();
    } catch (err) {
      setError(describe(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      tone="premium"
      iconName="lightning"
      show={props.show}
      onClose={props.onClose}
      size="sm"
      title={
        props.supercharge.server_id ? (
          <Trans>Move wing</Trans>
        ) : (
          <Trans>Give wing</Trans>
        )
      }
      description={<Trans>Pick a server you're in.</Trans>}
      error={error()}
      isDisabled={pending()}
      actions={[
        { text: <Trans>Cancel</Trans>, variant: "text" },
        {
          text: <Trans>Give</Trans>,
          isLoading: pending(),
          isDisabled: !target(),
          onClick: () => {
            void move();
            return false;
          },
        },
      ]}
    >
      <Search
        type="search"
        value={filter()}
        placeholder={t`Search servers`}
        aria-label={t`Search servers`}
        onInput={(e) => setFilter(e.currentTarget.value)}
      />
      <List role="radiogroup" aria-label={t`Servers`}>
        <Show
          when={servers().length}
          fallback={
            <Empty>
              <Trans>No servers to show.</Trans>
            </Empty>
          }
        >
          <For each={servers()}>
            {(server) => (
              <Item
                type="button"
                role="radio"
                aria-checked={target() === server.id}
                data-selected={target() === server.id}
                onClick={() => setTarget(server.id)}
              >
                <Avatar
                  src={server.iconURL}
                  fallback={server.name}
                  size={28}
                  shape="rounded-square"
                />
                <span>{server.name}</span>
                <Show when={server.supercharge?.level}>
                  <Level>
                    <Icon name="lightning" size={12} />
                    {server.supercharge!.level}
                  </Level>
                </Show>
              </Item>
            )}
          </For>
        </Show>
      </List>
    </Dialog>
  );
}

const Search = styled("input", {
  base: {
    width: "100%",
    height: "34px",
    marginBottom: "8px",
    padding: "0 10px",
    borderRadius: "8px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    outline: "none",
    "&:focus-visible": { borderColor: "var(--z-wings)" },
  },
});

const List = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    maxHeight: "300px",
    overflowY: "auto",
  },
});

const Item = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "6px 8px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--z-fg-primary)",
    fontSize: "14px",
    cursor: "pointer",
    textAlign: "start",
    "& > span": { flex: 1, minWidth: 0 },
    "&:hover": { background: "var(--z-bg-raised)" },
    "&[data-selected=true]": {
      background: "color-mix(in srgb, var(--z-wings) 14%, transparent)",
    },
  },
});

const Level = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-wings)",
  },
});

const Empty = styled("div", {
  base: { padding: "12px", fontSize: "13px", color: "var(--z-fg-muted)" },
});
