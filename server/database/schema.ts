/* eslint-disable */
/** auto generated, do not edit */
import { sql } from 'drizzle-orm';
import { bigint, boolean, date, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar, customType } from "drizzle-orm/pg-core"

export const customTimestamptz = customType<{
  data: Date;
  driverData: string;
  config: { precision?: number };
}>({
  dataType(config) {
    const precision = typeof config?.precision !== 'undefined'
      ? ` (${config.precision})`
      : '';
    return `timestamptz${precision}`;
  },
  toDriver(value: Date | string | number) {
    if (value == null) return value as any;
    if (typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    throw new Error('Invalid timestamp value');
  },
  fromDriver(value: string | Date): Date {
    if (value instanceof Date) return value;
    return new Date(value);
  },
});

export const userProfile = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'user_profile';
  },
  toDriver(value: string) {
    return sql`ROW(${value})::user_profile`;
  },
  fromDriver(value: string) {
    const [userId] = value.slice(1, -1).split(',');
    return userId.trim();
  },
});

export type FileAttachment = {
  bucket_id: string;
  file_path: string;
};

export const fileAttachment = customType<{
  data: FileAttachment;
  driverData: string;
}>({
  dataType() {
    return 'file_attachment';
  },
  toDriver(value: FileAttachment) {
    return sql`ROW(${value.bucket_id},${value.file_path})::file_attachment`;
  },
  fromDriver(value: string): FileAttachment {
    const [bucketId, filePath] = value.slice(1, -1).split(',');
    return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
  },
});

export function escapeLiteral(str: string): string {
  return "'" + str.replace(/'/g, "''") + "'";
}

export const userProfileArray = customType<{
  data: string[];
  driverData: string;
}>({
  dataType() {
    return 'user_profile[]';
  },
  toDriver(value: string[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::user_profile[]`;
    }
    const elements = value.map(id => `ROW(${escapeLiteral(id)})::user_profile`).join(',');
    return sql.raw(`ARRAY[${elements}]::user_profile[]`);
  },
  fromDriver(value: string): string[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => m.slice(1, -1).split(',')[0].trim());
  },
});

export const fileAttachmentArray = customType<{
  data: FileAttachment[];
  driverData: string;
}>({
  dataType() {
    return 'file_attachment[]';
  },
  toDriver(value: FileAttachment[]) {
    if (!value || value.length === 0) {
      return sql`'{}'::file_attachment[]`;
    }
    const elements = value.map(f =>
      `ROW(${escapeLiteral(f.bucket_id)},${escapeLiteral(f.file_path)})::file_attachment`
    ).join(',');
    return sql.raw(`ARRAY[${elements}]::file_attachment[]`);
  },
  fromDriver(value: string): FileAttachment[] {
    if (!value || value === '{}') return [];
    const inner = value.slice(1, -1);
    const matches = inner.match(/\([^)]*\)/g) || [];
    return matches.map(m => {
      const [bucketId, filePath] = m.slice(1, -1).split(',');
      return { bucket_id: bucketId.trim(), file_path: filePath.trim() };
    });
  },
});

export const opType = pgEnum("op_type", ['INSERT', 'UPDATE', 'DELETE']);

export const cardPackageTemplate = pgTable("card_package_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageNo: varchar("package_no", { length: 80 }).notNull().unique(),
  packageName: varchar("package_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default('活动套餐'),
  retailPriceCents: bigint("retail_price_cents", { mode: 'number' }).notNull().default(0),
  discountBasisPoints: integer("discount_basis_points").notNull().default(10000),
  validDays: integer("valid_days"),
  description: text("description"),
  /**
   * @type { projectId: string; projectName: string; category: string; unitPriceExact: string; quantity: number; }
   */
  components: jsonb("components").notNull().default('[]'),
  status: varchar("status", { length: 40 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("card_package_template_package_no_key").on(table.packageNo),
  uniqueIndex("uk_card_package_template_no").on(table.packageNo),
  index("idx_card_package_template_status_time").on(table.status, table.updatedAt),
  index("idx_card_package_template_category").on(table.category, table.status),
]);

export const inventoryMovement = pgTable("inventory_movement", {
  id: uuid("id").primaryKey().defaultRandom(),
  movementNo: varchar("movement_no", { length: 80 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull().unique(),
  productId: uuid("product_id").notNull(),
  movementType: varchar("movement_type", { length: 40 }).notNull(),
  quantity: numeric("quantity").notNull(),
  deltaQuantity: numeric("delta_quantity").notNull(),
  unitCostCents: bigint("unit_cost_cents", { mode: 'number' }).notNull().default(0),
  listPriceCents: bigint("list_price_cents", { mode: 'number' }).notNull().default(0),
  discountBasisPoints: integer("discount_basis_points").notNull().default(10000),
  actualAmountCents: bigint("actual_amount_cents", { mode: 'number' }).notNull().default(0),
  customerAssetId: uuid("customer_asset_id"),
  customerName: varchar("customer_name", { length: 255 }),
  recipientName: varchar("recipient_name", { length: 255 }),
  purpose: text("purpose"),
  supplier: varchar("supplier", { length: 255 }),
  batchNo: varchar("batch_no", { length: 120 }),
  expiresOn: date("expires_on"),
  note: text("note"),
  operatorUserId: varchar("operator_user_id", { length: 255 }),
  operatorName: varchar("operator_name", { length: 255 }).notNull(),
  occurredAt: customTimestamptz("occurred_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_inventory_movement_no").on(table.movementNo),
  uniqueIndex("uk_inventory_movement_idempotency").on(table.idempotencyKey),
  index("idx_inventory_movement_product_time").on(table.productId, table.occurredAt),
  index("idx_inventory_movement_type_time").on(table.movementType, table.occurredAt),
  index("idx_inventory_movement_customer_time").on(table.customerAssetId, table.occurredAt),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [inventoryProduct.id],
    name: "inventory_movement_product_id_fkey",
  }),
  foreignKey({
    columns: [table.customerAssetId],
    foreignColumns: [customerAsset.id],
    name: "inventory_movement_customer_asset_id_fkey",
  }),
]);

export const inventoryProduct = pgTable("inventory_product", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcode: varchar("barcode", { length: 120 }).notNull().unique(),
  sku: varchar("sku", { length: 120 }).unique(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default('零售产品'),
  unit: varchar("unit", { length: 40 }).notNull().default('件'),
  purchaseCostCents: bigint("purchase_cost_cents", { mode: 'number' }).notNull().default(0),
  retailPriceCents: bigint("retail_price_cents", { mode: 'number' }).notNull().default(0),
  defaultDiscountBasisPoints: integer("default_discount_basis_points").notNull().default(10000),
  safetyStock: numeric("safety_stock").notNull().default('0'),
  supplier: varchar("supplier", { length: 255 }),
  note: text("note"),
  status: varchar("status", { length: 40 }).notNull().default('active'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_inventory_product_barcode").on(table.barcode),
  uniqueIndex("uk_inventory_product_sku").on(table.sku),
  index("idx_inventory_product_category_status").on(table.category, table.status),
]);

export const customerCardLedger = pgTable("customer_card_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionNo: varchar("transaction_no", { length: 80 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull().unique(),
  customerAssetId: uuid("customer_asset_id").notNull(),
  accountId: uuid("account_id").notNull(),
  entitlementId: uuid("entitlement_id"),
  appointmentId: varchar("appointment_id", { length: 80 }),
  transactionType: varchar("transaction_type", { length: 40 }).notNull(),
  deductionMode: varchar("deduction_mode", { length: 40 }).notNull(),
  projectName: varchar("project_name", { length: 500 }).notNull(),
  amountCents: bigint("amount_cents", { mode: 'number' }).notNull().default(0),
  quantity: integer("quantity").notNull().default(0),
  deltaAmountCents: bigint("delta_amount_cents", { mode: 'number' }).notNull().default(0),
  deltaQuantity: integer("delta_quantity").notNull().default(0),
  beforeAmountCents: bigint("before_amount_cents", { mode: 'number' }),
  afterAmountCents: bigint("after_amount_cents", { mode: 'number' }),
  beforeQuantity: integer("before_quantity"),
  afterQuantity: integer("after_quantity"),
  reason: text("reason"),
  operatorUserId: varchar("operator_user_id", { length: 255 }),
  operatorName: varchar("operator_name", { length: 255 }).notNull(),
  reversalOf: uuid("reversal_of").unique(),
  status: varchar("status", { length: 40 }).notNull().default('posted'),
  occurredAt: customTimestamptz("occurred_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  operationNo: varchar("operation_no", { length: 80 }),
  lineNo: integer("line_no").default(1),
  itemType: varchar("item_type", { length: 40 }).default('service'),
  unitPriceCents: bigint("unit_price_cents", { mode: 'number' }).default(0),
  discountBasisPoints: integer("discount_basis_points").default(10000),
  cashVoucherId: uuid("cash_voucher_id"),
  cashVoucherDiscountCents: bigint("cash_voucher_discount_cents", { mode: 'number' }).notNull().default(0),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_card_ledger_transaction_no").on(table.transactionNo),
  uniqueIndex("uk_customer_card_ledger_idempotency").on(table.idempotencyKey),
  uniqueIndex("uk_customer_card_ledger_reversal").on(table.reversalOf),
  index("idx_customer_card_ledger_customer_time").on(table.customerAssetId, table.occurredAt),
  index("idx_customer_card_ledger_account_time").on(table.accountId, table.occurredAt),
  index("idx_customer_card_ledger_operation").on(table.customerAssetId, table.operationNo, table.lineNo),
  index("idx_customer_card_ledger_cash_voucher").on(table.cashVoucherId),
  foreignKey({
    columns: [table.customerAssetId],
    foreignColumns: [customerAsset.id],
    name: "customer_card_ledger_customer_asset_id_fkey",
  }),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [customerCardAccount.id],
    name: "customer_card_ledger_account_id_fkey",
  }),
  foreignKey({
    columns: [table.entitlementId],
    foreignColumns: [customerCardEntitlement.id],
    name: "customer_card_ledger_entitlement_id_fkey",
  }),
  foreignKey({
    columns: [table.reversalOf],
    foreignColumns: [customerCardLedger.id],
    name: "customer_card_ledger_reversal_of_fkey",
  }),
]);

export const customerCardEntitlement = pgTable("customer_card_entitlement", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  sourceRightKey: varchar("source_right_key", { length: 1000 }).notNull(),
  rightName: varchar("right_name", { length: 500 }).notNull(),
  rightType: varchar("right_type", { length: 100 }),
  isGift: boolean("is_gift").notNull().default(false),
  discountRule: varchar("discount_rule", { length: 255 }),
  openingTotalCount: integer("opening_total_count"),
  openingUsedCount: integer("opening_used_count"),
  openingRemainingCount: integer("opening_remaining_count"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_card_entitlement_source").on(table.accountId, table.sourceRightKey),
  index("idx_customer_card_entitlement_account").on(table.accountId, table.rightName),
  foreignKey({
    columns: [table.accountId],
    foreignColumns: [customerCardAccount.id],
    name: "customer_card_entitlement_account_id_fkey",
  }),
]);

export const customerCardAccount = pgTable("customer_card_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerAssetId: uuid("customer_asset_id").notNull(),
  sourceKey: varchar("source_key", { length: 800 }).notNull(),
  cardName: varchar("card_name", { length: 500 }).notNull(),
  category: varchar("category", { length: 255 }),
  cardType: varchar("card_type", { length: 100 }),
  status: varchar("status", { length: 100 }).notNull().default('active'),
  validity: varchar("validity", { length: 255 }),
  cardNumber: varchar("card_number", { length: 255 }),
  accountNumber: varchar("account_number", { length: 255 }),
  principalOpeningCents: bigint("principal_opening_cents", { mode: 'number' }).notNull().default(0),
  giftOpeningCents: bigint("gift_opening_cents", { mode: 'number' }).notNull().default(0),
  sessionValueOpeningCents: bigint("session_value_opening_cents", { mode: 'number' }).notNull().default(0),
  /**
   * @type { [key: string]: unknown }
   */
  sourceSnapshot: jsonb("source_snapshot").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_card_account_source").on(table.customerAssetId, table.sourceKey),
  index("idx_customer_card_account_customer").on(table.customerAssetId, table.status),
  foreignKey({
    columns: [table.customerAssetId],
    foreignColumns: [customerAsset.id],
    name: "customer_card_account_customer_asset_id_fkey",
  }),
]);

export const pgAudit = pgTable("pg_audit", {
  eventId: varchar("event_id", { length: 64 }).primaryKey(),
  eventTime: timestamp("event_time", { mode: 'string' }).notNull(),
  targetTable: varchar("target_table", { length: 255 }).notNull(),
  type: opType("type").notNull(),
  /**
   * 数据变更日志详情
   */
  details: jsonb("details"),
}, (table) => [
  index("idx_pg_audit_table_name").on(table.targetTable, table.eventTime),
  index("idx_pg_audit_table").on(table.targetTable),
]);

export const customerImportAudit = pgTable("customer_import_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchKey: varchar("batch_key", { length: 140 }).notNull().unique(),
  sourceName: varchar("source_name", { length: 255 }).notNull(),
  status: varchar("status", { length: 100 }).notNull(),
  customerCount: integer("customer_count").notNull().default(0),
  transactionCount: integer("transaction_count").notNull().default(0),
  itemCount: integer("item_count").notNull().default(0),
  couponCount: integer("coupon_count").notNull().default(0),
  balanceErrorCount: integer("balance_error_count").notNull().default(0),
  identityErrorCount: integer("identity_error_count").notNull().default(0),
  duplicateOrderCount: integer("duplicate_order_count").notNull().default(0),
  precisionErrorCount: integer("precision_error_count").notNull().default(0),
  /**
   * @type { [key: string]: unknown }
   */
  qcReport: jsonb("qc_report").notNull().default('{}'),
  importedAt: customTimestamptz("imported_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_import_audit_batch").on(table.batchKey),
  index("idx_customer_import_audit_time").on(table.importedAt),
]);

export const customerCoupon = pgTable("customer_coupon", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerAssetId: uuid("customer_asset_id").notNull(),
  sourceCouponKey: varchar("source_coupon_key", { length: 180 }).notNull().unique(),
  customerYzUid: varchar("customer_yz_uid", { length: 100 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 30 }),
  couponName: varchar("coupon_name", { length: 500 }).notNull(),
  faceValue: numeric("face_value"),
  threshold: text("threshold"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  status: varchar("status", { length: 100 }).notNull().default('可用'),
  couponType: varchar("coupon_type", { length: 40 }).notNull().default('legacy_coupon'),
  scope: varchar("scope", { length: 40 }).notNull().default('single_service'),
  membershipTier: varchar("membership_tier", { length: 40 }),
  grantSource: varchar("grant_source", { length: 80 }),
  usedAt: customTimestamptz("used_at", { precision: 3 }),
  usedOperationNo: varchar("used_operation_no", { length: 80 }),
  usedLedgerId: uuid("used_ledger_id"),
  usedProjectName: varchar("used_project_name", { length: 500 }),
  /**
   * @type { [key: string]: unknown }
   */
  sourcePayload: jsonb("source_payload").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_coupon_source").on(table.sourceCouponKey),
  index("idx_customer_coupon_asset_validity").on(table.customerAssetId, table.validTo),
  index("idx_customer_coupon_name").on(table.couponName),
  index("idx_customer_coupon_status_validity").on(table.customerAssetId, table.status, table.validTo),
  foreignKey({
    columns: [table.customerAssetId],
    foreignColumns: [customerAsset.id],
    name: "customer_coupon_customer_asset_id_fkey",
  }),
]);

export const customerTransactionItem = pgTable("customer_transaction_item", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").notNull(),
  sourceItemKey: varchar("source_item_key", { length: 180 }).notNull().unique(),
  lineNo: integer("line_no").notNull(),
  itemName: varchar("item_name", { length: 500 }).notNull(),
  itemCategory: varchar("item_category", { length: 100 }),
  productUrl: text("product_url"),
  unitPrice: numeric("unit_price"),
  quantity: numeric("quantity"),
  artisan: varchar("artisan", { length: 255 }),
  salesperson: varchar("salesperson", { length: 255 }),
  actualAmount: numeric("actual_amount"),
  amountDetail: text("amount_detail"),
  paymentMethod: varchar("payment_method", { length: 100 }),
  /**
   * @type { [key: string]: string }
   */
  deductions: jsonb("deductions").notNull().default('{}'),
  store: varchar("store", { length: 255 }),
  status: varchar("status", { length: 100 }),
  rawRow: text("raw_row"),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_transaction_item_source").on(table.sourceItemKey),
  index("idx_customer_transaction_item_transaction").on(table.transactionId, table.lineNo),
  index("idx_customer_transaction_item_name").on(table.itemName),
  foreignKey({
    columns: [table.transactionId],
    foreignColumns: [customerTransaction.id],
    name: "customer_transaction_item_transaction_id_fkey",
  }),
]);

export const customerTransaction = pgTable("customer_transaction", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceOrderKey: varchar("source_order_key", { length: 140 }).notNull().unique(),
  orderNo: varchar("order_no", { length: 100 }).notNull().unique(),
  customerAssetId: uuid("customer_asset_id").notNull(),
  customerYzUid: varchar("customer_yz_uid", { length: 100 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 30 }),
  orderedAt: customTimestamptz("ordered_at", { precision: 3 }).notNull(),
  orderType: varchar("order_type", { length: 100 }),
  detailUrl: text("detail_url"),
  remark: text("remark"),
  actualAmount: numeric("actual_amount"),
  amountDetail: text("amount_detail"),
  paymentMethod: varchar("payment_method", { length: 100 }),
  /**
   * @type { [key: string]: string }
   */
  deductions: jsonb("deductions").notNull().default('{}'),
  store: varchar("store", { length: 255 }),
  status: varchar("status", { length: 100 }),
  sourcePage: integer("source_page").notNull().default(1),
  /**
   * @type { [key: string]: unknown }
   */
  sourcePayload: jsonb("source_payload").notNull().default('{}'),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_transaction_source_order").on(table.sourceOrderKey),
  uniqueIndex("uk_customer_transaction_order_no").on(table.orderNo),
  index("idx_customer_transaction_asset_time").on(table.customerAssetId, table.orderedAt),
  index("idx_customer_transaction_type").on(table.orderType),
  foreignKey({
    columns: [table.customerAssetId],
    foreignColumns: [customerAsset.id],
    name: "customer_transaction_customer_asset_id_fkey",
  }),
]);

export const customerAsset = pgTable("customer_asset", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceRecordId: varchar("source_record_id", { length: 100 }).notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 30 }),
  nickname: varchar("nickname", { length: 255 }),
  memberLevel: varchar("member_level", { length: 255 }),
  initialSource: text("initial_source"),
  totalSpend: numeric("total_spend"),
  currentBalance: numeric("current_balance"),
  serviceStaff: text("service_staff"),
  profileCompleteness: integer("profile_completeness").notNull().default(0),
  /**
   * @type { [key: string]: unknown }
   */
  rawProfile: jsonb("raw_profile").notNull().default('{}'),
  sourceSyncedAt: customTimestamptz("source_synced_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creation time (auto-filled, do not modify)
  createdAt: customTimestamptz("_created_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Creator (auto-filled, do not modify)
  createdBy: userProfile("_created_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
  // System field: Update time (auto-filled, do not modify)
  updatedAt: customTimestamptz("_updated_at", { precision: 3 }).notNull().default(sql`CURRENT_TIMESTAMP`),
  // System field: Updater (auto-filled, do not modify)
  updatedBy: userProfile("_updated_by").default(sql`CASE
    WHEN (current_setting('app.user_id'::text, true) = ''::text) THEN NULL`),
}, (table) => [
  uniqueIndex("uk_customer_asset_source_record").on(table.sourceRecordId),
  index("idx_customer_asset_name").on(table.customerName),
  index("idx_customer_asset_mobile").on(table.mobile),
  index("idx_customer_asset_member_level").on(table.memberLevel),
]);

export const serviceConfig = pgTable("service_config", {
  configKey: varchar("config_key", { length: 64 }).primaryKey(),
  configValue: text("config_value").notNull(),
  updatedAt: customTimestamptz("updated_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const serviceState = pgTable("service_state", {
  appointmentId: varchar("appointment_id", { length: 64 }).primaryKey(),
  completedTaskIds: text("completed_task_ids").notNull().default('[]'),
  actorName: varchar("actor_name", { length: 255 }).notNull().default('数据前台'),
  actorUserId: varchar("actor_user_id", { length: 255 }),
  updatedAt: customTimestamptz("updated_at", { precision: 6 }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// table aliases
export const cardPackageTemplateTable = cardPackageTemplate;
export const customerAssetTable = customerAsset;
export const customerCardAccountTable = customerCardAccount;
export const customerCardEntitlementTable = customerCardEntitlement;
export const customerCardLedgerTable = customerCardLedger;
export const customerCouponTable = customerCoupon;
export const customerImportAuditTable = customerImportAudit;
export const customerTransactionTable = customerTransaction;
export const customerTransactionItemTable = customerTransactionItem;
export const inventoryMovementTable = inventoryMovement;
export const inventoryProductTable = inventoryProduct;
export const pgAuditTable = pgAudit;
export const serviceConfigTable = serviceConfig;
export const serviceStateTable = serviceState;
