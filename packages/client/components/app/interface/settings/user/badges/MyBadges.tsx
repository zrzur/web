import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useClient } from "@revolt/client";
import { STAFF_TOOLS_ENABLED } from "@revolt/common/lib/staffTools";
import { useError } from "@revolt/i18n";
import { Button, SettingsRow, SettingsSection, Toggle } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import {
  BADGES,
  BADGE_BITS,
  BadgeMeta,
  badgeMeta,
} from "@revolt/ui/components/features/profiles/badges/catalog";
import { useBadgeText } from "@revolt/ui/components/features/profiles/badges/useBadgeText";
import { Icon } from "@revolt/ui/icons/Icon";

import { useDate } from "../profile/CommunityParts";

import { BadgeAdmin } from "./BadgeAdmin";
import { BetaAdmin } from "./BetaAdmin";
import { BugQueue } from "./BugQueue";
import { BugReportDialog } from "./BugReportDialog";
import { OwnBadge, badgesApi, betaApi, can } from "./badgesApi";
import {
  Empty,
  ErrorText,
  Grid,
  Meta,
  Meter,
  Page,
  Pill,
  RowActions,
  Section,
  Shelf,
  ShelfItem,
  Showcase,
  ShowcaseEmpty,
  ShowcaseHead,
  Tile,
  TileText,
  TitleLine,
} from "./parts";

/** A badge shown on the page: from a grant, or from live state (Plus) */
type Shown = { meta: BadgeMeta; grant?: OwnBadge };

/**
 * My Badges: what you hold and since when, how to earn the others, your
 * Creator and Beta standing, and staff tools for people allowed to use
 * them. Every number here comes from the server.
 */
export function MyBadges() {
  const { t } = useLingui();
  const client = useClient();
  const describeError = useError();
  const date = useDate();
  const text = useBadgeText();

  const [data, { refetch }] = createResource(() => badgesApi.mine(client()));
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);
  const [dialog, setDialog] = createSignal<
    "admin" | "beta" | "bugs" | "report"
  >();

  const now = Date.now();
  const heldGrant = (grant: OwnBadge) =>
    !grant.revoked_at && (!grant.expires_at || grant.expires_at > now);

  const held = (): Shown[] => {
    const mine = data();
    if (!mine) return [];
    const shown: Shown[] = mine.badges
      .filter(heldGrant)
      .map((grant) => ({ meta: badgeMeta(grant.badge)!, grant }))
      .filter((entry) => entry.meta);
    if (mine.plus) shown.push({ meta: badgeMeta("plus")! });
    const bits = client()?.user?.badges ?? 0;
    if (bits & BADGE_BITS.early_adopter)
      shown.push({ meta: badgeMeta("early_adopter")! });
    return shown.sort((a, b) => a.meta.priority - b.meta.priority);
  };

  const history = () =>
    (data()?.badges ?? []).filter((grant) => !heldGrant(grant));

  const earnable = () =>
    BADGES.filter(
      (badge) =>
        !badge.retired &&
        badge.id !== "founder" &&
        !held().some((entry) => entry.meta.id === badge.id),
    );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await refetch();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  }

  const standing = () =>
    ({
      Active: t`Active creator`,
      Suspended: t`Suspended`,
      Revoked: t`Revoked`,
    })[data()?.creator.standing ?? "Revoked"];

  const betaStatus = () =>
    ({
      Requested: t`Waiting for approval`,
      Invited: t`Invited`,
      Active: t`Active tester`,
      Removed: t`Not in the program`,
      Completed: t`Completed`,
    })[data()?.beta?.status ?? "Removed"];

  const revokeReason = (grant: OwnBadge) =>
    grant.revoke_reason === "expired" || (!grant.revoked_at && grant.expires_at)
      ? t`Expired`
      : grant.revoke_reason === "no longer eligible"
        ? t`No longer eligible`
        : t`Removed`;

  const tierLabel = (tier: number) =>
    tier === 2 ? t`Top tier` : tier === 1 ? t`Rare` : undefined;

  const collectable = () =>
    BADGES.filter((badge) => !badge.retired && badge.id !== "founder").length;

  return (
    <Page>
      <Switch>
        <Match when={data.loading && !data()}>
          <Empty>
            <Trans>Loading…</Trans>
          </Empty>
        </Match>
        <Match when={data.error}>
          <Empty role="alert">
            <span>{describeError(data.error)}</span>
            <Button size="sm" variant="tonal" onPress={() => void refetch()}>
              <Trans>Try again</Trans>
            </Button>
          </Empty>
        </Match>
        <Match when={data()}>
          <Show when={error()}>
            <ErrorText role="alert">{error()}</ErrorText>
          </Show>

          {/* the collection: every badge you hold, large, on one shelf */}
          <Showcase aria-labelledby="my-badges-showcase">
            <ShowcaseHead>
              <div>
                <h3 id="my-badges-showcase">
                  <Trans>Your collection</Trans>
                </h3>
                <p>
                  <Trans>
                    {held().length} of {collectable()} badges
                  </Trans>
                </p>
              </div>
              <Meter
                role="progressbar"
                aria-label={t`Badges collected`}
                aria-valuemin={0}
                aria-valuemax={collectable()}
                aria-valuenow={held().length}
              >
                <span
                  style={{
                    width: `${Math.min(100, (held().length / Math.max(1, collectable())) * 100)}%`,
                  }}
                />
              </Meter>
            </ShowcaseHead>
            <Show
              when={held().length}
              fallback={
                <ShowcaseEmpty>
                  <Trans>
                    No badges yet. Each one below says how to earn it.
                  </Trans>
                </ShowcaseEmpty>
              }
            >
              <Shelf role="list">
                <For each={held()}>
                  {(entry) => (
                    <ShelfItem
                      role="listitem"
                      title={text(entry.meta.id).name}
                    >
                      <BadgeMark
                        id={entry.meta.id}
                        size="xl"
                        state={entry.grant?.hidden ? "quiet" : undefined}
                      />
                      <span>{text(entry.meta.id).name}</span>
                    </ShelfItem>
                  )}
                </For>
              </Shelf>
            </Show>
          </Showcase>

          <Show when={held().length}>
            <SettingsSection
              title={<Trans>Your badges</Trans>}
              description={
                <Trans>Turn a badge off to hide it from your profile.</Trans>
              }
            >
              <For each={held()}>
                {(entry) => (
                  <SettingsRow
                    icon={<BadgeMark id={entry.meta.id} size="md" />}
                    title={
                      <TitleLine>
                        {text(entry.meta.id).name}
                        <Show when={tierLabel(entry.meta.tier)}>
                          <Pill data-tier={entry.meta.tier}>
                            {tierLabel(entry.meta.tier)}
                          </Pill>
                        </Show>
                        <Show when={entry.meta.retired}>
                          <Pill>
                            <Trans>Historical</Trans>
                          </Pill>
                        </Show>
                      </TitleLine>
                    }
                    description={
                      <>
                        {text(entry.meta.id).description}
                        <Show when={entry.grant}>
                          <Meta>
                            <Trans>
                              Earned {date(entry.grant!.granted_at)}
                            </Trans>
                            <Show when={entry.grant!.expires_at}>
                              {" · "}
                              <Trans>
                                Until {date(entry.grant!.expires_at!)}
                              </Trans>
                            </Show>
                          </Meta>
                        </Show>
                        <Show when={!entry.grant}>
                          <Meta>
                            <Trans>Given automatically</Trans>
                          </Meta>
                        </Show>
                      </>
                    }
                    control={
                      entry.grant
                        ? (ids) => (
                            <Toggle
                              checked={!entry.grant!.hidden}
                              disabled={busy()}
                              onChange={() =>
                                void run(() =>
                                  badgesApi.setHidden(
                                    client(),
                                    entry.meta.id,
                                    !entry.grant!.hidden,
                                  ),
                                )
                              }
                              aria-labelledby={ids.labelId}
                              aria-describedby={ids.descriptionId}
                            />
                          )
                        : undefined
                    }
                  />
                )}
              </For>
            </SettingsSection>
          </Show>

          <SettingsSection title={<Trans>Programs</Trans>}>
            <SettingsRow
              icon={<BadgeMark id="creator" size="md" />}
              title={
                <TitleLine>
                  <Trans>Creator program</Trans>
                  <Show when={data()!.creator.standing}>
                    <Pill
                      data-tone={
                        data()!.creator.standing === "Active"
                          ? "accent"
                          : "warn"
                      }
                    >
                      {standing()}
                    </Pill>
                  </Show>
                </TitleLine>
              }
              description={
                <Show
                  when={data()!.creator.standing}
                  fallback={
                    <Trans>
                      Creators make profile designs and decorations. The Zrzur
                      team invites creators; making bots is separate and never
                      needs this.
                    </Trans>
                  }
                >
                  <Trans>Published designs: {data()!.creator.published}</Trans>
                  {" · "}
                  <Show
                    when={data()!.creator.eligible}
                    fallback={
                      <Trans>Publish a design to get the Creator badge.</Trans>
                    }
                  >
                    <Trans>
                      Super Creator is chosen by the team after at least{" "}
                      {data()!.creator.super_creator_designs} published designs.
                    </Trans>
                  </Show>
                </Show>
              }
            />

            <SettingsRow
              icon={<BadgeMark id="beta_tester" size="md" />}
              title={
                <TitleLine>
                  <Trans>Beta program</Trans>
                  <Show when={data()!.beta}>
                    <Pill
                      data-tone={
                        data()!.beta!.status === "Active" ? "accent" : undefined
                      }
                    >
                      {betaStatus()}
                    </Pill>
                  </Show>
                </TitleLine>
              }
              description={
                <Switch
                  fallback={
                    <Trans>
                      The beta is closed: ask to join and the team may invite
                      you.
                    </Trans>
                  }
                >
                  <Match when={data()!.beta?.status === "Active"}>
                    <Show
                      when={data()!.beta!.features.length}
                      fallback={
                        <Trans>
                          No beta features are open to you right now.
                        </Trans>
                      }
                    >
                      <Trans>
                        Beta features you can use:{" "}
                        {data()!.beta!.features.join(", ")}
                      </Trans>
                    </Show>
                  </Match>
                  <Match when={data()!.beta}>
                    <Trans>The team will let you know when you are in.</Trans>
                  </Match>
                </Switch>
              }
              control={() => (
                <RowActions>
                  <Show when={!data()!.beta}>
                    <Button
                      size="sm"
                      variant="tonal"
                      isDisabled={busy()}
                      onPress={() => void run(() => betaApi.request(client()))}
                    >
                      <Trans>Ask to join</Trans>
                    </Button>
                  </Show>
                  <Show when={data()!.beta?.status === "Invited"}>
                    <Button
                      size="sm"
                      isDisabled={busy()}
                      onPress={() => void run(() => betaApi.accept(client()))}
                    >
                      <Trans>Accept invitation</Trans>
                    </Button>
                  </Show>
                  <Show when={data()!.beta?.status === "Active"}>
                    <Button
                      size="sm"
                      variant="tonal"
                      onPress={() => setDialog("report")}
                    >
                      <Trans>Send feedback</Trans>
                    </Button>
                  </Show>
                  <Show
                    when={["Active", "Invited", "Requested"].includes(
                      data()!.beta?.status ?? "",
                    )}
                  >
                    <Button
                      size="sm"
                      variant="text"
                      isDisabled={busy()}
                      onPress={() => void run(() => betaApi.leave(client()))}
                    >
                      <Trans>Leave the beta</Trans>
                    </Button>
                  </Show>
                </RowActions>
              )}
            />

            <SettingsRow
              icon={<BadgeMark id="bug_hunter" size="md" />}
              title={
                <TitleLine>
                  <Trans>Bug reports</Trans>
                  <Pill>
                    <Trans>Verified: {data()!.bugs.verified}</Trans>
                  </Pill>
                </TitleLine>
              }
              description={
                <Trans>
                  Bug Hunter comes with your first verified report. Security
                  reports stay private and never appear on your profile.
                </Trans>
              }
              control={() => (
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={() => setDialog("report")}
                >
                  <Trans>Report a bug</Trans>
                </Button>
              )}
            />
          </SettingsSection>

          <Section aria-labelledby="my-badges-earn">
            <h3 id="my-badges-earn">
              <Trans>Badges you can earn</Trans>
            </h3>
            <Grid>
              <For each={earnable()}>
                {(badge) => (
                  <Tile>
                    <BadgeMark id={badge.id} size="lg" state="locked" />
                    <TileText>
                      <TitleLine>
                        <strong>{text(badge.id).name}</strong>
                        <Show when={tierLabel(badge.tier)}>
                          <Pill data-tier={badge.tier}>
                            {tierLabel(badge.tier)}
                          </Pill>
                        </Show>
                      </TitleLine>
                      <p>{text(badge.id).earn}</p>
                    </TileText>
                  </Tile>
                )}
              </For>
            </Grid>
          </Section>

          <Show when={history().length}>
            <SettingsSection title={<Trans>Past badges</Trans>}>
              <For each={history()}>
                {(grant) => (
                  <Show when={badgeMeta(grant.badge)}>
                    <SettingsRow
                      icon={
                        <BadgeMark
                          id={badgeMeta(grant.badge)!.id}
                          size="md"
                          state="quiet"
                        />
                      }
                      title={text(grant.badge).name}
                      description={
                        <Trans>
                          {date(grant.granted_at)} –{" "}
                          {date(
                            grant.revoked_at ?? grant.expires_at ?? undefined,
                          )}
                        </Trans>
                      }
                      control={() => <Pill>{revokeReason(grant)}</Pill>}
                    />
                  </Show>
                )}
              </For>
            </SettingsSection>
          </Show>

          <Show
            when={
              STAFF_TOOLS_ENABLED &&
              (can(data(), "badges.grant") ||
                can(data(), "beta.manage") ||
                can(data(), "bugs.review") ||
                can(data(), "bugs.security"))
            }
          >
            <SettingsSection title={<Trans>Staff tools</Trans>}>
              <Show when={can(data(), "badges.grant")}>
                <SettingsRow
                  icon={<Icon name="seal-check" size={20} />}
                  title={<Trans>Manage badges</Trans>}
                  description={<Trans>Grant, remove and look up badges.</Trans>}
                  onClick={() => setDialog("admin")}
                  navigational
                />
              </Show>
              <Show when={can(data(), "beta.manage")}>
                <SettingsRow
                  icon={<Icon name="flask" size={20} />}
                  title={<Trans>Manage the beta</Trans>}
                  description={
                    <Trans>Invite testers and turn beta features on.</Trans>
                  }
                  onClick={() => setDialog("beta")}
                  navigational
                />
              </Show>
              <Show
                when={
                  can(data(), "bugs.review") || can(data(), "bugs.security")
                }
              >
                <SettingsRow
                  icon={<Icon name="bug" size={20} />}
                  title={<Trans>Review bug reports</Trans>}
                  description={
                    <Trans>Verify reports and award Bug Hunter.</Trans>
                  }
                  onClick={() => setDialog("bugs")}
                  navigational
                />
              </Show>
            </SettingsSection>
          </Show>
        </Match>
      </Switch>

      {/* mounted only while open: a closed Dialog still covers the page */}
      <Show when={dialog() === "report"}>
        <BugReportDialog
          show
          onClose={() => {
            setDialog(undefined);
            void refetch();
          }}
          beta={data()?.beta?.status === "Active" ? data()!.beta!.features : []}
        />
      </Show>
      <Show when={data() && dialog() === "admin"}>
        <BadgeAdmin show onClose={() => setDialog(undefined)} />
      </Show>
      <Show when={data() && dialog() === "beta"}>
        <BetaAdmin show onClose={() => setDialog(undefined)} />
      </Show>
      <Show when={data() && dialog() === "bugs"}>
        <BugQueue
          show
          onClose={() => setDialog(undefined)}
          security={can(data(), "bugs.security")}
          review={can(data(), "bugs.review")}
        />
      </Show>
    </Page>
  );
}
