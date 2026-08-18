# 壹心壹意医疗美容｜客户服务台

这是壹心壹意医疗美容自有门店使用的飞书妙搭完整应用仓库，包含前端、服务端、数据库结构、迁移、岗位权限、自动化以及门店完整数据的备份/恢复能力。

本仓库不是通用销售模板。品牌、业务规则和门店配置按当前门店版本保留。

## 给 Codex / WorkBuddy

先阅读 [AGENTS.md](./AGENTS.md)，再根据 [INSTALL.md](./INSTALL.md) 执行。不要覆盖任何已有妙搭应用，也不要把未加密的客户数据提交到 Git。

## 本地验证

```bash
npm install
npm test -- --runInBand
npm run type:check
npm run build:prod
npm run release:build
npm run release:verify
```

生成的妙搭导入包位于 `release/`，不会被提交到 Git 历史。

## 数据备份

- 导出：老板登录后调用 `GET /api/store-backup/export`
- 恢复：仅对空数据库调用 `POST /api/store-backup/restore`
- 恢复请求必须带请求头：`X-Confirm-Empty-Store: RESTORE_EMPTY_STORE`
- 原始备份必须先用 `scripts/encrypt-store-backup.sh` 加密，再上传到私有 GitHub Release。

详细步骤见 [docs/STORE_BACKUP.md](./docs/STORE_BACKUP.md)。
