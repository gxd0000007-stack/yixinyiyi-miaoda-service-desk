import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { OperatingAnalyticsService } from './operating-analytics.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, OperatingAnalyticsService],
  exports: [InventoryService],
})
export class InventoryModule {}
