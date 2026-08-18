'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, type TableProps } from '@lark-apaas/client-toolkit/antd-table';
import {
  ArrowLeft,
  Building,
  Globe,
  MoreHorizontal,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  ChatSimpleDTO,
  DepartmentDTO,
  ForceRoleDTO,
  MemberMutationData,
  UserSimpleDTO,
} from '@shared/api.interface';
import {
  FRONT_DESK_ROLE,
  LEGACY_PUBLIC_OWNER_ROLE,
  NURSE_ROLE,
  SKIN_MANAGER_ROLE,
  STORE_OWNER_ROLE,
} from '@shared/role.constants';
import {
  addRoleMembers,
  clearRoleMembers,
  createRole,
  deleteRole,
  getCurrentServiceRole,
  getRoles,
  updateRole,
} from '@client/src/api';
import { ChatSelect, type Chat } from '@client/src/components/business-ui/chat-select';
import { ChatSelectTag } from '@client/src/components/business-ui/chat-select/chat-select-tag';
import {
  DepartmentSelect,
  type DepartmentValue,
} from '@client/src/components/business-ui/department-select';
import { DepartmentSelectTag } from '@client/src/components/business-ui/department-select/department-select-tag';
import { ItemPill } from '@client/src/components/business-ui/entity-combobox/item-pill';
import { UserSelect, type User } from '@client/src/components/business-ui/user-select';
import { UserSelectTag } from '@client/src/components/business-ui/user-select/user-select-tag';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@client/src/components/ui/hover-card';
import { Input } from '@client/src/components/ui/input';
import { Switch } from '@client/src/components/ui/switch';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@client/src/components/ui/tooltip';
import { StoreBackupPanel } from './StoreBackupPanel';

import './role-management.css';

const STANDARD_ROLE_IDS = new Set([
  STORE_OWNER_ROLE,
  FRONT_DESK_ROLE,
  SKIN_MANAGER_ROLE,
  NURSE_ROLE,
]);
const FRONT_DESK_ROLE_IDS = new Set([
  FRONT_DESK_ROLE,
  SKIN_MANAGER_ROLE,
  NURSE_ROLE,
]);

const BrandCircleIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
    {children}
  </span>
);

const SPECIAL_MEMBER_ICONS = {
  allEmployees: (
    <BrandCircleIcon>
      <Building className="h-3 w-3 text-primary-foreground" />
    </BrandCircleIcon>
  ),
  public: (
    <BrandCircleIcon>
      <Globe className="h-3 w-3 text-primary-foreground" />
    </BrandCircleIcon>
  ),
  appDeveloper: (
    <BrandCircleIcon>
      <Users className="h-3 w-3 text-primary-foreground" />
    </BrandCircleIcon>
  ),
};

function i18nName(value?: Record<string, string>): string {
  return value?.zh_cn || value?.en_us || Object.values(value || {})[0] || '未命名';
}

function toUserValue(user: UserSimpleDTO): User {
  const name = i18nName(user.name);
  return {
    user_id: user.userID || '',
    name,
    avatar: user.avatar,
    email: user.email,
  };
}

function toUserTagValue(user: UserSimpleDTO) {
  const value = toUserValue(user);
  return {
    id: user.userID || '',
    name: typeof value.name === 'string' ? value.name : i18nName(value.name),
    avatar: user.avatar,
    raw: value,
  };
}

function toDepartmentValue(department: DepartmentDTO): DepartmentValue {
  const name = i18nName(department.name);
  return {
    id: department.id || '',
    name,
    raw: {
      departmentID: department.id || '',
      larkDepartmentID: department.id || '',
      name: { zh_cn: name, en_us: department.name?.en_us },
    },
  };
}

function toChatValue(chat: ChatSimpleDTO): Chat {
  const name = i18nName(chat.name);
  return {
    id: chat.chatID || '',
    name,
    avatar: chat.avatar || '#1456F0',
    raw: {
      chatID: chat.chatID || '',
      name: { zh_cn: name, en_us: chat.name?.en_us },
      avatar: chat.avatar || '#1456F0',
      isExternal: chat.isExternal,
    },
  };
}

type MemberItem =
  | { key: string; type: 'user'; data: UserSimpleDTO }
  | { key: string; type: 'department'; data: DepartmentDTO }
  | { key: string; type: 'chat'; data: ChatSimpleDTO };

function MemberTag({ item }: { item: MemberItem }) {
  if (item.type === 'user') {
    return (
      <UserSelectTag
        userValue={toUserTagValue(item.data)}
        onClose={() => undefined}
        disabled
        className="!cursor-default !opacity-100"
      />
    );
  }
  if (item.type === 'department') {
    return (
      <DepartmentSelectTag
        departmentValue={toDepartmentValue(item.data)}
        onClose={() => undefined}
        disabled
        className="!cursor-default !opacity-100"
      />
    );
  }
  return (
    <ChatSelectTag
      chatValue={toChatValue(item.data)}
      onClose={() => undefined}
      disabled
      className="!cursor-default !opacity-100"
    />
  );
}

function MemberSummary({ role }: { role: ForceRoleDTO }) {
  const members = role.roleMembers;
  if (!members) return <>--</>;
  const items: MemberItem[] = [
    ...(members.userList || []).map((user, index) => ({
      key: `user-${user.userID || index}`,
      type: 'user' as const,
      data: user,
    })),
    ...(members.departmentList || []).map((department, index) => ({
      key: `department-${department.id || index}`,
      type: 'department' as const,
      data: department,
    })),
    ...(members.groupChatList || []).map((chat, index) => ({
      key: `chat-${chat.chatID || index}`,
      type: 'chat' as const,
      data: chat,
    })),
  ];
  const visible = items.slice(0, 3);
  const overflow = items.slice(3);
  const empty =
    !members.allEmployees &&
    !members.public &&
    !members.presetGroup?.isContainsAdmin &&
    items.length === 0;
  if (empty) return <>--</>;

  return (
    <div className="flex flex-wrap gap-1">
      {members.allEmployees && (
        <ItemPill
          label="企业全员"
          avatar={SPECIAL_MEMBER_ICONS.allEmployees}
          avatarFallback={false}
          size="small"
          className="!cursor-default !opacity-100"
        />
      )}
      {members.public && (
        <ItemPill
          label="互联网公开"
          avatar={SPECIAL_MEMBER_ICONS.public}
          avatarFallback={false}
          size="small"
          className="!cursor-default !opacity-100"
        />
      )}
      {members.presetGroup?.isContainsAdmin && (
        <ItemPill
          label="应用开发者"
          avatar={SPECIAL_MEMBER_ICONS.appDeveloper}
          avatarFallback={false}
          size="small"
          className="!cursor-default !opacity-100"
        />
      )}
      {visible.map((item) => (
        <MemberTag key={item.key} item={item} />
      ))}
      {overflow.length > 0 && (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Badge variant="outline" className="cursor-pointer">
              +{overflow.length}
            </Badge>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto max-w-[360px] p-2">
            <div className="flex flex-wrap gap-1">
              {overflow.map((item) => (
                <MemberTag key={item.key} item={item} />
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
      )}
    </div>
  );
}

type RoleForm = { name: string; bizID: string; description: string };

export default function RoleManagementPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<ForceRoleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [actorName, setActorName] = useState('');
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<ForceRoleDTO | null>(null);
  const [memberRole, setMemberRole] = useState<ForceRoleDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ForceRoleDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm>({
    name: '',
    bizID: '',
    description: '',
  });
  const [memberUsers, setMemberUsers] = useState<User[]>([]);
  const [memberDepartments, setMemberDepartments] = useState<DepartmentValue[]>([]);
  const [memberChats, setMemberChats] = useState<Chat[]>([]);
  const [includeAdmin, setIncludeAdmin] = useState(false);

  const loadRoles = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const data = await getRoles();
      const order = [
        STORE_OWNER_ROLE,
        FRONT_DESK_ROLE,
        SKIN_MANAGER_ROLE,
        NURSE_ROLE,
      ];
      setRoles(
        data
          .filter((role) => role.bizID !== LEGACY_PUBLIC_OWNER_ROLE)
          .sort((a, b) => {
          const aIndex = order.indexOf(a.bizID || '');
          const bIndex = order.indexOf(b.bizID || '');
          return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
          }),
      );
    } catch {
      toast.error('加载员工角色失败');
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentServiceRole()
      .then((identity) => {
        if (!active) return;
        const owner =
          identity.jobRole === 'owner' &&
          identity.permissions.viewOwnerPortal;
        const canManage = identity.permissions.manageStaffRoles;
        setIsOwner(owner);
        setActorName(identity.actor.displayName);
        setAuthorized(canManage);
        if (canManage) void loadRoles(true);
        else setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAuthorized(false);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadRoles]);

  const openCreate = () => {
    setRoleForm({ name: '', bizID: '', description: '' });
    setCreateOpen(true);
  };

  const openEdit = (role: ForceRoleDTO) => {
    setRoleForm({
      name: role.name || '',
      bizID: role.bizID || '',
      description: role.description || '',
    });
    setEditRole(role);
  };

  const openMembers = (role: ForceRoleDTO) => {
    if (!isOwner && !FRONT_DESK_ROLE_IDS.has(role.bizID || '')) {
      toast.error('前台不能修改老板或系统管理角色');
      return;
    }
    const members = role.roleMembers;
    setMemberUsers((members?.userList || []).map(toUserValue));
    setMemberDepartments((members?.departmentList || []).map(toDepartmentValue));
    setMemberChats((members?.groupChatList || []).map(toChatValue));
    setIncludeAdmin(Boolean(members?.presetGroup?.isContainsAdmin));
    setMemberRole(role);
  };

  const saveCreate = async () => {
    const bizID = roleForm.bizID.trim();
    const name = roleForm.name.trim();
    if (!name || !/^[A-Za-z0-9_-]+$/u.test(bizID)) {
      toast.error('请填写角色名称，并使用英文、数字或下划线作为角色标识');
      return;
    }
    setSaving(true);
    try {
      await createRole({
        role: { name, bizID, description: roleForm.description.trim() },
      });
      setCreateOpen(false);
      await loadRoles();
      toast.success('角色已创建');
    } catch {
      toast.error('角色创建失败');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editRole?.bizID || !roleForm.name.trim()) return;
    setSaving(true);
    try {
      await updateRole(editRole.bizID, {
        role: {
          name: roleForm.name.trim(),
          description: roleForm.description.trim(),
        },
      });
      setEditRole(null);
      await loadRoles();
      toast.success('角色信息已更新');
    } catch {
      toast.error('角色信息更新失败');
    } finally {
      setSaving(false);
    }
  };

  const saveMembers = async () => {
    if (!memberRole?.bizID) return;
    setSaving(true);
    try {
      await clearRoleMembers(memberRole.bizID);
      const members: MemberMutationData = {
        userList: memberUsers
          .filter((user) => user.user_id)
          .map((user) => ({ userID: user.user_id })),
        departmentList: memberDepartments.map((department) => ({
          id: department.id,
        })),
        groupChatList: memberChats.map((chat) => ({ chatID: chat.id })),
        isContainsAdmin: isOwner && includeAdmin,
      };
      await addRoleMembers(memberRole.bizID, { members });
      setMemberRole(null);
      await loadRoles();
      toast.success('员工与岗位权限已同步');
    } catch {
      toast.error('员工权限保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.bizID) return;
    setSaving(true);
    try {
      await deleteRole(deleteTarget.bizID);
      setDeleteTarget(null);
      await loadRoles();
      toast.success('角色已删除');
    } catch {
      toast.error('角色删除失败');
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<TableProps<ForceRoleDTO>['columns']>(() => [
    {
      title: '角色名称',
      dataIndex: 'name',
      width: 180,
      render: (value: string, role: ForceRoleDTO) => (
        <div className="role-name-cell">
          <strong>{value || '--'}</strong>
          {STANDARD_ROLE_IDS.has(role.bizID || '') && <Badge>门店岗位</Badge>}
        </div>
      ),
    },
    {
      title: '角色描述',
      dataIndex: 'description',
      width: 300,
      render: (value: string) => value || '--',
    },
    { title: '角色标识', dataIndex: 'bizID', width: 200 },
    {
      title: '角色成员',
      key: 'members',
      width: 250,
      render: (_value: unknown, role: ForceRoleDTO) => <MemberSummary role={role} />,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_value: unknown, role: ForceRoleDTO) => {
        const editableByFrontDesk = FRONT_DESK_ROLE_IDS.has(role.bizID || '');
        const canEditMembers = isOwner || editableByFrontDesk;
        const protectedRole =
          role.roleMembers?.allEmployees || role.roleMembers?.public;
        return (
          <div className="role-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canEditMembers}
              onClick={() => openMembers(role)}
            >
              编辑成员
            </Button>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="更多操作">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(role)}>
                    编辑角色信息
                  </DropdownMenuItem>
                  {protectedRole ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <DropdownMenuItem disabled>删除角色</DropdownMenuItem>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        包含企业全员/互联网公开的角色不支持删除
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteTarget(role)}
                    >
                      删除角色
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      },
    },
  ], [isOwner]);

  if (authorized === null || loading) {
    return <div className="role-page-loading">正在识别员工管理权限…</div>;
  }

  if (!authorized) {
    return (
      <main className="role-management-page role-access-denied">
        <ShieldCheck />
        <h1>此页面仅老板和前台可进入</h1>
        <p>皮肤管理师和护士可以查看预约并执行自己的任务，但不能修改员工权限。</p>
        <Button onClick={() => navigate('/')}>返回工作台</Button>
      </main>
    );
  }

  return (
    <main className="role-management-page">
      <header className="role-page-header">
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" /> 返回工作台
        </Button>
        <div className="role-page-heading">
          <span>老板与前台 · 员工组织管理</span>
          <h1>员工与权限</h1>
          <p>从飞书通讯录选择员工，分配岗位后立即决定他能看到什么、能执行什么。</p>
        </div>
        <div className="role-current-user">
          <UserRoundCog />
          <div>
            <span>当前操作人</span>
            <strong>{actorName} · {isOwner ? '老板' : '前台'}</strong>
          </div>
        </div>
      </header>

      <section className="role-safety-strip">
        <div><strong>老板</strong><span>完整管理与最高权限</span></div>
        <div><strong>前台</strong><span>新增员工与分配非老板岗位</span></div>
        <div><strong>管理师 / 护士</strong><span>查看全店预约，只执行本人任务</span></div>
      </section>

      <section className="role-table-panel">
        <div className="role-table-header">
          <div>
            <h2>门店员工岗位</h2>
            <p>点击“编辑成员”，即可新增员工、调岗或移出岗位。</p>
          </div>
          {isOwner && <Button onClick={openCreate}>＋ 添加自定义角色</Button>}
        </div>
        <Table<ForceRoleDTO>
          columns={columns}
          dataSource={roles}
          rowKey={(role) => role.bizID || String(role.id)}
          pagination={false}
          scroll={{ x: 1080 }}
        />
      </section>

      {isOwner && <StoreBackupPanel />}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加角色</DialogTitle></DialogHeader>
          <RoleFields value={roleForm} onChange={setRoleForm} showBizID />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button disabled={saving} onClick={() => void saveCreate()}>保存角色</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editRole)} onOpenChange={(open) => !open && setEditRole(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑角色信息</DialogTitle></DialogHeader>
          <RoleFields value={roleForm} onChange={setRoleForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRole(null)}>取消</Button>
            <Button disabled={saving} onClick={() => void saveEdit()}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(memberRole)} onOpenChange={(open) => !open && setMemberRole(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑成员 · {memberRole?.name}</DialogTitle>
          </DialogHeader>
          <section className="role-member-section">
            <h3>特殊成员范围</h3>
            <div className="flex flex-wrap gap-3">
              <div className="role-special-member">
                <span>{SPECIAL_MEMBER_ICONS.appDeveloper}应用开发者</span>
                <Switch
                  checked={includeAdmin}
                  disabled={!isOwner}
                  onCheckedChange={setIncludeAdmin}
                />
              </div>
              {memberRole?.roleMembers?.allEmployees && (
                <div className="role-special-member">
                  <span>{SPECIAL_MEMBER_ICONS.allEmployees}企业全员</span>
                  <Switch checked disabled />
                </div>
              )}
              {memberRole?.roleMembers?.public && (
                <div className="role-special-member">
                  <span>{SPECIAL_MEMBER_ICONS.public}互联网公开</span>
                  <Switch checked disabled />
                </div>
              )}
            </div>
          </section>
          <section className="role-member-section">
            <h3>指定成员</h3>
            <div className="role-select-block">
              <label>用户</label>
              <UserSelect
                multiple
                valueType="object"
                value={memberUsers}
                onChange={setMemberUsers}
              />
            </div>
            <div className="role-select-block">
              <label>部门</label>
              <DepartmentSelect
                multiple
                value={memberDepartments}
                onChange={(value) => setMemberDepartments(Array.isArray(value) ? value : [])}
              />
            </div>
            <div className="role-select-block">
              <label>群组</label>
              <ChatSelect
                multiple
                valueType="object"
                value={memberChats}
                onChange={setMemberChats}
              />
            </div>
          </section>
          {!isOwner && (
            <p className="role-frontdesk-note">前台可安排日常岗位，但不能新增、撤销或修改老板权限。</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberRole(null)}>取消</Button>
            <Button disabled={saving} onClick={() => void saveMembers()}>
              保存员工与岗位
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>确认删除角色</DialogTitle></DialogHeader>
          <p>将删除“{deleteTarget?.name}”角色。员工不会从飞书通讯录删除，但会失去该岗位权限。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" disabled={saving} onClick={() => void confirmDelete()}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function RoleFields({
  value,
  onChange,
  showBizID = false,
}: {
  value: RoleForm;
  onChange: (value: RoleForm) => void;
  showBizID?: boolean;
}) {
  return (
    <div className="role-fields">
      <label>
        <span>角色名称 *</span>
        <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} />
      </label>
      {showBizID && (
        <label>
          <span>角色标识 *</span>
          <Input
            placeholder="例如 service_consultant"
            value={value.bizID}
            onChange={(event) => onChange({ ...value, bizID: event.target.value })}
          />
        </label>
      )}
      <label>
        <span>角色描述</span>
        <Textarea
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </label>
    </div>
  );
}
