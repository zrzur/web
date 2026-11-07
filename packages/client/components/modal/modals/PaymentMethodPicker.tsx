import { createMemo, createSignal, Show } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  type PaymentMethod,
  billingPlans,
  paymentMethods,
} from "@revolt/client/billing";
import { Radio2 } from "@revolt/ui";

/**
 * How the buyer pays, for one purchase window. Defaults to the preferred
 * provider; only shown when there is more than one.
 */
export function usePaymentMethod() {
  const methods = createMemo(() => paymentMethods(billingPlans()));
  const [picked, setPicked] = createSignal<PaymentMethod>();
  // a pick that is no longer offered falls back to the preferred one
  const method = () => {
    const choice = picked();
    return choice && methods().includes(choice) ? choice : methods()[0];
  };
  return { methods, method, setMethod: setPicked };
}

/**
 * "Pay with" choice (card or PayPal) above a purchase window's actions
 */
export function PaymentMethodPicker(props: {
  choice: ReturnType<typeof usePaymentMethod>;
  disabled?: boolean;
}) {
  const { t } = useLingui();
  return (
    <Show when={props.choice.methods().length > 1}>
      <Methods data-payment-methods>
        <legend>{t`Pay with`}</legend>
        <Radio2
          value={props.choice.method()}
          disabled={props.disabled}
          onChange={(event) =>
            props.choice.setMethod(event.currentTarget.value as PaymentMethod)
          }
        >
          <Radio2.Option value="stripe">
            <strong>{t`Card`}</strong>
            <small>{t`Credit or debit card, on Stripe's secure page.`}</small>
          </Radio2.Option>
          <Radio2.Option value="paypal">
            {/* the brand name stays as it is in every language */}
            <strong>
              <bdi>PayPal</bdi>
            </strong>
            <small>{t`Your PayPal balance, bank or card, on PayPal's page.`}</small>
          </Radio2.Option>
        </Radio2>
      </Methods>
    </Show>
  );
}

const Methods = styled("fieldset", {
  base: {
    border: 0,
    padding: 0,
    margin: "16px 0 0",
    minWidth: 0,
    // a full row inside wrapping bars (Discover confirm)
    flexBasis: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    "& legend": {
      padding: 0,
      marginBlockEnd: "8px",
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-section-label, var(--z-fg-muted))",
    },
    "& [role=radiogroup] > *": { alignItems: "flex-start" },
    "& [role=radiogroup] span": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
    },
    "& strong": { fontSize: "14px", color: "var(--z-fg-primary)" },
    "& small": {
      fontSize: "13px",
      lineHeight: 1.4,
      color: "var(--z-fg-muted)",
    },
  },
});
