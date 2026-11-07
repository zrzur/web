import { For, createSignal, onMount } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";

import {
  Checkbox,
  Column,
  Dialog,
  DialogProps,
  List,
  Row,
  Text,
  Time,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { policy as MdPolicy } from "@revolt/ui/icons/legacy";

import { useModals } from "..";
import { Modals } from "../types";

let shownForSession = false;

export function PolicyChangeModal(
  props: DialogProps & Modals & { type: "policy_change" },
) {
  const { showError } = useModals();
  const { i18n } = useLingui();
  const [confirm, setConfirm] = createSignal(false);

  /** The change in the reader's language (ar, en, de), else the default text */
  const message = (change: { description: string; translations?: Record<string, string> }) =>
    change.translations?.[i18n().locale?.slice(0, 2) ?? "en"] || change.description;

  // automatically close if we've already shown this modal in this session
  const allowDisplay = !shownForSession;
  shownForSession = true;
  onMount(() => !allowDisplay && props.onClose());

  return (
    <Dialog
      icon={<MdPolicy />}
      show={allowDisplay && props.show}
      onClose={props.onClose}
      title={<Trans>Review policy changes</Trans>}
      actions={[
        { text: <Trans>Close</Trans> },
        {
          text: <Trans>Acknowledge</Trans>,
          isDisabled: !confirm(),
          async onClick() {
            await props.acknowledge().catch(showError);
          },
        },
      ]}
    >
      <Trans>
        Click on the items below to learn more about different changes!
      </Trans>
      <List>
        <For each={props.changes}>
          {(change) => (
            <List.Item
              onClick={() =>
                // the URL comes from the server: never open javascript: etc.
                /^https?:\/\//i.test(change.url) &&
                window.open(change.url, "_blank", "noopener,noreferrer")
              }
            >
              <Row align>
                <Column gap="none" grow>
                  <Text class="title">
                    <span dir="auto">{message(change)}</span>
                  </Text>
                  <Text class="label">
                    <Trans>
                      Effective{" "}
                      <Time format="iso8601" value={change.effective_time} /> (
                      <Time format="relative" value={change.effective_time} />)
                    </Trans>
                  </Text>
                </Column>
                <Symbol>open_in_new</Symbol>
              </Row>
            </List.Item>
          )}
        </For>
      </List>
      <Checkbox
        checked={confirm()}
        onChange={() => setConfirm((checked) => !checked)}
      >
        <Trans>I've read and reviewed the changes.</Trans>
      </Checkbox>
    </Dialog>
  );
}
