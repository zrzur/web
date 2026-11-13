import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { ServerMember, User } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useTime } from "@revolt/i18n";

import { Avatar } from "../../design";

import { ProfileSection } from "./ProfileCard";

/**
 * Member since: on Zrzur, and on this server when opened from one. Each fact
 * stays whole; when the two do not fit one line the second starts a new one
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
      <Facts>
        <Fact>
          <img
            src={`${import.meta.env.BASE_URL}assets/web/zrzur-app-mark.svg`}
            alt=""
            width={14}
            height={14}
          />
          <span>
            <Trans>Zrzur since {since()}</Trans>
          </span>
        </Fact>
        <Show when={props.member?.server}>
          <Fact>
            <Avatar
              src={props.member!.server!.animatedIconURL}
              fallback={server()}
              size={14}
              shape="rounded-square"
            />
            <span>
              <Trans>
                in {server()} since {joined()}
              </Trans>
            </span>
          </Fact>
        </Show>
      </Facts>
    </ProfileSection>
  );
}

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 16px",
    minWidth: 0,
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--profile-ink-2, var(--z-fg-secondary))",
  },
});

const Fact = styled("p", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "6px",
    minWidth: 0,
    margin: 0,
    overflowWrap: "anywhere",

    // the mark sits on the first line of its fact
    "& > :first-child": {
      flexShrink: 0,
      marginBlockStart: "3px",
    },
    "& > img": { borderRadius: "4px" },
  },
});
