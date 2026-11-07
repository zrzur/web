import { Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import {
  accountAge,
  fromBirthMonth,
  setAccountAge,
  toBirthMonth,
} from "@revolt/client/age";
import { TranslatedError } from "@revolt/i18n/errors";
import {
  BirthMonthField,
  Button,
  SettingsFormPanel,
  SettingsRow,
  TextField,
  useSnackbar,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";
import { styled } from "styled-system/jsx";

/**
 * Month and year of birth, inside "Account information".
 *
 * The server applies the rules (younger any time; older once, within the
 * same age group; support for anything else); this screen only explains
 * them. A stated age is never shown as verified.
 */
export function AgeSettings() {
  const client = useClient();
  const { t, i18n } = useLingui();
  const snackbar = useSnackbar();

  const [editing, setEditing] = createSignal(false);
  const [month, setMonth] = createSignal(0);
  const [year, setYear] = createSignal(0);
  const [password, setPassword] = createSignal("");
  const [error, setError] = createSignal<unknown>();
  const [busy, setBusy] = createSignal(false);

  const described = () => {
    const value = accountAge()?.birth_month;
    if (!value) return t`Not added`;
    const { year, month } = fromBirthMonth(value);
    return new Intl.DateTimeFormat(i18n().locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  };

  function open() {
    const value = accountAge()?.birth_month;
    const current = value ? fromBirthMonth(value) : undefined;
    setMonth(current?.month ?? 0);
    setYear(current?.year ?? 0);
    setPassword("");
    setError(undefined);
    setEditing(true);
  }

  async function save(event: Event) {
    event.preventDefault();
    if (!month() || !year()) return;

    setBusy(true);
    setError(undefined);
    try {
      const age = await client().account.changeAge(
        toBirthMonth(year(), month()),
        password() || undefined,
      );
      setAccountAge(age);
      setEditing(false);
      snackbar.show({ message: t`Saved` });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SettingsRow
        icon={<Icon name="cake" size={20} />}
        title={<Trans>Month and year of birth</Trans>}
        description={
          <>
            {described()}
            {" · "}
            <Switch>
              <Match when={accountAge()?.band === "unknown"}>
                <Trans>
                  Content marked as mature stays closed until you add it.
                </Trans>
              </Match>
              <Match when={accountAge()?.band === "under_minimum"}>
                <Trans>
                  Below the minimum age: your account is limited and may be
                  reviewed.
                </Trans>
              </Match>
              <Match when={accountAge()?.band === "teen"}>
                <Trans>Mature content is hidden for your age.</Trans>
              </Match>
              <Match when={accountAge()?.band === "adult_declared"}>
                <Trans>Stated by you, not verified.</Trans>
              </Match>
            </Switch>
          </>
        }
        control={() => (
          <Show when={!editing()}>
            <Button size="sm" variant="tonal" onPress={open}>
              <Trans>Change</Trans>
            </Button>
          </Show>
        )}
      />
      <Show when={editing()}>
        <form onSubmit={save}>
          <SettingsFormPanel>
            <BirthMonthField
              label={t`Month and year of birth`}
              helper={t`You can make yourself younger at any time. You can make yourself older only once, and only within the same age group. For anything else, write to privacy@zrzur.com.`}
              month={month()}
              year={year()}
              disabled={busy()}
              onChange={(value) => {
                setMonth(value.month);
                setYear(value.year);
              }}
            />
            <Show when={accountAge()?.birth_month}>
              <TextField
                type="password"
                name="current-password"
                autocomplete="current-password"
                required
                label={t`Current password`}
                placeholder={t`Enter your current password.`}
                value={password()}
                onInput={(event) => setPassword(event.currentTarget.value)}
              />
            </Show>
            <Show when={error()}>
              <ErrorLine role="alert">
                <TranslatedError error={error()} />
              </ErrorLine>
            </Show>
            <Actions>
              <Button
                type="button"
                variant="text"
                onPress={() => setEditing(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
              <Button
                type="submit"
                isDisabled={
                  busy() ||
                  !month() ||
                  !year() ||
                  (!!accountAge()?.birth_month && !password())
                }
              >
                <Trans>Save</Trans>
              </Button>
            </Actions>
          </SettingsFormPanel>
        </form>
      </Show>
    </>
  );
}

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "8px",
  },
});

const ErrorLine = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    color: "var(--z-danger)",
  },
});
