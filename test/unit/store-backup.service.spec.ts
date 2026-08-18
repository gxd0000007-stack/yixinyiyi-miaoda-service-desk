import {
  STORE_BACKUP_TABLES,
  StoreBackupService,
  type StoreBackupAdapter,
  type StoreBackupTableName,
} from '../../server/modules/store-backup/store-backup.service';

class MemoryBackupAdapter implements StoreBackupAdapter {
  readonly insertedTables: StoreBackupTableName[] = [];
  transactionCount = 0;

  constructor(
    private readonly rows: Partial<Record<StoreBackupTableName, unknown[]>>,
  ) {}

  async readTable(table: StoreBackupTableName): Promise<unknown[]> {
    return structuredClone(this.rows[table] || []);
  }

  async countTable(table: StoreBackupTableName): Promise<number> {
    return (this.rows[table] || []).length;
  }

  async insertRows(
    table: StoreBackupTableName,
    rows: unknown[],
  ): Promise<void> {
    this.insertedTables.push(table);
    this.rows[table] = structuredClone(rows);
  }

  async transaction<T>(
    operation: (adapter: StoreBackupAdapter) => Promise<T>,
  ): Promise<T> {
    this.transactionCount += 1;
    return operation(this);
  }
}

describe('StoreBackupService', () => {
  const generatedAt = new Date('2026-08-18T10:00:00.000Z');

  it('exports every owned table with verifiable counts and checksums', async () => {
    const adapter = new MemoryBackupAdapter({
      customer_asset: [{ id: 'customer-1', customerName: '测试客户' }],
      service_config: [{ configKey: 'chat_url', configValue: 'private' }],
    });
    const service = new StoreBackupService(adapter, () => generatedAt);

    const backup = await service.exportBackup();

    expect(backup.format).toBe('yixinyiyi-store-backup');
    expect(backup.formatVersion).toBe(1);
    expect(backup.generatedAt).toBe('2026-08-18T10:00:00.000Z');
    expect(backup.tables.map((table) => table.name)).toEqual(
      STORE_BACKUP_TABLES,
    );
    expect(
      backup.tables.find((table) => table.name === 'customer_asset'),
    ).toMatchObject({ rowCount: 1 });
    expect(service.validateBackup(backup)).toEqual({
      valid: true,
      totalRows: 2,
    });
  });

  it('detects a changed row before restore', async () => {
    const source = new MemoryBackupAdapter({
      customer_asset: [{ id: 'customer-1', totalSpend: '980.00' }],
    });
    const service = new StoreBackupService(source, () => generatedAt);
    const backup = await service.exportBackup();
    const customerTable = backup.tables.find(
      (table) => table.name === 'customer_asset',
    );
    if (!customerTable) throw new Error('customer table missing');
    customerTable.rows[0] = { id: 'customer-1', totalSpend: '0.00' };

    expect(() => service.validateBackup(backup)).toThrow(
      'customer_asset checksum mismatch',
    );
  });

  it('refuses to mix a backup into a non-empty destination', async () => {
    const sourceService = new StoreBackupService(
      new MemoryBackupAdapter({ service_config: [{ configKey: 'a' }] }),
      () => generatedAt,
    );
    const backup = await sourceService.exportBackup();
    const target = new MemoryBackupAdapter({
      customer_asset: [{ id: 'existing-customer' }],
    });
    const targetService = new StoreBackupService(target, () => generatedAt);

    await expect(targetService.restoreBackup(backup)).rejects.toThrow(
      'destination table customer_asset is not empty',
    );
    expect(target.insertedTables).toEqual([]);
    expect(target.transactionCount).toBe(0);
  });

  it('restores validated rows once in dependency order', async () => {
    const sourceService = new StoreBackupService(
      new MemoryBackupAdapter({
        customer_asset: [{ id: 'customer-1' }],
        customer_card_account: [{ id: 'account-1' }],
      }),
      () => generatedAt,
    );
    const backup = await sourceService.exportBackup();
    const target = new MemoryBackupAdapter({});
    const targetService = new StoreBackupService(target, () => generatedAt);

    const result = await targetService.restoreBackup(backup);

    expect(result).toEqual({ restoredTables: 2, restoredRows: 2 });
    expect(target.insertedTables).toEqual([
      'customer_asset',
      'customer_card_account',
    ]);
    expect(target.transactionCount).toBe(1);
  });
});
