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

/**
 * Move one channel to its new place: into a category (or "default", no
 * category), right before or right after a channel there, else at the end.
 * Every other channel keeps its place, hidden ones included.
 */
export function moveChannel(
  ordered: OrderedCategory[],
  move: { id: string; to: string; before?: string; after?: string },
): OrderedCategory[] {
  if (!ordered.some((category) => category.id === move.to)) return ordered;

  return ordered.map((category) => {
    const ids = category.channelIds.filter((id) => id !== move.id);
    if (category.id !== move.to) {
      return ids.length === category.channelIds.length
        ? category
        : { ...category, channelIds: ids };
    }

    let at = ids.length;
    if (move.before && ids.includes(move.before)) at = ids.indexOf(move.before);
    else if (move.after && ids.includes(move.after))
      at = ids.indexOf(move.after) + 1;
    ids.splice(at, 0, move.id);
    return { ...category, channelIds: ids };
  });
}

/** Categories in a new order; the "default" group stays first */
export function moveCategories(
  ordered: OrderedCategory[],
  ids: string[],
): OrderedCategory[] {
  const byId = new Map(ordered.map((category) => [category.id, category]));
  const listed = new Set(ids);
  return [
    ...ordered.filter((category) => category.id === "default"),
    ...ids
      .map((id) => byId.get(id))
      .filter(
        (category): category is OrderedCategory =>
          !!category && category.id !== "default",
      ),
    // any category the list did not show keeps its place at the end
    ...ordered.filter(
      (category) => category.id !== "default" && !listed.has(category.id),
    ),
  ];
}
