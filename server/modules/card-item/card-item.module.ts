import { Module } from '@nestjs/common';

import { CardItemController } from './card-item.controller';
import { CardItemService } from './card-item.service';

@Module({
  controllers: [CardItemController],
  providers: [CardItemService],
  exports: [CardItemService],
})
export class CardItemModule {}
