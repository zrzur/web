import { JSX } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { Channel, Server } from "@zrzur/sdk/solid";

import { useState } from "@revolt/state";
import type { SuppressKind } from "@revolt/state/stores/NotificationOptions";
import {
  check_box as MdCheckBox,
  check_box_outline_blank as MdCheckBoxOutlineBlank,
} from "@revolt/ui/icons/legacy";

import { ContextMenuButton } from "../ContextMenu";

/**
 * "Suppress @everyone and @here" and "Suppress role mentions" for a server
 * or a channel (a channel inherits its server until it is changed here)
 */
export function SuppressMentionsMenuItems(props: { target: Server | Channel }) {
  return (
    <>
      <SuppressItem target={props.target} kind="everyone">
        <Trans>Suppress @everyone and @here</Trans>
      </SuppressItem>
      <SuppressItem target={props.target} kind="roles">
        <Trans>Suppress role mentions</Trans>
      </SuppressItem>
    </>
  );
}

function SuppressItem(props: {
  target: Server | Channel;
  kind: SuppressKind;
  children: JSX.Element;
}) {
  const state = useState();

  const isOn = () =>
    props.target instanceof Channel
      ? state.notifications.isSuppressed(props.kind, props.target)
      : (state.notifications.getSuppress(props.kind, props.target) ?? false);

  return (
    <ContextMenuButton
      role="menuitemcheckbox"
      aria-checked={isOn()}
      data-suppress={props.kind}
      onClick={() =>
        state.notifications.setSuppress(props.kind, props.target, !isOn())
      }
      actionSymbol={isOn() ? MdCheckBox : MdCheckBoxOutlineBlank}
      _titleCase={false}
    >
      {props.children}
    </ContextMenuButton>
  );
}
