import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BadgePlus,
  LoaderCircle,
  Save,
} from 'lucide-react';

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
import type { CreateCustomerAssetRequest } from '@shared/api.interface';

interface CustomerCreateDialogProps {
  open: boolean;
  saving: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSave: (request: CreateCustomerAssetRequest) => Promise<void>;
}

interface CustomerCreateDraft {
  name: string;
  nickname: string;
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

function emptyDraft(): CustomerCreateDraft {
  return {
    name: '',
    nickname: '',
    mobile: '',
    memberLevel: '新客待建档',
    initialSource: '到店新客',
    totalSpend: '0',
    currentBalance: '0',
    serviceStaff: '',
    primarySkinConcerns: '',
    projectPreferences: '',
    serviceRisks: '',
    servicePreferences: '',
    specialHealthStatus: '待确认',
    painTolerance: '待确认',
    healthNotes: '',
    consumptionNotes: '',
    communicationNotes: '',
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[、,，;；\n]+/u)
    .map((item: string) => item.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed: number = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function toRequest(draft: CustomerCreateDraft): CreateCustomerAssetRequest {
  return {
    name: draft.name,
    nickname: draft.nickname,
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

export default function CustomerCreateDialog({
  open,
  saving,
  error,
  onOpenChange,
  onSave,
}: CustomerCreateDialogProps) {
  const [draft, setDraft] = useState<CustomerCreateDraft>(emptyDraft());
  const [validationError, setValidationError] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft());
    setValidationError('');
  }, [open]);

  const updateField = (
    field: keyof CustomerCreateDraft,
    value: string,
  ): void => {
    setDraft((current: CustomerCreateDraft) => ({ ...current, [field]: value }));
  };

  const submit = (): void => {
    if (!draft.name.trim()) {
      setValidationError('请先填写客户姓名。');
      return;
    }
    setValidationError('');
    void onSave(toRequest(draft));
  };

  const field = (
    id: string,
    label: string,
    key: keyof CustomerCreateDraft,
    placeholder = '',
    type = 'text',
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        min={type === 'number' ? '0' : undefined}
        value={draft[key]}
        placeholder={placeholder}
        onChange={(event) => updateField(key, event.target.value)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="asset-create-dialog">
        <DialogHeader>
          <div className="asset-dialog-kicker"><BadgePlus />新增客户建档</div>
          <DialogTitle>添加一位新客户</DialogTitle>
          <DialogDescription>
            姓名是唯一必填项。保存后立即进入客户资料库、预约和服务流程；原始飞书客户表保持只读。
          </DialogDescription>
        </DialogHeader>
        <div className="asset-create-sections">
          <section>
            <h3>1. 基础身份</h3>
            <div className="asset-supplement-grid">
              {field('create-name', '客户姓名 *', 'name', '请输入客户姓名')}
              {field('create-nickname', '客户昵称', 'nickname', '员工常用称呼')}
              {field('create-mobile', '手机号', 'mobile', '用于识别重复客户')}
              {field('create-source', '客户来源', 'initialSource')}
              {field('create-member', '会员状态', 'memberLevel')}
              {field('create-staff', '服务员工', 'serviceStaff', '多人用顿号分隔')}
            </div>
          </section>
          <section>
            <h3>2. 消费资产与项目需求</h3>
            <div className="asset-supplement-grid">
              {field('create-spend', '累计消费', 'totalSpend', '', 'number')}
              {field('create-balance', '卡内余额', 'currentBalance', '', 'number')}
              {field('create-skin', '主要肤况', 'primarySkinConcerns', '多项用顿号分隔')}
              {field('create-projects', '项目需求', 'projectPreferences', '多项用顿号分隔')}
            </div>
          </section>
          <section>
            <h3>3. 服务标准与健康注意</h3>
            <div className="asset-supplement-grid">
              {field('create-preferences', '服务偏好', 'servicePreferences', '温度、力度、房间或沟通偏好')}
              {field('create-risks', '服务雷区', 'serviceRisks', '多项用顿号分隔')}
              {field('create-health-status', '特殊健康状态', 'specialHealthStatus')}
              {field('create-pain', '疼痛耐受度', 'painTolerance')}
              <div className="wide">
                <Label htmlFor="create-health-notes">健康与特殊注意</Label>
                <Textarea id="create-health-notes" value={draft.healthNotes} onChange={(event) => updateField('healthNotes', event.target.value)} />
              </div>
              <div className="wide">
                <Label htmlFor="create-consumption-notes">消费与资产备注</Label>
                <Textarea id="create-consumption-notes" value={draft.consumptionNotes} onChange={(event) => updateField('consumptionNotes', event.target.value)} />
              </div>
              <div className="wide">
                <Label htmlFor="create-communication-notes">沟通备注</Label>
                <Textarea id="create-communication-notes" value={draft.communicationNotes} onChange={(event) => updateField('communicationNotes', event.target.value)} />
              </div>
            </div>
          </section>
        </div>
        {(validationError || error) && (
          <div className="asset-save-error">
            <AlertTriangle /> {validationError || error}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>取消</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <LoaderCircle className="asset-spin" /> : <Save />}
            {saving ? '正在保存' : '保存并进入客户资料库'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
