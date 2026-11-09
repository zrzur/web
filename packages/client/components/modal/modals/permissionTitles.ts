import { useLingui } from "@lingui/solid/macro";

/**
 * A plain name for every server permission, the same words as the role
 * editor, for the add dialog and the app page
 */
export function usePermissionTitles() {
  const { t } = useLingui();
  const names: Record<number, string> = {
    0: t`Manage channel`,
    1: t`Manage server`,
    2: t`Manage permissions`,
    3: t`Manage roles`,
    4: t`Manage customisation`,
    6: t`Kick members`,
    7: t`Ban members`,
    8: t`Timeout members`,
    9: t`Assign roles`,
    10: t`Change nickname`,
    11: t`Manage nicknames`,
    12: t`Change avatar`,
    13: t`Remove avatars`,
    20: t`View channel`,
    21: t`Read message history`,
    22: t`Send messages`,
    23: t`Manage messages`,
    24: t`Manage webhooks`,
    25: t`Invite others`,
    26: t`Send embeds`,
    27: t`Upload files`,
    28: t`Masquerade`,
    29: t`React`,
    30: t`Connect`,
    31: t`Speak`,
    32: t`Video`,
    33: t`Mute members`,
    34: t`Deafen members`,
    35: t`Move members`,
    36: t`Listen`,
    37: t`Mention everyone`,
    38: t`Mention roles`,
    39: t`Bypass slowmode`,
    40: t`View audit log`,
    41: t`Use emojis from other servers`,
    42: t`Manage join requests`,
    43: t`Create threads`,
    44: t`Send messages in threads`,
    45: t`Create forum posts`,
  };
  const groups: Record<string, string> = {
    server: t`Server`,
    members: t`Members`,
    messages: t`Messages`,
    voice: t`Voice`,
    other: t`Other`,
  };
  return {
    name: (bit: number) => {
      const n = Math.round(Math.log2(bit));
      return names[n] ?? t`Permission number ${n}`;
    },
    group: (id: string) => groups[id] ?? id,
  };
}
