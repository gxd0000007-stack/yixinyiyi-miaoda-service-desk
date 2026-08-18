import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { PlatformModule } from '@lark-apaas/fullstack-nestjs-core';

import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { CustomerAssetModule } from './modules/customer-asset/customer-asset.module';
import { ServiceDeskModule } from './modules/service-desk/service-desk.module';
import { RoleManagerModule } from './modules/role-manager/role-manager.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CardItemModule } from './modules/card-item/card-item.module';
import { ViewModule } from './modules/view/view.module';
import { StoreBackupModule } from './modules/store-backup/store-backup.module';

@Module({
  imports: [
    // 平台 Module，提供平台能力
    PlatformModule.forRoot(),
    // ====== @route-section: business-modules START ======
    CustomerAssetModule,
    ServiceDeskModule,
    RoleManagerModule,
    InventoryModule,
    CardItemModule,
    StoreBackupModule,
    // ====== @route-section: business-modules END ======

    // ⚠️ @route-order: last
    // ViewModule is the fallback route module, must be registered last.
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
