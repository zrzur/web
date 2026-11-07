import { createFormControl, createFormGroup, IFormGroup } from "solid-forms";
import {
  createEffect,
  createMemo,
  createSignal,
  JSX,
  on,
  onCleanup,
  Show,
} from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { useQueryClient } from "@tanstack/solid-query";
import { API, User, UserProfile } from "@zrzur/sdk/solid";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useError } from "@revolt/i18n";
import { useInstance } from "@revolt/instance";
import {
  Avatar,
  Button,
  Form2,
  humanFileSize,
  SettingsRow,
  SettingsSection,
} from "@revolt/ui";
import { Icon } from "@revolt/ui/icons/Icon";

import { useModals } from "@revolt/modal";
import { cropProcess } from "@revolt/modal/modals/CropProcess";
import { AvatarDecoration } from "@revolt/ui/components/features/profiles/AvatarDecoration";
import {
  NAME_FONTS,
  nameStyle,
  themeColours,
  UserStyle,
  userStyleOf,
} from "@revolt/ui/components/features/profiles/userStyle";
import { useSettingsNavigation } from "../../Settings";

import { useEffectLabels } from "@revolt/ui/components/features/profiles/labels";

import { EffectDialog } from "./EffectDialog";
import {
  DecorationDialog,
  LookRow,
  NameplateDialog,
  NameStyleDialog,
  ThemePicker,
  useStyleLabels,
} from "./StyleEditors";

type AttachedControl<T> = {
  name: string;
  value: T;
};

interface Props {
  user: User;
  profile?: UserProfile;
  attach?: AttachedControl<unknown>[];
  onSubmit?: (g: IFormGroup) => void;
  onReset?: (g: IFormGroup) => void;
  /**
   * Extra sections rendered under "About" (e.g. bot visibility)
   */
  children?: (g: IFormGroup) => JSX.Element;
  /**
   * Show the live profile preview next to the form
   */
  preview?: boolean;
}

/**
 * Profile editor shared by Profile and bot settings:
 * [Images] [About] [extra sections] ........ [live preview]
 * with a save bar that appears once something changed.
 */
export function UserProfileEditor(props: Props) {
  const { t } = useLingui();
  const client = useClient();
  const queryClient = useQueryClient();
  const instance = useInstance();
  const describeError = useError();
  // also used outside the settings modal (bots in the Developer Portal)
  const settingsNavigation = useSettingsNavigation();
  const { openModal } = useModals();

  /* eslint-disable solid/reactivity */
  const editGroup = createFormGroup({
    displayName: createFormControl(props.user.displayName),
    // username: createFormControl(props.user.username),
    avatar: createFormControl<string | File[] | null>(
      props.user.animatedAvatarURL,
    ),
    pronouns: createFormControl<string>(props.user.pronouns),
    banner: createFormControl<string | File[] | null>(null),
    bio: createFormControl(""),
    style: createFormControl<UserStyle>({ ...userStyleOf(props.user) }),
    ...(props.attach
      ? props.attach.reduce(
          (attached, toAttach) => ({
            [toAttach.name]: createFormControl(toAttach.value),
            ...attached,
          }),
          {},
        )
      : {}),
  });
  /* eslint-enable solid/reactivity */

  const [initialBio, setInitialBio] = createSignal<readonly [string]>();
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal<string>();

  // once profile data is loaded, copy it into the form
  createEffect(
    on(
      () => props.profile,
      (profileData) => {
        if (profileData) {
          editGroup.controls.banner.setValue(
            profileData.animatedBannerURL || null,
          );

          editGroup.controls.bio.setValue(profileData.content || "");
          setInitialBio([profileData.content || ""]);
        }
      },
    ),
  );

  function onReset() {
    editGroup.controls.displayName.setValue(props.user.displayName);
    editGroup.controls.avatar.setValue(props.user.animatedAvatarURL);
    editGroup.controls.pronouns.setValue(props.user.pronouns || "");
    editGroup.controls.style.setValue({ ...userStyleOf(props.user) });

    if (props.profile) {
      editGroup.controls.banner.setValue(
        props.profile.animatedBannerURL || null,
      );
      editGroup.controls.bio.setValue(props.profile.content || "");
      setInitialBio([props.profile.content || ""]);
    }

    for (const control of Object.values(editGroup.controls)) {
      control.markDirty(false);
      control.markTouched(false);
    }
    setError(undefined);

    if (props.onReset) {
      props.onReset(editGroup);
    }
  }

  async function onSubmit() {
    const changes: API.DataEditUser = {
      remove: [],
    };

    if (editGroup.controls.displayName.isDirty) {
      if (!editGroup.controls.displayName.value) {
        changes.remove!.push("DisplayName");
      } else {
        changes.display_name = editGroup.controls.displayName.value.trim();
      }
    }

    if (editGroup.controls.avatar.isDirty) {
      if (!editGroup.controls.avatar.value) {
        changes.remove!.push("Avatar");
      } else if (Array.isArray(editGroup.controls.avatar.value)) {
        changes.avatar = await client().uploadFile(
          "avatars",
          editGroup.controls.avatar.value[0],
          instance.mediaUrl,
        );
      }
    }

    if (editGroup.controls.pronouns.isDirty) {
      if (!editGroup.controls.pronouns.value) {
        changes.remove?.push("Pronouns");
      } else {
        changes.pronouns = editGroup.controls.pronouns.value.trim();
      }
    }

    if (editGroup.controls.bio.isDirty) {
      if (!editGroup.controls.bio.value) {
        changes.remove!.push("ProfileContent");
      } else {
        changes.profile ??= {};
        changes.profile.content = editGroup.controls.bio.value;
      }
    }

    if (editGroup.controls.style.isDirty) {
      // an empty style tells the server to remove it
      const style = editGroup.controls.style.value;
      (changes as API.DataEditUser & { style?: UserStyle }).style = {
        ...(style.theme?.length ? { theme: style.theme } : {}),
        ...(style.name_font ? { name_font: style.name_font } : {}),
        ...(style.name_colour?.length
          ? { name_colour: style.name_colour }
          : {}),
        ...(style.decoration ? { decoration: style.decoration } : {}),
        ...(style.nameplate ? { nameplate: style.nameplate } : {}),
        ...(style.effect ? { effect: style.effect } : {}),
        ...(style.effect && style.effect_file
          ? { effect_file: style.effect_file }
          : {}),
      };
    }

    let newBannerUrl: string | null = null;

    if (editGroup.controls.banner.isDirty) {
      if (!editGroup.controls.banner.value) {
        changes.remove!.push("ProfileBackground");
      } else if (Array.isArray(editGroup.controls.banner.value)) {
        changes.profile ??= {};
        changes.profile.background = await client().uploadFile(
          "backgrounds",
          editGroup.controls.banner.value[0],
          instance.mediaUrl,
        );

        newBannerUrl = `${instance.mediaUrl}/backgrounds/${changes.profile.background}`;
      } else {
        newBannerUrl = editGroup.controls.banner.value;
      }
    }

    await props.user.edit(changes);

    if (
      (editGroup.controls.banner.isDirty || editGroup.controls.bio.isDirty) &&
      props.profile
    ) {
      queryClient.setQueryData(["profile", props.user.id], {
        ...props.profile,
        animatedBannerURL: newBannerUrl,
        bannerURL: newBannerUrl,
        content: editGroup.controls.bio.value,
      });
    }

    if (props.onSubmit) {
      props.onSubmit(editGroup);
    }
  }

  async function save() {
    if (saving() || !editGroup.isDirty) return;
    setError(undefined);
    setSaving(true);
    try {
      await onSubmit();
      for (const control of Object.values(editGroup.controls)) {
        control.markDirty(false);
        control.markTouched(false);
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Object URL for a freshly picked file, revoked when replaced
   */
  function previewUrl(value: () => string | File[] | null) {
    const url = createMemo(() => {
      const v = value();
      if (Array.isArray(v)) return URL.createObjectURL(v[0]);
      return v ?? undefined;
    });
    createEffect(
      on(url, (current, previous) => {
        if (previous?.startsWith("blob:") && previous !== current)
          URL.revokeObjectURL(previous);
      }),
    );
    onCleanup(() => {
      const current = url();
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
    });
    return url;
  }

  const avatarUrl = previewUrl(() => editGroup.controls.avatar.value);
  const style = () => editGroup.controls.style.value;
  function setStyle(patch: Partial<UserStyle>) {
    editGroup.controls.style.setValue({ ...style(), ...patch });
    editGroup.controls.style.markDirty(true);
  }
  const [nameDialog, setNameDialog] = createSignal(false);
  const [decorationDialog, setDecorationDialog] = createSignal(false);
  const [nameplateDialog, setNameplateDialog] = createSignal(false);
  const [effectDialog, setEffectDialog] = createSignal(false);
  const effectLabel = useEffectLabels();
  const styleLabels = useStyleLabels();
  const fontLabel = () => {
    const index = NAME_FONTS.findIndex((f) => f.id === style().name_font);
    return index > 0 ? t`Font ` : t`Default font`;
  };
  const colourLabel = () =>
    style().name_colour?.length === 2
      ? t`Gradient`
      : style().name_colour?.length === 1
        ? t`Solid colour`
        : t`No colour`;
  const shownName = () =>
    editGroup.controls.displayName.value?.trim() || props.user.username;
  const previewTheme = (): JSX.CSSProperties | undefined => {
    const theme = themeColours(style());
    if (!theme) return undefined;
    // same colours as the real profile card
    const top = `color-mix(in srgb, ${theme.top} 78%, #11121c)`;
    const bottom = `color-mix(in srgb, ${theme.bottom} 78%, #11121c)`;
    return {
      background: `linear-gradient(180deg, ${top}, ${bottom})`,
      "--preview-ring": "transparent",
      "--z-fg-primary": "#fff",
      "--z-fg-secondary": "rgb(255 255 255 / 85%)",
      "--z-fg-muted": "rgb(255 255 255 / 70%)",
      "--z-border-subtle": "rgb(255 255 255 / 14%)",
    };
  };
  const bannerUrl = previewUrl(() => editGroup.controls.banner.value);

  const avatarLimit = () =>
    instance.limits().file_upload_size_limits["avatars"];
  const bannerLimit = () =>
    instance.limits().file_upload_size_limits["backgrounds"];

  return (
    <Layout data-preview={!!props.preview}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Sections>
          <SettingsSection title={<Trans>Images</Trans>}>
            <MediaRow>
              <MediaSlot>
                <Form2.FileInput
                  control={editGroup.controls.avatar}
                  accept="image/*"
                  label={t`Change avatar`}
                  removeLabel={t`Remove avatar`}
                  imageJustify={false}
                  imageHeight={72}
                  hideMaxSize
                  maxSize={avatarLimit()}
                  process={cropProcess({
                    ratio: 1,
                    ratioLabel: t`Square`,
                    openModal,
                    allowModeToggle: false,
                    dialogTitle: t`Crop avatar`,
                    circularMask: true,
                  })}
                />
              </MediaSlot>
              <MediaText>
                <strong>
                  <Trans>Avatar</Trans>
                </strong>
                <span>
                  <Trans>
                    Recommended: 512 × 512 px (1:1). Up to{" "}
                    {humanFileSize(avatarLimit())}. Cropped to a circle; keep
                    faces and logos in the center.
                  </Trans>
                </span>
              </MediaText>
            </MediaRow>
            <MediaRow>
              <MediaSlot>
                <Form2.FileInput
                  control={editGroup.controls.banner}
                  accept="image/*"
                  label={t`Change banner`}
                  removeLabel={t`Remove banner`}
                  imageAspect="680/240"
                  imageRounded={false}
                  imageJustify={false}
                  imageHeight={56}
                  hideMaxSize
                  maxSize={bannerLimit()}
                  process={cropProcess({
                    ratio: 680 / 240,
                    ratioLabel: t`Banner`,
                    openModal,
                    allowModeToggle: false,
                    dialogTitle: t`Crop banner`,
                  })}
                />
              </MediaSlot>
              <MediaText>
                <strong>
                  <Trans>Banner</Trans>
                </strong>
                <span>
                  <Trans>
                    Recommended: 680 × 240 px (17:6). Up to{" "}
                    {humanFileSize(bannerLimit())}. Edges may be cropped on
                    different screens; keep important details in the center.
                  </Trans>
                </span>
              </MediaText>
            </MediaRow>
          </SettingsSection>

          <Show when={!props.user.bot}>
            <SettingsSection title={<Trans>Look</Trans>}>
              <LookStack>
                <LookRow
                  icon={
                    <AvatarDecoration
                      decoration={style().decoration}
                      file={style().decoration_file}
                      size={26}
                    >
                      <Avatar
                        size={26}
                        src={avatarUrl()}
                        fallback={shownName()}
                      />
                    </AvatarDecoration>
                  }
                  title={<Trans>Avatar decoration</Trans>}
                  value={styleLabels.decoration(style().decoration)}
                  onClick={() => setDecorationDialog(true)}
                />
                <LookRow
                  icon={<Icon name="text-aa" size={20} />}
                  title={<Trans>Name style</Trans>}
                  value={
                    <>
                      {fontLabel()} · {colourLabel()}
                    </>
                  }
                  onClick={() => setNameDialog(true)}
                />
                <LookRow
                  icon={<Icon name="identification-card" size={20} />}
                  title={<Trans>Nameplate</Trans>}
                  value={styleLabels.nameplate(style().nameplate)}
                  onClick={() => setNameplateDialog(true)}
                />
                <LookRow
                  icon={<Icon name="sparkle" size={20} />}
                  title={<Trans>Profile effect</Trans>}
                  value={effectLabel(style().effect)}
                  onClick={() => setEffectDialog(true)}
                />
              </LookStack>
            </SettingsSection>
            <SettingsSection title={<Trans>Profile theme</Trans>}>
              <ThemeBlock>
                <ThemePicker
                  value={style().theme}
                  onChange={(theme) => setStyle({ theme })}
                />
                <ThemeHint>
                  <Trans>
                    Colours your profile card and its banner when you have no
                    picture.
                  </Trans>
                </ThemeHint>
              </ThemeBlock>
            </SettingsSection>
            <Show when={effectDialog()}>
              <EffectDialog
                show={effectDialog()}
                onClose={() => setEffectDialog(false)}
                value={style().effect}
                file={style().effect_file}
                onApply={(effect) =>
                  setStyle({
                    effect,
                    // a creator's effect stays on until another is chosen
                    effect_file:
                      effect === style().effect
                        ? style().effect_file
                        : undefined,
                  })
                }
              />
            </Show>
            <Show when={nameDialog()}>
              <NameStyleDialog
                show={nameDialog()}
                onClose={() => setNameDialog(false)}
                name={shownName()}
                handle={props.user.username}
                avatar={avatarUrl()}
                value={style()}
                onApply={(patch) => setStyle(patch)}
              />
            </Show>
            <Show when={nameplateDialog()}>
              <NameplateDialog
                show={nameplateDialog()}
                onClose={() => setNameplateDialog(false)}
                name={shownName()}
                avatar={avatarUrl()}
                value={style().nameplate}
                file={style().nameplate_file}
                onApply={(nameplate, file) =>
                  setStyle({ nameplate, nameplate_file: file })
                }
              />
            </Show>
            <Show when={decorationDialog()}>
              <DecorationDialog
                show={decorationDialog()}
                onClose={() => setDecorationDialog(false)}
                name={shownName()}
                handle={props.user.username}
                avatar={avatarUrl()}
                style={style()}
                value={style().decoration}
                file={style().decoration_file}
                onApply={(decoration, file) =>
                  setStyle({ decoration, decoration_file: file })
                }
              />
            </Show>
          </Show>

          <SettingsSection title={<Trans>About</Trans>}>
            <FormPanel>
              <Form2.TextField
                minlength={2}
                maxlength={32}
                counter
                name="displayName"
                control={editGroup.controls.displayName}
                label={t`Display name`}
                placeholder={props.user.username}
                helper={t`Shown instead of your username. Leave empty to use your username.`}
              />
              <Form2.TextField
                minlength={1}
                maxlength={24}
                counter
                name="pronouns"
                control={editGroup.controls.pronouns}
                label={t`Pronouns`}
                placeholder={t`e.g. she/her, they/them`}
              />
              <BioField>
                <BioLabel>
                  <Trans>Bio</Trans>
                </BioLabel>
                <Form2.TextEditor
                  ariaLabel={t`Bio`}
                  initialValue={initialBio()}
                  control={editGroup.controls.bio}
                  placeholder={t`Something cool about me...`}
                />
                <BioHint>
                  <Trans>Markdown and emoji are supported.</Trans>
                </BioHint>
              </BioField>
            </FormPanel>
          </SettingsSection>

          {props.children?.(editGroup)}

          <Show when={!props.user.bot}>
            <SettingsSection>
              <SettingsRow
                icon={<Icon name="at" size={20} />}
                title={<Trans>Username</Trans>}
                description={
                  <Trans>
                    {props.user.username}#{props.user.discriminator}. Change it
                    in My Account.
                  </Trans>
                }
                onClick={() => settingsNavigation?.navigate("account")}
                navigational
              />
            </SettingsSection>
          </Show>

          <Show when={editGroup.isDirty || saving() || error()}>
            <SaveBar role="region" aria-label={t`Unsaved changes`}>
              <SaveText data-error={!!error()}>
                <Show when={error()} fallback={<Trans>Unsaved changes</Trans>}>
                  <Icon name="warning-circle" size={18} />
                  {error()}
                </Show>
              </SaveText>
              <Button
                variant="text"
                size="md"
                shape="square"
                isDisabled={saving()}
                onPress={onReset}
              >
                <Trans>Reset</Trans>
              </Button>
              <Button
                type="submit"
                size="md"
                shape="square"
                isDisabled={saving() || !editGroup.isDirty}
              >
                <Show when={saving()} fallback={<Trans>Save changes</Trans>}>
                  <Trans>Saving…</Trans>
                </Show>
              </Button>
            </SaveBar>
          </Show>
        </Sections>
      </form>

      <Show when={props.preview}>
        <PreviewColumn aria-label={t`Profile preview`}>
          <PreviewCaption>
            <Trans>Preview</Trans>
          </PreviewCaption>
          <PreviewCard style={previewTheme()}>
            <PreviewBanner
              style={
                bannerUrl()
                  ? { "background-image": `url("${bannerUrl()}")` }
                  : previewTheme()
                    ? { background: "rgb(255 255 255 / 6%)" }
                    : undefined
              }
            />
            <PreviewBody>
              <PreviewAvatar>
                <AvatarDecoration
                  decoration={style().decoration}
                  file={style().decoration_file}
                  size={72}
                >
                  <Avatar
                    src={avatarUrl()}
                    fallback={
                      editGroup.controls.displayName.value ||
                      props.user.username
                    }
                    size={72}
                  />
                </AvatarDecoration>
              </PreviewAvatar>
              <PreviewName
                style={
                  previewTheme()
                    ? {
                        ...nameStyle(style(), { colour: false }),
                        color: "#fff",
                      }
                    : nameStyle(style())
                }
              >
                {editGroup.controls.displayName.value?.trim() ||
                  props.user.username}
              </PreviewName>
              <PreviewHandle>
                {props.user.username}
                <span>#{props.user.discriminator}</span>
                <Show when={editGroup.controls.pronouns.value?.trim()}>
                  <i aria-hidden="true">·</i>
                  {editGroup.controls.pronouns.value.trim()}
                </Show>
              </PreviewHandle>
              <PreviewDivider />
              <PreviewLabel>
                <Trans>About me</Trans>
              </PreviewLabel>
              <PreviewBio data-empty={!editGroup.controls.bio.value?.trim()}>
                {editGroup.controls.bio.value?.trim() || (
                  <Trans>Nothing here yet.</Trans>
                )}
              </PreviewBio>
            </PreviewBody>
          </PreviewCard>
        </PreviewColumn>
      </Show>
    </Layout>
  );
}

/**
 * Form on the left, preview on the right when there's room; the preview
 * wraps under the form in narrow windows
 */
const Layout = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: "24px",

    "& > form": {
      flex: "1 1 360px",
      minWidth: 0,
    },
  },
});

const Sections = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
});

const MediaRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px",
    flexWrap: "wrap",

    "& + &": {
      borderTop: "1px solid var(--z-border-subtle)",
    },
  },
});

/** The same image column in every row, so the texts line up */
const MediaSlot = styled("div", {
  base: { width: "168px", flexShrink: 0 },
});

const MediaText = styled("div", {
  base: {
    flex: "1 1 180px",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-muted)",

    "& strong": {
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: "20px",
      color: "var(--z-fg-primary)",
    },
  },
});

const FormPanel = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "16px",
  },
});

const BioField = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
});

const BioLabel = styled("div", {
  base: {
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
  },
});

const BioHint = styled("div", {
  base: {
    fontSize: "12px",
    lineHeight: "16px",
    color: "var(--z-fg-muted)",
  },
});

/**
 * Sticky bar at the bottom of the settings scroller while changes are pending
 */
const SaveBar = styled("div", {
  base: {
    position: "sticky",
    bottom: "16px",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 10px 10px 16px",
    borderRadius: "10px",
    border: "1px solid var(--z-popover-border)",
    background: "var(--z-popover-bg)",
    boxShadow: "var(--z-popover-lift)",
  },
});

const SaveText = styled("div", {
  base: {
    flexGrow: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "var(--z-fg-secondary)",

    "&[data-error='true']": {
      color: "var(--z-danger)",
      "--z-icon-color": "var(--z-danger)",
    },
  },
});

const PreviewColumn = styled("aside", {
  base: {
    flex: "0 1 280px",
    minWidth: "240px",
    position: "sticky",
    top: "0",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
});

const PreviewCaption = styled("div", {
  base: {
    paddingInline: "2px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-muted)",
  },
});

const PreviewCard = styled("div", {
  base: {
    overflow: "hidden",
    borderRadius: "12px",
    border: "1px solid var(--z-border-subtle)",
    background: "var(--z-bg-popover)",
    boxShadow: "var(--z-shadow-sm)",
  },
});

const PreviewBanner = styled("div", {
  base: {
    aspectRatio: "680 / 240",
    backgroundColor: "var(--z-bg-raised)",
    backgroundImage:
      "linear-gradient(120deg, color-mix(in srgb, var(--z-accent) 32%, var(--z-bg-raised)), color-mix(in srgb, var(--z-accent) 10%, var(--z-bg-sidebar)))",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
});

const PreviewBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    padding: "0 16px 16px",
  },
});

const PreviewAvatar = styled("div", {
  base: {
    width: "fit-content",
    marginTop: "-40px",
    marginBottom: "8px",
    padding: "4px",
    borderRadius: "50%",
    // ring in the card colour; transparent on a themed card so no gap shows
    background: "var(--preview-ring, var(--z-bg-popover))",
  },
});

const PreviewName = styled("div", {
  base: {
    fontSize: "18px",
    fontWeight: 650,
    lineHeight: "24px",
    color: "var(--z-fg-primary)",
    overflowWrap: "anywhere",
  },
});

const PreviewHandle = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "18px",
    color: "var(--z-fg-secondary)",
    overflowWrap: "anywhere",

    "& span": { color: "var(--z-fg-muted)" },
    "& i": {
      fontStyle: "normal",
      marginInline: "6px",
      color: "var(--z-fg-muted)",
    },
  },
});

const PreviewDivider = styled("hr", {
  base: {
    margin: "14px 0 12px",
    border: "none",
    height: "1px",
    background: "var(--z-border-subtle)",
  },
});

const PreviewLabel = styled("div", {
  base: {
    marginBottom: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--z-fg-secondary)",
  },
});

const PreviewBio = styled("div", {
  base: {
    fontSize: "13px",
    lineHeight: "19px",
    color: "var(--z-fg-primary)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    lineClamp: 8,

    "&[data-empty='true']": {
      color: "var(--z-fg-muted)",
    },
  },
});

const LookStack = styled("div", {
  base: { display: "flex", flexDirection: "column" },
});

const ThemeBlock = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
  },
});

const ThemeHint = styled("p", {
  base: { margin: 0, fontSize: "13px", color: "var(--z-fg-muted)" },
});
