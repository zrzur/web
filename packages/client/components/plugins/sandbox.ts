/**
 * Isolated runtime for plugin code.
 *
 * Layers (each one alone is not enough; together they are the boundary):
 *
 * 1. A hidden `<iframe sandbox="allow-scripts" srcdoc=...>` without
 *    `allow-same-origin`: an opaque origin with no access to Zrzur's
 *    DOM, cookies, localStorage, IndexedDB or service worker, and none of
 *    Electron's preload (`window.native` exists only in the main frame).
 * 2. A strict CSP inside it: no network (`connect-src 'none'`), no eval,
 *    no images/styles/fonts/frames, scripts only from our nonce and blob:.
 * 3. The plugin runs in a dedicated Worker the frame creates, so an
 *    infinite loop never blocks the chat UI; the host kills the frame (and
 *    with it the worker) when a heartbeat is missed.
 * 4. One MessagePort is the only channel to the host. Every message is a
 *    JSON string, size- and rate-limited, and every call is checked
 *    against the granted permissions by the host, never by the sandbox.
 *
 * Not enforceable from a web page (documented in PLUGINS-SECURITY-AUDIT):
 * a hard memory cap, and the cost of deserialising one oversized message
 * before it is rejected.
 */

export const SANDBOX_LIMITS = {
  /** largest message either side accepts (characters of JSON) */
  messageChars: 64 * 1024,
  /** messages per second from the plugin before it is stopped */
  messagesPerSecond: 60,
  /** time a plugin has to answer a heartbeat */
  heartbeatTimeoutMs: 2_500,
  heartbeatIntervalMs: 5_000,
  /** time a plugin has to finish booting */
  bootTimeoutMs: 5_000,
  /** time a plugin has to answer an invocation */
  invokeTimeoutMs: 3_000,
} as const;

export type SandboxCall = { id: number; method: string; args: unknown[] };

export type SandboxEvents = {
  /** the plugin called an SDK method; resolve with its result */
  onCall(call: SandboxCall): Promise<unknown>;
  /** the plugin is dead (crash, flood, timeout, bad message) */
  onFailure(reason: string): void;
  onLog?(level: "log" | "warn" | "error", text: string): void;
};

function nonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "");
}

/** Content-Security-Policy of the sandbox document (and its blob worker) */
export function sandboxCsp(n: string) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${n}' blob:`,
    "worker-src blob:",
    "child-src blob:",
    "connect-src 'none'",
    "img-src 'none'",
    "style-src 'none'",
    "font-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join("; ");
}

/**
 * The frame's only job: receive the worker source and a MessagePort from
 * its parent once, start the worker, hand it the port, and report worker
 * crashes. It never runs plugin code itself.
 */
export function sandboxDocument(n: string) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${sandboxCsp(n)}">
</head><body><script nonce="${n}">
(function () {
  "use strict";
  var started = false;
  addEventListener("message", function (event) {
    if (started || event.source !== parent) return;
    var data = event.data;
    if (!data || data.t !== "boot" || typeof data.source !== "string" || !event.ports[0]) return;
    started = true;
    var url = URL.createObjectURL(new Blob([data.source], { type: "text/javascript" }));
    var worker;
    try {
      worker = new Worker(url, { name: "zrzur-plugin" });
    } catch (e) {
      parent.postMessage({ t: "sandbox-error", reason: "worker_unavailable" }, "*");
      return;
    }
    URL.revokeObjectURL(url);
    worker.onerror = function (e) {
      e.preventDefault();
      parent.postMessage({ t: "sandbox-error", reason: "crash" }, "*");
    };
    worker.onmessageerror = function () {
      parent.postMessage({ t: "sandbox-error", reason: "bad_message" }, "*");
    };
    worker.postMessage({ t: "port" }, [event.ports[0]]);
  });
})();
</script></body></html>`;
}

/**
 * Bootstrap that runs inside the worker before the plugin. It removes
 * ambient APIs (defence in depth: the CSP already blocks the network),
 * waits for the port, then runs the plugin with only the `zrzur` SDK.
 * Size checks here are a courtesy; the host checks everything again.
 */
export function workerSource(code: string) {
  const plugin = `function __plugin(zrzur) {
    var self = undefined, globalThis = undefined, postMessage = undefined, onmessage = undefined;
${code}
  }`;
  return `"use strict";
(function () {
  // Plugin code must stay inside its function. Closing it early (to reach
  // the bootstrap's own variables) always leaves a shorter \`__plugin\`, so
  // the worker stops here, before any statement of that code can run.
  if (typeof __plugin !== "function" || Function.prototype.toString.call(__plugin).length !== ${plugin.length}) {
    throw new Error("plugin code left its function");
  }
  var LIMIT = ${SANDBOX_LIMITS.messageChars};
  var stringify = JSON.stringify, parse = JSON.parse;
  var scope = self;
  var deny = ["fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "EventSource",
    "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker",
    "WebTransport", "RTCPeerConnection", "FileSystemHandle"];
  for (var i = 0; i < deny.length; i++) {
    try { Object.defineProperty(scope, deny[i], { value: undefined, configurable: false, writable: false }); } catch (e) {}
  }
  try { delete scope.DedicatedWorkerGlobalScope.prototype.postMessage; } catch (e) {}

  var port = null, nextId = 1, pending = {}, handlers = { command: {}, message_action: {}, event: {}, panel_button: {} };
  var settingsListeners = [], deactivate = [];

  function send(message) {
    var text = stringify(message);
    if (text.length > LIMIT) throw new Error("message too large");
    port.postMessage(text);
  }
  function call(method, args) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      try { send({ t: "call", id: id, method: method, args: args }); }
      catch (e) { delete pending[id]; reject(e); }
    });
  }
  function on(kind) {
    return function (name, fn) {
      if (typeof name !== "string" || typeof fn !== "function") throw new TypeError("bad handler");
      handlers[kind][name] = fn;
      return call("register", [kind, name]);
    };
  }
  function text(value) { return String(value == null ? "" : value).slice(0, 2000); }

  var manifest = null;
  var zrzur = Object.freeze({
    get manifest() { return manifest; },
    get locale() { return manifest ? manifest.__locale : "en"; },
    commands: Object.freeze({ register: on("command") }),
    messageActions: Object.freeze({ register: on("message_action") }),
    events: Object.freeze({ on: on("event") }),
    notifications: Object.freeze({ show: function (message) { return call("notifications.show", [text(message)]); } }),
    composer: Object.freeze({ insert: function (value) { return call("composer.insert", [text(value)]); } }),
    ui: Object.freeze({
      showPanel: function (panel) { return call("ui.showPanel", [parse(stringify(panel))]); },
      onButton: on("panel_button"),
    }),
    settings: Object.freeze({
      get: function () { return call("settings.get", []); },
      set: function (key, value) { return call("settings.set", [text(key), value]); },
      onChange: function (fn) { if (typeof fn === "function") settingsListeners.push(fn); },
    }),
    storage: Object.freeze({
      get: function (key) { return call("storage.get", [text(key)]); },
      set: function (key, value) { return call("storage.set", [text(key), parse(stringify(value))]); },
    }),
    diagnostics: Object.freeze({ get: function () { return call("diagnostics.get", []); } }),
    log: function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(text(arguments[i]));
      call("log", [parts.join(" ").slice(0, 1000)]);
    },
    onDeactivate: function (fn) { if (typeof fn === "function") deactivate.push(fn); },
  });

  function reply(id, promise) {
    Promise.resolve().then(promise).then(
      function (value) { send({ t: "result", id: id, ok: true, value: value === undefined ? null : value }); },
      function (error) { send({ t: "result", id: id, ok: false, error: text(error && error.message || error) }); }
    );
  }

  function onHostMessage(event) {
    if (typeof event.data !== "string" || event.data.length > LIMIT) return;
    var m;
    try { m = parse(event.data); } catch (e) { return; }
    if (m.t === "ping") return send({ t: "pong", n: m.n });
    if (m.t === "result" && pending[m.id]) {
      var p = pending[m.id]; delete pending[m.id];
      return m.ok ? p.resolve(m.value) : p.reject(new Error(m.error));
    }
    if (m.t === "invoke") {
      var fn = handlers[m.kind] && handlers[m.kind][m.handler];
      return reply(m.id, function () {
        if (!fn) throw new Error("no handler");
        return fn(m.payload);
      });
    }
    if (m.t === "settings") {
      for (var i = 0; i < settingsListeners.length; i++) { try { settingsListeners[i](m.values); } catch (e) {} }
      return;
    }
    if (m.t === "deactivate") {
      var all = deactivate.map(function (fn) { return Promise.resolve().then(fn).catch(function () {}); });
      Promise.all(all).then(function () { send({ t: "deactivated" }); });
      return;
    }
    if (m.t === "init" && !manifest) {
      manifest = Object.freeze(Object.assign({}, m.manifest, { __locale: m.locale }));
      try {
        __plugin.call(undefined, zrzur);
        send({ t: "ready" });
      } catch (e) {
        send({ t: "crash", error: text(e && e.message || e) });
      }
    }
  }

  scope.addEventListener("unhandledrejection", function (e) {
    e.preventDefault();
    try { send({ t: "error", error: text(e.reason && e.reason.message || e.reason) }); } catch (x) {}
  });

  scope.onmessage = function (event) {
    if (port || !event.data || event.data.t !== "port" || !event.ports[0]) return;
    port = event.ports[0];
    scope.onmessage = null;
    port.onmessage = onHostMessage;
    send({ t: "booted" });
  };

  // Declared, not called: plugin code only runs after "init".
  ${plugin}
})();
`;
}

/** Live sandbox for one plugin */
export class PluginSandbox {
  private frame?: HTMLIFrameElement;
  private port?: MessagePort;
  private heartbeat?: ReturnType<typeof setInterval>;
  private pendingPing?: ReturnType<typeof setTimeout>;
  private bootTimer?: ReturnType<typeof setTimeout>;
  private invocations = new Map<
    number,
    {
      resolve(v: unknown): void;
      reject(e: Error): void;
      timer: ReturnType<typeof setTimeout>;
      started: number;
    }
  >();
  private nextInvoke = 1;
  private windowStart = 0;
  private windowCount = 0;
  private dead = false;
  private onWindowMessage = (event: MessageEvent) => {
    if (!this.frame || event.source !== this.frame.contentWindow) return;
    const data = event.data as { t?: string; reason?: string } | null;
    if (data?.t === "sandbox-error") this.fail(data.reason ?? "crash");
  };
  lastLatencyMs?: number;

  constructor(private events: SandboxEvents) {}

  /** Start the plugin; resolves once its top-level code ran */
  start(
    code: string,
    init: { manifest: unknown; locale: string },
  ): Promise<number> {
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const n = nonce();
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("referrerpolicy", "no-referrer");
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("data-zrzur-plugin-sandbox", "");
      frame.tabIndex = -1;
      frame.title = "plugin sandbox";
      Object.assign(frame.style, {
        position: "fixed",
        width: "0",
        height: "0",
        border: "0",
        visibility: "hidden",
        pointerEvents: "none",
      });
      frame.srcdoc = sandboxDocument(n);
      this.frame = frame;

      const channel = new MessageChannel();
      this.port = channel.port1;
      let ready = false;
      // a plugin that dies while booting must still settle start()
      this.rejectBoot = (reason) => {
        if (!ready) reject(new Error(reason));
      };

      this.bootTimer = setTimeout(() => {
        if (!ready) {
          this.fail("boot_timeout");
          reject(new Error("boot_timeout"));
        }
      }, SANDBOX_LIMITS.bootTimeoutMs);

      channel.port1.onmessage = (event) => {
        const message = this.accept(event.data);
        if (!message) return;
        switch (message.t) {
          case "booted":
            this.post({
              t: "init",
              manifest: init.manifest,
              locale: init.locale,
            });
            break;
          case "ready":
            ready = true;
            clearTimeout(this.bootTimer);
            this.startHeartbeat();
            resolve(performance.now() - started);
            break;
          case "crash":
            this.fail("crash", String(message.error ?? ""));
            reject(new Error(String(message.error ?? "crash")));
            break;
          case "error":
            this.events.onLog?.(
              "error",
              String(message.error ?? "").slice(0, 500),
            );
            break;
          case "pong":
            clearTimeout(this.pendingPing);
            this.pendingPing = undefined;
            break;
          case "call":
            this.handleCall(message);
            break;
          case "result":
            this.handleResult(message);
            break;
          case "deactivated":
            break;
          default:
            this.fail("bad_message");
        }
      };

      window.addEventListener("message", this.onWindowMessage);
      frame.addEventListener("load", () => {
        frame.contentWindow?.postMessage(
          { t: "boot", source: workerSource(code) },
          "*",
          [channel.port2],
        );
      });
      document.body.appendChild(frame);
    });
  }

  /** Parse and police one message from the plugin */
  private accept(data: unknown): Record<string, unknown> | null {
    if (this.dead) return null;
    const now = performance.now();
    if (now - this.windowStart > 1000) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    if (++this.windowCount > SANDBOX_LIMITS.messagesPerSecond) {
      this.fail("flood");
      return null;
    }
    if (typeof data !== "string" || data.length > SANDBOX_LIMITS.messageChars) {
      this.fail(typeof data === "string" ? "oversized_message" : "bad_message");
      return null;
    }
    try {
      const parsed = JSON.parse(data);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      )
        throw 0;
      return parsed;
    } catch {
      this.fail("bad_message");
      return null;
    }
  }

  private post(message: unknown) {
    if (this.dead || !this.port) return;
    const text = JSON.stringify(message);
    if (text.length > SANDBOX_LIMITS.messageChars) return;
    this.port.postMessage(text);
  }

  private async handleCall(message: Record<string, unknown>) {
    const id = Number(message.id);
    const method = String(message.method ?? "");
    const args = Array.isArray(message.args) ? message.args : [];
    if (!Number.isSafeInteger(id)) return this.fail("bad_message");
    try {
      const value = await this.events.onCall({ id, method, args });
      this.post({ t: "result", id, ok: true, value: value ?? null });
    } catch (error) {
      this.post({
        t: "result",
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleResult(message: Record<string, unknown>) {
    const id = Number(message.id);
    const entry = this.invocations.get(id);
    if (!entry) return;
    this.invocations.delete(id);
    clearTimeout(entry.timer);
    this.lastLatencyMs = performance.now() - entry.started;
    if (message.ok) entry.resolve(message.value);
    else
      entry.reject(new Error(String(message.error ?? "failed").slice(0, 300)));
  }

  /** Ask the plugin to run one of its handlers */
  invoke(
    kind: "command" | "message_action" | "event" | "panel_button",
    handler: string,
    payload?: unknown,
  ) {
    return new Promise<unknown>((resolve, reject) => {
      if (this.dead) return reject(new Error("stopped"));
      const id = this.nextInvoke++;
      const timer = setTimeout(() => {
        this.invocations.delete(id);
        reject(new Error("timeout"));
      }, SANDBOX_LIMITS.invokeTimeoutMs);
      this.invocations.set(id, {
        resolve,
        reject,
        timer,
        started: performance.now(),
      });
      this.post({ t: "invoke", id, kind, handler, payload: payload ?? null });
    });
  }

  /** Push new settings to the plugin */
  settingsChanged(values: Record<string, unknown>) {
    this.post({ t: "settings", values });
  }

  private startHeartbeat() {
    let n = 0;
    this.heartbeat = setInterval(() => {
      if (this.pendingPing) return;
      this.post({ t: "ping", n: ++n });
      this.pendingPing = setTimeout(
        () => this.fail("unresponsive"),
        SANDBOX_LIMITS.heartbeatTimeoutMs,
      );
    }, SANDBOX_LIMITS.heartbeatIntervalMs);
  }

  private rejectBoot?: (reason: string) => void;

  private fail(reason: string, detail?: string) {
    if (this.dead) return;
    this.destroy();
    this.events.onFailure(
      detail ? `${reason}: ${detail.slice(0, 200)}` : reason,
    );
    this.rejectBoot?.(reason);
  }

  /** Ask for a clean shutdown, then remove the frame either way */
  async stop() {
    if (this.dead) return;
    this.post({ t: "deactivate" });
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.destroy();
  }

  /** Kill everything now; removing the frame terminates its worker */
  destroy() {
    this.dead = true;
    this.rejectBoot?.("stopped");
    clearInterval(this.heartbeat);
    clearTimeout(this.pendingPing);
    clearTimeout(this.bootTimer);
    for (const entry of this.invocations.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("stopped"));
    }
    this.invocations.clear();
    window.removeEventListener("message", this.onWindowMessage);
    if (this.port) {
      this.port.onmessage = null;
      this.port.close();
    }
    this.frame?.remove();
    this.frame = undefined;
    this.port = undefined;
  }

  get alive() {
    return !this.dead;
  }
}
