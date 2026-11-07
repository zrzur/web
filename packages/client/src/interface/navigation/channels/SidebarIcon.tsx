import { JSX } from "solid-js";

import { Icon, IconName } from "@revolt/ui/icons/Icon";

/** Channel sidebar glyphs, drawn from the shared icon set. */
const names = {
  hash: "hash",
  voice: "speaker-high",
  pencil: "pencil-simple",
  trash: "trash",
  plus: "plus",
  link: "link",
  lock: "lock-simple",
  // announcements / “new” = megaphone (stand-alone glyphs); the rules room uses RulesIcon
  announcement: "megaphone",
  forum: "note-pencil",
  invite: "user-plus",
  settings: "gear-six",
} satisfies Record<string, IconName>;

export function SidebarIcon(props: {
  name: keyof typeof names;
  size?: number;
  style?: JSX.CSSProperties;
}) {
  return (
    <Icon
      name={names[props.name]}
      size={props.size ?? 18}
      style={{
        "--z-icon-color": "currentColor",
        "flex-shrink": "0",
        ...props.style,
      }}
    />
  );
}
