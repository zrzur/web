import { For, Match, Show, Switch, createMemo } from "solid-js";

import { useLingui } from "@lingui/solid/macro";
import type { Server } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import {
  Button,
  FloatingSelect,
  MenuItem,
  SettingsRow,
  TextField,
  Toggle,
} from "@revolt/ui";

import type { Field } from "./api";
import { useAssistantWords } from "./labels";

type Choice = { id: string; name: string };

export function textChannels(server: Server): Choice[] {
  return server.channels
    .filter((channel) => channel.type === "TextChannel")
    .map((channel) => ({ id: channel.id, name: channel.name ?? channel.id }));
}

export function serverRoles(server: Server): Choice[] {
  return server.orderedRoles.map((role) => ({ id: role.id, name: role.name }));
}

/** One channel or role from a list, or none */
export function PickOne(props: {
  label: string;
  value?: string | null;
  choices: Choice[];
  onChange: (value: string | null) => void;
}) {
  const { t } = useLingui();
  return (
    <FloatingSelect
      label={props.label}
      value={props.value ?? ""}
      onChange={(e) => props.onChange(e.currentTarget.value || null)}
    >
      <MenuItem value="">{t`None`}</MenuItem>
      <For each={props.choices}>
        {(choice) => <MenuItem value={choice.id}>{choice.name}</MenuItem>}
      </For>
    </FloatingSelect>
  );
}

/** Several channels or roles: chips to remove, a menu to add */
export function PickMany(props: {
  label: string;
  value: string[];
  choices: Choice[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useLingui();
  const nameOf = (id: string) =>
    props.choices.find((choice) => choice.id === id)?.name ?? id;
  const left = createMemo(() =>
    props.choices.filter((choice) => !props.value.includes(choice.id)),
  );
  return (
    <Many>
      <FloatingSelect
        label={props.label}
        value=""
        onChange={(e) => {
          const id = e.currentTarget.value;
          if (id) props.onChange([...props.value, id]);
        }}
      >
        <MenuItem value="">{t`Add…`}</MenuItem>
        <For each={left()}>
          {(choice) => <MenuItem value={choice.id}>{choice.name}</MenuItem>}
        </For>
      </FloatingSelect>
      <Show when={props.value.length}>
        <Chips>
          <For each={props.value}>
            {(id) => (
              <Button
                size="sm"
                variant="tonal"
                aria-label={t`Remove ${nameOf(id)}`}
                onPress={() =>
                  props.onChange(props.value.filter((item) => item !== id))
                }
              >
                {nameOf(id)} ×
              </Button>
            )}
          </For>
        </Chips>
      </Show>
    </Many>
  );
}

/** One setting of a module, saved as soon as it changes */
export function FieldControl(props: {
  module: string;
  field: Field;
  value: unknown;
  server: Server;
  onChange: (value: unknown) => void;
}) {
  const words = useAssistantWords();
  const id = () => `${props.module}.${props.field.key}`;
  const label = () => words.fields[id()] ?? props.field.key;
  const choiceName = (option: string | number) =>
    words.options[`${id()}.${option}`] ?? String(option);

  return (
    <Switch>
      <Match when={props.field.type === "bool"}>
        <SettingsRow
          title={label()}
          control={() => (
            <Toggle
              checked={!!props.value}
              aria-label={label()}
              onChange={(checked) => props.onChange(checked)}
            />
          )}
        />
      </Match>
      <Match when={props.field.type === "int" && props.field.options}>
        <FloatingSelect
          label={label()}
          value={String(props.value)}
          onChange={(e) => props.onChange(Number(e.currentTarget.value))}
        >
          <For each={props.field.options}>
            {(option) => <MenuItem value={String(option)}>{option}</MenuItem>}
          </For>
        </FloatingSelect>
      </Match>
      <Match when={props.field.type === "int"}>
        <TextField
          label={label()}
          type="number"
          min={props.field.min}
          max={props.field.max}
          value={String(props.value ?? "")}
          onChange={(e) => {
            const value = Number(e.currentTarget.value);
            if (Number.isInteger(value)) props.onChange(value);
          }}
        />
      </Match>
      <Match when={props.field.type === "enum"}>
        <FloatingSelect
          label={label()}
          value={String(props.value)}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        >
          <For each={props.field.options}>
            {(option) => (
              <MenuItem value={String(option)}>{choiceName(option)}</MenuItem>
            )}
          </For>
        </FloatingSelect>
      </Match>
      <Match when={props.field.type === "channel"}>
        <PickOne
          label={label()}
          value={props.value as string | null}
          choices={textChannels(props.server)}
          onChange={props.onChange}
        />
      </Match>
      <Match when={props.field.type === "role"}>
        <PickOne
          label={label()}
          value={props.value as string | null}
          choices={serverRoles(props.server)}
          onChange={props.onChange}
        />
      </Match>
      <Match when={props.field.type === "channels"}>
        <PickMany
          label={label()}
          value={(props.value as string[]) ?? []}
          choices={textChannels(props.server)}
          onChange={props.onChange}
        />
      </Match>
      <Match when={props.field.type === "roles"}>
        <PickMany
          label={label()}
          value={(props.value as string[]) ?? []}
          choices={serverRoles(props.server)}
          onChange={props.onChange}
        />
      </Match>
      <Match when={props.field.type === "list" && props.field.options}>
        <PickMany
          label={label()}
          value={(props.value as string[]) ?? []}
          choices={(props.field.options ?? []).map((option) => ({
            id: String(option),
            name: choiceName(option),
          }))}
          onChange={props.onChange}
        />
      </Match>
      <Match when={props.field.type === "list"}>
        <TextField
          label={label()}
          rows={3}
          value={((props.value as string[]) ?? []).join("\n")}
          onChange={(e) =>
            props.onChange(
              e.currentTarget.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        />
      </Match>
      <Match when={props.field.type === "text"}>
        <TextField
          label={label()}
          value={String(props.value ?? "")}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
    </Switch>
  );
}

const Many = styled("div", {
  base: { display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 },
});

const Chips = styled("div", {
  base: { display: "flex", flexWrap: "wrap", gap: "8px", minWidth: 0 },
});
