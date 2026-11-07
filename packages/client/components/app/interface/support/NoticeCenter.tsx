import { Trans, useLingui } from "@lingui/solid/macro";
import { type API, type WithoutNull, withoutNull } from "@zrzur/sdk/solid";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { useClient } from "@revolt/client";
import { Dialog, Text, useSnackbar } from "@revolt/ui";

/** How often to look again while the app is open */
const RECHECK_MS = 15 * 60 * 1000;

type Translated = Partial<Record<"ar" | "en" | "de", string>>;

type Notice = WithoutNull<API.NoticeView>;

/**
 * Messages from the Zrzur team (`/support/notices`). An important one
 * opens at once; others appear as a short message with a button to read
 * them. Reading and closing dismisses a notice for good. Failures are
 * silent: the notice waits for the next check.
 */
export function NoticeCenter() {
  const client = useClient();
  const snackbar = useSnackbar();
  const { t, i18n } = useLingui();
  const told = new Set<string>();
  const [open, setOpen] = createSignal<Notice | null>(null);

  const text = (value: Translated) =>
    value[(i18n().locale?.slice(0, 2) ?? "en") as keyof Translated] ||
    value.en ||
    "";

  const dismiss = async (notice: Notice) => {
    setOpen(null);
    try {
      await client()
        .api.post(`/support/notices/${encodeURIComponent(notice._id)}/dismiss`)
        .then(withoutNull);
    } catch {
      // shown again next time; nothing is lost
    }
  };

  const check = async () => {
    try {
      const notices = await client()
        .api.get("/support/notices")
        .then(withoutNull);
      const fresh = notices.filter((n) => !told.has(n._id));
      if (fresh.length === 0 || open()) return;
      const next = fresh.find((n) => n.tone === "important") ?? fresh[0];
      told.add(next._id);
      if (next.tone === "important") {
        setOpen(next);
        return;
      }
      snackbar.show({
        message: text(next.title),
        action: t`Read`,
        closeable: true,
        messageLine: 2,
        placement: "bottom",
        closeOnAction: true,
        onAction: () => setOpen(next),
      });
    } catch {
      // offline or signed out
    }
  };

  // messages from Zrzur are written in the language the app is used in
  createEffect(
    on(
      () => i18n().locale,
      (locale) => {
        if (!locale) return;
        // official accounts are named in the language of the app
        client().setLanguage(locale.split(/[-_]/)[0]);
        client()
          .api.put("/support/locale", { locale })
          .then(withoutNull)
          .catch(() => {
            // tried again next time the app starts
          });
      },
    ),
  );

  onMount(() => {
    void check();
    const timer = setInterval(() => void check(), RECHECK_MS);
    onCleanup(() => clearInterval(timer));
  });

  return (
    <Show when={open()}>
      {(notice) => (
        <Dialog
          show
          tone={notice().tone === "info" ? "info" : "warning"}
          onClose={() => setOpen(null)}
          title={text(notice().title)}
          description={<Trans>A message from the Zrzur team</Trans>}
          actions={[
            ...(notice().link && /^https:\/\//.test(notice().link!)
              ? [
                  {
                    text: <Trans>Learn more</Trans>,
                    variant: "secondary" as const,
                    onClick: () => {
                      window.open(
                        notice().link,
                        "_blank",
                        "noopener,noreferrer",
                      );
                      return false;
                    },
                  },
                ]
              : []),
            {
              text: <Trans>Got it</Trans>,
              onClick: () => void dismiss(notice()),
            },
          ]}
        >
          <Text class="body" size="medium">
            <span dir="auto" style={{ "white-space": "pre-wrap" }}>
              {text(notice().body)}
            </span>
          </Text>
        </Dialog>
      )}
    </Show>
  );
}
