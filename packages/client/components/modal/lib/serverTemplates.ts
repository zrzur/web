import {
  type API,
  type Client,
  type Server,
  type ServerAccess,
  Permission,
} from "@zrzur/sdk/solid";
import { writeStatusWithRetry } from "../../common/lib/statusWrite";

export type ServerTemplateId =
  | "custom"
  | "gaming"
  | "friends"
  | "study"
  | "club"
  | "team"
  | "classroom";
export type TemplateRoom = {
  key: string;
  name: string;
  type: "Text" | "Voice";
};
/**
 * A role a template creates. Its powers are listed bit by bit here, never
 * guessed from the name, and never include server-wide control (manage
 * server, permissions or roles, bans): the owner keeps those.
 */
export type TemplateRole = {
  key: string;
  name: string;
  colour: string;
  allow: bigint;
  /** false: not shown as its own group in the member list (default true) */
  hoist?: boolean;
  /** false: this role gets no voice in the read-only rooms (default true) */
  posts?: boolean;
};
/** The answer to the question on step 2; skip is the third one */
export type ServerAnswer = "community" | "friends" | "skip";
export type ServerTemplate = {
  id: ServerTemplateId;
  /** defined and usable, but not offered on the create screen */
  hidden?: boolean;
  /** no categories: the sidebar shows the rooms under its own headings */
  flat?: boolean;
  groups: { key: string; name: string; rooms: TemplateRoom[] }[];
  roles?: TemplateRole[];
  /** rooms everyone reads; only roles without `posts: false` write in them */
  readOnly?: string[];
  /** room set as the server's rules channel */
  rules?: string;
  /** false: plain members can't create invites (only the template roles) */
  memberInvites?: boolean;
  /** the access choice the create dialog starts with (default Open) */
  access?: ServerAccess;
};
const text = (key: string, name = key): TemplateRoom => ({
  key,
  name,
  type: "Text",
});
const voice = (key: string, name: string): TemplateRoom => ({
  key,
  name,
  type: "Voice",
});
// Colours from the role palette in ColourPicker. The rights are the full
// list: Assign roles only ever reaches roles below the moderator's own.
const moderators: TemplateRole = {
  key: "moderators",
  name: "Moderators",
  colour: "#8b5cf6",
  allow:
    Permission.ManageMessages |
    Permission.TimeoutMembers |
    Permission.KickMembers |
    Permission.AssignRoles,
};
const members: TemplateRole = {
  key: "members",
  name: "Members",
  colour: "#93c5fd",
  allow: 0n,
  hoist: false,
  posts: false,
};
const startHere = {
  key: "start",
  name: "Start here",
  rooms: [text("rules"), text("announcements")],
};
/** The rooms everyone reads, and the one shown as the server's rules */
const staffed = { readOnly: ["rules", "announcements"], rules: "rules" };
export const serverTemplates: readonly ServerTemplate[] = [
  { id: "custom", groups: [] },
  {
    id: "gaming",
    groups: [
      startHere,
      {
        key: "chat",
        name: "Community",
        rooms: [text("general", "General"), text("clips")],
      },
      {
        key: "voice",
        name: "Gaming rooms",
        rooms: [voice("lobby", "Lobby"), voice("squad", "Squad")],
      },
    ],
    roles: [moderators, members],
    ...staffed,
  },
  {
    id: "friends",
    groups: [
      {
        key: "chat",
        name: "Friends",
        rooms: [text("general", "General"), text("photos")],
      },
      { key: "voice", name: "Hang out", rooms: [voice("hangout", "Hangout")] },
    ],
  },
  {
    id: "study",
    hidden: true,
    groups: [
      {
        key: "study",
        name: "Study together",
        rooms: [
          text("general", "General"),
          text("resources"),
          text("questions"),
        ],
      },
      {
        key: "voice",
        name: "Study rooms",
        rooms: [voice("study-room", "Study Room")],
      },
    ],
  },
  {
    id: "club",
    hidden: true,
    groups: [
      {
        key: "club",
        name: "Club",
        rooms: [
          text("general", "General"),
          text("announcements"),
          text("events"),
        ],
      },
      {
        key: "voice",
        name: "Meet up",
        rooms: [voice("club-room", "Club Room")],
      },
    ],
  },
  {
    id: "team",
    hidden: true,
    groups: [
      {
        key: "team",
        name: "Team",
        rooms: [text("general", "General"), text("updates"), text("planning")],
      },
      {
        key: "voice",
        name: "Meetings",
        rooms: [voice("meeting-room", "Meeting Room")],
      },
    ],
  },
  {
    // a class or course: teachers lead, students read the essentials and
    // ask questions; private by default and only staff invite. Teacher keeps
    // Manage channel, more than the server-wide rule above allows for: hidden
    // template, left as it is, to be looked at before it comes back.
    id: "classroom",
    hidden: true,
    groups: [
      {
        key: "start",
        name: "Start here",
        rooms: [text("welcome"), text("rules"), text("announcements")],
      },
      {
        key: "class",
        name: "Class",
        rooms: [
          text("general", "General"),
          text("course-info"),
          text("questions"),
          text("resources"),
        ],
      },
      {
        key: "voice",
        name: "Voice rooms",
        rooms: [
          voice("classroom", "Classroom"),
          voice("study-room", "Study Room"),
        ],
      },
    ],
    roles: [
      {
        key: "teacher",
        name: "Teacher",
        colour: "#6FA8DC",
        allow:
          Permission.ManageChannel |
          Permission.ManageMessages |
          Permission.InviteOthers |
          Permission.KickMembers |
          Permission.TimeoutMembers |
          Permission.AssignRoles |
          Permission.ManageNicknames,
      },
      {
        key: "assistant",
        name: "Teaching assistant",
        colour: "#9C8ADE",
        allow:
          Permission.ManageMessages |
          Permission.InviteOthers |
          Permission.TimeoutMembers,
      },
    ],
    readOnly: ["welcome", "rules", "announcements", "course-info"],
    rules: "rules",
    memberInvites: false,
    // students ask to join a class; a teacher approves them
    access: "Approval",
  },
];
export const getServerTemplate = (id: ServerTemplateId = "custom") =>
  serverTemplates.find((template) => template.id === id) ?? serverTemplates[0];

/** The templates the create screen offers; Start from scratch has its own row */
export const pickableServerTemplates = () =>
  serverTemplates.filter(
    (template) => !template.hidden && template.id !== "custom",
  );

/** Start from scratch: the answer alone decides what is in it */
function scratchTemplate(answer: ServerAnswer): ServerTemplate {
  const general = text("general", "General");
  return answer === "community"
    ? {
        id: "custom",
        groups: [
          startHere,
          { key: "chat", name: "Community", rooms: [general] },
          {
            key: "voice",
            name: "Hang out",
            rooms: [voice("lobby", "Lobby")],
          },
        ],
        roles: [moderators, members],
        ...staffed,
      }
    : {
        id: "custom",
        flat: true,
        groups: [
          {
            key: "rooms",
            name: "",
            rooms: [general, voice("hangout", "Hangout")],
          },
        ],
      };
}

/** What a choice on the screen really builds: the template, cut to the answer */
export function tailorServerTemplate(
  id: ServerTemplateId,
  answer: ServerAnswer,
): ServerTemplate {
  if (id === "custom") return scratchTemplate(answer);
  const template = getServerTemplate(id);
  if (id === "gaming" && answer === "friends")
    return {
      id,
      groups: template.groups.filter((group) => group !== startHere),
    };
  if (id === "friends" && answer === "community")
    return {
      ...template,
      groups: [startHere, ...template.groups],
      roles: [moderators],
      ...staffed,
    };
  return template;
}

/** The room a new server opens on: the first one a member can write in */
export function openingRoom(template: ServerTemplate) {
  const text = template.groups
    .flatMap((group) => group.rooms)
    .filter((room) => room.type === "Text");
  const open = text.find((room) => !template.readOnly?.includes(room.key));
  return (open ?? text[0])?.key;
}

/** The id of that room on a server made from the template */
export function openingChannel(template: ServerTemplate, server: Server) {
  const key = openingRoom(template);
  const room = template.groups
    .flatMap((group) => group.rooms)
    .find((entry) => entry.key === key);
  const channels = server.channels;
  return (channels.find((c) => c.name === room?.name) ?? channels[0])?.id;
}

/**
 * The template as the server builds it. Names are as given, so a template
 * passed through useLocalisedTemplate stays in the app's language.
 */
export function serverBlueprint(
  template: ServerTemplate,
  icon?: string,
): API.DataServerBlueprint {
  const channel = (room: TemplateRoom): API.BlueprintChannel => ({
    name: room.name,
    type: room.type,
    read_only: template.readOnly?.includes(room.key) ?? false,
    rules: template.rules === room.key,
  });
  return {
    ...(icon ? { icon } : {}),
    channels: template.flat
      ? template.groups.flatMap((group) => group.rooms.map(channel))
      : [],
    categories: template.flat
      ? []
      : template.groups.map((group) => ({
          title: group.name,
          channels: group.rooms.map(channel),
        })),
    roles: (template.roles ?? []).map((role) => ({
      name: role.name,
      colour: role.colour,
      hoist: role.hoist ?? true,
      allow: Number(role.allow),
      posts_in_read_only: role.posts ?? true,
    })),
    ...(template.memberInvites === false ? { member_invites: false } : {}),
  };
}

/** A write that got no answer in time; it may still land on the server */
export class TemplateTimeout extends Error {
  constructor() {
    super("The server did not answer in time");
    this.name = "TemplateTimeout";
  }
}
const WRITE_TIMEOUT = 20_000;
const UPLOAD_TIMEOUT = 120_000;

/**
 * Upload the picture, then make the whole server in one request: it comes
 * back complete, or it failed and nothing exists.
 */
export async function createServerFromTemplate(
  client: Client,
  name: string,
  template: ServerTemplate,
  options: {
    signal: AbortSignal;
    /** who can become a member; the server is never listed on Discover */
    access?: ServerAccess;
    /** uploads the chosen picture and gives its file id */
    icon?: { upload: () => Promise<string> };
    /** how long the create may take, in ms */
    writeTimeout?: number;
  },
) {
  const write = async <T>(
    operation: () => Promise<T>,
    timeout: number,
  ): Promise<T> => {
    let result!: T;
    await writeStatusWithRetry(
      async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new TemplateTimeout()), timeout);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      },
      { signal: options.signal },
    );
    return result;
  };
  const icon =
    options.icon && (await write(options.icon.upload, UPLOAD_TIMEOUT));
  return write(
    () =>
      client.servers.createServer({
        name: name.trim(),
        ...(options.access ? { access: options.access } : {}),
        blueprint: serverBlueprint(template, icon),
      }),
    options.writeTimeout ?? WRITE_TIMEOUT,
  );
}

/**
 * The server a timed-out create made after all: one of ours the gateway
 * brought in since. A retry opens it instead of making a second one.
 */
export function landedServer(client: Client, known: ReadonlySet<string>) {
  return client.servers
    .toList()
    .find(
      (server) => server.ownerId === client.user?.id && !known.has(server.id),
    );
}
