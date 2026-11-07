import { Match, Show, Switch, createSignal } from "solid-js";
import { Portal } from "solid-js/web";

import { Trans, useLingui } from "@lingui/solid/macro";
import type { Client } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { TranslatedError } from "@revolt/i18n/errors";
import { BirthMonthField, Button } from "@revolt/ui";

import {
  isAgeRefusal,
  isUnderMinimumAge,
  setAccountAge,
  setAgePromptDismissed,
  toBirthMonth,
} from "./age";
import { AgeRefusedText, UnderMinimumConfirmText } from "./ageTexts";

/**
 * Asks accounts made before Zrzur asked for an age for their month and
 * year of birth. It opens only when asked for (the age gate on mature
 * content), never by itself after login, and "Not now" closes it; until an
 * age is given the account simply can't open mature content. The server
 * enforces that, not this dialog.
 */
export function AgePrompt(props: { client: Client; onRefused?: () => void }) {
  const { t } = useLingui();
  const [month, setMonth] = createSignal(0);
  const [year, setYear] = createSignal(0);
  const [missing, setMissing] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<unknown>();
  const [restricted, setRestricted] = createSignal(false);
  const [confirming, setConfirming] = createSignal(false);
  const [refused, setRefused] = createSignal(false);

  const close = () => setAgePromptDismissed(true);

  async function submit(event: Event) {
    event.preventDefault();
    if (!month() || !year()) return setMissing(true);

    // below 16: ask once more before sending it
    if (isUnderMinimumAge(toBirthMonth(year(), month())) && !confirming()) {
      setConfirming(true);
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const age = await props.client.account.changeAge(
        toBirthMonth(year(), month()),
      );
      if (age?.band === "under_minimum") setRestricted(true);
      else close();
      setAccountAge(age);
    } catch (err) {
      if (isAgeRefusal(err)) {
        // a brand-new account is removed by the server: say so, then sign out
        setRefused(true);
      } else {
        setConfirming(false);
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <Backdrop>
        <Card
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-prompt-title"
          onSubmit={submit}
        >
          <Switch>
            <Match when={refused()}>
              <AgeRefusedNotice />
              <Actions>
                <Button
                  type="button"
                  onPress={() => {
                    close();
                    props.onRefused?.();
                  }}
                >
                  <Trans>OK</Trans>
                </Button>
              </Actions>
            </Match>
            <Match when={confirming()}>
              <h1 id="age-prompt-title">
                <Trans>The date you entered is under 16</Trans>
              </h1>
              <p>
                <UnderMinimumConfirmText />
              </p>
              <Actions>
                <Button
                  type="button"
                  variant="text"
                  isDisabled={busy()}
                  onPress={() => setConfirming(false)}
                >
                  <Trans>Go back</Trans>
                </Button>
                <Button type="submit" isDisabled={busy()}>
                  <Trans>Continue</Trans>
                </Button>
              </Actions>
            </Match>
            <Match when={restricted()}>
              <UnderMinimumNotice />
              <Actions>
                <Button type="button" onPress={close}>
                  <Trans>OK</Trans>
                </Button>
              </Actions>
            </Match>
            <Match when={!restricted() && !confirming() && !refused()}>
              <h1 id="age-prompt-title">
                <Trans>Add your month and year of birth</Trans>
              </h1>
              <p>
                <Trans>
                  Zrzur now asks everyone for this, to keep younger people safe.
                  We keep only the month and year. Until you add it, content
                  marked as mature stays closed.
                </Trans>
              </p>
              <BirthMonthField
                label={t`Month and year of birth`}
                month={month()}
                year={year()}
                disabled={busy()}
                error={missing() && t`Please fill in this field.`}
                onChange={(value) => {
                  setMonth(value.month);
                  setYear(value.year);
                  setMissing(false);
                }}
              />
              <Show when={error()}>
                <ErrorLine role="alert">
                  <TranslatedError error={error()} />
                </ErrorLine>
              </Show>
              <Actions>
                <Button type="button" variant="text" onPress={close}>
                  <Trans>Not now</Trans>
                </Button>
                <Button type="submit" isDisabled={busy()}>
                  <Trans>Save</Trans>
                </Button>
              </Actions>
            </Match>
          </Switch>
        </Card>
      </Backdrop>
    </Portal>
  );
}

/** What a person sees after a new account was refused and removed */
export function AgeRefusedNotice() {
  return (
    <>
      <h1 id="age-prompt-title">
        <Trans>Sorry, we can't create your account</Trans>
      </h1>
      <p>
        <AgeRefusedText />
      </p>
    </>
  );
}

/**
 * What an account below the minimum age sees (no automatic closing: the
 * account is limited and left for review)
 */
export function UnderMinimumNotice() {
  return (
    <>
      <h1 id="age-prompt-title">
        <Trans>Your account is limited</Trans>
      </h1>
      <p>
        <Trans>
          The month and year of birth on this account are below the minimum age
          for Zrzur. Content marked as mature is closed, and our team may review
          the account. If the date is wrong, write to privacy@zrzur.com.
        </Trans>
      </p>
    </>
  );
}

const Backdrop = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    overflowY: "auto",
    background:
      "color-mix(in srgb, var(--z-bg-rail, #0D0E16) 72%, transparent)",
  },
});

const Card = styled("form", {
  base: {
    width: "100%",
    maxWidth: "440px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    borderRadius: "14px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-modal, var(--z-bg-raised))",
    color: "var(--z-fg-primary)",
    "& h1": {
      margin: 0,
      fontSize: "22px",
      lineHeight: "28px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "14px",
      lineHeight: "21px",
      color: "var(--z-fg-secondary)",
    },
    _phone: { padding: "20px 16px" },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
    paddingTop: "8px",
    _phone: { "& button": { minHeight: "44px" } },
  },
});

const ErrorLine = styled("p", {
  base: {
    color: "var(--z-danger) !important",
    fontSize: "13px",
  },
});
