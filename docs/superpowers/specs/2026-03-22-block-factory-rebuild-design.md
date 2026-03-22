# Block Factory Rebuild — Design Spec

**Date:** 2026-03-22
**Approach:** Scaffold-and-Migrate (Approach C)
**Scope:** Full rebuild of generator internals, editor UI, security hardening

---

## 1. Overview

Block Factory is a WordPress plugin that generates Gutenberg blocks from visual field definitions. This rebuild restructures the internals — splitting the God Object generator, unifying code generation to Node.js, modernizing the React editor, and fixing security issues — while keeping the existing `config.json` format and user workflow intact.

**User workflow (unchanged):**
1. Create block (name, icon) in admin dashboard
2. Define fields in visual editor (Step 0)
3. Save → get cheat sheet with `{{field_key}}` placeholders
4. Write HTML template + CSS using cheat sheet (Step 1)
5. Build → Node.js generates all block files → Webpack compiles

---

## 2. Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Code generation | Node.js only | User always does fields → template → build in one session. PHP save just writes config.json + returns cheat sheet. |
| Config storage | JSON files on disk | Git-friendly, no database dependency |
| Template syntax | `{{#each key}}...{{/each}}` only | Drop `{{#key}}...{{/key}}` variant. Reduces regex fragility. |
| Shortcode | Remove `[bf_block]` | Security risk, limited use. Blocks via Gutenberg inserter. |
| AI providers | Keep all 4, refactor to single method | Eliminate duplicate code with provider config array |
| Backward compat | Yes | Existing `config.json` files work as-is |
| PSR-4 autoloading | No | Simple `require_once` for <10 classes |
| Security | In scope | Template injection, API key encryption, exec timeout, file locking |

---

## 3. New PHP Class Structure

### Current → New mapping

```
includes/
├── class-gutenkit-loader.php              # KEEP — slim down, delegate to NodeEnvironment
├── class-gutenkit-register.php            # KEEP — remove shortcode handler
├── class-gutenkit-admin.php               # KEEP — no changes
├── class-gutenkit-ai.php                  # REFACTOR — single API method + provider config
├── class-gutenkit-config-manager.php      # NEW — read/write/validate config.json with flock()
├── class-gutenkit-block-creator.php       # NEW — create/delete block scaffolding from templates
├── class-gutenkit-block-builder.php       # NEW — trigger npm build/install with proc_open() timeout
├── class-gutenkit-cheat-sheet.php         # NEW — generate cheat sheet HTML from field definitions
├── class-gutenkit-node-environment.php    # NEW — shared Node/npm detection utility
```

### Method migration from GutenKit_Generator (1800 lines → deleted)

| Method | New class |
|--------|-----------|
| `handle_create_block()` | `BlockCreator` |
| `handle_delete_block()` | `BlockCreator` |
| `handle_save_structure()` | `ConfigManager` (save config.json + return cheat sheet only) |
| `handle_run_build()` | `BlockBuilder` |
| `handle_install_dependencies()` | `BlockBuilder` |
| `generate_data_cheat_sheet()` | `CheatSheet` |
| `detect_node_environment()` | `NodeEnvironment` |
| `backup_block_files()`, `restore_from_backup()`, `cleanup_backup()` | `ConfigManager` |
| `regenerate_edit_js()` | **DELETED** — moved to Node.js |
| `generate_render_php()` | **DELETED** — moved to Node.js |
| `update_block_json()` | **DELETED** — moved to Node.js |
| `generate_inspector_controls()` | **DELETED** — moved to Node.js |
| `generate_canvas_preview()` | **DELETED** — moved to Node.js |
| `generate_editor_effect()` | **DELETED** — moved to Node.js |
| `get_script_import()` | **DELETED** — moved to Node.js |
| `inject_script_base_css()` | **DELETED** — moved to Node.js |

### Class responsibilities

**ConfigManager:**
- `handle_save_structure()` — AJAX handler for `wp_ajax_block_factory_save_structure`. Validates nonce/permissions, delegates to save() + CheatSheet, returns cheat sheet HTML.
- `save($slug, $configData)` — merges incoming `fields`/`template`/`css` with existing config (preserves `scripts` key), validates JSON, acquires flock(), writes config.json via WP_Filesystem, releases lock
- `load($slug)` — reads and parses config.json
- `validate($config)` — checks required fields exist, field types are known
- `backup($slug)` / `restore($slug)` — timestamped backup before writes
- `delete_transient_cache()` — invalidates `gutenkit_blocks_cache` transient after config changes
- Config hash optimization: stores `.config_hash` file, skips write if content unchanged

**BlockCreator:**
- `create($name, $icon, $scriptType)` — copies templates/*.tpl → blocks/{slug}/, replaces placeholders, invalidates transient cache
- `delete($slug)` — removes blocks/{slug}/ and build/{slug}/ directories via `delete_dir_recursive()`, invalidates transient cache
- Hooks: `admin_post_block_factory_generate` (form POST), `wp_ajax_block_factory_delete_block` (AJAX)

**BlockBuilder:**
- `build()` — runs `npm run build` via proc_open() with 120s timeout, invalidates transient cache
- `install()` — runs `npm install` via proc_open() with 120s timeout
- Cross-platform process kill: `taskkill /T /PID` on Windows, `kill -9` on Unix
- AJAX handlers: `wp_ajax_bf_run_npm_build`, `wp_ajax_bf_install_dependencies`

**CheatSheet:**
- `generate($fields)` — reads field definitions, returns HTML table of `{{field_key}}` placeholders
- `write($slug, $fields)` — writes `cheat_sheet.html` file to block directory
- Covers: simple fields, image/file URL/alt patterns, repeater loop syntax, gallery nested loops

**NodeEnvironment:**
- `detect()` — cross-platform Node/npm path detection
- `get_node_path()` / `get_npm_path()` — cached results
- Supports `WP_BLOCK_FACTORY_NODE_PATH` constant override

**Utility methods (shared):**
- `log_error($message)` — appends to `gutenkit-debug.log` with timestamps (used by all classes)
- `delete_dir_recursive($path)` — recursive directory removal via WP_Filesystem (used by BlockCreator)

**Loader wiring (`class-gutenkit-loader.php`):**
The Loader's `includes()` method requires all new class files. The `init_hooks()` method instantiates them:
```php
$node_env = new GutenKit_NodeEnvironment();
$config_manager = new GutenKit_ConfigManager(); // registers wp_ajax_block_factory_save_structure
$cheat_sheet = new GutenKit_CheatSheet();
$config_manager->set_cheat_sheet($cheat_sheet);
$block_creator = new GutenKit_BlockCreator();    // registers admin_post + wp_ajax hooks
$block_builder = new GutenKit_BlockBuilder($node_env); // registers wp_ajax hooks
```

**WP_Filesystem:** All file operations (config save, block creation, deletion, backup) use `WP_Filesystem` for WordPress.org compatibility, matching the current codebase pattern.

---

## 4. New React Component Structure

### Current → New mapping

```
src/
├── editor-app.js                      # Slim entry point — mounts <App />
├── components/
│   ├── App.js                         # Top-level state + wizard step routing
│   ├── step-fields/
│   │   ├── FieldPalette.js            # Field type buttons (Inspector vs Content/Media categories)
│   │   ├── FieldList.js               # Draggable field list with selection
│   │   ├── FieldSettings.js           # Settings panel for selected field
│   │   └── RepeaterSettings.js        # Sub-field editor within repeater fields
│   ├── step-template/
│   │   ├── TemplateEditor.js          # HTML textarea + cheat sheet tag insertion
│   │   ├── CSSEditor.js              # CSS textarea
│   │   ├── LivePreview.js            # Processed HTML preview with placeholder badges
│   │   └── AIGenerator.js            # AI prompt input + generation
│   └── shared/
│       ├── DragDrop.js               # Shared drag-drop logic (fields + sub-fields)
│       └── Validation.js             # Field validation (label, key, repeater sub-fields)
├── hooks/
│   └── useBlockConfig.js             # Custom hook: fields/template/css state + save/build API calls
├── utils/
│   └── api.js                        # fetch wrappers replacing jQuery.post
├── styles/
│   ├── editor-app.scss               # Global admin editor styles
│   ├── field-palette.scss
│   ├── field-list.scss
│   ├── field-settings.scss
│   ├── template-editor.scss
│   ├── css-editor.scss
│   ├── live-preview.scss
│   └── ai-generator.scss
```

### Key changes

- **jQuery eliminated** — `utils/api.js` uses vanilla `fetch` with `admin-ajax.php` (same AJAX endpoints, not REST API migration). Receives `ajaxurl` and nonce from `wp_localize_script` via `window.blockFactoryEditor` global, same as current code.
- **Inline styles eliminated** — each component has a `.scss` file
- **Drag-drop shared** — `DragDrop.js` handles both field-level and sub-field-level reordering
- **State centralized** — `useBlockConfig` hook manages all config state, exposed via props
- **`assets/js/admin.js` rewritten** — convert from jQuery to vanilla JS. Handles: delete block button, install dependencies button, dashicon picker. Loaded on dashboard page only (not the React editor).
- **`admin/generator-form.php` updated** — remove any inline jQuery references, use vanilla JS event handlers
- **No changes to:** `lib/fields.js`, `lib/constants.js`, `lib/php-to-jsx.js`, `webpack.config.js`

---

## 5. Unified Node.js Generation

### What moves from PHP to `generate-block-code-multi.js`

**New function: `generateRenderPhp(config, blockPath)`**
- Reads `config.template` (Mustache HTML)
- Processes `{{field}}` → `<?php echo esc_html($attributes['field']); ?>`
- Processes `{{#each key}}` → `<?php foreach($attributes['key'] as $item): ?>`
- Handles special patterns with correct escaping per context:
  - **Text/number/date/time/icon fields:** `esc_html()` — safe for HTML text content
  - **URL fields, image/file URLs:** `esc_url()` — safe for href/src attributes
  - **Image alt, file filename:** `esc_attr()` — safe for HTML attributes
  - **ContentEditor fields:** `wp_kses_post()` — allows safe HTML subset
  - **Color fields:** `esc_attr()` — used in style attributes
  - **Button:** conditional `if(!empty(...))` wrapper, `esc_url()` for href, `esc_html()` for text
  - **Gallery:** nested `foreach` with `esc_url()` for src, `esc_attr()` for alt
  - **Repeater:** outer `foreach`, inner fields use same escaping rules as top-level
- Writes `render.php` to block directory (stays in `blocks/{slug}/`, not `build/`)

**Enhanced: `generateBlock(blockPath)`**
- Now generates ALL output files: `edit.js`, `render.php`, `view.js`, `block.json`, `attributes.json`, `style.scss`
- PHP no longer generates any of these

**Single source of truth:**
- `lib/fields.js` FIELD_MAP is the sole authority for field → attribute type mapping
- PHP no longer maps field types — it only reads/writes `config.json`
- The PHP ↔ JS contract is the `config.json` format (unchanged)

**Template syntax enforcement (phased):**
- During Steps 4–7: both `{{#each key}}` and `{{#key}}` syntaxes are supported, with console deprecation warning for old syntax
- After Step 8 (template migration): only `{{#each key}}...{{/each}}` recognized, old syntax is a build error

**Field key validation (security):**
- Before any code generation, validate all field keys against `/^[a-z][a-z0-9_]*$/`
- Reject invalid keys with build error — prevents code injection via crafted field names

---

## 6. Security Fixes

### 1. Template injection — field key validation
- **Where:** `generate-block-code-multi.js`, before code generation
- **What:** Validate field keys against `/^[a-z][a-z0-9_]*$/`. Reject invalid keys with build error.
- **Why:** Field keys end up in generated PHP/JS. Invalid keys could inject code.

### 2. API key encryption
- **Where:** `class-gutenkit-ai.php`
- **What:** Encrypt API keys using `openssl_encrypt` (AES-256-CBC) with `wp_salt('auth')` as key before `update_option()`. Decrypt with `openssl_decrypt` on retrieval. If salts change, keys become unreadable — user re-enters them (acceptable UX since it's rare).
- **Why:** Prevents casual exposure from database dumps.

### 3. exec() timeout
- **Where:** `class-gutenkit-block-builder.php`, `class-gutenkit-node-environment.php`
- **What:** Replace bare `exec()` with `proc_open()` + 120s configurable timeout. Kill process on timeout.
- **Why:** npm install/build can hang indefinitely.

### 4. File locking
- **Where:** `class-gutenkit-config-manager.php`
- **What:** `flock(LOCK_EX)` when writing config.json. Second concurrent save waits or fails gracefully.
- **Why:** Two simultaneous saves could corrupt config.json.

### 5. Shortcode removal
- **Where:** `class-gutenkit-register.php`
- **What:** Remove `handle_shortcode()` and `add_shortcode('bf_block')`.
- **Why:** base64 attribute decoding without validation is a risk. Limited use case.

---

## 7. Migration Order

Each step leaves the plugin fully functional. Test after every step.

### Step 1: Extract NodeEnvironment
- Create `class-gutenkit-node-environment.php`
- Move `detect_node_environment()` from Loader + Generator
- Both classes delegate to `NodeEnvironment`
- Delete duplicate methods

### Step 2: Extract ConfigManager + CheatSheet
- Create `class-gutenkit-config-manager.php` — registers `wp_ajax_block_factory_save_structure` hook
- ConfigManager's `handle_save_structure()` takes over the AJAX endpoint. It: validates nonce/permissions, merges incoming data with existing config (preserving `scripts` key), saves config.json, calls CheatSheet, returns HTML.
- Create `class-gutenkit-cheat-sheet.php` — generates + writes cheat sheet
- Generator's `handle_save_structure()` is removed (ConfigManager owns the AJAX action now)
- Generator still does file generation when called by ConfigManager (transition: ConfigManager calls Generator methods for file regen until Step 4–5 remove them)

### Step 3: Extract BlockCreator + BlockBuilder
- Move `handle_create_block()`, `handle_delete_block()` → `BlockCreator`
- Move `handle_run_build()`, `handle_install_dependencies()` → `BlockBuilder`
- `BlockBuilder` uses `proc_open()` with timeout (security fix #3)
- Generator is now nearly empty

### Step 4: Port render.php generation to Node.js
- Add `generateRenderPhp()` to `generate-block-code-multi.js`
- Add field key validation (security fix #1)
- Support both `{{#each key}}` and `{{#key}}` syntax with deprecation warning (backward compat until Step 8)
- Test: `npm run build` produces identical `render.php` output as PHP did for all existing blocks
- Remove `generate_render_php()` from Generator
- **Note:** After this step, render.php is only generated during build, not on save. This is acceptable because the user workflow is always fields → template → build in one session.

### Step 5: Remove remaining PHP generation + delete Generator
- Remove `regenerate_edit_js()`, `update_block_json()`, all template helper methods from Generator
- ConfigManager already owns `handle_save_structure()` (from Step 2) — it stops calling Generator file-gen methods
- ConfigManager save flow is now: validate → merge → flock → write config.json → return cheat sheet
- Delete `class-gutenkit-generator.php` entirely — all methods migrated to other classes or Node.js
- Remove Generator from Loader's `includes()` and `init_hooks()`

### Step 6: Split editor-app.js
- **Strategy:** Incremental extraction. The old `editor-app.js` remains the working entry point throughout. Components are extracted one at a time and imported back into the shrinking monolith. Webpack builds remain functional at every commit.
- Order:
  1. `utils/api.js` — replace all `jQuery.post` calls with vanilla `fetch` wrappers
  2. `hooks/useBlockConfig.js` — extract state management + API calls
  3. `components/App.js` — extract wizard step routing shell
  4. `step-fields/` components — FieldPalette, FieldList, FieldSettings, RepeaterSettings
  5. `step-template/` components — TemplateEditor, CSSEditor, LivePreview, AIGenerator
  6. `shared/` — DragDrop, Validation
- Extract inline styles to SCSS files as each component is extracted
- Also rewrite `assets/js/admin.js` from jQuery to vanilla JS (dashboard buttons + icon picker)
- Update `admin/generator-form.php` to remove jQuery references

### Step 7: Remaining security fixes
- API key encryption in `GutenKit_AI` (security fix #2)
- File locking in `ConfigManager` (security fix #4)
- Remove shortcode from `Register` (security fix #5)

### Step 8: Template syntax migration
- Scan existing blocks for `{{#key}}` patterns
- Convert to `{{#each key}}` format
- Update `generate-block-code-multi.js` to only accept `{{#each}}`

### Step 9: AI refactor
- Replace 4 API caller methods (`call_openai`, `call_gemini`, `call_groq`, `call_openrouter`) with single `call_provider($provider, $prompt)` method
- Provider config array defines: endpoint, model, headers, response path

---

## 8. Files Unchanged

These files are not touched during the rebuild:

- `block-factory.php` — entry point (only change: Loader instantiation stays the same)
- `lib/fields.js` — field type definitions (already clean)
- `lib/constants.js` — paths and markers (already clean)
- `lib/php-to-jsx.js` — PHP→JSX converter (improve later, not blocking)
- `webpack.config.js` — dual build config (works as-is)
- `templates/*.tpl` — boilerplate templates including `save.js.tpl`, `editor.scss.tpl` (works as-is)
- `blocks/*/config.json` — backward compatible, no schema changes
- `admin/js/editor-app.asset.php` — webpack-generated dependency manifest

---

## 9. Success Criteria

- [ ] `class-gutenkit-generator.php` deleted — all logic distributed to focused classes
- [ ] `npm run build` generates all block files (edit.js, render.php, block.json, view.js, attributes.json, style.scss)
- [ ] PHP save endpoint only writes config.json and returns cheat sheet
- [ ] `editor-app.js` split into <200-line component files
- [ ] Zero jQuery in codebase
- [ ] All existing blocks in `blocks/` build and render correctly
- [ ] Field keys validated before code generation
- [ ] API keys encrypted in database
- [ ] npm commands use proc_open() with timeout
- [ ] Config saves use file locking
- [ ] Shortcode removed
- [ ] Only `{{#each key}}...{{/each}}` template syntax accepted
- [ ] AI class uses single provider-agnostic API method
