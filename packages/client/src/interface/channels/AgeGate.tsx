import { JSXElement, Match, Show, Suspense, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { useQuery } from "@tanstack/solid-query";
import { styled } from "styled-system/jsx";

import {
  canViewMature,
  matureAccess,
  setAgePromptDismissed,
} from "@revolt/client/age";
import { useState } from "@revolt/state";
import { Button, CircularProgress, Text, iconSize } from "@revolt/ui";

import { warning as MdWarning } from "@revolt/ui/icons/legacy";

type GeoBlock = {
  countryCode: string;
  isAgeRestrictedGeo: boolean;
};

/**
 * Age gate filter for any content
 */
export function AgeGate(props: {
  enabled: boolean;
  contentId: string;
  contentName: string;
  contentType: "channel";
  children: JSXElement;
}) {
  const state = useState();

  // the mature notice for this channel was accepted
  const allowed = () =>
    state.layout.getSectionState(props.contentId + "-nsfw", false);

  const geoQuery = useQuery(() => ({
    queryKey: ["geoblock"],
    queryFn: async (): Promise<GeoBlock> => {
      // no upstream geo.revolt.chat. Optional Zrzur geo endpoint via env.
      const geoUrl = import.meta.env.VITE_GEO_URL as string | undefined;
      if (!geoUrl) {
        return { isAgeRestrictedGeo: false } as GeoBlock;
      }
      const response = await fetch(geoUrl);
      if (!response.ok) {
        throw new Error(`Geo data request answered ${response.status}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    throwOnError: true,
  }));

  return (
    <Suspense fallback={<CircularProgress />}>
      <Switch fallback={props.children}>
        <Match
          when={
            props.enabled &&
            (geoQuery.isLoading ||
              geoQuery.error ||
              (geoQuery.data && geoQuery.data.isAgeRestrictedGeo))
          }
        >
          <Base>
            <MdWarning {...iconSize("8em")} />
            <Text class="headline" size="large">
              {props.contentName}
            </Text>

            <Text class="body" size="large">
              {geoQuery.data?.countryCode == "GB" ? (
                <Trans>
                  This channel is not available in your region while we review
                  options on legal compliance.
                </Trans>
              ) : (
                <Trans>This content is not available in your region.</Trans>
              )}
            </Text>

            <Button variant="text" onPress={() => history.back()}>
              <Trans>Back</Trans>
            </Button>
          </Base>
        </Match>
        <Match when={props.enabled && !canViewMature()}>
          <Base>
            <MdWarning {...iconSize("8em")} />
            <Text class="headline" size="large">
              {props.contentName}
            </Text>

            <Text class="body" size="large">
              <Switch>
                <Match when={matureAccess() === "age_unknown"}>
                  <Trans>
                    This channel is marked as mature. Add your month and year of
                    birth to open it.
                  </Trans>
                </Match>
                <Match when={matureAccess() === "verification_required"}>
                  <Trans>
                    Content marked as mature needs an age check that Zrzur
                    doesn't offer yet, so it is closed for everyone.
                  </Trans>
                </Match>
                <Match when={matureAccess() === "minor"}>
                  <Trans>
                    This channel is marked as mature and is only open to adults.
                  </Trans>
                </Match>
              </Switch>
            </Text>

            <Actions>
              <Button variant="text" onPress={() => history.back()}>
                <Trans>Back</Trans>
              </Button>
              <Show when={matureAccess() === "age_unknown"}>
                <Button
                  variant="filled"
                  onPress={() => setAgePromptDismissed(false)}
                >
                  <Trans>Add month and year of birth</Trans>
                </Button>
              </Show>
            </Actions>
          </Base>
        </Match>
        <Match when={props.enabled && !allowed()}>
          <Base>
            <MdWarning {...iconSize("8em")} />
            <Text class="headline" size="large">
              {props.contentName}
            </Text>

            <Text class="body" size="large">
              <Trans>
                This channel is marked as mature. It may show content that is
                not suitable for everyone.
              </Trans>
            </Text>
            <Text class="body" size="small">
              <Trans>
                It is open to you because you stated that you are 18 or over.
                Zrzur does not verify ages.
              </Trans>
            </Text>

            <Actions>
              <Button variant="text" onPress={() => history.back()}>
                <Trans>Back</Trans>
              </Button>
              <Button
                variant="filled"
                onPress={() =>
                  state.layout.setSectionState(props.contentId + "-nsfw", true)
                }
              >
                <Trans>Enter channel</Trans>
              </Button>
            </Actions>
          </Base>
        </Match>
      </Switch>
    </Suspense>
  );
}

const Base = styled("div", {
  base: {
    height: "100%",

    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "var(--gap-lg)",
    userSelect: "none",
    overflowY: "auto",
    color: "var(--md-sys-color-on-surface)",

    "& svg": {
      // warning colour from the theme
      fill: "var(--z-status-warning)",
    },

    gap: "var(--gap-md)",
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    marginTop: "var(--gap-lg)",
    gap: "var(--gap-lg)",
  },
});
