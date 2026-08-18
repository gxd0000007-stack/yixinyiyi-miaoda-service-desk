import { BadRequestException } from '@nestjs/common';
import { StoreBackupController } from '../../server/modules/store-backup/store-backup.controller';
import {
  StoreBackupService,
  type StoreBackupAdapter,
  type StoreBackupTableName,
} from '../../server/modules/store-backup/store-backup.service';

class ControllerMemoryAdapter implements StoreBackupAdapter {
  constructor(
    private readonly rows: Partial<Record<StoreBackupTableName, unknown[]>>,
  ) {}

  async readTable(table: StoreBackupTableName): Promise<unknown[]> {
    return this.rows[table] || [];
  }

  async countTable(table: StoreBackupTableName): Promise<number> {
    return (this.rows[table] || []).length;
  }

  async insertRows(
    table: StoreBackupTableName,
    rows: unknown[],
  ): Promise<void> {
    this.rows[table] = rows;
  }

  async transaction<T>(
    operation: (adapter: StoreBackupAdapter) => Promise<T>,
  ): Promise<T> {
    return operation(this);
  }
}

describe('StoreBackupController', () => {
  it('exports the complete owner backup envelope', async () => {
    const service = new StoreBackupService(
      new ControllerMemoryAdapter({ customer_asset: [{ id: 'customer-1' }] }),
    );
    const controller = new StoreBackupController(service);

    const backup = await controller.exportBackup();

    expect(backup.format).toBe('yixinyiyi-store-backup');
    expect(
      backup.tables.find((table) => table.name === 'customer_asset')?.rowCount,
    ).toBe(1);
  });

  it('requires the explicit empty-store confirmation before restore', async () => {
    const service = new StoreBackupService(new ControllerMemoryAdapter({}));
    const controller = new StoreBackupController(service);
    const backup = await service.exportBackup();

    await expect(controller.restoreBackup('', backup)).rejects.toEqual(
      new BadRequestException(
        'restore requires X-Confirm-Empty-Store: RESTORE_EMPTY_STORE',
      ),
    );
  });
});
