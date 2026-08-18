import {
  STORE_BACKUP_TABLES,
  type StoreBackup,
  buildStoreBackupFileName,
  canRestoreStoreBackup,
  parseStoreBackupJson,
} from '@shared/store-backup-file';

const checksum = 'a'.repeat(64);

function validBackup(): StoreBackup {
  return {
    format: 'yixinyiyi-store-backup',
    formatVersion: 1,
    schemaVersion: '2026-08-18.009',
    generatedAt: '2026-08-18T11:05:02.184Z',
    tables: STORE_BACKUP_TABLES.map((name) => ({
      name,
      rowCount: 0,
      checksum,
      rows: [],
    })),
    checksum,
  };
}

describe('store backup file safety', () => {
  it('parses the complete store backup registry and reports its row total', () => {
    const payload = validBackup();
    payload.tables[1].rows = [{ id: 1 }];
    payload.tables[1].rowCount = 1;

    const result = parseStoreBackupJson(JSON.stringify(payload));

    expect(result.backup).toEqual(payload);
    expect(result.totalRows).toBe(1);
  });

  it('rejects a file whose table registry is incomplete', () => {
    const payload = validBackup();
    payload.tables.pop();

    expect(() => parseStoreBackupJson(JSON.stringify(payload))).toThrow(
      '备份数据表不完整或顺序不正确',
    );
  });

  it('rejects a row count that does not match the file contents', () => {
    const payload = validBackup();
    payload.tables[0].rowCount = 2;

    expect(() => parseStoreBackupJson(JSON.stringify(payload))).toThrow(
      '备份行数校验失败',
    );
  });

  it('only enables restore after selecting a valid backup and typing the exact confirmation', () => {
    const parsed = parseStoreBackupJson(JSON.stringify(validBackup()));

    expect(canRestoreStoreBackup(parsed, '确认恢复门店数据', false)).toBe(true);
    expect(canRestoreStoreBackup(parsed, '确认恢复', false)).toBe(false);
    expect(canRestoreStoreBackup(null, '确认恢复门店数据', false)).toBe(false);
    expect(canRestoreStoreBackup(parsed, '确认恢复门店数据', true)).toBe(false);
  });

  it('builds a stable filename from the backup generation timestamp', () => {
    expect(buildStoreBackupFileName(validBackup())).toBe(
      'yixinyiyi-store-backup-20260818T110502Z.json',
    );
  });
});
