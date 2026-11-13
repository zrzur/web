import { For, JSX, Show, createUniqueId } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  billingOverview,
  billingPlans,
  formatMegabytes,
  formatPrice,
  plusActive,
} from "@revolt/client/billing";
import { useTime } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { Button } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { FeatherIcon } from "@revolt/ui/icons/FeatherIcon";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

import { useSettingsNavigation } from "../../Settings";

import { TestModeNotice, billingNoticeShown } from "./TestModeNotice";

/**
 * Zrzur Plus, the one member subscription: what it gives (every line
 * here is enforced by the server), the fixed upload limits, the three
 * server levels, and what stays free
 */
export function PlusPage() {
  const { t, i18n } = useLingui();
  const featherId = createUniqueId();
  const dayjs = useTime();
  const instance = useInstance();
  const { openModal } = useModals();
  const { navigate } = useSettingsNavigation();

  const plans = () => billingPlans()!;
  const locale = () => i18n().locale;
  const price = () =>
    formatPrice(plans().plus_price, plans().currency, locale());
  const mb = (bytes: number) => formatMegabytes(bytes, locale());
  const stream = (limits: {
    video_resolution: number[];
    video_framerate: number;
  }) => `${limits.video_resolution[1]}p ${limits.video_framerate} fps`;
  const subscription = () => billingOverview()?.plus;
  const perMessage = () => instance.limits().message_attachments;

  const perks = (): {
    icon: IconName | "feather";
    title: string;
    description: string;
  }[] => [
    {
      icon: "text-aa",
      title: t`${plans().plus.message_length} character messages`,
      description: t`Room for a long story, patch notes or a whole recipe in one message. Edits get the same room.`,
    },
    {
      icon: "upload-simple",
      title: t`${mb(plans().plus.attachments)} uploads`,
      description: t`Full clips, big GIFs, whole albums. Every file stays on our storage for good, so this is the perk that costs us the most.`,
    },
    {
      icon: "monitor-arrow-up",
      title: t`${stream(plans().plus)} screen share`,
      description: t`Crisp and smooth for everyone watching. A 1080p60 stream sends about four times the data of 720p30 through our voice servers.`,
    },
    ...(plans().hq_lounge
      ? [
          {
            icon: "chats-circle" as IconName,
            title: t`The Feather lounge in Zrzur HQ`,
            description: t`A Feather role in the official Zrzur server, with the channels HQ opens to Feather members.`,
          },
        ]
      : []),
    {
      icon: "feather",
      title: t`${plans().plus_free_supercharges} free Wing`,
      description: t`Put it on any server you love: more emoji slots, bigger uploads and better voice for everyone there. Server menu, then Give Wings.`,
    },
    {
      icon: "seal-check",
      title: t`Feather badge`,
      description: t`A small feather next to your name so people know you help keep the lights on. Hide it any time.`,
    },
    {
      icon: "shield-check",
      title: t`Priority review`,
      description: t`Servers and bots you send to Discover are reviewed ahead of the queue. Same rules, just faster.`,
    },
  ];

  const rows = (): {
    label: string;
    free: JSX.Element;
    plus: JSX.Element;
  }[] => [
    {
      label: t`Message length`,
      free: String(plans().free.message_length),
      plus: String(plans().plus.message_length),
    },
    {
      label: t`Uploads`,
      free: mb(plans().free.attachments),
      plus: mb(plans().plus.attachments),
    },
    {
      label: t`Screen share`,
      free: stream(plans().free),
      plus: stream(plans().plus),
    },
    {
      label: t`Wings`,
      free: t`Paid`,
      plus: t`${plans().plus_free_supercharges} included`,
    },
    {
      label: t`Feather badge`,
      free: t`No badge`,
      plus: t`Yes, hide it any time`,
    },
    {
      label: t`Discover review`,
      free: t`Normal queue`,
      plus: t`First in line`,
    },
    {
      label: t`Price`,
      free: formatPrice(0, plans().currency, locale()),
      plus: t`${price()}/month`,
    },
  ];

  // upload sizes from smallest rule to biggest, drawn as bars
  const ladder = () => [
    {
      kind: "free",
      label: t`Everyone`,
      bytes: plans().free.attachments,
    },
    ...plans().levels.map((level) => ({
      kind: "level",
      label: t`Level ${level.level} server`,
      bytes: level.attachments,
    })),
    {
      kind: "plus",
      label: t`With Feather`,
      bytes: plans().plus.attachments,
    },
  ];
  const ladderTop = () => Math.max(...ladder().map((rung) => rung.bytes), 1);

  const stillFree = () => [
    t`${mb(plans().free.attachments)} uploads`,
    t`Voice and screen share`,
    t`Animated avatars and emoji`,
    t`Decorations and nameplates`,
    t`Your emoji in every server`,
    t`Themes`,
    t`Bots, as many as you like`,
    t`A place on Discover`,
  ];

  const status = () => {
    const sub = subscription();
    if (!sub) return "";
    const date = dayjs(sub.current_period_end).format("LL");
    if (sub.source.type === "Gift") return t`Gifted Feather, ends on ${date}`;
    if (sub.cancel_at_period_end) return t`Cancelled, ends on ${date}`;
    return t`Renews on ${date}`;
  };

  return (
    <Page>
      <Show when={billingNoticeShown()}>
        <TestModeNotice />
      </Show>

      <Hero>
        <HeroTop>
          <HeroArt aria-hidden="true">
            <svg viewBox="0 0 160 200" width="160" height="200" fill="none">
              <defs>
                <linearGradient
                  id={featherId}
                  x1="128"
                  y1="16"
                  x2="43"
                  y2="162"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stop-color="var(--z-premium-light)" />
                  <stop offset=".48" stop-color="var(--z-premium)" />
                  <stop offset="1" stop-color="var(--z-premium-deep)" />
                </linearGradient>
              </defs>
              <path
                d="M128 12C99 19 65 44 51 76C40 101 43 126 48 145C67 141 91 121 107 97C123 74 132 40 128 12Z"
                fill={"url(#" + featherId + ")"}
              />
              <path
                d="M125 17C98 29 70 52 57 80C48 100 47 119 49 135"
                stroke="var(--z-premium-light)"
                stroke-opacity=".65"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <path
                d="M28 180C50 140 77 91 120 28"
                stroke="var(--z-fg-primary)"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M53 136Q69 133 84 122M60 121Q80 115 96 101M69 105Q90 96 108 80M79 87Q99 75 117 58M90 69Q108 56 123 37M51 137Q44 121 48 105M59 121Q50 102 56 86M69 102Q62 85 70 65M81 82Q77 65 87 46M94 61Q93 46 107 29"
                stroke="var(--z-premium-deep)"
                stroke-opacity=".5"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          </HeroArt>
          <HeroBadge aria-hidden="true">
            <BadgeMark id="plus" size="lg" />
          </HeroBadge>
          <HeroTitle>
            <Trans>Zrzur Feather</Trans>
          </HeroTitle>
          <HeroTagline>
            <Trans>For the people who keep Zrzur flying.</Trans>
          </HeroTagline>
          <HeroLead>
            <Trans>
              Everything you need to talk is free, and stays free. Feather gives
              you bigger files, sharper streams and longer messages, and pays
              for the servers everyone else uses too.
            </Trans>
          </HeroLead>
        </HeroTop>
        <HeroBottom>
          <Show
            when={plusActive()}
            fallback={
              <>
                <Price>
                  <PriceValue>{price()}</PriceValue>
                  <span>
                    <Trans>/month</Trans>
                  </span>
                </Price>
                <PriceNote>
                  <Trans>Cancel any time</Trans>
                </PriceNote>
                <Actions>
                  <PinkButton
                    type="button"
                    onClick={() => openModal({ type: "plus_checkout" })}
                  >
                    <Trans>Get Feather for {price()}/month</Trans>
                  </PinkButton>
                  <Button
                    size="md"
                    variant="tonal"
                    onPress={() => openModal({ type: "gift_plus" })}
                  >
                    <Icon name="gift" size={16} />
                    <Trans>Gift Feather to a friend</Trans>
                  </Button>
                </Actions>
              </>
            }
          >
            <ActiveLine>
              <Icon name="check-circle" size={18} />
              <span>
                <Trans>You have Zrzur Feather</Trans>
              </span>
              <ActiveDate>{status()}</ActiveDate>
            </ActiveLine>
            <Actions>
              <PinkButton
                type="button"
                onClick={() => navigate("subscriptions")}
              >
                <Trans>Manage subscription</Trans>
              </PinkButton>
              <Button
                size="md"
                variant="tonal"
                onPress={() => openModal({ type: "gift_plus" })}
              >
                <Icon name="gift" size={16} />
                <Trans>Gift Feather to a friend</Trans>
              </Button>
            </Actions>
          </Show>
        </HeroBottom>
      </Hero>

      <Perks>
        <For each={perks()}>
          {(perk) => (
            <Perk>
              <PerkHead>
                <PerkMark aria-hidden="true">
                  <Show
                    when={perk.icon === "feather"}
                    fallback={<Icon name={perk.icon as IconName} size={22} />}
                  >
                    <FeatherIcon size={22} tone="plain" />
                  </Show>
                </PerkMark>
                <PerkTitle>{perk.title}</PerkTitle>
              </PerkHead>
              <PerkDescription>{perk.description}</PerkDescription>
            </Perk>
          )}
        </For>
      </Perks>

      <Compare>
        <thead>
          <tr>
            <th scope="col">
              <Trans>Perk</Trans>
            </th>
            <th scope="col">
              <Trans>Free</Trans>
            </th>
            <th scope="col" data-plus>
              <span>
                <BadgeMark id="plus" size="xs" />
                <Trans>Feather</Trans>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={rows()}>
            {(row) => (
              <tr>
                <th scope="row">{row.label}</th>
                <td>
                  <bdi>{row.free}</bdi>
                </td>
                <td data-plus>
                  <bdi>{row.plus}</bdi>
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </Compare>

      <Block>
        <BlockTitle>
          <Icon name="upload-simple" size={18} />
          <Trans>Upload limits</Trans>
        </BlockTitle>
        <BlockText>
          <Trans>
            Photos, videos and other files share one size limit per file. Up to{" "}
            {perMessage()} files per message. When you send in a server, the
            bigger of your limit and the server's level counts.
          </Trans>
        </BlockText>
        <Ladder>
          <For each={ladder()}>
            {(rung) => (
              <Rung data-kind={rung.kind}>
                <span>{rung.label}</span>
                <Bar aria-hidden="true">
                  <i
                    style={{
                      width: `${Math.max(6, (rung.bytes / ladderTop()) * 100)}%`,
                    }}
                  />
                </Bar>
                <strong>
                  <bdi>{mb(rung.bytes)}</bdi>
                </strong>
              </Rung>
            )}
          </For>
        </Ladder>
        <Fine>
          <Trans>
            These are fixed rules, not a trial. We don't lower them for people
            who already have them.
          </Trans>
        </Fine>
      </Block>

      <Block>
        <BlockTitle>
          <FeatherIcon size={18} tone="plain" />
          <Trans>Wings for servers</Trans>
        </BlockTitle>
        <BlockText>
          <Trans>
            Servers level up when members give them Wings, for{" "}
            {formatPrice(plans().supercharge_price, plans().currency, locale())}{" "}
            a month each. Every level unlocks perks for everyone in the server,
            and you can see it from the server's menu, under Give Wings.
          </Trans>
        </BlockText>
        <LevelGrid>
          <For each={plans().levels}>
            {(level) => (
              <LevelCard>
                <LevelHead data-level={level.level}>
                  <LevelFan aria-hidden="true" data-count={level.level}>
                    <For each={Array.from({ length: level.level })}>
                      {() => <FeatherIcon size={26} tone="plain" />}
                    </For>
                  </LevelFan>
                  <strong>
                    <Trans>Level {level.level}</Trans>
                  </strong>
                  <small>
                    <Trans>{level.supercharges} Wings</Trans>
                  </small>
                </LevelHead>
                <ul>
                  <li>
                    <Icon name="smiley" size={14} />
                    <Trans>{level.server_emoji} emoji slots</Trans>
                  </li>
                  <li>
                    <Icon name="upload-simple" size={14} />
                    <Trans>{mb(level.attachments)} uploads for everyone</Trans>
                  </li>
                  <li>
                    <Icon name="microphone" size={14} />
                    <Trans>{level.voice_bitrate / 1000} kbps voice</Trans>
                  </li>
                  <li>
                    <Icon name="monitor-arrow-up" size={14} />
                    <Trans>
                      {`${level.video_resolution[1]}p${level.video_framerate}`}{" "}
                      streams
                    </Trans>
                  </li>
                </ul>
              </LevelCard>
            )}
          </For>
        </LevelGrid>
      </Block>

      <Why>
        <Note>
          <WhyTitle>
            <Trans>A note on money</Trans>
          </WhyTitle>
          <WhyText>
            <Trans>
              I built Zrzur and I pay for every part of it myself: the servers,
              the storage, the voice. No investors, no ads based on your data or
              messages, and your data isn't for sale.
            </Trans>
          </WhyText>
          <WhyText>
            <Trans>
              Every new person adds to those bills. Talking stays free for
              everyone, so the paid extras are what keep the lights on, for the
              people who pay and the people who don't.
            </Trans>
          </WhyText>
          <Signature>
            <FeatherIcon size={16} tone="plain" />
            <span>
              <Trans>Thanks for being here.</Trans>
            </span>
          </Signature>
        </Note>

        <Receipt aria-label={t`Where your money goes`}>
          <ReceiptHead>
            <Trans>Where your money goes</Trans>
          </ReceiptHead>
          <ReceiptRow>
            <div>
              <b>
                <Trans>Feather</Trans>
              </b>
              <i aria-hidden="true" />
              <bdi>
                <Trans>{price()} / month</Trans>
              </bdi>
            </div>
            <p>
              <Trans>
                Big files kept for good and sharp streams cost the most.
              </Trans>
            </p>
          </ReceiptRow>
          <ReceiptRow>
            <div>
              <b>
                <Trans>Wings</Trans>
              </b>
              <i aria-hidden="true" />
              <bdi>
                <Trans>
                  {formatPrice(
                    plans().supercharge_price,
                    plans().currency,
                    locale(),
                  )}{" "}
                  / month each
                </Trans>
              </bdi>
            </div>
            <p>
              <Trans>
                A server's members share the cost of better uploads and voice.
              </Trans>
            </p>
          </ReceiptRow>
          <ReceiptRow>
            <div>
              <b>
                <Trans>Discover promotion</Trans>
              </b>
              <i aria-hidden="true" />
              <bdi>
                <Trans>per 7 days</Trans>
              </bdi>
            </div>
            <p>
              <Trans>
                Paid once, never renews. Today's prices are launch prices.
              </Trans>
            </p>
          </ReceiptRow>
        </Receipt>

        <FreeTitle>
          <Trans>Still free for everyone</Trans>
        </FreeTitle>
        <FreeList>
          <For each={stillFree()}>
            {(item) => (
              <li>
                <Icon name="check" size={14} />
                {item}
              </li>
            )}
          </For>
        </FreeList>
      </Why>

      <Show when={!plusActive()}>
        <Footer>
          <PinkButton
            type="button"
            onClick={() => openModal({ type: "plus_checkout" })}
          >
            <Trans>Get Feather for {price()}/month</Trans>
          </PinkButton>
          <Fine>
            <Trans>
              {price()} a month, renews automatically until you cancel. Cancel
              any time in Settings, Subscriptions.
            </Trans>
          </Fine>
          <GiftNote>
            <Icon name="gift" size={16} />
            <span>
              <Trans>
                Gift Feather to a friend: one payment, straight onto their
                account, with a note from you. 1 month, 3 months or a year.
              </Trans>
            </span>
          </GiftNote>
        </Footer>
      </Show>
    </Page>
  );
}

const PLUS_GRADIENT = "var(--z-premium-gradient)";

/** Main Plus actions */
const PinkButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    height: "38px",
    padding: "0 18px",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: 600,
    color: "#fff",
    background: PLUS_GRADIENT,
    boxShadow:
      "0 6px 18px color-mix(in srgb, var(--z-premium) 28%, transparent)",
    cursor: "pointer",
    transition: "filter .15s, transform .15s",
    "&:hover": { filter: "brightness(1.08)" },
    "&:active": { transform: "translateY(1px)" },
    "&:focus-visible": {
      outline: "2px solid var(--z-premium-light)",
      outlineOffset: "2px",
    },
  },
});

const Page = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    paddingBottom: "32px",
    "--z-icon-color": "var(--z-fg-secondary)",
  },
});

/** One premium surface, with quieter supporting cards below. */
const Hero = styled("section", {
  base: {
    overflow: "hidden",
    borderRadius: "22px",
    background: "var(--z-bg-raised)",
    boxShadow: "0 12px 36px rgb(0 0 0 / 12%)",
    border:
      "1px solid color-mix(in srgb, var(--z-premium) 28%, var(--z-border-subtle))",
  },
});

const HeroTop = styled("div", {
  base: {
    position: "relative",
    isolation: "isolate",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
    padding: "32px",
    paddingInlineEnd: "180px",
    color: "var(--z-fg-primary)",
    background:
      "radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--z-premium) 26%, transparent), transparent 65%), var(--z-bg-raised)",
    "@media (max-width: 600px)": { padding: "24px", paddingInlineEnd: "24px" },
  },
});

const HeroArt = styled("div", {
  base: {
    position: "absolute",
    insetInlineEnd: "24px",
    top: "26px",
    width: "150px",
    height: "200px",
    pointerEvents: "none",
    transform: "rotate(14deg)",
    filter:
      "drop-shadow(0 12px 20px color-mix(in srgb, var(--z-premium) 15%, transparent))",
    "@media (max-width: 600px)": {
      width: "60px",
      height: "76px",
      top: "20px",
      insetInlineEnd: "20px",
      "& svg": { width: "60px", height: "76px" },
    },
  },
});

const HeroBottom = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "22px 32px 26px",
    borderTop: "1px solid var(--z-border-subtle)",
    background: "color-mix(in srgb, var(--z-bg-input) 35%, transparent)",
    "@media (max-width: 600px)": { padding: "20px 24px" },
  },
});

/** the Feather badge above the title */
const HeroBadge = styled("div", {
  base: {
    marginBottom: "4px",
  },
});

const HeroTitle = styled("h2", {
  base: {
    fontSize: "clamp(26px, 3vw, 34px)",
    lineHeight: "1.15",
    letterSpacing: "-0.035em",
    fontWeight: 800,
    color: "var(--z-fg-primary)",
    margin: 0,
  },
});

const HeroTagline = styled("p", {
  base: {
    margin: 0,
    fontSize: "16px",
    lineHeight: "1.5",
    fontWeight: 600,
    color: "var(--z-premium-text)",
  },
});

const HeroLead = styled("p", {
  base: {
    margin: "4px 0 0",
    maxWidth: "54ch",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
    lineHeight: "21px",
  },
});

const Price = styled("div", {
  base: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    color: "var(--z-fg-secondary)",
    fontSize: "14px",
  },
});

const PriceValue = styled("span", {
  base: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
    fontVariantNumeric: "tabular-nums",
  },
});

const PriceNote = styled("div", {
  base: { fontSize: "13px", color: "var(--z-fg-muted)" },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
  },
});

const ActiveLine = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-premium-text)",
    "& svg": { color: "var(--z-premium-text)" },
  },
});

const ActiveDate = styled("span", {
  base: { fontWeight: 400, color: "var(--z-fg-muted)", fontSize: "13px" },
});

const Block = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "26px",
    borderRadius: "18px",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-btn-surface-border)",
    boxShadow: "var(--z-card-lift)",
    "@media (max-width: 600px)": { padding: "20px" },
  },
});

const BlockTitle = styled("h3", {
  base: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-premium-text)",
    "& svg": { color: "var(--z-premium-text)" },
  },
});

const BlockText = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
  },
});

const Fine = styled("p", {
  base: { margin: 0, fontSize: "12px", color: "var(--z-fg-muted)" },
});

/** a plain block: a signed note, then a receipt, then what stays free */
const Why = styled("section", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    padding: "26px",
    borderRadius: "18px",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-btn-surface-border)",
    boxShadow: "var(--z-card-lift)",
    "@media (max-width: 600px)": { padding: "20px" },
  },
});

const Note = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "60ch",
  },
});

const WhyTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--z-fg-primary)",
  },
});

const WhyText = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "22px",
    color: "var(--z-fg-secondary)",
  },
});

const Signature = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "2px",
    fontSize: "14px",
    fontStyle: "italic",
    // Arabic has no true italic; the browser would only fake a slant
    "&:dir(rtl)": { fontStyle: "normal" },
    color: "var(--z-fg-primary)",
    "--z-icon-color": "var(--z-premium-text)",
    "--z-feather-cut": "var(--z-bg-raised)",
  },
});

/** prices like a till receipt: name, dotted leader, amount */
const Receipt = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    padding: "18px",
    borderRadius: "12px",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",
  },
});

const ReceiptHead = styled("div", {
  base: {
    marginBottom: "6px",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--z-fg-muted)",
  },
});

const ReceiptRow = styled("div", {
  base: {
    padding: "8px 0 10px",
    "& + &": { borderTop: "1px dashed var(--z-border-subtle)" },
    "& > div": {
      display: "flex",
      alignItems: "baseline",
      gap: "8px",
      fontSize: "14px",
      color: "var(--z-fg-primary)",
    },
    "& b": { fontWeight: 700 },
    "& i": {
      flex: 1,
      minWidth: "16px",
      borderBottom: "1px dotted var(--z-fg-muted)",
      transform: "translateY(-4px)",
    },
    "& bdi": { fontWeight: 700, whiteSpace: "nowrap" },
    "& p": {
      margin: "4px 0 0",
      fontSize: "13px",
      color: "var(--z-fg-muted)",
    },
  },
});

const FreeTitle = styled("div", {
  base: {
    marginTop: "14px",
    marginBottom: "8px",
    fontWeight: 600,
    fontSize: "13px",
    color: "var(--z-fg-primary)",
  },
});

const FreeList = styled("ul", {
  base: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexWrap: "wrap",
    columnGap: "24px",
    rowGap: "8px",
    "& li": {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "4px 0",
      fontSize: "12px",
      color: "var(--z-fg-secondary)",
    },
    "& .z-icon": { "--z-icon-color": "var(--z-status-success, #55DCC8)" },
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
  },
});

const GiftNote = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    "& .z-icon": {
      flexShrink: 0,
      marginTop: "2px",
      "--z-icon-color": "var(--z-premium-text)",
    },
  },
});

/** Open columns separate benefits with fine rules. */
const Perks = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Perk = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "24px",
    borderRadius: "16px",
    background: "var(--z-card-bg)",
    border: "1px solid var(--z-btn-surface-border)",
    boxShadow: "var(--z-card-lift)",
  },
});

const PerkHead = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    color: "var(--z-fg-primary)",
  },
});

/** Icons stand alone, with an explicit color that bypasses global tinting. */
const PerkMark = styled("div", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "28px",
    color: "var(--z-premium-text)",
    "--z-icon-color": "var(--z-premium-text)",
  },
});

const PerkTitle = styled("h3", {
  base: {
    margin: 0,
    fontWeight: 700,
    fontSize: "15px",
    lineHeight: "22px",
  },
});

const PerkDescription = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "21px",
    color: "var(--z-fg-secondary)",
  },
});

/** An open comparison table with a restrained premium accent. */
const Compare = styled("table", {
  base: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    tableLayout: "fixed",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    fontSize: "13px",
    "& th, & td": {
      padding: "12px clamp(8px, 2vw, 16px)",
      overflowWrap: "anywhere",
      textAlign: "start",
      borderBottom: "1px solid var(--z-border-subtle)",
    },
    "& tbody tr:last-child th, & tbody tr:last-child td": {
      borderBottom: "none",
    },
    "& tbody tr:hover th, & tbody tr:hover td:not([data-plus])": {
      background: "rgb(255 255 255 / 2%)",
    },
    "& thead th": {
      fontSize: "12px",
      fontWeight: 700,
      color: "var(--z-fg-muted)",
    },
    "& thead th[data-plus]": {
      color: "var(--z-premium-text)",
      fontSize: "13px",
      borderBottom: "2px solid var(--z-premium)",
    },
    "& thead th[data-plus] span": {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
    "& tbody th": { fontWeight: 600, color: "var(--z-fg-primary)" },
    "& td": { color: "var(--z-fg-secondary)" },
    "& td[data-plus]": {
      color: "var(--z-fg-primary)",
      fontWeight: 700,

      borderBottomColor:
        "color-mix(in srgb, var(--z-premium) 18%, transparent)",
    },
    "& thead th[data-plus], & td[data-plus]": { width: "34%" },
  },
});

/** upload sizes drawn as a ladder: the longer the bar, the bigger the file */
const Ladder = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "12px 0",
  },
});

const Rung = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.3fr) minmax(20px, 1fr) minmax(52px, auto)",
    alignItems: "center",
    gap: "12px",
    fontSize: "13px",
    color: "var(--z-fg-secondary)",
    "--rung": "var(--z-fg-muted)",
    "& strong": {
      textAlign: "end",
      fontSize: "15px",
      fontWeight: 800,
      color: "var(--z-fg-primary)",
    },
    "&[data-kind=plus]": {
      color: "var(--z-premium-light)",
      fontWeight: 700,
      "--rung": "var(--z-premium-gradient)",
    },
    "&[data-kind=level]": {
      "--rung": "var(--z-fg-secondary)",
    },
  },
});

const Bar = styled("div", {
  base: {
    height: "6px",
    borderRadius: "999px",
    background: "rgb(255 255 255 / 5%)",
    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 8%)",
    overflow: "hidden",
    "& i": {
      display: "block",
      height: "100%",
      borderRadius: "999px",
      background: "var(--rung)",

      transition: "width .6s ease",
    },
  },
});

const LevelGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
    "@media (max-width: 600px)": { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const LevelCard = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    padding: "18px 16px",
    borderRadius: "14px",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",
    "& ul": {
      margin: 0,
      padding: "16px 0 0",
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontSize: "12px",
      lineHeight: "1.6",
      color: "var(--z-fg-secondary)",
    },
    "& li": { display: "flex", alignItems: "center", gap: "8px" },
    "& .z-icon": { flexShrink: 0, "--z-icon-color": "var(--z-fg-secondary)" },
  },
});

/** Each level wears as many feathers as its number. */
const LevelHead = styled("div", {
  base: {
    position: "relative",
    isolation: "isolate",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: "64px",
    padding: "0 0 14px",
    paddingInlineEnd: "48px",
    color: "var(--z-fg-primary)",
    borderBottom: "1px solid var(--z-border-subtle)",
    "& strong": { fontSize: "16px", fontWeight: 700 },
    "& small": { fontSize: "12px", color: "var(--z-fg-secondary)" },
  },
});

const LevelFan = styled("div", {
  base: {
    position: "absolute",
    zIndex: -1,
    // at the end of the card in either direction, leaning away from the text
    insetInlineEnd: "12px",
    _rtl: { scale: "-1 1" },
    top: "50%",
    translate: "0 -62%",
    display: "flex",
    // drawn left to right in every language; only its side follows the page
    direction: "ltr",
    filter: "drop-shadow(0 3px 6px rgb(0 0 0 / 30%))",
    "&:dir(rtl)": { right: "auto", left: "12px" },
    "& svg": { transformOrigin: "15% 85%" },
    "& svg + svg": { marginInlineStart: "-18px" },
    "&[data-count='2'] svg:nth-child(1)": { rotate: "-16deg" },
    "&[data-count='2'] svg:nth-child(2)": { rotate: "10deg" },
    "&[data-count='3'] svg:nth-child(1)": { rotate: "-26deg" },
    "&[data-count='3'] svg:nth-child(3)": { rotate: "22deg" },
  },
});
