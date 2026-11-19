import { createFormControl, createFormGroup } from "solid-forms";
import {
  For,
  Match,
  Show,
  Switch,
  createResource,
  createSignal,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type API, File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { useNavigate } from "@revolt/routing";
import {
  Checkbox,
  DateTimeField,
  Dialog,
  DialogProps,
  FloatingSelect,
  Form2,
  MenuItem,
  Segmented,
  TextField,
  Toggle,
} from "@revolt/ui";
import { hour12From, roundUp } from "@revolt/ui/components/design/dateTime";

import {
  type CoverKind,
  COVER_KINDS,
  DrawnCover,
  coverFile,
} from "../../../src/interface/events/eventCovers";
import { MemberPicker } from "../../../src/interface/events/MemberPicker";

import { useModals } from "..";
import { Modals } from "../types";

import { cropProcess } from "./CropProcess";

type PlaceKind = API.ServerEventPlace["type"];
type Repeat = API.ServerEventRepeat | "None";
type Visibility = API.ServerEventVisibility;
type AttendeeList = API.ServerEventAttendeeList;

/** Invited people and helpers an event can have at most (the server's limits) */
const MAX_INVITED = 200;
const MAX_HELPERS = 10;

/** Seats an event can have at most (the server decides; this is the field) */
const MAX_SEATS = 10000;

/** Problems found before anything is sent, in plain words */
export function eventTimeProblem(
  start: Date | undefined,
  end: Date | undefined,
  now: Date,
  startChanged: boolean,
): "start-missing" | "start-past" | "end-before" | "end-long" | undefined {
  if (!start) return "start-missing";
  if (startChanged && start.getTime() < now.getTime() - 5 * 60_000)
    return "start-past";
  if (end && end.getTime() <= start.getTime()) return "end-before";
  if (end && end.getTime() - start.getTime() > 31 * 24 * 60 * 60_000)
    return "end-long";
  return undefined;
}

/**
 * Schedule a server event, or change one: title, description, when, where
 * (a voice or text channel of the server, or somewhere else), repeat and
 * cover. Mistakes show in this dialog, in plain words, without losing
 * anything typed.
 */
export function ServerEventEditorModal(
  props: DialogProps & Modals & { type: "server_event" },
) {
  const { t } = useLingui();
  const client = useClient();
  const instance = useInstance();
  const navigate = useNavigate();
  const { openModal } = useModals();
  const [error, setError] = createSignal<unknown>();
  const [problem, setProblem] = createSignal<string>();
  const hour12 = () => hour12From(timeLocale()[1].formats?.LT);

  /* eslint-disable solid/reactivity */
  const existing = props.event;
  const initialStart = existing
    ? new Date(existing.starts_at)
    : roundUp(new Date(Date.now() + 60 * 60_000), 30);
  const [start, setStart] = createSignal<Date | undefined>(initialStart);
  const [hasEnd, setHasEnd] = createSignal(!!existing?.ends_at || !existing);
  const [end, setEnd] = createSignal<Date | undefined>(
    existing?.ends_at
      ? new Date(existing.ends_at)
      : new Date(initialStart.getTime() + 2 * 60 * 60_000),
  );
  const [kind, setKind] = createSignal<PlaceKind>(
    existing?.place.type ?? "Voice",
  );
  const [channel, setChannel] = createSignal<string>(
    existing && existing.place.type !== "External"
      ? existing.place.channel
      : "",
  );
  const [repeat, setRepeat] = createSignal<Repeat>(existing?.repeat ?? "None");
  // the invited people reach only organisers, and not over the gateway: an
  // event whose list did not come with it keeps who sees it as it is
  const invitedOnly =
    existing?.visibility === "Invited" && existing.invited == null;
  const [visibility, setVisibility] = createSignal<Visibility>(
    existing?.visibility ?? "Place",
  );
  const [invited, setInvited] = createSignal<string[]>(existing?.invited ?? []);
  const [helpers, setHelpers] = createSignal<string[]>(
    existing?.co_organisers ?? [],
  );
  const [roles, setRoles] = createSignal<string[]>(
    existing?.visible_roles ?? [],
  );
  const [limited, setLimited] = createSignal(existing?.capacity != null);
  const [seats, setSeats] = createSignal(String(existing?.capacity ?? 20));
  const [waitlist, setWaitlist] = createSignal(existing?.waitlist !== false);
  const [attendeeList, setAttendeeList] = createSignal<AttendeeList>(
    existing?.attendee_list ?? "Organisers",
  );
  // a ready cover, drawn here and uploaded like a picture when saved
  const [readyCover, setReadyCover] = createSignal<CoverKind>();
  const group = createFormGroup({
    title: createFormControl(existing?.title ?? "", { required: true }),
    description: createFormControl(existing?.description ?? ""),
    location: createFormControl(
      existing?.place.type === "External" ? existing.place.location : "",
    ),
    cover: createFormControl<string | File[] | null>(
      existing?.cover
        ? (new StoatFile(client(), existing.cover).createFileURL() ?? null)
        : null,
    ),
  });
  /* eslint-enable solid/reactivity */

  const channels = () =>
    props.server.channels.filter(
      (entry) =>
        entry.havePermission("ViewChannel") &&
        (kind() === "Voice" ? entry.isVoice : !entry.isVoice),
    );

  // the first channel of the kind, until one is picked
  const chosenChannel = () =>
    channels().some((entry) => entry.id === channel())
      ? channel()
      : (channels()[0]?.id ?? "");

  const place = (): API.ServerEventPlace | undefined => {
    if (kind() === "External") {
      const location = group.controls.location.value.trim();
      return location ? { type: "External", location } : undefined;
    }
    const id = chosenChannel();
    return id ? { type: kind() as "Voice" | "Text", channel: id } : undefined;
  };

  const problemText = (code?: string) => {
    switch (code) {
      case "start-missing":
        return t`Choose when it starts.`;
      case "start-past":
        return t`The start time has passed. Choose a later time.`;
      case "end-before":
        return t`The end must be after the start.`;
      case "end-long":
        return t`An event can last up to 31 days.`;
      case "place":
        return t`Choose where it takes place.`;
      case "roles":
        return t`Choose at least one role that sees this event.`;
      case "invited":
        return t`Choose at least one person to invite.`;
      case "seats":
        return t`The seat limit is a number from 1 to ${MAX_SEATS}.`;
    }
  };

  // one press, one event: further presses (and Enter) wait for the answer
  const [saving, setSaving] = createSignal(false);

  async function onSubmit(draft = false) {
    if (saving()) return;
    setSaving(true);
    try {
      await save(draft);
    } finally {
      setSaving(false);
    }
  }

  // other events of the server at this time and place: a warning, no block
  const [clashes] = createResource(
    () => {
      const startsAt = start();
      const where = place();
      if (!startsAt || !where) return undefined;
      return {
        starts_at: startsAt.toISOString(),
        ends_at: hasEnd() ? end()?.toISOString() : undefined,
        channel: where.type === "External" ? undefined : where.channel,
        location: where.type === "External" ? where.location : undefined,
        exclude: existing?._id,
      };
    },
    async (query) => {
      try {
        return await client().serverEvents.fetchClashes(props.server.id, query);
      } catch {
        // the warning is a help, never a reason to stop
        return [];
      }
    },
  );
  const clashNames = () =>
    (clashes.latest ?? [])
      .slice(0, 3)
      .map((event) => event.title)
      .join(", ");

  const seatCount = () => {
    const count = Number(seats());
    return Number.isInteger(count) && count >= 1 && count <= MAX_SEATS
      ? count
      : undefined;
  };

  async function save(draft: boolean) {
    setError(undefined);
    const startsAt = start();
    const endsAt = hasEnd() ? end() : undefined;
    const startChanged =
      !existing ||
      startsAt?.toISOString() !== new Date(existing.starts_at).toISOString();
    const timeProblem = eventTimeProblem(
      startsAt,
      endsAt,
      new Date(),
      startChanged,
    );
    if (timeProblem) {
      setProblem(timeProblem);
      return;
    }
    const where = place();
    if (!where) {
      setProblem("place");
      return;
    }
    if (!invitedOnly && visibility() === "Roles" && !roles().length) {
      setProblem("roles");
      return;
    }
    if (!invitedOnly && visibility() === "Invited" && !invited().length) {
      setProblem("invited");
      return;
    }
    if (limited() && seatCount() === undefined) {
      setProblem("seats");
      return;
    }
    setProblem(undefined);

    try {
      let cover: string | undefined;
      const coverValue = group.controls.cover.value;
      const ready = readyCover();
      if (ready) {
        cover = await client().uploadFile(
          "banners",
          await coverFile(ready),
          instance.mediaUrl,
        );
      } else if (Array.isArray(coverValue) && coverValue.length) {
        cover = await client().uploadFile(
          "banners",
          coverValue[0],
          instance.mediaUrl,
        );
      }
      const title = group.controls.title.value.trim();
      const description = group.controls.description.value.trim();
      const repeatValue =
        repeat() === "None" ? undefined : (repeat() as API.ServerEventRepeat);

      if (existing) {
        const remove: API.FieldsServerEvent[] = [];
        const changes: API.DataEditServerEvent = {
          title,
          place: where,
          remove,
        };
        if (description) changes.description = description;
        else if (existing.description) remove.push("Description");
        if (startChanged && existing.status === "Scheduled")
          changes.starts_at = startsAt!.toISOString();
        if (endsAt) changes.ends_at = endsAt.toISOString();
        else if (existing.ends_at) remove.push("EndsAt");
        if (repeatValue) changes.repeat = repeatValue;
        else if (existing.repeat) remove.push("Repeat");
        if (cover) changes.cover = cover;
        else if (!coverValue && existing.cover) remove.push("Cover");
        if (!invitedOnly) {
          changes.visibility = visibility();
          changes.visible_roles = visibility() === "Roles" ? roles() : [];
          changes.invited = visibility() === "Invited" ? invited() : [];
        }
        changes.co_organisers = helpers();
        changes.attendee_list = attendeeList();
        if (limited()) {
          changes.capacity = seatCount();
          changes.waitlist = waitlist();
        } else if (existing.capacity != null) remove.push("Capacity");
        await client().serverEvents.edit(
          props.server.id,
          existing._id,
          changes,
        );
        props.onClose();
      } else {
        const created = await client().serverEvents.create(props.server.id, {
          title,
          description: description || undefined,
          starts_at: startsAt!.toISOString(),
          ends_at: endsAt?.toISOString(),
          place: where,
          repeat: repeatValue,
          cover,
          // repeats keep this wall-clock time where the event is planned
          time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          draft: draft || undefined,
          visibility: visibility(),
          visible_roles: visibility() === "Roles" ? roles() : undefined,
          invited: visibility() === "Invited" ? invited() : undefined,
          co_organisers: helpers().length ? helpers() : undefined,
          attendee_list: attendeeList(),
          capacity: limited() ? seatCount() : undefined,
          waitlist: limited() ? waitlist() : undefined,
        });
        props.onClose();
        navigate(`/server/${props.server.id}/events/${created._id}`);
      }
    } catch (failure) {
      setError(failure);
    }
  }

  const submit = Form2.useSubmitHandler(group, () => onSubmit());

  return (
    <Dialog
      tone={existing ? "edit" : "create"}
      iconName="calendar"
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      size="md"
      title={existing ? <Trans>Edit event</Trans> : <Trans>New event</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        ...(existing
          ? []
          : [
              {
                variant: "secondary" as const,
                text: <Trans>Save as draft</Trans>,
                onClick: () => {
                  void onSubmit(true);
                  return false;
                },
                isDisabled: !Form2.canSubmit(group) || saving(),
              },
            ]),
        {
          text: existing ? (
            <Trans>Save</Trans>
          ) : (
            <Trans context="scheduled events">Publish</Trans>
          ),
          onClick: () => {
            void onSubmit();
            return false;
          },
          isDisabled: !Form2.canSubmit(group) || saving(),
          isLoading: saving(),
        },
      ]}
      isDisabled={group.isPending || saving()}
    >
      <form onSubmit={submit} data-testid="server-event-form">
        <Fields>
          <Form2.TextField
            minlength={1}
            maxlength={100}
            counter
            name="title"
            control={group.controls.title}
            label={t({ message: "Title", context: "scheduled events" })}
            data-testid="server-event-title"
          />
          <Form2.TextField
            maxlength={1000}
            counter
            rows={3}
            name="description"
            control={group.controls.description}
            label={t`Description (optional)`}
            helper={t`Markdown works here.`}
          />

          <DateTimeField
            label={t`Starts`}
            value={start()}
            min={existing?.status === "Active" ? undefined : new Date()}
            hour12={hour12()}
            testId="server-event-start"
            onChange={(value) => {
              // keep the length when the start moves
              const length =
                start() && end() ? end()!.getTime() - start()!.getTime() : 0;
              setStart(value);
              if (length > 0) setEnd(new Date(value.getTime() + length));
            }}
          />
          <ToggleRow>
            <label for="server-event-has-end">
              <Trans>Set an end time</Trans>
            </label>
            <Toggle
              id="server-event-has-end"
              checked={hasEnd()}
              onChange={setHasEnd}
            />
          </ToggleRow>
          <Show when={hasEnd()}>
            <DateTimeField
              label={t({ message: "Ends", context: "scheduled events" })}
              value={end()}
              min={start()}
              hour12={hour12()}
              testId="server-event-end"
              onChange={setEnd}
            />
          </Show>
          <Show when={!hasEnd()}>
            <Hint>
              <Trans>
                Without an end time it ends 12 hours after it starts, or when a
                manager ends it.
              </Trans>
            </Hint>
          </Show>

          <fieldset>
            <legend>
              <Trans context="scheduled events">Where</Trans>
            </legend>
            <Segmented<PlaceKind>
              aria-label={t({ message: "Where", context: "scheduled events" })}
              value={kind()}
              onChange={setKind}
              options={[
                { value: "Voice", label: t`Voice channel` },
                { value: "Text", label: t`Text channel` },
                { value: "External", label: t`Somewhere else` },
              ]}
            />
          </fieldset>
          <Switch>
            <Match when={kind() === "External"}>
              <Form2.TextField
                maxlength={100}
                counter
                name="location"
                control={group.controls.location}
                label={t`Address or link`}
                data-testid="server-event-location"
              />
            </Match>
            <Match when={channels().length}>
              <FloatingSelect
                id="server-event-channel"
                label={kind() === "Voice" ? t`Voice channel` : t`Text channel`}
                value={chosenChannel()}
                onChange={(event) => setChannel(event.currentTarget.value)}
              >
                <For each={channels()}>
                  {(entry) => (
                    <MenuItem value={entry.id}>{entry.name}</MenuItem>
                  )}
                </For>
              </FloatingSelect>
            </Match>
            <Match when={!channels().length}>
              <Hint>
                {kind() === "Voice" ? (
                  <Trans>This server has no voice channel you can see.</Trans>
                ) : (
                  <Trans>This server has no text channel you can see.</Trans>
                )}
              </Hint>
            </Match>
          </Switch>

          <Show when={clashes.latest?.length}>
            <Warning role="status" data-testid="server-event-clash">
              <Trans>
                At this time there is another event: {clashNames()}.
              </Trans>
            </Warning>
          </Show>

          <FloatingSelect
            id="server-event-repeat"
            label={t({ message: "Repeat", context: "scheduled events" })}
            value={repeat()}
            onChange={(event) => setRepeat(event.currentTarget.value as Repeat)}
          >
            <MenuItem value="None">{t`Does not repeat`}</MenuItem>
            <MenuItem value="Daily">{t`Every day`}</MenuItem>
            <MenuItem value="Weekly">{t`Every week`}</MenuItem>
            <MenuItem value="EveryTwoWeeks">{t`Every 2 weeks`}</MenuItem>
            <MenuItem value="Monthly">{t`Every month`}</MenuItem>
          </FloatingSelect>

          <fieldset>
            <legend>
              <Trans>Cover</Trans>
            </legend>
            <Covers role="radiogroup" aria-label={t`Ready covers`}>
              <For each={COVER_KINDS}>
                {(kind, index) => (
                  <CoverChoice
                    type="button"
                    role="radio"
                    aria-checked={readyCover() === kind}
                    aria-label={t`Ready cover ${index() + 1}`}
                    onClick={() =>
                      setReadyCover(readyCover() === kind ? undefined : kind)
                    }
                    data-testid={`server-event-cover-${kind}`}
                  >
                    <DrawnCover kind={kind} />
                  </CoverChoice>
                )}
              </For>
            </Covers>
            <Hint>
              <Trans>
                Pick a ready cover, or upload a picture of your own.
              </Trans>
            </Hint>
          </fieldset>
          <Show when={!readyCover()}>
            <Form2.FileInput
              control={group.controls.cover}
              accept="image/*"
              label={t`Cover image (optional)`}
              removeLabel={t`Remove cover image`}
              imageAspect="16/9"
              imageRounded={false}
              imageJustify={false}
              imageHeight={96}
              maxSize={instance.limits().file_upload_size_limits["banners"]}
              process={cropProcess({
                ratio: 16 / 9,
                ratioLabel: t`Cover`,
                openModal,
                allowModeToggle: false,
                dialogTitle: t`Crop cover image`,
                maxWidth: 1920,
                outputType: "image/webp",
                outputQuality: 0.9,
              })}
            />
          </Show>

          <Show when={!invitedOnly}>
            <fieldset>
              <legend>
                <Trans>Who sees it</Trans>
              </legend>
              <Segmented<Visibility>
                aria-label={t`Who sees it`}
                value={visibility()}
                onChange={setVisibility}
                options={[
                  { value: "Place", label: t`Everyone who sees its place` },
                  { value: "Roles", label: t`Some roles` },
                  { value: "Invited", label: t`Invited only` },
                ]}
              />
              <Show when={visibility() === "Invited"}>
                <MemberPicker
                  server={props.server}
                  label={t`Invite people`}
                  value={invited()}
                  onChange={setInvited}
                  max={MAX_INVITED}
                  testId="server-event-invited"
                />
                <Hint>
                  <Trans>
                    Only they and the organisers see this event. Nobody else
                    learns that it exists.
                  </Trans>
                </Hint>
              </Show>
              <Show when={visibility() === "Roles"}>
                <RoleList data-testid="server-event-roles">
                  <For each={props.server.orderedRoles}>
                    {(role) => (
                      <Checkbox
                        checked={roles().includes(role.id)}
                        onChange={(event) =>
                          setRoles(
                            event.currentTarget.checked
                              ? [...roles(), role.id]
                              : roles().filter((id) => id !== role.id),
                          )
                        }
                      >
                        {role.name}
                      </Checkbox>
                    )}
                  </For>
                </RoleList>
              </Show>
            </fieldset>
          </Show>
          <Show when={invitedOnly}>
            <Hint>
              <Trans>Only the invited people see this event.</Trans>
            </Hint>
          </Show>

          <fieldset>
            <legend>
              <Trans>Helpers</Trans>
            </legend>
            <MemberPicker
              server={props.server}
              label={t`Add a helper`}
              value={helpers()}
              onChange={setHelpers}
              max={MAX_HELPERS}
              exclude={[existing?.creator ?? client().user?.id ?? ""]}
              testId="server-event-helpers"
            />
            <Hint>
              <Trans>
                Helpers can change this event and manage who comes, without
                managing the server's other events.
              </Trans>
            </Hint>
          </fieldset>

          <ToggleRow>
            <label for="server-event-limited">
              <Trans>Seat limit</Trans>
              <small>
                <Trans>After it, people join a waiting list in order.</Trans>
              </small>
            </label>
            <Toggle
              id="server-event-limited"
              checked={limited()}
              onChange={setLimited}
            />
          </ToggleRow>
          <Show when={limited()}>
            <TextField
              variant="outlined"
              type="number"
              min={1}
              max={MAX_SEATS}
              label={t`Seats`}
              value={seats()}
              onChange={(event) => setSeats(event.currentTarget.value)}
              data-testid="server-event-seats"
            />
            <ToggleRow>
              <label for="server-event-waitlist">
                <Trans>Waiting list</Trans>
              </label>
              <Toggle
                id="server-event-waitlist"
                checked={waitlist()}
                onChange={setWaitlist}
              />
            </ToggleRow>
          </Show>

          <FloatingSelect
            id="server-event-attendee-list"
            label={t`Who sees the names of the people coming`}
            value={attendeeList()}
            onChange={(event) =>
              setAttendeeList(event.currentTarget.value as AttendeeList)
            }
          >
            <MenuItem value="Organisers">{t`Organisers only`}</MenuItem>
            <MenuItem value="Participants">{t`People taking part`}</MenuItem>
            <MenuItem value="Everyone">{t`Everyone who sees the event`}</MenuItem>
          </FloatingSelect>

          <Show when={problem()}>
            <Failure role="alert" data-testid="server-event-problem">
              {problemText(problem())}
            </Failure>
          </Show>
          <Show when={error()}>
            <Failure role="alert" data-testid="server-event-error">
              <TranslatedError error={error()} />
            </Failure>
          </Show>
        </Fields>
      </form>
    </Dialog>
  );
}

const Fields = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    "& fieldset": {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      border: "none",
      padding: 0,
      margin: 0,
      minWidth: 0,
    },
    "& legend": {
      padding: 0,
      marginBottom: "8px",
      fontSize: "12px",
      fontWeight: 650,
      color: "var(--z-fg-muted)",
    },
  },
});

const ToggleRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "44px",
    color: "var(--z-fg-primary)",
    fontSize: "15px",
    "& label": { display: "flex", flexDirection: "column", minWidth: 0 },
    "& small": {
      fontSize: "13px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
  },
});

const Warning = styled("div", {
  base: {
    padding: "10px 12px",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "color-mix(in srgb, var(--z-status-warning) 12%, transparent)",
    color: "var(--z-status-warning)",
    fontSize: "13px",
    lineHeight: "18px",
  },
});

const Covers = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "8px",
  },
});

const CoverChoice = styled("button", {
  base: {
    aspectRatio: "16 / 9",
    padding: 0,
    border: "none",
    borderRadius: "var(--z-radius-sm, 6px)",
    overflow: "hidden",
    cursor: "pointer",
    background: "var(--z-bg-input)",
    "&[aria-checked=true]": {
      outline: "2px solid var(--z-accent)",
      outlineOffset: "2px",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const RoleList = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    maxHeight: "168px",
    overflowY: "auto",
    padding: "8px 12px",
    borderRadius: "var(--z-radius-sm, 6px)",
    background: "var(--z-bg-input)",
  },
});

const Hint = styled("p", {
  base: {
    margin: 0,
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",
  },
});

const Failure = styled("div", {
  base: {
    padding: "12px",
    borderRadius: "var(--z-radius, 10px)",
    background: "color-mix(in srgb, var(--z-danger) 12%, transparent)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    lineHeight: "18px",
  },
});
