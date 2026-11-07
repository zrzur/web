import { t } from "@lingui/core/macro";
import { detect } from "detect-browser";
import { Accessor, Setter, createMemo, createSignal } from "solid-js";

import { API, Client, ConnectionState, ProtocolV1 } from "@zrzur/sdk/solid";

import { ModalControllerExtended } from "@revolt/modal";
import type { State as ApplicationState } from "@revolt/state";
import type { Session } from "@revolt/state/stores/Auth";

import { forgetCreators } from "../common/lib/creatorCache";
import Instance from "../instance/Instance";
import { killServiceWorkerSubscription } from "./NotificationsController";
import { reconnectDelay } from "./reconnectDelay";

/** Tries of the first "does this account exist" question after the first */
const HELLO_RETRIES = 3;

export enum State {
  Ready = "Ready",
  LoggingIn = "Logging In",
  Onboarding = "Onboarding",
  AgeRequired = "Age Required",
  Error = "Error",
  Dispose = "Dispose",
  Connecting = "Connecting",
  Connected = "Connected",
  Disconnected = "Disconnected",
  Reconnecting = "Reconnecting",
  Offline = "Offline",
}

export enum TransitionType {
  LoginUncached = "uncached login",
  LoginCached = "cached login",
  SocketConnected = "socket connected",
  DeviceOffline = "device offline",
  DeviceOnline = "device online",
  PermanentFailure = "permanent failure",
  TemporaryFailure = "temporary failure",
  UserCreated = "user created",
  NoUser = "no user",
  AgeMissing = "age missing",
  AgeDeclared = "age declared",
  Cancel = "cancel",
  Dispose = "dispose",
  DisposeOnly = "dispose only",
  Dismiss = "dismiss",
  Ready = "ready",
  Retry = "retry",
  Logout = "logout",
}

export type Transition =
  | {
      type: TransitionType.LoginUncached | TransitionType.LoginCached;
      session: Session;
    }
  | {
      type: TransitionType.PermanentFailure;
      error: string;
    }
  | {
      type:
        | TransitionType.NoUser
        | TransitionType.UserCreated
        | TransitionType.AgeMissing
        | TransitionType.AgeDeclared
        | TransitionType.TemporaryFailure
        | TransitionType.SocketConnected
        | TransitionType.DeviceOffline
        | TransitionType.DeviceOnline
        | TransitionType.Cancel
        | TransitionType.Dismiss
        | TransitionType.Ready
        | TransitionType.Retry
        | TransitionType.Dispose
        | TransitionType.DisposeOnly
        | TransitionType.Logout;
    };

type PolicyAttentionRequired = [
  ProtocolV1["types"]["policyChange"][],
  () => Promise<void>,
];

class Lifecycle {
  #controller: ClientController;

  readonly state: Accessor<State>;
  #setStateSetter: Setter<State>;

  readonly loadedOnce: Accessor<boolean>;
  #setLoadedOnce: Setter<boolean>;

  readonly policyAttentionRequired: Accessor<
    undefined | PolicyAttentionRequired
  >;
  #policyAttentionRequired: Setter<undefined | PolicyAttentionRequired>;

  client: Client;

  #connectionFailures = 0;
  #permanentError: string | undefined;
  #retryTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(controller: ClientController) {
    this.#controller = controller;

    this.onState = this.onState.bind(this);
    this.onReady = this.onReady.bind(this);
    this.onPolicyChanges = this.onPolicyChanges.bind(this);

    const [state, setState] = createSignal(State.Ready);
    this.state = state;
    this.#setStateSetter = setState;

    const [loadedOnce, setLoadedOnce] = createSignal(false);
    this.loadedOnce = loadedOnce;
    this.#setLoadedOnce = setLoadedOnce;

    const [policyAttentionRequired, setPolicyAttentionRequired] = createSignal<
      undefined | PolicyAttentionRequired
    >(undefined);

    this.policyAttentionRequired = policyAttentionRequired;
    this.#policyAttentionRequired = setPolicyAttentionRequired;

    this.client = null!;
    this.dispose();

    // Nothing else reports the network coming back: without this the
    // Offline state never left until the page was reloaded.
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onOnline);
    }
  }

  private onOnline = () =>
    this.transition({ type: TransitionType.DeviceOnline });

  /**
   * Stop listening to the browser (the controller is being unmounted)
   */
  destroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onOnline);
    }
  }

  private dispose(logout = false) {
    // a failed request must not become an unhandled rejection
    if (logout) this.client.logout().catch(() => undefined);

    this.client = this.#controller.instance.newClient();

    this.client.options.channelIsMuted = (ch) =>
      this.#controller.state.notifications.isMuted(ch);

    this.client.options.channelExclusiveMuted = (ch) =>
      this.#controller.state.notifications.isChannelMuted(ch);

    this.client.events.on("state", this.onState);
    this.client.on("ready", this.onReady);
    this.client.on("policyChanges", this.onPolicyChanges);
  }

  /** Bumped on every state change, so a late answer is ignored */
  #helloToken = 0;
  /** Whether the server no longer knows the session */
  #sessionGone = false;
  /** Dispose without signing out on the server (a dismissed error) */
  #keepSession = false;

  /** Ask whether the account still has to be set up; retried with backoff */
  #hello(attempt: number) {
    const token = ++this.#helloToken;
    this.client.api.get("/onboard/hello").then(
      ({ onboarding }) => {
        if (token !== this.#helloToken) return;
        if (onboarding) {
          this.transition({ type: TransitionType.NoUser });
        } else {
          this.#connect();
        }
      },
      () => {
        if (token !== this.#helloToken) return;
        // Not asked yet: connecting blindly would be refused for a new
        // account (no user row yet) and drop a good session.
        if (attempt >= HELLO_RETRIES) {
          this.transition({
            type: TransitionType.PermanentFailure,
            error: "InternalError",
          });
          return;
        }
        this.#retryTimeout = setTimeout(
          () => {
            this.#retryTimeout = undefined;
            this.#hello(attempt + 1);
          },
          reconnectDelay(attempt + 1) * 1e3,
        );
      },
    );
  }

  /** Connect; a client that cannot (no gateway address yet) is a temporary failure */
  #connect() {
    try {
      this.client.connect();
    } catch {
      this.transition({ type: TransitionType.TemporaryFailure });
    }
  }

  #enter(nextState: State) {
    this.#helloToken++;
    if (nextState === State.Ready || nextState === State.LoggingIn) {
      this.#sessionGone = false;
    }
    if (import.meta.env.DEV) {
      console.info("[lifecycle] entering state", nextState);
    }

    this.#setStateSetter(nextState);

    // Clean up retry timer
    if (this.#retryTimeout) {
      clearTimeout(this.#retryTimeout);
      this.#retryTimeout = undefined;
    }

    switch (nextState) {
      case State.LoggingIn:
        this.#hello(0);
        break;
      case State.Connecting:
      case State.Reconnecting:
        this.#connect();
        break;
      case State.Connected:
        this.#controller.state.auth.markValid();
        this.#setLoadedOnce(true);
        this.#connectionFailures = 0;
        break;
      case State.Dispose:
        // an error dismissed with a session the server still knows must not
        // log it out
        this.dispose(!this.#keepSession);
        this.#keepSession = false;
        this.transition({
          type: TransitionType.Ready,
        });
        this.#setLoadedOnce(false);
        break;
      case State.Disconnected:
        this.#connectionFailures++;

        if (!navigator.onLine) {
          this.transition({
            type: TransitionType.DeviceOffline,
          });
        } else {
          const retryIn = reconnectDelay(this.#connectionFailures);

          console.info(
            "Will try to reconnect in",
            retryIn.toFixed(2),
            "seconds!",
          );

          this.#retryTimeout = setTimeout(() => {
            this.#retryTimeout = undefined;
            this.transition({
              type: TransitionType.Retry,
            });
          }, retryIn * 1e3);
        }
        break;
    }
  }

  transition(transition: Transition) {
    console.debug("Received transition", transition.type);

    if (transition.type === TransitionType.DisposeOnly) {
      this.dispose();
      return;
    }

    const currentState = this.state();
    switch (currentState) {
      case State.Ready:
        if (transition.type === TransitionType.LoginUncached) {
          this.client.useExistingSession({
            ...transition.session,
            user_id: transition.session.userId,
          });

          this.#enter(State.LoggingIn);
        } else if (transition.type === TransitionType.LoginCached) {
          this.client.useExistingSession({
            ...transition.session,
            user_id: transition.session.userId,
          });

          this.#enter(State.Connecting);
        }
        break;
      case State.LoggingIn:
        switch (transition.type) {
          case TransitionType.SocketConnected:
            this.#enter(State.Connected);
            break;
          case TransitionType.NoUser:
            this.#enter(State.Onboarding);
            break;
          case TransitionType.AgeMissing:
            this.#enter(State.AgeRequired);
            break;
          case TransitionType.PermanentFailure:
            this.#permanentError = transition.error;
            this.#enter(State.Error);
            break;
          case TransitionType.TemporaryFailure:
            this.#enter(State.Disconnected);
            break;
        }
        break;
      case State.Onboarding:
        if (transition.type === TransitionType.UserCreated) {
          this.#enter(State.Connecting);
        } else if (transition.type === TransitionType.Cancel) {
          this.#enter(State.Dispose);
        }
        break;
      // the server refuses everything until the account has a month and
      // year of birth: asked here, before anything else loads
      case State.AgeRequired:
        if (transition.type === TransitionType.AgeDeclared) {
          this.#enter(State.Connecting);
        } else if (
          transition.type === TransitionType.Cancel ||
          transition.type === TransitionType.Logout
        ) {
          this.#enter(State.Dispose);
        }
        break;
      case State.Error:
        if (transition.type === TransitionType.Dismiss) {
          this.#keepSession = !this.#sessionGone;
          this.#enter(State.Dispose);
        }
        break;
      case State.Dispose:
        if (transition.type === TransitionType.Ready) {
          this.#enter(State.Ready);
        }
        break;
      case State.Connecting:
        switch (transition.type) {
          case TransitionType.SocketConnected:
            this.#enter(State.Connected);
            break;
          case TransitionType.AgeMissing:
            this.#enter(State.AgeRequired);
            break;
          case TransitionType.TemporaryFailure:
            this.#enter(State.Disconnected);
            break;
          case TransitionType.PermanentFailure:
            this.#permanentError = transition.error;
            this.#enter(State.Error);
            break;
          case TransitionType.Logout:
            this.#enter(State.Dispose);
            break;
        }
        break;
      case State.Connected:
        switch (transition.type) {
          case TransitionType.TemporaryFailure:
            this.#enter(State.Disconnected);
            break;
          case TransitionType.Logout:
            this.#enter(State.Dispose);
            break;
        }
        break;
      case State.Disconnected:
        switch (transition.type) {
          case TransitionType.DeviceOffline:
            this.#enter(State.Offline);
            break;
          // the network is back: retry now instead of waiting out the backoff
          case TransitionType.DeviceOnline:
          case TransitionType.Retry:
            this.#enter(State.Reconnecting);
            break;
          case TransitionType.Logout:
            this.#enter(State.Dispose);
            break;
        }
        break;
      case State.Reconnecting:
        switch (transition.type) {
          case TransitionType.SocketConnected:
            this.#enter(State.Connected);
            break;
          case TransitionType.AgeMissing:
            this.#enter(State.AgeRequired);
            break;
          case TransitionType.TemporaryFailure:
            this.#enter(State.Disconnected);
            break;
          case TransitionType.PermanentFailure:
            // TODO: relay error
            this.#enter(State.Error);
            break;
          case TransitionType.Logout:
            this.#enter(State.Dispose);
            break;
        }
        break;
      case State.Offline:
        switch (transition.type) {
          case TransitionType.DeviceOnline:
            this.#enter(State.Reconnecting);
            break;
          case TransitionType.Retry:
            this.#enter(State.Reconnecting);
            break;
          case TransitionType.Logout:
            this.#enter(State.Dispose);
            break;
        }
        break;
    }

    if (currentState === this.state()) {
      console.error(
        "An unhandled transition occurred!",
        transition,
        "was received on",
        currentState,
      );
    }
  }

  private onReady() {
    const user = this.client.user;
    if (user) this.#controller.state.auth.setName(user.displayName);

    this.transition({
      type: TransitionType.SocketConnected,
    });
  }

  private onPolicyChanges(
    changes: ProtocolV1["types"]["policyChange"][],
    ack: () => Promise<void>,
  ) {
    this.#policyAttentionRequired([
      changes,
      () => ack().then(() => this.#policyAttentionRequired(undefined)),
    ]);
  }

  private onState(state: ConnectionState) {
    switch (state) {
      case ConnectionState.Disconnected:
        if (this.client.events.lastError) {
          if (this.client.events.lastError.type === "server") {
            const type = this.client.events.lastError.data.type as string;
            if (type === "InvalidSession") {
              this.#sessionGone = true;
              forgetCreators();
              this.#controller.state.auth.removeSession();
            }

            if (type === "AgeNotDeclared") {
              this.transition({ type: TransitionType.AgeMissing });
              break;
            }

            // the server had a problem of its own: the session may be fine,
            // so try again with backoff instead of ending it
            if (type === "DatabaseError" || type === "InternalError") {
              this.transition({ type: TransitionType.TemporaryFailure });
              break;
            }

            this.transition({
              type: TransitionType.PermanentFailure,
              error: this.client.events.lastError.data.type,
            });

            break;
          }
        }

        this.transition({
          type: TransitionType.TemporaryFailure,
        });

        break;
    }
  }

  /**
   * Get the permanent error
   */
  get permanentError() {
    return this.#permanentError!;
  }
}

/**
 * Controls lifecycle of clients
 */
export default class ClientController {
  /**
   * API Client
   */
  readonly api: API.API;

  /**
   * Lifecycle
   */
  readonly lifecycle: Lifecycle;

  /**
   * Reference to application state
   */
  readonly state: ApplicationState;

  isLoggedIn: Accessor<boolean>;

  /** Stoat instance the client belongs to. Also accessible via `useInstance()` */
  readonly instance: Instance;

  /**
   * Construct new client controller
   */
  constructor(state: ApplicationState, instance: Instance) {
    this.state = state;
    this.instance = instance;
    this.api = new API.API({
      baseURL: instance.apiUrl,
    });

    this.lifecycle = new Lifecycle(this);

    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
    this.selectUsername = this.selectUsername.bind(this);
    this.declareAge = this.declareAge.bind(this);
    this.isError = this.isError.bind(this);

    //A memo to prevent isLoggedIn from bouncing when reconnecting
    this.isLoggedIn = createMemo(() =>
      [
        State.Connecting,
        State.Connected,
        State.Disconnected,
        State.Offline,
        State.Reconnecting,
      ].includes(this.lifecycle.state()),
    );

    this.loginCached();
  }

  isError() {
    return this.lifecycle.state() === State.Error;
  }

  loginCached() {
    const session = this.state.auth.getSession();
    if (!session) return;
    this.lifecycle.transition({
      type: TransitionType.LoginCached,
      session,
    });
  }

  /**
   * Login given a set of credentials
   * @param credentials Credentials
   */
  async login(credentials: API.DataLogin, modals: ModalControllerExtended) {
    const browser = detect();

    // Generate a friendly name for this browser
    let friendly_name;
    if (browser) {
      let { name, os } = browser as { name: string; os: string };
      if (name === "ios") {
        name = "safari";
      } else if (name === "fxios") {
        name = "firefox";
      } else if (name === "crios") {
        name = "chrome";
      } else if (os === "Mac OS" && navigator.maxTouchPoints > 0) {
        os = "iPadOS";
      }

      friendly_name = t`Zrzur for Web (${name} on ${os})`;
    } else {
      friendly_name = t`Zrzur for Web (unknown device)`;
    }

    // Try to login with given credentials
    let session = await this.api.post("/auth/session/login", {
      ...credentials,
      friendly_name,
    });

    // Prompt for MFA verification if necessary
    if (session.result === "MFA") {
      const { allowed_methods } = session;
      while (session.result === "MFA") {
        const mfa_response: API.MFAResponse | undefined = await new Promise(
          (callback) =>
            modals.openModal({
              type: "mfa_flow",
              state: "unknown",
              available_methods: allowed_methods,
              callback,
            }),
        );

        if (typeof mfa_response === "undefined") {
          break;
        }

        try {
          session = await this.api.post("/auth/session/login", {
            mfa_response,
            mfa_ticket: session.ticket,
            friendly_name,
          });
        } catch (err) {
          console.error("Failed login:", err);
        }
      }

      if (session.result === "MFA") {
        throw "Cancelled";
      }
    }

    if (session.result === "Disabled") {
      // TODO
      alert("Account is disabled, run special logic here.");
      return false;
    }

    const createdSession = {
      _id: session._id,
      token: session.token,
      userId: session.user_id,
      valid: false,
    };

    this.state.auth.setSession(createdSession);
    this.lifecycle.transition({
      type: TransitionType.LoginUncached,
      session: createdSession,
    });
  }

  /**
   * Declare the month and year of birth the server waits for, then connect
   * @param birthMonth Year and month of birth, `YYYY-MM`
   * @returns The age group the server worked out
   */
  async declareAge(birthMonth: string) {
    const age = await this.lifecycle.client.account.changeAge(birthMonth);
    // below the minimum the server stores nothing and answers with an error
    this.lifecycle.transition({ type: TransitionType.AgeDeclared });
    return age;
  }

  async selectUsername(username: string) {
    await this.instance.client.api.post("/onboard/complete", {
      username,
    });

    this.lifecycle.transition({
      type: TransitionType.UserCreated,
    });
  }

  logout() {
    forgetCreators();
    this.state.settings.resetNotificationsState();
    killServiceWorkerSubscription(this.instance.client, true);
    this.state.auth.removeSession();
    this.lifecycle.transition({
      type: TransitionType.Logout,
    });
  }

  dispose() {
    this.lifecycle.destroy();
    this.lifecycle.transition({
      type: TransitionType.DisposeOnly,
    });
  }
}
