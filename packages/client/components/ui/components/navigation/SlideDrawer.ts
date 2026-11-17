import {
  Accessor,
  createEffect,
  createRoot,
  createSignal,
  Setter,
} from "solid-js";

import { useDevice } from "@revolt/common";

const ANIM_MS = 150,
  VEL_MS = 33, //30Hz velocity update
  VEL_AVG = 5, //Moving avg smoothing
  VEL_TRIG = 0.3, //Override drawer pos if over
  TRIG_X = 10,
  CANCEL_Y = 20;

type TrackTouch = {
  id: number;
  x: number;
  y: number;
  newX?: number;
  newT?: number;
  prevX?: number;
  prevT?: number;
  trig?: boolean;
  vAvg?: Array<number>;
  vOfs?: number;
};

export const enum SlideState {
  HIDDEN = 1,
  SHOWN,
  HIDING,
  SHOWING,
  MOVING,
}

export class SlideDrawer {
  private touch: TrackTouch | null = null;
  private tTmr: NodeJS.Timeout | null = null;
  private vTmr: NodeJS.Timeout | null = null;
  private lShow = true;
  /** asked for while a slide was still settling: done when it has */
  private wanted: boolean | undefined;
  /** the content is slid aside (the menu shows) */
  private open = false;
  /**
   * How far the content is slid: read from the window only when a swipe or
   * an animation needs it. Read while the app was being built (enabling the
   * drawer on phones), it made the browser lay out the whole page at once
   * and again later, a third of a second on a slow phone.
   */
  private get ofs() {
    return this.open ? -innerWidth : 0;
  }

  private dispose!: () => void;
  private eGet!: Accessor<boolean>;
  private eSet!: Setter<boolean>;
  private sGet!: Accessor<SlideState>;
  private sSet!: Setter<SlideState>;

  constructor(
    private drawer: HTMLElement,
    private root: HTMLElement,
    /** on phones, start with the content shown (false: the menu) */
    startShown = true,
  ) {
    this.lShow = startShown;
    this.start = this.start.bind(this);
    this.move = this.move.bind(this);
    this.cancel = this.cancel.bind(this);
    root.addEventListener("touchstart", this.start);
    root.addEventListener("touchmove", this.move);
    root.addEventListener("touchend", this.move);
    root.addEventListener("touchcancel", this.cancel);

    createRoot((dispose) => {
      this.dispose = dispose;

      //Signals
      const [eg, es] = createSignal(false);
      this.eGet = eg;
      this.eSet = es;
      const [sg, ss] = createSignal(SlideState.HIDDEN);
      this.sGet = sg;
      this.sSet = ss;

      //Auto-enable based on layout
      const dev = useDevice();
      createEffect(() => {
        this.enabled = dev.layout() === "phone";
      });
    });
  }

  private start(e: TouchEvent) {
    //Cancel if more than one finger
    if (e.touches.length > 1) return this.endTouch();
    // One finger is down and it is new, so a touch still tracked here lost
    // its end. Kept, it held the drawer: a press on a conversation moved the
    // route and the page stayed off screen until the next swipe.
    if (this.touch) this.cancel();
    if (!this.eGet()) return;
    // pinched in: a drag pans the page, it must not slide the menu
    if ((window.visualViewport?.scale ?? 1) > 1.01) return;

    //Track this touch
    const t = e.touches[0];
    this.touch = {
      id: t.identifier,
      x: t.screenX,
      y: t.screenY,
    };
  }

  private move(e: TouchEvent) {
    if (!this.touch) return;
    const isEnd = e.type === "touchend";
    let t, tNew;
    for (t of e.changedTouches)
      if (t.identifier === this.touch.id) {
        tNew = t;
        break;
      }
    if (!tNew) return;

    t = this.touch;
    const dy = tNew.screenY - t.y,
      ds = this.drawer.style,
      max = -innerWidth;
    let dx = this.dir * (tNew.screenX - t.x),
      trig = t.trig;

    // A swipe the wrong way for where the drawer is (further into the page it
    // already shows, or further into the menu) can move nothing: it is not
    // ours. It used to start a drag all the same, which closed the keyboard
    // and swallowed the gesture; a message row now uses that direction
    // (pull to reply, swipeToReply.ts).
    const nowhere =
      !trig &&
      Math.abs(dx) > TRIG_X &&
      Math.max(Math.min(this.ofs + dx, 0), max) === this.ofs;

    if (!trig && (Math.abs(dy) > CANCEL_Y || nowhere)) {
      this.endTouch();
    } else if (trig || Math.abs(dx) > TRIG_X) {
      //Store new/prev X for vel calc
      const type = trig ? "new" : "prev";
      t[`${type}X`] = dx;
      t[`${type}T`] = performance.now();

      if (!trig) {
        t.trig = trig = true;
        this.wanted = undefined;
        this.tfTimer();
        this.velTimer();
        if (!isEnd) this.sSet(SlideState.MOVING);
        //Hide keyboard
        (document.activeElement as HTMLElement)?.blur();
      }

      dx = Math.max(Math.min(this.ofs + dx, 0), max);
      if (!isEnd) ds.transform = `translateX(${this.dir * dx}px)`;
      e.preventDefault();
      e.stopPropagation();
    }

    if (isEnd) {
      if (trig) {
        this.addVel();
        //Calc avg vel
        let vel = 0;
        if (t.vAvg) {
          let v;
          for (v of t.vAvg) vel += v;
          vel /= t.vAvg.length;
        }
        //Finalize show/hide state
        let show = dx < max / 2;
        if (vel > VEL_TRIG) show = false;
        else if (vel < -VEL_TRIG) show = true;
        this.tfTimer(true, show);
      }
      this.endTouch();
    }
  }

  private velTimer() {
    if (this.vTmr) return;
    this.vTmr = setInterval(this.addVel.bind(this), VEL_MS);
  }

  private addVel(skipStale = false) {
    const t = this.touch;
    if (!t || !t.newT) return;

    //Velocity since last update
    const stale = t.prevT === t.newT,
      vel = stale ? 0 : (t.newX! - t.prevX!) / (t.newT! - t.prevT!);

    if (stale && skipStale) return;

    t.prevX = t.newX;
    t.prevT = t.newT;

    if (t.vAvg) {
      //Insert at vOfs
      t.vAvg[t.vOfs!] = vel;
      if (++t.vOfs! === VEL_AVG) t.vOfs = 0;
    } else {
      //Fill with first data
      t.vAvg = [vel];
      t.vOfs = 1;
    }
  }

  /**
   * The system took the gesture (its own back swipe from the screen edge, a
   * call coming in, the link menu): no end follows. Put the drawer back
   * where it was and let go.
   */
  private cancel() {
    if (!this.touch) return;
    if (this.touch.trig) this.tfTimer(true, this.open);
    this.endTouch();
  }

  private endTouch() {
    clearInterval(this.vTmr!);
    this.touch = this.vTmr = null;
  }

  private tfTimer(set = false, show = false) {
    //Animate transition
    const ds = this.drawer.style;
    this.setElState(false);
    if (set) {
      this.open = show;
      ds.transition = `transform ${ANIM_MS}ms ease-out`;
      ds.transform = `translateX(${this.dir * this.ofs}px)`;
      this.sSet(show ? SlideState.SHOWING : SlideState.HIDING);
    } else {
      ds.transition = ds.transform = "";
    }

    //Finalize after delay
    clearTimeout(this.tTmr!);
    this.tTmr = set
      ? setTimeout(() => {
          ds.transition = ds.transform = "";
          this.setElState(show);
          this.tTmr = null;
          this.sSet(show ? SlideState.SHOWN : SlideState.HIDDEN);
          const next = this.wanted;
          this.wanted = undefined;
          if (next !== undefined) this.setShown(next);
        }, ANIM_MS + 50)
      : null;
  }

  private setElState(show: boolean) {
    const ds = this.drawer.style;
    this.root.style.width = show ? "" : "200vw";
    ds.marginInlineStart = show ? "" : "100vw";
  }

  delete() {
    this.enabled = false;
    this.root.removeEventListener("touchstart", this.start);
    this.root.removeEventListener("touchmove", this.move);
    this.root.removeEventListener("touchend", this.move);
    this.root.removeEventListener("touchcancel", this.cancel);
    this.dispose();
  }

  get enabled() {
    return this.eGet();
  }
  set enabled(en: boolean) {
    if (this.eGet() !== en) {
      // above the menu, including its floating account card (z-index 3)
      this.drawer.style.zIndex = en ? "4" : "";
      this.tfTimer();
      this.endTouch();
      if (!en) this.lShow = this.sGet() === SlideState.SHOWN;
      //Restore show/hide state
      const show = en ? this.lShow : false;
      this.setElState(!en || show);
      this.open = show;
      this.eSet(en);
      this.sSet(show ? SlideState.SHOWN : SlideState.HIDDEN);
    }
  }

  /**
   * 1 for left-to-right, -1 for right-to-left: the menu sits on the start
   * side, so the content slides the other way in Arabic
   */
  private get dir() {
    return getComputedStyle(this.root).direction === "rtl" ? -1 : 1;
  }

  get state() {
    return this.sGet();
  }

  setShown(show: boolean) {
    if (!this.eGet() || this.touch?.trig) return false;
    // still settling from the last slide (a fifth of a second): a press in
    // that moment used to be dropped, now it follows on
    if (this.tTmr) {
      this.wanted = show;
      return true;
    }
    if (this.open !== show) {
      this.setElState(false);
      this.drawer.style.transform = `translateX(${this.dir * this.ofs}px)`;
      setTimeout(() => this.tfTimer(true, show), 1);
    }
    return true;
  }
}
