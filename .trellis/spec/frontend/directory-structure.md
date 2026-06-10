# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Top-level files under `src/web/pages/` are route/page orchestration surfaces.
They may compose components, read route state, and delegate to domain modules,
but they must not be used as shared component libraries by other top-level
pages.

When a page exposes a reusable panel, drawer, modal family, or other embedded
surface that another page also needs, move that reusable surface into a domain
subfolder under `src/web/pages/<domain>/` and import it from there.

---

## Module Organization

### Convention: Top-Level Pages Do Not Import Each Other

**What**: A file such as `Accounts.tsx`, `Tokens.tsx`, or `Settings.tsx` should
not import another top-level page file like `./Tokens.js`.

**Why**: Top-level pages own route composition and lifecycle assumptions.
Importing one page from another makes route modules double as shared libraries
and is tracked by `npm run repo:drift-check` as `web-page-to-page-import` debt.

**Instead**: Put the shared surface in a domain subfolder and have both page
entry points import that neutral module.

```typescript
// Good: Accounts composes the shared token panel from a domain module.
import { TokensPanel } from "./tokens/TokensPanel.js";

// Good: the route page remains a route surface.
export default function Tokens() {
  return <Navigate to="/accounts?segment=tokens" replace />;
}
```

```typescript
// Bad: a top-level page imports another top-level page as a shared module.
import { TokensPanel } from "./Tokens.js";
```

### Convention: Domain Subfolders Own Extracted Page Surfaces

**What**: Use `src/web/pages/<domain>/` for page-local domain components that
are too specific for `src/web/components/` but shared by more than one page
surface.

**Examples**:

- `src/web/pages/accounts/AccountModelsModal.tsx`
- `src/web/pages/token-routes/RouteCard.tsx`
- `src/web/pages/tokens/TokensPanel.tsx`

**Validation**:

- Run `npm run repo:drift-check` after moving page surfaces.
- Run focused page tests for both the standalone page and embedded consumer.
- Run `npm run typecheck:web` and `npm run typecheck:web:test` when import
  paths or test imports change.

---

## Common Mistakes

### Re-exporting A Shared Panel From The Old Page

**Symptom**: Drift check passes for the original importer, but tests or future
features keep importing the shared component from the top-level page file.

**Fix**: Update tests and consumers to import the domain module directly. Keep
the top-level page focused on route behavior.

### Source-Reading Architecture Tests Still Point At The Old Page

**Symptom**: Runtime tests pass, but CI fails in architecture tests that read a
page file as text and expect layout primitives such as `ResponsiveFilterPanel`,
`ResponsiveBatchActionBar`, `CenteredModal`, or class names.

**Cause**: Moving a reusable surface into `src/web/pages/<domain>/` changes the
source file that owns those primitives. Tests that assert source-level adoption
must follow the new owner file.

**Fix**: Search for the old page path in tests and update those source-reading
assertions to the extracted domain module.

```bash
rg "src/web/pages/Tokens\\.tsx|readPageSource\\('src/web/pages/Tokens" src/web
```
