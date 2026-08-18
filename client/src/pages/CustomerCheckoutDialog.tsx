import { useEffect, useState } from 'react';
import {
  ChevronRight,
  ReceiptText,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import {
  getCheckoutCustomerDetail,
  getCustomerCardWallet,
  searchCheckoutCustomers,
} from '@client/src/api';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import CustomerAvatar from '@client/src/components/CustomerAvatar';
import CustomerMembershipBadge from '@client/src/components/CustomerMembershipBadge';
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
import type {
  CustomerAssetDetail,
  CustomerAssetSummary,
  CustomerCardWalletResponse,
} from '@shared/api.interface';

import CustomerAccountCenter from './CustomerAccountCenter';

interface CustomerCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function CustomerCheckoutDialog({
  open,
  onOpenChange,
}: CustomerCheckoutDialogProps) {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerAssetSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<CustomerAssetDetail | null>(null);
  const [wallet, setWallet] = useState<CustomerCardWalletResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  const loadCustomers = async (keyword: string): Promise<void> => {
    setSearching(true);
    setError('');
    try {
      const response = await searchCheckoutCustomers({
        query: keyword.trim(),
        page: 1,
        pageSize: 20,
      });
      setCustomers(response.items);
    } catch (loadError: unknown) {
      setError(errorMessage(loadError));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(null);
    setWallet(null);
    setError('');
    void loadCustomers('');
  }, [open]);

  const chooseCustomer = async (customer: CustomerAssetSummary): Promise<void> => {
    setLoadingDetail(true);
    setError('');
    try {
      const [detailResponse, walletResponse] = await Promise.all([
        getCheckoutCustomerDetail(customer.id),
        getCustomerCardWallet(customer.id),
      ]);
      setSelected(detailResponse.asset);
      setWallet(walletResponse);
    } catch (loadError: unknown) {
      setError(errorMessage(loadError));
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[min(98vw,1680px)] overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-blue-50 to-white px-7 py-5 pr-16">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <ReceiptText className="size-5" /> 独立客户账户结算台
          </div>
          <DialogTitle className="text-3xl">查客户 → 多项消费 / 购买 → 充值建卡 → 可撤回纠错</DialogTitle>
          <DialogDescription className="text-base">
            仅老板和前台可操作。一次可跨多张卡同时扣除多个项目，所有金额精确到分并永久留痕。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_1fr]">
          <aside className="max-h-[calc(95vh-190px)] overflow-y-auto border-r bg-slate-50 p-5">
            <Label htmlFor="checkout-customer-search" className="text-lg font-semibold">
              1. 查询客户
            </Label>
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="checkout-customer-search"
                  className="pl-9"
                  placeholder="姓名、手机、会员"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void loadCustomers(query);
                  }}
                />
              </div>
              <Button variant="outline" onClick={() => void loadCustomers(query)} disabled={searching}>
                {searching ? '查询中' : '查询'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">默认按累计消费从高到低展示</p>

            <div className="mt-4 space-y-2">
              {customers.map((customer: CustomerAssetSummary) => (
                <button
                  type="button"
                  key={customer.id}
                  className={`w-full rounded-xl border bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm ${selected?.id === customer.id ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}
                  onClick={() => void chooseCustomer(customer)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <span className="customer-name-membership-row">
                        <strong className="block text-xl text-slate-900">{customer.name}</strong>
                        <CustomerMembershipBadge memberLevel={customer.memberLevel} compact />
                      </span>
                      <small className="text-slate-500">{customer.mobile || '手机号待补充'}</small>
                    </span>
                    <ChevronRight className="mt-1 size-4 text-slate-400" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-slate-500">累计消费</span>
                    <b>¥{customer.totalSpendExact || Number(customer.totalSpend || 0).toFixed(2)}</b>
                  </div>
                </button>
              ))}
              {!searching && customers.length === 0 && (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">没有找到匹配客户</div>
              )}
            </div>
          </aside>

          <main className="max-h-[calc(95vh-190px)] overflow-y-auto p-6">
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertTitle>内容加载失败</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {loadingDetail && <div className="py-24 text-center text-slate-500">正在核对客户资料与卡账户…</div>}
            {!loadingDetail && !selected && (
              <div className="flex min-h-[560px] flex-col items-center justify-center rounded-2xl border border-dashed bg-slate-50 text-center">
                <UserRound className="size-14 text-blue-300" />
                <h3 className="mt-4 text-2xl font-semibold">先从左侧选择客户</h3>
                <p className="mt-2 text-slate-500">选中后可消费、购买、充值、建卡和查看可撤回流水</p>
              </div>
            )}

            {!loadingDetail && selected && wallet && (
              <div className="space-y-5">
                <section className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <CustomerAvatar
                        name={selected.name}
                        customerId={selected.id}
                        avatarPreset={selected.avatarPreset}
                        avatarUrl={selected.avatarUrl}
                        size={64}
                        className="rounded-2xl"
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-3xl font-semibold">{selected.name}</h2>
                          <CustomerMembershipBadge
                            memberLevel={selected.memberLevel}
                            cardNames={selected.cardAssets.map((card): string => card.cardName)}
                          />
                        </div>
                        <p className="mt-1 text-base text-slate-500">{selected.mobile || '手机号待补充'} · 服务员工 {selected.serviceStaff.join('、') || '待分配'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selected.tags.slice(0, 8).map((tag: string) => (
                            <span key={tag} className="rounded-md bg-slate-100 px-2.5 py-1 text-sm text-slate-600">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-2 text-right sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 px-4 py-3"><small className="text-slate-500">累计消费</small><b className="block text-lg">¥{selected.totalSpendExact || Number(selected.totalSpend || 0).toFixed(2)}</b></div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3"><small className="text-slate-500">卡账户</small><b className="block text-lg">{wallet.accounts.length} 张</b></div>
                      <div className="rounded-xl bg-slate-50 px-4 py-3"><small className="text-slate-500">档案完整度</small><b className="block text-lg">{selected.profileCompleteness}%</b></div>
                    </div>
                  </div>
                </section>

                <CustomerAccountCenter
                  customerId={selected.id}
                  customerName={selected.name}
                  wallet={wallet}
                  onWalletChange={setWallet}
                />
              </div>
            )}
          </main>
        </div>

        <DialogFooter className="border-t bg-slate-50 px-7 py-4">
          <span className="mr-auto flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck className="size-4" /> 妙搭云端卡账 · 多项目整单 · 精确到分 · 可追溯纠错</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭结算台</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
