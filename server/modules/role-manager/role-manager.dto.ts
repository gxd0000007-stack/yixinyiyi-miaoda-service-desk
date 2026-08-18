import type {
  FilterParams,
  MemberMutationData,
  MemberType,
} from '@lark-apaas/fullstack-nestjs-core';

export class CreateRoleDto {
  role!: { name: string; description?: string; bizID: string };
  userID?: string;
}

export class UpdateRoleDto {
  role!: { name?: string; description?: string };
  userID?: string;
}

export class AddMembersDto {
  members!: MemberMutationData;
  userID?: string;
}

export class RemoveMembersDto {
  members!: MemberMutationData;
  userID?: string;
}

export class SearchDto {
  query!: string;
  filters?: FilterParams;
  includeExternalUser?: boolean;
  includeExternalGroup?: boolean;
  pageSize?: number;
  page?: number;
  userID?: string;
}

export class ListMembersQueryDto {
  type?: MemberType;
  page?: number;
  pageSize?: number;
}
