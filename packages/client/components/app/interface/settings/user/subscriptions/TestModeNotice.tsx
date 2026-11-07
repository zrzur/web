import { Match, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { billingPlans, checkoutAvailable } from "@revolt/client/billing";
import { Icon } from "@revolt/ui/icons/Icon";

/** Whether a billing notice should show (test money or locked checkout) */
export const billingNoticeShown = () =>
  !!billingPlans()?.test_mode || !checkoutAvailable();

/**
 * Banner for how billing runs: purchases not open yet, provider sandbox
 * (test cards, no real money) or simulated payments
 */
export function TestModeNotice() {
  const provider = () => billingPlans()?.provider;
  return (
    <Notice role="note">
      <Icon name="info" size={16} />
      <span>
        <Switch
          fallback={
            <Trans>
              Test mode: purchases are simulated and nothing is charged. No card
              details are asked for or stored.
            </Trans>
          }
        >
          <Match when={!checkoutAvailable()}>
            <Trans>
              Purchases aren't open yet. You can look around, but nothing can be
              bought or charged right now.
            </Trans>
          </Match>
          <Match when={provider() && provider() !== "test"}>
            <Trans>
              Test mode: payments run in the payment provider's test
              environment. Use its test cards; no real money is charged.
            </Trans>
          </Match>
        </Switch>
      </span>
    </Notice>
  );
}

const Notice = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: "19px",
    color: "var(--z-fg-primary)",
    background: "rgb(240 178 50 / 12%)",
    border: "1px solid rgb(240 178 50 / 35%)",
    "& svg": {
      flexShrink: 0,
      marginTop: "2px",
      color: "var(--z-status-warning, #F3B96B)",
    },
  },
});
