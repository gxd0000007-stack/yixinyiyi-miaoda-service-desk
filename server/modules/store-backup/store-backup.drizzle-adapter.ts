import type { PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { sql } from 'drizzle-orm';
import type { AnyPgTable } from 'drizzle-orm/pg-core';

import {
  cardPackageTemplate,
  customerAsset,
  customerCardAccount,
  customerCardEntitlement,
  customerCardLedger,
  customerCoupon,
  customerImportAudit,
  customerTransaction,
  customerTransactionItem,
  inventoryMovement,
  inventoryProduct,
  pgAudit,
  serviceConfig,
  serviceState,
} from '../../database/schema';

import {
  type StoreBackupAdapter,
  type StoreBackupTableName,
} from './store-backup.service';

export const STORE_BACKUP_TABLE_REGISTRY: Record<
  StoreBackupTableName,
  AnyPgTable
> = {
  card_package_template: cardPackageTemplate,
  customer_asset: customerAsset,
  customer_card_account: customerCardAccount,
  customer_card_entitlement: customerCardEntitlement,
  customer_transaction: customerTransaction,
  customer_transaction_item: customerTransactionItem,
  inventory_product: inventoryProduct,
  inventory_movement: inventoryMovement,
  customer_card_ledger: customerCardLedger,
  customer_coupon: customerCoupon,
  customer_import_audit: customerImportAudit,
  service_config: serviceConfig,
  service_state: serviceState,
  pg_audit: pgAudit,
};

export class DrizzleStoreBackupAdapter implements StoreBackupAdapter {
  constructor(private readonly database: PostgresJsDatabase) {}

  async readTable(table: StoreBackupTableName): Promise<unknown[]> {
    return this.database
      .select()
      .from(STORE_BACKUP_TABLE_REGISTRY[table]);
  }

  async countTable(table: StoreBackupTableName): Promise<number> {
    const [result] = await this.database
      .select({ value: sql<number>`count(*)` })
      .from(STORE_BACKUP_TABLE_REGISTRY[table]);
    return Number(result?.value || 0);
  }

  async insertRows(
    table: StoreBackupTableName,
    rows: unknown[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.database
      .insert(STORE_BACKUP_TABLE_REGISTRY[table])
      .values(rows as never[]);
  }

  async transaction<T>(
    operation: (adapter: StoreBackupAdapter) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) =>
      operation(
        new DrizzleStoreBackupAdapter(transaction as PostgresJsDatabase),
      ),
    );
  }
}
