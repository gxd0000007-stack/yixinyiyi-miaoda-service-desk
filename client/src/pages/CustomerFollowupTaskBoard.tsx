import { useEffect, useMemo, useState, type ChangeEvent, type FC } from 'react';
import type {
  CustomerFollowupEvidence,
  CustomerFollowupTask,
} from '@shared/api.interface';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  RefreshCcw,
  Upload,
} from 'lucide-react';

import {
  completeCustomerFollowupTask,
  getCustomerFollowupTasks,
} from '../api';
import { uploadFile } from '../components/business-ui/api/files/service';
import CustomerMembershipBadge from '../components/CustomerMembershipBadge';
import { Button } from '../components/ui/button';
import { Image } from '../components/ui/image';
import { Input } from '../components/ui/input';

interface CustomerFollowupTaskBoardProps {
  mode: 'store' | 'employee';
  staffName?: string;
  canComplete?: boolean;
}

function normalizedName(value?: string): string {
  return value?.replace(/\s+/gu, '').toLocaleLowerCase() || '';
}

const CustomerFollowupTaskBoard: FC<CustomerFollowupTaskBoardProps> = ({
  mode,
  staffName,
  canComplete = false,
}) => {
  const [tasks, setTasks] = useState<CustomerFollowupTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [uploadingTaskId, setUploadingTaskId] = useState<string>('');
  const [savingTaskId, setSavingTaskId] = useState<string>('');
  const [draftEvidence, setDraftEvidence] = useState<
    Record<string, CustomerFollowupEvidence[]>
  >({});
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let active: boolean = true;
    async function load(): Promise<void> {
      setLoading(true);
      setError('');
      try {
        const response = await getCustomerFollowupTasks();
        if (active) setTasks(response.items);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : '回访任务加载失败',
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const visibleTasks: CustomerFollowupTask[] = useMemo(() => {
    if (mode === 'store') return tasks;
    const target: string = normalizedName(staffName);
    return tasks.filter(
      (task: CustomerFollowupTask) =>
        normalizedName(task.assignedStaff) === target,
    );
  }, [mode, staffName, tasks]);

  const pendingCount: number = visibleTasks.filter(
    (task: CustomerFollowupTask) => task.status === 'pending',
  ).length;

  const uploadEvidence = async (
    task: CustomerFollowupTask,
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const files: File[] = Array.from(event.target.files || []).slice(0, 6);
    event.target.value = '';
    if (files.length === 0) return;
    setUploadingTaskId(task.id);
    setError('');
    try {
      const uploaded: CustomerFollowupEvidence[] = [];
      for (const file of files) {
        const result = await uploadFile(file);
        uploaded.push({
          ...result,
          name: file.name,
          uploadedAt: new Date().toISOString(),
        });
      }
      setDraftEvidence((current: Record<string, CustomerFollowupEvidence[]>) => ({
        ...current,
        [task.id]: [...(current[task.id] || []), ...uploaded].slice(0, 6),
      }));
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : '回访图片上传失败',
      );
    } finally {
      setUploadingTaskId('');
    }
  };

  const completeTask = async (task: CustomerFollowupTask): Promise<void> => {
    const evidence: CustomerFollowupEvidence[] = draftEvidence[task.id] || [];
    if (evidence.length === 0) {
      setError('请先上传回访图片作为完成凭证');
      return;
    }
    setSavingTaskId(task.id);
    setError('');
    try {
      const response = await completeCustomerFollowupTask({
        taskId: task.id,
        evidence,
      });
      setTasks((current: CustomerFollowupTask[]) =>
        current.map((item: CustomerFollowupTask) =>
          item.id === task.id ? response.task : item,
        ),
      );
      setDraftEvidence((current: Record<string, CustomerFollowupEvidence[]>) => ({
        ...current,
        [task.id]: [],
      }));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : '回访任务完成失败',
      );
    } finally {
      setSavingTaskId('');
    }
  };

  return (
    <section className={`followup-task-board ${mode}`}>
      <header>
        <div>
          <span className="eyebrow">
            {mode === 'store'
              ? '全店回访邀约 · 执行总览'
              : '我的回访邀约 · 上次服务员工负责'}
          </span>
          <h2>今日应回访客户</h2>
          <p>
            共 {visibleTasks.length} 位，待执行 {pendingCount} 位。完成前必须上传回访图片凭证。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReloadKey((value: number) => value + 1)}
        >
          <RefreshCcw /> 刷新
        </Button>
      </header>

      {loading && (
        <div className="followup-task-state"><LoaderCircle /> 正在加载回访任务</div>
      )}
      {error && <div className="followup-task-error">{error}</div>}
      {!loading && visibleTasks.length === 0 && (
        <div className="followup-task-state"><CheckCircle2 /> 今日没有待回访客户</div>
      )}

      <div className="followup-task-list" data-ai-section-type="card-list">
        {visibleTasks.map((task: CustomerFollowupTask) => {
          const evidence: CustomerFollowupEvidence[] =
            task.status === 'completed'
              ? task.evidence
              : draftEvidence[task.id] || [];
          const isAssigned: boolean = mode === 'store' ||
            normalizedName(task.assignedStaff) === normalizedName(staffName);
          return (
            <article key={task.id} className={task.status}>
              <div className="followup-task-main">
                <div className="followup-task-title">
                  <span>{task.stage}</span>
                  <div>
                    <div className="customer-name-membership-row">
                      <h3>{task.customerName}</h3>
                      <CustomerMembershipBadge memberLevel={task.memberLevel} compact />
                    </div>
                    <p>{task.customerMobile || '手机号待补充'}</p>
                  </div>
                  <i>{task.status === 'completed' ? '已完成' : '待回访'}</i>
                </div>
                <div className="followup-task-meta">
                  <span>上次服务：{task.lastVisitDate} · {task.lastProject}</span>
                  <strong>负责员工：{task.assignedStaff}</strong>
                </div>
                <div className="followup-task-script">
                  <ClipboardCheck />
                  <p>{task.content}</p>
                </div>
              </div>

              <div className="followup-task-proof">
                <div className="followup-proof-heading">
                  <span><Camera /> 回访图片凭证</span>
                  <small>{evidence.length}/6 张</small>
                </div>
                <div className="followup-proof-images">
                  {evidence.map((item: CustomerFollowupEvidence) => (
                    <Image
                      key={item.id}
                      src={item.url}
                      alt={`${task.customerName}回访凭证`}
                      width={72}
                      height={72}
                    />
                  ))}
                </div>
                {task.status === 'completed' ? (
                  <div className="followup-completed-note">
                    <CheckCircle2 />
                    {task.completedBy} 已于 {task.completedAt?.slice(0, 16).replace('T', ' ')} 完成
                  </div>
                ) : canComplete && isAssigned ? (
                  <div className="followup-proof-actions">
                    <label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingTaskId === task.id}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          void uploadEvidence(task, event)
                        }
                      />
                      <span>
                        {uploadingTaskId === task.id
                          ? <LoaderCircle />
                          : <Upload />}
                        {uploadingTaskId === task.id ? '上传中' : '上传回访图片'}
                      </span>
                    </label>
                    <Button
                      disabled={savingTaskId === task.id || evidence.length === 0}
                      onClick={() => void completeTask(task)}
                    >
                      {savingTaskId === task.id ? <LoaderCircle /> : <CheckCircle2 />}
                      执行完成
                    </Button>
                  </div>
                ) : (
                  <div className="followup-readonly-note">
                    由上次服务员工 {task.assignedStaff} 上传凭证并完成
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default CustomerFollowupTaskBoard;
