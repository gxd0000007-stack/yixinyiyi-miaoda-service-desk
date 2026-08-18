import { STORE_BACKUP_TABLES, type StoreBackup } from '@shared/store-backup-file';
import {
  createStoreBackupApi,
  type StoreBackupRequest,
} from '@shared/store-backup-api';
const checksum = 'a'.repeat(64);
const backup: StoreBackup = {
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

describe('store backup API client', () => {
  let requests: StoreBackupRequest[];
  let responseData: unknown;
  const request = async <T>(config: StoreBackupRequest): Promise<{ data: T }> => {
    requests.push(config);
    return { data: responseData as T };
  };

  beforeEach(() => {
    requests = [];
  });

  it('exports the owner backup from the no-cache endpoint', async () => {
    responseData = backup;
    const { exportStoreBackup } = createStoreBackupApi(request);

    await expect(exportStoreBackup()).resolves.toEqual(backup);
    expect(requests).toEqual([{
      url: '/api/store-backup/export',
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    }]);
  });

  it('restores the selected backup with the empty-store confirmation header', async () => {
    const result = { restoredTables: 12, restoredRows: 48 };
    responseData = result;
    const { restoreStoreBackup } = createStoreBackupApi(request);

    await expect(restoreStoreBackup(backup)).resolves.toEqual(result);
    expect(requests).toEqual([{
      url: '/api/store-backup/restore',
      method: 'POST',
      data: backup,
      headers: {
        'X-Confirm-Empty-Store': 'RESTORE_EMPTY_STORE',
      },
    }]);
  });
});
