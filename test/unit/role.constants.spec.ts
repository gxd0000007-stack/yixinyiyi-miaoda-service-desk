import {
  FRONT_DESK_ROLE,
  LEGACY_PUBLIC_OWNER_ROLE,
  NURSE_ROLE,
  SKIN_MANAGER_ROLE,
  STORE_OWNER_ROLE,
  hasAssignedStoreRole,
  isFrontDeskRole,
  isStoreOwnerRole,
  sanitizeStoreRoles,
} from '../../shared/role.constants';

describe('store role permissions', () => {
  it('only treats the private owner role as owner', () => {
    expect(isStoreOwnerRole([STORE_OWNER_ROLE])).toBe(true);
    expect(isStoreOwnerRole([LEGACY_PUBLIC_OWNER_ROLE])).toBe(false);
    expect(
      isStoreOwnerRole([LEGACY_PUBLIC_OWNER_ROLE, SKIN_MANAGER_ROLE]),
    ).toBe(false);
  });

  it('recognizes each configured operating role without elevating it', () => {
    expect(isFrontDeskRole([FRONT_DESK_ROLE])).toBe(true);
    expect(isStoreOwnerRole([FRONT_DESK_ROLE])).toBe(false);
    expect(hasAssignedStoreRole([SKIN_MANAGER_ROLE])).toBe(true);
    expect(hasAssignedStoreRole([NURSE_ROLE])).toBe(true);
    expect(hasAssignedStoreRole([])).toBe(false);
  });

  it('removes the legacy public owner role before roles reach the UI', () => {
    expect(
      sanitizeStoreRoles([LEGACY_PUBLIC_OWNER_ROLE, NURSE_ROLE]),
    ).toEqual([NURSE_ROLE]);
    expect(
      sanitizeStoreRoles([LEGACY_PUBLIC_OWNER_ROLE, FRONT_DESK_ROLE]),
    ).toEqual([FRONT_DESK_ROLE]);
  });
});
