import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useTierName } from "@revolt/app/interface/discover/tiers";
import { useClient } from "@revolt/client";
import {
  BoostKind,
  DiscoverBoostOffer,
  DiscoverPromotionStatus,
  billingApi,
  formatPrice,
  newOrderKey,
} from "@revolt/client/billing";
import { useTime } from "@revolt/i18n";
import { Avatar, Dialog, DialogProps } from "@revolt/ui";
import { FeatherIcon } from "@revolt/ui/icons/FeatherIcon";
import { Icon } from "@revolt/ui/icons/Icon";
import { FeatherField, WaveEdge } from "@revolt/ui/icons/PremiumArt";

import { useModals } from "..";
import { Modals } from "../types";

import { useStartPurchase } from "./billingCheckout";
import { useBillingError } from "./billingErrors";
import { PaymentMethodPicker, usePaymentMethod } from "./PaymentMethodPicker";

const BOOST_KINDS: readonly BoostKind[] = ["Boost", "SuperBoost", "MegaBoost"];

/** A tier the app can sell (the server may list kinds it does not know yet) */
const boostKind = (kind: string) => BOOST_KINDS.find((known) => known === kind);

type Pending = {
  kind: BoostKind | "Promoted";
  price: number;
  key: string;
  /** every place is taken: the purchase waits in line */
  queued: boolean;
};

/** What is being promoted */
export type PromoteTarget = {
  kind: "server" | "bot";
  id: string;
  name: string;
  icon?: string;
};

/**
 * Promote a server or bot on Discover: boosts that guarantee a place, and
 * the paid top row with its numbers. Every tier has a fixed number of
 * places; when one is full, buyers wait in line and start when a place
 * frees up.
 */
export function PromoteServerModal(
  props: DialogProps & Modals & { type: "promote_server" | "promote_bot" },
) {
  const target = (): PromoteTarget =>
    props.type === "promote_server"
      ? {
          kind: "server",
          id: props.server.id,
          name: props.server.name,
          icon: props.server.iconURL,
        }
      : props.target;

  return (
    <PromoteListing
      show={props.show}
      onClose={props.onClose}
      target={target()}
    />
  );
}

function PromoteListing(props: DialogProps & { target: PromoteTarget }) {
  const { t, i18n } = useLingui();
  const dayjs = useTime();
  const client = useClient();
  const { openModal } = useModals();
  const describe = useBillingError();

  const load = () =>
    props.target.kind === "bot"
      ? billingApi.botPromotion(client(), props.target.id)
      : billingApi.promotion(client(), props.target.id);
  const [status, { mutate }] = createResource<DiscoverPromotionStatus>(load);
  const [pending, setPending] = createSignal<Pending>();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [done, setDone] = createSignal<{ name: string; queued: boolean }>();

  const s = () => status()!;
  const price = (minor: number) =>
    formatPrice(minor, s().currency, i18n().locale);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n().locale).format(value);
  const date = (iso: string) => dayjs(iso).format("LL");

  const boostName = useTierName();
  const tierName = (kind: string) =>
    boostName(kind === "Promoted" ? "TopRow" : kind);

  const startPurchase = useStartPurchase();
  const pay = usePaymentMethod();
  const canBuy = () =>
    s().available && (s().checkout_available ?? true) && s().approved;
  const inTopRow = () => !!s().promoted;
  const fullTier = (tier: DiscoverBoostOffer) =>
    tier.taken >= tier.capacity && s().boost?.kind !== tier.kind;
  const topRowFull = () => s().promoted_open === 0 && !inTopRow();

  async function confirm() {
    const next = pending();
    if (!next) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = props.target.id;
      const product =
        props.target.kind === "bot"
          ? next.kind === "Promoted"
            ? ({ type: "BotPromoted", bot: id } as const)
            : ({ type: "BotBoost", bot: id, kind: next.kind } as const)
          : next.kind === "Promoted"
            ? ({ type: "DiscoverPromoted", server: id } as const)
            : ({ type: "DiscoverBoost", server: id, kind: next.kind } as const);
      if (
        (await startPurchase(client(), product, next.key, pay.method())) ===
        "checkout"
      ) {
        props.onClose();
        return;
      }
      mutate(await load());
      setDone({ name: tierName(next.kind), queued: next.queued });
      setPending(undefined);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const choose = (
    kind: BoostKind | "Promoted",
    amount: number,
    queued: boolean,
  ) => setPending({ kind, price: amount, key: newOrderKey(), queued });

  return (
    <Dialog
      tone="premium"
      iconName="megaphone"
      show={props.show}
      onClose={props.onClose}
      width={660}
      bare
    >
      <Hero>
        <Glow aria-hidden="true" />
        <FeatherField />
        <Close type="button" aria-label={t`Close`} onClick={props.onClose}>
          <Icon name="x" size={18} />
        </Close>
        <HeroIcon data-shape={props.target.kind}>
          <Avatar
            size={48}
            src={props.target.icon}
            fallback={props.target.name}
            shape={props.target.kind === "server" ? "rounded-square" : "circle"}
          />
        </HeroIcon>
        <HeroTitle>
          <Show
            when={props.target.kind === "bot"}
            fallback={<Trans>Promote your server</Trans>}
          >
            <Trans>Promote your bot</Trans>
          </Show>
        </HeroTitle>
        <HeroSub>
          <Trans>
            Put {props.target.name} in front of the people browsing Discover.
          </Trans>
        </HeroSub>
        <Show when={status()}>
          <HeroFacts>
            <span>
              <Show
                when={s().boost}
                fallback={
                  <Show
                    when={s().listed}
                    fallback={<Trans>Not listed on Discover yet</Trans>}
                  >
                    <Trans>Listed on Discover</Trans>
                  </Show>
                }
              >
                <Trans>
                  {tierName(s().boost!.kind)} until {date(s().boost!.ends_at)}
                </Trans>
              </Show>
            </span>
            <i aria-hidden="true" />
            <span>
              <Trans>Discover rank</Trans>{" "}
              <b>
                <Show when={s().rank} fallback="—">
                  #{number(s().rank!)}
                </Show>
              </b>
            </span>
          </HeroFacts>
        </Show>
        <WaveEdge fill="var(--z-bg-raised)" />
      </Hero>
      <Show
        when={status()}
        fallback={
          <Loading>
            <Show when={status.error} fallback={<Trans>Loading…</Trans>}>
              {describe(status.error)}
            </Show>
          </Loading>
        }
      >
        <Body>
          <Show when={error()}>
            <Notice data-tone="warn" role="alert">
              <Icon name="warning-circle" size={16} />
              <p>{error()}</p>
            </Notice>
          </Show>
          <Show when={s().available && s().checkout_available === false}>
            <Notice data-tone="test">
              <Icon name="info" size={16} />
              <p>
                <Trans>
                  Purchases aren't open yet. Nothing can be bought or charged
                  right now.
                </Trans>
              </p>
            </Notice>
          </Show>
          <Show when={s().test_mode}>
            <Notice data-tone="test">
              <Icon name="info" size={16} />
              <p>
                <Trans>
                  Test mode: no real money is charged. Card details are only
                  ever entered on the payment provider's own page.
                </Trans>
              </p>
            </Notice>
          </Show>

          <Show when={!s().approved}>
            <Notice data-tone="warn">
              <Icon name="warning" size={16} />
              <div>
                <p>
                  <Show
                    when={props.target.kind === "bot"}
                    fallback={
                      <Trans>
                        This server isn't on Discover yet. Submit it in Server
                        settings, Discover. Moderators review every server
                        before it can be promoted.
                      </Trans>
                    }
                  >
                    <Trans>
                      This bot isn't on Discover yet. Make it public and submit
                      it from its settings. Moderators review every bot before
                      it can be promoted.
                    </Trans>
                  </Show>
                </p>
                <Show when={props.target.kind === "server"}>
                  <LinkButton
                    type="button"
                    onClick={() => {
                      props.onClose();
                      const server = client().servers.get(props.target.id);
                      if (server)
                        openModal({
                          type: "settings",
                          config: "server",
                          context: server,
                        });
                    }}
                  >
                    <Trans>Open server settings</Trans>
                    <Icon name="caret-right" size={14} />
                  </LinkButton>
                </Show>
              </div>
            </Notice>
          </Show>
          <Show
            when={
              s().approved &&
              props.target.kind === "server" &&
              !s().boost &&
              s().member_count < s().min_members
            }
          >
            <Notice>
              <Icon name="users" size={16} />
              <p>
                <Trans>
                  Servers need {s().min_members} members to be listed. A
                  promotion lists you right away.
                </Trans>
              </p>
            </Notice>
          </Show>
          <Show when={done()}>
            <Notice data-tone="ok" role="status">
              <Icon name="check-circle" size={16} />
              <p>
                <Show
                  when={done()!.queued}
                  fallback={
                    <Trans>
                      {done()!.name} is on. It may take a moment to show.
                    </Trans>
                  }
                >
                  <Trans>
                    Paid. You're in line for {done()!.name} and start
                    automatically when a place frees up.
                  </Trans>
                </Show>
              </p>
            </Notice>
          </Show>

          <SectionHead>
            <FeatherIcon size={20} tone="plain" />
            <div>
              <h3>
                <Trans>Promote</Trans>
              </h3>
              <p>
                <Trans>
                  {s().days} days, paid once. Your place on the list is held for
                  you.
                </Trans>
              </p>
            </div>
            <LaunchTag>
              <Trans>Launch prices</Trans>
            </LaunchTag>
          </SectionHead>

          <Tiers>
            <For each={s().boosts}>
              {(tier) => {
                const active = () => s().boost?.kind === tier.kind;
                const left = () => Math.max(0, tier.capacity - tier.taken);
                return (
                  <Tier
                    data-kind={tier.kind}
                    data-active={active()}
                    data-popular={tier.kind === "SuperBoost"}
                  >
                    <TierHead data-kind={tier.kind}>
                      <TierName>
                        {tierName(tier.kind)}
                        <Show when={tier.kind === "SuperBoost"}>
                          <Popular>
                            <Trans>Recommended</Trans>
                          </Popular>
                        </Show>
                      </TierName>
                      <TierRank>
                        <Trans>Top {tier.guarantee}</Trans>
                      </TierRank>
                      <Fan
                        aria-hidden="true"
                        data-count={FEATHERS[tier.kind] ?? 1}
                      >
                        <For
                          each={Array.from({
                            length: FEATHERS[tier.kind] ?? 1,
                          })}
                        >
                          {() => <FeatherIcon size={26} tone="plain" />}
                        </For>
                      </Fan>
                      <WaveEdge fill="var(--z-bg-input)" height={12} />
                    </TierHead>
                    <TierBody>
                      <TierProjected>
                        <Trans>
                          You'd be #{number(tier.projected_rank)} on Discover
                        </Trans>
                      </TierProjected>
                      <Places>
                        <Meter aria-hidden="true">
                          <i
                            style={{
                              width: `${Math.min(100, (tier.taken / Math.max(1, tier.capacity)) * 100)}%`,
                            }}
                          />
                        </Meter>
                        <small>
                          <Switch
                            fallback={
                              <Trans>
                                {left()} of {tier.capacity} places left
                              </Trans>
                            }
                          >
                            <Match when={tier.position}>
                              <Trans>You're #{tier.position} in line</Trans>
                            </Match>
                            <Match when={fullTier(tier)}>
                              <Trans>Full · {tier.waiting} waiting</Trans>
                            </Match>
                          </Switch>
                        </small>
                      </Places>
                      <TierFoot>
                        <TierPrice>
                          {price(tier.price)}
                          <small>
                            <Trans>/ {s().days} days</Trans>
                          </small>
                        </TierPrice>
                        <BuyButton
                          type="button"
                          data-kind={tier.kind}
                          disabled={!canBuy() || busy()}
                          onClick={() => {
                            const kind = boostKind(tier.kind);
                            if (kind) choose(kind, tier.price, fullTier(tier));
                          }}
                        >
                          <Switch fallback={<Trans>Get it</Trans>}>
                            <Match when={active()}>
                              <Trans>Add {s().days} days</Trans>
                            </Match>
                            <Match when={fullTier(tier)}>
                              <Trans>Join the line</Trans>
                            </Match>
                          </Switch>
                        </BuyButton>
                      </TierFoot>
                      <Show when={active()}>
                        <TierNote>
                          <Trans>
                            Running until {date(s().boost!.ends_at)}
                          </Trans>
                        </TierNote>
                      </Show>
                    </TierBody>
                  </Tier>
                );
              }}
            </For>
          </Tiers>
          <Fine>
            <Trans>
              Each tier has a fixed number of places so every guarantee can be
              kept. Bigger listings land even higher. Only your biggest
              promotion counts; buying the same one again adds {s().days} days.
            </Trans>
          </Fine>

          <Promoted data-active={inTopRow()}>
            <PromotedTop>
              <SectionHead>
                <Icon name="megaphone" size={18} />
                <div>
                  <h3>
                    <Trans>Top row</Trans>
                  </h3>
                  <p>
                    <Trans>
                      Above every promoted listing, the first thing people see
                      on Discover.
                    </Trans>
                  </p>
                </div>
              </SectionHead>
              <Slots>
                <For each={Array.from({ length: s().promoted_slots })}>
                  {(_, index) => (
                    <SlotDot
                      data-open={
                        index() >= s().promoted_slots - s().promoted_open
                      }
                      aria-hidden="true"
                    />
                  )}
                </For>
                <span>
                  <Trans>
                    {s().promoted_open} of {s().promoted_slots} open
                  </Trans>
                </span>
              </Slots>
            </PromotedTop>

            <Bullets>
              <Show when={s().weekly_browsers >= 10}>
                <li>
                  <Icon name="users" size={14} />
                  <Trans>
                    ~{number(s().weekly_browsers)} people browsed Discover this
                    week
                  </Trans>
                </li>
              </Show>
              <li>
                <Icon name="list-numbers" size={14} />
                <Trans>
                  Only {s().promoted_slots} spots, all shown at once
                </Trans>
              </li>
              <li>
                <Icon name="eye" size={14} />
                <Trans>Live views, clicks and joins</Trans>
              </li>
            </Bullets>

            <Show when={s().promoted}>
              <Stats>
                <Stat>
                  <strong>{number(s().promoted!.views)}</strong>
                  <span>
                    <Trans>Views</Trans>
                  </span>
                </Stat>
                <Stat>
                  <strong>{number(s().promoted!.clicks)}</strong>
                  <span>
                    <Trans>Clicks</Trans>
                  </span>
                </Stat>
                <Stat>
                  <strong>{number(s().promoted!.joins)}</strong>
                  <span>
                    <Show
                      when={props.target.kind === "bot"}
                      fallback={<Trans>Joins</Trans>}
                    >
                      <Trans>Adds</Trans>
                    </Show>
                  </span>
                </Stat>
              </Stats>
              <TierNote>
                <Trans>
                  In the top row until {date(s().promoted!.ends_at)}
                </Trans>
              </TierNote>
            </Show>

            <PromotedFooter>
              <Show
                when={s().promoted_position}
                fallback={
                  <Show when={topRowFull()}>
                    <small>
                      <Trans>Full · {s().promoted_waiting} waiting</Trans>
                    </small>
                  </Show>
                }
              >
                <small>
                  <Trans>You're #{s().promoted_position} in line</Trans>
                </small>
              </Show>
              <PromotedPrice>
                {price(s().promoted_price)}
                <small>
                  <Trans>/ {s().days} days</Trans>
                </small>
              </PromotedPrice>
              <PromoteButton
                type="button"
                disabled={!canBuy() || busy()}
                onClick={() =>
                  choose("Promoted", s().promoted_price, topRowFull())
                }
              >
                <Switch fallback={<Trans>Promote now</Trans>}>
                  <Match when={inTopRow()}>
                    <Trans>Add {s().days} days</Trans>
                  </Match>
                  <Match when={topRowFull()}>
                    <Trans>Join the line</Trans>
                  </Match>
                </Switch>
              </PromoteButton>
            </PromotedFooter>
          </Promoted>

          <Fine>
            <Trans>
              Paid listings follow the same rules as everyone else. One that's
              locked, renamed to something blocked, or removed for breaking the
              rules stops showing, with no refund.
            </Trans>
          </Fine>

          <Show when={pending()}>
            <ConfirmBar role="dialog" aria-label={t`Confirm purchase`}>
              <p>
                <Show
                  when={pending()!.queued}
                  fallback={
                    <Trans>
                      {tierName(pending()!.kind)} for {s().days} days:{" "}
                      {price(pending()!.price)}, paid once.
                    </Trans>
                  }
                >
                  <Trans>
                    {tierName(pending()!.kind)} is full. Pay{" "}
                    {price(pending()!.price)} now and start automatically when a
                    place frees up.
                  </Trans>
                </Show>
              </p>
              <PaymentMethodPicker choice={pay} disabled={busy()} />
              <div>
                <LinkButton
                  type="button"
                  disabled={busy()}
                  onClick={() => setPending(undefined)}
                >
                  <Trans>Cancel</Trans>
                </LinkButton>
                <PromoteButton
                  type="button"
                  disabled={busy()}
                  onClick={() => void confirm()}
                >
                  <Trans>Confirm</Trans>
                </PromoteButton>
              </div>
            </ConfirmBar>
          </Show>
        </Body>
      </Show>
    </Dialog>
  );
}

const AMBER = "var(--z-premium)";

/** a tier wears as many feathers as it is strong */
const FEATHERS: Record<string, number> = {
  Boost: 1,
  SuperBoost: 2,
  MegaBoost: 3,
};
const PINK = "var(--z-premium)";
const PINK_GRADIENT = "var(--z-premium-gradient)";

/** rose on top, ending in a white wave over the plain body */
const Hero = styled("div", {
  base: {
    flexShrink: 0,
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: "6px",
    padding: "22px 24px 42px",
    color: "#fff",
    background: "var(--z-premium-hero)",
  },
});

const Glow = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    background:
      "radial-gradient(55% 60% at 50% 0%, rgb(255 255 255 / 40%), transparent 70%), radial-gradient(40% 50% at 100% 90%, rgb(255 255 255 / 30%), transparent 70%)",
  },
});

const Close = styled("button", {
  base: {
    position: "absolute",
    top: "12px",
    insetInlineEnd: "12px",
    width: "32px",
    height: "32px",
    display: "grid",
    placeItems: "center",
    border: "none",
    borderRadius: "8px",
    background: "rgb(0 0 0 / 18%)",
    color: "#fff",
    cursor: "pointer",
    "&:hover": { background: "rgb(0 0 0 / 30%)" },
  },
});

/** the server or bot icon in a white ring */
const HeroIcon = styled("div", {
  base: {
    padding: "3px",
    borderRadius: "16px",
    background: "#fff",
    boxShadow: "0 10px 26px rgb(0 0 0 / 45%)",
    "&[data-shape=bot]": { borderRadius: "50%" },
  },
});

const HeroTitle = styled("h2", {
  base: {
    margin: "6px 0 0",
    fontSize: "20px",
    fontWeight: 800,
    lineHeight: "24px",
    textShadow: "0 2px 12px rgb(0 0 0 / 40%)",
  },
});

const HeroSub = styled("p", {
  base: {
    margin: 0,
    maxWidth: "48ch",
    fontSize: "13px",
    color: "rgb(255 255 255 / 85%)",
  },
});

/** status and rank, split by a white hairline */
const HeroFacts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    marginTop: "6px",
    padding: "4px 12px",
    borderRadius: "999px",
    fontSize: "12px",
    background: "rgb(0 0 0 / 30%)",
    border: "1px solid rgb(255 255 255 / 40%)",
    "& i": {
      width: "1px",
      height: "14px",
      background: "rgb(255 255 255 / 55%)",
    },
    "& b": { fontWeight: 800 },
  },
});

const Loading = styled("div", {
  base: {
    padding: "24px",
    textAlign: "center",
    color: "var(--z-fg-muted)",
    background: "var(--z-bg-raised)",
  },
});

const Body = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "14px 20px 20px",
    background: "var(--z-bg-raised)",
  },
});

const Notice = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    alignItems: "start",
    columnGap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: "19px",
    textAlign: "start",
    color: "var(--z-fg-primary)",
    background: "var(--z-bg-input)",
    "& p": { margin: 0 },
    "& > svg": { marginTop: "2px", color: "var(--z-fg-muted)" },
    "& > div": {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "6px",
    },
    "&[data-tone=test]": {
      background: "rgb(240 178 50 / 10%)",
      border: "1px solid rgb(240 178 50 / 30%)",
      "& > svg": { color: "var(--z-status-warning, #F3B96B)" },
    },
    "&[data-tone=warn]": {
      background: "rgb(237 66 69 / 9%)",
      border: "1px solid rgb(237 66 69 / 25%)",
      "& > svg": { color: "var(--z-danger, #F27488)" },
    },
    "&[data-tone=ok]": {
      background: "rgb(59 165 93 / 10%)",
      border: "1px solid rgb(59 165 93 / 30%)",
      "& > svg": { color: "var(--z-status-success, #55DCC8)" },
    },
  },
});

const SectionHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "4px",
    "& > svg": { color: PINK, flexShrink: 0 },
    "& h3": {
      margin: 0,
      fontSize: "16px",
      fontWeight: 600,
      color: "var(--z-fg-primary)",
    },
    "& p": { margin: 0, fontSize: "12px", color: "var(--z-fg-muted)" },
    "& > div": { flex: 1 },
  },
});

const LaunchTag = styled("span", {
  base: {
    flexShrink: 0,
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
    color: PINK,
    border: "1px dashed color-mix(in srgb, var(--z-premium) 60%, transparent)",
    background: "color-mix(in srgb, var(--z-premium) 8%, transparent)",
  },
});

const Tiers = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "10px",
  },
});

/** two tones: a coloured band on top, a plain body, a white hairline */
const Tier = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "14px",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",
    "&[data-active=true]": {
      outline: `2px solid ${PINK}`,
      outlineOffset: "2px",
    },
  },
});

/** the coloured top of a tier; ends in the same white wave as the hero */
const TierHead = styled("div", {
  base: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minHeight: "88px",
    padding: "12px 12px 22px",
    // room for the feathers, so long names never run under them
    paddingInlineEnd: "68px",
    color: "#fff",
    background:
      "radial-gradient(80% 110% at 0% 0%, rgb(255 255 255 / 40%), transparent 60%), var(--z-premium-gradient)",
    "--z-feather-cut":
      "color-mix(in srgb, var(--z-premium-deep) 55%, transparent)",
    "&[data-kind=SuperBoost]": {
      background:
        "radial-gradient(80% 110% at 0% 0%, rgb(255 255 255 / 40%), transparent 60%), var(--z-premium-gradient)",
      "--z-feather-cut":
        "color-mix(in srgb, var(--z-premium-deep) 55%, transparent)",
    },
    "&[data-kind=MegaBoost]": {
      color: "var(--z-on-premium)",
      background:
        "radial-gradient(80% 110% at 0% 0%, rgb(255 255 255 / 30%), transparent 60%), var(--z-premium-hero)",
      "--z-feather-cut":
        "color-mix(in srgb, var(--z-premium-deep) 80%, transparent)",
    },
  },
});

/** one, two or three feathers fanned out at the end of the head */
const Fan = styled("div", {
  base: {
    position: "absolute",
    zIndex: -1,
    // at the end of the head in either direction, leaning away from the text
    insetInlineEnd: "14px",
    _rtl: { scale: "-1 1" },
    bottom: "22px",
    display: "flex",
    // drawn left to right in every language; only its side follows the page
    direction: "ltr",
    "&:dir(rtl)": { right: "auto", left: "14px" },
    opacity: 0.9,
    "& svg": { transformOrigin: "15% 85%" },
    "& svg + svg": { marginInlineStart: "-16px" },
    "&[data-count='2'] svg:nth-child(1)": { rotate: "-14deg" },
    "&[data-count='2'] svg:nth-child(2)": { rotate: "10deg" },
    "&[data-count='3'] svg:nth-child(1)": { rotate: "-22deg" },
    "&[data-count='3'] svg:nth-child(3)": { rotate: "20deg" },
  },
});

const TierName = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    // the badge row runs over the feathers
    marginInlineEnd: "-54px",
    fontSize: "14px",
    fontWeight: 700,
  },
});

const Popular = styled("span", {
  base: {
    padding: "1px 8px",
    borderRadius: "999px",
    fontSize: "10px",
    fontWeight: 800,
    color: "var(--z-premium-deep)",
    background: "#fff",
    whiteSpace: "nowrap",
  },
});

const TierRank = styled("div", {
  base: { fontSize: "22px", fontWeight: 800, lineHeight: "28px" },
});

const TierBody = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "12px 14px 14px",
  },
});

const TierProjected = styled("div", {
  base: { fontSize: "12px", color: "var(--z-fg-secondary)" },
});

const Places = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    "& small": { fontSize: "11px", color: "var(--z-fg-secondary)" },
  },
});

const Meter = styled("div", {
  base: {
    height: "4px",
    borderRadius: "999px",
    background: "var(--z-bg-input)",
    overflow: "hidden",
    "& i": {
      display: "block",
      height: "100%",
      borderRadius: "999px",
      background: PINK_GRADIENT,
    },
  },
});

const TierFoot = styled("div", {
  base: {
    marginTop: "auto",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
});

const TierPrice = styled("div", {
  base: {
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "baseline",
    gap: "3px",
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    "& small": {
      fontSize: "11px",
      fontWeight: 500,
      color: "var(--z-fg-muted)",
    },
  },
});

const TierNote = styled("div", {
  base: { fontSize: "12px", color: "var(--z-fg-muted)" },
});

const BuyButton = styled("button", {
  base: {
    height: "34px",
    padding: "0 14px",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    color: "#fff",
    background: PINK_GRADIENT,
    whiteSpace: "nowrap",
    "&[data-kind=MegaBoost]": {
      color: "var(--z-on-premium)",
      background: "var(--z-premium-gradient)",
    },
    "&:hover:not(:disabled)": { filter: "brightness(1.08)" },
    "&:active:not(:disabled)": { transform: "translateY(0.5px) scale(0.985)" },
    "&:disabled": { opacity: 0.45, cursor: "default" },
  },
});

const Fine = styled("p", {
  base: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const Promoted = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    borderRadius: "14px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--z-premium) 10%, transparent), transparent 60%), var(--z-bg-raised)",
    border: "1px solid color-mix(in srgb, var(--z-premium) 40%, transparent)",
    "& svg": { color: AMBER },
    "&[data-active=true]": { borderColor: AMBER, borderWidth: "2px" },
  },
});

const PromotedTop = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
  },
});

const Bullets = styled("ul", {
  base: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexWrap: "wrap",
    gap: "6px 14px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    "& li": { display: "flex", alignItems: "center", gap: "6px" },
  },
});

const Stats = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
});

const Stat = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px",
    borderRadius: "10px",
    background: "var(--z-bg-input)",
    "& strong": { fontSize: "20px", color: "var(--z-fg-primary)" },
    "& span": { fontSize: "12px", color: "var(--z-fg-muted)" },
  },
});

const PromotedFooter = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    "& > small": {
      marginInlineEnd: "auto",
      fontSize: "12px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Slots = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "var(--z-fg-secondary)",
    "& > span": { marginInlineStart: "6px", whiteSpace: "nowrap" },
  },
});

const SlotDot = styled("i", {
  base: {
    width: "10px",
    height: "10px",
    borderRadius: "3px",
    background: "var(--z-border-strong)",
    "&[data-open=true]": { background: AMBER },
  },
});

const PromotedPrice = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    gap: "3px",
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    "& small": {
      fontSize: "11px",
      fontWeight: 500,
      color: "var(--z-fg-muted)",
    },
  },
});

const PromoteButton = styled("button", {
  base: {
    height: "36px",
    padding: "0 16px",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    color: "var(--z-on-premium)",
    background: AMBER,
    whiteSpace: "nowrap",
    "&:hover:not(:disabled)": { filter: "brightness(1.06)" },
    "&:active:not(:disabled)": { transform: "translateY(0.5px) scale(0.985)" },
    "&:disabled": { opacity: 0.5, cursor: "default" },
  },
});

const LinkButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    border: "none",
    background: "none",
    padding: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--z-accent-text, var(--z-accent))",
    cursor: "pointer",
    "&:disabled": { opacity: 0.6 },
    // direction icons turn by themselves in right-to-left (styles.css)
  },
});

const ConfirmBar = styled("div", {
  base: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "12px",
    background: "var(--z-popover-bg)",
    border: "1px solid var(--z-popover-border)",
    boxShadow: "var(--z-popover-lift)",
    fontSize: "14px",
    color: "var(--z-fg-primary)",
    "& p": { margin: 0, flex: 1, minWidth: "220px" },
    "& > div": { display: "flex", alignItems: "center", gap: "10px" },
  },
});
