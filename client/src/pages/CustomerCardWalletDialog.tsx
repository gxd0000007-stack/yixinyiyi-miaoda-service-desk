import { useEffect, useState } from 'react';
import { ShieldCheck, WalletCards } from 'lucide-react';

import { getCustomerCardWallet } from '@client/src/api';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
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
import type {
  CustomerCardWalletAccount,
  CustomerCardWalletResponse,
} from '@shared/api.interface';

import CustomerAccountCenter from './CustomerAccountCenter';

interface CustomerCardWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  customerName: string;
  memberLevel?: string;
  cardNames?: string[];
  appointmentId: string;
  projectName: string;
  canOperate: boolean;
  onWalletUpdated: (totalBalanceExact: string) => void;
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return error instanceof Error ? error.message : '卡账户加载失败';
}

export default function CustomerCardWalletDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  memberLevel,
  cardNames = [],
  canOperate,
  onWalletUpdated,
}: CustomerCardWalletDialogProps) {
  const [wallet, setWallet] = useState<CustomerCardWalletResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !customerId) return;
    setLoading(true);
    setError('');
    getCustomerCardWallet(customerId)
      .then((response: CustomerCardWalletResponse) => setWallet(response))
      .catch((loadError: unknown) => setError(errorMessage(loadError)))
      .finally(() => setLoading(false));
  }, [customerId, open]);

  const updateWallet = (nextWallet: CustomerCardWalletResponse): void => {
    setWallet(nextWallet);
    onWalletUpdated(nextWallet.totalBalanceExact);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-[min(98vw,1500px)] overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-blue-50 to-white px-7 py-5 pr-16">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-600">
            <WalletCards className="size-5" /> 客户资料 · 账户与结算
          </div>
          <div className="customer-name-membership-row">
            <DialogTitle className="text-3xl">{customerName}</DialogTitle>
            <CustomerMembershipBadge memberLevel={memberLevel} cardNames={cardNames} />
          </div>
          <DialogDescription className="text-lg font-medium text-slate-700">
            卡项、余额、消费与充值
          </DialogDescription>
          <DialogDescription className="text-base">
            在客户资料内完成多项目扣卡、余额购买、充值建卡和整单纠错。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(94vh-160px)] overflow-y-auto p-6">
          {loading && <div className="py-24 text-center text-slate-500">正在核对客户卡账户…</div>}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>卡账户暂时无法打开</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!loading && wallet && customerId && canOperate && (
            <CustomerAccountCenter
              customerId={customerId}
              customerName={customerName}
              wallet={wallet}
              onWalletChange={updateWallet}
            />
          )}
          {!loading && wallet && !canOperate && (
            <div className="space-y-4">
              <Alert>
                <ShieldCheck className="size-4" />
                <AlertTitle>当前为只读查看</AlertTitle>
                <AlertDescription>只有老板和前台可以消费、购买、充值、撤回或修改。</AlertDescription>
              </Alert>
              <section className="rounded-2xl bg-blue-600 p-6 text-white">
                <span className="text-blue-100">当前卡金总余额</span>
                <strong className="mt-1 block text-4xl">¥{wallet.totalBalanceExact}</strong>
              </section>
              <div className="grid gap-4 md:grid-cols-2">
                {wallet.accounts.map((account: CustomerCardWalletAccount) => (
                  <article key={account.id} className="rounded-2xl border p-5">
                    <h3 className="text-xl font-semibold">{account.cardName}</h3>
                    <p className="mt-1 text-slate-500">本金 ¥{account.principalBalanceExact} · 赠送金 ¥{account.giftBalanceExact}</p>
                    <div className="mt-3 space-y-2">
                      {account.entitlements.map((item) => (
                        <div key={item.id} className="flex justify-between rounded-xl bg-slate-50 p-3"><span>{item.name}</span><b>{item.remainingCount} 次</b></div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-slate-50 px-7 py-4">
          <span className="mr-auto flex items-center gap-2 text-sm text-emerald-700"><ShieldCheck className="size-4" /> 妙搭云端卡账 · 原单与纠错记录永久保留</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
