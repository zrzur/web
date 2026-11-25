import { Show, createResource, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";

import { useClient } from "@revolt/client";
import { Button } from "@revolt/ui";
import { BadgeMark } from "@revolt/ui/components/features/profiles/badges/BadgeMark";
import { useBadgeText } from "@revolt/ui/components/features/profiles/badges/useBadgeText";

import { ApplicationsSection } from "../user/badges/MyApplications";
import { ProgramChecklist } from "../user/badges/ProgramChecklist";
import { ProgramDialog } from "../user/badges/ProgramDialog";
import { Hint, RowActions } from "../user/badges/parts";
import { BadgeApplication, programsApi } from "../user/badges/programsApi";

/** Statuses after which the server can be put forward again */
const CLOSED = new Set(["Withdrawn", "Refused", "Ended"]);

/**
 * Server settings → Verified Server (owner only, while applications are
 * open): what the Verified Server mark takes (the one line every badge
 * text comes from), the checklist the server measured for this server,
 * applying with the domain check (a DNS TXT record or a file on the
 * website), and where the application stands: continue, withdraw, appeal.
 * Replaces applying from the cancelled Verified Server Owner badge in My
 * Badges (owner, 2026-11-24).
 */
export function VerifiedServerApplication(props: { server: Server }) {
  const client = useClient();
  const text = useBadgeText();

  const [eligibility, { refetch: measure }] = createResource(
    () => props.server.id,
    (id) => programsApi.eligibility(client(), "verified_server", id),
  );
  const [applications, { refetch }] = createResource(
    () => props.server.id,
    (id) =>
      programsApi
        .mine(client())
        .then((list) =>
          list.filter(
            (entry) =>
              entry.program === "verified_server" && entry.target_id === id,
          ),
        )
        .catch(() => [] as BadgeApplication[]),
  );
  const current = () =>
    applications()?.find((entry) => !CLOSED.has(entry.status));
  const [dialog, setDialog] = createSignal<{
    application?: BadgeApplication;
  }>();

  const changed = () => {
    refetch();
    measure();
  };

  return (
    <div
      data-verified-server-section
      style={{ display: "flex", "flex-direction": "column", gap: "16px" }}
    >
      <Hint>
        <BadgeMark id="server_verified" size="md" />
        <span data-verified-server-earn>{text("server_verified").earn}</span>
      </Hint>

      <Show when={eligibility()}>
        <section aria-labelledby="verified-server-checklist">
          <h3
            id="verified-server-checklist"
            style={{ margin: "0 0 8px", "font-size": "15px" }}
          >
            <Trans>What the server measured</Trans>
          </h3>
          <ProgramChecklist
            program="verified_server"
            eligibility={eligibility()!}
          />
        </section>
      </Show>

      <Show when={!applications.loading && !current()}>
        <RowActions>
          <Button
            size="sm"
            variant="tonal"
            data-apply="verified_server"
            onPress={() => setDialog({})}
          >
            <Trans>Check and apply</Trans>
          </Button>
        </RowActions>
      </Show>

      <Show when={applications()?.length}>
        <ApplicationsSection
          applications={applications()!}
          onContinue={(application) => setDialog({ application })}
          onChanged={changed}
        />
      </Show>

      <Show when={dialog()}>
        <ProgramDialog
          program="verified_server"
          target={props.server.id}
          application={dialog()!.application}
          onClose={() => {
            setDialog(undefined);
            changed();
          }}
        />
      </Show>
    </div>
  );
}
