# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

### Scenario: Retiring A Checked-In Schema Table

#### 1. Scope / Trigger
- Trigger: removing a persisted table or other schema object from runtime code.
- Use this pattern when the product decision is to retire the feature and delete the table from active schema artifacts.

#### 2. Signatures
- Drizzle schema owner: `src/server/db/schema.ts`.
- SQLite migration history: `drizzle/*.sql` plus `drizzle/meta/_journal.json` and the latest `drizzle/meta/*_snapshot.json`.
- Generated contract artifacts:
  - `src/server/db/generated/schemaContract.json`
  - `src/server/db/generated/mysql.bootstrap.sql`
  - `src/server/db/generated/mysql.upgrade.sql`
  - `src/server/db/generated/postgres.bootstrap.sql`
  - `src/server/db/generated/postgres.upgrade.sql`
- Runtime upgrade generator: `src/server/db/schemaArtifactGenerator.ts`.

#### 3. Contracts
- New bootstrap SQL must not recreate the retired table.
- SQLite migration must express the approved destructive change, for example `DROP TABLE IF EXISTS retired_table`.
- External MySQL/Postgres upgrade SQL must be generated from the schema contract, not hand-written in feature code.
- Destructive upgrade generation must stay table-specific. Use a narrow retired-table whitelist such as `isRetiredSchemaTable('site_announcements')`; do not allow general removed columns or arbitrary table drops.
- Backup and cross-database migration services must stop exporting or importing active rows for the retired table. Legacy backup fields may be ignored for compatibility.

#### 4. Validation & Error Matrix
- Retired table remains in `schemaContract.json` or bootstrap SQL -> reject; new databases still create deleted feature storage.
- Runtime code still imports `schema.retiredTable` -> reject; the feature is still active.
- Upgrade generator accepts unrelated removed columns or tables -> reject; destructive scope is too broad.
- `drizzle-kit generate` emits unrelated already-existing migrations because snapshots lag behind journal entries -> manually narrow the new migration SQL and verify generated snapshots/contracts.
- Old backup field causes restore/migration failure -> add an ignore-compatibility test.

#### 5. Good/Base/Bad Cases
- Good: `site_announcements` is removed from `schema.ts`, SQLite adds `DROP TABLE IF EXISTS`, generated MySQL/Postgres upgrade artifacts contain `DROP TABLE IF EXISTS`, and services ignore old `siteAnnouncements` backup fields.
- Base: historical migration files and old Drizzle snapshots may still mention the retired table because they describe past schema states.
- Bad: deleting the route and page but leaving `schema.siteAnnouncements` in backup or migration services.

#### 6. Tests Required
- `npm run schema:contract`.
- Schema contract test asserting the retired table is absent from current contract.
- Schema artifact generator test asserting retired-table DROP is emitted and unrelated destructive diffs are still rejected.
- Runtime schema bootstrap test asserting old external live schemas get a generated DROP statement.
- Backup/migration tests asserting old retired-table fields are ignored.
- `npm run repo:drift-check`.

#### 7. Wrong vs Correct

Wrong:
```typescript
// Broadly allows destructive diffs.
assertNoSchemaDiff = false;
```

Correct:
```typescript
const RETIRED_SCHEMA_TABLES = new Set(['site_announcements']);

export function isRetiredSchemaTable(tableName: string): boolean {
  return RETIRED_SCHEMA_TABLES.has(tableName);
}
```

Wrong:
```sql
-- Generated together with unrelated already-existing ALTER statements.
ALTER TABLE `sites` ADD `post_refresh_probe_enabled` integer DEFAULT false;
DROP TABLE `site_announcements`;
```

Correct:
```sql
DROP TABLE IF EXISTS `site_announcements`;
```

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Common Mistakes

<!-- Database-related mistakes your team has made -->

(To be filled by the team)
