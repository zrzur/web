import type { API } from "@zrzur/sdk/solid";

export type Props = {
  /**
   * User we are dealing with
   * @default Invisible
   */
  status?: API.Presence;
};

/**
 * Overlays user status in current SVG
 */
const UserStatusGraphic = (props: Props) => {
  /**
   * Convert status to lower case
   */
  const statusLowercase = () => props.status?.toLowerCase() ?? "invisible";

  // Online is a solid disc (no mask in Masks.tsx). Other states punch a
  // shape; Invisible shares the offline ring. Missing mask ids hide the
  // whole circle in some browsers — never point at an undefined mask.
  const maskId = () => {
    switch (statusLowercase()) {
      case "idle":
        return "accessible-status-idle";
      case "busy":
        return "accessible-status-busy";
      case "focus":
        return "accessible-status-focus";
      case "invisible":
      case "offline":
        return "accessible-status-offline";
      default:
        return undefined;
    }
  };

  const fillVar = () => {
    const key = statusLowercase();
    // Busy presence uses the DND/busy token; Online has no mask cutout
    if (key === "busy") return "var(--brand-presence-busy)";
    return `var(--brand-presence-${key})`;
  };

  return (
    <circle
      cx="27"
      cy="27"
      r="5"
      fill={fillVar()}
      mask={maskId() ? `url(#${maskId()})` : undefined}
    />
  );
};

/**
 * Stand-alone user status element
 */
export function UserStatus(props: Props & { size: string }) {
  return (
    <svg viewBox="22 22 10 10" height={props.size}>
      <UserStatusGraphic {...props} />
    </svg>
  );
}

UserStatus.Graphic = UserStatusGraphic;
