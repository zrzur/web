import { Accessor, JSX } from "solid-js";

import channel from "./ChannelSettings";
import server from "./ServerSettings";
import user from "./UserSettings";

export { Settings } from "./Settings";

export type SettingsConfiguration<T> = {
  /**
   * Generate list of categories and entries
   * @param props State information
   * @returns List
   */
  list: (context: T, onClose?: () => void) => SettingsList<T>;

  /**
   * Turn an old page id into the address it opens now ("page",
   * "page#section" or "page/sub-view")
   */
  resolve?: (id: string) => string;

  /**
   * Render the title of the current breadcrumb key
   * @param ctx Context from settings list
   * @param key Key
   */
  title: (ctx: SettingsList<T>, key: string) => string;

  /**
   * Render the current settings page
   * @param props State information
   */
  render: (
    props: { page: Accessor<undefined | string> },
    context: T,
  ) => JSX.Element;
};

/**
 * List of categories and entries
 */
export type SettingsList<T> = {
  context: T;
  prepend?: JSX.Element;
  append?: JSX.Element;
  /**
   * Show a search field above the list (entries match on their keywords)
   */
  search?: boolean;
  entries: {
    hidden?: boolean;
    title?: JSX.Element;
    entries: SettingsEntry[];
  }[];
};

/**
 * Individual settings entry
 */
export type SettingsEntry = {
  id?: string;
  href?: string;
  onClick?: () => void;

  hidden?: boolean;

  icon: JSX.Element;
  title: JSX.Element;

  /**
   * One short line under the page title: what the page is for
   */
  description?: JSX.Element;

  /**
   * Words the settings search finds this page by: its name and the
   * settings on it, in the interface language
   */
  keywords?: string;

  /**
   * Parts of the page the search can jump to ("page#id"); listed under
   * the page while searching
   */
  sections?: {
    id: string;
    title: JSX.Element;
    keywords: string;
  }[];
};

// eslint-disable-next-line
export const SettingsConfigurations: Record<string, any> = {
  user,
  server,
  channel,
};
