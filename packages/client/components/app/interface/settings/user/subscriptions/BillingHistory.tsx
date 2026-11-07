import { For, Show, createResource } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useTierName } from "@revolt/app/interface/discover/tiers";
import { useClient } from "@revolt/client";
import {
  Order,
  billingApi,
  formatPrice,
  isProviderUrl,
} from "@revolt/client/billing";
import { useTime } from "@revolt/i18n";
import { SettingsSection } from "@revolt/ui";

/**
 * Every payment and renewal, newest first
 */
export function BillingHistory(props: { version: number }) {
  const { t, i18n } = useLingui();
  const dayjs = useTime();
  const client = useClient();
  const tierName = useTierName();

  const [orders] = createResource(
    () => props.version,
    () => billingApi.orders(client()),
  );

  const what = (order: Order) => {
    const product = order.product;
    switch (product.type) {
      case "Plus":
        return order.kind === "Renewal"
          ? t`Zrzur Feather, monthly renewal`
          : t`Zrzur Feather, monthly`;
      case "PlusGift": {
        const name = client().users.get(product.user)?.displayName ?? "";
        return t`Feather gift for ${name}, ${product.months} months`;
      }
      case "Supercharge": {
        const name = client().servers.get(product.server)?.name ?? "";
        const count = order.quantity ?? product.quantity ?? 1;
        if (order.kind === "Renewal") return t`Wings renewal, ${name}`;
        return count > 1 ? t`${count} Wings, ${name}` : t`Wing, ${name}`;
      }
      case "DiscoverBoost": {
        const name = client().servers.get(product.server)?.name ?? "";
        const tier = tierName(product.kind);
        return t`${tier} on Discover, ${name}`;
      }
      case "BotBoost": {
        const name = client().users.get(product.bot)?.displayName ?? "";
        const tier = tierName(product.kind);
        return t`${tier} on Discover, ${name}`;
      }
      case "BotPromoted": {
        const name = client().users.get(product.bot)?.displayName ?? "";
        return t`${tierName("TopRow")} on Discover, ${name}`;
      }
      case "DiscoverPromoted": {
        const name = client().servers.get(product.server)?.name ?? "";
        return t`${tierName("TopRow")} on Discover, ${name}`;
      }
    }
  };

  const status = (order: Order) =>
    ({
      Created: t`Waiting for payment`,
      Pending: t`Waiting for payment`,
      RequiresAction: t`Needs your confirmation`,
      Processing: t`Being confirmed`,
      Paid: t`Payment received`,
      Failed:
        order.kind === "Renewal"
          ? t`Renewal payment failed`
          : t`Payment failed`,
      Cancelled: t`Cancelled`,
      Refunded: t`Refunded`,
      PartiallyRefunded: t`Partly refunded`,
      Disputed: t`Disputed`,
    })[order.status] ?? order.status;

  return (
    <SettingsSection
      title={<Trans>Billing history</Trans>}
      description={
        <Trans>Every payment and renewal. Test payments are marked.</Trans>
      }
    >
      <Show
        when={orders()?.length}
        fallback={
          <Empty>
            <Show when={!orders.loading} fallback={<Trans>Loading…</Trans>}>
              <Trans>No payments yet.</Trans>
            </Show>
          </Empty>
        }
      >
        <List>
          <For each={orders()}>
            {(order) => (
              <Row>
                <What>
                  <span>{what(order)}</span>
                  <small>
                    {dayjs(order.paid_at ?? order.created_at).format("LLL")}
                    <Show when={order.test}>
                      <Test>
                        <Trans>Test</Trans>
                      </Test>
                    </Show>
                  </small>
                </What>
                <Amount data-status={order.status}>
                  <bdi>
                    {formatPrice(order.amount, order.currency, i18n().locale)}
                  </bdi>
                  <small>{status(order)}</small>
                  <Show
                    when={
                      isProviderUrl(order.invoice_url) ||
                      isProviderUrl(order.receipt_url)
                    }
                  >
                    <Links>
                      <Show when={isProviderUrl(order.invoice_url)}>
                        <a
                          href={order.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Trans>Invoice</Trans>
                        </a>
                      </Show>
                      <Show when={isProviderUrl(order.receipt_url)}>
                        <a
                          href={order.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Trans>Receipt</Trans>
                        </a>
                      </Show>
                    </Links>
                  </Show>
                </Amount>
              </Row>
            )}
          </For>
        </List>
      </Show>
    </SettingsSection>
  );
}

const Empty = styled("div", {
  base: { padding: "14px 16px", fontSize: "13px", color: "var(--z-fg-muted)" },
});

const List = styled("div", {
  base: { display: "flex", flexDirection: "column" },
});

const Row = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 16px",
    borderBottom: "1px solid var(--z-border-subtle)",
    "&:last-child": { borderBottom: "none" },
  },
});

const What = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    "& span": {
      fontSize: "14px",
      color: "var(--z-fg-primary)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    "& small": {
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "12px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Test = styled("span", {
  base: {
    padding: "0 6px",
    borderRadius: "999px",
    fontSize: "10px !important",
    fontWeight: 700,
    color: "var(--z-status-warning, #F3B96B) !important",
    background: "rgb(240 178 50 / 14%)",
  },
});

const Amount = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    flexShrink: 0,
    "& bdi": {
      fontSize: "14px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& small": { fontSize: "12px", color: "var(--z-fg-muted)" },
    "&[data-status=Refunded] small, &[data-status=Cancelled] small, &[data-status=Failed] small, &[data-status=Disputed] small":
      {
        color: "var(--z-danger, #F27488)",
      },
    "&[data-status=Paid] small": { color: "var(--z-status-success, #55DCC8)" },
  },
});

const Links = styled("span", {
  base: {
    display: "flex",
    gap: "10px",
    fontSize: "12px",
    "& a": { color: "var(--z-accent, var(--z-premium))" },
  },
});
