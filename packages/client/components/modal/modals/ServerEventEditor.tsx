import { createFormControl, createFormGroup } from "solid-forms";
import { For, Match, Show, Switch, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { type API, File as StoatFile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { timeLocale } from "@revolt/i18n";
import { TranslatedError } from "@revolt/i18n/errors";
import { useInstance } from "@revolt/instance";
import { useNavigate } from "@revolt/routing";
import {
  DateTimeField,
  Dialog,
  DialogProps,
  FloatingSelect,
  Form2,
  MenuItem,
  Segmented,
  Toggle,
} from "@revolt/ui";
import { hour12From, roundUp } from "@revolt/ui/components/design/dateTime";

import { useModals } from "..";
import { Modals } from "../types";

import { cropProcess } from "./CropProcess";

type PlaceKind = API.ServerEventPlace["type"];
type Repeat = API.ServerEventRepeat | "None";

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
    }
  };

  // one press, one event: further presses (and Enter) wait for the answer
  const [saving, setSaving] = createSignal(false);

  async function onSubmit() {
    if (saving()) return;
    setSaving(true);
    try {
      await save();
    } finally {
      setSaving(false);
    }
  }

  async function save() {
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
    setProblem(undefined);

    try {
      let cover: string | undefined;
      const coverValue = group.controls.cover.value;
      if (Array.isArray(coverValue) && coverValue.length) {
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
        });
        props.onClose();
        navigate(`/server/${props.server.id}/events/${created._id}`);
      }
    } catch (failure) {
      setError(failure);
    }
  }

  const submit = Form2.useSubmitHandler(group, onSubmit);

  return (
    <Dialog
      tone={existing ? "edit" : "create"}
      iconName="calendar"
      appearance="creation"
      showClose={false}
      show={props.show}
      onClose={props.onClose}
      size="md"
      title={
        existing ? <Trans>Edit event</Trans> : <Trans>Schedule an event</Trans>
      }
      actions={[
        { variant: "text", text: <Trans>Cancel</Trans> },
        {
          text: existing ? <Trans>Save</Trans> : <Trans>Schedule</Trans>,
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

          <FloatingSelect
            id="server-event-repeat"
            label={t({ message: "Repeat", context: "scheduled events" })}
            value={repeat()}
            onChange={(event) => setRepeat(event.currentTarget.value as Repeat)}
          >
            <MenuItem value="None">{t`Does not repeat`}</MenuItem>
            <MenuItem value="Weekly">{t`Every week`}</MenuItem>
            <MenuItem value="EveryTwoWeeks">{t`Every 2 weeks`}</MenuItem>
            <MenuItem value="Monthly">{t`Every month`}</MenuItem>
          </FloatingSelect>

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
