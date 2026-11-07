/**
 * Zrzur developer platform: shapes of commands, components and
 * interactions as served by the API (`/applications`, `/interactions`).
 * They come from the server's OpenAPI document and the gateway protocol
 * (`@zrzur/sdk`), without the `null` fields.
 *
 * Everything that comes from a bot is untrusted text: it is rendered as
 * plain text or through the normal message Markdown, never as HTML.
 */
import type { API, ProtocolV1, WithoutNull } from "@zrzur/sdk/solid";

export type CommandType = API.ApplicationCommandType;
export type OptionType = API.CommandOptionType;
export type ChannelKind = API.CommandChannelType;
export type Localizations = Record<string, string>;
export type OptionChoice = WithoutNull<API.CommandOptionChoice>;
export type CommandOption = WithoutNull<API.ApplicationCommandOption>;
export type ApplicationCommand = WithoutNull<API.ApplicationCommand>;
export type CommandApplication = WithoutNull<API.CommandApplication>;
export type ServerCommands = WithoutNull<API.ServerCommands>;
export type OptionValue = API.InteractionOptionValue;
export type DataOption = WithoutNull<API.InteractionDataOption>;
export type ButtonStyle = API.ButtonStyle;
export type SelectOption = WithoutNull<API.SelectOption>;
export type Component = WithoutNull<API.Component>;
export type MediaItem = WithoutNull<API.MediaItem>;
export type ComponentBlock = WithoutNull<API.ComponentBlock>;
export type Modal = WithoutNull<API.Modal>;
export type ModalFieldValue = WithoutNull<API.ModalFieldValue>;
export type InteractionAccepted = API.InteractionAccepted;
export type InteractionKind = API.InteractionType;
export type CreateInteraction = API.DataCreateInteraction;

/** A message only the invoking user sees */
export type EphemeralMessage = WithoutNull<
  Extract<
    ProtocolV1["server"],
    { type: "EphemeralMessageCreate" }
  >["message"]
>;

/** Gateway events of the developer platform, as received by a user */
export type InteractionEvent = WithoutNull<RawInteractionEvent>;

type RawInteractionEvent = Extract<
  ProtocolV1["server"],
  {
    type:
      | "InteractionStateUpdate"
      | "EphemeralMessageCreate"
      | "EphemeralMessageUpdate"
      | "EphemeralMessageDelete"
      | "InteractionModal"
      | "InteractionAutocompleteResult"
      | "ApplicationCommandsUpdate";
  }
>;

const EVENT_TYPES = new Set<string>([
  "InteractionStateUpdate",
  "EphemeralMessageCreate",
  "EphemeralMessageUpdate",
  "EphemeralMessageDelete",
  "InteractionModal",
  "InteractionAutocompleteResult",
  "ApplicationCommandsUpdate",
] satisfies RawInteractionEvent["type"][]);

/** Whether a gateway packet is one of the developer platform's */
export function isInteractionEvent(
  event: ProtocolV1["server"],
): event is RawInteractionEvent {
  return EVENT_TYPES.has(event.type);
}

/** Pick the user's language from a localisation map, falling back to the default text */
export function localized(
  fallback: string,
  map: Localizations | null | undefined,
  locale: string,
): string {
  if (!map) return fallback;
  return map[locale] ?? map[locale.split("-")[0]] ?? fallback;
}
