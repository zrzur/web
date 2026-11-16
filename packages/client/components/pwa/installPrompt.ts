/**
 * Installing Zrzur on a phone or tablet.
 *
 * Android (Chrome, Edge, Samsung Internet): the browser tells the page it
 * can be installed ("beforeinstallprompt"); the page keeps that and shows
 * the browser's own install window when the person asks for it.
 * iPhone and iPad: no page can install itself; the person adds it from the
 * browser's Share menu, so we can only show the steps.
 *
 * This file is in the first download (index.tsx): the browser's event comes
 * once, early, and is lost if nobody listens. Keep it small.
 */
import { createSignal } from "solid-js";

/** Chrome's event; not in the TypeScript DOM library */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** How this device installs the app, if it can and has not yet */
export type InstallWay = "prompt" | "ios";

export interface InstallDevice {
  userAgent: string;
  maxTouchPoints: number;
  /** Already running as an installed app */
  standalone: boolean;
}

const [prompt, setPrompt] = createSignal<InstallPromptEvent>();
const [installedNow, setInstalledNow] = createSignal(false);

/** Apps that open pages in their own browser view: nothing can be added from there */
const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/i;

export function isIOS(
  device: Pick<InstallDevice, "userAgent" | "maxTouchPoints">,
) {
  return (
    /iphone|ipad|ipod/i.test(device.userAgent) ||
    // iPadOS says it is a Mac
    (/macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1)
  );
}

/**
 * The way to install on this device. Nothing on a computer (the desktop app
 * is the offer there), inside the installed app, or where it cannot be done.
 */
export function installWayFor(
  device: InstallDevice,
  hasPrompt: boolean,
): InstallWay | undefined {
  if (device.standalone) return undefined;
  if (isIOS(device))
    return IN_APP_BROWSER.test(device.userAgent) ? undefined : "ios";
  if (hasPrompt && /Mobi|Android/i.test(device.userAgent)) return "prompt";
  return undefined;
}

function standalone() {
  return (
    !!(navigator as unknown as { standalone?: boolean }).standalone ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

/** Reactive: how the app can be installed right now, if at all */
export function installWay(): InstallWay | undefined {
  if (installedNow()) return undefined;
  return installWayFor(
    {
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: standalone(),
    },
    !!prompt(),
  );
}

/**
 * Show the browser's install window. Resolves to whether the person
 * accepted; the browser allows one use of its event, so it is dropped.
 */
export async function askToInstall(): Promise<boolean> {
  const event = prompt();
  if (!event) return false;
  setPrompt(undefined);
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === "accepted";
}

/** Start listening; call once, as early as possible */
export function listenForInstall(target: Window = window) {
  target.addEventListener("beforeinstallprompt", (event) => {
    // no banner of the browser's own: ours comes at a better moment
    event.preventDefault();
    setPrompt(() => event as InstallPromptEvent);
  });
  target.addEventListener("appinstalled", () => {
    setPrompt(undefined);
    setInstalledNow(true);
  });
}
