import { Show, splitProps } from "solid-js";

import { typography } from "../../design/Text";
import { ColouredText } from "../../utils/ColouredText";
import { UserStyle, nameStyle } from "../profiles/userStyle";

type Props = {
  /**
   * Username
   */
  username?: string;

  /**
   * Text colour
   */
  colour?: string;

  /**
   * The user's chosen name style. Its font always applies; its colour only
   * when there is no role colour (a server role colour wins).
   */
  userStyle?: UserStyle;
};

/**
 * Username
 *
 * @deprecated this seems unideal
 */
export function Username(props: Props) {
  const [local, remote] = splitProps(props, [
    "username",
    "colour",
    "userStyle",
  ]);

  return (
    <span {...remote} class={typography({ class: "label", size: "large" })}>
      <Show
        when={local.colour}
        fallback={
          <span style={nameStyle(local.userStyle)}>{local.username}</span>
        }
      >
        <span style={nameStyle(local.userStyle, { colour: false })}>
          <ColouredText colour={local.colour!}>{local.username}</ColouredText>
        </span>
      </Show>
    </span>
  );
}
