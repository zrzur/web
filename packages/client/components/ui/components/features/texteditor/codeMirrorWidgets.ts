import { StateEffect } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { createEffect } from "solid-js";
import { Channel, ServerMember, ServerRole, User } from "@zrzur/sdk/solid";

import {
  RE_UNICODE_EMOJI,
  unicodeEmojiUrl,
} from "@revolt/markdown/emoji/UnicodeEmoji";
import { userInformation } from "@revolt/markdown/users";
import { useSmartParams } from "@revolt/routing";

import { useInstance } from "@revolt/instance";
import { parseUnicodeEmoji } from "@revolt/markdown/plugins/unicodeEmoji";
import { useState } from "@revolt/state";
import { isInCodeBlock } from "./codeMirrorCommon";

export function codeMirrorWidgets() {
  const instance = useInstance();
  const { settings } = useState();
  const params = useSmartParams();
  const views = new Set<EditorView>();
  const refreshEmoji = StateEffect.define<null>();
  let lastPack = settings.getValue("appearance:unicode_emoji");
  createEffect(() => {
    const pack = settings.getValue("appearance:unicode_emoji");
    if (pack !== lastPack) {
      lastPack = pack;
      queueMicrotask(() => {
        for (const view of views)
          view.dispatch({ effects: refreshEmoji.of(null) });
      });
    }
  });

  const widgetMatcher = new MatchDecorator({
    regexp: new RegExp(
      RE_UNICODE_EMOJI.source +
        "|" +
        /:([0-7][0-9A-HJKMNP-TV-Z]{25}):|<@([0-7][0-9A-HJKMNP-TV-Z]{25})>|<#([0-7][0-9A-HJKMNP-TV-Z]{25})>|<%([0-7][0-9A-HJKMNP-TV-Z]{25})>/
          .source,
      "g",
    ),
    decoration: (
      [str, unicodeEmoji, emojiId, userId, channelId, roleId],
      view,
      pos,
    ) => {
      if (isInCodeBlock(view.state, pos, pos + str[0].length)) {
        return null;
      }

      const { serverId } = params();

      let widget: WidgetType = null!;

      if (unicodeEmoji) {
        const { str, pack } = parseUnicodeEmoji(unicodeEmoji);

        widget = new EmojiWidget(
          unicodeEmojiUrl(
            pack ?? settings.getValue("appearance:unicode_emoji"),
            str,
          ),
          str,
        );
      } else if (emojiId) {
        widget = new EmojiWidget(
          `${instance.mediaUrl}/emojis/${emojiId}`,
          `:${instance.client.emojis.get(emojiId)?.name ?? emojiId}:`,
        );
      } else if (userId) {
        const member = serverId
          ? instance.client.serverMembers.getByKey({
              server: serverId,
              user: userId,
            })
          : undefined;

        const user = instance.client.users.get(userId);

        widget = new UserMentionWidget(user, member);
      } else if (channelId) {
        const channel = instance.client.channels.get(channelId);

        if (channel) {
          widget = new ChannelMentionWidget(channel);
        }
      } else if (roleId) {
        const role = instance.client.servers.get(serverId!)?.roles.get(roleId);

        if (role) {
          widget = new RoleMentionWidget(role);
        }
      }

      return Decoration.replace({
        widget,
      });
    },
  });

  const widgetsPlugin = ViewPlugin.fromClass(
    class {
      placeholders: DecorationSet;
      constructor(private readonly view: EditorView) {
        views.add(view);
        this.placeholders = widgetMatcher.createDeco(view);
      }
      update(update: ViewUpdate) {
        const refresh = update.transactions.some((transaction) =>
          transaction.effects.some((effect) => effect.is(refreshEmoji)),
        );
        this.placeholders = refresh
          ? widgetMatcher.createDeco(update.view)
          : widgetMatcher.updateDeco(update, this.placeholders);
      }
      destroy() {
        views.delete(this.view);
      }
    },
    {
      decorations: (instance) => instance.placeholders,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => {
          return view.plugin(plugin)?.placeholders || Decoration.none;
        }),
    },
  );

  return [widgetsPlugin, widgetsTheme];
}

const widgetsTheme = EditorView.theme({
  ".cm-emoji-widget": {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    "min-width": "1.375em",
    "min-height": "1.6em",
    "vertical-align": "middle",
  },
  ".cm-emoji-widget img": {
    display: "block",
    width: "1.375em",
    height: "1.375em",
    "object-fit": "contain",
  },
  ".cm-emoji-native": {
    "font-family":
      '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
    "font-size": "1.375em",
    "line-height": "1.25",
  },

  ".cm-mention-widget": {
    "vertical-align": "bottom",

    gap: "4px",
    "padding-left": "2px",
    "padding-right": "6px",
    "align-items": "center",
    display: "inline-flex",

    height: "1.4em", // same as line-height

    "font-weight": 600,
    "border-radius": "var(--borderRadius-lg)",

    color: "var(--md-sys-color-on-primary-container)",
    background: "var(--md-sys-color-primary-container)",
  },

  // "@" or "#" before the name, as wide as an avatar
  ".cm-mention-widget .cm-mention-glyph": {
    width: "16px",
    "text-align": "center",
    "font-weight": 700,
    opacity: 0.8,
  },

  ".cm-mention-widget img": {
    width: "16px",
    height: "16px",
    objectFit: "cover",
    borderRadius: "var(--borderRadius-full)",
  },
});

class EmojiWidget extends WidgetType {
  constructor(
    private readonly url: string,
    private readonly text: string,
  ) {
    super();
  }
  eq(other: EmojiWidget): boolean {
    return this.url === other.url && this.text === other.text;
  }
  toDOM() {
    const outer = document.createElement("span");
    outer.className = "cm-emoji-widget";
    outer.contentEditable = "false";
    outer.setAttribute("role", "img");
    outer.setAttribute("aria-label", this.text);
    const fallback = () => {
      const native = document.createElement("span");
      native.className = "cm-emoji-native";
      native.textContent = this.text;
      outer.replaceChildren(native);
    };
    if (!this.url) {
      fallback();
      return outer;
    }
    const img = document.createElement("img");
    img.alt = this.text;
    img.draggable = false;
    img.addEventListener("error", fallback, { once: true });
    img.src = this.url;
    outer.appendChild(img);
    return outer;
  }
}

class UserMentionWidget extends WidgetType {
  private readonly user: User | undefined;
  private readonly member: ServerMember | undefined;

  constructor(user?: User, member?: ServerMember) {
    super();
    this.user = user;
    this.member = member;
  }

  eq(other: UserMentionWidget): boolean {
    return this.user === other.user && this.member === other.member;
  }

  toDOM() {
    const mention = document.createElement("span");
    mention.classList.add("cm-mention-widget");
    mention.contentEditable = "false";

    const { username, avatar } = userInformation(this.user, this.member);

    if (avatar) {
      const image = document.createElement("img");
      image.src = avatar;
      mention.appendChild(image);
    } else {
      // a plain "@" (no icon font to load)
      const icon = document.createElement("span");
      icon.textContent = "@";
      icon.classList.add("cm-mention-glyph");
      icon.setAttribute("aria-hidden", "true");
      mention.appendChild(icon);
    }

    const name = document.createElement("span");
    name.textContent = username;
    mention.appendChild(name);

    return mention;
  }
}

class ChannelMentionWidget extends WidgetType {
  private readonly channel: Channel;

  constructor(channel: Channel) {
    super();
    this.channel = channel;
  }

  eq(other: ChannelMentionWidget): boolean {
    return this.channel === other.channel;
  }

  toDOM() {
    const mention = document.createElement("span");
    mention.classList.add("cm-mention-widget");
    mention.contentEditable = "false";

    const icon = document.createElement("span");
    icon.textContent = "#";
    icon.classList.add("cm-mention-glyph");
    icon.setAttribute("aria-hidden", "true");
    mention.appendChild(icon);

    const name = document.createElement("span");
    name.textContent = this.channel.name;
    mention.appendChild(name);

    return mention;
  }
}

class RoleMentionWidget extends WidgetType {
  private readonly role: ServerRole;

  constructor(role: ServerRole) {
    super();
    this.role = role;
  }

  eq(other: RoleMentionWidget): boolean {
    return this.role === other.role;
  }

  toDOM() {
    const span = document.createElement("span");
    span.classList.add("cm-mention-widget");
    span.contentEditable = "false";
    span.textContent = this.role.name;
    return span;
  }
}
