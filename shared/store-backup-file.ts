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

export type ParsedStoreBackup = {
  backup: StoreBackup;
  totalRows: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseStoreBackupJson(source: string): ParsedStoreBackup {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('文件不是有效的 JSON 备份');
  }

  if (
    !isRecord(value) ||
    value.format !== 'yixinyiyi-store-backup' ||
    value.formatVersion !== 1 ||
    typeof value.schemaVersion !== 'string' ||
    typeof value.generatedAt !== 'string' ||
    typeof value.checksum !== 'string' ||
    !Array.isArray(value.tables)
  ) {
    throw new Error('不是壹心壹意门店备份文件');
  }

  const names = value.tables.map((table) =>
    isRecord(table) ? table.name : undefined,
  );
  if (JSON.stringify(names) !== JSON.stringify(STORE_BACKUP_TABLES)) {
    throw new Error('备份数据表不完整或顺序不正确');
  }

  let totalRows = 0;
  for (const table of value.tables) {
    if (
      !isRecord(table) ||
      typeof table.rowCount !== 'number' ||
      !Number.isSafeInteger(table.rowCount) ||
      table.rowCount < 0 ||
      !Array.isArray(table.rows) ||
      table.rowCount !== table.rows.length ||
      typeof table.checksum !== 'string'
    ) {
      throw new Error('备份行数校验失败');
    }
    totalRows += table.rowCount;
  }

  return { backup: value as StoreBackup, totalRows };
}

export function canRestoreStoreBackup(
  parsed: ParsedStoreBackup | null,
  confirmation: string,
  busy: boolean,
): boolean {
  return Boolean(parsed) && confirmation === '确认恢复门店数据' && !busy;
}

export function buildStoreBackupFileName(backup: StoreBackup): string {
  const timestamp = backup.generatedAt
    .replace(/\.\d{3}Z$/u, 'Z')
    .replace(/[-:]/gu, '');
  return `yixinyiyi-store-backup-${timestamp}.json`;
}
