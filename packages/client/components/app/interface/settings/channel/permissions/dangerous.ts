/**
 * Permissions that hand out a lot of control. The editor warns when one is
 * allowed, and says so louder when together they make a role an admin.
 */
export const DANGEROUS: Record<string, bigint> = {
  ManageServer: 2n ** 1n,
  ManagePermissions: 2n ** 2n,
  ManageRole: 2n ** 3n,
  BanMembers: 2n ** 7n,
};

export function isDangerous(key: string) {
  return key in DANGEROUS;
}

/** Manage server, permissions and roles together: close to full control */
export function isAdminLike(allow: bigint) {
  const admin =
    DANGEROUS.ManageServer | DANGEROUS.ManagePermissions | DANGEROUS.ManageRole;
  return (allow & admin) === admin;
}
