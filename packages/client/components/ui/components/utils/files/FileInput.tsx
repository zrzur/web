import { useLingui } from "@lingui/solid/macro";
import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  splitProps,
} from "solid-js";

import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { ALLOWED_IMAGE_TYPES } from "@revolt/state";
import { Icon } from "@revolt/ui/icons/Icon";

import { Button, IconButton } from "../../design";
import { Row } from "../../layout";

interface Props {
  /**
   * Currently selected file(s),
   * a URL for a preview,
   * or no file at all.
   */
  file: File[] | string | null;

  /**
   * Callback for selected file(s)
   *
   * Your consumer code should perform
   * additional validation such as file size.
   * @param files Selected File(s)
   */
  onFiles: (files: File[] | null) => void;

  /**
   * Whether to accept multiple files
   */
  multiple?: false;

  /**
   * What type of files to accept
   */
  accept?: "image/*";

  imageAspect?: string;
  imageRounded?: boolean;
  imageJustify?: boolean;
  /** Preview height in px (default 96) */
  imageHeight?: number;
  allowRemoval?: boolean;
  /** Accessible names for the picker and remove buttons */
  label?: string;
  removeLabel?: string;
  /** The remove button sits on the image's corner instead of beside it, so
   * the image keeps its place in a column (server icon, banner) */
  removeCorner?: boolean;

  required: boolean;
  disabled: boolean;

  /**
   * Threaded through to `process` as the single source of
   * truth, so a crop/resize/etc. step can validate its actual output
   * against the same number the caller already configured, instead of
   * the caller having to repeat the limit separately for the processor.
   */
  maxSize?: number;

  /**
   * Optional pipeline step between the native picker and `onFiles`.
   */
  process?: (
    files: File[],
    resolve: (files: File[] | null) => void,
    maxSize: number | undefined,
  ) => void;
}

/**
 * Form element for collecting files
 */
export function FileInput(props: Props) {
  const { t } = useLingui();
  const [local, remote] = splitProps(props, [
    "file",
    "onFiles",
    "multiple",
    "accept",
    "process",
    "maxSize",
  ]);
  let inputRef: HTMLInputElement | undefined;

  const [pendingProcess, setPendingProcess] = createSignal<File[] | null>(null);

  /**
   * Handle file selection
   */
  function onChange(e: Event & { currentTarget: HTMLInputElement }) {
    if (!e.currentTarget.files) return;

    // If accept is an image, check all the files submitted if they match our accept values
    if (local.accept === "image/*") {
      for (const file of e.currentTarget.files) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          // If they were stubborn enough to disable our filter for files then just ignore the file.
          // No need for feedback, they know what they did.
          local.onFiles(null);
          e.currentTarget.files = null;
          return;
        }
      }
    }

    const selected = [...e.currentTarget.files];

    if (local.process) {
      setPendingProcess(selected);
      return;
    }

    // NB. need to help out with the reactivity by
    //     first removing the array, and then setting
    //     the new one; otherwise no update! ¯\_(ツ)_/¯
    local.onFiles(null);
    local.onFiles(selected);
  }

  function resolveProcess(result: File[] | null) {
    setPendingProcess(null);
    if (result) {
      local.onFiles(null);
      local.onFiles(result);
    }
  }

  /**
   * Handle clear
   */
  function onClear() {
    inputRef!.value = null!;
    local.onFiles(null);
  }

  function imageSrc() {
    if (typeof local.file === "string") {
      return local.file;
    } else if (Array.isArray(local.file)) {
      // purportedly, we don't need to revoke:
      // https://stackoverflow.com/a/49346614
      return URL.createObjectURL(local.file[0]);
    } else {
      return "";
    }
  }

  createEffect(() => {
    const filesToProcess = pendingProcess();
    if (local.process && filesToProcess) {
      local.process!(filesToProcess, resolveProcess, local.maxSize);
    }
  });

  /** the image to click, shared by both layouts */
  const preview = () => (
    <ImagePreview
      role="button"
      tabIndex={props.disabled ? -1 : 0}
      aria-label={props.label ?? t`Choose image`}
      data-empty={!local.file}
      onClick={() => inputRef!.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef!.click();
        }
      }}
      style={{
        "aspect-ratio": props.imageAspect ?? "1/1",
        height: props.imageHeight ? `${props.imageHeight}px` : undefined,
      }}
      rounded={props.imageRounded ?? true}
    >
      <Show when={local.file}>
        <img src={imageSrc()} alt="" />
      </Show>
      <ImageHover aria-hidden="true">
        <Icon name="upload-simple" size={20} />
      </ImageHover>
    </ImagePreview>
  );

  return (
    <>
      <Switch
        fallback={
          <>
            <input ref={inputRef} type="file" onChange={onChange} {...remote} />
            <Show when={local.file?.length || 0 > 0}>
              <Button
                size="icon"
                variant="text"
                onPress={onClear}
                isDisabled={!props.file}
              >
                X
              </Button>
            </Show>
          </>
        }
      >
        <Match when={local.accept === "image/*"}>
          <input
            type="file"
            ref={inputRef}
            class={css({
              display: "none",
            })}
            onChange={onChange}
            accept={ALLOWED_IMAGE_TYPES.join(",")}
            {...remote}
          />
          <Show
            when={props.removeCorner}
            fallback={
              <Row align justify={props.imageJustify ?? true} gap="md">
                {preview()}
                <Show when={props.allowRemoval !== false && props.file}>
                  <IconButton
                    variant="toolbar"
                    size="sm"
                    aria-label={props.removeLabel ?? t`Remove image`}
                    use:floating={{
                      tooltip: {
                        placement: "top",
                        content: props.removeLabel ?? t`Remove image`,
                      },
                    }}
                    onPress={onClear}
                  >
                    <Icon name="trash" size={18} />
                  </IconButton>
                </Show>
              </Row>
            }
          >
            <Framed>
              {preview()}
              <Show when={props.allowRemoval !== false && props.file}>
                <CornerRemove
                  type="button"
                  aria-label={props.removeLabel ?? t`Remove image`}
                  title={props.removeLabel ?? t`Remove image`}
                  onClick={onClear}
                >
                  <Icon name="trash" size={14} />
                </CornerRemove>
              </Show>
            </Framed>
          </Show>
        </Match>
      </Switch>
    </>
  );
}

const ImagePreview = styled("div", {
  base: {
    cursor: "pointer",
    position: "relative",
    height: "96px",
    flexShrink: 0,
    overflow: "hidden",

    backgroundColor: "var(--z-bg-input)",
    border: "1px solid var(--z-border-strong)",

    "&[data-empty='true']": {
      borderStyle: "dashed",
    },

    "& img": {
      display: "block",
      height: "100%",
      width: "100%",

      objectFit: "cover",
    },

    "&:hover > :last-child, &:focus-visible > :last-child, &[data-empty='true'] > :last-child":
      {
        opacity: 1,
      },
    _focusVisible: {
      outline: "none",
      boxShadow: "var(--z-focus-ring)",
    },
  },
  variants: {
    rounded: {
      true: {
        borderRadius: "50%",
      },
      false: {
        borderRadius: "10px",
      },
    },
  },
});

/**
 * "Upload" affordance shown on hover/focus, and always when empty
 */
const ImageHover = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    opacity: 0,
    transition: "opacity 0.12s ease",
    color: "#fff",
    "--z-icon-color": "currentColor",
    background: "rgba(8, 10, 14, 0.5)",

    "[data-empty='true'] > &": {
      color: "var(--z-fg-muted)",
      background: "transparent",
    },
  },
});

/** the image with its remove button on the corner */
const Framed = styled("div", {
  base: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
  },
});

/** a small round button on the image's top corner */
const CornerRemove = styled("button", {
  base: {
    position: "absolute",
    top: "-4px",
    insetInlineEnd: "-4px",
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    borderRadius: "50%",
    border: "1px solid var(--z-border-strong)",
    background: "var(--z-bg-raised, var(--z-surface-raised))",
    color: "var(--z-fg-secondary)",
    "--z-icon-color": "currentColor",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgb(0 0 0 / 30%)",
    transition: "color var(--z-motion-fast, 120ms) ease",
    _hover: { color: "var(--z-danger)" },
    _focusVisible: { outline: "2px solid var(--z-focus, var(--z-accent))" },
  },
});
