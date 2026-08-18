export const STORE_OWNER_ROLE = 'store_owner_private';
export const LEGACY_PUBLIC_OWNER_ROLE = 'store_owner';
export const FRONT_DESK_ROLE = 'appointment_schedule_editor';
export const SKIN_MANAGER_ROLE = 'skin_manager';
export const NURSE_ROLE = 'nurse';

export const ACTIVE_STORE_ROLES = [
  STORE_OWNER_ROLE,
  FRONT_DESK_ROLE,
  SKIN_MANAGER_ROLE,
  NURSE_ROLE,
] as const;

export const OPERATION_MANAGER_ROLES = [
  STORE_OWNER_ROLE,
  FRONT_DESK_ROLE,
] as const;

export const SERVICE_EXECUTOR_ROLES = [
  SKIN_MANAGER_ROLE,
  NURSE_ROLE,
] as const;

export function hasRole(
  roles: readonly string[] | undefined,
  role: string,
): boolean {
  return roles?.includes(role) === true;
}

export function isStoreOwnerRole(
  roles: readonly string[] | undefined,
): boolean {
  return hasRole(roles, STORE_OWNER_ROLE);
}

export function isFrontDeskRole(
  roles: readonly string[] | undefined,
): boolean {
  return hasRole(roles, FRONT_DESK_ROLE);
}

export function hasAssignedStoreRole(
  roles: readonly string[] | undefined,
): boolean {
  return (
    isStoreOwnerRole(roles) ||
    isFrontDeskRole(roles) ||
    hasRole(roles, SKIN_MANAGER_ROLE) ||
    hasRole(roles, NURSE_ROLE)
  );
}

export function sanitizeStoreRoles(
  roles: readonly string[] | undefined,
): string[] {
  return (roles ?? []).filter((role) =>
    ACTIVE_STORE_ROLES.includes(role as (typeof ACTIVE_STORE_ROLES)[number]),
  );
}
