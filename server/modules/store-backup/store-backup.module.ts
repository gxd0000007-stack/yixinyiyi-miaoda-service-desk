import { Module } from '@nestjs/common';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';

import { StoreBackupController, STORE_BACKUP_SERVICE } from './store-backup.controller';
import { DrizzleStoreBackupAdapter } from './store-backup.drizzle-adapter';
import { StoreBackupService } from './store-backup.service';

@Module({
  controllers: [StoreBackupController],
  providers: [
    {
      provide: STORE_BACKUP_SERVICE,
      inject: [DRIZZLE_DATABASE],
      useFactory: (database: PostgresJsDatabase) =>
        new StoreBackupService(new DrizzleStoreBackupAdapter(database)),
    },
  ],
})
export class StoreBackupModule {}
