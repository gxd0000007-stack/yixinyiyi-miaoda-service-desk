import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import type { Request } from 'express';

import { isStoreOwner } from '@server/common/utils/store-owner';
import type {
  CustomerAssetDetailResponse,
  CustomerLedgerResponse,
  CustomerCardWalletResponse,
  CustomerCardOperationResponse,
  CustomerAssetSegmentsResponse,
  CustomerAssetsResponse,
  CreateCustomerAssetRequest,
  CreateCustomerAssetResponse,
  ServiceActor,
  DeductCustomerCardRequest,
  DeductCustomerCardResponse,
  BatchSettleCustomerCardRequest,
  GrantCustomerCashVoucherRequest,
  CreateCustomerCardRequest,
  PurchaseWithCustomerBalanceRequest,
  RechargeCustomerCardRequest,
  ReverseCustomerCardRequest,
  ReverseCustomerCardOperationRequest,
  ReverseCustomerCardResponse,
  UpdateCustomerAssetSupplementRequest,
  UpdateCustomerAssetSupplementResponse,
} from '@shared/api.interface';
import {
  FRONT_DESK_ROLE,
  STORE_OWNER_ROLE,
  isFrontDeskRole,
} from '../../../shared/role.constants';
import { CustomerAssetCreationService } from './customer-asset-creation.service';
import { CustomerAssetService } from './customer-asset.service';
import { CustomerCardWalletService } from './customer-card-wallet.service';
import { CustomerLedgerService } from './customer-ledger.service';

@Controller('api/customer-assets')
export class CustomerAssetController {
  constructor(
    private readonly customerAssetService: CustomerAssetService,
    private readonly creationService: CustomerAssetCreationService,
    private readonly ledgerService: CustomerLedgerService,
    private readonly cardWalletService: CustomerCardWalletService,
  ) {}

  @NeedLogin()
  @Get()
  async findAll(
    @Req() request: Request,
    @Query('query') query = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '24',
  ): Promise<CustomerAssetsResponse> {
    this.assertCustomerManager(request);
    return this.customerAssetService.findAll(
      query,
      Number.parseInt(page, 10) || 1,
      Number.parseInt(pageSize, 10) || 24,
    );
  }

  @NeedLogin()
  @Get('segments')
  async findSegments(
    @Req() request: Request,
  ): Promise<CustomerAssetSegmentsResponse> {
    this.assertCustomerManager(request);
    return this.customerAssetService.findSegments();
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get('checkout-search')
  async searchForCheckout(
    @Query('query') query = '',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
  ): Promise<CustomerAssetsResponse> {
    return this.customerAssetService.findAll(
      query,
      Number.parseInt(page, 10) || 1,
      Number.parseInt(pageSize, 10) || 12,
    );
  }

  @NeedLogin()
  @Post()
  async create(
    @Req() request: Request,
    @Body() body: CreateCustomerAssetRequest,
  ): Promise<CreateCustomerAssetResponse> {
    const actor: ServiceActor = this.assertCustomerManager(request);
    const created = await this.creationService.create(body, actor);
    await this.cardWalletService.findWallet(created.id);
    return {
      saved: true,
      asset: await this.customerAssetService.findDetail(created.id),
    };
  }

  @NeedLogin()
  @Get(':id/ledger')
  async findLedger(
    @Req() request: Request,
    @Param('id') id: string,
    @Query('query') query = '',
    @Query('filter') filter = 'all',
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
  ): Promise<CustomerLedgerResponse> {
    this.assertCustomerManager(request);
    return this.ledgerService.findLedger(
      id,
      query,
      filter,
      Number.parseInt(page, 10) || 1,
      Number.parseInt(pageSize, 10) || 12,
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get(':id/card-wallet')
  async findCardWallet(
    @Param('id') id: string,
  ): Promise<CustomerCardWalletResponse> {
    return this.cardWalletService.findWallet(id);
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Get(':id/checkout-detail')
  async findCheckoutDetail(
    @Param('id') id: string,
  ): Promise<CustomerAssetDetailResponse> {
    return { asset: await this.customerAssetService.findDetail(id) };
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/deductions')
  async deductCard(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: DeductCustomerCardRequest,
  ): Promise<DeductCustomerCardResponse> {
    return this.cardWalletService.deduct(id, body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/settlements')
  async settleCards(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: BatchSettleCustomerCardRequest,
  ): Promise<CustomerCardOperationResponse> {
    return this.cardWalletService.settleBatch(id, body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/cash-vouchers')
  async grantCashVoucher(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: GrantCustomerCashVoucherRequest,
  ): Promise<CustomerCardWalletResponse> {
    return this.cardWalletService.grantCashVoucher(
      id,
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/cards')
  async createCard(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: CreateCustomerCardRequest,
  ): Promise<CustomerCardOperationResponse> {
    return this.cardWalletService.createCard(id, body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/recharges')
  async rechargeCard(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: RechargeCustomerCardRequest,
  ): Promise<CustomerCardOperationResponse> {
    return this.cardWalletService.recharge(id, body, this.getActor(request));
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/purchases')
  async purchaseWithBalance(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: PurchaseWithCustomerBalanceRequest,
  ): Promise<CustomerCardOperationResponse> {
    return this.cardWalletService.purchaseWithBalance(
      id,
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/operations/:operationNo/reversals')
  async reverseCardOperation(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('operationNo') operationNo: string,
    @Body() body: ReverseCustomerCardOperationRequest,
  ): Promise<CustomerCardOperationResponse> {
    return this.cardWalletService.reverseOperation(
      id,
      operationNo,
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE, FRONT_DESK_ROLE])
  @Post(':id/card-wallet/ledger/:transactionId/reversals')
  async reverseCardDeduction(
    @Req() request: Request,
    @Param('id') id: string,
    @Param('transactionId') transactionId: string,
    @Body() body: ReverseCustomerCardRequest,
  ): Promise<ReverseCustomerCardResponse> {
    return this.cardWalletService.reverse(
      id,
      transactionId,
      body,
      this.getActor(request),
    );
  }

  @NeedLogin()
  @Get(':id')
  async findDetail(
    @Req() request: Request,
    @Param('id') id: string,
  ): Promise<CustomerAssetDetailResponse> {
    this.assertCustomerManager(request);
    return { asset: await this.customerAssetService.findDetail(id) };
  }

  @NeedLogin()
  @Patch(':id/supplement')
  async updateSupplement(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() body: UpdateCustomerAssetSupplementRequest,
  ): Promise<UpdateCustomerAssetSupplementResponse> {
    const actor: ServiceActor = this.assertCustomerManager(request);
    return {
      saved: true,
      asset: await this.customerAssetService.updateSupplement(id, body, actor),
    };
  }

  private assertCustomerManager(request: Request): ServiceActor {
    const actor: ServiceActor = this.getActor(request);
    if (!isStoreOwner(actor) && !isFrontDeskRole(actor.roles)) {
      throw new ForbiddenException('只有老板和前台可以管理完整客户资料库');
    }
    return actor;
  }

  private getActor(request: Request): ServiceActor {
    return {
      userId: request.userContext?.userId || undefined,
      displayName: request.userContext?.userName || '门店员工',
      roles: Array.isArray(request.userContext?.roles)
        ? request.userContext.roles.filter(
            (role: unknown): role is string => typeof role === 'string',
          )
        : [],
    };
  }
}
