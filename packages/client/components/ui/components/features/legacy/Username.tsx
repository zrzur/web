import { Show, splitProps } from "solid-js";

import { typography } from "../../design/Text";
import { ColouredText } from "../../utils/ColouredText";
import { nameRoom } from "../profiles/nameRoom";
import { UserStyle, hasOwnNameColour, nameStyle } from "../profiles/userStyle";

type Props = {
  /**
   * Username
   */
  username?: string;

  /**
   * Text colour (a server role colour, maybe a gradient)
   */
  colour?: string;

  /**
   * The user's chosen name style
   */
  userStyle?: UserStyle;
};

/**
 * A display name in a list or a message header.
 *
 * Which colour a name takes, the same rule in every place:
 * 1. The person's own chosen name colour, with its effect. It is their
 *    choice, so it wins over a server role colour (owner, 2026-11-24).
 * 2. A server role colour, when they chose no colour. Their font and the
 *    effects that need no colour of their own (halo, edge, lifted) stay.
 * 3. The text colour around it.
 *
 * With "Show name styles" off (`view.plain`) nothing chosen is drawn: no
 * font, no colour, no effect. A role colour is the server's, not a name
 * style, so it still shows.
 *
 * The name sits in boxes that cut it short with an ellipsis; `nameRoom`
 * gives its glow and slanted letters room inside them. `data-own-colour`
 * keeps a nameplate's ink off the chosen colour (MemberSidebar).
 *
 * @deprecated this seems unideal
 */
export function Username(props: Props) {
  const [local, remote] = splitProps(props, [
    "username",
    "colour",
    "userStyle",
  ]);

  const own = () => hasOwnNameColour(local.userStyle);

  return (
    <span
      {...remote}
      class={`${typography({ class: "label", size: "large" })} ${nameRoom}`}
      data-name-room=""
    >
      <Show
        when={!own() && local.colour}
        fallback={
          <span
            style={nameStyle(local.userStyle)}
            data-own-colour={own() ? "" : undefined}
          >
            {local.username}
          </span>
        }
      >
        <span style={nameStyle(local.userStyle, { colour: false })}>
          <ColouredText colour={local.colour!}>{local.username}</ColouredText>
        </span>
      </Show>
    </span>
  );
}
