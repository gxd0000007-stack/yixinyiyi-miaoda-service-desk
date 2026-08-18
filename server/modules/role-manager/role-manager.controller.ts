import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  AuthorizationSDK,
  CanRole,
  NeedLogin,
} from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import {
  FRONT_DESK_ROLE,
  NURSE_ROLE,
  SKIN_MANAGER_ROLE,
  STORE_OWNER_ROLE,
} from '../../../shared/role.constants';

import {
  AddMembersDto,
  CreateRoleDto,
  ListMembersQueryDto,
  RemoveMembersDto,
  SearchDto,
  UpdateRoleDto,
} from './role-manager.dto';

const FRONT_DESK_MANAGEABLE_ROLES = new Set([
  FRONT_DESK_ROLE,
  SKIN_MANAGER_ROLE,
  NURSE_ROLE,
]);

@Controller('api/role_manager')
export class RoleManagerController {
  constructor(private readonly authzSDK: AuthorizationSDK) {}

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get('roles')
  listRoles() {
    return this.authzSDK.roles.list({ needMember: true });
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get('roles/:bizID')
  getRole(@Param('bizID') bizID: string) {
    return this.authzSDK.roles.get(bizID);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.authzSDK.roles.create(dto);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Put('roles/:bizID')
  updateRole(
    @Param('bizID') bizID: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authzSDK.roles.update(bizID, dto);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Delete('roles/:bizID')
  deleteRole(@Param('bizID') bizID: string) {
    return this.authzSDK.roles.delete(bizID);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get('roles/:bizID/members')
  listMembers(
    @Req() request: Request,
    @Param('bizID') bizID: string,
    @Query() query: ListMembersQueryDto,
  ) {
    this.ensureRoleCanBeManaged(request, bizID);
    return this.authzSDK.members.list(bizID, query);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('roles/:bizID/members')
  addMembers(
    @Req() request: Request,
    @Param('bizID') bizID: string,
    @Body() dto: AddMembersDto,
  ) {
    this.ensureRoleCanBeManaged(request, bizID);
    return this.authzSDK.members.add(bizID, dto);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('roles/:bizID/members/batch_remove')
  removeMembers(
    @Req() request: Request,
    @Param('bizID') bizID: string,
    @Body() dto: RemoveMembersDto,
  ) {
    this.ensureRoleCanBeManaged(request, bizID);
    return this.authzSDK.members.remove(bizID, dto);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Delete('roles/:bizID/members')
  clearMembers(@Req() request: Request, @Param('bizID') bizID: string) {
    this.ensureRoleCanBeManaged(request, bizID);
    return this.authzSDK.members.clear(bizID);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('search')
  search(@Body() dto: SearchDto) {
    return this.authzSDK.search.search(dto);
  }

  private ensureRoleCanBeManaged(request: Request, bizID: string): void {
    const roles: string[] = Array.isArray(request.userContext?.roles)
      ? request.userContext.roles.filter(
          (role: unknown): role is string => typeof role === 'string',
        )
      : [];
    if (roles.includes(STORE_OWNER_ROLE)) return;
    if (!FRONT_DESK_MANAGEABLE_ROLES.has(bizID)) {
      throw new ForbiddenException('前台不能修改老板或系统管理角色');
    }
  }
}
