import { Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import { useState } from "@revolt/state";
import { Checkbox, Column, Dialog, DialogProps, Text } from "@revolt/ui";

import { Modals } from "../types";

import { isOpenableUrl } from "./openableUrl";

/**
 * Modal to warn the user about a potentially unsafe link
 */
export function LinkWarningModal(
  props: DialogProps & Modals & { type: "link_warning" },
) {
  const state = useState();
  const [value, setValue] = createSignal(false);

  const scrutiny = createMemo(() => {
    const destUrlString = props.url.toString();
    if (destUrlString !== props.display) {
      try {
        const displayUrl = new URL(props.display);
        if (destUrlString !== displayUrl.toString()) {
          return 2;
        } else {
          return 1;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) {
        // URL parsing failed; the link is likely not intentionally misleading.
        return 1;
      }
    }

    return 0;
  });

  // extra risk signs: no encryption, or a look-alike (punycode) domain
  const insecure = () => props.url.protocol === "http:";
  const lookalike = () =>
    props.url.hostname.split(".").some((part) => part.startsWith("xn--"));
  const risky = () => insecure() || lookalike();

  return (
    <Dialog
      tone="warning"
      show={props.show}
      onClose={props.onClose}
      title={<Trans>External links can be dangerous!</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Continue</Trans>,
          onClick: () => {
            if (!isOpenableUrl(props.url)) return;
            window.open(props.url, "_blank", "noopener,noreferrer");

            // never remember risky sites
            if (value() && scrutiny() === 0 && !risky()) {
              state.linkSafety.trust(props.url);
            }
          },
          isDisabled:
            !isOpenableUrl(props.url) ||
            ((scrutiny() === 2 || risky()) && !value()),
        },
      ]}
    >
      <Column>
        <Destination>
          <strong>{props.url.hostname}</strong>
          <Link>{props.url.toString()}</Link>
        </Destination>
        <Show when={insecure()}>
          <Scrutinise>
            <Trans>
              This site doesn't use a secure connection (no HTTPS). Others on
              your network could see or change what you send.
            </Trans>
          </Scrutinise>
        </Show>
        <Show when={lookalike()}>
          <Scrutinise>
            <Trans>
              This address uses special characters that can imitate another
              site's name. Check it carefully before you continue.
            </Trans>
          </Scrutinise>
        </Show>
        <Show when={risky() && scrutiny() !== 2}>
          <Checkbox checked={value()} onChange={() => setValue((v) => !v)}>
            <Trans>I understand the consequences</Trans>
          </Checkbox>
        </Show>
        <Switch
          fallback={
            <Show when={!risky()}>
              <Checkbox checked={value()} onChange={() => setValue((v) => !v)}>
                <span>
                  <Trans>Don't ask me again for </Trans>
                  <Link>{props.url.origin}</Link>
                </span>
              </Checkbox>
            </Show>
          }
        >
          <Match when={scrutiny() === 1}>
            <Trans>You clicked on "{props.display}"</Trans>
          </Match>
          <Match when={scrutiny() === 2}>
            <Scrutinise>
              <Text>
                <Trans>
                  <strong>Be careful!</strong>
                  <br />
                  This is not the same as the link that was displayed:
                </Trans>
              </Text>
              <Link>{props.display}</Link>
              <Checkbox checked={value()} onChange={() => setValue((v) => !v)}>
                <Trans>I understand the consequences</Trans>
              </Checkbox>
            </Scrutinise>
          </Match>
        </Switch>
      </Column>
    </Dialog>
  );
}

const Link = styled("span", {
  base: {
    textDecoration: "underline",
    overflowWrap: "anywhere",
  },
});

const Scrutinise = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    color: "var(--z-danger, var(--md-sys-color-error))",
    fontSize: "14px",
    lineHeight: "20px",
  },
});

/** The site's name stands out; the full address sits under it */
const Destination = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "12px 14px",
    borderRadius: "var(--z-radius, 10px)",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-input)",
    unicodeBidi: "plaintext",

    "& strong": {
      fontSize: "15px",
      color: "var(--z-fg-primary)",
      overflowWrap: "anywhere",
    },
    "& span": {
      fontSize: "13px",
      color: "var(--z-fg-muted)",
      textDecoration: "none",
    },
  },
});
