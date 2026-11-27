import { AbstractSyncedStore } from ".";
import { State } from "..";

/** The first steps a server's lobby suggests */
export type LobbyStep = "rules" | "hello" | "voice" | "profile";

const STEPS: readonly LobbyStep[] = ["rules", "hello", "voice", "profile"];

/** Steps done, by server id */
export type TypeLobbySteps = Record<string, LobbyStep[]>;

/** Most servers remembered (the oldest are dropped past this) */
const SERVER_LIMIT = 200;

/**
 * The lobby's "Start here" steps a member has done, per server. Synced with
 * the account, so a step done once stays done on every device and after
 * signing out and in again (owner report 2026-11-27: the steps came back
 * after each sign-in, kept as they were on one device only).
 */
export class LobbySteps extends AbstractSyncedStore<
  "lobby-steps",
  TypeLobbySteps
> {
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "lobby-steps");
    this.done = this.done.bind(this);
    this.mark = this.mark.bind(this);
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeLobbySteps {
    return {};
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeLobbySteps>): TypeLobbySteps {
    const out: TypeLobbySteps = {};
    const entries = Object.entries(input ?? {}).slice(-SERVER_LIMIT);
    for (const [server, steps] of entries) {
      if (typeof server !== "string" || server.length > 64) continue;
      const kept = (Array.isArray(steps) ? steps : []).filter(
        (step, i, all): step is LobbyStep =>
          STEPS.includes(step as LobbyStep) && all.indexOf(step) === i,
      );
      if (kept.length) out[server] = kept;
    }
    return out;
  }

  /**
   * Steps done in a server
   */
  done(serverId: string): LobbyStep[] {
    return this.get()[serverId] ?? [];
  }

  /**
   * Mark a step done in a server (once; it stays done)
   */
  mark(serverId: string, step: LobbyStep) {
    const steps = this.done(serverId);
    if (steps.includes(step)) return;
    this.set(serverId, [...steps, step]);
  }
}
