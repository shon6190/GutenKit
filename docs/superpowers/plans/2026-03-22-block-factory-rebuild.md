# Block Factory Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Block Factory plugin internals — split the God Object generator into focused classes, unify code generation to Node.js, modernize React editor, and fix security issues — while keeping existing blocks and workflow intact.

**Architecture:** Scaffold-and-Migrate approach. New classes/components are created empty, logic is moved method-by-method from existing files, old files are deleted when empty. Plugin stays functional at every step.

**Tech Stack:** PHP 7.4+ (WordPress), React via `@wordpress/element`, Node.js code generation, Webpack via `@wordpress/scripts`

**Spec:** `docs/superpowers/specs/2026-03-22-block-factory-rebuild-design.md`

---

## File Map

### New PHP files to create
| File | Responsibility |
|------|----------------|
| `includes/class-gutenkit-node-environment.php` | Cross-platform Node/npm detection |
| `includes/class-gutenkit-config-manager.php` | Read/write/validate config.json + AJAX save handler |
| `includes/class-gutenkit-cheat-sheet.php` | Generate cheat sheet HTML + write file |
| `includes/class-gutenkit-block-creator.php` | Create/delete block scaffolding |
| `includes/class-gutenkit-block-builder.php` | Run npm build/install with proc_open timeout |

### PHP files to modify
| File | Changes |
|------|---------|
| `includes/class-gutenkit-loader.php` | Require new classes, wire dependencies, remove detect_node_environment() |
| `includes/class-gutenkit-register.php` | Remove shortcode handler |
| `includes/class-gutenkit-ai.php` | Single API method + provider config, encrypt keys |
| `includes/class-gutenkit-generator.php` | Progressively empty → delete |

### JS files to modify
| File | Changes |
|------|---------|
| `generate-block-code-multi.js` | Add generateRenderPhp(), field key validation |

### New JS files to create
| File | Responsibility |
|------|----------------|
| `src/utils/api.js` | Vanilla fetch wrappers replacing jQuery.post |
| `src/hooks/useBlockConfig.js` | State management + API calls |
| `src/components/App.js` | Wizard step routing |
| `src/components/step-fields/FieldPalette.js` | Field type buttons |
| `src/components/step-fields/FieldList.js` | Draggable field list |
| `src/components/step-fields/FieldSettings.js` | Selected field settings |
| `src/components/step-fields/RepeaterSettings.js` | Repeater sub-field editor |
| `src/components/step-template/TemplateEditor.js` | HTML template textarea |
| `src/components/step-template/CSSEditor.js` | CSS textarea |
| `src/components/step-template/LivePreview.js` | Template preview |
| `src/components/step-template/AIGenerator.js` | AI prompt + generation |
| `src/components/shared/DragDrop.js` | Shared drag-drop handlers |
| `src/components/shared/Validation.js` | Field validation logic |
| `src/styles/*.scss` | Extracted inline styles (8 files) |

### JS files to rewrite
| File | Changes |
|------|---------|
| `assets/js/admin.js` | jQuery → vanilla JS |

### Files to delete
| File | When |
|------|------|
| `includes/class-gutenkit-generator.php` | After Task 5 |

---

## Task 1: Extract NodeEnvironment

**Files:**
- Create: `includes/class-gutenkit-node-environment.php`
- Modify: `includes/class-gutenkit-loader.php:136-188` (remove detect_node_environment)
- Modify: `includes/class-gutenkit-generator.php:1659-1734` (remove detect_node_environment)

- [ ] **Step 1: Create NodeEnvironment class**

Create `includes/class-gutenkit-node-environment.php` with the `detect()`, `get_node_path()`, `get_npm_path()` methods. This is a direct extraction of the existing `detect_node_environment()` from `class-gutenkit-loader.php` lines 136-188.

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_NodeEnvironment {
    private $node_dir = null;
    private $npm_cmd = null;
    private $detected = false;

    /**
     * Detect Node.js and npm paths. Cross-platform: Windows + Unix.
     * Supports WP_BLOCK_FACTORY_NODE_PATH constant override.
     *
     * @return array { 'npm_cmd' => string|false, 'node_dir' => string|false }
     */
    public function detect() {
        if ( $this->detected ) {
            return array(
                'npm_cmd'  => $this->npm_cmd,
                'node_dir' => $this->node_dir,
            );
        }

        $this->npm_cmd  = false;
        $this->node_dir = false;

        // 1. Check constant override
        if ( defined( 'WP_BLOCK_FACTORY_NODE_PATH' ) && is_dir( WP_BLOCK_FACTORY_NODE_PATH ) ) {
            $this->node_dir = rtrim( WP_BLOCK_FACTORY_NODE_PATH, '/\\' );
            $npm_bin = $this->node_dir . ( PHP_OS_FAMILY === 'Windows' ? '\\npm.cmd' : '/npm' );
            if ( file_exists( $npm_bin ) ) {
                $this->npm_cmd = '"' . $npm_bin . '"';
                $this->detected = true;
                return $this->detect();
            }
        }

        // 2. Try `where` (Windows) or `which` (Unix)
        $which_cmd = PHP_OS_FAMILY === 'Windows' ? 'where npm 2>NUL' : 'which npm 2>/dev/null';
        $npm_path = trim( (string) shell_exec( $which_cmd ) );

        if ( ! empty( $npm_path ) ) {
            // On Windows `where` may return multiple lines
            $npm_path = strtok( $npm_path, "\n" );
            $this->npm_cmd  = '"' . trim( $npm_path ) . '"';
            $this->node_dir = dirname( trim( $npm_path ) );
            $this->detected = true;
            return $this->detect();
        }

        // 3. Fallback paths
        $fallback_dirs = PHP_OS_FAMILY === 'Windows'
            ? array( 'C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs' )
            : array( '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin' );

        foreach ( $fallback_dirs as $dir ) {
            $npm_bin = $dir . ( PHP_OS_FAMILY === 'Windows' ? '\\npm.cmd' : '/npm' );
            if ( file_exists( $npm_bin ) ) {
                $this->npm_cmd  = '"' . $npm_bin . '"';
                $this->node_dir = $dir;
                $this->detected = true;
                return $this->detect();
            }
        }

        $this->detected = true;
        return $this->detect();
    }

    /**
     * @return string|false
     */
    public function get_npm_cmd() {
        if ( ! $this->detected ) {
            $this->detect();
        }
        return $this->npm_cmd;
    }

    /**
     * @return string|false
     */
    public function get_node_dir() {
        if ( ! $this->detected ) {
            $this->detect();
        }
        return $this->node_dir;
    }
}
```

- [ ] **Step 2: Wire NodeEnvironment into Loader**

Modify `includes/class-gutenkit-loader.php`:
- In `includes()` (~line 38), add: `require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-node-environment.php';`
- In `init_hooks()` (~line 49), instantiate: `$this->node_env = new GutenKit_NodeEnvironment();`
- In `activate()` (~line 66) and `install_dependencies()` (~line 100), replace calls to `self::detect_node_environment()` with a local `new GutenKit_NodeEnvironment()` instance (since activate is static).
- Delete the `detect_node_environment()` method (lines 136-188) from the Loader.

- [ ] **Step 3: Update Generator to use NodeEnvironment**

Modify `includes/class-gutenkit-generator.php`:
- In `handle_run_build()` (~line 312) and `handle_install_dependencies()` (~line 1740), replace `$this->detect_node_environment()` with `$node_env = new GutenKit_NodeEnvironment(); $env = $node_env->detect();`
- Delete `detect_node_environment()` method (lines 1659-1734) from the Generator.

- [ ] **Step 4: Verify plugin works**

Run: Open WordPress admin → Block Factory dashboard → verify page loads.
Run: Open an existing block editor → verify fields load.
Run: Click "Build" → verify npm build succeeds.

- [ ] **Step 5: Commit**

```bash
git add includes/class-gutenkit-node-environment.php includes/class-gutenkit-loader.php includes/class-gutenkit-generator.php
git commit -m "refactor: extract NodeEnvironment from Loader and Generator"
```

---

## Task 2: Extract ConfigManager + CheatSheet

**Files:**
- Create: `includes/class-gutenkit-config-manager.php`
- Create: `includes/class-gutenkit-cheat-sheet.php`
- Modify: `includes/class-gutenkit-loader.php` (require + wire new classes)
- Modify: `includes/class-gutenkit-generator.php` (remove handle_save_structure, generate_data_cheat_sheet, backup/restore methods)

- [ ] **Step 1: Create CheatSheet class**

Extract `generate_data_cheat_sheet()` (Generator lines 1480-1543) into a new class.

Create `includes/class-gutenkit-cheat-sheet.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_CheatSheet {

    /**
     * Generate cheat sheet HTML from field definitions.
     * MUST match the exact output format of Generator::generate_data_cheat_sheet()
     * (lines 1480-1543) since the React editor renders this HTML directly.
     *
     * @param array $fields Field definitions array from config.json
     * @return string HTML cheat sheet
     */
    public function generate( $fields ) {
        if ( empty( $fields ) || ! is_array( $fields ) ) {
            return '<p>No fields defined yet.</p>';
        }

        $lines = array();
        $lines[] = '<h3>Field Cheat Sheet</h3>';
        $lines[] = '<p>Copy these snippets into your <strong>Render Template</strong> or <strong>Canvas Template</strong>.</p>';
        $lines[] = '<hr>';

        foreach ( $fields as $field ) {
            $key   = $field['key'];
            $label = $field['label'];
            $type  = $field['type'];

            $lines[] = "<div style='margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;'>";
            $lines[] = "<strong>$label ($key) - $type</strong><br>";

            if ( $type === 'repeater' ) {
                $lines[] = '<em>Loop:</em><br>';
                $lines[] = "<code>{{#each $key}}</code><br>";

                if ( isset( $field['subFields'] ) ) {
                    foreach ( $field['subFields'] as $sub ) {
                        $sKey  = $sub['key'];
                        $sType = $sub['type'];

                        if ( $sType === 'gallery' ) {
                            $lines[] = '&nbsp;&nbsp; <em>Gallery Loop:</em><br>';
                            $lines[] = "&nbsp;&nbsp; <code>{{#each $sKey}}</code><br>";
                            $lines[] = '&nbsp;&nbsp;&nbsp;&nbsp; &lt;img src="{{url}}" alt="{{alt}}" /&gt;<br>';
                            $lines[] = "&nbsp;&nbsp; <code>{{/each}}</code><br>";
                        } else {
                            $lines[] = "&nbsp;&nbsp; {{{$sKey}}} <small>($sType)</small><br>";
                            if ( $sType === 'image' || $sType === 'file' ) {
                                $lines[] = "&nbsp;&nbsp; {{{$sKey}_alt}} <small>(Alt Text)</small><br>";
                            }
                        }
                    }
                }

                $lines[] = '<code>{{/each}}</code>';
            } elseif ( $type === 'gallery' ) {
                $lines[] = '<em>Loop (Gallery):</em><br>';
                $lines[] = "<code>{{#each $key}}</code><br>";
                $lines[] = '&nbsp;&nbsp; &lt;img src="{{url}}" alt="{{alt}}" /&gt;<br>';
                $lines[] = '<code>{{/each}}</code>';
            } elseif ( $type === 'image' || $type === 'file' ) {
                $lines[] = "URL: <code>{{{$key}}}</code><br>";
                $lines[] = "Alt/Filename: <code>{{{$key}_alt}}</code>";
            } else {
                $lines[] = "Value: <code>{{{$key}}}</code>";
            }

            $lines[] = '</div>';
        }

        return implode( "\n", $lines );
    }

    /**
     * Write cheat_sheet.html file to block directory.
     *
     * @param string $slug Block slug
     * @param array  $fields Field definitions
     */
    public function write( $slug, $fields ) {
        $html = $this->generate( $fields );
        $file_path = BLOCKS_BASE_PATH . $slug . '/cheat_sheet.html';

        global $wp_filesystem;
        if ( ! $wp_filesystem ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            WP_Filesystem();
        }
        if ( $wp_filesystem ) {
            $wp_filesystem->put_contents( $file_path, $html, FS_CHMOD_FILE );
        }
    }

}
```

**Important:** After creating this file, compare the output of `CheatSheet::generate()` against the output of the original `Generator::generate_data_cheat_sheet()` (lines 1480-1543) for an existing block. The HTML format must match exactly since the React editor renders this HTML directly. Adjust the implementation to match the original output format precisely.

- [ ] **Step 2: Create ConfigManager class**

Extract `handle_save_structure()` (Generator lines 142-258), `backup_block_files()` (lines 1569-1591), `restore_from_backup()` (lines 1596-1609), `cleanup_backup()` (lines 1614-1619), and `get_filesystem()` (lines 1553-1563).

Create `includes/class-gutenkit-config-manager.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_ConfigManager {

    private $cheat_sheet = null;
    private $generator = null; // Temporary: holds Generator reference for transition period

    public function __construct() {
        add_action( 'wp_ajax_block_factory_save_structure', array( $this, 'handle_save_structure' ) );
    }

    /**
     * Inject CheatSheet dependency.
     */
    public function set_cheat_sheet( GutenKit_CheatSheet $cheat_sheet ) {
        $this->cheat_sheet = $cheat_sheet;
    }

    /**
     * Temporary: Set Generator reference for transition period.
     * Remove after Task 5 when Generator is deleted.
     */
    public function set_generator( $generator ) {
        $this->generator = $generator;
    }

    /**
     * AJAX handler for saving block structure.
     * Validates nonce/permissions, saves config, returns cheat sheet.
     *
     * Port of Generator::handle_save_structure() lines 142-258
     */
    public function handle_save_structure() {
        // IMPORTANT: nonce action must match what wp_create_nonce() uses in class-gutenkit-admin.php line 101
        if (
            ! isset( $_POST['nonce'] ) ||
            ! wp_verify_nonce( $_POST['nonce'], 'block_factory_save_structure_action' ) ||
            ! current_user_can( 'manage_options' )
        ) {
            wp_send_json_error( array( 'message' => 'Security check failed.' ) );
        }

        $block_slug  = isset( $_POST['block_slug'] ) ? sanitize_title( $_POST['block_slug'] ) : '';
        $config_data = isset( $_POST['config_data'] ) ? json_decode( wp_unslash( $_POST['config_data'] ), true ) : null;

        if ( empty( $block_slug ) || empty( $config_data ) ) {
            wp_send_json_error( 'Missing block slug or config data.' );
        }

        // Save config
        $result = $this->save( $block_slug, $config_data );
        if ( is_wp_error( $result ) ) {
            wp_send_json_error( $result->get_error_message() );
        }

        // TRANSITION: Call Generator for file regeneration until Tasks 4-5 remove this
        if ( $this->generator && method_exists( $this->generator, 'regenerate_files_from_config' ) ) {
            $this->generator->regenerate_files_from_config( $block_slug, $config_data );
        }

        // Generate cheat sheet
        $cheat_html = '';
        if ( $this->cheat_sheet && ! empty( $config_data['fields'] ) ) {
            $cheat_html = $this->cheat_sheet->generate( $config_data['fields'] );
            $this->cheat_sheet->write( $block_slug, $config_data['fields'] );
        }

        $this->delete_transient_cache();

        wp_send_json_success( array(
            'message'    => 'Structure saved successfully.',
            'cheatSheet' => $cheat_html,
        ) );
    }

    /**
     * Save config.json for a block. Merges incoming data with existing config
     * to preserve keys like `scripts` that the editor doesn't send.
     *
     * @param string $slug       Block slug
     * @param array  $configData Incoming config (fields, template, css)
     * @return true|WP_Error
     */
    public function save( $slug, $configData ) {
        $config_path = BLOCKS_BASE_PATH . $slug . '/config.json';

        $filesystem = $this->get_filesystem();
        if ( ! $filesystem ) {
            return new WP_Error( 'filesystem', 'Could not initialize WP_Filesystem.' );
        }

        // Load existing config to merge (preserves `scripts` key)
        $existing = array();
        if ( $filesystem->exists( $config_path ) ) {
            $existing = json_decode( $filesystem->get_contents( $config_path ), true );
            if ( ! is_array( $existing ) ) {
                $existing = array();
            }
        }

        // Merge: incoming keys override, but preserve keys not sent by editor
        $merged = array_merge( $existing, $configData );

        // Config hash check — skip write if unchanged
        $new_hash = md5( wp_json_encode( $merged ) );
        $hash_path = BLOCKS_BASE_PATH . $slug . '/.config_hash';
        if ( $filesystem->exists( $hash_path ) ) {
            $old_hash = trim( $filesystem->get_contents( $hash_path ) );
            if ( $old_hash === $new_hash ) {
                return true; // No changes
            }
        }

        // Backup before write
        $this->backup( $slug );

        // Acquire file lock using separate .lock file (mutex pattern).
        // We use a .lock file because flock() and WP_Filesystem write through
        // different file descriptors — locking config.json directly wouldn't
        // protect the WP_Filesystem put_contents call.
        $json = wp_json_encode( $merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
        $lock_path = BLOCKS_BASE_PATH . $slug . '/.config.lock';
        $lock_handle = fopen( $lock_path, 'w' );
        if ( ! $lock_handle ) {
            $this->restore( $slug );
            return new WP_Error( 'lock', 'Could not create lock file.' );
        }

        if ( ! flock( $lock_handle, LOCK_EX ) ) {
            fclose( $lock_handle );
            $this->restore( $slug );
            return new WP_Error( 'lock', 'Could not acquire file lock.' );
        }

        $write_result = $filesystem->put_contents( $config_path, $json, FS_CHMOD_FILE );
        flock( $lock_handle, LOCK_UN );
        fclose( $lock_handle );

        if ( ! $write_result ) {
            $this->restore( $slug );
            return new WP_Error( 'write', 'Failed to write config.json.' );
        }

        // Update hash
        $filesystem->put_contents( $hash_path, $new_hash, FS_CHMOD_FILE );

        // Cleanup backup on success
        $this->cleanup_backup( $slug );

        return true;
    }

    /**
     * Load and parse config.json for a block.
     *
     * @param string $slug Block slug
     * @return array|null Config data or null if not found
     */
    public function load( $slug ) {
        $config_path = BLOCKS_BASE_PATH . $slug . '/config.json';
        $filesystem = $this->get_filesystem();
        if ( ! $filesystem || ! $filesystem->exists( $config_path ) ) {
            return null;
        }
        $data = json_decode( $filesystem->get_contents( $config_path ), true );
        return is_array( $data ) ? $data : null;
    }

    /**
     * Validate config data structure.
     *
     * @param array $config Config data
     * @return true|WP_Error
     */
    public function validate( $config ) {
        if ( ! is_array( $config ) ) {
            return new WP_Error( 'invalid', 'Config must be an array.' );
        }
        if ( ! isset( $config['fields'] ) || ! is_array( $config['fields'] ) ) {
            return new WP_Error( 'invalid', 'Config must contain a fields array.' );
        }
        $known_types = array( 'text', 'textarea', 'number', 'range', 'email', 'url',
            'image', 'file', 'gallery', 'date', 'time', 'datetime', 'color',
            'icon', 'button', 'contentEditor', 'repeater', 'relational' );
        foreach ( $config['fields'] as $field ) {
            if ( empty( $field['type'] ) || ! in_array( $field['type'], $known_types, true ) ) {
                return new WP_Error( 'invalid', 'Unknown field type: ' . ( $field['type'] ?? 'empty' ) );
            }
        }
        return true;
    }

    public function delete_transient_cache() {
        delete_transient( 'gutenkit_blocks_cache' );
    }

    // --- Backup / Restore (ported from Generator lines 1569-1619) ---

    private function backup( $slug ) {
        $source_dir = BLOCKS_BASE_PATH . $slug . '/';
        $backup_dir = BLOCKS_BASE_PATH . $slug . '/.backup_' . time() . '/';
        $files = array( 'config.json' );
        $this->backup_block_files( $source_dir, $backup_dir, $files );
        // Store backup path for restore
        $this->_backup_dir = $backup_dir;
        $this->_backup_source = $source_dir;
        $this->_backup_files = $files;
    }

    private function restore( $slug ) {
        if ( ! empty( $this->_backup_dir ) ) {
            $this->restore_from_backup( $this->_backup_dir, $this->_backup_source, $this->_backup_files );
            $this->cleanup_backup_dir( $this->_backup_dir );
        }
    }

    private function cleanup_backup( $slug ) {
        if ( ! empty( $this->_backup_dir ) ) {
            $this->cleanup_backup_dir( $this->_backup_dir );
        }
    }

    private function backup_block_files( $source_dir, $backup_dir, array $files ) {
        $filesystem = $this->get_filesystem();
        if ( ! $filesystem ) return;
        if ( ! $filesystem->is_dir( $backup_dir ) ) {
            $filesystem->mkdir( $backup_dir, FS_CHMOD_DIR );
        }
        foreach ( $files as $file ) {
            if ( $filesystem->exists( $source_dir . $file ) ) {
                $filesystem->copy( $source_dir . $file, $backup_dir . $file, true );
            }
        }
    }

    private function restore_from_backup( $backup_dir, $target_dir, array $files ) {
        $filesystem = $this->get_filesystem();
        if ( ! $filesystem ) return;
        foreach ( $files as $file ) {
            if ( $filesystem->exists( $backup_dir . $file ) ) {
                $filesystem->copy( $backup_dir . $file, $target_dir . $file, true );
            }
        }
    }

    private function cleanup_backup_dir( $backup_dir ) {
        $filesystem = $this->get_filesystem();
        if ( $filesystem && $filesystem->is_dir( $backup_dir ) ) {
            $filesystem->delete( $backup_dir, true );
        }
    }

    private function get_filesystem() {
        global $wp_filesystem;
        if ( ! $wp_filesystem ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            WP_Filesystem();
        }
        return $wp_filesystem ?: null;
    }
}
```

- [ ] **Step 3: Wire new classes into Loader and create transition bridge**

Modify `includes/class-gutenkit-loader.php`:

In `includes()` add:
```php
require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-cheat-sheet.php';
require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-config-manager.php';
```

In `init_hooks()` add (BEFORE Generator instantiation):
```php
$cheat_sheet = new GutenKit_CheatSheet();
$config_manager = new GutenKit_ConfigManager();
$config_manager->set_cheat_sheet( $cheat_sheet );
```

Modify `includes/class-gutenkit-generator.php`:
- Remove the `wp_ajax_block_factory_save_structure` hook registration from `__construct()` (line 20) — ConfigManager now owns it.
- Remove `handle_save_structure()` method (lines 142-258).
- Remove `generate_data_cheat_sheet()` method (lines 1480-1543).
- Remove `backup_block_files()`, `restore_from_backup()`, `cleanup_backup()` (lines 1569-1619).
- Remove `get_filesystem()` (lines 1553-1563).
- Create a public transitional method `regenerate_files_from_config($slug, $config_data)` that calls the existing private generation methods (update_block_json, regenerate_edit_js, generate_render_php, inject_script_base_css). This is temporary — removed in Task 5.

Wire the Generator into ConfigManager for the transition:
```php
// In Loader init_hooks(), after both are instantiated:
$config_manager->set_generator( $this->generator );
```

- [ ] **Step 4: Verify save flow works**

Run: Open WordPress admin → Block Factory → edit an existing block.
Run: Change a field label → click Save.
Expected: Save succeeds, cheat sheet appears, no PHP errors.
Run: Click "Build" → verify npm build succeeds.
Run: View the block on the frontend → verify it renders correctly.

- [ ] **Step 5: Commit**

```bash
git add includes/class-gutenkit-cheat-sheet.php includes/class-gutenkit-config-manager.php includes/class-gutenkit-loader.php includes/class-gutenkit-generator.php
git commit -m "refactor: extract ConfigManager and CheatSheet from Generator"
```

---

## Task 3: Extract BlockCreator + BlockBuilder

**Files:**
- Create: `includes/class-gutenkit-block-creator.php`
- Create: `includes/class-gutenkit-block-builder.php`
- Modify: `includes/class-gutenkit-loader.php` (require + wire)
- Modify: `includes/class-gutenkit-generator.php` (remove handle_create_block, handle_delete_block, handle_run_build, handle_install_dependencies)

- [ ] **Step 1: Create BlockCreator class**

Extract `handle_create_block()` (Generator lines 29-137), `handle_delete_block()` (lines 263-307), `delete_dir_recursive()` (lines 1632-1647), and `log_generator_error()` (lines 1624-1630).

Create `includes/class-gutenkit-block-creator.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_BlockCreator {

    public function __construct() {
        add_action( 'admin_post_block_factory_generate', array( $this, 'handle_create_block' ) );
        add_action( 'wp_ajax_block_factory_delete_block', array( $this, 'handle_delete_block' ) );
    }

    /**
     * Handle new block creation from admin form POST.
     * Port of Generator::handle_create_block() lines 30-137.
     *
     * Nonce: 'block_factory_action' verified via 'block_factory_nonce' POST field
     * (set by admin/generator-form.php).
     */
    public function handle_create_block() {
        if (
            ! isset( $_POST['block_factory_nonce'] ) ||
            ! wp_verify_nonce( $_POST['block_factory_nonce'], 'block_factory_action' ) ||
            ! current_user_can( 'manage_options' )
        ) {
            wp_die( 'Security check failed.' );
        }

        // Read form inputs — exact same field names as generator-form.php
        $component_name = sanitize_text_field( $_POST['component_name'] ?? '' );
        $component_icon = sanitize_text_field( $_POST['component_icon'] ?? 'smiley' );
        $script_type    = sanitize_text_field( $_POST['script_type'] ?? 'none' );

        if ( empty( $component_name ) ) {
            wp_die( 'Component name is required.' );
        }

        $slug = sanitize_title( $component_name );
        $block_dir = BLOCKS_BASE_PATH . $slug;

        if ( is_dir( $block_dir ) ) {
            wp_redirect( admin_url( 'admin.php?page=block-factory&error=exists' ) );
            exit;
        }

        // Copy template files from templates/*.tpl → blocks/{slug}/*
        // Port the EXACT file-by-file template copying and placeholder replacement
        // from Generator lines 60-130. The key placeholders are:
        //   __COMPONENT_NAME__       → $component_name
        //   __COMPONENT_SLUG__       → $slug
        //   __COMPONENT_NAME_PASCAL__ → PascalCase version
        //   __COMPONENT_ICON__       → $component_icon
        //
        // Template files to copy:
        //   templates/block.json.tpl    → blocks/{slug}/block.json
        //   templates/index.js.tpl      → blocks/{slug}/index.js
        //   templates/edit.js.tpl       → blocks/{slug}/edit.js
        //   templates/save.js.tpl       → blocks/{slug}/save.js
        //   templates/style.scss.tpl    → blocks/{slug}/style.scss
        //   templates/editor.scss.tpl   → blocks/{slug}/editor.scss
        //   templates/config.json.tpl   → blocks/{slug}/config.json
        //   templates/render.php.tpl    → blocks/{slug}/render.php
        //
        // If script_type !== 'none', inject scripts config into config.json.
        //
        // IMPORTANT: Copy the complete logic from Generator::handle_create_block()
        // lines 60-130 including all placeholder replacements and script config
        // injection. Do not simplify or rewrite — preserve exact behavior.

        mkdir( $block_dir, 0755, true );

        $pascal_name = str_replace( ' ', '', ucwords( str_replace( '-', ' ', $slug ) ) );
        $templates_dir = BLOCK_FACTORY_PATH . 'templates/';
        $template_map = array(
            'block.json.tpl'   => 'block.json',
            'index.js.tpl'     => 'index.js',
            'edit.js.tpl'      => 'edit.js',
            'save.js.tpl'      => 'save.js',
            'style.scss.tpl'   => 'style.scss',
            'editor.scss.tpl'  => 'editor.scss',
            'config.json.tpl'  => 'config.json',
            'render.php.tpl'   => 'render.php',
        );

        foreach ( $template_map as $tpl => $output ) {
            $tpl_path = $templates_dir . $tpl;
            if ( ! file_exists( $tpl_path ) ) continue;
            $content = file_get_contents( $tpl_path );
            $content = str_replace(
                array( '__COMPONENT_NAME__', '__COMPONENT_SLUG__', '__COMPONENT_NAME_PASCAL__', '__COMPONENT_ICON__' ),
                array( $component_name, $slug, $pascal_name, $component_icon ),
                $content
            );
            file_put_contents( $block_dir . '/' . $output, $content );
        }

        // Inject script config if not 'none'
        if ( $script_type !== 'none' ) {
            $config_path = $block_dir . '/config.json';
            $config = json_decode( file_get_contents( $config_path ), true ) ?: array();
            $config['scripts'] = array( 'type' => $script_type );
            file_put_contents( $config_path, wp_json_encode( $config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
        }

        delete_transient( 'gutenkit_blocks_cache' );

        wp_redirect( admin_url( 'admin.php?page=block-factory&action=edit_structure&block_slug=' . $slug ) );
        exit;
    }

    /**
     * Handle block deletion via AJAX.
     * Port of Generator::handle_delete_block() lines 263-307.
     *
     * Nonce: 'block_factory_nonce' verified via 'nonce' POST field
     * (sent by assets/js/admin.js).
     */
    public function handle_delete_block() {
        if (
            ! isset( $_POST['nonce'] ) ||
            ! wp_verify_nonce( $_POST['nonce'], 'block_factory_nonce' ) ||
            ! current_user_can( 'manage_options' )
        ) {
            wp_send_json_error( 'Security check failed.' );
        }

        $block_slug = sanitize_title( $_POST['block_slug'] ?? '' );
        if ( empty( $block_slug ) ) {
            wp_send_json_error( 'Missing block slug.' );
        }

        // Delete from both source and build directories
        $source_dir = BLOCKS_BASE_PATH . $block_slug;
        $build_dir  = BUILD_BASE_PATH . $block_slug;

        if ( is_dir( $source_dir ) ) {
            $this->delete_dir_recursive( $source_dir );
        }
        if ( is_dir( $build_dir ) ) {
            $this->delete_dir_recursive( $build_dir );
        }

        delete_transient( 'gutenkit_blocks_cache' );
        wp_send_json_success( array( 'message' => 'Block deleted.' ) );
    }

    /**
     * Recursively delete a directory.
     * Port of Generator::delete_dir_recursive() lines 1632-1647.
     */
    public function delete_dir_recursive( $dir ) {
        if ( ! is_dir( $dir ) ) return;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS ),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ( $iterator as $file ) {
            if ( $file->isDir() ) {
                rmdir( $file->getRealPath() );
            } else {
                unlink( $file->getRealPath() );
            }
        }
        rmdir( $dir );
    }

    /**
     * Log an error to the plugin debug log.
     * Port of Generator::log_generator_error() lines 1624-1630.
     */
    public static function log_error( $context, $message ) {
        $log_file = BLOCK_FACTORY_PATH . 'gutenkit-debug.log';
        $timestamp = current_time( 'Y-m-d H:i:s' );
        error_log( "[{$timestamp}] [{$context}] {$message}\n", 3, $log_file );
    }
}
```

**Important:** Port the methods exactly — copy the logic line-by-line from the Generator, only changing `$this->` references to use the new class context. The `log_error` method is made static so other classes can call `GutenKit_BlockCreator::log_error()`.

- [ ] **Step 2: Create BlockBuilder class with proc_open timeout**

Extract `handle_run_build()` (Generator lines 312-350) and `handle_install_dependencies()` (lines 1740-1799).

Create `includes/class-gutenkit-block-builder.php`:

```php
<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_BlockBuilder {

    private $node_env;
    private $timeout;

    /**
     * @param GutenKit_NodeEnvironment $node_env
     * @param int                      $timeout  Process timeout in seconds (default 120)
     */
    public function __construct( GutenKit_NodeEnvironment $node_env, $timeout = 120 ) {
        $this->node_env = $node_env;
        $this->timeout  = $timeout;

        add_action( 'wp_ajax_bf_run_npm_build', array( $this, 'handle_run_build' ) );
        add_action( 'wp_ajax_bf_install_dependencies', array( $this, 'handle_install_dependencies' ) );
    }

    /**
     * AJAX handler: run npm build.
     * Port of Generator::handle_run_build() lines 312-350.
     * Uses proc_open with timeout instead of exec().
     */
    public function handle_run_build() {
        check_ajax_referer( 'block_factory_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Insufficient permissions.' );
        }

        $env = $this->node_env->detect();
        if ( ! $env['npm_cmd'] ) {
            wp_send_json_error( 'npm not found. Define WP_BLOCK_FACTORY_NODE_PATH in wp-config.php.' );
        }

        $cmd = 'cd ' . escapeshellarg( BLOCK_FACTORY_PATH ) . ' && ' . $env['npm_cmd'] . ' run build 2>&1';
        $result = $this->exec_with_timeout( $cmd, $this->timeout );

        if ( $result['timed_out'] ) {
            wp_send_json_error( 'Build timed out after ' . $this->timeout . ' seconds.' );
        }

        delete_transient( 'gutenkit_blocks_cache' );

        if ( $result['exit_code'] !== 0 ) {
            wp_send_json_error( 'Build failed: ' . $result['output'] );
        }

        wp_send_json_success( array(
            'message' => 'Build completed successfully.',
            'output'  => $result['output'],
        ) );
    }

    /**
     * AJAX handler: install npm dependencies.
     * Port of Generator::handle_install_dependencies() lines 1740-1799.
     */
    public function handle_install_dependencies() {
        check_ajax_referer( 'block_factory_nonce', 'nonce' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_send_json_error( 'Insufficient permissions.' );
        }

        $env = $this->node_env->detect();
        if ( ! $env['npm_cmd'] ) {
            wp_send_json_error( 'npm not found.' );
        }

        // Check hash to avoid unnecessary installs
        $hash_file = BLOCK_FACTORY_PATH . '.npm_hash';
        $pkg_file  = BLOCK_FACTORY_PATH . 'package.json';
        $current_hash = file_exists( $pkg_file ) ? md5_file( $pkg_file ) : '';
        $stored_hash  = file_exists( $hash_file ) ? trim( file_get_contents( $hash_file ) ) : '';

        if ( $current_hash === $stored_hash && is_dir( BLOCK_FACTORY_PATH . 'node_modules' ) ) {
            wp_send_json_success( array( 'message' => 'Dependencies already up to date.' ) );
        }

        $cmd = 'cd ' . escapeshellarg( BLOCK_FACTORY_PATH ) . ' && ' . $env['npm_cmd'] . ' install 2>&1';
        $result = $this->exec_with_timeout( $cmd, $this->timeout );

        if ( $result['timed_out'] ) {
            wp_send_json_error( 'Install timed out after ' . $this->timeout . ' seconds.' );
        }

        if ( $result['exit_code'] !== 0 ) {
            wp_send_json_error( 'Install failed: ' . $result['output'] );
        }

        // Store hash on success
        file_put_contents( $hash_file, $current_hash );

        wp_send_json_success( array(
            'message' => 'Dependencies installed successfully.',
            'output'  => $result['output'],
        ) );
    }

    /**
     * Execute a shell command with timeout using proc_open.
     * Cross-platform: uses taskkill on Windows, kill on Unix.
     *
     * @param string $cmd     Command to execute
     * @param int    $timeout Timeout in seconds
     * @return array { 'output' => string, 'exit_code' => int, 'timed_out' => bool }
     */
    private function exec_with_timeout( $cmd, $timeout ) {
        $descriptors = array(
            0 => array( 'pipe', 'r' ),  // stdin
            1 => array( 'pipe', 'w' ),  // stdout
            2 => array( 'pipe', 'w' ),  // stderr
        );

        $env_vars = null;
        $node_dir = $this->node_env->get_node_dir();
        if ( $node_dir ) {
            $env_vars = array_merge( $_ENV, array(
                'PATH' => $node_dir . PATH_SEPARATOR . getenv( 'PATH' ),
            ) );
        }

        $process = proc_open( $cmd, $descriptors, $pipes, BLOCK_FACTORY_PATH, $env_vars );

        if ( ! is_resource( $process ) ) {
            return array( 'output' => 'Failed to start process.', 'exit_code' => -1, 'timed_out' => false );
        }

        fclose( $pipes[0] ); // Close stdin

        // Set stdout/stderr to non-blocking
        stream_set_blocking( $pipes[1], false );
        stream_set_blocking( $pipes[2], false );

        $output    = '';
        $start     = time();
        $timed_out = false;

        while ( true ) {
            $status = proc_get_status( $process );
            if ( ! $status['running'] ) {
                break;
            }
            if ( ( time() - $start ) >= $timeout ) {
                $timed_out = true;
                $pid = $status['pid'];
                // Kill the process tree
                if ( PHP_OS_FAMILY === 'Windows' ) {
                    exec( "taskkill /T /F /PID {$pid} 2>NUL" );
                } else {
                    exec( "kill -9 {$pid} 2>/dev/null" );
                }
                break;
            }
            $output .= stream_get_contents( $pipes[1] );
            $output .= stream_get_contents( $pipes[2] );
            usleep( 100000 ); // 100ms
        }

        // Read remaining output
        $output .= stream_get_contents( $pipes[1] );
        $output .= stream_get_contents( $pipes[2] );

        fclose( $pipes[1] );
        fclose( $pipes[2] );

        $exit_code = proc_close( $process );

        return array(
            'output'    => trim( $output ),
            'exit_code' => $timed_out ? -1 : $exit_code,
            'timed_out' => $timed_out,
        );
    }
}
```

- [ ] **Step 3: Wire new classes into Loader, strip Generator**

Modify `includes/class-gutenkit-loader.php` `includes()`:
```php
require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-block-creator.php';
require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-block-builder.php';
```

Modify `init_hooks()`:
```php
$block_creator = new GutenKit_BlockCreator();
$block_builder = new GutenKit_BlockBuilder( $this->node_env );
```

Modify `includes/class-gutenkit-generator.php`:
- Remove these hook registrations from `__construct()`: `admin_post_block_factory_generate` (line 17), `wp_ajax_block_factory_delete_block` (line 21), `wp_ajax_bf_run_npm_build` (line 22), `wp_ajax_bf_install_dependencies` (line 23).
- Remove methods: `handle_create_block()`, `handle_delete_block()`, `handle_run_build()`, `handle_install_dependencies()`, `delete_dir_recursive()`, `log_generator_error()`.
- Generator now only contains: the transitional `regenerate_files_from_config()` and the private generation methods (update_block_json, regenerate_edit_js, generate_render_php, generate_inspector_controls, generate_canvas_preview, generate_editor_effect, get_script_import, inject_script_base_css).

- [ ] **Step 4: Verify all flows work**

Run: Create a new block from dashboard → verify block directory created with all template files.
Run: Delete a block → verify block directory removed.
Run: Click "Build" → verify build completes (now with proc_open timeout).
Run: Click "Install Dependencies" → verify npm install works.
Run: Edit a block → Save → verify config saves and cheat sheet returns.

- [ ] **Step 5: Commit**

```bash
git add includes/class-gutenkit-block-creator.php includes/class-gutenkit-block-builder.php includes/class-gutenkit-loader.php includes/class-gutenkit-generator.php
git commit -m "refactor: extract BlockCreator and BlockBuilder from Generator

BlockBuilder now uses proc_open with 120s timeout instead of exec()."
```

---

## Task 4: Port render.php Generation to Node.js

**Files:**
- Modify: `generate-block-code-multi.js` (add generateRenderPhp, add field key validation)
- Modify: `includes/class-gutenkit-generator.php` (remove generate_render_php)

- [ ] **Step 1: Add field key validation to generate-block-code-multi.js**

Add at the top of the `generateBlock()` function (after config is loaded, ~line 295):

```javascript
// Field key validation (security: prevents code injection)
const VALID_KEY = /^[a-z][a-z0-9_]*$/;

function validateFieldKeys(fields, blockPath) {
    for (const field of fields) {
        if (!VALID_KEY.test(field.key)) {
            throw new Error(`Invalid field key "${field.key}" in ${blockPath}. Keys must match /^[a-z][a-z0-9_]*$/`);
        }
        if (field.subFields) {
            for (const sub of field.subFields) {
                if (!VALID_KEY.test(sub.key)) {
                    throw new Error(`Invalid sub-field key "${sub.key}" in repeater "${field.key}" in ${blockPath}`);
                }
            }
        }
    }
}
```

Call it in `generateBlock()` after reading config:
```javascript
validateFieldKeys(config.fields, blockPath);
```

- [ ] **Step 2: Add generateRenderPhp() to generate-block-code-multi.js**

This ports the logic from PHP `Generator::generate_render_php()` (lines 1265-1478). Add this function before `generateBlock()`:

```javascript
/**
 * Generate render.php from config template.
 * Converts Mustache {{field}} to PHP echo with proper escaping.
 *
 * Escaping rules:
 *   text/number/date/time/icon → esc_html()
 *   url, image.url, file.url  → esc_url()
 *   image.alt, file.filename  → esc_attr()
 *   contentEditor             → wp_kses_post()
 *   color                     → esc_attr()
 *   button.url                → esc_url()
 *   button.text               → esc_html()
 *
 * @param {object} config  Block config with fields, template, css
 * @param {string} blockPath  Absolute path to block directory
 * @param {string} blockSlug  Block slug (kebab-case)
 */
function generateRenderPhp(config, blockPath, blockSlug) {
    if (!config.template) return;

    const fields = config.fields || [];
    let template = config.template;

    // Build field type lookup
    const fieldTypes = {};
    fields.forEach(f => {
        fieldTypes[f.key] = f.type;
        if (f.subFields) {
            f.subFields.forEach(sf => {
                fieldTypes[`${f.key}.${sf.key}`] = sf.type;
            });
        }
    });

    // Helper: get PHP escape function by field type and context
    function getEscape(fieldKey, context) {
        const type = fieldTypes[fieldKey] || 'text';
        if (context === 'url' || type === 'url') return 'esc_url';
        if (context === 'attr' || type === 'color') return 'esc_attr';
        if (type === 'contentEditor') return 'wp_kses_post';
        if (type === 'image' || type === 'file') return 'esc_url'; // default for media is url
        return 'esc_html';
    }

    // Process {{#each key}}...{{/each}} loops
    // Also handle deprecated {{#key}}...{{/key}} with warning
    template = template.replace(
        /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
        (match, key, inner) => {
            const type = fieldTypes[key];
            let phpInner = processInnerTemplate(inner, key, fields);
            return `<?php if(!empty($attributes['${key}']) && is_array($attributes['${key}'])): ?>\n` +
                   `<?php foreach($attributes['${key}'] as $item): ?>\n` +
                   phpInner +
                   `<?php endforeach; ?>\n` +
                   `<?php endif; ?>`;
        }
    );

    // Deprecated syntax: {{#key}}...{{/key}} — warn but still process
    template = template.replace(
        /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
        (match, key, inner) => {
            console.warn(`[Block Factory] DEPRECATED: Block "${blockSlug}" uses {{#${key}}} syntax. Migrate to {{#each ${key}}}...{{/each}}`);
            let phpInner = processInnerTemplate(inner, key, fields);
            return `<?php if(!empty($attributes['${key}']) && is_array($attributes['${key}'])): ?>\n` +
                   `<?php foreach($attributes['${key}'] as $item): ?>\n` +
                   phpInner +
                   `<?php endforeach; ?>\n` +
                   `<?php endif; ?>`;
        }
    );

    // Process button fields: {{key_text}} and {{key_url}}
    fields.filter(f => f.type === 'button').forEach(f => {
        const k = f.key;
        template = template.replace(
            new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
            `<?php if ( ! empty( $attributes['${k}']['url'] ) ): ?>\n` +
            `<a href="<?php echo esc_url( $attributes['${k}']['url'] ); ?>" class="gk-btn">\n` +
            `  <?php echo esc_html( $attributes['${k}']['text'] ?? 'Click Here' ); ?>\n` +
            `</a>\n<?php endif; ?>`
        );
        template = template.replace(new RegExp(`\\{\\{${k}_url\\}\\}`, 'g'),
            `<?php echo esc_url( $attributes['${k}']['url'] ?? '' ); ?>`);
        template = template.replace(new RegExp(`\\{\\{${k}_text\\}\\}`, 'g'),
            `<?php echo esc_html( $attributes['${k}']['text'] ?? '' ); ?>`);
    });

    // Process image fields: {{key}} (url), {{key_alt}}
    fields.filter(f => f.type === 'image').forEach(f => {
        const k = f.key;
        template = template.replace(new RegExp(`\\{\\{${k}_alt\\}\\}`, 'g'),
            `<?php echo esc_attr( $attributes['${k}']['alt'] ?? '' ); ?>`);
        template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
            `<?php echo esc_url( $attributes['${k}']['url'] ?? '' ); ?>`);
    });

    // Process file fields: {{key}} (url), {{key_filename}}
    fields.filter(f => f.type === 'file').forEach(f => {
        const k = f.key;
        template = template.replace(new RegExp(`\\{\\{${k}_filename\\}\\}`, 'g'),
            `<?php echo esc_html( $attributes['${k}']['filename'] ?? '' ); ?>`);
        template = template.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'),
            `<?php echo esc_url( $attributes['${k}']['url'] ?? '' ); ?>`);
    });

    // Process contentEditor fields
    fields.filter(f => f.type === 'contentEditor').forEach(f => {
        template = template.replace(new RegExp(`\\{\\{${f.key}\\}\\}`, 'g'),
            `<?php echo wp_kses_post( $attributes['${f.key}'] ?? '' ); ?>`);
    });

    // Process color fields
    fields.filter(f => f.type === 'color').forEach(f => {
        template = template.replace(new RegExp(`\\{\\{${f.key}\\}\\}`, 'g'),
            `<?php echo esc_attr( $attributes['${f.key}'] ?? '' ); ?>`);
    });

    // Process remaining simple fields (text, number, date, time, etc.)
    template = template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        const type = fieldTypes[key] || 'text';
        const esc = getEscape(key, 'text');
        return `<?php echo ${esc}( $attributes['${key}'] ?? '' ); ?>`;
    });

    // Wrap in PHP template
    const renderPhp = `<?php
/**
 * Block render template.
 * Generated by Block Factory — do not edit manually.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Block inner content.
 * @var WP_Block $block      Block instance.
 */
if ( ! defined( 'ABSPATH' ) ) exit;
?>
<div class="bf-block-${blockSlug}" <?php echo get_block_wrapper_attributes(); ?>>
${template}
</div>
`;

    fs.writeFileSync(path.join(blockPath, 'render.php'), renderPhp);
}

/**
 * Process inner template content within a repeater/gallery loop.
 * Converts {{subkey}} to PHP $item references.
 */
function processInnerTemplate(inner, parentKey, fields) {
    const parent = fields.find(f => f.key === parentKey);
    if (!parent) return inner;

    let result = inner;

    // Gallery nested in repeater
    if (parent.subFields) {
        parent.subFields.filter(sf => sf.type === 'gallery').forEach(sf => {
            result = result.replace(
                new RegExp(`\\{\\{#each\\s+${sf.key}\\}\\}([\\s\\S]*?)\\{\\{/each\\}\\}`, 'g'),
                (m, galInner) => {
                    galInner = galInner.replace(/\{\{url\}\}/g, `<?php echo esc_url( $gItem['url'] ?? '' ); ?>`);
                    galInner = galInner.replace(/\{\{alt\}\}/g, `<?php echo esc_attr( $gItem['alt'] ?? '' ); ?>`);
                    galInner = galInner.replace(/\{\{id\}\}/g, `<?php echo esc_attr( $gItem['id'] ?? '' ); ?>`);
                    return `<?php if(!empty($item['${sf.key}'])): ?>\n<?php foreach($item['${sf.key}'] as $gItem): ?>\n${galInner}\n<?php endforeach; ?>\n<?php endif; ?>`;
                }
            );
        });

        // Image sub-fields
        parent.subFields.filter(sf => sf.type === 'image').forEach(sf => {
            result = result.replace(new RegExp(`\\{\\{${sf.key}_alt\\}\\}`, 'g'),
                `<?php echo esc_attr( $item['${sf.key}']['alt'] ?? '' ); ?>`);
            result = result.replace(new RegExp(`\\{\\{${sf.key}\\}\\}`, 'g'),
                `<?php echo esc_url( $item['${sf.key}']['url'] ?? '' ); ?>`);
        });

        // Button sub-fields
        parent.subFields.filter(sf => sf.type === 'button').forEach(sf => {
            result = result.replace(new RegExp(`\\{\\{${sf.key}_url\\}\\}`, 'g'),
                `<?php echo esc_url( $item['${sf.key}']['url'] ?? '' ); ?>`);
            result = result.replace(new RegExp(`\\{\\{${sf.key}_text\\}\\}`, 'g'),
                `<?php echo esc_html( $item['${sf.key}']['text'] ?? '' ); ?>`);
        });

        // ContentEditor sub-fields
        parent.subFields.filter(sf => sf.type === 'contentEditor').forEach(sf => {
            result = result.replace(new RegExp(`\\{\\{${sf.key}\\}\\}`, 'g'),
                `<?php echo wp_kses_post( $item['${sf.key}'] ?? '' ); ?>`);
        });
    }

    // Remaining sub-field tags → $item['key']
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return `<?php echo esc_html( $item['${key}'] ?? '' ); ?>`;
    });

    return result;
}
```

**Important:** After writing this, compare the output of `generateRenderPhp()` against the PHP-generated render.php for each existing block. They must produce functionally equivalent output. Differences in whitespace are acceptable; differences in escaping or structure are not.

- [ ] **Step 3: Call generateRenderPhp from generateBlock()**

In `generate-block-code-multi.js`, inside the `generateBlock()` function, add after the existing file generation (~line 465):

```javascript
// Generate render.php from template
generateRenderPhp(config, blockPath, blockSlug);
```

Where `blockSlug` is derived from the directory name (already available as the folder name).

- [ ] **Step 4: Remove generate_render_php from PHP Generator**

Modify `includes/class-gutenkit-generator.php`:
- Remove the `generate_render_php()` method (lines 1265-1478).
- In the transitional `regenerate_files_from_config()`, remove the call to `generate_render_php()`.

- [ ] **Step 5: Test render.php generation**

Run: `cd "C:\Users\Wac\Local Sites\gutenberg\app\public\wp-content\plugins\block-factory" && npm run build`
Expected: Build succeeds. Each block in `blocks/` now has a render.php generated by Node.js.

For each existing block:
Run: View the block on the frontend → verify it renders correctly with all field values.

- [ ] **Step 6: Commit**

```bash
git add generate-block-code-multi.js includes/class-gutenkit-generator.php
git commit -m "feat: port render.php generation to Node.js with field key validation

Render.php is now generated during npm build instead of PHP save.
Field keys are validated against /^[a-z][a-z0-9_]*$/ before generation.
Both {{#each key}} and {{#key}} syntax supported with deprecation warning."
```

---

## Task 5: Delete Generator

**Files:**
- Delete: `includes/class-gutenkit-generator.php`
- Modify: `includes/class-gutenkit-loader.php` (remove Generator require/instantiation)
- Modify: `includes/class-gutenkit-config-manager.php` (remove generator transition bridge)

- [ ] **Step 1: Remove Generator from ConfigManager**

In `includes/class-gutenkit-config-manager.php`:
- Remove the `$generator` property and `set_generator()` method.
- In `handle_save_structure()`, remove the transitional call to `$this->generator->regenerate_files_from_config()`.

- [ ] **Step 2: Remove Generator from Loader**

In `includes/class-gutenkit-loader.php`:
- Remove `require_once ... class-gutenkit-generator.php` from `includes()`.
- Remove `new GutenKit_Generator()` from `init_hooks()`.
- Remove `$config_manager->set_generator(...)` from `init_hooks()`.

- [ ] **Step 3: Delete Generator file**

```bash
rm includes/class-gutenkit-generator.php
```

- [ ] **Step 4: Verify full flow**

Run: Open WordPress admin → Block Factory → create a new block → define fields → save → write template → build.
Expected: Full flow works end-to-end with Generator completely gone.
Run: Frontend renders all existing blocks correctly.

- [ ] **Step 5: Commit**

```bash
git add includes/class-gutenkit-loader.php includes/class-gutenkit-config-manager.php
git rm includes/class-gutenkit-generator.php
git commit -m "refactor: delete GutenKit_Generator — all logic migrated

PHP save now only writes config.json and returns cheat sheet.
All file generation handled by Node.js during npm build."
```

---

## Task 6: Split editor-app.js

**Files:**
- Create: `src/utils/api.js`
- Create: `src/hooks/useBlockConfig.js`
- Create: `src/components/App.js`
- Create: `src/components/step-fields/FieldPalette.js`
- Create: `src/components/step-fields/FieldList.js`
- Create: `src/components/step-fields/FieldSettings.js`
- Create: `src/components/step-fields/RepeaterSettings.js`
- Create: `src/components/step-template/TemplateEditor.js`
- Create: `src/components/step-template/CSSEditor.js`
- Create: `src/components/step-template/LivePreview.js`
- Create: `src/components/step-template/AIGenerator.js`
- Create: `src/components/shared/DragDrop.js`
- Create: `src/components/shared/Validation.js`
- Create: `src/styles/*.scss` (8 files)
- Modify: `src/editor-app.js` (slim down to entry point)

This is the largest task. Each sub-step extracts one component and keeps the build working.

- [ ] **Step 1: Create utils/api.js**

Replace all `jQuery.post()` calls. Create `src/utils/api.js`:

```javascript
/**
 * Vanilla fetch wrappers for Block Factory AJAX calls.
 * Replaces jQuery.post with native fetch using admin-ajax.php.
 */

const { ajaxurl, nonce } = window.blockFactoryEditor || {};

function postAjax(action, data = {}) {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('nonce', nonce);
    Object.entries(data).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    });
    return fetch(ajaxurl, { method: 'POST', body: formData })
        .then(res => res.json())
        .then(res => {
            if (!res.success) throw new Error(res.data || 'Request failed');
            return res.data;
        });
}

export function saveStructure(blockSlug, configData) {
    const formData = new FormData();
    formData.append('action', 'block_factory_save_structure');
    formData.append('nonce', nonce);
    formData.append('block_slug', blockSlug);
    formData.append('config_data', JSON.stringify(configData));
    return fetch(ajaxurl, { method: 'POST', body: formData })
        .then(res => res.json());
}

export function runBuild() {
    return postAjax('bf_run_npm_build');
}

export function generateAITemplate(prompt, fields) {
    return postAjax('bf_generate_ai_template', { prompt, fields: JSON.stringify(fields) });
}
```

- [ ] **Step 2: Create hooks/useBlockConfig.js**

Extract all state management from editor-app.js (lines 154-174 state, lines 345-414 handleSave, lines 321-339 triggerBuild, lines 286-318 handleGenerateAI).

```javascript
import { useState } from '@wordpress/element';
import { saveStructure, runBuild, generateAITemplate } from '../utils/api';

export function useBlockConfig(initialConfig, blockSlug) {
    const [fields, setFields] = useState(initialConfig.fields || []);
    const [template, setTemplate] = useState(initialConfig.template || '');
    const [css, setCss] = useState(initialConfig.css || '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [cheatSheet, setCheatSheet] = useState(null);
    const [step, setStep] = useState(0);
    const [isGenerating, setIsGenerating] = useState(false);

    function handleSave(shouldBuild = false, nextStep = null) {
        // Port validation + save logic from editor-app.js lines 345-414
        // Use saveStructure() from api.js instead of jQuery.post
        setIsSaving(true);
        const configData = { fields, template, css };
        saveStructure(blockSlug, configData)
            .then(res => {
                if (res.success) {
                    setMessage(res.data.message);
                    if (res.data.cheatSheet) setCheatSheet(res.data.cheatSheet);
                    if (nextStep !== null) setStep(nextStep);
                    if (shouldBuild) triggerBuild();
                } else {
                    setMessage('Error: ' + (res.data || 'Save failed'));
                }
            })
            .catch(err => setMessage('Error: ' + err.message))
            .finally(() => setIsSaving(false));
    }

    function triggerBuild() {
        setMessage('Building...');
        runBuild()
            .then(data => setMessage(data.message || 'Build complete.'))
            .catch(err => setMessage('Build error: ' + err.message));
    }

    function handleGenerateAI(prompt) {
        setIsGenerating(true);
        generateAITemplate(prompt, fields)
            .then(data => {
                if (data.html) setTemplate(data.html);
                if (data.css) setCss(data.css);
            })
            .catch(err => setMessage('AI error: ' + err.message))
            .finally(() => setIsGenerating(false));
    }

    return {
        fields, setFields, template, setTemplate, css, setCss,
        isSaving, message, setMessage, cheatSheet,
        step, setStep, isGenerating,
        handleSave, triggerBuild, handleGenerateAI,
    };
}
```

- [ ] **Step 3: Create shared/Validation.js and shared/DragDrop.js**

`src/components/shared/Validation.js`:
```javascript
/**
 * Validate all fields. Returns { isValid, invalidFields }.
 * Port of validation logic from editor-app.js handleSave() lines 350-385.
 */
export function validateFields(fields) {
    const invalidFields = {};
    let isValid = true;
    fields.forEach((field, i) => {
        if (!field.label || !field.key) {
            invalidFields[i] = true;
            isValid = false;
        }
        if (field.type === 'repeater' && field.subFields) {
            field.subFields.forEach((sf, si) => {
                if (!sf.label || !sf.key) {
                    invalidFields[`${i}-${si}`] = true;
                    isValid = false;
                }
            });
        }
    });
    return { isValid, invalidFields };
}
```

`src/components/shared/DragDrop.js`:
```javascript
/**
 * Shared drag-drop handlers for field reordering.
 * Port of handleDragStart/Enter/Drop from editor-app.js lines 177-204.
 */
export function createDragHandlers(items, setItems, draggedRef) {
    return {
        onDragStart(e, index) {
            draggedRef.current = index;
            e.dataTransfer.effectAllowed = 'move';
        },
        onDragEnter(e, targetIndex) {
            e.preventDefault();
            const fromIndex = draggedRef.current;
            if (fromIndex === targetIndex) return;
            const updated = [...items];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(targetIndex, 0, moved);
            setItems(updated);
            draggedRef.current = targetIndex;
        },
        onDragOver(e) {
            e.preventDefault();
        },
        onDrop(e) {
            e.preventDefault();
            draggedRef.current = null;
        },
    };
}
```

- [ ] **Step 4: Create step-fields components**

Extract each component from editor-app.js. Each should be < 200 lines. Import from shared DragDrop and Validation. Port the exact rendering logic from the corresponding sections of editor-app.js.

Create these files — each one extracts a portion of the monolithic render:
- `src/components/step-fields/FieldPalette.js` — field type buttons (from the left 20% panel of Step 0)
- `src/components/step-fields/FieldList.js` — draggable field list (from the middle 40% of Step 0)
- `src/components/step-fields/FieldSettings.js` — settings panel for selected field (from renderSettings, lines 596-702)
- `src/components/step-fields/RepeaterSettings.js` — sub-field editor (from renderRepeaterSettings, lines 418-593)

Port the exact `createElement` calls from editor-app.js into each component. Convert inline styles to imported SCSS files.

- [ ] **Step 5: Create step-template components**

- `src/components/step-template/TemplateEditor.js` — HTML textarea + insertTagAtCursor (lines 266-283)
- `src/components/step-template/CSSEditor.js` — CSS textarea
- `src/components/step-template/LivePreview.js` — processTemplateForPreview (lines 107-146) + rendered div
- `src/components/step-template/AIGenerator.js` — AI prompt input + handleGenerateAI trigger

- [ ] **Step 6: Create App.js and slim down editor-app.js**

`src/components/App.js` — imports all components, uses `useBlockConfig` hook, renders Step 0 or Step 1 based on `step` state.

`src/editor-app.js` — slim entry point:
```javascript
import { render } from '@wordpress/element';
import App from './components/App';

const container = document.getElementById('block-factory-editor-root');
if (container) {
    const config = window.blockFactoryEditor?.config || {};
    const slug = window.blockFactoryEditor?.blockSlug || '';
    render(<App initialConfig={config} blockSlug={slug} />, container);
}
```

- [ ] **Step 7: Create SCSS style files**

Create `src/styles/` directory with 8 SCSS files. Extract inline styles from each component's `createElement` style attributes into the corresponding SCSS file. Import each SCSS file in its component.

- [ ] **Step 8: Rewrite assets/js/admin.js**

Replace jQuery with vanilla JS. Port the exact same functionality:
- Delete block button: `querySelector('.block-factory-delete-btn')` + `fetch()` instead of `$.post()`
- Install dependencies button: `querySelector('#bf-install-dependencies-btn')` + `fetch()`
- Dashicon picker: vanilla DOM manipulation instead of jQuery selectors

Use `window.blockFactoryAdmin.nonce` for nonce (same global).

- [ ] **Step 9: Verify build and functionality**

Run: `npm run build`
Expected: Build succeeds with no errors.

Run: Open Block Factory editor → define fields → save → write template → build.
Expected: Full wizard workflow works.

Run: Open Block Factory dashboard → delete a block → install dependencies.
Expected: Dashboard features work with vanilla JS admin.js.

- [ ] **Step 10: Commit**

```bash
git add src/ assets/js/admin.js
git commit -m "refactor: split editor-app.js into focused React components

Extracted 13 component files from monolithic 1125-line editor-app.js.
Replaced jQuery.post with vanilla fetch. Extracted inline styles to SCSS."
```

---

## Task 7: Security Fixes

**Files:**
- Modify: `includes/class-gutenkit-ai.php` (encrypt API keys)
- Modify: `includes/class-gutenkit-register.php` (remove shortcode)

- [ ] **Step 1: Add API key encryption to GutenKit_AI**

Modify `includes/class-gutenkit-ai.php`:

Add encryption helper methods:
```php
// Must be public — WordPress register_setting sanitize_callback requires callable
public function encrypt_key( $plaintext ) {
    $key    = substr( hash( 'sha256', wp_salt( 'auth' ) ), 0, 32 );
    $iv     = openssl_random_pseudo_bytes( 16 );
    $cipher = openssl_encrypt( $plaintext, 'AES-256-CBC', $key, 0, $iv );
    return base64_encode( $iv . $cipher );
}

private function decrypt_key( $encrypted ) {
    $key  = substr( hash( 'sha256', wp_salt( 'auth' ) ), 0, 32 );
    $data = base64_decode( $encrypted );
    if ( strlen( $data ) < 17 ) return ''; // Invalid
    $iv     = substr( $data, 0, 16 );
    $cipher = substr( $data, 16 );
    $result = openssl_decrypt( $cipher, 'AES-256-CBC', $key, 0, $iv );
    return $result !== false ? $result : '';
}
```

Modify `register_ai_settings()` (lines 37-43): Add a `sanitize_callback` to each `register_setting` that encrypts before saving:
```php
register_setting( 'gutenkit_ai_settings', 'gutenkit_openai_api_key', array(
    'sanitize_callback' => array( $this, 'encrypt_key' ),
) );
// Same for all 4 settings
```

Modify `generate_ai_template()` (lines 109-200): When reading keys, decrypt them:
```php
$openai_key = $this->decrypt_key( get_option( 'gutenkit_openai_api_key', '' ) );
// Same for all 4 keys
```

Modify `render_settings_page()` (lines 45-107): Don't show existing encrypted values in password fields. Show placeholder text instead.

- [ ] **Step 2: Remove shortcode from Register**

Modify `includes/class-gutenkit-register.php`:
- Remove `add_shortcode( 'bf_block', ... )` from `__construct()` (line 19).
- Delete `handle_shortcode()` method (lines 125-154).

- [ ] **Step 3: Verify**

Run: Open AI Settings page → enter a test API key → save → check wp_options table → key should be encrypted.
Run: Verify `[bf_block]` shortcode no longer renders on frontend.
Run: Verify all existing blocks still render correctly.

- [ ] **Step 4: Commit**

```bash
git add includes/class-gutenkit-ai.php includes/class-gutenkit-register.php
git commit -m "security: encrypt API keys, remove bf_block shortcode

API keys now encrypted with AES-256-CBC using wp_salt before storage.
Removed [bf_block] shortcode and its base64 attribute decoding."
```

---

## Task 8: Template Syntax Migration

**Files:**
- Modify: `blocks/*/config.json` (convert old syntax in existing blocks)
- Modify: `generate-block-code-multi.js` (remove deprecated syntax support)

- [ ] **Step 1: Scan and convert existing blocks**

Run this one-time script to find and fix old syntax:

```bash
cd "C:\Users\Wac\Local Sites\gutenberg\app\public\wp-content\plugins\block-factory"
grep -r "{{#[a-z]" blocks/*/config.json --include="*.json" -l
```

For each file found, open it and replace:
- `{{#key}}` → `{{#each key}}`
- `{{/key}}` → `{{/each}}`

This can be done with a Node.js script:
```javascript
// migrate-template-syntax.js (one-time script, delete after use)
const fs = require('fs');
const glob = require('glob');

glob.sync('blocks/*/config.json').forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    // Replace {{#key}} with {{#each key}} (but not {{#each key}} which is already correct)
    content = content.replace(/\{\{#(?!each\s)(\w+)\}\}/g, '{{#each $1}}');
    content = content.replace(/\{\{\/(?!each)(\w+)\}\}/g, '{{/each}}');
    if (content !== original) {
        fs.writeFileSync(file, content);
        console.log(`Migrated: ${file}`);
    }
});
```

- [ ] **Step 2: Remove deprecated syntax from generator**

In `generate-block-code-multi.js`, in `generateRenderPhp()`:
- Remove the deprecated `{{#key}}...{{/key}}` regex handler.
- Change the console.warn to a thrown error: `throw new Error(...)`

- [ ] **Step 3: Verify all blocks build**

Run: `npm run build`
Expected: Build succeeds with no deprecation warnings.

- [ ] **Step 4: Commit**

```bash
git add blocks/ generate-block-code-multi.js
git commit -m "refactor: migrate all templates to {{#each key}} syntax

Converted all existing blocks from {{#key}} to {{#each key}} format.
Old syntax is now a build error instead of a deprecation warning."
```

---

## Task 9: AI Refactor

**Files:**
- Modify: `includes/class-gutenkit-ai.php` (consolidate API callers)

- [ ] **Step 1: Replace 4 API methods with single call_provider**

In `includes/class-gutenkit-ai.php`, replace `call_openai()`, `call_gemini()`, `call_groq()`, `call_openrouter()` (lines 202-369) with:

```php
/**
 * Provider configurations.
 */
private function get_providers() {
    return array(
        'groq' => array(
            'option'       => 'gutenkit_groq_api_key',
            'endpoint'     => 'https://api.groq.com/openai/v1/chat/completions',
            'model'        => 'llama3-70b-8192',
            'format'       => 'openai', // Uses OpenAI-compatible chat format
            'headers'      => array(),
        ),
        'openrouter' => array(
            'option'       => 'gutenkit_openrouter_api_key',
            'endpoint'     => 'https://openrouter.ai/api/v1/chat/completions',
            'model'        => 'openrouter/auto',
            'format'       => 'openai',
            'headers'      => array( 'HTTP-Referer' => home_url() ),
        ),
        'openai' => array(
            'option'       => 'gutenkit_openai_api_key',
            'endpoint'     => 'https://api.openai.com/v1/chat/completions',
            'model'        => 'gpt-4o-mini',
            'format'       => 'openai',
            'headers'      => array(),
        ),
        'gemini' => array(
            'option'       => 'gutenkit_gemini_api_key',
            'endpoint'     => '', // Built dynamically with key
            'model'        => 'gemini-2.5-flash',
            'format'       => 'gemini',
            'headers'      => array(),
        ),
    );
}

/**
 * Call any AI provider with a unified interface.
 *
 * @param array  $provider Provider config from get_providers()
 * @param string $api_key  Decrypted API key
 * @param string $system_message System prompt
 * @param string $prompt   User prompt
 * @return string|WP_Error Response content or error
 */
private function call_provider( $provider, $api_key, $system_message, $prompt ) {
    $timeout = 60;

    if ( $provider['format'] === 'gemini' ) {
        // Gemini uses a different request format
        $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$provider['model']}:generateContent?key={$api_key}";
        $body = array(
            'contents' => array(
                array( 'parts' => array( array( 'text' => $system_message . "\n\n" . $prompt ) ) ),
            ),
            'generationConfig' => array( 'temperature' => 0.2 ),
        );
        $response = wp_remote_post( $endpoint, array(
            'headers' => array( 'Content-Type' => 'application/json' ),
            'body'    => wp_json_encode( $body ),
            'timeout' => $timeout,
        ) );
        if ( is_wp_error( $response ) ) return $response;
        $data = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( isset( $data['error'] ) ) {
            return new WP_Error( 'api', $data['error']['message'] ?? 'Gemini API error' );
        }
        return $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }

    // OpenAI-compatible format (OpenAI, Groq, OpenRouter)
    $headers = array_merge(
        array(
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $api_key,
        ),
        $provider['headers']
    );

    $body = array(
        'model'       => $provider['model'],
        'messages'    => array(
            array( 'role' => 'system', 'content' => $system_message ),
            array( 'role' => 'user', 'content' => $prompt ),
        ),
        'temperature' => 0.2,
    );

    $response = wp_remote_post( $provider['endpoint'], array(
        'headers' => $headers,
        'body'    => wp_json_encode( $body ),
        'timeout' => $timeout,
    ) );

    if ( is_wp_error( $response ) ) return $response;

    $data = json_decode( wp_remote_retrieve_body( $response ), true );
    if ( isset( $data['error'] ) ) {
        return new WP_Error( 'api', $data['error']['message'] ?? 'API error' );
    }

    return $data['choices'][0]['message']['content'] ?? '';
}
```

- [ ] **Step 2: Update generate_ai_template to use call_provider**

In `generate_ai_template()`, replace the provider resolution logic (lines 137-200) with:

```php
$providers = $this->get_providers();
$result = null;

foreach ( $providers as $name => $provider ) {
    $key = $this->decrypt_key( get_option( $provider['option'], '' ) );
    if ( empty( $key ) ) continue;

    $result = $this->call_provider( $provider, $key, $system_message, $user_prompt );
    if ( ! is_wp_error( $result ) && ! empty( $result ) ) {
        break;
    }
}

if ( is_wp_error( $result ) ) {
    wp_send_json_error( $result->get_error_message() );
}
if ( empty( $result ) ) {
    wp_send_json_error( 'No API key configured. Add one in Block Factory → AI Settings.' );
}
```

- [ ] **Step 3: Delete old call_* methods**

Remove: `call_openai()`, `call_gemini()`, `call_groq()`, `call_openrouter()` (lines 202-369).

- [ ] **Step 4: Verify AI generation works**

Run: Open Block Factory editor → Step 1 → enter an AI prompt → click Generate.
Expected: AI generates HTML + CSS template (if an API key is configured).

- [ ] **Step 5: Commit**

```bash
git add includes/class-gutenkit-ai.php
git commit -m "refactor: consolidate 4 AI API callers into single call_provider method

Uses provider config array. Same 4 providers (Groq, OpenRouter, OpenAI, Gemini)
with unified interface. Eliminates ~170 lines of duplicate code."
```

---

## Final Verification

After all 9 tasks are complete:

- [ ] Run `npm run build` — all blocks compile
- [ ] Verify `class-gutenkit-generator.php` is deleted
- [ ] Verify no jQuery in `src/` or `assets/js/`
- [ ] Verify each React component file is < 200 lines
- [ ] Create a new block → define fields → save → write template → build → view on frontend
- [ ] Edit an existing block → change fields → save → build → verify frontend
- [ ] Delete a block → verify removed
- [ ] AI generation works (if API key configured)
- [ ] No `{{#key}}` syntax in any config.json

```bash
git commit -m "Block Factory rebuild complete — all 9 migration tasks done"
```
