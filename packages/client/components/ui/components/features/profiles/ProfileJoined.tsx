import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { ServerMember, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useTime } from "@revolt/i18n";

import { Avatar } from "../../design";

import { ProfileSection } from "./ProfileCard";

/**
 * Member since, as one sentence that wraps: on Zrzur, and on this server when
 * opened from one
 */
export function ProfileJoined(props: { user: User; member?: ServerMember }) {
  const dayjs = useTime();
  const { t } = useLingui();

  const date = (value: Date) => dayjs(value).format("ll");
  const since = () => date(props.user.createdAt);
  const joined = () => date(props.member!.joinedAt);
  const server = () => props.member!.server!.name;

  return (
    <ProfileSection label={t`Member since`}>
      <Sentence>
        <img
          src={`${import.meta.env.BASE_URL}assets/web/zrzur-app-mark.svg`}
          alt=""
          width={14}
          height={14}
        />{" "}
        <Trans>Zrzur since {since()}</Trans>
        <Show when={props.member?.server}>
          <Sep aria-hidden="true">·</Sep>
          <Avatar
            src={props.member!.server!.animatedIconURL}
            fallback={server()}
            size={14}
            shape="rounded-square"
          />{" "}
          <Trans>
            in {server()} since {joined()}
          </Trans>
        </Show>
      </Sentence>
    </ProfileSection>
  );
}

const Sentence = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
    overflowWrap: "anywhere",

    "& img, & > :not(span):not(bdi)": {
      display: "inline-block",
      verticalAlign: "-2px",
    },
    "& img": { borderRadius: "4px" },
  },
});

const Sep = styled("span", {
  base: {
    marginInline: "8px",
    color: "var(--profile-ink-2, var(--z-fg-muted))",
  },
});
