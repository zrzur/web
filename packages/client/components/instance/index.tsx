import { useLingui } from "@lingui/solid/macro";
import { useBeforeLeave, useNavigate, useParams } from "@solidjs/router";
import {
  createContext,
  createMemo,
  createSignal,
  JSXElement,
  Show,
  useContext,
} from "solid-js";
import { Dynamic } from "solid-js/web";

import { CONFIGURATION } from "@revolt/common";
import {
  AppConfig,
  assertAllowedServiceUrl,
  assertConnectionHostAllowed,
  normalizeHost,
  STOAT_HOST,
  ZRZUR_OFFICIAL_HOSTS,
} from "@revolt/common/lib/env";
import { useError } from "@revolt/i18n";
import { LoadingScreen, useSnackbar } from "@revolt/ui";

import Instance, { _newClient } from "./Instance";

/** Comparison origin only — never used as a connection default. */
export const StoatOrigin = new URL(`https://${STOAT_HOST}`).origin;
export const DefaultURL = new URL(`https://${CONFIGURATION.DEFAULT_HOST}`);
export const DefaultHost = DefaultURL.host;
const DefRoute = `/i/${DefaultHost}/`;

const instanceContext = createContext<Instance>();

/**
 * "Too many requests": how long to wait in milliseconds, whatever shape the
 * error arrives in (an object, the raw response text, or an Error with it)
 */
function retryAfterOf(error: unknown): number | undefined {
  let value: unknown = error;
  try {
    if (typeof value === "string") value = JSON.parse(value);
    else if (value instanceof Error) value = JSON.parse(value.message);
  } catch {
    // not JSON: not a rate limit answer
  }
  const ms = Number(
    (value as { retry_after?: unknown } | undefined)?.retry_after,
  );
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
}
let appLoadedOnce = false;

export function InstanceContext(props: { children?: JSXElement }) {
  const params = useParams();
  const snackbar = useSnackbar();
  const nav = useNavigate();
  const { t } = useLingui();
  const describeError = useError();

  const [inst, setInst] = createSignal<Instance>();

  // Normalized only to recognise legacy upstream hosts; never connect via a normalized upstream host.
  const host = normalizeHost(params.host);

  function onError(e: unknown) {
    console.error(e);
    const hStr = `'${host || DefaultHost}'`;
    snackbar.show({
      // plain words for API errors (e.g. rate limits), never raw JSON
      message:
        (e as Error).message === "Failed to fetch"
          ? t`Couldn't fetch Zrzur configuration from ${hStr}.`
          : retryAfterOf(e)
            ? describeError({ retry_after: retryAfterOf(e) })
            : describeError(e),
      placement: "bottom",
      closeable: true,
      autoCloseDelay: 30000,
    });
    if (appLoadedOnce) nav(-1);
  }

  (async () => {
    try {
      // Reject prohibited upstream hosts before any discovery / redirect.
      if (params.host) {
        assertConnectionHostAllowed(params.host, "instance host");
      }

      //Redirect default instance
      //TODO This redirects ALL instance paths to default until multi-instance is ready
      // Replace with `if (host === DefaultHost)` when ready
      if (host) return nav(Instance.relPath(), { replace: true });

      const appCfg: AppConfig = host
        ? await (await fetch(`https://${host}/.well-known/stoat`)).json()
        : { api: CONFIGURATION.DEFAULT_API_URL };

      // Protocol path `.well-known/stoat` is compatibility-critical; still validate api URL.
      assertAllowedServiceUrl(appCfg.api, "instance discovery api");

      const cli = _newClient(appCfg.api);
      // too many requests: wait as long as the server asks, then try again,
      // instead of leaving the loading screen up for good
      for (let attempt = 0; ; attempt++) {
        try {
          await cli.initConfig();
          break;
        } catch (error) {
          const retryAfter = retryAfterOf(error);
          if (!retryAfter || attempt >= 4) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(retryAfter + 250, 30000)),
          );
        }
      }
      setInst(new Instance(appCfg, cli, host, nav));
    } catch (e) {
      onError(e);
    }
    appLoadedOnce = true;
  })();

  //Finish init in reactive scope
  const instInit = createMemo(() => {
    const i = inst();
    if (i) i._init();
    return i;
  });

  return (
    <Show
      when={instInit()}
      fallback={
        <LoadingScreen
          isOfficial={ZRZUR_OFFICIAL_HOSTS.includes(host || DefaultHost)}
        />
      }
    >
      <Dynamic component={instanceContext.Provider} value={instInit()}>
        <Redirect />
        {props.children}
      </Dynamic>
    </Show>
  );
}

const DEF_MARK = "_defInst";

function Redirect() {
  const inst = useInstance(),
    nav = useNavigate();

  useBeforeLeave((e) => {
    if (typeof e.to !== "string") return;

    if ((e.to + "/").startsWith(DefRoute)) {
      //Redirect default instance
      e.preventDefault();
      nav(Instance.relPath(e.to), { state: DEF_MARK });
    } else if (
      inst.host &&
      !e.to.startsWith("/i/") &&
      e.options?.state !== DEF_MARK
    ) {
      //Redirect relative path to instance path
      e.preventDefault();
      nav(inst.href(e.to, true));
    }
  });

  return <></>;
}

export const useInstance = () => useContext(instanceContext)!;
