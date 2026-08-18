import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import type {
  CreateInventoryProductRequest,
  InventoryCustomerSaleRequest,
  InventoryDashboardResponse,
  InventoryInboundRequest,
  InventoryInternalUseRequest,
  InventoryMutationResponse,
  OperatingAnalyticsRange,
  OperatingAnalyticsResponse,
  ServiceActor,
  UpdateInventoryProductCostRequest,
} from '@shared/api.interface';
import {
  FRONT_DESK_ROLE,
  STORE_OWNER_ROLE,
} from '../../../shared/role.constants';
import { InventoryService } from './inventory.service';
import { OperatingAnalyticsService } from './operating-analytics.service';

@Controller('api/inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly operatingAnalyticsService: OperatingAnalyticsService,
  ) {}

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get()
  async dashboard(
    @Req() request: Request,
  ): Promise<InventoryDashboardResponse> {
    const response: InventoryDashboardResponse =
      await this.inventoryService.dashboard();
    const isOwner: boolean =
      this.getActor(request).roles?.includes(STORE_OWNER_ROLE) || false;
    if (isOwner) return response;
    return {
      ...response,
      summary: { ...response.summary, stockCostValueExact: '0.00' },
      products: response.products.map((product) => ({
        ...product,
        purchaseCostExact: '0.00',
      })),
      movements: response.movements.map((movement) => ({
        ...movement,
        unitCostExact: '0.00',
      })),
    };
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('products')
  async createProduct(
    @Req() request: Request,
    @Body() body: CreateInventoryProductRequest,
  ): Promise<InventoryMutationResponse> {
    return this.inventoryService.createProduct(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Put('products/:productId/cost')
  async updateProductCost(
    @Param('productId') productId: string,
    @Body() body: UpdateInventoryProductCostRequest,
  ): Promise<InventoryMutationResponse> {
    return this.inventoryService.updateProductCost(productId, body);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Get('operating-analytics')
  async operatingAnalytics(
    @Query('range') rangeValue?: string,
  ): Promise<OperatingAnalyticsResponse> {
    const allowed: OperatingAnalyticsRange[] = [
      'today',
      'month',
      'quarter',
      'half_year',
      'year',
      'all',
    ];
    const range: OperatingAnalyticsRange = allowed.includes(
      rangeValue as OperatingAnalyticsRange,
    )
      ? (rangeValue as OperatingAnalyticsRange)
      : 'month';
    return this.operatingAnalyticsService.dashboard(range);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('inbound')
  async inbound(
    @Req() request: Request,
    @Body() body: InventoryInboundRequest,
  ): Promise<InventoryMutationResponse> {
    return this.inventoryService.inbound(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('internal-use')
  async internalUse(
    @Req() request: Request,
    @Body() body: InventoryInternalUseRequest,
  ): Promise<InventoryMutationResponse> {
    return this.inventoryService.internalUse(body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post('customer-sale')
  async customerSale(
    @Req() request: Request,
    @Body() body: InventoryCustomerSaleRequest,
  ): Promise<InventoryMutationResponse> {
    return this.inventoryService.customerSale(body, this.getActor(request));
  }

  private getActor(request: Request): ServiceActor {
    const roles: string[] = Array.isArray(request.userContext?.roles)
      ? request.userContext.roles.filter(
          (role: unknown): role is string => typeof role === 'string',
        )
      : [];
    return {
      displayName: request.userContext?.userName || '门店操作员',
      userId: request.userContext?.userId || undefined,
      roles,
    };
  }
}
