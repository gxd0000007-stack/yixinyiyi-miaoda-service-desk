# Agent 操作协议

## 目标

把本仓库中的“壹心壹意医疗美容｜客户服务台”安装为一个新的飞书妙搭应用，并在用户明确要求时恢复该门店自己的加密数据备份。

## 不可违反的规则

1. 只创建新应用，不覆盖、删除或重置用户已有妙搭应用。
2. 不修改“壹心壹意医疗美容”品牌、岗位、业务规则或门店配置，除非用户明确提出变更。
3. 不把 `.env`、登录凭证、Cookie、令牌、客户姓名、手机号、余额或交易明细提交到 Git。
4. 原始 `*.store-backup.json` 只能短暂保存在本机受控目录；上传前必须加密。
5. 数据恢复只允许写入全空目标数据库。任意业务表非空时立即停止，不得清空或合并。
6. 登录、验证码、飞书授权、发布确认和备份解密密码由用户本人处理或即时确认。

## 标准安装流程

1. 阅读 `store.manifest.json` 和 `INSTALL.md`。
2. 运行 `npm install`、`npm test -- --runInBand`、`npm run type:check`、`npm run build:prod`。
3. 运行 `npm run release:build && npm run release:verify`。
4. 取得 `release/miaoda-yixinyiyi-v<version>.zip`。
5. 在用户已登录的妙搭中选择“导入新建应用”，上传该 ZIP。
6. 等待应用初始化完成，确认代码同步成功。
7. 不恢复数据时：验证空系统可以打开后交给用户发布。
8. 恢复数据时：下载私有 Release 中的 `*.store-backup.enc`，在本机解密；验证 SHA-256 后，通过老板权限调用恢复接口。
9. 验证客户、预约、卡项、余额、交易、库存、配置及权限页面。
10. 最终返回：妙搭编辑链接、正式运行链接、安装版本、验证结果和未完成项。

## 必须执行的验收

- `npm test -- --runInBand`
- `npm run type:check`
- `npm run build:prod`
- `npm run release:verify`
- 运行态检查首页、员工端、客户资料库、开单结算、卡项、库存和员工权限。
- 有数据恢复时，对比每张表的 `rowCount` 和 SHA-256，任何不一致都视为失败。
