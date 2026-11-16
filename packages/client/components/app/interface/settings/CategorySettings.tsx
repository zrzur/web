import { Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import { useModals } from "@revolt/modal";
import { ColouredText, SettingsRow, SettingsSection } from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { SettingsConfiguration } from ".";
import { CategoryCard } from "./category/CategoryCard";
import { CategoryPermissionsOverview } from "./category/CategoryPermissionsOverview";
import CategoryOverview from "./category/Overview";
import { type CategoryContext, findCategory } from "./category/category";
import { ChannelPermissionsEditor } from "./channel/permissions/ChannelPermissionsEditor";
import { BackCard } from "./user/_AccountCard";

/**
 * Settings of one category of a server: its info, and its permissions with
 * who can see it. Opened from the category's gear and menu in the channel
 * list, and from Server settings › Channels.
 */
const Config: SettingsConfiguration<CategoryContext> = {
  /**
   * Page titles
   */
  title(ctx, key) {
    const { t } = useLingui();

    if (key.startsWith("permissions/")) {
      if (key === "permissions/default") return t`Everyone`;
      return ctx.context.server.roles.get(key.substring(12))?.name ?? "";
    }

    return ctx.entries
      .flatMap((category) => category.entries)
      .find((entry) => entry.id === key)?.title as string;
  },

  /**
   * Render the current category settings page
   */
  // we take care of the reactivity ourselves

  render(props, context) {
    const id = props.page();

    // deleted, or hidden from this person, while its settings are open
    const Gone = () => (
      <SettingsSection>
        <SettingsRow
          icon={<Icon name="folder" size={20} />}
          title={
            <span data-testid="category-gone">
              <Trans>This category is no longer here.</Trans>
            </span>
          }
          description={
            <Trans>It was deleted, or you can no longer see it.</Trans>
          }
        />
      </SettingsSection>
    );

    const page = () => {
      if (id?.startsWith("permissions/")) {
        if (id === "permissions/default") {
          return (
            <ChannelPermissionsEditor
              type="category_default"
              context={context.server}
              categoryId={context.categoryId}
            />
          );
        }
        return (
          <ChannelPermissionsEditor
            type="category_role"
            context={context.server}
            categoryId={context.categoryId}
            roleId={id.substring(12)}
          />
        );
      }

      switch (id) {
        case "overview":
          return <CategoryOverview context={context} />;
        case "permissions":
          return <CategoryPermissionsOverview context={context} />;
        default:
          return null;
      }
    };

    return (
      <Show when={findCategory(context)} fallback={<Gone />}>
        {page()}
      </Show>
    );
  },

  /**
   * Generate list of entries for category settings
   * @returns List
   */
  list(context, onClose) {
    const { openModal } = useModals();

    return {
      context,
      prepend: (
        <>
          <BackCard onClose={onClose} />
          <CategoryCard context={context} />
        </>
      ),
      entries: [
        {
          title: <Trans>General</Trans>,
          entries: [
            {
              id: "overview",
              icon: <Icon name="info" size={20} />,
              title: <Trans>Overview</Trans>,
              description: (
                <Trans>The name, the note and the channels inside.</Trans>
              ),
            },
          ],
        },
        {
          hidden: !context.server.havePermission("ManagePermissions"),
          title: <Trans>Access</Trans>,
          entries: [
            {
              id: "permissions",
              icon: <Icon name="shield-check" size={20} />,
              title: <Trans>Permissions</Trans>,
              description: (
                <Trans>
                  Who can see this category and what they can do in it.
                </Trans>
              ),
            },
          ],
        },
        {
          hidden: !context.server.havePermission("ManageChannel"),
          entries: [
            {
              icon: (
                <span style={{ "--z-icon-color": "var(--z-icon-danger)" }}>
                  <Icon name="trash" size={20} />
                </span>
              ),
              title: (
                <ColouredText colour="var(--z-danger)">
                  <Trans>Delete category</Trans>
                </ColouredText>
              ),
              onClick() {
                openModal({
                  type: "delete_category",
                  server: context.server,
                  categoryId: context.categoryId,
                  onDeleted: onClose,
                });
              },
            },
          ],
        },
      ],
    };
  },
};

export default Config;

/**
 * Whether this person may open a category's settings: they manage channels
 * (its info) or permissions (its access)
 */
export function canOpenCategorySettings(context: CategoryContext): boolean {
  return (
    context.categoryId !== "default" &&
    !!findCategory(context) &&
    context.server.orPermission("ManageChannel", "ManagePermissions")
  );
}
