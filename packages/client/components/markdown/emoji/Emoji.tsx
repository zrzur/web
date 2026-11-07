import { Match, Switch } from "solid-js";
import { CustomEmoji } from "./CustomEmoji";
import { UnicodeEmoji } from "./UnicodeEmoji";
export { EmojiBase } from "./EmojiBase";

/**
 * Render an individual emoji
 */
export function Emoji(props: { emoji: string }) {
  return (
    <Switch fallback={<UnicodeEmoji emoji={props.emoji} />}>
      <Match when={props.emoji.length === 26}>
        <CustomEmoji id={props.emoji} />
      </Match>
    </Switch>
  );
}
