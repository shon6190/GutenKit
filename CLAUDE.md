# Block Factory (GutenKit)

WordPress Gutenberg block generator plugin. Users define fields in WP Admin UI, plugin auto-generates block file structure.

## Tech Stack

- **Backend:** PHP 7.4+ (OOP), WordPress Gutenberg APIs
- **Frontend:** React via `@wordpress/element`, `@wordpress/block-editor`, `@wordpress/components`
- **Build:** Webpack via `@wordpress/scripts`, custom dual-config (`webpack.config.js`)
- **Styling:** SCSS (BEM-variant: `gk-{slug}-{component}__{element}`)
- **No Composer.** No linter configs. No test framework.

## Build Commands

```bash
npm start    # Dev server with HMR (runs pre-build code generation)
npm run build # Production build (runs pre-build code generation)
```

Both commands auto-run `generate-block-code-multi.js` first, which reads each block's `config.json` and generates `edit.js`, `render.php`, and `attributes.json`.

## Project Structure

```
includes/               # PHP classes (GutenKit_Loader, _Register, _Generator, _Admin, _AI)
blocks/{slug}/          # Block source: config.json, edit.js, save.js, index.js, render.php, *.scss
build/{slug}/           # Webpack output (compiled blocks)
src/editor-app.js       # Admin React editor app (source)
admin/js/editor-app.js  # Admin React editor app (compiled)
lib/                    # JS helpers: fields.js (type mappings), php-to-jsx.js (template transpiler), constants.js
templates/              # PHP/JS templates for new blocks
generate-block-code-multi.js  # Pre-build: config.json → source files
webpack.config.js       # Dual config: admin editor + per-block bundles
```

## Key Conventions

- **PHP classes:** `GutenKit_ClassName` naming, WordPress hook patterns
- **Block slugs:** kebab-case (e.g., `hero-banner`)
- **Block definitions:** `config.json` holds fields, Handlebars-like template (`{{field}}`), CSS, script config
- **Webpack entries:** Dynamically generated from `blocks/*/index.js` + `blocks/*/view.js`
- **Constants:** `BLOCK_FACTORY_PATH`, `BLOCK_FACTORY_URL`, `BLOCKS_BASE_PATH`, `BUILD_BASE_PATH`
- **Security:** Use `esc_attr()`, `esc_url()`, `wp_kses_post()` for output escaping
- **CSS prefixes:** `gk-` (GutenKit), `bf-` (Block Factory)

## How Blocks Work

1. Admin UI defines block fields → saved as `config.json`
2. `generate-block-code-multi.js` reads `config.json` → generates `edit.js`, `render.php`, `attributes.json`
3. Webpack bundles each block's `index.js` (+ optional `view.js`) into `build/{slug}/`
4. `GutenKit_Register` registers blocks from `build/` directory with WordPress
