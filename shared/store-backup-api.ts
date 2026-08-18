import type { StoreBackup } from './store-backup-file';

export type StoreBackupRestoreResult = {
  restoredTables: number;
  restoredRows: number;
};

export type StoreBackupRequest = {
  url: string;
  method: 'GET' | 'POST';
  data?: unknown;
  headers?: Record<string, string>;
};

export type StoreBackupTransport = <T>(
  request: StoreBackupRequest,
) => Promise<{ data: T }>;

export function createStoreBackupApi(transport: StoreBackupTransport) {
  return {
    async exportStoreBackup(): Promise<StoreBackup> {
      const response = await transport<StoreBackup>({
        url: '/api/store-backup/export',
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      return response.data;
    },

    async restoreStoreBackup(
      backup: StoreBackup,
    ): Promise<StoreBackupRestoreResult> {
      const response = await transport<StoreBackupRestoreResult>({
        url: '/api/store-backup/restore',
        method: 'POST',
        data: backup,
        headers: {
          'X-Confirm-Empty-Store': 'RESTORE_EMPTY_STORE',
        },
      });
      return response.data;
    },
  };
}
