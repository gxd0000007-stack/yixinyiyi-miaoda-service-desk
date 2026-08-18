import { Body, Controller, Get, Post } from '@nestjs/common';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import type {
  CardPackageCatalogResponse,
  CardPackageMutationResponse,
  CreateCardPackageRequest,
  CreateServiceProjectRequest,
  ServiceProjectMutationResponse,
} from '@shared/api.interface';
import { FRONT_DESK_ROLE, STORE_OWNER_ROLE } from '@shared/role.constants';
import { CardItemService } from './card-item.service';

@Controller('api/card-items')
export class CardItemController {
  constructor(private readonly cardItemService: CardItemService) {}

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get()
  async catalog(): Promise<CardPackageCatalogResponse> {
    return this.cardItemService.catalog();
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('packages')
  async createPackage(
    @Body() body: CreateCardPackageRequest,
  ): Promise<CardPackageMutationResponse> {
    return this.cardItemService.createPackage(body);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('projects')
  async createProject(
    @Body() body: CreateServiceProjectRequest,
  ): Promise<ServiceProjectMutationResponse> {
    return this.cardItemService.createProject(body);
  }
}
