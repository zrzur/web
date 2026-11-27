import { JSX, Show, splitProps } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { cva } from "styled-system/css";

import { MessageContextMenu, useMessage } from "@revolt/app";
import { useClient } from "@revolt/client";
import { DefaultHost, useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { parseOwnLink } from "@revolt/modal/modals/ownLink";
import { paramsFromPathname } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, iconSize } from "@revolt/ui";
import { BotInvite } from "@revolt/ui/components/features/messaging/elements/BotInvite";
import { Invite } from "@revolt/ui/components/features/messaging/elements/Invite";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  chat as MdChat,
  chevron_right as MdChevronRight,
  people as MdPeople,
} from "@revolt/ui/icons/legacy";

const link = cva({
  base: {
    cursor: "pointer",
    color: "var(--z-link, var(--md-sys-color-primary)) !important",
    // a link reads in its own direction, apart from the sentence around it:
    // an address stays left to right in one piece inside Arabic text (its
    // Arabic end used to jump in front of "https"), an Arabic label stays
    // right to left inside English
    unicodeBidi: "plaintext",
  },
});

const internalLink = cva({
  base: {
    // centred on the words around it (bottom sat it some 5px low)
    verticalAlign: "text-bottom",

    gap: "4px",
    paddingInlineStart: "2px",
    paddingInlineEnd: "6px",
    alignItems: "center",
    display: "inline-flex",
    textDecoration: "none !important",

    cursor: "pointer",
    fontWeight: 600,
    borderRadius: "var(--borderRadius-lg)",
    fill: "var(--z-on-accent, var(--md-sys-color-on-primary))",
    color: "var(--z-on-accent, var(--md-sys-color-on-primary))",
    background: "var(--z-accent-fill, var(--md-sys-color-primary))",
  },
});

function inAppScope(link: URL, root: string): boolean {
  return (
    // the page's own origin too: links the app makes (Developer Portal
    // invite links) use it, also on http while self-hosting or developing
    [
      root,
      window.location.origin,
      "https://zrzur.cc",
      "https://app.zrzur.com",
    ].includes(link.origin) &&
    /\/(i|app|home|pwa|dev|invite|bot|friends|server|channel)\/?/.test(
      link.pathname,
    )
  );
}

export function RenderAnchor(
  props: { disabled?: boolean } & JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  /* eslint-disable solid/reactivity */
  /* eslint-disable solid/components-return-once */

  const [localProps, remoteProps] = splitProps(props, [
    "href",
    "target",
    "disabled",
  ]);

  const instance = useInstance();

  // Handle empty link
  if (!localProps.href) return <span>{remoteProps.children}</span>;

  // Test internal link
  try {
    const url = new URL(localProps.href);

    // Only allow http, https, mailto, and tel protocols
    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:" &&
      url.protocol !== "mailto:" &&
      url.protocol !== "tel:"
    ) {
      return <span>{remoteProps.children}</span>;
    }

    // Our own invite and bot links, in every form (zrzur.cc/{code},
    // zrzur.cc/b/{id}, …/invite/{code}, …/bot/{id}): the server or bot card
    // only for a chat message that is nothing but the link; anywhere else
    // (a sentence, a list, a description or bio) a link that opens it in
    // the app
    const own = parseOwnLink(url, {
      appOrigins: [instance.origin, window.location.origin],
    });
    if (own) {
      const { message } = useMessage();
      const plain =
        !!message &&
        message.content?.trim() === localProps.href &&
        Array.isArray(remoteProps.children) &&
        remoteProps.children[0] === localProps.href &&
        !localProps.disabled;
      if (plain && own.kind === "invite") return <Invite code={own.code} />;
      if (plain && own.kind === "bot") {
        return <BotInvite id={own.id} permissions={own.permissions} />;
      }
      return (
        <LinkComponent
          {...remoteProps}
          class={link()}
          disabled={localProps.disabled}
          dest={localProps.href}
          href={new URL(own.path, location.origin).toString()}
        />
      );
    }

    // Determine whether it's in our scope
    if (inAppScope(url, instance.origin)) {
      const client = useClient(),
        params = paramsFromPathname(url.pathname);

      // HOTFIX: This code should have been in multi-instance, not the instance pr.
      // This hotfix ensures that the host matches the url hostname and remote urls
      // are rendered as external links
      // host with port: DefaultHost and instance.host include the port
      params.host = url.host;
      // END HOTFIX

      params.host ||= DefaultHost;
      const remote = params.host !== (instance.host || DefaultHost);

      if (params.exactChannel) {
        const channel = () => client().channels.get(params.channelId!);
        const internalUrl = () => {
          // HOTFIX: See above
          // Override remote links until multi-tenant implemented.
          if (remote) {
            return new URL(
              `https://${params.host}` +
                (channel()?.serverId ? `/server/${channel()!.serverId}` : "") +
                `/channel/${params.channelId}` +
                (params.exactMessage && params.messageId
                  ? `/${params.messageId}`
                  : ""),
              location.origin,
            ).href;
          }
          // END HOTFIX
          return new URL(
            `/i/${params.host}` +
              (channel()?.serverId ? `/server/${channel()!.serverId}` : "") +
              `/channel/${params.channelId}` +
              (params.exactMessage && params.messageId
                ? `/${params.messageId}`
                : ""),
            location.origin,
          ).href;
        };
        return (
          <Show
            when={remote || channel()}
            fallback={
              <span class={internalLink()}>
                <Symbol>tag</Symbol>
                <Trans>Private channel</Trans>
              </span>
            }
          >
            <LinkComponent
              class={internalLink()}
              disabled={props.disabled}
              href={internalUrl()}
              // HOTFIX: See above
              target={remote ? "_blank" : void 0}
              // END HOTFIX
            >
              <Symbol>{channel()?.isVoice ? "volume_up" : "tag"}</Symbol>
              {remote ? <Trans>Remote channel</Trans> : channel()!.name}
              {params.exactMessage && (
                <>
                  <MdChevronRight {...iconSize("1em")} />
                  <MdChat {...iconSize("1em")} />
                </>
              )}
            </LinkComponent>
          </Show>
        );
      } else if (params.exactServer) {
        const server = () => client().servers.get(params.serverId!);
        const internalUrl = () =>
          new URL(
            `/i/${params.host}/server/${params.serverId}`,
            location.origin,
          ).href;

        return (
          <Show
            when={remote || server()}
            fallback={
              <span class={internalLink()}>
                <MdPeople {...iconSize("1em")} />
                <Trans>Unknown server</Trans>
              </span>
            }
          >
            <LinkComponent
              class={internalLink()}
              disabled={props.disabled}
              href={internalUrl()}
            >
              {remote ? (
                <>
                  <MdPeople {...iconSize("1em")} />
                  <Trans>Remote server</Trans>
                </>
              ) : (
                <>
                  <Avatar size={16} src={server()!.iconURL} />
                  {server()!.name}
                </>
              )}
            </LinkComponent>
          </Show>
        );
      } else {
        // invite and bot links were handled above (parseOwnLink)
        const internalUrl = () =>
          new URL(url.pathname + url.search, location.origin).toString();

        return (
          <LinkComponent
            {...remoteProps}
            class={link()}
            disabled={localProps.disabled}
            href={internalUrl()}
          />
        );
      }
    }

    // All other links
    const state = useState();
    const { openModal } = useModals();

    function onHandleWarning(
      event: MouseEvent & { currentTarget: HTMLAnchorElement },
    ) {
      if (event.button === 0 || event.button === 1) {
        event.preventDefault();
        event.stopPropagation();

        openModal({
          type: "link_warning",
          url,
          display: event.currentTarget!.innerText,
        });
      }
    }

    return (
      <Show
        when={state.linkSafety.isTrusted(url)}
        fallback={
          <LinkComponent
            {...remoteProps}
            class={link()}
            dest={localProps.href}
            disabled={localProps.disabled}
            onClick={onHandleWarning}
            onAuxClick={onHandleWarning}
          />
        }
      >
        <LinkComponent
          {...remoteProps}
          class={link()}
          disabled={localProps.disabled}
          dest={localProps.href}
          href={localProps.href}
          target={"_blank"}
          rel="noreferrer"
        />
      </Show>
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    // invalid URL
    return <span>{props.children}</span>;
  }
}

function LinkComponent(
  props: {
    disabled?: boolean;
    dest?: string;
  } & JSX.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  const { message, reactPicker } = useMessage();
  const [localProps, remoteProps] = splitProps(props, ["disabled", "dest"]);
  if (localProps.disabled) {
    return <span class={remoteProps.class}>{remoteProps.children}</span>;
  }
  return (
    <a
      use:floating={
        message
          ? {
              contextMenu: () => (
                <MessageContextMenu
                  message={message}
                  reactPicker={reactPicker}
                  link={localProps.dest}
                />
              ),
            }
          : undefined
      }
      {...remoteProps}
    />
  );
}
