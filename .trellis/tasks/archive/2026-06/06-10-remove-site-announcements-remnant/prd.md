# 移除站点公告残留

## Goal

处理用户在新 Docker 镜像 `ghcr.io/2263075977/metapi:latest` 中发现的残留入口：左侧菜单仍显示「站点公告」，而上一轮「可用性监控」已经删除。

用户已确认本次不是只隐藏侧边栏入口，而是彻底删除「站点公告」整条功能链。

## Confirmed Facts

- 上一轮已归档任务 `06-10-remove-site-public-availability-monitoring` 的范围是删除独立 `/monitor` 外部监控页面、`/api/monitor/*`、`/monitor-proxy/ldoh/*` 与相关文档截图。
- 上一轮任务明确保留模型可用性、批量测活、自动路由和仪表盘站点可用性观测；未提到「站点公告」。
- 「站点公告」当前仍在 `src/web/App.tsx` 左侧菜单和 `/site-announcements` 路由中注册。
- 前端还有 `src/web/pages/SiteAnnouncements.tsx`、`src/web/pages/helpers/siteAnnouncementPresentation.tsx`、`src/web/api.ts` 的 `/api/site-announcements*` client 方法、通知跳转 helper、日志筛选标签和测试。
- 后端仍注册 `siteAnnouncementsRoutes`，并启动 `startSiteAnnouncementPolling` / `stopSiteAnnouncementPolling`。
- 后端还有 `site_announcements` 数据表、schema contract/bootstrap SQL、备份/恢复、数据库迁移导出、平台公告抓取适配和相关测试。
- 文档仍说明「站点公告」能力：`docs/upstream-integration.md` 与 `docs/configuration.md`。
- 这不是单纯菜单残留；如果目标是彻底删除，需要跨前端、后端、数据库 schema/contract、备份迁移、文档和测试处理。
- `schema:contract` 会用当前已生成 contract 作为 previous contract，`schemaArtifactGenerator` 会拒绝 removed table / removed column / removed index 等非追加式 diff；删除 `site_announcements` 需要明确迁移和生成策略。

## Requirements

- 登录后的左侧菜单不应继续暴露用户不想保留的「站点公告」入口。
- 删除或停用前端页面/路由/API client、后端路由/轮询/服务、平台公告抓取、数据库表引用、备份迁移引用、通知跳转、文档和相关测试。
- 不破坏与公告无关的通知中心、程序日志、站点管理、账号/模型发现、可用性探测和仪表盘观测。
- 避免留下死路由、死 API、死测试或文档误导。
- 保留通用 `events` / 通知中心能力；停止生成新的 `site_notice` 事件。
- 已批准迁移删除既有 `site_announcements` 表，以完成 schema 层彻底删除。
- 不主动清理通用 `events` 表中的历史 `site_notice` 日志。

## Acceptance Criteria

- [x] 产品范围已确认：彻底删除站点公告功能链。
- [x] `/site-announcements` 页面、侧边栏入口、懒加载页面引用和相关前端页面测试被移除。
- [x] `/api/site-announcements*` 路由不再注册，公告手动同步和后台轮询不再可用。
- [x] 平台适配器不再声明或实现公告抓取能力。
- [x] 新代码不再从 `schema.siteAnnouncements` 读写，不再生成新的 `site_notice` 事件或 `site_announcement` 跳转。
- [x] 备份/恢复、跨库迁移和 schema 产物按最终数据库策略同步更新。
- [x] 搜索确认用户可见「站点公告」静态文案和无效链接不再残留；历史用户数据里的旧标题不计为静态代码残留。
- [x] 相关前后端测试、类型检查和 schema/contract 检查按实际改动范围通过。

## Likely Out Of Scope

- 删除通用通知中心。
- 删除所有历史 `site_notice` 程序日志。
- 删除模型可用性、批量测活、自动路由和仪表盘站点可用性观测。
- 删除站点管理、账号管理、模型发现、余额/签到、API token、路由和代理功能。

## Open Questions

- None.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
