import { useLingui } from "@lingui/solid/macro";
import type { ServerTemplate } from "./serverTemplates";

export function useTemplateTitles() {
  const { t } = useLingui();
  return () => ({
    custom: t`Start from scratch`,
    gaming: t`Gaming community`,
    friends: t`Friends`,
    study: t`Study group`,
    club: t`School club`,
    team: t`Team`,
    classroom: t`Class or course`,
  });
}
/**
 * Templates in the user's language: the preview and the channels that get
 * created both use these names.
 */
export function useLocalisedTemplate() {
  const { t } = useLingui();
  const names = (): Record<string, string> => ({
    Community: t`Community`,
    General: t`General`,
    announcements: t`announcements`,
    clips: t`clips`,
    "Gaming rooms": t`Gaming rooms`,
    Lobby: t`Lobby`,
    Squad: t`Squad`,
    Friends: t`Friends`,
    photos: t`photos`,
    "Hang out": t`Hang out`,
    Hangout: t`Hangout`,
    "Study together": t`Study together`,
    resources: t`resources`,
    questions: t`questions`,
    "Study rooms": t`Study rooms`,
    "Study Room": t`Study Room`,
    Club: t`Club`,
    events: t`events`,
    "Meet up": t`Meet up`,
    "Club Room": t`Club Room`,
    Team: t`Team`,
    updates: t`updates`,
    planning: t`planning`,
    Meetings: t`Meetings`,
    "Meeting Room": t`Meeting Room`,
    "Start here": t`Start here`,
    welcome: t`welcome`,
    rules: t`rules`,
    Class: t`Class`,
    "course-info": t`course-info`,
    "Voice rooms": t`Voice rooms`,
    Classroom: t`Classroom`,
    Moderators: t`Moderators`,
    Members: t`Members`,
    Teacher: t`Teacher`,
    "Teaching assistant": t`Teaching assistant`,
  });
  return (template: ServerTemplate): ServerTemplate => {
    const map = names();
    const name = (value: string) => map[value] ?? value;
    return {
      ...template,
      groups: template.groups.map((group) => ({
        ...group,
        name: name(group.name),
        rooms: group.rooms.map((room) => ({ ...room, name: name(room.name) })),
      })),
      roles: template.roles?.map((role) => ({
        ...role,
        name: name(role.name),
      })),
    };
  };
}
