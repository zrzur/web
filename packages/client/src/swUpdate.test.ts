import { describe, expect, it, vi } from "vitest";

import { type WorkerLike, FRESH_PAGE_MS, watchForUpdate } from "./swUpdate";

function worker(state = "installing") {
  const listeners: (() => void)[] = [];
  const self = {
    state,
    postMessage: vi.fn(),
    addEventListener: (_: "statechange", run: () => void) =>
      void listeners.push(run),
    become(next: string) {
      self.state = next;
      listeners.forEach((run) => run());
    },
  };
  return self;
}

function setup(options: {
  controller?: boolean;
  age?: number;
  waiting?: WorkerLike;
  installing?: WorkerLike;
}) {
  const found: (() => void)[] = [];
  const changed: (() => void)[] = [];
  const registration = {
    waiting: options.waiting ?? null,
    installing: options.installing ?? null,
    addEventListener: (_: "updatefound", run: () => void) =>
      void found.push(run),
  };
  const container = {
    controller: options.controller === false ? null : {},
    addEventListener: (_: "controllerchange", run: () => void) =>
      void changed.push(run),
  };
  let age = options.age ?? 0;
  const reload = vi.fn();
  const pending: (() => void)[] = [];
  const timers: (() => void)[] = [];
  watchForUpdate({
    container,
    registration,
    pageAge: () => age,
    reload,
    onPending: (apply) => void pending.push(apply),
    setTimeout: (run) => void timers.push(run),
  });
  return {
    registration,
    reload,
    pending,
    timers,
    setAge: (next: number) => (age = next),
    updateFound: (w: WorkerLike) => {
      registration.installing = w;
      found.forEach((run) => run());
    },
    controllerChange: () => changed.forEach((run) => run()),
  };
}

describe("a new release and an open page", () => {
  it("a page opened after the release lets the new worker in, without a reload", () => {
    const waiting = worker("installed");
    const page = setup({ waiting, age: 500 });
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    page.controllerChange();
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.pending).toHaveLength(0);
  });

  it("the same when the worker finishes installing while the page starts", () => {
    const installing = worker();
    const page = setup({ installing, age: 500 });
    installing.become("installed");
    expect(installing.postMessage).toHaveBeenCalledWith({
      type: "SKIP_WAITING",
    });
    expect(page.pending).toHaveLength(0);
  });

  it("a page opened before the release never reloads by itself", () => {
    const page = setup({ age: 1000 });
    page.setAge(FRESH_PAGE_MS + 1);
    const next = worker();
    page.updateFound(next);
    next.become("installed");
    expect(next.postMessage).not.toHaveBeenCalled();
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.pending).toHaveLength(1);
  });

  it("'Update' moves to the new release and reloads once", () => {
    const page = setup({ age: 1000 });
    page.setAge(FRESH_PAGE_MS + 1);
    const next = worker();
    page.updateFound(next);
    next.become("installed");
    page.pending[0]();
    expect(next.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    page.controllerChange();
    // the safety timer must not reload a second time
    page.timers.forEach((run) => run());
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("'Update' still reloads if the worker never reports taking over", () => {
    const page = setup({ age: 1000 });
    page.setAge(FRESH_PAGE_MS + 1);
    const next = worker();
    page.updateFound(next);
    next.become("installed");
    page.pending[0]();
    page.timers.forEach((run) => run());
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("another tab moving to the release offers the reload here, no more", () => {
    const page = setup({ age: 1000 });
    page.setAge(FRESH_PAGE_MS + 1);
    page.controllerChange();
    expect(page.reload).not.toHaveBeenCalled();
    expect(page.pending).toHaveLength(1);
    page.pending[0]();
    expect(page.reload).toHaveBeenCalledTimes(1);
  });

  it("the first visit installs the worker without any notice", () => {
    const installing = worker();
    const page = setup({
      controller: false,
      installing,
      age: FRESH_PAGE_MS * 5,
    });
    installing.become("installed");
    page.controllerChange();
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(page.pending).toHaveLength(0);
    expect(page.reload).not.toHaveBeenCalled();
  });
});
