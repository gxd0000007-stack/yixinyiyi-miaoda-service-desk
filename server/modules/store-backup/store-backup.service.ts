export const STORE_BACKUP_TABLES = [
  'card_package_template',
  'customer_asset',
  'customer_card_account',
  'customer_card_entitlement',
  'customer_transaction',
  'customer_transaction_item',
  'inventory_product',
  'inventory_movement',
  'customer_card_ledger',
  'customer_coupon',
  'customer_import_audit',
  'service_config',
  'service_state',
  'pg_audit',
] as const;

export type StoreBackupTableName = (typeof STORE_BACKUP_TABLES)[number];

export type StoreBackupTable = {
  name: StoreBackupTableName;
  rowCount: number;
  checksum: string;
  rows: unknown[];
};

export type StoreBackup = {
  format: 'yixinyiyi-store-backup';
  formatVersion: 1;
  schemaVersion: string;
  generatedAt: string;
  tables: StoreBackupTable[];
  checksum: string;
};

export interface StoreBackupAdapter {
  readTable(table: StoreBackupTableName): Promise<unknown[]>;
  countTable(table: StoreBackupTableName): Promise<number>;
  insertRows(table: StoreBackupTableName, rows: unknown[]): Promise<void>;
  transaction<T>(
    operation: (adapter: StoreBackupAdapter) => Promise<T>,
  ): Promise<T>;
}

const SCHEMA_VERSION = '2026-08-18.009';

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function backupPayload(backup: Omit<StoreBackup, 'checksum'>): unknown {
  return backup;
}

export class StoreBackupService {
  constructor(
    private readonly adapter: StoreBackupAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async exportBackup(): Promise<StoreBackup> {
    const tables: StoreBackupTable[] = [];

    for (const name of STORE_BACKUP_TABLES) {
      const rows = canonicalize(await this.adapter.readTable(name)) as unknown[];
      tables.push({
        name,
        rowCount: rows.length,
        checksum: sha256(rows),
        rows,
      });
    }

    const payload: Omit<StoreBackup, 'checksum'> = {
      format: 'yixinyiyi-store-backup',
      formatVersion: 1,
      schemaVersion: SCHEMA_VERSION,
      generatedAt: this.now().toISOString(),
      tables,
    };
    return { ...payload, checksum: sha256(backupPayload(payload)) };
  }

  validateBackup(backup: StoreBackup): { valid: true; totalRows: number } {
    if (
      backup.format !== 'yixinyiyi-store-backup' ||
      backup.formatVersion !== 1
    ) {
      throw new Error('unsupported backup format');
    }

    const names = backup.tables.map((table) => table.name);
    if (JSON.stringify(names) !== JSON.stringify(STORE_BACKUP_TABLES)) {
      throw new Error('backup table registry mismatch');
    }

    let totalRows = 0;
    for (const table of backup.tables) {
      if (table.rowCount !== table.rows.length) {
        throw new Error(`${table.name} row count mismatch`);
      }
      if (table.checksum !== sha256(table.rows)) {
        throw new Error(`${table.name} checksum mismatch`);
      }
      totalRows += table.rowCount;
    }

    const { checksum, ...payload } = backup;
    if (checksum !== sha256(backupPayload(payload))) {
      throw new Error('backup checksum mismatch');
    }
    return { valid: true, totalRows };
  }

  async restoreBackup(
    backup: StoreBackup,
  ): Promise<{ restoredTables: number; restoredRows: number }> {
    this.validateBackup(backup);

    for (const table of STORE_BACKUP_TABLES) {
      if ((await this.adapter.countTable(table)) > 0) {
        throw new Error(`destination table ${table} is not empty`);
      }
    }

    return this.adapter.transaction(async (adapter) => {
      for (const table of STORE_BACKUP_TABLES) {
        if ((await adapter.countTable(table)) > 0) {
          throw new Error(`destination table ${table} is not empty`);
        }
      }

      let restoredTables = 0;
      let restoredRows = 0;
      for (const table of backup.tables) {
        if (table.rows.length === 0) continue;
        await adapter.insertRows(table.name, table.rows);
        restoredTables += 1;
        restoredRows += table.rows.length;
      }
      return { restoredTables, restoredRows };
    });
  }
}
import { createHash } from 'node:crypto';
