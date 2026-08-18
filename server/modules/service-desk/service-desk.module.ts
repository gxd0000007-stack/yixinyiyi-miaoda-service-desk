import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CustomerAssetModule } from '../customer-asset/customer-asset.module';
import { CustomerReminderService } from './customer-reminder.service';
import { ServiceDeskAutomation } from './service-desk.automation';
import { ServiceDeskController } from './service-desk.controller';
import { ServiceDeskService } from './service-desk.service';

@Module({
  imports: [HttpModule, CustomerAssetModule],
  controllers: [ServiceDeskController],
  providers: [
    ServiceDeskService,
    CustomerReminderService,
    ServiceDeskAutomation,
  ],
})
export class ServiceDeskModule {}
