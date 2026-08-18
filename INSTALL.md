# 安装与恢复

## 一、只安装门店系统

1. 从仓库最新 Release 下载 `miaoda-yixinyiyi-v*.zip`。
2. 登录飞书妙搭。
3. 选择“导入新建应用”，上传 ZIP。
4. 等待代码、依赖和数据库迁移初始化完成。
5. 在预览中检查页面和老板身份。
6. 确认无误后发布，并把正式运行链接交给门店员工。

## 二、恢复本门店历史数据

1. 确认目标是新建应用，所有业务表为空。
2. 从私有 Release 下载加密备份 `*.store-backup.enc`。
3. 运行：

   ```bash
   ./scripts/decrypt-store-backup.sh backup.store-backup.enc backup.store-backup.dec.json
   ```

4. 用户本人输入解密密码。
5. 使用老板账号向新应用的 `/api/store-backup/restore` 发起 POST，请求体为解密后的 JSON，并带：

   ```text
   X-Confirm-Empty-Store: RESTORE_EMPTY_STORE
   ```

6. 恢复成功后立即安全删除本机明文备份。
7. 按 `docs/RESTORE_CHECKLIST.md` 验收。

## 三、客户最终怎么使用

GitHub 和妙搭编辑器只给老板/实施人员。员工只使用发布后的 `feishuapp.com` 运行链接。
