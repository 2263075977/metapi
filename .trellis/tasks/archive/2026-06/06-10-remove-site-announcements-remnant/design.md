# 移除站点公告残留 - Technical Design

## Scope Decision

用户已确认彻底删除「站点公告」功能链，而不是只隐藏菜单入口。

本任务不拆 parent / child：虽然横跨前端、后端、数据库和文档，但这些改动服务于同一个可验证终态。如果拆成独立子任务，中间态会产生死 API、死路由或 schema 不一致风险。

## Architecture And Boundaries

### Frontend

- `src/web/App.tsx` 移除 `SiteAnnouncements` lazy import、侧边栏菜单项和 `/site-announcements` route。
- 删除 `src/web/pages/SiteAnnouncements.tsx`、`src/web/pages/siteAnnouncements.test.tsx`、`src/web/pages/helpers/siteAnnouncementPresentation.tsx` 及其测试。
- `src/web/api.ts` 移除 `/api/site-announcements*` client methods。
- `src/web/pages/helpers/navigationFocus.ts` 不再把 `site_notice` 或 `site_announcement` 跳到 `/site-announcements`；历史事件统一留在 `/events`。
- `NotificationPanel` 和 `ProgramLogs` 移除 `site_notice` 的专用筛选和中文静态标签，避免继续暴露「站点公告」产品入口。

### Backend

- `src/server/index.ts` 移除 `siteAnnouncementsRoutes` 注册以及 `startSiteAnnouncementPolling` / `stopSiteAnnouncementPolling` 生命周期调用。
- 删除 `src/server/routes/api/siteAnnouncements.ts` 及测试。
- 删除 `src/server/services/siteAnnouncementService.ts`、`src/server/services/siteAnnouncementPollingService.ts` 及测试。
- 平台适配层移除 `SiteAnnouncement` 类型、`PlatformAdapter.getSiteAnnouncements` contract、`BasePlatformAdapter` 默认实现，以及 `newApi` / `doneHub` / `sub2api` 等公告抓取 override 和测试。
- 保留通用 `eventsRoutes`、`notifyService`、`backgroundTaskService` 等与公告无关的能力。

### Database, Backup, And Migration

目标终态是 active code 不再引用 `schema.siteAnnouncements`。

已批准破坏性迁移：

- 从 `src/server/db/schema.ts` 移除 `siteAnnouncements` table。
- 从 `src/server/db/index.ts` 的 numeric-id table set 移除 `site_announcements`。
- 增加 SQLite migration / Drizzle meta snapshot，让新迁移历史最终不包含 active `site_announcements` 表。
- 更新 `src/server/db/generated/schemaContract.json`、MySQL/Postgres bootstrap/upgrade artifacts。
- 删除 `src/server/db/siteAnnouncementsSchema.test.ts`，或替换为确保 active schema 不再包含该表的回归测试。

备份和跨库迁移需要与最终策略一致：

- 新备份不再导出 `siteAnnouncements`。
- 新恢复/跨库迁移不再写入 `site_announcements`。
- 对旧备份中的 `accounts.siteAnnouncements` 采取忽略兼容，避免旧备份恢复失败。

### Compatibility

- `/site-announcements` 前端路由删除后，旧书签可落入现有 app fallback / 404 行为，不新增替代页面。
- `/api/site-announcements*` 不再注册；调用者收到 Fastify 默认 404。
- 历史 `events` 行可以继续通过通用程序日志存在，但不再有专用 `site_notice` 筛选、标签或跳转。
- 不删除模型可用性、批量测活、自动路由、仪表盘站点可用性观测。

## Important Trade-offs

- 真正从 schema 删除 `site_announcements` 已获批准使用 destructive migration；直接运行现有 `schema:contract` 仍可能触发 `Non-additive schema diff detected`，实现需要同步处理生成流程或手动维护产物。
- 不清理历史 `events` 更安全，但旧用户数据中可能仍能看到过去生成的标题文本；这不是静态代码残留，也不会再新增。
- 保留旧备份字段的忽略兼容可以降低恢复风险，但需要测试覆盖。

## Rollback Shape

- 前端/后端删除可通过恢复路由、服务、adapter contract 和页面文件回滚。
- 若新增 DROP TABLE migration，回滚代码不能恢复用户已删除公告数据；这是本任务最主要的不可逆风险。
- 若选择非破坏性迁移，回滚风险较低，但 schema 清理不完整。
