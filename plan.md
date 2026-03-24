# Block Factory Plugin — Pre-Rebuild Audit & Plan

## Overview

**Block Factory** (built with GutenKit) is a WordPress plugin that allows developers to visually design and generate custom Gutenberg blocks. It handles the scaffolding, code generation, and build process, allowing for rapid block development without manual boilerplate coding.

---

## 1. Architecture & File Structure

```
block-factory/
├── block-factory.php              # Entry point (~20 lines, clean bootstrap)
├── includes/
│   ├── class-gutenkit-loader.php      # Bootstraps plugin, npm auto-install (190 lines)
│   ├── class-gutenkit-register.php    # Block registration + shortcode handler (156 lines)
│   ├── class-gutenkit-generator.php   # GOD OBJECT: creation + editing + building + npm (1800+ lines)
│   ├── class-gutenkit-admin.php       # Admin dashboard + React editor loading (197 lines)
│   └── class-gutenkit-ai.php          # AI template generation via LLM APIs (370 lines)
├── admin/
│   ├── generator-form.php         # Block creation form
│   └── js/editor-app.js          # Compiled React editor app
├── src/
│   └── editor-app.js             # React editor source (1125 lines, monolithic)
├── lib/
│   ├── constants.js              # Paths, markers, package mappings (~50 lines, clean)
│   ├── fields.js                 # FIELD_MAP: 18 field type definitions (~600 lines)
│   └── php-to-jsx.js             # render.php → JSX converter (15 ordered regexes, fragile)
├── generate-block-code-multi.js  # Pre-build: config.json → edit.js/view.js/attributes (~470 lines)
├── webpack.config.js             # Dual config: admin editor + per-block bundles (~70 lines)
├── assets/js/admin.js            # jQuery: delete block, npm install, icon picker (~185 lines)
├── blocks/{slug}/                # Block source: config.json, edit.js, save.js, render.php, *.scss
├── build/{slug}/                 # Webpack output (compiled blocks)
└── templates/*.tpl               # 8 boilerplate templates for new blocks
```

---

## 2. Data Flow & Lifecycle

### Step 1: Plugin Activation & Initialization

**File:** `block-factory.php` → `includes/class-gutenkit-loader.php`

1. `block-factory.php` instantiates `GutenKit_Loader`.
2. **Loader:**
   - Defines constants (`BLOCK_FACTORY_PATH`, `BLOCK_FACTORY_URL`, `BLOCKS_BASE_PATH`, `BUILD_BASE_PATH`).
   - Includes core classes conditionally.
   - Instantiates: `GutenKit_Register` (hooks `init`), `GutenKit_Generator` (hooks `wp_ajax_*`), `GutenKit_Admin` (hooks `admin_menu`), `GutenKit_AI` (hooks `admin_menu` + `wp_ajax_*`).
3. **Activation Hook:** Checks `node_modules` existence + `package.json` hash. Runs `npm install` only when hash changes.

### Step 2: Admin Interface & Routing

**File:** `includes/class-gutenkit-admin.php`

1. Adds "Block Factory" admin menu page.
2. **Dashboard:** Globs `blocks/` directory, lists blocks with name, icon, last modified.
3. **Editor Router:** Checks `page=block-factory&action=edit_structure`, loads React editor via `render_editor()`.
4. Reads `blocks/{slug}/config.json`, passes to React app via `wp_localize_script`.

### Step 3: Visual Block Editing

**File:** `src/editor-app.js` (compiled to `admin/js/editor-app.js`)

1. **Two-step wizard UI:**
   - Step 0: Field structure definition (drag-drop field palette → field list → settings panel)
   - Step 1: Template & CSS editors with live preview + AI generation
2. **State:** fields array, template string, CSS string, validation errors.
3. **Saving:** Posts JSON config to `block_factory_save_structure` AJAX action.
4. **Build trigger:** Posts to `bf_run_npm_build` AJAX action.

### Step 4: Code Generation — DUAL PATH (Critical Finding)

**⚠️ Two independent code generation systems exist and can diverge:**

#### Path A: PHP Backend (`class-gutenkit-generator.php`)
Triggered by AJAX `block_factory_save_structure`:
1. Writes `config.json` via WP_Filesystem.
2. `update_block_json()` — maps fields to Gutenberg attributes.
3. `regenerate_edit_js()` — generates Inspector Controls JSX + canvas preview.
4. `generate_render_php()` — processes Mustache templates → PHP output.
5. Creates backup before writes, restores on failure.

#### Path B: Node.js Pre-build (`generate-block-code-multi.js`)
Triggered by `npm run build` (prebuild hook):
1. Reads `config.json` per block.
2. Uses `FIELD_MAP` (lib/fields.js) to generate JSX.
3. Uses `convertRenderPhpToJsx` (lib/php-to-jsx.js) for canvas preview.
4. Writes: `edit.js`, `view.js`, `block.json` attributes, `attributes.json`, `style.scss`.
5. Has incremental build: skips if output files newer than config.json.

**⚠️ DIVERGENCE RISK:** If `FIELD_MAP` in JS adds a field type but PHP Generator doesn't update, or vice versa, blocks break silently.

### Step 5: Webpack Build

**File:** `webpack.config.js`

Dual configuration:
1. Admin editor: `src/editor-app.js` → `admin/js/editor-app.js`
2. Block bundles: `blocks/*/index.js` + `blocks/*/view.js` → `build/*/`
3. CopyWebpackPlugin copies `block.json` and `config.json` to build output.

### Step 6: Block Registration & Rendering

**File:** `includes/class-gutenkit-register.php`

1. On `init`, scans `build/` (priority) or `blocks/` for `block.json`.
2. Caches block list in 24-hour transient.
3. `register_block_type_from_metadata()` with custom render callback.
4. Render callback includes `blocks/{slug}/render.php` with `$attributes` and `$content` in scope.
5. Also supports `[bf_block slug="" attributes="" content=""]` shortcode.

---

## 3. Complete Field Type Inventory (18 types)

| Type | Attribute | Storage | Escaping | Editor Component | Status |
|------|-----------|---------|----------|------------------|--------|
| `text` | string | `""` | `esc_html()` | TextControl | **Clean** |
| `textarea` | string | `""` | `esc_html()` | TextareaControl | **Clean** |
| `number` | number | `0` | `esc_html()` | TextControl type=number | **Clean** |
| `range` | number | `0` | `esc_html()` | RangeControl | **Messy** — hardcoded 0-100, no configurable min/max/step |
| `email` | string | `""` | `esc_html()` | TextControl type=email | **Clean** |
| `url` | string | `""` | `esc_url()` | TextControl type=url | **Clean** |
| `image` | object | `{id,url,alt}` | `esc_url()`/`esc_attr()` | MediaUpload + preview | **Clean** |
| `file` | object | `{id,url,filename}` | `esc_url()` | MediaUpload (PDF,DOC,ZIP) | **Clean** |
| `gallery` | array | `[{id,url,alt}]` | `esc_url()`/`esc_attr()` | MediaUpload multiple | **Clean** |
| `date` | string | `""` | `esc_html()` | DatePicker | **Clean** |
| `time` | string | `""` | `esc_html()` | TextControl type=time | **Clean** |
| `datetime` | string | `""` | `esc_html()` | DatePicker + TextControl | **Messy** — no timezone support |
| `color` | string | `""` (hex) | `esc_attr()` | ColorPalette | **Clean** |
| `icon` | string | `""` | `esc_attr()` | TextControl (class name) | **Placeholder** — no visual picker |
| `button` | object | `{text,url}` | `esc_html()`/`esc_url()` | TextControl x2 | **Clean** |
| `contentEditor` | string | `""` (HTML) | `wp_kses_post()` | RichText + HTML toggle | **Complex but works** |
| `repeater` | array | `[{...}]` | per-subfield | Add/remove/drag buttons | **Messy** — JS/PHP sub-field gap |
| `relational` | number | `0` | `esc_html()` | SelectControl (hardcoded) | **Placeholder** — no real post query |

### Repeater Sub-field Support Gap

| Sub-field type | JS editor UI | PHP render |
|----------------|-------------|------------|
| text | Yes | Yes |
| number | Yes | Yes |
| url | Yes | Yes |
| textarea | Yes | Yes |
| image | Yes | Yes |
| color | **No** | Yes |
| date/datetime | **No** | Yes |
| icon | **No** | Yes |
| button | **No** | Yes |
| gallery | **No** | Yes |
| relational | **No** | Yes |
| contentEditor | **No** | Yes |

**Result:** PHP can render 13+ sub-field types, but the JS editor UI only lets users create 5 of them inside repeaters.

### Script Type Support (4 types)

| Type | View.js | Editor Effect | Auto-CSS | Notes |
|------|---------|---------------|----------|-------|
| `slider` | Embla Carousel init | useEffect with Embla | Embla base CSS injected | Uses `data-embla-*` attributes |
| `accordion` | Toggle `aria-expanded` | useEffect toggle | None | Optional single-open mode |
| `ajax` | Fetch POST to REST API | None | None | Dispatches `gk:ajax-response` event |
| `custom` | User-provided code | None | None | Wrapped in DOMContentLoaded |

---

## 4. File-by-File Audit Verdict

### CORE — Keep As-Is
| File | Why |
|------|-----|
| `block-factory.php` | Clean bootstrap, minimal |
| `lib/constants.js` | Well-structured constants |
| `webpack.config.js` | Dual config works |
| `templates/*.tpl` | Clean boilerplate (8 files) |

### CORE — Needs Refactoring
| File | Problem | Recommendation |
|------|---------|----------------|
| `class-gutenkit-generator.php` (1800 lines) | God object: creation + editing + building + npm + templates | Split into: BlockCreator, BlockEditor, BlockBuilder, ScriptHandler |
| `src/editor-app.js` (1125 lines) | Monolithic React component, jQuery AJAX, inline styles | Split into components, use `apiFetch`, extract styles |
| `lib/php-to-jsx.js` | 15 ordered regex patterns, brittle | Consider AST-based approach or at minimum add tests |
| `lib/fields.js` | Repeater sub-fields only handle 5 types | Extend to match PHP's 13+ types |
| `generate-block-code-multi.js` | Weak error handling, sync file I/O | Add validation, error recovery |
| `assets/js/admin.js` | jQuery, hardcoded icons, no accessibility | Convert to vanilla JS, fetch icons dynamically |

### FEATURE — Optional
| File | Notes |
|------|-------|
| `class-gutenkit-ai.php` | Works but 4 near-identical API callers, plaintext API keys |

### No GARBAGE or DUPLICATE files found
Everything serves a purpose. The architecture is intentional.

---

## 5. Security Issues

### Critical
1. **Template injection** — `generate_render_php()` injects user content into PHP code via `str_replace()`. A crafted field key or template could inject arbitrary PHP.
2. **Custom script code injection** — Custom script type accepts raw JS with minimal sanitization, injected into generated `edit.js`.

### High
3. **Path traversal** — `block_slug` uses `sanitize_title()` but `realpath()` check is commented out/incomplete.
4. **Base64 shortcode** — `[bf_block]` shortcode decodes base64 attributes without validation.
5. **API keys in plaintext** — Stored directly in `wp_options`.

### Medium
6. **`exec()` without timeout** — npm install could hang indefinitely.
7. **No file locking** — Concurrent saves could corrupt block files.
8. **Backup directory enumerable** — Timestamped backup dirs could be guessed.

### Low
9. **Error log path exposure** — `gutenkit-debug.log` contains full file paths.
10. **No Content Security Policy** headers on admin pages.

---

## 6. Cross-Cutting Problems

### Duplicate Code
- `detect_node_environment()` defined in both `GutenKit_Loader` and `GutenKit_Generator` — extract to utility.

### Missing Infrastructure
- No unified error handling or custom Exception classes.
- No logging abstraction (mixes `error_log()`, `file_put_contents()`, WordPress error).
- No field type registry — field types hardcoded in multiple places (JS FIELD_MAP, PHP Generator, editor-app.js FIELD_TYPES).
- No schema validation of `config.json` before generation.
- No test coverage of any kind.

### Attribute Type Mapping — No Single Source of Truth
PHP (`class-gutenkit-generator.php`):
```php
if (in_array($field['type'], ['number', 'range', 'relational'])) → 'number'
if (in_array($field['type'], ['image', 'file', 'button'])) → 'object'
if (in_array($field['type'], ['repeater', 'gallery'])) → 'array'
else → 'string'
```
JS (`lib/fields.js`): Each field has its own `attributeType` property.

**These can diverge silently.** A single source of truth is needed.

### Template Syntax Inconsistency
Multiple accepted patterns for loops:
- `{{#each key}}...{{/each}}`
- `{{#key}}...{{/key}}`
- Both closers work via regex alternatives — creates confusion and edge-case bugs.

---

## 7. What the Existing Plan Covers vs. What the Code Actually Does

### Plan Covers Well
- Overall architecture and data flow — accurate
- Directory structure — accurate (minor: missing `lib/`, `class-gutenkit-ai.php`, `generate-block-code-multi.js`)
- Repeater fields and drag-drop — accurate
- Build process — accurate

### Gaps in the Plan (Things the Code Does That the Plan Doesn't Mention)

| Feature | Where |
|---------|-------|
| **Dual code generation paths** (PHP + Node.js) | Generator + generate-block-code-multi.js |
| **AI template generation** (4 LLM providers) | class-gutenkit-ai.php |
| **Script system** (slider/accordion/ajax/custom) | Generator + generate-block-code-multi.js |
| **Shortcode support** (`[bf_block]`) | class-gutenkit-register.php |
| **Backup/rollback on save** | Generator backup_block_files() |
| **Incremental build** (config hash check) | generate-block-code-multi.js |
| **PHP-to-JSX conversion** for canvas preview | lib/php-to-jsx.js |
| **Transient caching** for block registration | class-gutenkit-register.php |
| **Cheat sheet generation** | Generator generate_data_cheat_sheet() |
| **Embla CSS auto-injection** | Generator + generate-block-code-multi.js |

### Things Planned That May Not Be Needed
- **PSR-4 autoloading** — Only 5 PHP classes. A simple `require_once` set is fine unless the class count grows significantly. PSR-4 adds Composer dependency for minimal gain here.

---

## 8. Rebuild Constraints

- PHP 7.4+ compatible
- WordPress 6.0+ compatible
- React blocks using `@wordpress/blocks` and `@wordpress/components`
- No jQuery (currently used in `admin.js` and `editor-app.js` — must replace)
- No unnecessary dependencies
- All rendering in PHP/React files, NOT in the database
- Git-friendly: every change trackable

---

## 9. Rebuild Action Plan (Step-by-Step)

### Phase 1: Foundation
1. **Single source of truth for field types** — Create a shared field registry (JSON schema) consumed by both PHP and JS. Eliminates the dual-path divergence.
2. **Split `class-gutenkit-generator.php`** into focused classes: `BlockCreator`, `BlockEditor`, `BlockBuilder`, `NodeEnvironment` (utility).
3. **Extract `detect_node_environment()`** into shared utility class.
4. **Add config.json schema validation** before any generation runs.

### Phase 2: Editor UI
5. **Split `editor-app.js`** into React components: `FieldPalette`, `FieldList`, `FieldSettings`, `TemplateEditor`, `CSSEditor`, `LivePreview`.
6. **Replace jQuery AJAX** with `@wordpress/api-fetch` or vanilla `fetch`.
7. **Extract inline styles** to proper SCSS files.

### Phase 3: Field System
8. **Extend repeater sub-field support** in JS to match PHP's 13+ types.
9. **Make range field configurable** (min/max/step from field config).
10. **Implement real relational field** with `useSelect` + `wp.data` post query.
11. **Add visual icon picker** (replace plain TextControl).

### Phase 4: Security & Reliability
12. **Fix template injection** — validate/escape field keys before PHP code generation.
13. **Add file locking** for concurrent save protection.
14. **Encrypt API keys** in wp_options.
15. **Validate shortcode attributes** before base64 decode.
16. **Add timeout to exec()** calls.

### Phase 5: Code Quality
17. **Unify template syntax** — pick one loop format and deprecate alternatives.
18. **Add error boundaries** in React editor.
19. **Convert `admin.js`** from jQuery to vanilla JS.
20. **Add unit tests** for file generation, field mapping, template processing.

### Phase 6: Polish
21. **Improve `php-to-jsx.js`** — add test coverage for all 15 regex patterns.
22. **Refactor AI class** — deduplicate 4 API callers into single method with provider config.
23. **Add admin pagination** for block listing.

---

## 10. Decisions Made

1. **Unify to Node.js generation only** — PHP save endpoint writes config.json + returns cheat sheet only. All file generation (edit.js, render.php, block.json, view.js) moves to Node.js pre-build step. User workflow is always fields → template → build in one session.
2. **Security stays in scope** — all security items in Phase 4 are active.

3. **Config storage: JSON files** — no database, git-friendly, matches existing workflow.
4. **Template syntax: `{{#each key}}...{{/each}}` only** — drop `{{#key}}...{{/key}}` variant. One-time migration for existing blocks.
5. **Drop shortcode support** — remove `[bf_block]`. Blocks placed via Gutenberg inserter only.
6. **AI: Refactor to single method with provider config** — keep all 4 providers, eliminate duplicate API caller code.
7. **Backward compatible** — existing `config.json` files work as-is. Rebuild targets generator internals, not config schema.
8. **No PSR-4** — keep simple `require_once`. Not worth Composer for <10 classes.

---

## 11. Troubleshooting (Existing)

- **"npm not found"**: Define `WP_BLOCK_FACTORY_NODE_PATH` in `wp-config.php`.
- **Missing Dependencies**: Check file permissions or run `npm install` manually.
- **Changes not showing**: Click "Build Block" after saving. Gutenberg requires the build step.
