import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  AlertTriangle,
  Database,
  ImageUp,
  LoaderCircle,
  PencilLine,
  Save,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react';

import CustomerAvatar, {
  CAT_AVATAR_PRESETS,
} from '@client/src/components/CustomerAvatar';
import CustomerMembershipBadge from '@client/src/components/CustomerMembershipBadge';
import { uploadFile } from '@client/src/components/business-ui/api/files/service';
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
import type {
  CustomerAssetDetail,
  CustomerAssetSegmentItem,
  CustomerAssetSegmentsResponse,
  UpdateCustomerAssetSupplementRequest,
} from '@shared/api.interface';

type CustomerSegmentMode = 'highValue' | 'incomplete';

interface CustomerSegmentDialogProps {
  open: boolean;
  mode: CustomerSegmentMode;
  loading: boolean;
  error: string;
  data: CustomerAssetSegmentsResponse | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  onSupplement: (id: string) => void;
}

interface CustomerSupplementDialogProps {
  open: boolean;
  asset: CustomerAssetDetail | null;
  saving: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSave: (request: UpdateCustomerAssetSupplementRequest) => Promise<void>;
}

interface SupplementDraft {
  avatarPreset: string;
  avatarUrl: string;
  avatarBucketId: string;
  avatarFilePath: string;
  mobile: string;
  memberLevel: string;
  initialSource: string;
  totalSpend: string;
  currentBalance: string;
  serviceStaff: string;
  primarySkinConcerns: string;
  projectPreferences: string;
  serviceRisks: string;
  servicePreferences: string;
  specialHealthStatus: string;
  painTolerance: string;
  healthNotes: string;
  consumptionNotes: string;
  communicationNotes: string;
}

function formatCurrency(value?: number): string {
  if (value === undefined) return '待补充';
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);
}

function emptyDraft(): SupplementDraft {
  return {
    avatarPreset: '',
    avatarUrl: '',
    avatarBucketId: '',
    avatarFilePath: '',
    mobile: '',
    memberLevel: '',
    initialSource: '',
    totalSpend: '',
    currentBalance: '',
    serviceStaff: '',
    primarySkinConcerns: '',
    projectPreferences: '',
    serviceRisks: '',
    servicePreferences: '',
    specialHealthStatus: '',
    painTolerance: '',
    healthNotes: '',
    consumptionNotes: '',
    communicationNotes: '',
  };
}

function profileValue(asset: CustomerAssetDetail, field: string): string {
  const value: unknown = asset.rawProfile[field];
  if (Array.isArray(value)) return value.map(String).join('、');
  if (value === null || value === undefined) return '';
  return String(value);
}

function toDraft(asset: CustomerAssetDetail): SupplementDraft {
  const supplement = asset.supplement;
  return {
    avatarPreset: supplement.avatarPreset || asset.avatarPreset || '',
    avatarUrl: supplement.avatarUrl || asset.avatarUrl || '',
    avatarBucketId: supplement.avatarBucketId || '',
    avatarFilePath: supplement.avatarFilePath || '',
    mobile: supplement.mobile || asset.mobile || '',
    memberLevel: supplement.memberLevel || asset.memberLevel || '',
    initialSource: supplement.initialSource || asset.initialSource || '',
    totalSpend: String(supplement.totalSpend ?? asset.totalSpend ?? ''),
    currentBalance: String(
      supplement.currentBalance ?? asset.currentBalance ?? '',
    ),
    serviceStaff:
      supplement.serviceStaff.join('、') || asset.serviceStaff.join('、'),
    primarySkinConcerns:
      supplement.primarySkinConcerns.join('、') ||
      asset.primarySkinConcerns.join('、'),
    projectPreferences:
      supplement.projectPreferences.join('、') ||
      asset.projectPreferences.join('、'),
    serviceRisks:
      supplement.serviceRisks.join('、') || asset.serviceRisks.join('、'),
    servicePreferences:
      supplement.servicePreferences.join('、') ||
      profileValue(asset, '服务风格'),
    specialHealthStatus:
      supplement.specialHealthStatus || profileValue(asset, '是否在哺乳期'),
    painTolerance:
      supplement.painTolerance || profileValue(asset, '疼痛耐受度'),
    healthNotes:
      supplement.healthNotes || profileValue(asset, '健康注意补充'),
    consumptionNotes:
      supplement.consumptionNotes || profileValue(asset, '消费与资产补充'),
    communicationNotes:
      supplement.communicationNotes || profileValue(asset, '沟通备注'),
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[、,，;；\n]+/u)
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | undefined {
  const normalized: string = value.trim();
  if (!normalized) return undefined;
  const parsed: number = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function toRequest(draft: SupplementDraft): UpdateCustomerAssetSupplementRequest {
  return {
    avatarPreset: draft.avatarPreset,
    avatarUrl: draft.avatarUrl,
    avatarBucketId: draft.avatarBucketId,
    avatarFilePath: draft.avatarFilePath,
    mobile: draft.mobile,
    memberLevel: draft.memberLevel,
    initialSource: draft.initialSource,
    totalSpend: optionalNumber(draft.totalSpend),
    currentBalance: optionalNumber(draft.currentBalance),
    serviceStaff: splitList(draft.serviceStaff),
    primarySkinConcerns: splitList(draft.primarySkinConcerns),
    projectPreferences: splitList(draft.projectPreferences),
    serviceRisks: splitList(draft.serviceRisks),
    servicePreferences: splitList(draft.servicePreferences),
    specialHealthStatus: draft.specialHealthStatus,
    painTolerance: draft.painTolerance,
    healthNotes: draft.healthNotes,
    consumptionNotes: draft.consumptionNotes,
    communicationNotes: draft.communicationNotes,
  };
}

function SegmentCustomerCard({
  item,
  rank,
  mode,
  onSelect,
  onSupplement,
}: {
  item: CustomerAssetSegmentItem;
  rank?: number;
  mode: CustomerSegmentMode;
  onSelect: (id: string) => void;
  onSupplement: (id: string) => void;
}) {
  return (
    <article className="asset-segment-person">
      <div className="asset-segment-person-head">
        <CustomerAvatar
          name={item.name}
          customerId={item.id}
          avatarPreset={item.avatarPreset}
          avatarUrl={item.avatarUrl}
          size={38}
          className="asset-avatar"
        />
        <div>
          <div className="customer-name-membership-row">
            <h3>{item.name}</h3>
            <CustomerMembershipBadge memberLevel={item.memberLevel} compact />
          </div>
          <p>{item.mobile || '手机号待补充'}</p>
        </div>
        <strong>
          {mode === 'highValue' && rank ? `第 ${rank} 名` : `${item.profileCompleteness}%`}
        </strong>
      </div>
      {mode === 'highValue' ? (
        <div className="asset-segment-metrics">
          <span><small>累计消费</small><b>{formatCurrency(item.totalSpend)}</b></span>
          <span><small>卡内余额</small><b>{formatCurrency(item.currentBalance)}</b></span>
          <span>
            <small>服务员工</small>
            <b>{item.serviceStaff.join('、') || '待分配'}</b>
          </span>
        </div>
      ) : (
        <div className="asset-missing-fields">
          <small>待补充 {item.missingFields.length} 项</small>
          <div>
            {item.missingFields.map((field: string) => (
              <span key={`${item.id}-${field}`}>{field}</span>
            ))}
          </div>
        </div>
      )}
      <div className="asset-segment-actions">
        <Button variant="outline" size="sm" onClick={() => onSelect(item.id)}>
          <UserRound /> 查看完整档案
        </Button>
        {mode === 'incomplete' && (
          <Button size="sm" onClick={() => onSupplement(item.id)}>
            <PencilLine /> 立即补充
          </Button>
        )}
      </div>
    </article>
  );
}

export function CustomerSegmentDialog({
  open,
  mode,
  loading,
  error,
  data,
  onOpenChange,
  onSelect,
  onSupplement,
}: CustomerSegmentDialogProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const items: CustomerAssetSegmentItem[] = mode === 'highValue'
    ? data?.highValueCustomers || []
    : data?.incompleteCustomers || [];
  const normalizedQuery: string = searchQuery.trim().toLocaleLowerCase('zh-CN');
  const visibleItems: CustomerAssetSegmentItem[] = normalizedQuery
    ? items.filter((item: CustomerAssetSegmentItem) =>
        [
          item.name,
          item.nickname,
          item.mobile,
          item.memberLevel,
          item.initialSource,
          ...item.serviceStaff,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('zh-CN')
          .includes(normalizedQuery),
      )
    : items;

  useEffect(() => {
    if (open) setSearchQuery('');
  }, [mode, open]);

  const title: string = mode === 'highValue'
    ? `高价值客户 · ${items.length} 位`
    : `档案待完善 · ${items.length} 位`;
  const description: string = mode === 'highValue'
    ? '按累计消费金额从高到低实时排序，可直接进入每位客户的完整档案。'
    : '按档案完整度由低到高排列，缺失字段已逐项标出，可直接补充。';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="asset-segment-dialog">
        <DialogHeader>
          <div className="asset-dialog-kicker">
            {mode === 'highValue' ? <Sparkles /> : <Database />}
            {mode === 'highValue' ? '客户价值分层' : '客户档案质检'}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="asset-segment-toolbar">
          <Search />
          <Input
            aria-label="搜索客户"
            placeholder="搜索姓名、手机号、会员、来源或服务员工"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <span>
            {normalizedQuery
              ? `找到 ${visibleItems.length} 位`
              : `共 ${items.length} 位`}
          </span>
        </div>
        <div className="asset-segment-list" data-ai-section-type="card-list">
          {loading && (
            <div className="asset-dialog-state">
              <LoaderCircle className="asset-spin" /> 正在读取客户名单…
            </div>
          )}
          {!loading && error && (
            <div className="asset-dialog-state error">
              <AlertTriangle /> {error}
            </div>
          )}
          {!loading && !error && visibleItems.length === 0 && (
            <div className="asset-dialog-state">
              {normalizedQuery ? '没有找到匹配客户' : '当前没有符合条件的客户'}
            </div>
          )}
          {!loading && !error && visibleItems.map((item: CustomerAssetSegmentItem) => (
            <SegmentCustomerCard
              key={item.id}
              item={item}
              rank={mode === 'highValue'
                ? items.findIndex((customer) => customer.id === item.id) + 1
                : undefined}
              mode={mode}
              onSelect={onSelect}
              onSupplement={onSupplement}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerSupplementDialog({
  open,
  asset,
  saving,
  error,
  onOpenChange,
  onSave,
}: CustomerSupplementDialogProps) {
  const [draft, setDraft] = useState<SupplementDraft>(emptyDraft());
  const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
  const [avatarError, setAvatarError] = useState<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(asset ? toDraft(asset) : emptyDraft());
    setAvatarError('');
  }, [asset]);

  const updateField = (field: keyof SupplementDraft, value: string): void => {
    setDraft((current: SupplementDraft) => ({ ...current, [field]: value }));
  };

  const selectAvatarPreset = (preset: string): void => {
    setDraft((current: SupplementDraft) => ({
      ...current,
      avatarPreset: preset,
      avatarUrl: '',
      avatarBucketId: '',
      avatarFilePath: '',
    }));
    setAvatarError('');
  };

  const handleAvatarUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file: File | undefined = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('请选择 JPG、PNG 或 WebP 图片');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError('头像图片不能超过 8MB');
      return;
    }
    setUploadingAvatar(true);
    setAvatarError('');
    try {
      const uploaded = await uploadFile(file);
      setDraft((current: SupplementDraft) => ({
        ...current,
        avatarPreset: '',
        avatarUrl: uploaded.url,
        avatarBucketId: uploaded.bucketId,
        avatarFilePath: uploaded.filePath,
      }));
    } catch {
      setAvatarError('头像上传失败，请检查网络后重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="asset-supplement-dialog">
        <DialogHeader>
          <div className="asset-dialog-kicker"><PencilLine />本地补充档案</div>
          <DialogTitle>
            {asset ? `补充 ${asset.name} 的客户资料` : '补充客户资料'}
          </DialogTitle>
          <DialogDescription>
            保存后立即用于预约和服务流程；飞书客户原表保持只读，不会被改动。
          </DialogDescription>
        </DialogHeader>
        <div className="asset-supplement-grid">
          <section className="customer-avatar-picker wide">
            <div className="customer-avatar-picker-head">
              <CustomerAvatar
                name={asset?.name || '客户'}
                customerId={asset?.id}
                avatarPreset={draft.avatarPreset}
                avatarUrl={draft.avatarUrl}
                size={58}
              />
              <div>
                <strong>客户头像</strong>
                <small>选择系统猫猫，或上传客户自己的头像；保存后所有端口同步显示。</small>
              </div>
            </div>
            <div className="customer-avatar-presets" aria-label="系统猫猫头像预设">
              {CAT_AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`customer-avatar-preset ${draft.avatarPreset === preset.id && !draft.avatarUrl ? 'active' : ''}`}
                  onClick={() => selectAvatarPreset(preset.id)}
                  aria-label={`选择${preset.label}头像`}
                >
                  <CustomerAvatar
                    name={preset.label}
                    avatarPreset={preset.id}
                    size={34}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
            <div className="customer-avatar-upload-row">
              <Input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="上传客户头像"
                onChange={(event) => void handleAvatarUpload(event)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploadingAvatar ? <LoaderCircle className="asset-spin" /> : <ImageUp />}
                {uploadingAvatar ? '正在上传' : '上传自定义头像'}
              </Button>
              <small>支持 JPG、PNG、WebP，最大 8MB。</small>
              {avatarError && <small className="customer-avatar-upload-error">{avatarError}</small>}
            </div>
          </section>
          <div><Label htmlFor="asset-mobile">手机号</Label><Input id="asset-mobile" value={draft.mobile} onChange={(event) => updateField('mobile', event.target.value)} /></div>
          <div><Label htmlFor="asset-member">会员档位</Label><Input id="asset-member" value={draft.memberLevel} onChange={(event) => updateField('memberLevel', event.target.value)} /></div>
          <div className="wide"><Label htmlFor="asset-source">客户来源</Label><Input id="asset-source" value={draft.initialSource} onChange={(event) => updateField('initialSource', event.target.value)} /></div>
          <div><Label htmlFor="asset-spend">累计消费</Label><Input id="asset-spend" type="number" min="0" value={draft.totalSpend} onChange={(event) => updateField('totalSpend', event.target.value)} /></div>
          <div><Label htmlFor="asset-balance">卡内余额</Label><Input id="asset-balance" type="number" min="0" value={draft.currentBalance} onChange={(event) => updateField('currentBalance', event.target.value)} /></div>
          <div><Label htmlFor="asset-staff">服务员工</Label><Input id="asset-staff" value={draft.serviceStaff} placeholder="多人用顿号分隔" onChange={(event) => updateField('serviceStaff', event.target.value)} /></div>
          <div><Label htmlFor="asset-skin">主要肤况</Label><Input id="asset-skin" value={draft.primarySkinConcerns} placeholder="多项用顿号分隔" onChange={(event) => updateField('primarySkinConcerns', event.target.value)} /></div>
          <div><Label htmlFor="asset-project">项目需求</Label><Input id="asset-project" value={draft.projectPreferences} placeholder="多项用顿号分隔" onChange={(event) => updateField('projectPreferences', event.target.value)} /></div>
          <div><Label htmlFor="asset-risk">服务雷区</Label><Input id="asset-risk" value={draft.serviceRisks} placeholder="多项用顿号分隔" onChange={(event) => updateField('serviceRisks', event.target.value)} /></div>
          <div className="wide"><Label htmlFor="asset-preference">服务偏好</Label><Input id="asset-preference" value={draft.servicePreferences} placeholder="温度、力度、房间或沟通偏好" onChange={(event) => updateField('servicePreferences', event.target.value)} /></div>
          <div><Label htmlFor="asset-health-status">特殊健康状态</Label><Input id="asset-health-status" value={draft.specialHealthStatus} placeholder="如无特殊情况填写：否" onChange={(event) => updateField('specialHealthStatus', event.target.value)} /></div>
          <div><Label htmlFor="asset-pain">疼痛耐受度</Label><Input id="asset-pain" value={draft.painTolerance} placeholder="低、中、高或具体说明" onChange={(event) => updateField('painTolerance', event.target.value)} /></div>
          <div className="wide"><Label htmlFor="asset-health">健康与特殊注意</Label><Textarea id="asset-health" value={draft.healthNotes} onChange={(event) => updateField('healthNotes', event.target.value)} /></div>
          <div className="wide"><Label htmlFor="asset-consumption">消费与资产备注</Label><Textarea id="asset-consumption" value={draft.consumptionNotes} onChange={(event) => updateField('consumptionNotes', event.target.value)} /></div>
          <div className="wide"><Label htmlFor="asset-communication">沟通备注</Label><Textarea id="asset-communication" value={draft.communicationNotes} onChange={(event) => updateField('communicationNotes', event.target.value)} /></div>
        </div>
        {error && <div className="asset-save-error"><AlertTriangle />{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={() => onSave(toRequest(draft))} disabled={saving || uploadingAvatar || !asset}>
            {saving ? <LoaderCircle className="asset-spin" /> : <Save />}
            {saving ? '正在保存' : '保存并用于服务台'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { CustomerSegmentMode };
