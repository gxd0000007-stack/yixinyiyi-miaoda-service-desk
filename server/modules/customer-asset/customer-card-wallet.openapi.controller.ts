import { Controller, Get, Param } from '@nestjs/common';

import type { CustomerCardWalletResponse } from '@shared/api.interface';
import { CustomerCardWalletService } from './customer-card-wallet.service';

@Controller('openapi/customer-card-wallets')
export class CustomerCardWalletOpenApiController {
  constructor(
    private readonly cardWalletService: CustomerCardWalletService,
  ) {}

  @Get(':customerId')
  async findCustomerCardWallet(
    @Param('customerId') customerId: string,
  ): Promise<CustomerCardWalletResponse> {
    return this.cardWalletService.findWallet(customerId);
  }
}
