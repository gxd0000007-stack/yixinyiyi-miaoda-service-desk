# 门店完整数据备份

## 覆盖范围

备份覆盖 14 张表：客户、卡账户、卡权益、卡流水、优惠券、交易、交易明细、库存、库存流水、卡项模板、客户导入审计、服务配置、服务状态和数据库审计。

每个表记录：表名、行数、表数据 SHA-256；整个备份另有总 SHA-256。任何一行被改动，恢复前校验都会失败。

## 导出

老板登录运行态应用后调用：

```text
GET /api/store-backup/export
```

响应是 `yixinyiyi-store-backup` JSON。该文件包含客户隐私和交易信息，必须立即加密：

```bash
./scripts/encrypt-store-backup.sh input.store-backup.json output.store-backup.enc
```

加密文件可以上传至私有 GitHub Release。密码不得写进仓库、Issue、Release 说明或 Agent 指令。

## 恢复保护

- 仅老板角色可调用恢复接口。
- 请求必须明确携带 `X-Confirm-Empty-Store: RESTORE_EMPTY_STORE`。
- 恢复前和事务内都会检查全部目标表为空。
- 任意表非空即拒绝，不执行删除、覆盖或合并。
- 恢复按外键依赖顺序执行，并在一个数据库事务内完成。
