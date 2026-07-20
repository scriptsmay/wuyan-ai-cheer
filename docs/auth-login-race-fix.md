# 登录链路简化与匿名数据隔离

> 创建：2026-07-21  
> 状态：已实现  
> 关联决策：`knowledge-personal/projects/wuyan-cloudbase-project/decisions/adr-004-simplify-auth-and-repair-checkin-history.md`

## 问题

原登录流程在用户名密码登录前后调用 `/api/auth/transfer/start` 和 `/api/auth/transfer/complete`，试图把匿名 UID 的数据自动合并到正式 UID。匿名 session 的本地状态和服务端 introspection 结论不一致时，登录会被 `409 TRANSFER_NOT_ANONYMOUS` 阻断。

迁移还让身份语义变得模糊：用户无法判断登录是在切换账号，还是把当前匿名身份升级为正式账号。正式 UID 缺少 `checkin_users` 聚合时，首次打卡还会从 `1/1` 开始。

## 最终设计

- 登录只执行 `clearSession()` 和 `auth.signInWithPassword()`。
- 匿名 UID 与正式 UID 的数据彼此独立，不自动迁移。
- 登录成功后，页面使用正式 session 重新请求个人业务数据。
- 退出登录后，需要业务 API 时创建新的匿名 session。
- 前端不再调用 `/api/auth/*`，也不保留迁移票据、迁移状态或迁移类型。
- `checkins` 是事实源；`checkin_users` 缺失时由后端从当前 UID 的历史打卡重建。

## 登录流程

```text
clearSession()
  -> auth.signInWithPassword({ username, password })
  -> auth state change
  -> 使用正式 access token 重新请求个人业务 API
```

匿名打卡不会因登录而删除，也不会进入正式账号。账号由管理员创建，不提供自助注册。

## 验证

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- 匿名使用、正式登录、退出和重新登录的浏览器回归
