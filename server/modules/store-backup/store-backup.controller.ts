import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Post,
} from '@nestjs/common';
import { CanRole, NeedLogin } from '@lark-apaas/fullstack-nestjs-core';

import { STORE_OWNER_ROLE } from '../../../shared/role.constants';
import {
  type StoreBackup,
  StoreBackupService,
} from './store-backup.service';

export const STORE_BACKUP_SERVICE = 'STORE_BACKUP_SERVICE';

@Controller('api/store-backup')
export class StoreBackupController {
  constructor(
    @Inject(STORE_BACKUP_SERVICE)
    private readonly service: StoreBackupService,
  ) {}

  @Get('export')
  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  exportBackup(): Promise<StoreBackup> {
    return this.service.exportBackup();
  }

  @Post('restore')
  @NeedLogin()
  @CanRole([STORE_OWNER_ROLE])
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async restoreBackup(
    @Headers('x-confirm-empty-store') confirmation: string,
    @Body() backup: StoreBackup,
  ): Promise<{ restoredTables: number; restoredRows: number }> {
    if (confirmation !== 'RESTORE_EMPTY_STORE') {
      throw new BadRequestException(
        'restore requires X-Confirm-Empty-Store: RESTORE_EMPTY_STORE',
      );
    }
    return this.service.restoreBackup(backup);
  }
}
