import type { ServiceActor } from '@shared/api.interface';
import { isStoreOwnerRole } from '../../../shared/role.constants';

export function isStoreOwner(actor: ServiceActor): boolean {
  return isStoreOwnerRole(actor.roles);
}
