import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  Supercharge,
  billingApi,
  billingOverview,
  billingPlans,
  formatPrice,
  openProviderPage,
  plusActive,
  refreshBilling,
  storeOverview,
} from "@revolt/client/billing";
import { useTime } from "@revolt/i18n";
import { useModals } from "@revolt/modal";
import { useBillingError } from "@revolt/modal/modals/billingErrors";
import {
  Avatar,
  Button,
  SettingsRow,
  SettingsSection,
  Toggle,
} from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";

import { BillingHistory } from "./BillingHistory";
import { TestModeNotice, billingNoticeShown } from "./TestModeNotice";

/**
 * Your Plus subscription and supercharges: renew, cancel, place and move
 */
export function Subscriptions() {
  const { t, i18n } = useLingui();
  const dayjs = useTime();
  const client = useClient();
  const { openModal } = useModals();
  const { navigate } = useSettingsNavigation();
  const describe = useBillingError();
  const [pending, setPending] = createSignal(false);
  const [historyVersion, setHistoryVersion] = createSignal(0);
  const [error, setError] = createSignal<string>();

  const plans = () => billingPlans()!;
  const overview = () => billingOverview();
  const plus = () => overview()?.plus;
  const date = (iso?: string) => (iso ? dayjs(iso).format("LL") : "");
  const price = (minor: number) =>
    formatPrice(minor, plans().currency, i18n().locale);
  const giver = () => {
    const source = plus()?.source;
    return source?.type === "Gift"
      ? client().users.get(source.from)
      : undefined;
  };

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      setError(describe(err));
    } finally {
      setPending(false);
    }
  }

  const editPlus = (body: Parameters<typeof billingApi.editPlus>[1]) =>
    run(async () => storeOverview(await billingApi.editPlus(client(), body)));

  const editSupercharge = (
    item: Supercharge,
    body: Parameters<typeof billingApi.editSupercharge>[2],
  ) =>
    run(async () =>
      storeOverview(await billingApi.editSupercharge(client(), item._id, body)),
    );

  const serverOf = (item: Supercharge) =>
    item.server_id ? client().servers.get(item.server_id) : undefined;

  return (
    <Page>
      <Show when={billingNoticeShown()}>
        <TestModeNotice />
      </Show>
      <Show when={error()}>
        <ErrorLine role="alert">
          <Icon name="warning-circle" size={16} />
          {error()}
        </ErrorLine>
      </Show>

      <SettingsSection title={<Trans>Zrzur Feather</Trans>}>
        <Show
          when={plusActive() && plus()}
          fallback={
            <SettingsRow
              icon={<PlusIcon />}
              title={<Trans>You don't have Feather</Trans>}
              description={
                <Trans>
                  Bigger uploads, longer messages, sharper streams and a free
                  Wing, for {price(plans().plus_price)} a month.
                </Trans>
              }
              control={() => (
                <Button size="sm" onPress={() => navigate("plus")}>
                  <Trans>See Feather</Trans>
                </Button>
              )}
            />
          }
        >
          <SettingsRow
            icon={<PlusIcon />}
            title={<Trans>Zrzur Feather</Trans>}
            description={
              <Switch>
                <Match when={plus()!.source.type === "Gift"}>
                  <Trans>
                    Gift from {giver()?.displayName ?? t`a friend`}. Ends on{" "}
                    {date(plus()!.current_period_end)}, nothing renews.
                  </Trans>
                </Match>
                <Match when={plus()!.source.type === "Grant"}>
                  <Trans>
                    Given by Zrzur. Ends on {date(plus()!.current_period_end)}
                    , nothing renews.
                  </Trans>
                </Match>
                <Match
                  when={
                    plus()!.status === "PastDue" ||
                    plus()!.status === "Incomplete"
                  }
                >
                  <Trans>
                    Your last payment didn't go through. Update your payment
                    method; Feather continues until{" "}
                    {date(plus()!.current_period_end)} while the payment is
                    retried.
                  </Trans>
                </Match>
                <Match when={plus()!.cancel_at_period_end}>
                  <Trans>
                    Cancelled. You keep Feather until{" "}
                    {date(plus()!.current_period_end)}.
                  </Trans>
                </Match>
                <Match when>
                  <Trans>
                    {price(plans().plus_price)} a month. Renews on{" "}
                    {date(plus()!.current_period_end)}.
                  </Trans>
                </Match>
              </Switch>
            }
            control={() => (
              <Show when={plus()!.source.type === "Purchase"}>
                <Show
                  when={plus()!.cancel_at_period_end}
                  fallback={
                    <Button
                      size="sm"
                      variant="tonal"
                      isDisabled={pending()}
                      onPress={() => editPlus({ cancel_at_period_end: true })}
                    >
                      <Trans>Cancel Feather</Trans>
                    </Button>
                  }
                >
                  <Button
                    size="sm"
                    isDisabled={pending()}
                    onPress={() => editPlus({ cancel_at_period_end: false })}
                  >
                    <Trans>Keep Feather</Trans>
                  </Button>
                </Show>
              </Show>
            )}
          />
          <Show
            when={
              plus()!.source.type === "Gift" &&
              (plus()!.source as { note?: string }).note
            }
          >
            <SettingsRow
              icon={<Icon name="gift" size={20} />}
              title={
                <Trans>Note from {giver()?.displayName ?? t`a friend`}</Trans>
              }
              description={<q>{(plus()!.source as { note?: string }).note}</q>}
            />
          </Show>
          <SettingsRow
            icon={<Icon name="eye-slash" size={20} />}
            title={<Trans>Show Feather badge</Trans>}
            description={
              <Trans>
                The Feather badge next to your name on your profile.
              </Trans>
            }
            onClick={() => editPlus({ hide_badge: !overview()!.hide_badge })}
            control={({ labelId }) => (
              <Toggle
                checked={!overview()!.hide_badge}
                disabled={pending()}
                aria-labelledby={labelId}
                onChange={(show) => editPlus({ hide_badge: !show })}
              />
            )}
          />
        </Show>
        <SettingsRow
          icon={<Icon name="gift" size={20} />}
          title={<Trans>Gift Feather to a friend</Trans>}
          description={<Trans>1 month, 3 months or a year, paid once.</Trans>}
          navigational
          onClick={() => openModal({ type: "gift_plus" })}
        />
      </SettingsSection>

      <Show when={plans().portal_available}>
        <SettingsSection title={<Trans>Payment</Trans>}>
          <SettingsRow
            icon={<Icon name="currency-circle-dollar" size={20} />}
            title={<Trans>Payment methods and invoices</Trans>}
            description={
              <Trans>
                Change your card, download invoices and see past payments on our
                payment partner's secure page.
              </Trans>
            }
            control={() => (
              <Button
                size="sm"
                variant="tonal"
                isDisabled={pending()}
                onPress={() =>
                  run(async () => {
                    const { url } = await billingApi.portal(client());
                    openProviderPage(url);
                  })
                }
              >
                <Trans>Manage</Trans>
              </Button>
            )}
          />
        </SettingsSection>
      </Show>

      <SettingsSection
        title={<Trans>Wings</Trans>}
        description={
          <Trans>
            Each Wing counts towards a server's level. Move them any time; they
            leave a server with you.
          </Trans>
        }
      >
        <Show
          when={overview()?.supercharges.length}
          fallback={
            <SettingsRow
              icon={<Icon name="lightning" size={20} />}
              title={<Trans>No Wings yet</Trans>}
              description={
                <Trans>
                  Open a server's menu and choose Give Wings. Each one is{" "}
                  {price(plans().supercharge_price)} a month.
                </Trans>
              }
            />
          }
        >
          <For each={overview()!.supercharges}>
            {(item) => (
              <SettingsRow
                icon={
                  <Show
                    when={serverOf(item)}
                    fallback={<Icon name="lightning" size={20} />}
                  >
                    <Avatar
                      src={serverOf(item)!.iconURL}
                      fallback={serverOf(item)!.name}
                      size={28}
                      shape="rounded-square"
                    />
                  </Show>
                }
                title={
                  <Show
                    when={serverOf(item)}
                    fallback={<Trans>Not on a server yet</Trans>}
                  >
                    {serverOf(item)!.name}
                  </Show>
                }
                description={
                  <Switch>
                    <Match when={item.source === "Plus"}>
                      <Trans>Included with Feather</Trans>
                    </Match>
                    <Match when={item.cancel_at_period_end}>
                      <Trans>
                        Cancelled, ends on {date(item.current_period_end)}
                      </Trans>
                    </Match>
                    <Match when>
                      <Trans>
                        {price(plans().supercharge_price)} a month. Renews on{" "}
                        {date(item.current_period_end)}.
                      </Trans>
                    </Match>
                  </Switch>
                }
                control={() => (
                  <Actions>
                    <Button
                      size="sm"
                      variant="tonal"
                      isDisabled={pending()}
                      onPress={() =>
                        openModal({
                          type: "move_supercharge",
                          supercharge: item,
                        })
                      }
                    >
                      <Show
                        when={item.server_id}
                        fallback={<Trans>Place</Trans>}
                      >
                        <Trans>Move</Trans>
                      </Show>
                    </Button>
                    <Show when={item.server_id}>
                      <Button
                        size="sm"
                        variant="text"
                        isDisabled={pending()}
                        onPress={() => editSupercharge(item, { unplace: true })}
                      >
                        <Trans>Take off</Trans>
                      </Button>
                    </Show>
                    <Show when={item.source === "Purchase"}>
                      <Button
                        size="sm"
                        variant="text"
                        isDisabled={pending()}
                        onPress={() =>
                          editSupercharge(item, {
                            cancel_at_period_end: !item.cancel_at_period_end,
                          })
                        }
                      >
                        <Show
                          when={item.cancel_at_period_end}
                          fallback={<Trans>Cancel</Trans>}
                        >
                          <Trans>Keep</Trans>
                        </Show>
                      </Button>
                    </Show>
                  </Actions>
                )}
              />
            )}
          </For>
        </Show>
      </SettingsSection>

      <BillingHistory version={historyVersion()} />

      <Refresh>
        <Button
          size="sm"
          variant="text"
          isDisabled={pending()}
          onPress={() =>
            run(async () => {
              await refreshBilling(client());
              setHistoryVersion((n) => n + 1);
            })
          }
        >
          <Icon name="arrow-clockwise" size={14} />
          <Trans>Refresh</Trans>
        </Button>
      </Refresh>
    </Page>
  );
}

function PlusIcon() {
  return <BadgeMark id="plus" />;
}

const Page = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "20px" },
});

const ErrorLine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    background: "rgb(237 66 69 / 12%)",
    "& svg": { color: "var(--z-danger, #F27488)" },
  },
});

const Actions = styled("div", {
  base: { display: "flex", alignItems: "center", gap: "4px" },
});

const Refresh = styled("div", {
  base: { display: "flex", justifyContent: "flex-end" },
});
