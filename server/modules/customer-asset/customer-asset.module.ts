import { Module } from '@nestjs/common';

import { InventoryModule } from '@server/modules/inventory/inventory.module';

import { CustomerAssetCreationService } from './customer-asset-creation.service';
import { CustomerAssetSupplementService } from './customer-asset-supplement.service';
import { CustomerAssetController } from './customer-asset.controller';
import { CustomerAssetService } from './customer-asset.service';
import { CustomerCardWalletOpenApiController } from './customer-card-wallet.openapi.controller';
import { CustomerCardWalletService } from './customer-card-wallet.service';
import { CustomerLedgerService } from './customer-ledger.service';

@Module({
  imports: [InventoryModule],
  controllers: [CustomerAssetController, CustomerCardWalletOpenApiController],
  providers: [
    CustomerAssetService,
    CustomerAssetCreationService,
    CustomerAssetSupplementService,
    CustomerLedgerService,
    CustomerCardWalletService,
  ],
  exports: [CustomerAssetService],
})
export class CustomerAssetModule {}
