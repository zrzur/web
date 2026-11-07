import { For, Show, createSignal } from "solid-js";

import { Plural, Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { Avatar } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { PrimaryButton, useFileUrl } from "./Cards";
import { Decision, DiscoverQueueEntry } from "./api";
import { categoryIcon, useDiscoverLabels } from "./categories";

/**
 * Moderation queue for Discover requests (privileged users)
 */
export function ReviewQueue(props: {
  entries: DiscoverQueueEntry[];
  busy?: string;
  onDecide: (
    entry: DiscoverQueueEntry,
    decision: Decision,
    reason: string,
    featured?: boolean,
  ) => void;
}) {
  return (
    <List>
      <For each={props.entries}>
        {(entry) => (
          <Entry
            entry={entry}
            busy={props.busy === entry.request.id}
            onDecide={(decision, reason, featured) =>
              props.onDecide(entry, decision, reason, featured)
            }
          />
        )}
      </For>
    </List>
  );
}

function Entry(props: {
  entry: DiscoverQueueEntry;
  busy: boolean;
  onDecide: (decision: Decision, reason: string, featured?: boolean) => void;
}) {
  const { t } = useLingui();
  const fileUrl = useFileUrl();
  const labels = useDiscoverLabels();
  const [reason, setReason] = createSignal("");

  const kind = () =>
    props.entry.request.type === "Server" ? "servers" : "bots";

  return (
    <Row>
      <Top>
        <Avatar
          size={48}
          src={fileUrl(props.entry.icon)}
          fallback={props.entry.name}
          shape={kind() === "servers" ? "rounded-square" : "circle"}
        />
        <Info>
          <strong>
            {props.entry.name}
            <Pill>
              {kind() === "servers" ? (
                <Trans>Server</Trans>
              ) : (
                <Trans>Bot</Trans>
              )}
            </Pill>
            <Show when={props.entry.request.status === "UnderReview"}>
              <Pill data-tone="accent">
                <Trans>Under review</Trans>
              </Pill>
            </Show>
          </strong>
          <Facts>
            <span>
              <Icon name={kind() === "servers" ? "users" : "robot"} size={13} />
              <Show
                when={kind() === "servers"}
                fallback={
                  <Plural
                    value={props.entry.count}
                    _0="Not in any servers yet"
                    one="In # server"
                    other="In # servers"
                  />
                }
              >
                <Plural
                  value={props.entry.count}
                  one="# member"
                  other="# members"
                />
              </Show>
            </span>
            <Show when={props.entry.request.category}>
              <span>
                <Icon
                  name={categoryIcon(kind(), props.entry.request.category)}
                  size={13}
                />
                {labels.category(props.entry.request.category)}
              </span>
            </Show>
            <Show when={props.entry.request.language}>
              <span>
                <Icon name="globe" size={13} />
                {labels.language(props.entry.request.language)}
              </span>
            </Show>
            <Show when={props.entry.request.tags?.length}>
              <span>#{props.entry.request.tags!.join(" #")}</span>
            </Show>
          </Facts>
          <Show when={props.entry.description}>
            <p>{props.entry.description}</p>
          </Show>
          <Ids>
            <Trans>ID</Trans> {props.entry.request.id} · <Trans>Owner</Trans>{" "}
            {props.entry.owner}
          </Ids>
        </Info>
      </Top>

      <Controls>
        <Reason
          value={reason()}
          onInput={(e) => setReason(e.currentTarget.value)}
          placeholder={t`Reason shown to the owner (optional)`}
          maxLength={512}
        />
        <Buttons>
          <Show when={props.entry.request.status === "Pending"}>
            <PrimaryButton
              type="button"
              data-variant="secondary"
              disabled={props.busy}
              onClick={() => props.onDecide("Review", "")}
            >
              <Trans>Start review</Trans>
            </PrimaryButton>
          </Show>
          <PrimaryButton
            type="button"
            data-variant="danger"
            disabled={props.busy}
            onClick={() => props.onDecide("Deny", reason())}
          >
            <Trans>Deny</Trans>
          </PrimaryButton>
          <PrimaryButton
            type="button"
            data-variant="secondary"
            disabled={props.busy}
            onClick={() => props.onDecide("Approve", reason(), true)}
          >
            <Icon name="medal" size={14} />
            <Trans>Approve & feature</Trans>
          </PrimaryButton>
          <PrimaryButton
            type="button"
            disabled={props.busy}
            onClick={() => props.onDecide("Approve", reason())}
          >
            <Icon name="check" size={14} />
            <Trans>Approve</Trans>
          </PrimaryButton>
        </Buttons>
      </Controls>
    </Row>
  );
}

const List = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "12px" },
});

const Row = styled("article", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "16px",
    borderRadius: "16px",
    border: "1px solid var(--z-btn-surface-border)",
    background: "var(--z-card-bg)",
    boxShadow: "var(--z-card-lift)",
  },
});

const Top = styled("div", {
  base: { display: "flex", gap: "14px", minWidth: 0 },
});

const Info = styled("div", {
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "6px",

    "& strong": {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "8px",
      fontSize: "15px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-secondary)",
      lineClamp: 2,
      overflowWrap: "anywhere",
    },
  },
});

const Facts = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 14px",
    fontSize: "12px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "var(--z-icon-muted)",

    "& span": { display: "inline-flex", alignItems: "center", gap: "5px" },
  },
});

const Ids = styled("span", {
  base: {
    fontSize: "11px",
    color: "var(--z-fg-muted)",
    fontFamily: "monospace",
    overflowWrap: "anywhere",
  },
});

const Pill = styled("span", {
  base: {
    height: "20px",
    padding: "0 7px",
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--z-fg-secondary)",
    background: "var(--z-bg-input)",
    border: "1px solid var(--z-border-subtle)",

    "&[data-tone='accent']": {
      color: "var(--z-accent-text, var(--z-accent))",
      borderColor: "color-mix(in srgb, var(--z-accent) 40%, transparent)",
    },
  },
});

const Controls = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
  },
});

const Reason = styled("input", {
  base: {
    flex: "1 1 220px",
    minWidth: 0,
    height: "32px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid var(--z-field-border)",
    background: "var(--z-field-bg)",
    boxShadow: "var(--z-field-shadow)",
    color: "var(--z-fg-primary)",
    font: "inherit",
    fontSize: "13px",
    outline: "none",
    _focus: {
      borderColor: "var(--z-focus)",
      boxShadow: "var(--z-field-focus-shadow)",
    },
  },
});

const Buttons = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginInlineStart: "auto",
  },
});
