import { For, JSX, Show } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { styled } from "styled-system/jsx";

import {
  type FrameKitFile,
  downloadFrameKit,
  frameKitUrl,
} from "@revolt/app/interface/settings/user/profile/studio/frameKit";
import { Button } from "@revolt/ui";
import {
  FRAME_FILE,
  FRAME_TEMPLATE,
  frameBorderImage,
} from "@revolt/ui/components/features/profiles/frames/communityFrame";
import { type IconName, Icon } from "@revolt/ui/icons/Icon";

const T = FRAME_TEMPLATE;
const D = T.density;
/** template rectangles in file pixels */
const px = (r: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}) => ({
  left: r.left * D,
  top: r.top * D,
  right: r.right * D,
  bottom: r.bottom * D,
});
const CARD = px(T.card);
const SAFE = px(T.safe);
const CREST = px(T.crest);
const ROOM = {
  top: CARD.top,
  side: CARD.left,
  bottom: FRAME_FILE.height - CARD.bottom,
  band: SAFE.left - CARD.left,
};
/** the rows shown as drawn, at the top and the foot */
const FIXED = { top: T.slice.top * D, bottom: T.slice.bottom * D };
/** one pixel-art block, in file pixels */
const BLOCK = 8;
/** the largest file the server takes, in MB */
const MAX_MB = 2.5;
const CREATOR_TERMS_URL = "https://zrzur.com/legal/creator-terms";

/** a rectangle as `x, y to x, y` */
const span = (r: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}) => `${r.left}, ${r.top} – ${r.right}, ${r.bottom}`;

/**
 * How to design a profile frame: the canvas, the safe zone, the room on each
 * side, the pixel grid, the file the upload takes, light and dark, do's and
 * don'ts, the review rules and how to send one, with the frame kit to
 * download. Every number is the upload check's (communityFrame.ts, the
 * backend's PROFILE_FRAME_TEMPLATE).
 */
export function FrameGuide(props: {
  /** back to Designs */
  onBack: () => void;
  /** Creator Studio's new frame, for creators */
  onUpload?: () => void;
}) {
  const { t } = useLingui();

  return (
    <Page data-testid="frame-guide">
      <Crumbs aria-label={t`You are here`}>
        <button type="button" onClick={() => props.onBack()}>
          <Trans>Designs</Trans>
        </button>
        <span aria-hidden="true">/</span>
        <b>
          <Trans>Frame guide</Trans>
        </b>
      </Crumbs>

      <Head>
        <h1>
          <Trans>How to design a profile frame</Trans>
        </h1>
        <p>
          <Trans>
            A frame is one still picture laid round your profile card. Draw it
            on our template, keep the card clear, and upload it in Creator
            Studio.
          </Trans>
        </p>
        <Actions>
          <Button
            variant="filled"
            data-testid="frame-guide-kit"
            onPress={() => downloadFrameKit("kit")}
          >
            <Icon name="download-simple" size={16} />
            <Trans>Download the frame kit</Trans>
          </Button>
          <Show when={props.onUpload}>
            <Button
              variant="tonal"
              data-testid="frame-guide-upload"
              onPress={() => props.onUpload?.()}
            >
              <Icon name="upload-simple" size={16} />
              <Trans>Upload a frame</Trans>
            </Button>
          </Show>
        </Actions>
      </Head>

      <Section
        id="canvas"
        title={<Trans>The canvas</Trans>}
        art={<TemplateDiagram />}
      >
        <p>
          <Trans>
            Draw on a canvas of exactly {FRAME_FILE.width} × {FRAME_FILE.height}{" "}
            px. The card sits inside it; everything round the card is room for
            your art.
          </Trans>
        </p>
        <Facts>
          <Fact label={<Trans>Canvas</Trans>}>
            {FRAME_FILE.width} × {FRAME_FILE.height} px
          </Fact>
          <Fact label={<Trans>Card</Trans>}>
            {CARD.right - CARD.left} × {CARD.bottom - CARD.top} px
          </Fact>
          <Fact label={<Trans>Card position</Trans>}>{span(CARD)}</Fact>
        </Facts>
        <Legend />
      </Section>

      <Section id="safe" title={<Trans>Keep the card clear</Trans>}>
        <p>
          <Trans>
            The frame lies over the card as it is. The avatar, the name and the
            text area must stay fully transparent, or the upload is refused.
          </Trans>
        </p>
        <Facts>
          <Fact label={<Trans>Safe zone</Trans>}>{span(SAFE)}</Fact>
          <Fact label={<Trans>Crest window</Trans>}>{span(CREST)}</Fact>
          <Fact label={<Trans>Counts as clear</Trans>}>
            <Trans>Alpha 16 of 255 or less</Trans>
          </Fact>
        </Facts>
        <p>
          <Trans>
            The safe zone is the card less {ROOM.band} px on every side. Only
            the crest window over the middle of the banner may be drawn on.
          </Trans>
        </p>
      </Section>

      <Section id="reach" title={<Trans>Where the art may reach</Trans>}>
        <Reach>
          <ReachItem
            icon="caret-up"
            label={<Trans>Above the card</Trans>}
            value={ROOM.top}
          />
          <ReachItem
            icon="arrows-out"
            label={<Trans>On each side</Trans>}
            value={ROOM.side}
          />
          <ReachItem
            icon="caret-down"
            label={<Trans>Below the card</Trans>}
            value={ROOM.bottom}
          />
          <ReachItem
            icon="square"
            label={<Trans>Inside the card's edge</Trans>}
            value={ROOM.band}
          />
        </Reach>
        <p>
          <Trans>
            The top {FIXED.top} px and the bottom {FIXED.bottom} px are shown as
            you drew them. The sides between them stretch with the card's
            height, so keep them plain: put stars and details in the corners, on
            top and at the foot.
          </Trans>
        </p>
      </Section>

      <Section id="grid" title={<Trans>Pixel grid</Trans>} art={<ScaleDemo />}>
        <p>
          <Trans>
            Draw in blocks of {BLOCK} × {BLOCK} file pixels, counted from the
            card's top-left corner ({CARD.left}, {CARD.top}). One block shows as
            4 px on a 340 px card. Single pixels blur when the frame is scaled.
          </Trans>
        </p>
        <Facts>
          <Fact label={<Trans>Profile card, 360 px</Trans>}>
            <Trans>About 4 px a block</Trans>
          </Fact>
          <Fact label={<Trans>Full profile, 460 px</Trans>}>
            <Trans>About 5 px a block</Trans>
          </Fact>
          <Fact label={<Trans>Narrow phone card</Trans>}>
            <Trans>About 3 px a block</Trans>
          </Fact>
        </Facts>
        <p>
          <Trans>
            Zrzur's own pixel frames are drawn at 4 px on tall windows, 3 px
            below 1080 px and 2 px below 640 px and on phones. At 4 px they
            reach 96 px above the card, 72 px below and 56 px beside it.
          </Trans>
        </p>
      </Section>

      <Section id="file" title={<Trans>The file</Trans>}>
        <Facts>
          <Fact label={<Trans>Format</Trans>}>
            <Trans>PNG, WebP or GIF</Trans>
          </Fact>
          <Fact label={<Trans>Size</Trans>}>
            <Trans>
              Exactly {FRAME_FILE.width} × {FRAME_FILE.height} px
            </Trans>
          </Fact>
          <Fact label={<Trans>File size</Trans>}>
            <Trans>Up to {MAX_MB} MB</Trans>
          </Fact>
          <Fact label={<Trans>Background</Trans>}>
            <Trans>Transparent</Trans>
          </Fact>
          <Fact label={<Trans>Animation</Trans>}>
            <Trans>None: one still picture</Trans>
          </Fact>
          <Fact label={<Trans>File name</Trans>}>
            <Trans>
              Lowercase words with hyphens, such as desert-night.png
            </Trans>
          </Fact>
        </Facts>
        <p>
          <Trans>
            Creator Studio names the design after the file; you can change the
            name there. Hide the template's guide layers before you export.
          </Trans>
        </p>
      </Section>

      <Section
        id="themes"
        title={<Trans>Light and dark</Trans>}
        art={<ThemeCheck />}
      >
        <p>
          <Trans>
            People see your frame on dark and on light screens. Give the art a
            dark outline and a lighter edge so it reads on both, and check both
            in Creator Studio's preview before you publish.
          </Trans>
        </p>
      </Section>

      <Section id="examples" title={<Trans>Do and don't</Trans>}>
        <Examples>
          <Example good kind="corners">
            <Trans>Details in the corners and on top</Trans>
          </Example>
          <Example good kind="outline">
            <Trans>A clear outline, whole 4 px blocks</Trans>
          </Example>
          <Example good kind="plain">
            <Trans>Plain sides that can stretch</Trans>
          </Example>
          <Example kind="over">
            <Trans>Art over the name or the text</Trans>
          </Example>
          <Example kind="letters">
            <Trans>Words, letters or logos</Trans>
          </Example>
          <Example kind="specks">
            <Trans>Single-pixel details: they blur</Trans>
          </Example>
        </Examples>
      </Section>

      <Section id="review" title={<Trans>Review rules</Trans>}>
        <Rules>
          <li>
            <Trans>
              Your own work, or work you hold a clear licence to share.
            </Trans>
          </li>
          <li>
            <Trans>
              No copied art, including frames and stickers from other apps and
              games.
            </Trans>
          </li>
          <li>
            <Trans>No logos, brand marks or watermarks.</Trans>
          </li>
          <li>
            <Trans>No text or letters in any language.</Trans>
          </li>
          <li>
            <Trans>
              No hate: no slurs, hateful symbols or attacks on anyone.
            </Trans>
          </li>
          <li>
            <Trans>No real person without their consent.</Trans>
          </li>
        </Rules>
        <p>
          <Trans>
            Reviewers take down a frame that breaks these rules. The{" "}
            <a
              href={CREATOR_TERMS_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Creator Terms
            </a>{" "}
            apply to every design.
          </Trans>
        </p>
      </Section>

      <Section id="submit" title={<Trans>How to submit</Trans>}>
        <Steps>
          <li>
            <Trans>
              Download the frame kit and open template.svg or template.png.
            </Trans>
          </li>
          <li>
            <Trans>
              Draw on a layer of your own, inside the room round the card.
            </Trans>
          </li>
          <li>
            <Trans>
              Hide the guide layers and export the whole canvas as a PNG with a
              transparent background.
            </Trans>
          </li>
          <li>
            <Trans>
              In Creator Studio, choose New design, then Profile frame, and
              upload the file.
            </Trans>
          </li>
          <li>
            <Trans>
              Turn on Show guides, check dark and light, answer the rights
              questions and publish.
            </Trans>
          </li>
        </Steps>
        <p>
          <Trans>
            Creator Studio is open to people Zrzur has made creators.
          </Trans>
        </p>
      </Section>

      <Section id="kit" title={<Trans>What is in the kit</Trans>}>
        <Files>
          <KitFile
            file="kit"
            name="zrzur-frame-kit.zip"
            text={
              <Trans>Everything below, with a README in three languages</Trans>
            }
          />
          <KitFile
            file="svg"
            name="template.svg"
            text={<Trans>The template with named guide layers</Trans>}
          />
          <KitFile
            file="png"
            name="template.png"
            text={<Trans>The same template at the exact size</Trans>}
          />
          <KitFile
            file="example"
            name="example-frame.png"
            text={<Trans>A finished frame that passes every check</Trans>}
          />
        </Files>
      </Section>
    </Page>
  );
}

/** a section: its words, and beside them on a wide screen its picture */
function Section(props: {
  id: string;
  title: JSX.Element;
  art?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <Box id={`frame-guide-${props.id}`} data-art={props.art ? "" : undefined}>
      <div>
        <h2>{props.title}</h2>
        {props.children}
      </div>
      <Show when={props.art}>
        <figure>{props.art}</figure>
      </Show>
    </Box>
  );
}

function Fact(props: { label: JSX.Element; children: JSX.Element }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>
        <bdi>{props.children}</bdi>
      </dd>
    </div>
  );
}

function ReachItem(props: {
  icon: IconName;
  label: JSX.Element;
  value: number;
}) {
  return (
    <li>
      <Icon name={props.icon} size={20} />
      <span>{props.label}</span>
      <strong dir="ltr">{props.value} px</strong>
    </li>
  );
}

function KitFile(props: {
  file: FrameKitFile;
  name: string;
  text: JSX.Element;
}) {
  return (
    <li>
      <div>
        <strong dir="ltr">{props.name}</strong>
        <span>{props.text}</span>
      </div>
      <Button
        variant="tonal"
        size="sm"
        data-testid={`frame-guide-file-${props.file}`}
        onPress={() => downloadFrameKit(props.file)}
      >
        <Icon name="download-simple" size={16} />
        <Trans>Download</Trans>
      </Button>
    </li>
  );
}

/** what the colours of the pictures mean */
function Legend() {
  return (
    <Keys>
      <li data-key="reach">
        <i />
        <Trans>Room for art</Trans>
      </li>
      <li data-key="safe">
        <i />
        <Trans>Keep clear</Trans>
      </li>
      <li data-key="crest">
        <i />
        <Trans>Crest window</Trans>
      </li>
      <li data-key="stretch">
        <i />
        <Trans>Stretches with the card</Trans>
      </li>
    </Keys>
  );
}

/** the template, to scale, with its numbers (file pixels) */
function TemplateDiagram() {
  const safePath =
    `M${SAFE.left} ${SAFE.top}H${SAFE.right}V${SAFE.bottom}H${SAFE.left}Z` +
    `M${CREST.left} ${CREST.top}V${CREST.bottom}H${CREST.right}V${CREST.top}Z`;
  return (
    <Diagram
      viewBox={`-40 -8 ${FRAME_FILE.width + 80} ${FRAME_FILE.height + 16}`}
      role="img"
      aria-label={`${FRAME_FILE.width} × ${FRAME_FILE.height}`}
      direction="ltr"
      data-testid="frame-guide-diagram"
    >
      <rect
        class="reach"
        width={FRAME_FILE.width}
        height={FRAME_FILE.height}
        rx="12"
      />
      <rect
        class="stretch"
        y={FIXED.top}
        width={SAFE.left}
        height={FRAME_FILE.height - FIXED.top - FIXED.bottom}
      />
      <rect
        class="stretch"
        x={SAFE.right}
        y={FIXED.top}
        width={FRAME_FILE.width - SAFE.right}
        height={FRAME_FILE.height - FIXED.top - FIXED.bottom}
      />
      <rect
        class="card"
        x={CARD.left}
        y={CARD.top}
        width={CARD.right - CARD.left}
        height={CARD.bottom - CARD.top}
        rx="28"
      />
      <rect
        class="banner"
        x={CARD.left}
        y={CARD.top}
        width={CARD.right - CARD.left}
        height="226"
      />
      <circle class="mock" cx={CARD.left + 96} cy={CARD.top + 226} r="68" />
      <rect
        class="mock"
        x={CARD.left + 40}
        y={CARD.top + 316}
        width="320"
        height="36"
        rx="8"
      />
      <For each={[400, 440, 480, 560, 600]}>
        {(y, i) => (
          <rect
            class="mock"
            x={CARD.left + 40}
            y={CARD.top + y}
            width={i() % 3 === 2 ? 380 : 560}
            height="16"
            rx="8"
          />
        )}
      </For>
      <path class="safe" d={safePath} fill-rule="evenodd" />
      <rect
        class="crest"
        x={CREST.left}
        y={CREST.top}
        width={CREST.right - CREST.left}
        height={CREST.bottom - CREST.top}
      />
      {/* diagram units: the file is 800 px wide, drawn about 0.4 of that */}
      <g class="numbers" font-size="40">
        <text x={FRAME_FILE.width / 2} y={CARD.top / 2 + 12}>
          {ROOM.top}
        </text>
        <text x={CARD.left / 2} y={FRAME_FILE.height / 2}>
          {ROOM.side}
        </text>
        <text x={FRAME_FILE.width - CARD.left / 2} y={FRAME_FILE.height / 2}>
          {ROOM.side}
        </text>
        <text x={FRAME_FILE.width / 2} y={CARD.bottom + ROOM.bottom / 2 + 12}>
          {ROOM.bottom}
        </text>
      </g>
    </Diagram>
  );
}

/** an eight-point star in 4 px blocks, drawn at 4, 3 and 2 px */
const STAR = [
  "...#...",
  ".#####.",
  ".##o##.",
  "##ooo##",
  ".##o##.",
  ".#####.",
  "...#...",
];

function ScaleDemo() {
  return (
    <Scales dir="ltr">
      <For each={[4, 3, 2]}>
        {(cell) => (
          <div>
            <svg
              width={STAR.length * cell}
              height={STAR.length * cell}
              viewBox={`0 0 ${STAR.length} ${STAR.length}`}
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <For each={STAR}>
                {(row, y) => (
                  <For each={[...row]}>
                    {(mark, x) => (
                      <Show when={mark !== "."}>
                        <rect
                          class={mark === "o" ? "lit" : "ink"}
                          x={x()}
                          y={y()}
                          width="1"
                          height="1"
                        />
                      </Show>
                    )}
                  </For>
                )}
              </For>
            </svg>
            <span>{cell} px</span>
          </div>
        )}
      </For>
    </Scales>
  );
}

/** the kit's example frame round a card on a dark and on a light ground */
function ThemeCheck() {
  const width = 104;
  return (
    <Themes>
      <For each={["dark", "light"] as const}>
        {(ground) => (
          <div data-ground={ground}>
            <span
              class="card"
              style={{
                width: `${width}px`,
                ...frameBorderImage(frameKitUrl("example"), width),
              }}
            />
            <small>
              <Show when={ground === "dark"} fallback={<Trans>Light</Trans>}>
                <Trans>Dark</Trans>
              </Show>
            </small>
          </div>
        )}
      </For>
    </Themes>
  );
}

/** a small card with what a do or a don't looks like */
function Example(props: {
  good?: boolean;
  kind: "corners" | "outline" | "plain" | "over" | "letters" | "specks";
  children: JSX.Element;
}) {
  return (
    <li data-good={props.good ? "" : undefined}>
      <svg viewBox="0 0 120 140" aria-hidden="true" direction="ltr">
        <rect class="card" x="20" y="26" width="80" height="94" rx="8" />
        <rect class="banner" x="20" y="26" width="80" height="26" />
        <circle class="mock" cx="38" cy="54" r="10" />
        <rect class="mock" x="28" y="70" width="44" height="6" rx="3" />
        <rect class="mock" x="28" y="84" width="64" height="4" rx="2" />
        <rect class="mock" x="28" y="94" width="52" height="4" rx="2" />
        <Show when={props.kind === "corners"}>
          <path class="art" d="M54 8h12v6h6v12h-6v6H54v-6h-6V14h6z" />
          <path class="art" d="M10 16h8v4h4v8h-4v4h-8v-4H6v-8h4z" />
          <path class="art" d="M102 16h8v4h4v8h-4v4h-8v-4h-4v-8h4z" />
          <rect class="band" x="16" y="22" width="88" height="102" rx="10" />
        </Show>
        <Show when={props.kind === "outline"}>
          <rect
            class="band thick"
            x="14"
            y="20"
            width="92"
            height="106"
            rx="12"
          />
        </Show>
        <Show when={props.kind === "plain"}>
          <rect class="band" x="16" y="22" width="88" height="102" rx="10" />
          <path class="art" d="M52 6h16v8h8v12h-8v6H52v-6h-8V14h8z" />
        </Show>
        <Show when={props.kind === "over"}>
          <rect class="band" x="16" y="22" width="88" height="102" rx="10" />
          <path class="bad" d="M58 56h24v8h8v20h-8v8H58v-8h-8V64h8z" />
        </Show>
        <Show when={props.kind === "letters"}>
          <rect class="band" x="16" y="22" width="88" height="102" rx="10" />
          <text class="bad-text" x="60" y="18">
            Aa
          </text>
        </Show>
        <Show when={props.kind === "specks"}>
          <rect class="band" x="16" y="22" width="88" height="102" rx="10" />
          <For each={[12, 30, 47, 66, 81, 99, 108]}>
            {(x, i) => (
              <rect
                class="speck"
                x={x}
                y={6 + ((i() * 7) % 13)}
                width="1.5"
                height="1.5"
              />
            )}
          </For>
        </Show>
      </svg>
      <p>
        <Icon name={props.good ? "check-circle" : "x-circle"} size={16} />
        <span>{props.children}</span>
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ */

const Page = styled("article", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    width: "100%",
    maxWidth: "1200px",
    marginInline: "auto",
    paddingBlock: "8px 72px",
    color: "var(--z-fg-primary)",
  },
});

const Crumbs = styled("nav", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--z-fg-secondary)",
    "& button": {
      minHeight: "32px",
      padding: "0 4px",
      border: "none",
      borderRadius: "6px",
      background: "none",
      font: "inherit",
      color: "var(--z-accent-text)",
      cursor: "pointer",
      _hover: { textDecoration: "underline" },
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
      _phone: { minHeight: "44px" },
    },
    "& b": { fontWeight: 600, color: "var(--z-fg-primary)" },
  },
});

const Head = styled("header", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    maxWidth: "720px",
    "& h1": {
      margin: 0,
      fontSize: "28px",
      lineHeight: "36px",
      fontWeight: 700,
      _phone: { fontSize: "22px", lineHeight: "30px" },
    },
    "& > p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
  },
});

const Actions = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBlockStart: "4px",
    _phone: { "& button": { minHeight: "44px" } },
  },
});

const Box = styled("section", {
  base: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "24px",
    padding: "24px",
    borderRadius: "var(--z-box-radius, 14px)",
    border: "var(--z-box-border, 1px solid var(--z-border-subtle))",
    background: "var(--z-box-bg, var(--z-designs-surface))",
    scrollMarginTop: "80px",
    "&[data-art]": {
      "@media (min-width: 900px)": {
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
      },
    },
    "& > div": {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      minWidth: 0,
    },
    "& h2": {
      margin: 0,
      fontSize: "18px",
      lineHeight: "26px",
      fontWeight: 700,
    },
    "& p": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "24px",
      color: "var(--z-fg-secondary)",
    },
    "& a": {
      color: "var(--z-accent-text)",
      _focusVisible: {
        outline: "2px solid var(--z-focus)",
        outlineOffset: "2px",
      },
    },
    "& figure": {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: 0,
      minWidth: 0,
    },
    _phone: { padding: "16px", gap: "16px" },
  },
});

const Facts = styled("dl", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "8px",
    margin: 0,
    "& > div": {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      padding: "12px",
      borderRadius: "10px",
      background: "var(--z-designs-surface-raised, var(--z-bg-raised))",
    },
    "& dt": {
      fontSize: "12px",
      lineHeight: "18px",
      color: "var(--z-fg-muted)",
    },
    "& dd": {
      margin: 0,
      fontSize: "15px",
      lineHeight: "22px",
      fontWeight: 600,
    },
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Reach = styled("ul", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px",
      borderRadius: "10px",
      background: "var(--z-designs-surface-raised, var(--z-bg-raised))",
      "--z-icon-color": "var(--z-fg-secondary)",
    },
    "& span": { flex: 1, minWidth: 0, fontSize: "14px", lineHeight: "20px" },
    "& strong": { fontSize: "15px", fontWeight: 700 },
    _phone: { gridTemplateColumns: "minmax(0, 1fr)" },
  },
});

const Keys = styled("ul", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 16px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    fontSize: "13px",
    lineHeight: "20px",
    color: "var(--z-fg-secondary)",
    "& li": { display: "inline-flex", alignItems: "center", gap: "8px" },
    "& i": {
      flexShrink: 0,
      width: "16px",
      height: "12px",
      borderRadius: "2px",
    },
    "& [data-key='reach'] i": {
      background: "var(--z-bg-sidebar)",
      border: "1px solid var(--z-border-strong)",
    },
    "& [data-key='safe'] i": {
      background: "color-mix(in srgb, var(--z-focus) 30%, transparent)",
      outline: "2px dashed var(--z-focus)",
      outlineOffset: "-2px",
    },
    "& [data-key='crest'] i": { border: "2px solid var(--z-fg-primary)" },
    "& [data-key='stretch'] i": {
      background:
        "color-mix(in srgb, var(--z-designs-status-online) 28%, transparent)",
    },
  },
});

const Diagram = styled("svg", {
  base: {
    display: "block",
    width: "100%",
    maxWidth: "320px",
    height: "auto",
    "& .reach": {
      fill: "var(--z-bg-sidebar)",
      stroke: "var(--z-border-strong)",
      strokeWidth: 2,
    },
    "& .stretch": {
      fill: "color-mix(in srgb, var(--z-designs-status-online) 20%, transparent)",
    },
    "& .card": { fill: "var(--z-bg-raised)" },
    "& .banner": { fill: "var(--z-nav-selected, var(--z-border-strong))" },
    "& .mock": { fill: "var(--z-border-strong)" },
    "& .safe": {
      fill: "color-mix(in srgb, var(--z-focus) 26%, transparent)",
      stroke: "var(--z-focus)",
      strokeWidth: 4,
      strokeDasharray: "16 12",
    },
    "& .crest": { fill: "none", stroke: "var(--z-fg-primary)", strokeWidth: 4 },
    "& .numbers text": {
      fill: "var(--z-fg-primary)",
      fontWeight: 700,
      textAnchor: "middle",
    },
  },
});

const Scales = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: "32px",
    padding: "24px",
    borderRadius: "10px",
    background: "var(--z-bg-sidebar)",
    "& > div": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
    },
    "& .ink": { fill: "var(--z-accent-fill)" },
    "& .lit": { fill: "var(--z-accent-text)" },
    "& span": { fontSize: "13px", color: "var(--z-fg-secondary)" },
  },
});

const Themes = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "16px",
    "& > div": {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "12px",
      // room for the frame round the card: 70, 30 and 40 of 340
      padding: "32px 20px 12px",
      borderRadius: "10px",
    },
    "& [data-ground='dark']": {
      background: "var(--z-designs-art-ground)",
      color: "var(--z-designs-on-art)",
    },
    "& [data-ground='light']": {
      background: "var(--z-designs-art-light)",
      color: "var(--z-designs-on-light)",
    },
    "& .card": {
      display: "block",
      boxSizing: "border-box",
      height: "124px",
      borderRadius: "8px",
      background: "color-mix(in srgb, currentColor 10%, transparent)",
      marginBlockEnd: "12px",
    },
    "& small": { fontSize: "12px", lineHeight: "18px" },
  },
});

const Examples = styled("ul", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "12px",
      borderRadius: "10px",
      background: "var(--z-designs-surface-raised, var(--z-bg-raised))",
      "--z-icon-color": "var(--z-danger)",
    },
    "& li[data-good]": { "--z-icon-color": "var(--z-designs-status-online)" },
    "& svg": {
      display: "block",
      width: "100%",
      height: "auto",
      borderRadius: "6px",
      background: "var(--z-bg-sidebar)",
    },
    "& .card": { fill: "var(--z-bg-raised)" },
    "& .banner": { fill: "var(--z-nav-selected, var(--z-border-strong))" },
    "& .mock": { fill: "var(--z-border-strong)" },
    "& .band": { fill: "none", stroke: "var(--z-accent-text)", strokeWidth: 3 },
    "& .band.thick": { strokeWidth: 6 },
    "& .art": { fill: "var(--z-accent-fill)" },
    "& .bad": { fill: "var(--z-accent-fill)", opacity: 0.85 },
    "& .bad-text": {
      fill: "var(--z-accent-fill)",
      fontSize: "16px",
      fontWeight: 700,
      textAnchor: "middle",
    },
    "& .speck": { fill: "var(--z-accent-text)" },
    "& p": {
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-primary)",
    },
    "& p svg": {
      width: "16px",
      background: "none",
      flexShrink: 0,
      marginBlockStart: "2px",
    },
    _phone: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
  },
});

const Rules = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    paddingInlineStart: "20px",
    fontSize: "15px",
    lineHeight: "24px",
  },
});

const Steps = styled("ol", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    paddingInlineStart: "24px",
    fontSize: "15px",
    lineHeight: "24px",
  },
});

const Files = styled("ul", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
    "& li": {
      display: "flex",
      alignItems: "center",
      gap: "16px",
      padding: "12px",
      borderRadius: "10px",
      background: "var(--z-designs-surface-raised, var(--z-bg-raised))",
    },
    "& li > div": {
      display: "flex",
      flexDirection: "column",
      gap: "2px",
      flex: 1,
      minWidth: 0,
    },
    "& strong": { fontSize: "15px", fontWeight: 600, overflowWrap: "anywhere" },
    "& span": {
      fontSize: "13px",
      lineHeight: "20px",
      color: "var(--z-fg-secondary)",
    },
    "& button": { flexShrink: 0 },
    _phone: {
      "& li": { flexDirection: "column", alignItems: "stretch" },
      "& button": { minHeight: "44px" },
    },
  },
});
