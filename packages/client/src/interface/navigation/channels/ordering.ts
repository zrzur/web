import type { API } from "@zrzur/sdk/solid";

export interface OrderedCategory {
  id: string;
  title: string;
  channelIds: string[];
}

export function orderedCategories(
  categories: API.Category[] | undefined,
  knownChannelIds: string[],
): OrderedCategory[] {
  const known = new Set(knownChannelIds);
  const uncategorised = new Set(knownChannelIds);

  const ordered = (categories ?? [])
    .map((category) => {
      for (const id of category.channels) {
        uncategorised.delete(id);
      }

      return {
        id: category.id,
        title: category.title,
        channelIds: category.channels,
      };
    })
    .filter(
      (category) =>
        category.id !== "default" ||
        category.channelIds.some((id) => known.has(id)),
    );

  const uncategorisedIds = [...uncategorised];
  const defaultCategory = ordered.find((category) => category.id === "default");

  if (defaultCategory) {
    defaultCategory.channelIds = [
      ...defaultCategory.channelIds,
      ...uncategorisedIds,
    ];
  } else {
    ordered.unshift({
      id: "default",
      title: "Default",
      channelIds: uncategorisedIds,
    });
  }

  return ordered;
}

export function applyChannelOrdering(
  channelIds: string[],
  visibleIds: string[],
  reorderedIds: string[],
) {
  const newOrdering: string[] = [];
  const visible = new Set(visibleIds);
  const remaining = [...channelIds];

  for (const orderedId of reorderedIds) {
    const index = remaining.indexOf(orderedId);

    if (index === -1) {
      newOrdering.push(orderedId);
      continue;
    }

    const leading = remaining.splice(0, index);

    newOrdering.push(...leading.filter((id) => !visible.has(id)));

    // invariant: remaining[0] === orderedId
    newOrdering.push(remaining.shift()!);

    remaining.unshift(...leading.filter((id) => visible.has(id)));
  }

  return [...newOrdering, ...remaining.filter((id) => !visible.has(id))];
}

/**
 * Categories as the server stores them. The "default" group (channels in no
 * category) is shown by the app; it is stored only when the server already
 * has it or the user reordered channels inside it, so a reorder never adds a
 * synthetic "Default" category.
 */
export function categoriesToSave(
  ordered: OrderedCategory[],
  storedIds: string[],
  touchedId?: string,
): API.Category[] {
  return ordered
    .filter(
      (category) =>
        category.id !== "default" ||
        storedIds.includes("default") ||
        category.id === touchedId,
    )
    .map(({ id, title, channelIds }) => ({ id, title, channels: channelIds }));
}
