# 移除站点公告残留 - Implementation Plan

## Review Gate

用户已确认数据库清理边界：

- 允许迁移删除 `site_announcements` 表，完成 schema 层彻底删除。
- 不主动删除通用 `events` 表中的历史 `site_notice` 日志。

Review 已通过，可以运行 `python ./.trellis/scripts/task.py start ...` 并进入实现。

## Ordered Checklist

1. 加载 `trellis-before-dev`，读取相关项目规范和当前任务产物。
2. 更新前端入口：
   - 删除 `SiteAnnouncements` import、侧边栏项、route。
   - 删除页面、presentation helper、页面测试。
   - 删除 `/api/site-announcements*` API client。
   - 调整 notification / event navigation，确保不会跳转到 `/site-announcements`。
   - 移除 `site_notice` 专用筛选和「站点公告」静态标签。
3. 更新后端入口：
   - 取消 `siteAnnouncementsRoutes` 注册。
   - 取消公告 polling start/stop。
   - 删除公告 route/service/polling 文件和测试。
4. 更新平台适配：
   - 移除 `SiteAnnouncement` type 和 `getSiteAnnouncements` adapter contract。
   - 删除各平台公告抓取实现及对应测试。
5. 更新数据库、备份和跨库迁移：
   - 按已批准的数据库策略处理 `schema.siteAnnouncements`、`TABLES_WITH_NUMERIC_ID`、Drizzle migration/meta、generated schema artifacts。
   - 从 backup snapshot/export/import 和 database migration snapshot/statement/summary 中移除 `siteAnnouncements` active path。
   - 对旧备份字段做忽略兼容。
6. 更新文档：
   - 删除 `docs/upstream-integration.md` 和 `docs/configuration.md` 中的站点公告说明。
7. 清理测试：
   - 删除公告专属测试。
   - 更新 navigation、notification、program logs、backup、database migration、schema parity 等受影响断言。
8. 全仓搜索确认不再有 active `site-announcements`、`SiteAnnouncements`、`siteAnnouncements`、`site_announcements`、用户可见「站点公告」静态残留；允许旧迁移历史或明确兼容测试中必要出现。

## Validation Commands

- `npm run typecheck:web`
- `npm run typecheck:web:test`
- `npm run typecheck:server`
- Targeted Vitest for touched areas, expected set:
  - `vitest run --root . src/web/pages/helpers/navigationFocus.test.ts`
  - `vitest run --root . src/server/services/backupService.test.ts src/server/services/databaseMigrationService.test.ts`
  - `vitest run --root . src/server/db/schemaContract.test.ts src/server/db/schemaArtifactGenerator.test.ts src/server/db/schemaParity.test.ts`
- If schema artifacts change: `npm run schema:generate`
- Before finish because this touches shared architecture/database boundaries: `npm run repo:drift-check`

## Risky Files And Rollback Points

- `drizzle/**` and `src/server/db/generated/**`: schema deletion can be destructive and must stay synchronized.
- `src/server/services/backupService.ts` and `src/server/services/databaseMigrationService.ts`: old backup compatibility can regress if field removal is too strict.
- `src/server/services/platforms/base.ts`: removing adapter contract can cascade through many platform tests.
- `src/web/pages/helpers/navigationFocus.ts`: old notification navigation must not create dead links.

## Follow-up Checks Before Start

- Database cleanup decision confirmed.
- Confirm no parent/child split is needed after review.
- Confirm implementation should preserve historical `events` rows unless explicitly told otherwise.

## Verification Run

- `npm run db:generate`
- `npm run schema:contract`
- `npm run typecheck:web`
- `npm run typecheck:web:test`
- `npm run typecheck:server`
- `npm run typecheck:desktop`
- `npx vitest run --root . src/web/pages/helpers/navigationFocus.test.ts`
- `npx vitest run --root . src/server/services/platforms/newApi.test.ts src/server/services/platforms/doneHub.test.ts src/server/services/platforms/sub2api.test.ts`
- `npx vitest run --root . src/server/services/backupService.test.ts src/server/services/databaseMigrationService.test.ts`
- `npx vitest run --root . src/server/db/schemaContract.test.ts src/server/db/schemaArtifactGenerator.test.ts src/server/db/schemaParity.test.ts src/server/db/runtimeSchemaBootstrap.test.ts`
- `npm run repo:drift-check`
- `git diff --check`
