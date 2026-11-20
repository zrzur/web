import { createFormControl, createFormGroup } from "solid-forms";
import {
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type API, File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { useNavigate } from "@revolt/routing";
import { ALLOWED_IMAGE_TYPES } from "@revolt/state";
import {
  Button,
  Checkbox,
  DateTimeField,
  Dialog,
  DialogProps,
  FloatingSelect,
  Form2,
  MenuItem,
  Segmented,
  SettingsChoices,
  SettingsFormPanel,
  SettingsRow,
  SettingsSection,
  TextField,
  Toggle,
} from "@revolt/ui";
import { hour12From, roundUp } from "@revolt/ui/components/design/dateTime";
import { Icon } from "@revolt/ui/icons/Icon";

import { DateMark } from "../../../src/interface/events/dateMark";
import {
  type CoverKind,
  COVER_KINDS,
  DrawnCover,
  coverFile,
} from "../../../src/interface/events/eventCovers";
import { eventDay } from "../../../src/interface/events/eventFormat";
import {
  DEFAULT_REMINDERS,
  MAX_REMINDERS,
  REMINDER_CHOICES,
  reminderSpan,
} from "../../../src/interface/events/eventLinks";
import {
  type EventTemplate,
  EVENT_TEMPLATES,
} from "../../../src/interface/events/eventTemplates";
import { MemberPicker } from "../../../src/interface/events/MemberPicker";
import { settled } from "../../../src/interface/events/settled";

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
  const { t, i18n } = useLingui();
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
  // a new event reminds a day and a quarter of an hour before
  const [reminders, setReminders] = createSignal<number[]>(
    existing ? (existing.reminders ?? []) : DEFAULT_REMINDERS,
  );
  const [readyCover, setReadyCover] = createSignal<CoverKind>();
  const [template, setTemplate] = createSignal("blank");
  // the words of the ready starts, in the person's language
  const templateText = (id: EventTemplate["id"]): [string, string] => {
    switch (id) {
      case "game-night":
        return [
          t`Game night`,
          t`We play together in voice. Bring a game you like, or join the one that is running.`,
        ];
      case "tournament":
        return [
          t`Tournament`,
          t`Sign up with Going to take a place. The rules and the brackets come before the start.`,
        ];
      case "watch-party":
        return [
          t`Watch party`,
          t`We watch together and talk about it in voice. Come a few minutes early.`,
        ];
      case "questions":
        return [
          t`Questions and answers`,
          t`Ask anything. Write your questions in the channel before the start.`,
        ];
      case "hangout":
        return [t`Voice hangout`, t`No plan. Drop in and talk.`];
    }
  };
  /** Fill the form from a ready start; the person changes what they like */
  function useTemplate(id: string) {
    setTemplate(id);
    const chosen = EVENT_TEMPLATES.find((entry) => entry.id === id);
    if (!chosen) return;
    const [title, description] = templateText(chosen.id);
    group.controls.title.setValue(title);
    group.controls.description.setValue(description);
    setKind(chosen.place);
    setRepeat(chosen.repeat ?? "None");
    setHasEnd(true);
    const from = start() ?? initialStart;
    setEnd(new Date(from.getTime() + chosen.hours * 60 * 60_000));
    setLimited(chosen.seats !== undefined);
    if (chosen.seats !== undefined) setSeats(String(chosen.seats));
  }
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
    (settled(clashes) ?? [])
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
        changes.reminders = reminders();
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
          reminders: reminders(),
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

  // the cover: an own picture (cropped to 16:9) or a ready one, never both
  let coverInput: HTMLInputElement | undefined;
  const coverCrop = cropProcess({
    ratio: 16 / 9,
    ratioLabel: t`Cover`,
    openModal,
    allowModeToggle: false,
    dialogTitle: t`Crop cover image`,
    maxWidth: 1920,
    outputType: "image/webp",
    outputQuality: 0.9,
  });
  const [coverTooBig, setCoverTooBig] = createSignal(false);
  const coverLimit = () =>
    instance.limits().file_upload_size_limits["banners"] as number | undefined;
  function pickCover() {
    coverInput?.click();
  }
  function onCoverPicked(event: Event & { currentTarget: HTMLInputElement }) {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    if (!files.length) return;
    if (!ALLOWED_IMAGE_TYPES.includes(files[0].type)) return;
    setCoverTooBig(false);
    coverCrop(
      files,
      (result) => {
        if (!result?.length) return;
        if (coverLimit() && result[0].size > coverLimit()!) {
          setCoverTooBig(true);
          return;
        }
        setReadyCover(undefined);
        group.controls.cover.setValue(result);
      },
      coverLimit(),
    );
  }
  function removeCover() {
    setReadyCover(undefined);
    group.controls.cover.setValue(null);
  }
  const ownCoverUrl = createMemo<string | undefined>((previous) => {
    if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
    const value = group.controls.cover.value;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length)
      return URL.createObjectURL(value[0]);
    return undefined;
  });
  onCleanup(() => {
    const url = ownCoverUrl();
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  });
  const hasCover = () => !!readyCover() || !!ownCoverUrl();

  // the row the event gets in the list, as it is typed
  const previewDay = () =>
    eventDay((start() ?? initialStart).toISOString(), i18n().locale ?? "en");
  const previewWhen = () =>
    new Intl.DateTimeFormat(i18n().locale ?? "en", {
      numberingSystem: "latn",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: hour12(),
    }).format(start() ?? initialStart);
  const previewPlace = () => {
    if (kind() === "External")
      return group.controls.location.value.trim() || t`Somewhere else`;
    const id = chosenChannel();
    const name = props.server.channels.find((entry) => entry.id === id)?.name;
    return name ?? (kind() === "Voice" ? t`Voice channel` : t`Text channel`);
  };

  return (
    <Dialog
      tone={existing ? "edit" : "create"}
      iconName="calendar"
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      size="lg"
      actionsAtEnd
      title={existing ? <Trans>Edit event</Trans> : <Trans>New event</Trans>}
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        ...(existing
          ? []
          : [
              {
                variant: "secondary" as const,
                text: (
                  <span data-testid="server-event-draft">
                    {/* short, so the three buttons share one row on a phone */}
                    <Trans context="event editor">Save draft</Trans>
                  </span>
                ),
                onClick: () => {
                  void onSubmit(true);
                  return false;
                },
                isDisabled: !Form2.canSubmit(group) || saving(),
              },
            ]),
        {
          text: (
            <span data-testid="server-event-publish">
              {existing ? (
                <Trans>Save</Trans>
              ) : (
                <Trans context="scheduled events">Publish</Trans>
              )}
            </span>
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
          {/* how it shows in the list, as it is typed */}
          <SettingsSection>
            <div aria-hidden="true" data-testid="server-event-preview">
              <SettingsRow
                icon={
                  <DateMark>
                    <b>{previewDay().day}</b>
                    <small>{previewDay().month}</small>
                  </DateMark>
                }
                title={
                  <PreviewTitle dir="auto">
                    {group.controls.title.value.trim() ||
                      t({ message: "Title", context: "scheduled events" })}
                  </PreviewTitle>
                }
                description={
                  <PreviewMeta>
                    <span>{previewWhen()}</span>
                    <span aria-hidden="true">·</span>
                    <bdi>{previewPlace()}</bdi>
                  </PreviewMeta>
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection title={<Trans>Details</Trans>}>
            <SettingsFormPanel>
              <Show when={!existing}>
                <FloatingSelect
                  id="server-event-template"
                  label={t`Start from`}
                  value={template()}
                  onChange={(event) => useTemplate(event.currentTarget.value)}
                >
                  <MenuItem value="blank">{t`An empty event`}</MenuItem>
                  <For each={EVENT_TEMPLATES}>
                    {(entry) => (
                      <MenuItem value={entry.id}>
                        {templateText(entry.id)[0]}
                      </MenuItem>
                    )}
                  </For>
                </FloatingSelect>
              </Show>
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
            </SettingsFormPanel>
          </SettingsSection>

          <SettingsSection title={<Trans context="event editor">Time</Trans>}>
            <SettingsFormPanel>
              <DateTimeField
                label={t`Starts`}
                value={start()}
                min={existing?.status === "Active" ? undefined : new Date()}
                hour12={hour12()}
                testId="server-event-start"
                onChange={(value) => {
                  // keep the length when the start moves
                  const length =
                    start() && end()
                      ? end()!.getTime() - start()!.getTime()
                      : 0;
                  setStart(value);
                  if (length > 0) setEnd(new Date(value.getTime() + length));
                }}
              />
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
              <FloatingSelect
                id="server-event-repeat"
                label={t({ message: "Repeat", context: "scheduled events" })}
                value={repeat()}
                onChange={(event) =>
                  setRepeat(event.currentTarget.value as Repeat)
                }
              >
                <MenuItem value="None">{t`Does not repeat`}</MenuItem>
                <MenuItem value="Daily">{t`Every day`}</MenuItem>
                <MenuItem value="Weekly">{t`Every week`}</MenuItem>
                <MenuItem value="EveryTwoWeeks">{t`Every 2 weeks`}</MenuItem>
                <MenuItem value="Monthly">{t`Every month`}</MenuItem>
              </FloatingSelect>
            </SettingsFormPanel>
            <SettingsRow
              title={<Trans>Set an end time</Trans>}
              description={
                hasEnd() ? undefined : (
                  <Trans>
                    Without an end time it ends 12 hours after it starts, or
                    when a manager ends it.
                  </Trans>
                )
              }
              onClick={() => setHasEnd(!hasEnd())}
              control={(ids) => (
                <Toggle
                  id="server-event-has-end"
                  aria-labelledby={ids.labelId}
                  checked={hasEnd()}
                  onChange={setHasEnd}
                />
              )}
            />
          </SettingsSection>

          <SettingsSection
            title={<Trans context="scheduled events">Where</Trans>}
          >
            <SettingsFormPanel>
              <Segmented<PlaceKind>
                aria-label={t({
                  message: "Where",
                  context: "scheduled events",
                })}
                value={kind()}
                onChange={setKind}
                options={[
                  { value: "Voice", label: t`Voice channel` },
                  { value: "Text", label: t`Text channel` },
                  { value: "External", label: t`Somewhere else` },
                ]}
              />
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
                    label={
                      kind() === "Voice" ? t`Voice channel` : t`Text channel`
                    }
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
                      <Trans>
                        This server has no voice channel you can see.
                      </Trans>
                    ) : (
                      <Trans>
                        This server has no text channel you can see.
                      </Trans>
                    )}
                  </Hint>
                </Match>
              </Switch>
              <Show when={settled(clashes)?.length}>
                <Warning role="status" data-testid="server-event-clash">
                  <Icon name="warning" size={16} />
                  <span>
                    <Trans>
                      At this time there is another event: {clashNames()}.
                    </Trans>
                  </span>
                </Warning>
              </Show>
            </SettingsFormPanel>
          </SettingsSection>

          <SettingsSection
            title={<Trans>Cover</Trans>}
            description={
              <Trans>
                Upload a picture of your own; it is cropped to 16:9. The ready
                covers are there if you have none.
              </Trans>
            }
          >
            <SettingsFormPanel>
              <input
                ref={coverInput}
                type="file"
                hidden
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                onChange={onCoverPicked}
                data-testid="server-event-cover-file"
              />
              <CoverPreview
                type="button"
                onClick={pickCover}
                data-empty={!hasCover() || undefined}
                aria-label={
                  hasCover() ? t`Change the cover` : t`Upload a cover picture`
                }
                data-testid="server-event-cover-preview"
              >
                <Switch
                  fallback={
                    <CoverEmpty>
                      <Icon name="image" size={28} />
                      <span>
                        <Trans>No cover yet</Trans>
                      </span>
                    </CoverEmpty>
                  }
                >
                  <Match when={readyCover()}>
                    {(chosen) => <DrawnCover kind={chosen()} />}
                  </Match>
                  <Match when={ownCoverUrl()}>
                    {(url) => (
                      <img
                        src={url()}
                        alt=""
                        data-testid="server-event-cover-own"
                      />
                    )}
                  </Match>
                </Switch>
              </CoverPreview>
              <CoverActions>
                <Button
                  size="sm"
                  variant="tonal"
                  onPress={pickCover}
                  data-testid="server-event-cover-upload"
                >
                  <Icon name="upload-simple" size={16} />
                  {ownCoverUrl() && !readyCover() ? (
                    <Trans>Change picture</Trans>
                  ) : (
                    <Trans>Upload a picture</Trans>
                  )}
                </Button>
                <Show when={hasCover()}>
                  <Button
                    size="sm"
                    variant="text"
                    onPress={removeCover}
                    data-testid="server-event-cover-remove"
                  >
                    <Trans>Remove</Trans>
                  </Button>
                </Show>
              </CoverActions>
              <Show when={coverTooBig()}>
                <Hint role="alert">
                  <Trans>
                    This picture is too large. Choose a smaller one.
                  </Trans>
                </Hint>
              </Show>
              <ReadyLabel id="server-event-ready-covers">
                <Trans>Or a ready cover</Trans>
              </ReadyLabel>
              <Covers
                role="radiogroup"
                aria-labelledby="server-event-ready-covers"
              >
                <For each={COVER_KINDS}>
                  {(coverKind, index) => (
                    <CoverChoice
                      type="button"
                      role="radio"
                      aria-checked={readyCover() === coverKind}
                      aria-label={t`Ready cover ${index() + 1}`}
                      onClick={() => {
                        if (readyCover() === coverKind)
                          return setReadyCover(undefined);
                        setReadyCover(coverKind);
                        group.controls.cover.setValue(null);
                      }}
                      data-testid={`server-event-cover-${coverKind}`}
                    >
                      <DrawnCover kind={coverKind} />
                    </CoverChoice>
                  )}
                </For>
              </Covers>
            </SettingsFormPanel>
          </SettingsSection>

          {/* the choices carry the title "Who sees it" themselves */}
          <SettingsSection>
            <SettingsFormPanel>
              <Show
                when={!invitedOnly}
                fallback={
                  <Hint>
                    <Trans>Only the invited people see this event.</Trans>
                  </Hint>
                }
              >
                <SettingsChoices<Visibility>
                  label={<Trans>Who sees it</Trans>}
                  value={visibility()}
                  onChange={setVisibility}
                  options={[
                    {
                      value: "Place",
                      title: <Trans>Everyone who sees its place</Trans>,
                      description: (
                        <Trans>Members who can open the channel.</Trans>
                      ),
                    },
                    {
                      value: "Roles",
                      title: <Trans>Some roles</Trans>,
                      description: (
                        <Trans>The roles you choose, and the organisers.</Trans>
                      ),
                    },
                    {
                      value: "Invited",
                      title: <Trans>Invited only</Trans>,
                      description: (
                        <Trans>
                          Only they and the organisers see this event. Nobody
                          else learns that it exists.
                        </Trans>
                      ),
                    },
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
                <MenuItem value="Everyone">
                  {t`Everyone who sees the event`}
                </MenuItem>
              </FloatingSelect>
            </SettingsFormPanel>
          </SettingsSection>

          <SettingsSection
            title={<Trans>Helpers</Trans>}
            description={
              <Trans>
                Helpers can change this event and manage who comes, without
                managing the server's other events.
              </Trans>
            }
          >
            <SettingsFormPanel>
              <MemberPicker
                server={props.server}
                label={t`Add a helper`}
                value={helpers()}
                onChange={setHelpers}
                max={MAX_HELPERS}
                exclude={[existing?.creator ?? client().user?.id ?? ""]}
                testId="server-event-helpers"
              />
            </SettingsFormPanel>
          </SettingsSection>

          <SettingsSection title={<Trans>Seats</Trans>}>
            <SettingsRow
              title={<Trans>Seat limit</Trans>}
              description={
                <Trans>After it, people join a waiting list in order.</Trans>
              }
              onClick={() => setLimited(!limited())}
              control={(ids) => (
                <Toggle
                  id="server-event-limited"
                  aria-labelledby={ids.labelId}
                  checked={limited()}
                  onChange={setLimited}
                />
              )}
            />
            <Show when={limited()}>
              <SettingsFormPanel>
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
              </SettingsFormPanel>
              <SettingsRow
                title={<Trans>Waiting list</Trans>}
                onClick={() => setWaitlist(!waitlist())}
                control={(ids) => (
                  <Toggle
                    id="server-event-waitlist"
                    aria-labelledby={ids.labelId}
                    checked={waitlist()}
                    onChange={setWaitlist}
                  />
                )}
              />
            </Show>
          </SettingsSection>

          <SettingsSection
            title={<Trans>Remind the people who are coming</Trans>}
            description={
              <Trans>
                Up to 3. Each person can switch reminders off for themselves.
              </Trans>
            }
          >
            <SettingsFormPanel data-testid="server-event-reminders">
              <For each={REMINDER_CHOICES}>
                {(minutes) => (
                  <Checkbox
                    checked={reminders().includes(minutes)}
                    disabled={
                      !reminders().includes(minutes) &&
                      reminders().length >= MAX_REMINDERS
                    }
                    onChange={(event) =>
                      setReminders(
                        event.currentTarget.checked
                          ? [...reminders(), minutes]
                          : reminders().filter((value) => value !== minutes),
                      )
                    }
                  >
                    <Trans>
                      {reminderSpan(minutes, i18n().locale ?? "en")} before
                    </Trans>
                  </Checkbox>
                )}
              </For>
            </SettingsFormPanel>
          </SettingsSection>

          <Show when={problem()}>
            <Failure role="alert" data-testid="server-event-problem">
              <Icon name="warning-circle" size={18} />
              <span>{problemText(problem())}</span>
            </Failure>
          </Show>
          <Show when={error()}>
            <Failure role="alert" data-testid="server-event-error">
              <Icon name="warning-circle" size={18} />
              <span>
                <TranslatedError error={error()} />
              </span>
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
    gap: "24px",
    // every label, helper and counter starts on the reading side
    textAlign: "start",
  },
});

const PreviewTitle = styled("span", {
  base: {
    display: "block",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const PreviewMeta = styled("span", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0 8px",
    "& > span[aria-hidden]": { color: "var(--z-fg-muted)" },
  },
});

const Warning = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "var(--z-status-warning)",
  },
});

/** The chosen cover, as wide as the form, 16:9 */
const CoverPreview = styled("button", {
  base: {
    all: "unset",
    boxSizing: "border-box",
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "100%",
    aspectRatio: "16 / 9",
    maxHeight: "220px",
    borderRadius: "var(--z-radius, 10px)",
    overflow: "hidden",
    cursor: "pointer",
    background: "var(--z-bg-input)",
    "& > img, & > div": {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },
    "&[data-empty]": {
      border:
        "1px dashed color-mix(in srgb, var(--z-fg-primary) 22%, transparent)",
    },
    "&:hover[data-empty]": {
      borderColor: "color-mix(in srgb, var(--z-fg-primary) 40%, transparent)",
    },
    "&:focus-visible": {
      outline: "2px solid var(--z-focus)",
      outlineOffset: "2px",
    },
  },
});

const CoverEmpty = styled("span", {
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "var(--z-fg-muted)",
    "--z-icon-color": "currentColor",
  },
});

const CoverActions = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
});

const ReadyLabel = styled("div", {
  base: {
    marginBlockStart: "4px",
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const Covers = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "8px",
    marginBlockStart: "-8px",
  },
});

const CoverChoice = styled("button", {
  base: {
    aspectRatio: "16 / 9",
    // the phones' 44 px minimum made each 16:9 picture 78 px wide, and five
    // of them ran out of the box; the unseen tap area keeps the 44 px
    minWidth: "0 !important",
    minHeight: "0 !important",
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
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "12px",
    borderRadius: "var(--z-box-radius)",
    background: "var(--z-box-bg)",
    color: "var(--z-fg-primary)",
    fontSize: "13px",
    lineHeight: "18px",
    border: "var(--z-box-border)",
    "--z-icon-color": "var(--z-danger)",
  },
});
