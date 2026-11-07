import {
  For,
  Show,
  createEffect,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { isolate } from "@revolt/common/lib/isolate";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import {
  ServerSuperchargeInfo,
  billingApi,
  billingOverview,
  billingPlans,
  checkoutAvailable,
  formatMegabytes,
  formatPrice,
  newOrderKey,
  nextLevel,
  plusActive,
  storeOverview,
} from "@revolt/client/billing";
import { Avatar, Dialog, DialogProps } from "@revolt/ui";
import { FeatherIcon } from "@revolt/ui/icons/FeatherIcon";
import { Icon } from "@revolt/ui/icons/Icon";
import { FeatherField, WaveEdge } from "@revolt/ui/icons/PremiumArt";

import { useModals } from "..";
import { Modals } from "../types";

import { useStartPurchase } from "./billingCheckout";
import { useBillingError } from "./billingErrors";
import { PaymentMethodPicker, usePaymentMethod } from "./PaymentMethodPicker";

/**
 * Server feathers: members give a server feathers and it levels up for
 * everyone. Shows the level, what each level unlocks, who gave feathers,
 * and giving (or taking back) your own.
 */
export function SuperchargeServerModal(
  props: DialogProps & Modals & { type: "supercharge_server" },
) {
  const { t, i18n } = useLingui();
  const client = useClient();
  const { openModal } = useModals();
  const describe = useBillingError();
  const startPurchase = useStartPurchase();
  const pay = usePaymentMethod();
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const [info, { refetch }] = createResource<ServerSuperchargeInfo>(() =>
    billingApi.server(client(), props.server.id),
  );

  // supporters we haven't seen yet are fetched, so nobody shows as unknown
  createEffect(() => {
    for (const entry of info()?.superchargers ?? []) {
      if (!client().users.get(entry.user_id)) {
        client()
          .users.fetch(entry.user_id)
          .catch(() => undefined);
      }
    }
  });

  const plans = () => billingPlans();
  const levels = () => plans()?.levels ?? [];
  const locale = () => i18n().locale;
  const price = () =>
    formatPrice(
      plans()?.supercharge_price ?? 0,
      plans()?.currency ?? "",
      locale(),
    );

  // the server object updates live; the info call fills in who
  const count = () => props.server.supercharge?.count ?? info()?.count ?? 0;
  const level = () => props.server.supercharge?.level ?? info()?.level ?? 0;
  const top = () => levels().at(-1)?.supercharges ?? 1;
  const next = () => nextLevel(count());

  const mine = () => billingOverview()?.supercharges ?? [];
  const mineHere = () =>
    mine().filter((item) => item.server_id === props.server.id);
  const unplaced = () => mine().filter((item) => !item.server_id);

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(undefined);
    try {
      await action();
      await refetch();
    } catch (err) {
      setError(describe(err));
    } finally {
      setPending(false);
    }
  }

  // a free one (from Plus) is given; otherwise one is bought
  const give = () =>
    run(async () =>
      unplaced().length
        ? storeOverview(
            await billingApi.supercharge(client(), {
              server: props.server.id,
              supercharge: unplaced()[0]._id,
            }),
          )
        : startPurchase(
            client(),
            { type: "Supercharge", server: props.server.id },
            newOrderKey(),
            pay.method(),
          ).then((result) => {
            if (result === "checkout") props.onClose();
          }),
    );

  const takeBack = () =>
    run(async () =>
      storeOverview(
        await billingApi.editSupercharge(client(), mineHere()[0]._id, {
          unplace: true,
        }),
      ),
    );

  const stream = (resolution: number[], fps: number) =>
    `${resolution[1]}p${fps}`;

  return (
    <Dialog
      tone="premium"
      iconName="lightning"
      show={props.show}
      onClose={props.onClose}
      size="lg"
      bare
    >
      <Hero data-level={level()}>
        <Glow aria-hidden="true" />
        <FeatherField />
        <Close type="button" aria-label={t`Close`} onClick={props.onClose}>
          <Icon name="x" size={18} />
        </Close>

        <IconFrame data-level={level()}>
          <Avatar
            size={60}
            src={props.server.iconURL}
            fallback={props.server.name}
            shape="rounded-square"
          />
          <Show when={level()}>
            <LevelSeal aria-hidden="true">
              <FeatherIcon size={14} tone="plain" />
              {level()}
            </LevelSeal>
          </Show>
        </IconFrame>

        <HeroTitle>
          <Trans>Wings for {isolate(props.server.name)}</Trans>
        </HeroTitle>
        <HeroSub>
          <Show
            when={level()}
            fallback={
              <Trans>
                Every Wing lifts this server for everyone in it. Any member can
                give one.
              </Trans>
            }
          >
            <Trans>Level {level()} unlocked for everyone here</Trans>
          </Show>
        </HeroSub>

        <Track>
          <TrackFill
            style={{ width: `${Math.min(100, (count() / top()) * 100)}%` }}
          />
          <For each={levels()}>
            {(entry) => (
              <Marker
                data-reached={count() >= entry.supercharges}
                style={{
                  "inset-inline-start": `${(entry.supercharges / top()) * 100}%`,
                }}
              >
                <i>
                  <FeatherIcon size={18} tone="plain" />
                </i>
                <span>
                  <Trans>Level {entry.level}</Trans>
                </span>
              </Marker>
            )}
          </For>
        </Track>

        <Tally>
          <strong>
            <Trans>{count()} Wings</Trans>
          </strong>
          <Show
            when={next()}
            fallback={
              <em>
                <Trans>Highest level!</Trans>
              </em>
            }
          >
            <span>
              <Trans>
                {next()!.supercharges - count()} more for Level {next()!.level}
              </Trans>
            </span>
          </Show>
        </Tally>
        <WaveEdge fill="var(--z-bg-raised)" />
      </Hero>

      <Content>
        <Show when={error()}>
          <ErrorLine role="alert">
            <Icon name="warning-circle" size={16} />
            {error()}
          </ErrorLine>
        </Show>

        {/* a free Wing needs no payment */}
        <Show when={!unplaced().length && checkoutAvailable()}>
          <PaymentMethodPicker choice={pay} disabled={pending()} />
        </Show>
        <GiveButton
          type="button"
          disabled={pending() || (!unplaced().length && !checkoutAvailable())}
          title={
            !unplaced().length && !checkoutAvailable()
              ? t`Purchases aren't open yet.`
              : undefined
          }
          onClick={() => void give()}
        >
          <FeatherIcon size={18} tone="plain" />
          <Show
            when={unplaced().length}
            fallback={
              <>
                <span>
                  <Trans>Give a Wing</Trans>
                </span>
                <Divider aria-hidden="true" />
                <small>{t`${price()}/month`}</small>
              </>
            }
          >
            <span>
              <Trans>Give your free Wing</Trans>
            </span>
          </Show>
        </GiveButton>
        <Note>
          <Show
            when={unplaced().length}
            fallback={
              <Trans>
                {price()} a month, renews automatically until you cancel. Cancel
                any time in Settings, Subscriptions.
              </Trans>
            }
          >
            <Trans>
              It comes with your Feather subscription. You can move it to
              another server any time.
            </Trans>
          </Show>
        </Note>

        <Show when={mineHere().length}>
          <Mine>
            <FeatherIcon size={16} />
            <span>
              <Trans>You gave this server ×{mineHere().length}</Trans>
            </span>
            <TextButton
              type="button"
              disabled={pending()}
              onClick={() => void takeBack()}
            >
              <Trans>Take one back</Trans>
            </TextButton>
          </Mine>
        </Show>

        <Show when={!plusActive()}>
          <Upsell
            type="button"
            onClick={() => {
              props.onClose();
              openModal({
                type: "settings",
                config: "user",
                context: { page: "plus" },
              });
            }}
          >
            <Icon name="sparkle" size={16} />
            <span>
              <Trans>Feather comes with a free Wing</Trans>
            </span>
            <Icon name="caret-right" size={14} />
          </Upsell>
        </Show>

        <Levels>
          <For each={levels()}>
            {(entry) => {
              const unlocked = () => level() >= entry.level;
              return (
                <LevelCard data-unlocked={unlocked()}>
                  <LevelHead>
                    <LevelFan aria-hidden="true" data-count={entry.level}>
                      <For each={Array.from({ length: entry.level })}>
                        {() => <FeatherIcon size={28} tone="plain" />}
                      </For>
                    </LevelFan>
                    <LevelName>
                      <strong>
                        <Trans>Level {entry.level}</Trans>
                      </strong>
                      <Show
                        when={unlocked()}
                        fallback={
                          <>
                            <span>
                              <Trans>
                                {Math.max(0, entry.supercharges - count())} more
                                to unlock
                              </Trans>
                            </span>
                            <MiniBar>
                              <i
                                style={{
                                  width: `${Math.min(100, (count() / entry.supercharges) * 100)}%`,
                                }}
                              />
                            </MiniBar>
                          </>
                        }
                      >
                        <em>
                          <Icon name="check" size={12} />
                          <Trans>Unlocked</Trans>
                        </em>
                      </Show>
                    </LevelName>
                    <WaveEdge
                      fill="var(--z-bg-input)"
                      height={12}
                      line={unlocked() ? 0.95 : 0.22}
                    />
                  </LevelHead>
                  <ul>
                    <li>
                      <Icon name="smiley" size={14} />
                      <Trans>{entry.server_emoji} emoji slots</Trans>
                    </li>
                    <li>
                      <Icon name="upload-simple" size={14} />
                      <Trans>
                        {formatMegabytes(entry.attachments, locale())} uploads
                        for everyone
                      </Trans>
                    </li>
                    <li>
                      <Icon name="microphone" size={14} />
                      <Trans>{entry.voice_bitrate / 1000} kbps voice</Trans>
                    </li>
                    <li>
                      <Icon name="monitor-arrow-up" size={14} />
                      <Trans>
                        {stream(entry.video_resolution, entry.video_framerate)}{" "}
                        streams
                      </Trans>
                    </li>
                    <Show when={entry.vanity_invite}>
                      <li>
                        <Icon name="link" size={14} />
                        <Trans>Custom invite link zrzur.cc/your-name</Trans>
                      </li>
                    </Show>
                  </ul>
                </LevelCard>
              );
            }}
          </For>
        </Levels>

        <Show when={info()?.superchargers.length}>
          <People>
            <PeopleTitle>
              <Trans>Gave Wings</Trans>
            </PeopleTitle>
            <PeopleList>
              <For each={info()!.superchargers}>
                {(entry) => {
                  const user = () => client().users.get(entry.user_id);
                  return (
                    <Person>
                      <Avatar
                        src={user()?.animatedAvatarURL}
                        fallback={user()?.displayName ?? "…"}
                        size={24}
                      />
                      <span>{user()?.displayName ?? "…"}</span>
                      <Show when={entry.count > 1}>
                        <small>×{entry.count}</small>
                      </Show>
                    </Person>
                  );
                }}
              </For>
            </PeopleList>
          </People>
        </Show>
      </Content>
    </Dialog>
  );
}

const WINGS = "var(--z-wings)";
const GIVE_GRADIENT = "var(--z-wings-gradient)";

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
    padding: "24px 24px 48px",
    color: "#fff",
    background: "var(--z-wings-hero)",
  },
});

/** soft light from above */
const Glow = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: -1,
    background:
      "radial-gradient(60% 55% at 50% 0%, rgb(255 255 255 / 45%), transparent 70%), radial-gradient(40% 40% at 100% 100%, rgb(255 255 255 / 35%), transparent 70%), radial-gradient(35% 45% at 0% 90%, color-mix(in srgb, var(--z-wings-deep) 30%, transparent), transparent 70%)",
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

const IconFrame = styled("div", {
  base: {
    position: "relative",
    padding: "4px",
    borderRadius: "24px",
    background: "rgb(255 255 255 / 14%)",
    boxShadow: "0 10px 30px rgb(0 0 0 / 45%), 0 0 0 1px rgb(255 255 255 / 25%)",
    marginBottom: "6px",
    "&:not([data-level='0'])": {
      background: "var(--z-wings-gradient)",
      boxShadow:
        "0 10px 34px color-mix(in srgb, var(--z-wings) 45%, transparent), 0 0 0 1px rgb(255 255 255 / 30%)",
    },
  },
});

const LevelSeal = styled("span", {
  base: {
    position: "absolute",
    bottom: "-8px",
    insetInlineEnd: "-10px",
    display: "inline-flex",
    alignItems: "center",
    gap: "2px",
    padding: "2px 8px 2px 6px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 800,
    color: "var(--z-wings-deep)",
    background: "#fff",
    boxShadow: "0 4px 12px rgb(0 0 0 / 35%)",
    "--z-feather-cut": "rgb(255 255 255 / 70%)",
  },
});

const HeroTitle = styled("h2", {
  base: {
    margin: "6px 0 0",
    fontSize: "22px",
    fontWeight: 800,
    lineHeight: "28px",
    textShadow: "0 2px 12px rgb(0 0 0 / 40%)",
  },
});

const HeroSub = styled("p", {
  base: {
    margin: 0,
    maxWidth: "46ch",
    fontSize: "14px",
    color: "rgb(255 255 255 / 82%)",
  },
});

/** the road to level 3: a dark groove outlined in white */
const Track = styled("div", {
  base: {
    position: "relative",
    alignSelf: "stretch",
    height: "8px",
    margin: "24px 40px 42px",
    borderRadius: "999px",
    background: "rgb(0 0 0 / 40%)",
    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 35%)",
  },
});

const TrackFill = styled("div", {
  base: {
    position: "absolute",
    insetBlock: 0,
    insetInlineStart: 0,
    borderRadius: "999px",
    background: "var(--z-wings-gradient)",
    boxShadow: "0 0 10px rgb(255 255 255 / 70%)",
    transition: "width .5s ease",
    "&:dir(rtl)": {
      background: "var(--z-wings-gradient)",
    },
  },
});

/** a level stop: a coin sitting on the line, its feather in the middle */
const Marker = styled("div", {
  base: {
    position: "absolute",
    zIndex: 1,
    top: "50%",
    width: "38px",
    height: "38px",
    marginInlineStart: "-19px",
    translate: "0 -50%",
    borderRadius: "50%",
    color: "rgb(255 255 255 / 55%)",
    background: "var(--z-wings-deep)",
    border: "2px solid rgb(255 255 255 / 45%)",
    "--z-feather-cut": "rgb(0 0 0 / 80%)",
    "& > i": {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      // the vane is heavier at the top right, so the eye's centre is lower left
      translate: "-1px 1px",
    },
    "&[data-reached=true]": {
      color: "var(--z-wings-deep)",
      background: "var(--z-wings-gradient)",
      borderColor: "#fff",
      boxShadow:
        "0 0 0 4px rgb(255 255 255 / 14%), 0 6px 16px color-mix(in srgb, var(--z-wings) 55%, transparent)",
      "--z-feather-cut":
        "color-mix(in srgb, var(--z-wings-deep) 60%, transparent)",
    },
    "& > span": {
      position: "absolute",
      top: "44px",
      left: "50%",
      translate: "-50% 0",
      whiteSpace: "nowrap",
      fontSize: "12px",
      fontWeight: 700,
      color: "rgb(255 255 255 / 65%)",
    },
    "&[data-reached=true] > span": { color: "#fff" },
  },
});

const Tally = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "baseline",
    gap: "8px",
    fontSize: "14px",
    "& strong": { fontSize: "16px", fontWeight: 800 },
    "& span": { color: "rgb(255 255 255 / 75%)" },
    "& em": {
      fontStyle: "normal",
      fontWeight: 700,
      color: "var(--z-wings-light)",
    },
  },
});

const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px 20px 20px",
    background: "var(--z-bg-raised)",
  },
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
    "& svg": { color: "var(--z-danger, #F27488)", flexShrink: 0 },
  },
});

const GiveButton = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    height: "50px",
    border: "none",
    borderRadius: "14px",
    background: GIVE_GRADIENT,
    // dark ink on the lavender (5.4:1 or more across the gradient)
    color: "var(--z-wings-deep)",
    fontSize: "16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow:
      "0 8px 24px color-mix(in srgb, var(--z-wings) 35%, transparent), inset 0 1px 0 rgb(255 255 255 / 35%)",
    transition: "filter .15s, transform .15s",
    "--z-feather-cut":
      "color-mix(in srgb, var(--z-wings-deep) 55%, transparent)",
    "& small": { fontSize: "13px", fontWeight: 700, opacity: 0.95 },
    "&:hover:not(:disabled)": { filter: "brightness(1.07)" },
    "&:active:not(:disabled)": { transform: "translateY(1px)" },
    "&:disabled": { opacity: 0.6, cursor: "default" },
  },
});

const Divider = styled("i", {
  base: {
    width: "1px",
    height: "20px",
    background: "rgb(255 255 255 / 45%)",
  },
});

const Note = styled("p", {
  base: {
    margin: 0,
    textAlign: "center",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
  },
});

const Mine = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 14px",
    borderRadius: "12px",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    background: "color-mix(in srgb, var(--z-wings) 10%, transparent)",
    border: "1px solid color-mix(in srgb, var(--z-wings) 25%, transparent)",
    // the feather icon here stands for a Wing, so it wears the Wings colours
    "--z-premium": "var(--z-wings)",
    "--z-premium-light": "var(--z-wings-light)",
    "--z-premium-deep": "var(--z-wings-deep)",
    "& > span": { flex: 1 },
  },
});

const TextButton = styled("button", {
  base: {
    border: "none",
    background: "none",
    padding: 0,
    color: WINGS,
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    "&:disabled": { opacity: 0.6 },
  },
});

const Upsell = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 14px",
    border: "1px dashed color-mix(in srgb, var(--z-wings) 40%, transparent)",
    borderRadius: "12px",
    background: "transparent",
    color: "var(--z-fg-secondary)",
    fontSize: "13px",
    cursor: "pointer",
    "& svg": { color: WINGS },
    "&:hover": {
      background: "color-mix(in srgb, var(--z-wings) 6%, transparent)",
      color: "var(--z-fg-primary)",
    },
    "&:dir(rtl) svg:last-child": { scale: "-1 1" },
  },
});

const Levels = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "10px",
    marginTop: "4px",
  },
});

/** two tones: a coloured head, a plain body, a white hairline between */
const LevelCard = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "14px",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",
    "& ul": {
      margin: 0,
      padding: "12px 14px 14px",
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "7px",
      fontSize: "12px",
      color: "var(--z-fg-secondary)",
    },
    "& li": { display: "flex", alignItems: "center", gap: "7px" },
    "& li svg": { flexShrink: 0, color: "var(--z-fg-muted)" },
    "&[data-unlocked=true]": {
      borderColor: "color-mix(in srgb, var(--z-wings) 55%, transparent)",
      "& li": { color: "var(--z-fg-primary)" },
      "& li svg": { color: WINGS },
    },
  },
});

/** the coloured top of a level card; ends in the same white wave as the hero */
const LevelHead = styled("div", {
  base: {
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    minHeight: "88px",
    padding: "14px 14px 24px",
    paddingInlineEnd: "64px",
    background:
      "radial-gradient(90% 120% at 100% 0%, rgb(255 255 255 / 6%), transparent 60%), var(--z-wings-hero)",
    color: "rgb(255 255 255 / 16%)",
    "--z-feather-cut": "var(--z-wings-deep)",
    "[data-unlocked=true] > &": {
      background:
        "radial-gradient(90% 120% at 0% 0%, rgb(255 255 255 / 45%), transparent 60%), var(--z-wings-gradient)",
      color: "var(--z-wings-deep)",
      "--z-feather-cut":
        "color-mix(in srgb, var(--z-wings-deep) 75%, transparent)",
      "& strong, & em": { color: "var(--z-wings-deep)" },
      "& span": { color: "var(--z-wings-deep)" },
    },
    "& strong": {
      fontSize: "16px",
      fontWeight: 800,
      color: "var(--z-fg-primary)",
    },
    "& span": {
      fontSize: "12px",
      color: "var(--z-fg-secondary)",
      whiteSpace: "nowrap",
    },
    "& em": {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      fontStyle: "normal",
      fontSize: "12px",
      fontWeight: 700,
    },
  },
});

/** a level wears as many feathers as its number, fanned at the end */
const LevelFan = styled("div", {
  base: {
    position: "absolute",
    zIndex: -1,
    right: "12px",
    top: "50%",
    translate: "0 -62%",
    display: "flex",
    // drawn left to right in every language; only its side follows the page
    direction: "ltr",
    "&:dir(rtl)": { right: "auto", left: "12px" },
    filter: "drop-shadow(0 3px 6px rgb(0 0 0 / 30%))",
    "& svg": { transformOrigin: "15% 85%" },
    "& svg + svg": { marginInlineStart: "-20px" },
    "&[data-count='2'] svg:nth-child(1)": { rotate: "-16deg" },
    "&[data-count='2'] svg:nth-child(2)": { rotate: "10deg" },
    "&[data-count='3'] svg:nth-child(1)": { rotate: "-26deg" },
    "&[data-count='3'] svg:nth-child(3)": { rotate: "22deg" },
  },
});

const LevelName = styled("div", {
  base: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: 0,
  },
});

/** how far a locked level is: a thin white line filling up */
const MiniBar = styled("div", {
  base: {
    height: "4px",
    marginTop: "3px",
    borderRadius: "999px",
    background: "rgb(255 255 255 / 10%)",
    overflow: "hidden",
    "& i": {
      display: "block",
      height: "100%",
      borderRadius: "999px",
      background: "var(--z-wings-gradient)",
    },
  },
});

const People = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "4px",
  },
});

const PeopleTitle = styled("div", {
  base: { fontSize: "12px", fontWeight: 700, color: "var(--z-fg-muted)" },
});

const PeopleList = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "6px" },
});

const Person = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 10px 3px 3px",
    borderRadius: "999px",
    background: "var(--z-bg-input)",
    fontSize: "13px",
    color: "var(--z-fg-primary)",
    "& small": { color: WINGS, fontWeight: 700 },
  },
});
