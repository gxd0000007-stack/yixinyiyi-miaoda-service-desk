export interface ServiceActor {
  userId?: string;
  displayName: string;
  roles?: string[];
}

export type ServiceRole = 'owner' | 'employee';

export type ServiceJobRole =
  | 'owner'
  | 'front_desk'
  | 'skin_manager'
  | 'nurse'
  | 'unassigned';

export interface ServicePermissionScope {
  viewOwnerPortal: boolean;
  viewEmployeePortal: boolean;
  viewCustomerAssets: boolean;
  viewCustomerReminders: boolean;
  viewPriorityClients: boolean;
  viewAllAppointments: boolean;
  executeOwnTasks: boolean;
  editAppointments: boolean;
  editStaffSchedule: boolean;
  manageStaffRoles: boolean;
  checkout: boolean;
  manageInventory: boolean;
}

export interface ServiceRoleResponse {
  actor: ServiceActor;
  role: ServiceRole;
  jobRole: ServiceJobRole;
  permissionVersion: string;
  permissions: ServicePermissionScope;
  canDelete: boolean;
  canEditAppointments: boolean;
  canEditStaffSchedule: boolean;
  canManageStaffRoles: boolean;
  deletedAppointmentIds: string[];
}

export type {
  ChatSimpleDTO,
  DepartmentDTO,
  FilterParams,
  ForceRoleDTO,
  I18nText,
  MemberMutationData,
  MemberType,
  PresetGroupDTO,
  RoleMemberDTO,
  SearchResponse,
  SearchResult,
  UserSimpleDTO,
} from '@lark-apaas/fullstack-nestjs-core';

export interface CreateRoleRequest {
  role: { name: string; description?: string; bizID: string };
}

export interface UpdateRoleRequest {
  role: { name?: string; description?: string };
}

export interface AddMembersRequest {
  members: import('@lark-apaas/fullstack-nestjs-core').MemberMutationData;
}

export interface RemoveMembersRequest {
  members: import('@lark-apaas/fullstack-nestjs-core').MemberMutationData;
}

export interface SearchMembersRequest {
  query: string;
  filters?: import('@lark-apaas/fullstack-nestjs-core').FilterParams;
  includeExternalUser?: boolean;
  includeExternalGroup?: boolean;
  pageSize?: number;
  page?: number;
}

export type ServiceAppointmentStatus =
  | '待到店'
  | '准备中'
  | '服务中'
  | '已完成';

export interface ServiceAppointment {
  id: number;
  time: string;
  name: string;
  nickname: string;
  project: string;
  room: string;
  fixedTechnician: string;
  technician: string;
  nurse?: string;
  frontDesk?: string;
  status: ServiceAppointmentStatus;
  member: string;
  accent: string;
  amount: string;
  tags: string[];
  arrivalMethod?: string;
  lastVisit?: string;
  lastSpend?: string;
  cardBalance?: string;
  remainingProjects?: Array<{
    name: string;
    times: number;
    expires: string;
  }>;
  customerAsset?: CustomerAssetForService;
}

export interface CustomerAssetForService {
  assetId: string;
  sourceRecordId: string;
  avatarPreset?: string;
  avatarUrl?: string;
  profileCompleteness: number;
  memberLevel?: string;
  initialSource?: string;
  totalSpend?: number;
  currentBalance?: number;
  serviceStaff?: string[];
  primarySkinConcerns: string[];
  projectPreferences: string[];
  serviceRisks: string[];
  servicePreferences: string[];
  consumptionProfile: string[];
  decisionFactors: string[];
  entryMotives: string[];
  healthFlags: string[];
  followupRules: string[];
  availableCardRights: CustomerCardAvailableRight[];
}

export interface CustomerCardAvailableRight {
  name: string;
  remaining: number;
  cardName: string;
  category?: string;
  expires: string;
}

export interface CustomerCardRight {
  name: string;
  type?: string;
  gift?: string;
  discountRule?: string;
  total?: number;
  used?: number;
  remaining?: number;
}

export interface CustomerCardAsset {
  sourceKey: string;
  source: string;
  cardName: string;
  category?: string;
  cardType?: string;
  status: string;
  validity?: string;
  acquiredAt?: string;
  paidAmount?: number;
  purchaseStore?: string;
  cardNumber?: string;
  accountNumber?: string;
  principalBalance?: number;
  giftBalance?: number;
  sessionBalance?: number;
  sessionRemaining?: number;
  sessionGiftRemaining?: number;
  rights: CustomerCardRight[];
}

export interface CustomerCardAssetSummary {
  total: number;
  active: number;
  expired: number;
  invalid: number;
  refunded: number;
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
}

export interface CustomerAssetSummary {
  id: string;
  sourceRecordId: string;
  name: string;
  avatarPreset?: string;
  avatarUrl?: string;
  nickname?: string;
  mobile?: string;
  memberLevel?: string;
  initialSource?: string;
  totalSpend?: number;
  currentBalance?: number;
  totalSpendExact?: string;
  currentBalanceExact?: string;
  serviceStaff: string[];
  profileCompleteness: number;
  primarySkinConcerns: string[];
  projectPreferences: string[];
  serviceRisks: string[];
  birthday?: string;
  memberExpiresAt?: string;
  importantDates: string[];
  followupRules: string[];
  healthFlags: string[];
  tags: string[];
  sourceSyncedAt: string;
}

export interface CustomerAssetProfileItem {
  label: string;
  value: string;
}

export interface CustomerAssetProfileGroup {
  id: string;
  title: string;
  description: string;
  items: CustomerAssetProfileItem[];
}

export interface CustomerAssetDetail extends CustomerAssetSummary {
  profileGroups: CustomerAssetProfileGroup[];
  rawProfile: Record<string, unknown>;
  supplement: CustomerAssetSupplement;
  cardAssets: CustomerCardAsset[];
  refundRecords: CustomerCardAsset[];
  cardAssetSummary: CustomerCardAssetSummary;
}

export interface CustomerAssetSupplement {
  avatarPreset?: string;
  avatarUrl?: string;
  avatarBucketId?: string;
  avatarFilePath?: string;
  mobile?: string;
  memberLevel?: string;
  initialSource?: string;
  totalSpend?: number;
  currentBalance?: number;
  serviceStaff: string[];
  primarySkinConcerns: string[];
  projectPreferences: string[];
  serviceRisks: string[];
  servicePreferences: string[];
  specialHealthStatus?: string;
  painTolerance?: string;
  healthNotes?: string;
  consumptionNotes?: string;
  communicationNotes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UpdateCustomerAssetSupplementRequest {
  avatarPreset?: string;
  avatarUrl?: string;
  avatarBucketId?: string;
  avatarFilePath?: string;
  mobile?: string;
  memberLevel?: string;
  initialSource?: string;
  totalSpend?: number;
  currentBalance?: number;
  serviceStaff?: string[];
  primarySkinConcerns?: string[];
  projectPreferences?: string[];
  serviceRisks?: string[];
  servicePreferences?: string[];
  specialHealthStatus?: string;
  painTolerance?: string;
  healthNotes?: string;
  consumptionNotes?: string;
  communicationNotes?: string;
}

export interface UpdateCustomerAssetSupplementResponse {
  saved: boolean;
  asset: CustomerAssetDetail;
}

export interface CreateCustomerAssetRequest {
  name: string;
  nickname?: string;
  mobile?: string;
  memberLevel?: string;
  initialSource?: string;
  totalSpend?: number;
  currentBalance?: number;
  serviceStaff?: string[];
  primarySkinConcerns?: string[];
  projectPreferences?: string[];
  serviceRisks?: string[];
  servicePreferences?: string[];
  specialHealthStatus?: string;
  painTolerance?: string;
  healthNotes?: string;
  consumptionNotes?: string;
  communicationNotes?: string;
}

export interface CreateCustomerAssetResponse {
  saved: boolean;
  asset: CustomerAssetDetail;
}

export interface CustomerAssetSegmentItem extends CustomerAssetSummary {
  missingFields: string[];
}

export interface CustomerAssetSegmentsResponse {
  highValueCustomers: CustomerAssetSegmentItem[];
  incompleteCustomers: CustomerAssetSegmentItem[];
}

export interface CustomerAssetStats {
  total: number;
  memberCount: number;
  highValueCount: number;
  averageCompleteness: number;
  fieldCount: number;
  sourceName: string;
  latestSyncedAt?: string;
}

export interface CustomerAssetsResponse {
  items: CustomerAssetSummary[];
  total: number;
  page: number;
  pageSize: number;
  stats: CustomerAssetStats;
}

export interface CustomerAssetDetailResponse {
  asset: CustomerAssetDetail;
}

export type CustomerLedgerFilter =
  | 'all'
  | 'service'
  | 'card'
  | 'recharge'
  | 'online';

export interface CustomerTransactionItem {
  id: string;
  lineNo: number;
  itemName: string;
  itemCategory?: string;
  productUrl?: string;
  unitPriceExact?: string;
  quantityExact?: string;
  artisan?: string;
  salesperson?: string;
  actualAmountExact?: string;
  amountDetail?: string;
  paymentMethod?: string;
  deductions: Record<string, string>;
  store?: string;
  status?: string;
}

export interface CustomerTransaction {
  id: string;
  orderNo: string;
  orderedAt: string;
  orderType?: string;
  detailUrl?: string;
  remark?: string;
  actualAmountExact?: string;
  amountDetail?: string;
  paymentMethod?: string;
  deductions: Record<string, string>;
  store?: string;
  status?: string;
  items: CustomerTransactionItem[];
}

export interface CustomerCoupon {
  id: string;
  couponName: string;
  faceValueExact?: string;
  threshold?: string;
  validFrom?: string;
  validTo?: string;
  status: string;
}

export interface CustomerLedgerSummary {
  orderCount: number;
  itemCount: number;
  couponCount: number;
  currentBalanceExact: string;
  totalSpendExact: string;
  actualAmountTotalExact: string;
  benefitDeductionTotalExact: string;
  couponFaceValueTotalExact: string;
  orderTypeCounts: Record<string, number>;
}

export interface CustomerLedgerImportAudit {
  batchKey: string;
  sourceName: string;
  status: string;
  customerCount: number;
  transactionCount: number;
  itemCount: number;
  couponCount: number;
  balanceErrorCount: number;
  identityErrorCount: number;
  duplicateOrderCount: number;
  precisionErrorCount: number;
  importedAt: string;
}

export interface CustomerLedgerResponse {
  customerId: string;
  customerName: string;
  summary: CustomerLedgerSummary;
  transactions: CustomerTransaction[];
  coupons: CustomerCoupon[];
  audit?: CustomerLedgerImportAudit;
  total: number;
  page: number;
  pageSize: number;
  filter: CustomerLedgerFilter;
  query: string;
}

export type CustomerCardDeductionMode = 'principal' | 'gift' | 'entitlement';
export type CustomerCardTransactionType = 'deduction' | 'credit' | 'reversal';
export type CustomerCardItemType =
  | 'service'
  | 'package'
  | 'product'
  | 'card'
  | 'recharge';

export interface CustomerCardWalletEntitlement {
  id: string;
  name: string;
  type?: string;
  isGift: boolean;
  discountRule?: string;
  totalCount?: number;
  usedCount?: number;
  remainingCount: number;
}

export interface CustomerCardWalletAccount {
  id: string;
  cardName: string;
  category?: string;
  cardType?: string;
  status: string;
  validity?: string;
  cardNumber?: string;
  accountNumber?: string;
  principalBalanceExact: string;
  giftBalanceExact: string;
  sessionValueExact: string;
  entitlements: CustomerCardWalletEntitlement[];
}

export interface CustomerCardWalletLedgerEntry {
  id: string;
  transactionNo: string;
  operationNo?: string;
  lineNo: number;
  transactionType: CustomerCardTransactionType;
  deductionMode: CustomerCardDeductionMode;
  itemType: CustomerCardItemType;
  cardName: string;
  entitlementName?: string;
  appointmentId?: string;
  projectName: string;
  amountExact: string;
  unitPriceExact: string;
  discountPercentExact: string;
  cashVoucherId?: string;
  cashVoucherName?: string;
  cashVoucherDiscountExact: string;
  quantity: number;
  beforeAmountExact?: string;
  afterAmountExact?: string;
  beforeQuantity?: number;
  afterQuantity?: number;
  reason?: string;
  operatorName: string;
  occurredAt: string;
  reversed: boolean;
}

export interface CustomerCashVoucher {
  id: string;
  name: string;
  faceValueExact: string;
  validFrom?: string;
  validTo?: string;
  status: '可用' | '已使用' | '已过期';
  scope: 'single_service';
  membershipTier?: string;
  usedAt?: string;
  usedOperationNo?: string;
  usedProjectName?: string;
  isUsable: boolean;
}

export interface CustomerCardWalletResponse {
  customerId: string;
  customerName: string;
  totalBalanceExact: string;
  membershipLabel: string;
  membershipTier?: string;
  productDiscountPercentExact: string;
  productDiscountLabel: string;
  servicePricingLabel: string;
  annualCashVoucherCount: number;
  cashVouchers: CustomerCashVoucher[];
  availableCashVoucherCount: number;
  availableCashVoucherValueExact: string;
  accounts: CustomerCardWalletAccount[];
  ledger: CustomerCardWalletLedgerEntry[];
  storage: 'miaoda_cloud_database';
  sourceMode: 'independent_internal_wallet';
}

export interface DeductCustomerCardRequest {
  accountId: string;
  entitlementId?: string;
  appointmentId?: string;
  deductionMode: CustomerCardDeductionMode;
  projectName: string;
  amountExact?: string;
  quantity?: number;
  reason?: string;
  idempotencyKey: string;
}

export interface DeductCustomerCardResponse {
  saved: boolean;
  transaction: CustomerCardWalletLedgerEntry;
  wallet: CustomerCardWalletResponse;
}

export interface ReverseCustomerCardRequest {
  reason: string;
  idempotencyKey: string;
}

export interface ReverseCustomerCardResponse {
  saved: boolean;
  transaction: CustomerCardWalletLedgerEntry;
  wallet: CustomerCardWalletResponse;
}

export interface CustomerCardSettlementLineRequest {
  accountId: string;
  entitlementId?: string;
  appointmentId?: string;
  deductionMode: CustomerCardDeductionMode;
  itemType: CustomerCardItemType;
  itemName: string;
  amountExact?: string;
  quantity?: number;
  unitPriceExact?: string;
  discountPercentExact?: string;
  cashVoucherId?: string;
  cashVoucherDiscountExact?: string;
}

export interface GrantCustomerCashVoucherRequest {
  name: string;
  faceValueExact: string;
  quantity: number;
  validDays: number;
  reason?: string;
  idempotencyKey: string;
}

export interface BatchSettleCustomerCardRequest {
  lines: CustomerCardSettlementLineRequest[];
  reason?: string;
  idempotencyKey: string;
}

export interface CustomerCardOperationResponse {
  saved: boolean;
  operationNo: string;
  transactions: CustomerCardWalletLedgerEntry[];
  wallet: CustomerCardWalletResponse;
}

export interface CustomerCardRechargeEntitlementRequest {
  entitlementId?: string;
  name?: string;
  type?: string;
  isGift?: boolean;
  quantity: number;
  discountRule?: string;
}

export interface CreateCustomerCardRequest {
  cardName: string;
  category?: string;
  cardType?: string;
  validity?: string;
  cardNumber?: string;
  accountNumber?: string;
  principalAmountExact?: string;
  giftAmountExact?: string;
  entitlements: CustomerCardRechargeEntitlementRequest[];
  reason?: string;
  idempotencyKey: string;
}

export interface RechargeCustomerCardRequest {
  accountId: string;
  principalAmountExact?: string;
  giftAmountExact?: string;
  entitlements: CustomerCardRechargeEntitlementRequest[];
  reason?: string;
  idempotencyKey: string;
}

export interface CustomerBalancePurchaseItemRequest {
  itemType: Exclude<CustomerCardItemType, 'recharge'>;
  itemName: string;
  quantity: number;
  unitPriceExact: string;
  discountPercentExact?: string;
  targetAccountId?: string;
  targetEntitlementId?: string;
  grantCount?: number;
  inventoryProductId?: string;
}

export interface PurchaseWithCustomerBalanceRequest {
  paymentAccountId: string;
  paymentMode: 'principal' | 'gift';
  items: CustomerBalancePurchaseItemRequest[];
  consumptionLines?: CustomerCardSettlementLineRequest[];
  reason?: string;
  idempotencyKey: string;
}

export interface ReverseCustomerCardOperationRequest {
  reason: string;
  idempotencyKey: string;
}

export interface CardPackageComponent {
  projectId: string;
  projectName: string;
  category: string;
  unitPriceExact: string;
  quantity: number;
}

export interface CardPackageCustomerServiceUsage {
  projectName: string;
  category: string;
  totalCount: number;
  usedCount: number;
  remainingCount: number;
  lastUsedAt?: string;
}

export interface CardPackageCustomerUsage {
  customerId: string;
  customerName: string;
  mobile?: string;
  memberLevel?: string;
  accountId: string;
  accountName: string;
  accountStatus: string;
  soldCount: number;
  purchasedAt: string;
  lastUsedAt?: string;
  totalServiceCount: number;
  usedServiceCount: number;
  remainingServiceCount: number;
  services: CardPackageCustomerServiceUsage[];
}

export interface CardPackageTemplate {
  id: string;
  packageNo: string;
  name: string;
  category: string;
  retailPriceExact: string;
  discountPercentExact: string;
  validDays?: number;
  description?: string;
  components: CardPackageComponent[];
  totalProjectCount: number;
  totalServiceCount: number;
  originalValueExact: string;
  soldCount: number;
  soldCustomerCount: number;
  customerUsage: CardPackageCustomerUsage[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProjectDefinition {
  id: string;
  name: string;
  priceExact: string;
  category: string;
  managementType: string;
  durationMinutes: number;
  source: 'youzan_catalog' | 'manual';
  createdAt?: string;
}

export interface CardPackageCatalogResponse {
  packages: CardPackageTemplate[];
  customProjects: ServiceProjectDefinition[];
  packageCount: number;
  activePackageCount: number;
  totalPackageSoldCount: number;
  totalPackageCustomerCount: number;
}

export interface CreateCardPackageRequest {
  name: string;
  category?: string;
  retailPriceExact: string;
  discountPercentExact?: string;
  validDays?: number;
  description?: string;
  components: CardPackageComponent[];
}

export interface CardPackageMutationResponse {
  saved: boolean;
  package: CardPackageTemplate;
}

export interface CreateServiceProjectRequest {
  name: string;
  priceExact: string;
  category: string;
  managementType: string;
  durationMinutes: number;
}

export interface ServiceProjectMutationResponse {
  saved: boolean;
  project: ServiceProjectDefinition;
}

export interface ServiceAppointmentSchedule {
  date?: string;
  label: string;
  weekday: string;
  note: string;
  sourceName: string;
  sourceMessageId?: string;
  importedAt?: string;
}

export interface ServiceAppointmentsResponse {
  appointments: ServiceAppointment[];
  schedule?: ServiceAppointmentSchedule;
  staffSchedules?: ServiceStaffSchedule[];
  updatedAt?: string;
}

export interface ServiceAppointmentHistoryDay {
  date: string;
  appointments: ServiceAppointment[];
  schedule: ServiceAppointmentSchedule;
  staffSchedules?: ServiceStaffSchedule[];
  updatedAt?: string;
}

export interface ServiceAppointmentHistoryResponse {
  days: ServiceAppointmentHistoryDay[];
  updatedAt?: string;
}

export type ServiceStaffRole = 'skin_manager' | 'nurse' | 'front_desk';
export type ServiceStaffShift = '早班' | '晚班' | '休息';

export interface ServiceStaffSchedule {
  date: string;
  staffName: string;
  role: ServiceStaffRole;
  roleLabel: string;
  shift: ServiceStaffShift;
  startTime?: string;
  endTime?: string;
  monthlyRestDays: number;
}

export interface UpdateServiceStaffScheduleRequest {
  date: string;
  staffName: string;
  shift: ServiceStaffShift;
}

export interface UpdateServiceStaffScheduleResponse {
  saved: boolean;
  schedules: ServiceStaffSchedule[];
  actor: ServiceActor;
  updatedAt: string;
}

export interface SaveServiceAppointmentRequest {
  date: string;
  appointment: {
    id?: number;
    time: string;
    name: string;
    project: string;
    room: string;
    technician: string;
    nurse?: string;
    frontDesk?: string;
    amount?: string;
    sourceServiceId?: string;
    serviceDurationMinutes?: number;
  };
}

export interface SaveServiceAppointmentResponse {
  saved: boolean;
  appointment: ServiceAppointment;
  actor: ServiceActor;
  updatedAt: string;
}

export interface ServiceFeishuConfig {
  webhookConfigured: boolean;
  chatUrlConfigured: boolean;
  chatUrl?: string;
}

export interface ServiceStateResponse {
  appointmentId: string;
  completedTaskIds: string[];
  assignedTechnician?: string;
  actor: ServiceActor;
  updatedAt?: string;
  feishu: ServiceFeishuConfig;
}

export interface UpdateServiceStateRequest {
  appointmentId: string;
  taskId: string;
  completed: boolean;
}

export interface UpdateServiceAssignmentRequest {
  appointmentId: string;
  technician: string;
}

export interface UpdateServiceAssignmentResponse {
  saved: boolean;
  appointmentId: string;
  assignedTechnician: string;
  actor: ServiceActor;
  updatedAt: string;
}

export interface CompleteServiceRequest {
  appointmentId: string;
  clientName: string;
  projectName: string;
  room: string;
  technician: string;
  stageId: string;
  stageName: string;
  nextStageName?: string;
  completedTaskIds: string[];
  mentionUsers?: ServiceMentionUser[];
}

export interface ServiceMentionUser {
  userId: string;
  name: string;
  role: string;
}

export type CustomerPrivilegeTier = '追光者' | '绘光师' | '蕴光主';

export interface CustomerFollowupEvidence {
  id: string;
  filePath: string;
  bucketId: string;
  url: string;
  name: string;
  uploadedAt: string;
}

export interface CustomerFollowupTask {
  id: string;
  date: string;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  memberLevel?: string;
  stage: 'D+1' | 'D+3' | 'D+21';
  lastVisitDate: string;
  lastProject: string;
  assignedStaff: string;
  content: string;
  status: 'pending' | 'completed';
  evidence: CustomerFollowupEvidence[];
  completedAt?: string;
  completedBy?: string;
}

export interface CustomerFollowupTasksResponse {
  date: string;
  items: CustomerFollowupTask[];
}

export interface CompleteCustomerFollowupTaskRequest {
  taskId: string;
  evidence: CustomerFollowupEvidence[];
}

export interface CompleteCustomerFollowupTaskResponse {
  saved: boolean;
  task: CustomerFollowupTask;
}

export interface CompleteServiceResponse {
  saved: boolean;
  sent: boolean;
  duplicate?: boolean;
  mentionCount?: number;
  chatUrl?: string;
}

export interface ConfigureServiceRequest {
  webhookUrl: string;
  signSecret?: string;
}

export interface ConfigureServiceResponse {
  configured: boolean;
  chatUrlConfigured: boolean;
}

export interface AppointmentMutationRequest {
  appointmentId: string;
}

export interface AppointmentMutationResponse {
  saved: boolean;
  appointmentId: string;
  deleted: boolean;
  actor: ServiceActor;
  updatedAt: string;
}

export type InventoryMovementType =
  | 'inbound'
  | 'internal_use'
  | 'customer_sale'
  | 'customer_sale_reversal';

export interface InventoryProduct {
  id: string;
  barcode: string;
  sku?: string;
  name: string;
  category: string;
  unit: string;
  purchaseCostExact: string;
  retailPriceExact: string;
  defaultDiscountPercentExact: string;
  safetyStockExact: string;
  currentStockExact: string;
  supplier?: string;
  note?: string;
  status: 'active' | 'inactive';
  lowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  movementNo: string;
  productId: string;
  productName: string;
  productBarcode: string;
  movementType: InventoryMovementType;
  quantityExact: string;
  deltaQuantityExact: string;
  unitCostExact: string;
  listPriceExact: string;
  discountPercentExact: string;
  actualAmountExact: string;
  customerAssetId?: string;
  customerName?: string;
  recipientName?: string;
  purpose?: string;
  supplier?: string;
  batchNo?: string;
  expiresOn?: string;
  note?: string;
  operatorName: string;
  occurredAt: string;
}

export interface InventoryDashboardSummary {
  productCount: number;
  totalStockExact: string;
  stockCostValueExact: string;
  lowStockCount: number;
  todayInboundExact: string;
  todayInternalUseExact: string;
  todayCustomerSaleExact: string;
  todaySalesAmountExact: string;
}

export interface InventoryDashboardResponse {
  summary: InventoryDashboardSummary;
  products: InventoryProduct[];
  movements: InventoryMovement[];
  storage: 'miaoda_cloud_database';
  inventoryMode: 'immutable_movement_ledger';
}

export interface CreateInventoryProductRequest {
  barcode?: string;
  sku?: string;
  name: string;
  category: string;
  unit: string;
  purchaseCostExact: string;
  retailPriceExact: string;
  defaultDiscountPercentExact: string;
  safetyStockExact: string;
  supplier?: string;
  note?: string;
}

export interface UpdateInventoryProductCostRequest {
  purchaseCostExact: string;
  retailPriceExact: string;
  defaultDiscountPercentExact: string;
  supplier?: string;
  note?: string;
}

export type OperatingAnalyticsRange =
  | 'today'
  | 'month'
  | 'quarter'
  | 'half_year'
  | 'year'
  | 'all';

export interface OperatingAnalyticsDetail {
  id: string;
  title: string;
  subtitle: string;
  amountExact: string;
  occurredAt?: string;
  customerName?: string;
  source: string;
}

export interface MembershipCardCustomerStat {
  customerId: string;
  customerName: string;
  mobile?: string;
  memberLevel?: string;
  accountCount: number;
  totalBalanceExact: string;
  consumptionExact: string;
  lastActivityAt?: string;
}

export interface MembershipCardStat {
  id: string;
  cardName: string;
  category: string;
  cardType: string;
  status: string;
  accountCount: number;
  customerCount: number;
  principalBalanceExact: string;
  giftBalanceExact: string;
  totalLiabilityExact: string;
  consumptionExact: string;
  rechargeExact: string;
  customers: MembershipCardCustomerStat[];
}

export interface OperatingAnalyticsSummary {
  cashPerformanceExact: string;
  cardConsumptionExact: string;
  totalOperatingRevenueExact: string;
  cardLiabilityExact: string;
  productSalesExact: string;
  productCostExact: string;
  internalUseCostExact: string;
  grossProfitExact: string;
  grossMarginPercentExact: string;
  inventoryCostExact: string;
  productCostCoveragePercent: number;
  cashTransactionCount: number;
  cardConsumptionCount: number;
  productSaleCount: number;
}

export interface OperatingAnalyticsResponse {
  range: OperatingAnalyticsRange;
  rangeLabel: string;
  from?: string;
  to: string;
  summary: OperatingAnalyticsSummary;
  cashDetails: OperatingAnalyticsDetail[];
  cardConsumptionDetails: OperatingAnalyticsDetail[];
  productSalesDetails: OperatingAnalyticsDetail[];
  productCostDetails: OperatingAnalyticsDetail[];
  internalUseCostDetails: OperatingAnalyticsDetail[];
  membershipCards: MembershipCardStat[];
  recommendations: string[];
  storage: 'miaoda_cloud_database';
  sourceNote: string;
}

export interface InventoryInboundRequest {
  productId: string;
  quantityExact: string;
  unitCostExact: string;
  supplier?: string;
  batchNo?: string;
  expiresOn?: string;
  note?: string;
  idempotencyKey: string;
}

export interface InventoryInternalUseRequest {
  productId: string;
  quantityExact: string;
  recipientName: string;
  purpose: string;
  note?: string;
  idempotencyKey: string;
}

export interface InventoryCustomerSaleRequest {
  productId: string;
  quantityExact: string;
  customerAssetId?: string;
  customerName: string;
  discountPercentExact: string;
  actualAmountExact?: string;
  note?: string;
  idempotencyKey: string;
}

export interface InventoryMutationResponse {
  saved: boolean;
  duplicate?: boolean;
  product: InventoryProduct;
  movement?: InventoryMovement;
}
