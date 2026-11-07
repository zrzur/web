import { type Client, type Server, Permission } from "@zrzur/sdk/solid";
import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import {
  type ServerAnswer,
  type ServerTemplate,
  type ServerTemplateId,
  createServerFromTemplate,
  getServerTemplate,
  landedServer,
  openingChannel,
  openingRoom,
  pickableServerTemplates,
  serverBlueprint,
  serverTemplates,
  tailorServerTemplate,
  TemplateTimeout,
} from "./serverTemplates";

const roomKeys = (template: ServerTemplate) =>
  template.groups.flatMap((group) => group.rooms.map((room) => room.key));
const roleKeys = (template: ServerTemplate) =>
  (template.roles ?? []).map((role) => role.key);

function fixture() {
  const server = { id: "server-id" } as unknown as Server;
  const createServer = vi.fn().mockResolvedValue(server);
  const client = { servers: { createServer } } as unknown as Client;
  return { client, server, createServer };
}
const options = () => ({ signal: new AbortController().signal });
/** The rooms a blueprint builds, in the order the server keeps them */
const blueprintRooms = (template: ServerTemplate) => {
  const blueprint = serverBlueprint(template);
  return [
    ...blueprint.channels!,
    ...blueprint.categories!.flatMap((category) => category.channels ?? []),
  ];
};
const forbidden = [
  Permission.ManageServer,
  Permission.ManagePermissions,
  Permission.ManageRole,
  Permission.ManageCustomisation,
  Permission.BanMembers,
  Permission.ManageWebhooks,
];

describe("server templates", () => {
  test("all presets have distinct valid rooms and both text and voice", () => {
    expect(serverTemplates).toHaveLength(7);
    for (const template of serverTemplates.filter((t) => t.id !== "custom")) {
      const rooms = template.groups.flatMap((g) => g.rooms);
      expect(new Set(rooms.map((r) => r.key)).size).toBe(rooms.length);
      expect(rooms.some((r) => r.type === "Text")).toBe(true);
      expect(rooms.some((r) => r.type === "Voice")).toBe(true);
      expect(rooms.every((r) => r.name.length > 0 && r.name.length <= 32)).toBe(
        true,
      );
      expect(rooms.filter((r) => r.key === "general")).toHaveLength(1);
    }
  });

  describe("one request", () => {
    test.each([
      "gaming",
      "friends",
      "study",
      "club",
      "team",
      "classroom",
    ] as const)("%s is built by a single call", async (id) => {
      const f = fixture(),
        template = getServerTemplate(id);
      const result = await createServerFromTemplate(
        f.client,
        " Template ",
        template,
        options(),
      );
      expect(result).toBe(f.server);
      expect(f.createServer).toHaveBeenCalledTimes(1);
      expect(f.createServer).toHaveBeenCalledWith({
        name: "Template",
        blueprint: serverBlueprint(template),
      });
    });
    test("passes the chosen access to the server it creates", async () => {
      const f = fixture();
      await createServerFromTemplate(f.client, "Private", getServerTemplate(), {
        ...options(),
        access: "Approval",
      });
      expect(f.createServer.mock.calls[0][0].access).toBe("Approval");
    });
    test("a refused create leaves nothing to resume and can run again", async () => {
      const f = fixture();
      f.createServer.mockRejectedValueOnce(new Error("TooManyServers"));
      const template = getServerTemplate("gaming");
      await expect(
        createServerFromTemplate(f.client, "Again", template, options()),
      ).rejects.toThrow("TooManyServers");
      await expect(
        createServerFromTemplate(f.client, "Again", template, options()),
      ).resolves.toBe(f.server);
      expect(f.createServer).toHaveBeenCalledTimes(2);
    });
  });

  describe("the blueprint", () => {
    test("categories keep their rooms, with their order and type", () => {
      const blueprint = serverBlueprint(getServerTemplate("gaming"));
      expect(blueprint.channels).toEqual([]);
      expect(blueprint.categories!.map((c) => c.title)).toEqual([
        "Start here",
        "Community",
        "Gaming rooms",
      ]);
      expect(blueprint.categories![2].channels).toEqual([
        { name: "Lobby", type: "Voice", read_only: false, rules: false },
        { name: "Squad", type: "Voice", read_only: false, rules: false },
      ]);
    });
    test("a flat template has rooms and no categories", () => {
      const blueprint = serverBlueprint(tailorServerTemplate("custom", "skip"));
      expect(blueprint.categories).toEqual([]);
      expect(blueprint.channels!.map((c) => c.type)).toEqual(["Text", "Voice"]);
    });
    test("names stay in the language of the template it is given", () => {
      const template = getServerTemplate("friends");
      const arabic = {
        ...template,
        groups: template.groups.map((group) => ({
          ...group,
          name: "الأصدقاء",
          rooms: group.rooms.map((room) => ({ ...room, name: "عام" })),
        })),
      };
      const blueprint = serverBlueprint(arabic);
      expect(blueprint.categories![0].title).toBe("الأصدقاء");
      expect(blueprint.categories![0].channels![0].name).toBe("عام");
    });
    test("read-only rooms and the rules room are marked", () => {
      const rooms = blueprintRooms(getServerTemplate("gaming"));
      expect(rooms.filter((r) => r.read_only).map((r) => r.name)).toEqual([
        "rules",
        "announcements",
      ]);
      expect(rooms.filter((r) => r.rules).map((r) => r.name)).toEqual([
        "rules",
      ]);
    });
    test("roles in rank order: Moderators post in read-only rooms, Members do not", () => {
      expect(serverBlueprint(getServerTemplate("gaming")).roles).toEqual([
        {
          name: "Moderators",
          colour: "#8b5cf6",
          hoist: true,
          allow: Number(
            Permission.ManageMessages |
              Permission.TimeoutMembers |
              Permission.KickMembers |
              Permission.AssignRoles,
          ),
          posts_in_read_only: true,
        },
        {
          name: "Members",
          colour: "#93c5fd",
          hoist: false,
          allow: 0,
          posts_in_read_only: false,
        },
      ]);
    });
    test("the icon goes in the blueprint", () => {
      const template = getServerTemplate("friends");
      expect(serverBlueprint(template).icon).toBeUndefined();
      expect(serverBlueprint(template, "file-id").icon).toBe("file-id");
    });
    test("no template asks for a right the server refuses", () => {
      for (const template of serverTemplates)
        for (const role of template.roles ?? [])
          for (const right of forbidden) expect(role.allow & right).toBe(0n);
    });
  });

  describe("classroom", () => {
    const blueprint = () => serverBlueprint(getServerTemplate("classroom"));

    test("Teacher and Teaching assistant with explicit permissions", () => {
      const [teacher, assistant] = blueprint().roles!;
      expect(teacher.name).toBe("Teacher");
      expect(assistant.name).toBe("Teaching assistant");
      for (const p of [
        Permission.ManageMessages,
        Permission.InviteOthers,
        Permission.KickMembers,
        Permission.TimeoutMembers,
      ])
        expect(BigInt(teacher.allow) & p).toBe(p);
      expect(BigInt(assistant.allow) & Permission.ManageMessages).toBe(
        Permission.ManageMessages,
      );
      expect(teacher.posts_in_read_only).toBe(true);
      expect(assistant.posts_in_read_only).toBe(true);
    });
    test("four rooms are read-only for students, one is the rules room", () => {
      const rooms = blueprintRooms(getServerTemplate("classroom"));
      expect(rooms.filter((r) => r.read_only).map((r) => r.name)).toEqual([
        "welcome",
        "rules",
        "announcements",
        "course-info",
      ]);
      expect(rooms.filter((r) => r.rules).map((r) => r.name)).toEqual([
        "rules",
      ]);
    });
    test("only staff invite, and students ask to join", async () => {
      expect(blueprint().member_invites).toBe(false);
      expect(getServerTemplate("classroom").access).toBe("Approval");
    });
  });

  describe("server icon", () => {
    test("is uploaded first and goes in the one request", async () => {
      const f = fixture();
      const upload = vi.fn().mockResolvedValue("file-id");
      await createServerFromTemplate(
        f.client,
        "Friends",
        tailorServerTemplate("custom", "skip"),
        { ...options(), icon: { upload } },
      );
      expect(upload).toHaveBeenCalledTimes(1);
      expect(f.createServer.mock.calls[0][0].blueprint.icon).toBe("file-id");
      expect(upload.mock.invocationCallOrder[0]).toBeLessThan(
        f.createServer.mock.invocationCallOrder[0],
      );
    });
    test("a failed upload creates nothing", async () => {
      const f = fixture();
      const upload = vi.fn().mockRejectedValue(new Error("too big"));
      await expect(
        createServerFromTemplate(
          f.client,
          "Friends",
          tailorServerTemplate("custom", "skip"),
          { ...options(), icon: { upload } },
        ),
      ).rejects.toThrow("too big");
      expect(f.createServer).not.toHaveBeenCalled();
    });
  });

  describe("every write has an end", () => {
    test("a create that never answers becomes a normal failure", async () => {
      const f = fixture();
      f.createServer.mockReturnValue(new Promise(() => undefined));
      await expect(
        createServerFromTemplate(
          f.client,
          "Slow",
          getServerTemplate("gaming"),
          { ...options(), writeTimeout: 5 },
        ),
      ).rejects.toBeInstanceOf(TemplateTimeout);
    });
    test("a rate limit is waited out instead of failing", async () => {
      const f = fixture();
      f.createServer.mockRejectedValueOnce({ retry_after: 1 });
      await expect(
        createServerFromTemplate(
          f.client,
          "Busy",
          getServerTemplate("gaming"),
          options(),
        ),
      ).resolves.toBe(f.server);
      expect(f.createServer).toHaveBeenCalledTimes(2);
    });
  });

  describe("a create that answered too late", () => {
    const list = (servers: Partial<Server>[]) =>
      ({
        user: { id: "me" },
        servers: { toList: () => servers },
      }) as unknown as Client;

    test("is found among the servers that came since", () => {
      const late = { id: "new", ownerId: "me" };
      const client = list([{ id: "old", ownerId: "me" }, late]);
      expect(landedServer(client, new Set(["old"]))).toBe(late);
    });
    test("another person's server is not it", () => {
      const client = list([{ id: "new", ownerId: "them" }]);
      expect(landedServer(client, new Set())).toBeUndefined();
    });
  });

  describe("where a new server opens", () => {
    test("the room by name, in any language, else the first", () => {
      const template = tailorServerTemplate("gaming", "community");
      const channels = [
        { id: "a", name: "rules" },
        { id: "b", name: "General" },
      ];
      expect(openingChannel(template, { channels } as unknown as Server)).toBe(
        "b",
      );
      const other = { channels: [{ id: "c", name: "x" }] };
      expect(openingChannel(template, other as unknown as Server)).toBe("c");
      expect(
        openingChannel(template, { channels: [] } as unknown as Server),
      ).toBeUndefined();
    });
  });

  describe("what the screen offers", () => {
    test("two templates; the other four stay defined but hidden", () => {
      expect(pickableServerTemplates().map((t) => t.id)).toEqual([
        "gaming",
        "friends",
      ]);
      for (const id of ["study", "club", "team", "classroom"] as const) {
        expect(getServerTemplate(id).id).toBe(id);
        expect(getServerTemplate(id).hidden).toBe(true);
      }
    });
  });

  describe("the owner's template definitions", () => {
    test("Gaming community", () => {
      const template = getServerTemplate("gaming");
      expect(
        template.groups.map((g) => [
          g.name,
          g.rooms.map((r) => `${r.type}:${r.name}`),
        ]),
      ).toEqual([
        ["Start here", ["Text:rules", "Text:announcements"]],
        ["Community", ["Text:General", "Text:clips"]],
        ["Gaming rooms", ["Voice:Lobby", "Voice:Squad"]],
      ]);
      expect(template.readOnly).toEqual(["rules", "announcements"]);
      expect(template.rules).toBe("rules");
      expect(template.roles?.map((r) => r.name)).toEqual([
        "Moderators",
        "Members",
      ]);
    });
    test("Friends has General, photos and a voice room, and no plans", () => {
      const template = getServerTemplate("friends");
      expect(roomKeys(template)).toEqual(["general", "photos", "hangout"]);
      expect(template.roles).toBeUndefined();
    });
    test("role rights are listed bit by bit, never server-wide control", () => {
      const [moderators, members] = getServerTemplate("gaming").roles!;
      expect(moderators.allow).toBe(
        Permission.ManageMessages |
          Permission.TimeoutMembers |
          Permission.KickMembers |
          Permission.AssignRoles,
      );
      expect(members.allow).toBe(0n);
      for (const p of [
        Permission.ManageServer,
        Permission.ManagePermissions,
        Permission.ManageRole,
        Permission.BanMembers,
      ])
        expect(moderators.allow & p).toBe(0n);
    });
    test("role colours come from the app's role palette", () => {
      const palette = readFileSync(
        new URL("../../ui/components/design/ColourPicker.tsx", import.meta.url),
        "utf8",
      );
      for (const role of getServerTemplate("gaming").roles!)
        expect(palette).toContain(`"${role.colour}"`);
    });
  });

  describe("the answer shapes the server", () => {
    const shape = (id: ServerTemplateId, answer: ServerAnswer) => {
      const template = tailorServerTemplate(id, answer);
      return {
        rooms: roomKeys(template),
        roles: roleKeys(template),
        readOnly: template.readOnly ?? [],
        rules: template.rules,
      };
    };
    const STAFFED = { readOnly: ["rules", "announcements"], rules: "rules" };
    const PLAIN = { readOnly: [], rules: undefined };
    const GUILD = {
      rooms: ["rules", "announcements", "general", "clips", "lobby", "squad"],
      roles: ["moderators", "members"],
      ...STAFFED,
    };

    test.each<[ServerTemplateId, ServerAnswer, ReturnType<typeof shape>]>([
      [
        "custom",
        "community",
        {
          rooms: ["rules", "announcements", "general", "lobby"],
          roles: ["moderators", "members"],
          ...STAFFED,
        },
      ],
      [
        "custom",
        "friends",
        { rooms: ["general", "hangout"], roles: [], ...PLAIN },
      ],
      [
        "custom",
        "skip",
        { rooms: ["general", "hangout"], roles: [], ...PLAIN },
      ],
      ["gaming", "community", GUILD],
      ["gaming", "skip", GUILD],
      [
        "gaming",
        "friends",
        { rooms: ["general", "clips", "lobby", "squad"], roles: [], ...PLAIN },
      ],
      [
        "friends",
        "community",
        {
          rooms: ["rules", "announcements", "general", "photos", "hangout"],
          roles: ["moderators"],
          ...STAFFED,
        },
      ],
      [
        "friends",
        "friends",
        { rooms: ["general", "photos", "hangout"], roles: [], ...PLAIN },
      ],
      [
        "friends",
        "skip",
        { rooms: ["general", "photos", "hangout"], roles: [], ...PLAIN },
      ],
    ])("%s + %s", (id, answer, expected) => {
      expect(shape(id, answer)).toEqual(expected);
    });

    test("every combination gets categories, text and voice", () => {
      for (const id of ["custom", "gaming", "friends"] as const)
        for (const answer of ["community", "friends", "skip"] as const) {
          const template = tailorServerTemplate(id, answer);
          const rooms = template.groups.flatMap((g) => g.rooms);
          expect(rooms.some((r) => r.type === "Text")).toBe(true);
          expect(rooms.some((r) => r.type === "Voice")).toBe(true);
        }
    });

    test.each(["friends", "skip"] as const)(
      "scratch + %s stays under the sidebar's own Text and Voice headings",
      (answer) => {
        const template = tailorServerTemplate("custom", answer);
        expect(blueprintRooms(template).map((c) => c.name)).toEqual([
          "General",
          "Hangout",
        ]);
        expect(serverBlueprint(template).categories).toEqual([]);
      },
    );
    test("no category repeats a heading the sidebar always shows", () => {
      for (const id of ["custom", "gaming", "friends"] as const)
        for (const answer of ["community", "friends", "skip"] as const) {
          const names = tailorServerTemplate(id, answer).groups.map(
            (g) => g.name,
          );
          expect(names).not.toContain("Text channels");
          expect(names).not.toContain("Voice channels");
        }
    });

    test("trimming never touches the shared definitions", () => {
      tailorServerTemplate("gaming", "friends");
      tailorServerTemplate("friends", "community");
      expect(roomKeys(getServerTemplate("gaming"))).toContain("rules");
      expect(roleKeys(getServerTemplate("gaming"))).toHaveLength(2);
      expect(roomKeys(getServerTemplate("friends"))).not.toContain("rules");
    });

    test("the server opens on the first room a member can write in", () => {
      for (const id of ["custom", "gaming", "friends"] as const)
        for (const answer of ["community", "friends", "skip"] as const)
          expect(openingRoom(tailorServerTemplate(id, answer))).toBe("general");
      expect(openingRoom(getServerTemplate("custom"))).toBeUndefined();
    });
    test("a server with only read-only text rooms still opens on one", () => {
      expect(
        openingRoom({
          id: "custom",
          groups: [
            {
              key: "a",
              name: "A",
              rooms: [{ key: "news", name: "news", type: "Text" }],
            },
          ],
          readOnly: ["news"],
        }),
      ).toBe("news");
    });
  });
});
