import { useRef, useState } from 'react';
import {
  DatabaseBackup,
  Download,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { exportStoreBackup, restoreStoreBackup } from '@client/src/api';
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
import {
  buildStoreBackupFileName,
  canRestoreStoreBackup,
  parseStoreBackupJson,
  type ParsedStoreBackup,
  type StoreBackup,
} from '@shared/store-backup-file';

function downloadBackup(backup: StoreBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = buildStoreBackupFileName(backup);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function StoreBackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedBackup, setParsedBackup] = useState<ParsedStoreBackup | null>(null);
  const [fileError, setFileError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const resetRestore = () => {
    setSelectedFileName('');
    setParsedBackup(null);
    setFileError('');
    setConfirmation('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const backup = await exportStoreBackup();
      parseStoreBackupJson(JSON.stringify(backup));
      downloadBackup(backup);
      toast.success('门店数据已导出，请立即加密保管');
    } catch {
      toast.error('门店数据导出失败，请确认当前账号是老板');
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file?: File) => {
    resetRestore();
    if (!file) return;
    setSelectedFileName(file.name);
    try {
      const parsed = parseStoreBackupJson(await file.text());
      setParsedBackup(parsed);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : '备份文件无法读取');
    }
  };

  const handleRestore = async () => {
    if (!parsedBackup || !canRestoreStoreBackup(parsedBackup, confirmation, restoring)) {
      return;
    }
    setRestoring(true);
    try {
      const result = await restoreStoreBackup(parsedBackup.backup);
      toast.success(
        `恢复完成：${result.restoredTables} 张数据表，${result.restoredRows} 条记录`,
      );
      setRestoreOpen(false);
      resetRestore();
    } catch {
      toast.error('恢复失败：目标数据库必须完全为空，请勿覆盖现有门店数据');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="store-backup-panel" aria-labelledby="store-backup-title">
      <div className="store-backup-heading">
        <div className="store-backup-title-icon" aria-hidden="true">
          <DatabaseBackup />
        </div>
        <div>
          <span>仅老板可操作 · 门店数据安全</span>
          <h2 id="store-backup-title">备份与恢复</h2>
          <p>导出客户、卡项、交易、库存等14张核心数据表；恢复只允许写入全新的空数据库。</p>
        </div>
        <div className="store-backup-owner-lock">
          <LockKeyhole />
          老板专属
        </div>
      </div>

      <div className="store-backup-actions">
        <article className="store-backup-card store-backup-card-export">
          <div className="store-backup-card-icon"><Download /></div>
          <div>
            <h3>一键导出门店数据</h3>
            <p>生成带校验信息的 JSON 备份文件，下载完成后请立即加密，不要直接通过微信发送。</p>
          </div>
          <Button
            className="store-backup-action-button"
            size="lg"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            <Download />
            {exporting ? '正在整理数据…' : '一键导出'}
          </Button>
        </article>

        <article className="store-backup-card store-backup-card-restore">
          <div className="store-backup-card-icon"><RotateCcw /></div>
          <div>
            <h3>从备份恢复</h3>
            <p>仅用于新建应用。系统会再次校验文件、老板身份和空数据库，已有数据不会被覆盖。</p>
          </div>
          <Button
            className="store-backup-action-button"
            size="lg"
            variant="outline"
            onClick={() => setRestoreOpen(true)}
          >
            <Upload />
            选择备份恢复
          </Button>
        </article>
      </div>

      <div className="store-backup-security-note">
        <TriangleAlert />
        <span>备份包含客户手机号、余额和交易记录。明文文件只用于加密与恢复，处理后请安全删除。</span>
      </div>

      <Dialog
        open={restoreOpen}
        onOpenChange={(open) => {
          setRestoreOpen(open);
          if (!open && !restoring) resetRestore();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>从门店备份恢复</DialogTitle>
            <DialogDescription>
              此操作只允许用于新建且业务表完全为空的应用，不会合并或覆盖已有数据。
            </DialogDescription>
          </DialogHeader>

          <div className="store-backup-restore-form">
            <label className="store-backup-file-picker">
              <span>第一步：选择已解密的 JSON 备份</span>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                disabled={restoring}
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>

            {selectedFileName && (
              <div className={fileError ? 'store-backup-file-status is-error' : 'store-backup-file-status'}>
                {fileError ? <TriangleAlert /> : <FileCheck2 />}
                <div>
                  <strong>{selectedFileName}</strong>
                  <span>
                    {fileError ||
                      `文件结构有效 · 14张数据表 · ${parsedBackup?.totalRows ?? 0}条记录`}
                  </span>
                </div>
              </div>
            )}

            <label className="store-backup-confirm-field">
              <span>第二步：输入“确认恢复门店数据”</span>
              <Input
                value={confirmation}
                disabled={!parsedBackup || restoring}
                placeholder="确认恢复门店数据"
                autoComplete="off"
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={restoring}
              onClick={() => setRestoreOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!canRestoreStoreBackup(parsedBackup, confirmation, restoring)}
              onClick={() => void handleRestore()}
            >
              <RotateCcw />
              {restoring ? '正在恢复…' : '确认恢复到空数据库'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
