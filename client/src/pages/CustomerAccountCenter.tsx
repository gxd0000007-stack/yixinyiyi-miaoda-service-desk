import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CreditCard,
  History,
  Minus,
  PackagePlus,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShoppingCart,
  TicketPercent,
  Trash2,
  WalletCards,
} from 'lucide-react';

import {
  createInventoryProduct,
  createCustomerCard,
  grantCustomerCashVoucher,
  getCardPackageCatalog,
  getCurrentServiceRole,
  getInventoryDashboard,
  inboundInventory,
  purchaseWithCustomerBalance,
  rechargeCustomerCard,
  reverseCustomerCardOperation,
  settleCustomerCards,
} from '@client/src/api';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  YOUZAN_SERVICE_CATALOG,
  type YouzanServiceItem,
} from '@client/src/data/youzan-service-catalog';
import type {
  CardPackageTemplate,
  CustomerBalancePurchaseItemRequest,
  CustomerCardItemType,
  CustomerCardOperationResponse,
  CustomerCashVoucher,
  CustomerCardSettlementLineRequest,
  CustomerCardWalletAccount,
  CustomerCardWalletEntitlement,
  CustomerCardWalletLedgerEntry,
  CustomerCardWalletResponse,
  InventoryProduct,
} from '@shared/api.interface';

type CenterTab = 'consume' | 'purchase' | 'recharge' | 'vouchers' | 'history';

interface CustomerAccountCenterProps {
  customerId: string;
  customerName: string;
  wallet: CustomerCardWalletResponse;
  onWalletChange: (wallet: CustomerCardWalletResponse) => void;
}

interface ConsumptionCartLine extends CustomerCardSettlementLineRequest {
  clientId: string;
  cardName: string;
  availableLabel: string;
}

interface PurchaseCartLine extends CustomerBalancePurchaseItemRequest {
  clientId: string;
}

interface RechargeRightDraft {
  clientId: string;
  name: string;
  quantity: string;
  type: string;
}

function clientId(): string {
  return crypto.randomUUID();
}

function operationKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data !== null) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function itemTypeLabel(type: CustomerCardItemType): string {
  if (type === 'package') return '套餐';
  if (type === 'product') return '产品';
  if (type === 'card') return '卡项';
  if (type === 'recharge') return '充值';
  return '项目';
}

function entryValue(entry: CustomerCardWalletLedgerEntry): string {
  if (entry.deductionMode === 'entitlement') return `${entry.quantity} 次`;
  return `¥${entry.amountExact}`;
}

function groupLedger(
  ledger: CustomerCardWalletLedgerEntry[],
): Array<{ operationNo: string; rows: CustomerCardWalletLedgerEntry[] }> {
  const map: Map<string, CustomerCardWalletLedgerEntry[]> = new Map();
  for (const row of ledger) {
    const key: string = row.operationNo || row.transactionNo;
    map.set(key, [...(map.get(key) || []), row]);
  }
  return Array.from(map.entries()).map(([operationNo, rows]) => ({
    operationNo,
    rows: rows.sort(
      (left: CustomerCardWalletLedgerEntry, right: CustomerCardWalletLedgerEntry) =>
        left.lineNo - right.lineNo,
    ),
  }));
}

export default function CustomerAccountCenter({
  customerId,
  customerName,
  wallet,
  onWalletChange,
}: CustomerAccountCenterProps) {
  const [isOwner, setIsOwner] = useState(false);
  const [tab, setTab] = useState<CenterTab>('consume');
  const [consumeCart, setConsumeCart] = useState<ConsumptionCartLine[]>([]);
  const [moneyAccountId, setMoneyAccountId] = useState('');
  const [moneyMode, setMoneyMode] = useState<'principal' | 'gift'>('principal');
  const [projectQuery, setProjectQuery] = useState('');
  const [moneyProjectName, setMoneyProjectName] = useState('');
  const [moneyAmount, setMoneyAmount] = useState('');
  const [consumeReason, setConsumeReason] = useState('客户本次多项目消费');

  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [packageTemplates, setPackageTemplates] = useState<CardPackageTemplate[]>([]);
  const [purchaseCart, setPurchaseCart] = useState<PurchaseCartLine[]>([]);
  const [purchaseType, setPurchaseType] = useState<Exclude<CustomerCardItemType, 'recharge'>>('service');
  const [purchaseName, setPurchaseName] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDiscount, setPurchaseDiscount] = useState('100');
  const [purchaseTargetAccountId, setPurchaseTargetAccountId] = useState('');
  const [purchaseInventoryProductId, setPurchaseInventoryProductId] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('客户零售');
  const [newProductCost, setNewProductCost] = useState('0.00');
  const [newProductInitialStock, setNewProductInitialStock] = useState('1');
  const [combineConsumption, setCombineConsumption] = useState(true);

  const [voucherName, setVoucherName] = useState('100元单项目现金抵用券');
  const [voucherFaceValue, setVoucherFaceValue] = useState('100');
  const [voucherQuantity, setVoucherQuantity] = useState('1');
  const [voucherValidDays, setVoucherValidDays] = useState('30');
  const [voucherReason, setVoucherReason] = useState('会员权益赠送');

  useEffect(() => {
    let active = true;
    void getCurrentServiceRole()
      .then((role) => {
        if (active) setIsOwner(role.role === 'owner');
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [rechargeAccountId, setRechargeAccountId] = useState('');
  const [createNewCard, setCreateNewCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardCategory, setNewCardCategory] = useState('项目卡');
  const [newCardValidity, setNewCardValidity] = useState('永久有效');
  const [principalRecharge, setPrincipalRecharge] = useState('');
  const [giftRecharge, setGiftRecharge] = useState('');
  const [rightDrafts, setRightDrafts] = useState<RechargeRightDraft[]>([]);
  const [rightName, setRightName] = useState('');
  const [rightQuantity, setRightQuantity] = useState('1');
  const [rightType, setRightType] = useState('项目');

  const [reason, setReason] = useState('门店客户账户操作');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reversingOperation, setReversingOperation] = useState('');
  const [pendingReverse, setPendingReverse] = useState<{
    operationNo: string;
    rows: CustomerCardWalletLedgerEntry[];
    editAfter: boolean;
  } | null>(null);

  const activeAccounts: CustomerCardWalletAccount[] = useMemo(
    () =>
      wallet.accounts.filter(
        (account: CustomerCardWalletAccount) =>
          account.status === 'active' || account.status === '使用中',
      ),
    [wallet.accounts],
  );

  useEffect(() => {
    if (!moneyAccountId && activeAccounts[0]) setMoneyAccountId(activeAccounts[0].id);
    if (!rechargeAccountId && activeAccounts[0]) setRechargeAccountId(activeAccounts[0].id);
    if (!purchaseTargetAccountId && activeAccounts[0]) {
      setPurchaseTargetAccountId(activeAccounts[0].id);
    }
  }, [activeAccounts, moneyAccountId, purchaseTargetAccountId, rechargeAccountId]);

  useEffect(() => {
    void getInventoryDashboard()
      .then((response) =>
        setInventoryProducts(
          response.products.filter((product: InventoryProduct) => product.status === 'active'),
        ),
      )
      .catch(() => setInventoryProducts([]));
    void getCardPackageCatalog()
      .then((response) => setPackageTemplates(response.packages.filter((item) => item.status === 'active')))
      .catch(() => setPackageTemplates([]));
  }, []);

  const filteredProjects: YouzanServiceItem[] = useMemo(() => {
    const keyword: string = projectQuery.trim().toLocaleLowerCase();
    if (!keyword) return YOUZAN_SERVICE_CATALOG.slice(0, 12);
    return YOUZAN_SERVICE_CATALOG.filter((item: YouzanServiceItem) =>
      `${item.name} ${item.category} ${item.tag}`
        .toLocaleLowerCase()
        .includes(keyword),
    ).slice(0, 20);
  }, [projectQuery]);

  const selectedMoneyAccount: CustomerCardWalletAccount | undefined =
    activeAccounts.find((account: CustomerCardWalletAccount) => account.id === moneyAccountId);

  const usableCashVouchers: CustomerCashVoucher[] = wallet.cashVouchers.filter(
    (voucher: CustomerCashVoucher) => voucher.isUsable,
  );
  const selectedVoucherIds: Set<string> = new Set(
    consumeCart
      .map((line: ConsumptionCartLine) => line.cashVoucherId)
      .filter((value: string | undefined): value is string => Boolean(value)),
  );

  const lineVoucher = (line: ConsumptionCartLine): CustomerCashVoucher | undefined =>
    wallet.cashVouchers.find(
      (voucher: CustomerCashVoucher) => voucher.id === line.cashVoucherId,
    );

  const estimatedLineDeduction = (line: ConsumptionCartLine): string => {
    const gross: number = Number(line.amountExact || 0);
    const voucher: CustomerCashVoucher | undefined = lineVoucher(line);
    return Math.max(0, gross - Number(voucher?.faceValueExact || 0)).toFixed(2);
  };

  const addEntitlement = (
    account: CustomerCardWalletAccount,
    entitlement: CustomerCardWalletEntitlement,
  ): void => {
    const existing: ConsumptionCartLine | undefined = consumeCart.find(
      (line: ConsumptionCartLine) => line.entitlementId === entitlement.id,
    );
    if (existing) {
      updateConsumeLine(existing.clientId, 'quantity', Number(existing.quantity || 1) + 1);
      return;
    }
    setConsumeCart((current: ConsumptionCartLine[]) => [
      ...current,
      {
        clientId: clientId(),
        accountId: account.id,
        cardName: account.cardName,
        entitlementId: entitlement.id,
        deductionMode: 'entitlement',
        itemType: 'service',
        itemName: entitlement.name,
        quantity: 1,
        availableLabel: `可用 ${entitlement.remainingCount} 次`,
      },
    ]);
    setSuccess('');
  };

  const addMoneyConsumption = (): void => {
    if (!selectedMoneyAccount || !moneyProjectName.trim() || Number(moneyAmount) <= 0) {
      setError('请选择卡金账户，并填写消费项目和扣除金额');
      return;
    }
    setConsumeCart((current: ConsumptionCartLine[]) => [
      ...current,
      {
        clientId: clientId(),
        accountId: selectedMoneyAccount.id,
        cardName: selectedMoneyAccount.cardName,
        deductionMode: moneyMode,
        itemType: 'service',
        itemName: moneyProjectName.trim(),
        amountExact: Number(moneyAmount).toFixed(2),
        unitPriceExact: Number(moneyAmount).toFixed(2),
        discountPercentExact: '100.00',
        availableLabel:
          moneyMode === 'principal'
            ? `本金 ¥${selectedMoneyAccount.principalBalanceExact}`
            : `赠送金 ¥${selectedMoneyAccount.giftBalanceExact}`,
      },
    ]);
    setMoneyProjectName('');
    setMoneyAmount('');
    setProjectQuery('');
    setError('');
  };

  const updateConsumeLine = (
    lineId: string,
    field: 'quantity' | 'amountExact' | 'cashVoucherId',
    value: string | number | undefined,
  ): void => {
    setConsumeCart((current: ConsumptionCartLine[]) =>
      current.map((line: ConsumptionCartLine) =>
        line.clientId === lineId ? { ...line, [field]: value } : line,
      ),
    );
  };

  const submitCashVoucherGrant = async (): Promise<void> => {
    if (
      Number(voucherFaceValue) <= 0 ||
      !Number.isInteger(Number(voucherQuantity)) ||
      Number(voucherQuantity) <= 0 ||
      !Number.isInteger(Number(voucherValidDays)) ||
      Number(voucherValidDays) <= 0
    ) {
      setError('请填写正确的现金券面额、张数和有效天数');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updatedWallet: CustomerCardWalletResponse = await grantCustomerCashVoucher(
        customerId,
        {
          name: voucherName.trim() || '单项目现金抵用券',
          faceValueExact: Number(voucherFaceValue).toFixed(2),
          quantity: Number(voucherQuantity),
          validDays: Number(voucherValidDays),
          reason: voucherReason.trim() || undefined,
          idempotencyKey: operationKey('cash-voucher-grant'),
        },
      );
      onWalletChange(updatedWallet);
      setSuccess(
        `已赠送 ${voucherQuantity} 张现金券，每张 ¥${Number(voucherFaceValue).toFixed(2)}，有效 ${voucherValidDays} 天`,
      );
    } catch (grantError: unknown) {
      setError(errorMessage(grantError));
    } finally {
      setSaving(false);
    }
  };

  const submitConsumption = async (): Promise<void> => {
    if (consumeCart.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response: CustomerCardOperationResponse = await settleCustomerCards(
        customerId,
        {
          lines: consumeCart.map(({ clientId: _clientId, cardName: _cardName, availableLabel: _available, ...line }) => line),
          reason: consumeReason,
          idempotencyKey: operationKey('multi-consume'),
        },
      );
      onWalletChange(response.wallet);
      setConsumeCart([]);
      setSuccess(`结算成功：整单 ${response.operationNo}，共 ${response.transactions.length} 项`);
      setTab('history');
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const addPurchaseItem = (): void => {
    if (!purchaseName.trim() || Number(purchaseQuantity) <= 0 || Number(purchasePrice) <= 0) {
      setError('请填写购买内容、数量和单价');
      return;
    }
    if (purchaseType === 'product' && !purchaseInventoryProductId) {
      setError('产品必须先从库存选择，或先点击“建立新产品档案”');
      return;
    }
    const effectiveDiscountPercentExact: string =
      purchaseType === 'product'
        ? wallet.productDiscountPercentExact
        : purchaseType === 'service'
          ? '100.00'
          : purchaseDiscount || '100';
    setPurchaseCart((current: PurchaseCartLine[]) => [
      ...current,
      {
        clientId: clientId(),
        itemType: purchaseType,
        itemName: purchaseName.trim(),
        quantity: Number(purchaseQuantity),
        unitPriceExact: Number(purchasePrice).toFixed(2),
        discountPercentExact: effectiveDiscountPercentExact,
        targetAccountId:
          purchaseType === 'product' ? undefined : purchaseTargetAccountId || moneyAccountId,
        grantCount: purchaseType === 'product' ? undefined : Number(purchaseQuantity),
        inventoryProductId:
          purchaseType === 'product' ? purchaseInventoryProductId || undefined : undefined,
      },
    ]);
    setPurchaseName('');
    setPurchaseQuantity('1');
    setPurchasePrice('');
    setPurchaseInventoryProductId('');
    setError('');
  };

  const chooseCatalogPurchase = (project: YouzanServiceItem): void => {
    setPurchaseType('service');
    setPurchaseName(project.name);
    setPurchasePrice(project.price.toFixed(2));
    setPurchaseDiscount('100.00');
    setPurchaseInventoryProductId('');
  };

  const chooseProductPurchase = (product: InventoryProduct): void => {
    setPurchaseType('product');
    setPurchaseName(product.name);
    setPurchasePrice(product.retailPriceExact);
    setPurchaseDiscount(wallet.productDiscountPercentExact);
    setPurchaseInventoryProductId(product.id);
  };

  const choosePackagePurchase = (cardPackage: CardPackageTemplate): void => {
    setPurchaseType('package');
    setPurchaseName(cardPackage.name);
    setPurchasePrice(cardPackage.retailPriceExact);
    setPurchaseDiscount(cardPackage.discountPercentExact);
    setPurchaseInventoryProductId('');
  };

  const createProductForPurchase = async (): Promise<void> => {
    if (!purchaseName.trim() || Number(purchasePrice) <= 0) {
      setError('请先填写新产品名称和零售价');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await createInventoryProduct({
        name: purchaseName.trim(),
        category: newProductCategory.trim() || '客户零售',
        unit: '件',
        purchaseCostExact: isOwner
          ? Number(newProductCost || 0).toFixed(2)
          : '0.00',
        retailPriceExact: Number(purchasePrice).toFixed(2),
        defaultDiscountPercentExact: purchaseDiscount || '100',
        safetyStockExact: '0',
        note: `由${customerName}购买界面新建，待入库后可销售`,
      });
      const finalProduct: InventoryProduct = Number(newProductInitialStock) > 0
        ? (
            await inboundInventory({
              productId: response.product.id,
              quantityExact: newProductInitialStock,
              unitCostExact: isOwner
                ? Number(newProductCost || 0).toFixed(2)
                : '0.00',
              supplier: '客户购买界面新建',
              note: '新产品建立时同步首批入库',
              idempotencyKey: operationKey('new-product-inbound'),
            })
          ).product
        : response.product;
      setInventoryProducts((current: InventoryProduct[]) => [
        finalProduct,
        ...current.filter((item: InventoryProduct) => item.id !== finalProduct.id),
      ]);
      chooseProductPurchase(finalProduct);
      setSuccess(`产品“${finalProduct.name}”已建立并入库 ${newProductInitialStock} 件，可加入购买清单`);
    } catch (createError: unknown) {
      setError(errorMessage(createError));
    } finally {
      setSaving(false);
    }
  };

  const submitPurchase = async (): Promise<void> => {
    if (!moneyAccountId || purchaseCart.length === 0) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response: CustomerCardOperationResponse = await purchaseWithCustomerBalance(
        customerId,
        {
          paymentAccountId: moneyAccountId,
          paymentMode: moneyMode,
          items: purchaseCart.map(({ clientId: _clientId, ...item }) => item),
          consumptionLines:
            combineConsumption && consumeCart.length > 0
              ? consumeCart.map(({ clientId: _id, cardName: _card, availableLabel: _available, ...line }) => line)
              : undefined,
          reason: '余额购买并联合结算',
          idempotencyKey: operationKey('balance-purchase'),
        },
      );
      onWalletChange(response.wallet);
      setPurchaseCart([]);
      if (combineConsumption) setConsumeCart([]);
      setSuccess(`购买完成：已生成 ${response.transactions.length} 条可追溯明细`);
      setTab('history');
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const addRightDraft = (): void => {
    if (!rightName.trim() || Number(rightQuantity) <= 0) {
      setError('请填写项目名称和充值次数');
      return;
    }
    setRightDrafts((current: RechargeRightDraft[]) => [
      ...current,
      {
        clientId: clientId(),
        name: rightName.trim(),
        quantity: String(Number(rightQuantity)),
        type: rightType.trim() || '项目',
      },
    ]);
    setRightName('');
    setRightQuantity('1');
    setError('');
  };

  const submitRecharge = async (): Promise<void> => {
    if (createNewCard ? !newCardName.trim() : !rechargeAccountId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    const entitlements = rightDrafts.map((item: RechargeRightDraft) => ({
      name: item.name,
      type: item.type,
      quantity: Number(item.quantity),
    }));
    try {
      const response: CustomerCardOperationResponse = createNewCard
        ? await createCustomerCard(customerId, {
            cardName: newCardName,
            category: newCardCategory,
            cardType: newCardCategory,
            validity: newCardValidity,
            principalAmountExact: principalRecharge || undefined,
            giftAmountExact: giftRecharge || undefined,
            entitlements,
            reason,
            idempotencyKey: operationKey('new-card'),
          })
        : await rechargeCustomerCard(customerId, {
            accountId: rechargeAccountId,
            principalAmountExact: principalRecharge || undefined,
            giftAmountExact: giftRecharge || undefined,
            entitlements,
            reason,
            idempotencyKey: operationKey('recharge'),
          });
      onWalletChange(response.wallet);
      setPrincipalRecharge('');
      setGiftRecharge('');
      setRightDrafts([]);
      setNewCardName('');
      setSuccess(createNewCard ? '新卡已建立并完成入账' : '充值与新增项目已完成入账');
      setTab('history');
    } catch (submitError: unknown) {
      setError(errorMessage(submitError));
    } finally {
      setSaving(false);
    }
  };

  const reverseOperation = async (
    operationNo: string,
    rows: CustomerCardWalletLedgerEntry[],
    editAfter: boolean,
  ): Promise<void> => {
    setSaving(true);
    setReversingOperation(operationNo);
    setError('');
    try {
      const response: CustomerCardOperationResponse = await reverseCustomerCardOperation(
        customerId,
        operationNo,
        {
          reason: editAfter ? '原单有误，撤回后重新录入' : '老板/前台整单撤回',
          idempotencyKey: operationKey('reverse-operation'),
        },
      );
      onWalletChange(response.wallet);
      if (editAfter) {
        const editable: ConsumptionCartLine[] = rows
          .filter((row: CustomerCardWalletLedgerEntry) => row.transactionType === 'deduction')
          .map((row: CustomerCardWalletLedgerEntry) => ({
            clientId: clientId(),
            accountId:
              wallet.accounts.find((account: CustomerCardWalletAccount) => account.cardName === row.cardName)?.id || '',
            cardName: row.cardName,
            entitlementId:
              wallet.accounts
                .flatMap((account: CustomerCardWalletAccount) => account.entitlements)
                .find((item: CustomerCardWalletEntitlement) => item.name === row.entitlementName)?.id,
            deductionMode: row.deductionMode,
            itemType: row.itemType,
            itemName: row.projectName,
            amountExact:
              row.deductionMode === 'entitlement'
                ? undefined
                : (
                    Number(row.amountExact) + Number(row.cashVoucherDiscountExact || 0)
                  ).toFixed(2),
            quantity: row.deductionMode === 'entitlement' ? row.quantity : undefined,
            unitPriceExact: row.unitPriceExact,
            discountPercentExact: row.discountPercentExact,
            cashVoucherId: row.cashVoucherId,
            cashVoucherDiscountExact: row.cashVoucherDiscountExact,
            availableLabel: '由原单带入，请重新核对',
          }))
          .filter((line: ConsumptionCartLine) => Boolean(line.accountId));
        setConsumeCart(editable);
        setTab('consume');
        setSuccess('原单已冲正，内容已带回待结算清单，请修改后重新提交');
      } else {
        setSuccess(`整单 ${operationNo} 已撤回，原流水和恢复流水均已保留`);
      }
    } catch (reverseError: unknown) {
      setError(errorMessage(reverseError));
    } finally {
      setSaving(false);
      setReversingOperation('');
    }
  };

  const operationGroups = useMemo(() => groupLedger(wallet.ledger), [wallet.ledger]);

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <header className="border-b bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <WalletCards className="size-6 text-blue-600" /> 客户账户结算中心
            </h3>
            <p className="mt-1 text-sm text-slate-500">多卡多项目同时消费 · 会员价自动核算 · 现金券抵扣 · 整单纠错</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
              <small className="block text-amber-700">{wallet.membershipLabel}</small>
              <strong>{wallet.productDiscountLabel} · {wallet.servicePricingLabel}</strong>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
              <small className="block text-violet-700">可用现金券</small>
              <strong>{wallet.availableCashVoucherCount} 张 · ¥{wallet.availableCashVoucherValueExact}</strong>
            </div>
            <div className="rounded-xl bg-blue-600 px-5 py-3 text-white">
              <small className="text-blue-100">卡金总余额</small>
              <strong className="ml-3 text-2xl">¥{wallet.totalBalanceExact}</strong>
            </div>
          </div>
        </div>
        <nav className="mt-4 grid gap-2 sm:grid-cols-5">
          {([
            ['consume', '多项目消费', ShoppingCart],
            ['purchase', '余额购买', CreditCard],
            ['recharge', '充值 / 建卡', PackagePlus],
            ['vouchers', '现金券', TicketPercent],
            ['history', '流水 / 纠错', History],
          ] as const).map(([value, label, Icon]) => (
            <button
              type="button"
              key={value}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-semibold transition ${tab === value ? 'border-blue-500 bg-blue-600 text-white' : 'bg-white text-slate-700 hover:border-blue-300'}`}
              onClick={() => setTab(value)}
            >
              <Icon className="size-5" /> {label}
              {value === 'consume' && consumeCart.length > 0 && (
                <span className="rounded-full bg-white/20 px-2 text-xs">{consumeCart.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="p-5">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>本次操作未完成</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success" className="mb-4">
            <BadgeCheck className="size-5" />
            <AlertTitle>操作完成</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {tab === 'consume' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <h4 className="text-lg font-semibold text-blue-900">先从每张卡勾选本次要消费的全部项目</h4>
              <p className="mt-1 text-sm text-blue-700">可跨多张卡、多项同时选择；同一项目可修改本次扣除次数。</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {activeAccounts.map((account: CustomerCardWalletAccount) => (
                <article key={account.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-lg font-semibold">{account.cardName}</h4>
                      <p className="text-sm text-slate-500">本金 ¥{account.principalBalanceExact} · 赠送金 ¥{account.giftBalanceExact}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{account.status}</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {account.entitlements.map((entitlement: CustomerCardWalletEntitlement) => {
                      const selected: boolean = consumeCart.some(
                        (line: ConsumptionCartLine) => line.entitlementId === entitlement.id,
                      );
                      return (
                        <button
                          type="button"
                          key={entitlement.id}
                          className={`rounded-xl border p-3 text-left ${selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'hover:border-blue-300'}`}
                          onClick={() => addEntitlement(account, entitlement)}
                          disabled={entitlement.remainingCount <= 0}
                        >
                          <b className="block text-slate-900">{entitlement.name}</b>
                          <span className="mt-1 block text-sm text-slate-500">剩余 {entitlement.remainingCount} 次</span>
                          <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600"><Plus className="size-4" />{selected ? '再加 1 次' : '加入本次消费'}</span>
                        </button>
                      );
                    })}
                    {account.entitlements.length === 0 && <p className="text-sm text-slate-400">该卡暂无项目次数</p>}
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-2xl border p-4">
              <h4 className="text-lg font-semibold">使用卡金消费项目</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select className="h-10 rounded-md border bg-white px-3" value={moneyAccountId} onChange={(event) => setMoneyAccountId(event.target.value)}>
                  {activeAccounts.map((account: CustomerCardWalletAccount) => <option key={account.id} value={account.id}>{account.cardName}</option>)}
                </select>
                <select className="h-10 rounded-md border bg-white px-3" value={moneyMode} onChange={(event) => setMoneyMode(event.target.value as 'principal' | 'gift')}>
                  <option value="principal">本金余额</option>
                  <option value="gift">赠送金</option>
                </select>
                <Input placeholder="搜索或填写项目" value={projectQuery} onChange={(event) => { setProjectQuery(event.target.value); setMoneyProjectName(event.target.value); }} />
                <Input inputMode="decimal" placeholder="扣除金额" value={moneyAmount} onChange={(event) => setMoneyAmount(event.target.value)} />
                <Button type="button" onClick={addMoneyConsumption}><Plus className="mr-1 size-4" />加入清单</Button>
              </div>
              {projectQuery && (
                <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                  {filteredProjects.map((project: YouzanServiceItem) => (
                    <button type="button" key={project.id} className="rounded-lg border bg-white px-3 py-2 text-sm hover:border-blue-400" onClick={() => { setMoneyProjectName(project.name); setProjectQuery(project.name); setMoneyAmount(project.price.toFixed(2)); }}>
                      {project.name} · ¥{project.price.toFixed(2)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border-2 border-blue-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><h4 className="text-xl font-semibold">本次消费清单</h4><p className="text-sm text-slate-500">一次提交，生成同一个整单编号</p></div>
                <span className="rounded-xl bg-blue-50 px-4 py-2 font-semibold text-blue-700">{consumeCart.length} 项</span>
              </div>
              <div className="mt-4 space-y-2">
                {consumeCart.map((line: ConsumptionCartLine, index: number) => (
                  <div key={line.clientId} className="grid items-center gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[44px_minmax(0,1fr)_170px_minmax(220px,0.8fr)_44px]">
                    <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{index + 1}</span>
                    <div><b className="text-base">{line.itemName}</b><p className="text-sm text-slate-500">{line.cardName} · {line.availableLabel}</p></div>
                    {line.deductionMode === 'entitlement' ? (
                      <div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" onClick={() => updateConsumeLine(line.clientId, 'quantity', Math.max(1, Number(line.quantity || 1) - 1))}><Minus className="size-4" /></Button><Input className="text-center" value={String(line.quantity || 1)} onChange={(event) => updateConsumeLine(line.clientId, 'quantity', Number(event.target.value))} /><Button type="button" size="icon" variant="outline" onClick={() => updateConsumeLine(line.clientId, 'quantity', Number(line.quantity || 1) + 1)}><Plus className="size-4" /></Button></div>
                    ) : (
                      <label className="space-y-1"><small className="text-slate-500">项目会员单次价</small><Input inputMode="decimal" value={line.amountExact || ''} onChange={(event) => updateConsumeLine(line.clientId, 'amountExact', event.target.value)} /></label>
                    )}
                    {line.deductionMode === 'entitlement' ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">按项目次数核销，不使用现金券</p>
                    ) : (
                      <label className="space-y-1">
                        <small className="text-slate-500">单项目现金券（最多 1 张）</small>
                        <select
                          className="h-10 w-full rounded-md border bg-white px-3"
                          value={line.cashVoucherId || ''}
                          onChange={(event) => updateConsumeLine(line.clientId, 'cashVoucherId', event.target.value || undefined)}
                        >
                          <option value="">不使用现金券 · 预计扣 ¥{Number(line.amountExact || 0).toFixed(2)}</option>
                          {usableCashVouchers
                            .filter((voucher: CustomerCashVoucher) =>
                              voucher.id === line.cashVoucherId || !selectedVoucherIds.has(voucher.id),
                            )
                            .map((voucher: CustomerCashVoucher) => (
                              <option key={voucher.id} value={voucher.id}>
                                {voucher.name} ¥{voucher.faceValueExact} · 有效至 {voucher.validTo || '长期'}
                              </option>
                            ))}
                        </select>
                        {line.cashVoucherId && <strong className="block text-sm text-emerald-700">券后预计扣卡 ¥{estimatedLineDeduction(line)}</strong>}
                      </label>
                    )}
                    <Button type="button" size="icon" variant="ghost" onClick={() => setConsumeCart((current) => current.filter((item) => item.clientId !== line.clientId))}><Trash2 className="size-4 text-red-500" /></Button>
                  </div>
                ))}
                {consumeCart.length === 0 && <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">尚未选择本次消费项目</p>}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                <Input value={consumeReason} onChange={(event) => setConsumeReason(event.target.value)} placeholder="本次结算备注" />
                <Button size="lg" disabled={consumeCart.length === 0 || saving} onClick={() => void submitConsumption()}>{saving ? '正在结算…' : `确认同时扣除 ${consumeCart.length} 项`}</Button>
              </div>
            </div>
          </div>
        )}

        {tab === 'purchase' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <h4 className="text-lg font-semibold text-violet-900">用客户卡金购买项目、套餐、产品或新卡项</h4>
              <p className="mt-1 text-sm text-violet-700">{wallet.membershipLabel}：产品自动按 {wallet.productDiscountLabel}；所有服务项目统一按“会员单次价”，不再按会员等级重复打折。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1"><span className="text-sm font-medium">付款卡账户</span><select className="h-10 w-full rounded-md border bg-white px-3" value={moneyAccountId} onChange={(event) => setMoneyAccountId(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.cardName}</option>)}</select></label>
              <label className="space-y-1"><span className="text-sm font-medium">付款余额</span><select className="h-10 w-full rounded-md border bg-white px-3" value={moneyMode} onChange={(event) => setMoneyMode(event.target.value as 'principal' | 'gift')}><option value="principal">本金余额</option><option value="gift">赠送金</option></select></label>
              <label className="space-y-1"><span className="text-sm font-medium">购入项目放入</span><select className="h-10 w-full rounded-md border bg-white px-3" value={purchaseTargetAccountId} onChange={(event) => setPurchaseTargetAccountId(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.cardName}</option>)}</select></label>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <select className="h-10 rounded-md border bg-white px-3" value={purchaseType} onChange={(event) => { const nextType = event.target.value as Exclude<CustomerCardItemType, 'recharge'>; setPurchaseType(nextType); setPurchaseInventoryProductId(''); setPurchaseDiscount(nextType === 'product' ? wallet.productDiscountPercentExact : '100.00'); }}><option value="service">项目</option><option value="package">套餐</option><option value="product">产品</option><option value="card">卡项</option></select>
                <Input className="xl:col-span-2" placeholder="名称" value={purchaseName} onChange={(event) => setPurchaseName(event.target.value)} />
                <Input inputMode="numeric" placeholder="数量" value={purchaseQuantity} onChange={(event) => setPurchaseQuantity(event.target.value)} />
                <Input inputMode="decimal" placeholder="单价" value={purchasePrice} onChange={(event) => setPurchasePrice(event.target.value)} />
                <div className="flex gap-2"><Input inputMode="decimal" aria-label="结算折扣" readOnly={purchaseType === 'product' || purchaseType === 'service'} placeholder="折扣%" value={purchaseType === 'product' ? wallet.productDiscountPercentExact : purchaseType === 'service' ? '100.00' : purchaseDiscount} onChange={(event) => setPurchaseDiscount(event.target.value)} /><Button type="button" onClick={addPurchaseItem}><Plus className="size-4" /></Button></div>
              </div>
              <p className="mt-2 text-sm text-slate-500">{purchaseType === 'product' ? `产品折扣由会员身份锁定为 ${wallet.productDiscountLabel}` : purchaseType === 'service' ? '此处单价应填写该项目统一的会员单次价' : '套餐和卡项按其独立售价结算'}</p>
              {purchaseType === 'product' && !purchaseInventoryProductId && (
                <div className={`mt-3 grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 ${isOwner ? 'md:grid-cols-[1fr_160px_140px_auto]' : 'md:grid-cols-[1fr_140px_auto]'}`}>
                  <Input placeholder="新产品分类" value={newProductCategory} onChange={(event) => setNewProductCategory(event.target.value)} />
                  {isOwner && <Input inputMode="decimal" placeholder="进货成本（仅老板可见）" value={newProductCost} onChange={(event) => setNewProductCost(event.target.value)} />}
                  <Input inputMode="decimal" placeholder="首批入库数" value={newProductInitialStock} onChange={(event) => setNewProductInitialStock(event.target.value)} />
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void createProductForPurchase()}><PackagePlus className="mr-1 size-4" />建立新产品档案</Button>
                </div>
              )}
              {purchaseType === 'product' && purchaseInventoryProductId && (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">已匹配库存产品；结算成功会自动出库，整单撤回会自动恢复库存。</p>
              )}
              {purchaseType === 'package' && (
                <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700">请从已建立的套餐卡中选择，销售后才会准确计入套餐销量和客户使用统计。</p>
              )}
              <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-4">
                {(purchaseType === 'product' ? inventoryProducts.slice(0, 20) : purchaseType === 'package' ? packageTemplates : YOUZAN_SERVICE_CATALOG.slice(0, 20)).map((item) => {
                  const isPackage = 'packageNo' in item;
                  const isProduct = 'barcode' in item;
                  return <button type="button" key={item.id} className="rounded-xl border p-3 text-left hover:border-violet-400" onClick={() => isProduct ? chooseProductPurchase(item as InventoryProduct) : isPackage ? choosePackagePurchase(item as CardPackageTemplate) : chooseCatalogPurchase(item as YouzanServiceItem)}><b className="block truncate">{item.name}</b><span className="text-sm text-slate-500">¥{isProduct ? (item as InventoryProduct).retailPriceExact : isPackage ? (item as CardPackageTemplate).retailPriceExact : (item as YouzanServiceItem).price.toFixed(2)}</span>{isPackage && <small className="mt-1 block text-violet-600">{(item as CardPackageTemplate).totalProjectCount} 个项目 · {(item as CardPackageTemplate).totalServiceCount} 次</small>}</button>;
                })}
                {purchaseType === 'package' && packageTemplates.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2 xl:col-span-4">暂无可售套餐，请先在“卡项与项目”中建立卡项。</p>}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-violet-200 p-4">
              <h4 className="text-xl font-semibold">本次购买清单 · {purchaseCart.length} 项</h4>
              <div className="mt-3 space-y-2">
                {purchaseCart.map((item: PurchaseCartLine) => (
                  <div key={item.clientId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><b>{item.itemName}</b><p className="text-sm text-slate-500">{itemTypeLabel(item.itemType)} · {item.quantity} × ¥{item.unitPriceExact} · {item.discountPercentExact}%</p></div><Button type="button" size="icon" variant="ghost" onClick={() => setPurchaseCart((current) => current.filter((line) => line.clientId !== item.clientId))}><Trash2 className="size-4 text-red-500" /></Button></div>
                ))}
                {purchaseCart.length === 0 && <p className="rounded-xl bg-slate-50 p-8 text-center text-slate-500">尚未加入购买内容</p>}
              </div>
              {consumeCart.length > 0 && <label className="mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><input type="checkbox" checked={combineConsumption} onChange={(event) => setCombineConsumption(event.target.checked)} /><span><b>同时结算待消费的 {consumeCart.length} 个项目</b><small className="block text-slate-500">购买与消费使用同一个整单编号，便于一次核对和撤回</small></span></label>}
              <Button className="mt-4 w-full" size="lg" disabled={!moneyAccountId || purchaseCart.length === 0 || saving} onClick={() => void submitPurchase()}>{saving ? '正在联合结算…' : '确认用余额购买并入账'}</Button>
            </div>
          </div>
        )}

        {tab === 'recharge' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><h4 className="text-lg font-semibold text-emerald-900">充值、建立新卡或新增项目</h4><p className="mt-1 text-sm text-emerald-700">本金、赠送金和多个项目次数可在同一次入账中完成。</p></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className={`rounded-2xl border p-4 text-left ${!createNewCard ? 'border-emerald-500 bg-emerald-50' : ''}`} onClick={() => setCreateNewCard(false)}><b className="text-lg">给现有卡充值 / 加项目</b><p className="text-sm text-slate-500">选择客户已有卡账户</p></button>
              <button type="button" className={`rounded-2xl border p-4 text-left ${createNewCard ? 'border-emerald-500 bg-emerald-50' : ''}`} onClick={() => setCreateNewCard(true)}><b className="text-lg">建立一张新卡</b><p className="text-sm text-slate-500">自定义卡名、类型、有效期和权益</p></button>
            </div>
            <div className="rounded-2xl border p-4">
              {createNewCard ? (
                <div className="grid gap-3 md:grid-cols-3"><label className="space-y-1"><span className="text-sm font-medium">新卡名称</span><Input value={newCardName} onChange={(event) => setNewCardName(event.target.value)} placeholder="例如：年度焕肤卡" /></label><label className="space-y-1"><span className="text-sm font-medium">卡类型</span><Input value={newCardCategory} onChange={(event) => setNewCardCategory(event.target.value)} /></label><label className="space-y-1"><span className="text-sm font-medium">有效期</span><Input value={newCardValidity} onChange={(event) => setNewCardValidity(event.target.value)} /></label></div>
              ) : (
                <label className="block space-y-1"><span className="text-sm font-medium">充值到哪张卡</span><select className="h-10 w-full rounded-md border bg-white px-3" value={rechargeAccountId} onChange={(event) => setRechargeAccountId(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.cardName}</option>)}</select></label>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-sm font-medium">本金充值金额</span><Input inputMode="decimal" placeholder="0.00" value={principalRecharge} onChange={(event) => setPrincipalRecharge(event.target.value)} /></label><label className="space-y-1"><span className="text-sm font-medium">赠送金金额</span><Input inputMode="decimal" placeholder="0.00" value={giftRecharge} onChange={(event) => setGiftRecharge(event.target.value)} /></label></div>
            </div>
            <div className="rounded-2xl border p-4">
              <h4 className="text-lg font-semibold">同时新增 / 充值多个项目</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_140px_auto]"><Input placeholder="项目或套餐名称" value={rightName} onChange={(event) => setRightName(event.target.value)} /><Input placeholder="类型" value={rightType} onChange={(event) => setRightType(event.target.value)} /><Input inputMode="numeric" placeholder="次数" value={rightQuantity} onChange={(event) => setRightQuantity(event.target.value)} /><Button type="button" onClick={addRightDraft}><Plus className="mr-1 size-4" />加入</Button></div>
              <div className="mt-3 space-y-2">{rightDrafts.map((item: RechargeRightDraft) => <div key={item.clientId} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span><b>{item.name}</b><small className="ml-2 text-slate-500">{item.type} · {item.quantity} 次</small></span><Button type="button" size="icon" variant="ghost" onClick={() => setRightDrafts((current) => current.filter((line) => line.clientId !== item.clientId))}><Trash2 className="size-4 text-red-500" /></Button></div>)}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto]"><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="充值/建卡备注" /><Button size="lg" disabled={saving || (createNewCard ? !newCardName.trim() : !rechargeAccountId)} onClick={() => void submitRecharge()}>{saving ? '正在入账…' : createNewCard ? '确认建卡并入账' : '确认充值并入账'}</Button></div>
          </div>
        )}

        {tab === 'vouchers' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
              <h4 className="text-lg font-semibold text-violet-900">客户现金券账户</h4>
              <p className="mt-1 text-sm text-violet-700">现金券有效期精确到天；每张券只能抵扣一个服务项目，不能抵产品、套餐、卡项或整单。</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4"><small className="text-slate-500">可用现金券</small><strong className="mt-2 block text-3xl text-violet-700">{wallet.availableCashVoucherCount} 张</strong></div>
              <div className="rounded-2xl border bg-white p-4"><small className="text-slate-500">可抵扣总额</small><strong className="mt-2 block text-3xl text-violet-700">¥{wallet.availableCashVoucherValueExact}</strong></div>
              <div className="rounded-2xl border bg-white p-4"><small className="text-slate-500">会员赠券口径</small><strong className="mt-2 block text-xl text-slate-900">{wallet.membershipLabel}</strong><span className="mt-1 block text-sm text-slate-500">年度权益标准 {wallet.annualCashVoucherCount} 张；实际发放记录逐张留痕</span></div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="flex items-center gap-2"><TicketPercent className="size-5 text-violet-600" /><h4 className="text-lg font-semibold">赠送时效现金券</h4></div>
              <p className="mt-1 text-sm text-slate-500">“有效天数”从赠送当天起计算，精确到最后一个自然日；例如 30 天券会显示明确到期日期。</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.3fr)_160px_120px_140px_minmax(220px,1fr)_auto]">
                <label className="space-y-1"><span className="text-sm font-medium">现金券名称</span><Input value={voucherName} onChange={(event) => setVoucherName(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-sm font-medium">单张面额（元）</span><Input inputMode="decimal" value={voucherFaceValue} onChange={(event) => setVoucherFaceValue(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-sm font-medium">赠送张数</span><Input inputMode="numeric" value={voucherQuantity} onChange={(event) => setVoucherQuantity(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-sm font-medium">有效天数</span><Input inputMode="numeric" value={voucherValidDays} onChange={(event) => setVoucherValidDays(event.target.value)} /></label>
                <label className="space-y-1"><span className="text-sm font-medium">赠送原因</span><Input value={voucherReason} onChange={(event) => setVoucherReason(event.target.value)} /></label>
                <Button className="self-end" disabled={saving} onClick={() => void submitCashVoucherGrant()}>{saving ? '赠送中…' : '确认赠送'}</Button>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-lg font-semibold">每张现金券明细</h4><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">共 {wallet.cashVouchers.length} 张</span></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {wallet.cashVouchers.map((voucher: CustomerCashVoucher) => (
                  <article key={voucher.id} className={`rounded-xl border p-4 ${voucher.isUsable ? 'border-violet-200 bg-violet-50/50' : 'bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-3"><div><b className="text-base">{voucher.name}</b><p className="mt-1 text-sm text-slate-500">仅抵一个服务项目 · 面额 ¥{voucher.faceValueExact}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${voucher.status === '可用' ? 'bg-emerald-100 text-emerald-700' : voucher.status === '已使用' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>{voucher.status}</span></div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">有效期</dt><dd className="font-medium">{voucher.validFrom || '—'} 至 {voucher.validTo || '长期'}</dd></div><div><dt className="text-slate-500">使用记录</dt><dd className="font-medium">{voucher.usedProjectName || '尚未使用'}{voucher.usedAt ? ` · ${formatDateTime(voucher.usedAt)}` : ''}</dd></div></dl>
                  </article>
                ))}
                {wallet.cashVouchers.length === 0 && <p className="rounded-xl bg-slate-50 p-10 text-center text-slate-500 md:col-span-2">该客户暂无现金券，可在上方按天设置有效期并赠送。</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h4 className="text-lg font-semibold text-amber-900">每笔消费、购买和充值都按整单保留</h4><p className="mt-1 text-sm text-amber-700">“修改”会先生成冲正流水，再把原内容带回重新录入；不会覆盖或删除历史。</p></div>
            {operationGroups.map(({ operationNo, rows }) => {
              const originalRows = rows.filter((row) => row.transactionType !== 'reversal');
              const canReverse = Boolean(rows[0]?.operationNo) && originalRows.length > 0 && originalRows.some((row) => !row.reversed);
              return (
                <article key={operationNo} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3"><div><p className="text-sm text-slate-500">整单编号</p><h4 className="break-all text-lg font-semibold">{operationNo}</h4><p className="mt-1 text-sm text-slate-500">{formatDateTime(rows[0]?.occurredAt || new Date().toISOString())} · {rows[0]?.operatorName}</p></div>{canReverse && <div className="flex gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setPendingReverse({ operationNo, rows, editAfter: true })}><RefreshCcw className="mr-1 size-4" />修改本单</Button><Button type="button" variant="destructive" disabled={saving} onClick={() => setPendingReverse({ operationNo, rows, editAfter: false })}><RotateCcw className="mr-1 size-4" />{reversingOperation === operationNo ? '撤回中' : '整单撤回'}</Button></div>}</div>
                  <div className="mt-3 space-y-2">{rows.map((row: CustomerCardWalletLedgerEntry) => <div key={row.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-[110px_minmax(0,1fr)_190px_180px]"><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${row.transactionType === 'credit' ? 'bg-emerald-100 text-emerald-700' : row.transactionType === 'reversal' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{row.transactionType === 'credit' ? '充值/购入' : row.transactionType === 'reversal' ? '冲正恢复' : '消费扣除'}</span><div><b>{row.projectName}</b><p className="text-sm text-slate-500">{itemTypeLabel(row.itemType)} · {row.cardName}{row.entitlementName ? ` · ${row.entitlementName}` : ''}</p>{Number(row.cashVoucherDiscountExact || 0) > 0 && <p className="mt-1 text-sm font-medium text-violet-700">现金券抵扣 ¥{row.cashVoucherDiscountExact} · 单项目已使用</p>}</div><div><b>{entryValue(row)}</b>{Number(row.cashVoucherDiscountExact || 0) > 0 && <small className="block text-slate-500">项目会员价 ¥{(Number(row.amountExact) + Number(row.cashVoucherDiscountExact)).toFixed(2)}</small>}</div><span className="text-sm text-slate-500">流水 {row.transactionNo}</span></div>)}</div>
                </article>
              );
            })}
            {operationGroups.length === 0 && <p className="rounded-xl bg-slate-50 p-10 text-center text-slate-500">暂无客户账户流水</p>}
          </div>
        )}
      </div>
      <Dialog open={Boolean(pendingReverse)} onOpenChange={(open: boolean) => !open && setPendingReverse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingReverse?.editAfter ? '确认撤回并修改本单？' : '确认撤回整单？'}</DialogTitle>
            <DialogDescription>
              {pendingReverse?.editAfter
                ? '系统会保留原单、生成冲正流水，再把原内容带回待结算清单。'
                : '所有尚未被后续使用的金额和项目次数会恢复，原单不会删除。'}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            整单编号：{pendingReverse?.operationNo}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingReverse(null)} disabled={saving}>取消</Button>
            <Button
              variant="destructive"
              disabled={saving || !pendingReverse}
              onClick={() => {
                if (!pendingReverse) return;
                const target = pendingReverse;
                setPendingReverse(null);
                void reverseOperation(target.operationNo, target.rows, target.editAfter);
              }}
            >
              {saving ? '处理中…' : pendingReverse?.editAfter ? '确认撤回并修改' : '确认整单撤回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
