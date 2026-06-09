# 删除站点公共和可用性监控

## Goal

删除用户可见的外部站点公共/可用性监控功能，避免 Metapi 继续提供内嵌第三方监控页、监控 Cookie 配置和对应代理入口。

当前请求中的“站点公共和可用性监控相关”需要明确边界：仓库里既有独立的“可用性监控”页面，也有核心路由依赖的模型可用性数据与仪表盘里的站点可用性统计。规划阶段先区分可删除功能和应保留功能。

## Confirmed Facts

- 前端存在独立监控页面 `src/web/pages/Monitors.tsx`，内嵌 `check.linux.do` 与 `ldoh.105117.xyz`。
- 侧边栏和路由在 `src/web/App.tsx` 注册 `/monitor`，菜单文案是“可用性监控”。
- 前端 API client 在 `src/web/api.ts` 暴露 `getMonitorConfig`、`updateMonitorConfig`、`initMonitorSession`，对应 `/api/monitor/config` 与 `/api/monitor/session`。
- 后端 `src/server/routes/api/monitor.ts` 注册 `/api/monitor/*` 和 `/monitor-proxy/ldoh/*`，保存 `monitor_ldoh_cookie` 设置，并代理 LDOH 页面。
- 服务入口 `src/server/index.ts` 注册 `monitorRoutes`。
- 文档首页 `docs/index.md` 展示“可用性监控”截图 `docs/screenshots/monitor.png`。
- 桌面导航测试 `src/desktop/navigationGuard.test.ts` 明确允许 `/monitor-proxy/ldoh/`。
- 另有模型可用性相关数据表、服务、设置项和路由生成逻辑：`modelAvailability` / `tokenModelAvailability`、`modelAvailabilityProbeService`、设置页“批量测活”、TokenRoutes 自动路由说明等。这些看起来是代理路由的核心依赖，不等同于外部监控内嵌页。
- 仪表盘还有“站点可用性观测”，从代理请求日志/小时聚合生成站点可用率和平均响应速度，位于 `Dashboard.tsx` 与 stats/dashboard snapshot 服务。

## Requirements

- 删除独立“可用性监控/监控内嵌”用户入口。
- 删除或停用专属于该入口的前后端 API、代理、Cookie 配置和导航允许规则。
- 删除或更新公开文档中展示该监控功能的截图/文案。
- 不破坏模型发现、路由生成、账号/令牌可用模型记录等核心能力，除非用户明确要求进一步移除。
- 不留下死链接、死 API client 方法或孤立测试。
- 已确认本轮只删除独立 `/monitor` 外部监控功能，保留模型可用性、批量测活、自动路由和仪表盘“站点可用性观测”。

## Acceptance Criteria

- [ ] 登录后的桌面/移动导航不再出现“可用性监控”。
- [ ] 访问 `/monitor` 不再渲染 `Monitors` 页面，应按现有 fallback 行为回到首页或不存在该路由。
- [ ] 后端不再注册 `/api/monitor/config`、`/api/monitor/session`、`/monitor-proxy/ldoh/*`。
- [ ] 前端不再引用 `Monitors.tsx` 或 `getMonitorConfig` / `updateMonitorConfig` / `initMonitorSession`。
- [ ] 文档首页不再展示“可用性监控”截图入口。
- [ ] 相关测试更新或删除后，至少通过前端类型检查和相关后端/桌面测试。

## Out Of Scope Unless Confirmed

- 删除 `model_availability` / `token_model_availability` 数据表或模型可用性发现逻辑。
- 删除设置页“批量测活”及后台模型可用性探测。
- 删除 TokenRoutes 中基于模型可用性自动生成路由的行为。
- 删除仪表盘“站点可用性观测”统计模块。

## Open Questions

- None.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
