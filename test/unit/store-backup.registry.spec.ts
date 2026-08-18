import { getTableName } from 'drizzle-orm';
import { STORE_BACKUP_TABLES } from '../../server/modules/store-backup/store-backup.service';
import { STORE_BACKUP_TABLE_REGISTRY } from '../../server/modules/store-backup/store-backup.drizzle-adapter';

describe('store backup database registry', () => {
  it('maps every backup name to the matching physical table', () => {
    expect(Object.keys(STORE_BACKUP_TABLE_REGISTRY)).toEqual(
      STORE_BACKUP_TABLES,
    );
    expect(
      STORE_BACKUP_TABLES.map((name) =>
        getTableName(STORE_BACKUP_TABLE_REGISTRY[name]),
      ),
    ).toEqual(STORE_BACKUP_TABLES);
  });
});
