<?php
/**
 * Plugin Name: Block Factory
 * Description: A tool to quickly generate Gutenberg block boilerplate files. (Build-based workflow)
 * Version: 1.1
 * Author: Your Name
 *
 * Notes:
 * - Use the admin generator to create source files under /blocks/{slug}/
 * - Run `npm run build` (your webpack) to compile into /build/{slug}/ which is what WP will register.
 * - If build/ is missing, the plugin will attempt to register from /blocks/ as a fallback (development convenience).
 */

if (!defined('ABSPATH')) {
    exit;
}

// ------------------------------------------------------------------
// PATH CONSTANTS
// ------------------------------------------------------------------
define('BLOCK_FACTORY_PATH', plugin_dir_path(__FILE__));
define('BLOCK_FACTORY_URL', plugin_dir_url(__FILE__));
define('BLOCKS_BASE_PATH', BLOCK_FACTORY_PATH . 'blocks/'); // source folder (generator writes here)
define('BUILD_BASE_PATH', BLOCK_FACTORY_PATH . 'build/');   // compiled output (npm run build writes here)



// ------------------------------------------------------------------
// ADMIN MENU
// ------------------------------------------------------------------
function block_factory_menu()
{
    add_menu_page(
        'Block Factory',
        'Block Factory',
        'manage_options',
        'block-factory',
        'block_factory_page_content',
        'dashicons-code-standards',
        25
    );
}
add_action('admin_menu', 'block_factory_menu');

// ------------------------------------------------------------------
// ROUTER: Serve the component editor (React app) for editing structure
// ------------------------------------------------------------------
function block_factory_router()
{
    if (isset($_GET['page']) && $_GET['page'] === 'block-factory') {

        if (isset($_GET['action']) && $_GET['action'] === 'edit_structure' && isset($_GET['block_slug'])) {

            require_once(ABSPATH . 'wp-admin/admin-header.php');

            $block_slug = sanitize_title($_GET['block_slug']);

            if (!function_exists('block_factory_read_config')) {
                echo '<div class="notice notice-error"><p>Block Factory: helper functions missing.</p></div>';
                require_once(ABSPATH . 'wp-admin/admin-footer.php');
                exit;
            }

            $config = block_factory_read_config($block_slug);
            $nonce = wp_create_nonce('block_factory_save_structure_action');
            $script_handle = 'block-factory-editor-app';

            // Enqueue editor-app (admin JS)
            $editor_app_path = BLOCK_FACTORY_PATH . 'admin/js/editor-app.js';
            $editor_app_url = BLOCK_FACTORY_URL . 'admin/js/editor-app.js';
            if (file_exists($editor_app_path)) {
                wp_enqueue_script(
                    $script_handle,
                    $editor_app_url,
                    array('jquery', 'wp-element', 'wp-components'),
                    filemtime($editor_app_path),
                    true
                );

                wp_localize_script($script_handle, 'blockFactoryEditorData', array(
                    'config' => $config,
                    'blockSlug' => $block_slug,
                    'nonce' => $nonce,
                    'ajaxurl' => admin_url('admin-ajax.php'),
                ));
            } else {
                echo '<div class="notice notice-warning"><p>Block Factory: Admin editor-app.js missing. Check admin/js/editor-app.js</p></div>';
            }

            // include view
            $view = BLOCK_FACTORY_PATH . 'admin/component-editor.php';
            if (file_exists($view)) {
                include($view);
            } else {
                echo '<div class="notice notice-error"><p>Block Factory: component-editor.php missing.</p></div>';
            }

            require_once(ABSPATH . 'wp-admin/admin-footer.php');
            exit;
        }
    }
}
add_action('admin_init', 'block_factory_router');


// In your main PHP plugin file (e.g., block-factory.php)

function block_factory_enqueue_admin_scripts($hook)
{
    // CRITICAL: Check if we are on the correct custom admin page.
    // Replace 'gutenberg-factory' with the menu slug you used when defining your admin page.
    $target_page = 'toplevel_page_block-factory'; // Example: Toplevel page hook
    if ($hook !== $target_page) {
        return;
    }

    // Enqueue jQuery since your script relies on it ($)
    wp_enqueue_script('jquery');

    // Enqueue your custom deletion script
    wp_enqueue_script(
        'block-factory-admin-script',
        plugins_url('assets/js/admin.js', __FILE__), // Path to your new file
        array('jquery'), // Dependencies (requires jQuery)
        '1.0',
        true // Load in the footer
    );

    // CRITICAL: Localize the data for the script to use
    // The script needs the AJAX URL and the security nonce.
    wp_localize_script(
        'block-factory-admin-script',
        'blockFactoryEditorData', // The variable name used in the JS file
        array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('block_factory_nonce'), // MUST match the nonce used in the PHP handler!
        )
    );
}
add_action('admin_enqueue_scripts', 'block_factory_enqueue_admin_scripts');

// ------------------------------------------------------------------
// Admin Page Content - list existing blocks + generator form
// ------------------------------------------------------------------
function block_factory_page_content()
{
    ?>
    <div class="wrap">
        <h1>Gutenberg Component Factory</h1>
        <?php
        $blocks_directory = BLOCKS_BASE_PATH;
        $block_folders = glob($blocks_directory . '*', GLOB_ONLYDIR);

        if (empty($block_folders)) {
            echo '<p>No blocks found. Use the generator form to create one!</p>';
            include(BLOCK_FACTORY_PATH . 'admin/generator-form.php');
            return;
        }

        echo '<h2>Existing Components</h2>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>';
        echo '<tbody>';

        foreach ($block_folders as $block_path) {
            $block_slug = basename($block_path);
            $block_name = ucwords(str_replace('-', ' ', $block_slug));
            $edit_url = admin_url('admin.php?page=block-factory&action=edit_structure&block_slug=' . $block_slug);

            echo '<tr>';
            echo '<td><strong>' . esc_html($block_name) . '</strong></td>';
            echo '<td><code>' . esc_html($block_slug) . '</code></td>';
            echo '<td><a href="' . esc_url($edit_url) . '">Edit Structure</a>';
            // --- NEW DELETE LINK ---
            echo ' | <a href="#" 
           class="block-factory-delete-btn" 
           data-slug="' . esc_attr($block_slug) . '" 
           style="color: red;"
           title="Permanently delete all files for this block."
           >Delete</a></td>';

            echo '</tr>';
        }

        echo '</tbody></table>';

        include(BLOCK_FACTORY_PATH . 'admin/generator-form.php');
        ?>
    </div>
    <?php
}

// ------------------------------------------------------------------
// GENERATOR FORM HANDLER: create source files under /blocks/{slug}/
// ------------------------------------------------------------------
function block_factory_handle_form()
{
    if (
        !isset($_POST['block_factory_nonce']) ||
        !wp_verify_nonce($_POST['block_factory_nonce'], 'block_factory_action') ||
        !current_user_can('manage_options')
    ) {
        wp_die('Security check failed.');
    }

    $component_name = sanitize_text_field($_POST['component_name']);
    $component_icon = sanitize_text_field($_POST['component_icon']);

    if (empty($component_name)) {
        wp_die('Component Name is required.');
    }

    $block_slug = sanitize_title($component_name);
    $block_namespace = 'block-factory/' . $block_slug;

    $new_block_dir = BLOCKS_BASE_PATH . $block_slug . '/';

    if (!wp_mkdir_p($new_block_dir)) {
        wp_die('Failed to create block directory. Check permissions.');
    }

    $placeholders = array(
        '__COMPONENT_NAME_PASCAL__' => str_replace(' ', '', ucwords(str_replace('-', ' ', $block_slug))),
        '__COMPONENT_NAME_TITLE__' => $component_name,
        '__COMPONENT_SLUG__' => $block_slug,
        '__COMPONENT_NAMESPACE__' => $block_namespace,
        '__COMPONENT_ICON__' => $component_icon ? $component_icon : 'editor-code',
    );

    $templates = array(
        'block.json.tpl' => 'block.json',
        'index.js.tpl' => 'index.js',
        'edit.js.tpl' => 'edit.js',
        'save.js.tpl' => 'save.js',
        'style.scss.tpl' => 'style.scss',
        'editor.scss.tpl' => 'editor.scss',
        'config.json.tpl' => 'config.json',
        'render.php.tpl' => 'render.php',
    );

    foreach ($templates as $template_file => $output_file) {
        $template_path = BLOCK_FACTORY_PATH . 'templates/' . $template_file;
        if (!file_exists($template_path)) {
            // If template missing, skip (but log)
            error_log("Block Factory: Missing template " . $template_path);
            continue;
        }
        $file_content = file_get_contents($template_path);

        $final_content = str_replace(
            array_keys($placeholders),
            array_values($placeholders),
            $file_content
        );

        file_put_contents($new_block_dir . $output_file, $final_content);
    }

    $redirect_url = add_query_arg('block_created', $block_slug, admin_url('admin.php?page=block-factory'));
    wp_safe_redirect($redirect_url);
    exit;
}
add_action('admin_post_block_factory_generate', 'block_factory_handle_form');

// ------------------------------------------------------------------
// HELPER: config read/write
// ------------------------------------------------------------------
function block_factory_get_config_path($block_slug)
{
    return BLOCKS_BASE_PATH . $block_slug . '/config.json';
}

if (!function_exists('block_factory_read_config')) {
    function block_factory_read_config($block_slug)
    {
        $config_file = block_factory_get_config_path($block_slug);
        if (file_exists($config_file)) {
            $content = file_get_contents($config_file);
            $decoded = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $decoded;
            }
        }
        // Default
        return array('fields' => array());
    }
}

function block_factory_write_config($block_slug, $config_data)
{
    $path = block_factory_get_config_path($block_slug);
    $json_content = wp_json_encode($config_data, JSON_PRETTY_PRINT);
    return file_put_contents($path, $json_content) !== false;
}

// ------------------------------------------------------------------
// SHORTCODE: bf_block
// - Accepts slug plus optional attributes JSON
// - Returns final HTML for the block on frontend
// ------------------------------------------------------------------
// In your main plugin file or rendering file

function block_factory_handle_shortcode($atts)
{
    // 1. Setup default attributes
    $atts = shortcode_atts(
        array(
            'slug' => '',
            'attributes' => '', // This will be our Base64 string
            'content' => '',
        ),
        $atts
    );

    $block_slug = sanitize_title($atts['slug']);
    if (empty($block_slug)) {
        return '';
    }

    // 2. Decode the Base64 attributes
    $attributes = array();
    if (!empty($atts['attributes'])) {
        $decoded_json = base64_decode($atts['attributes']);
        $decoded_array = json_decode($decoded_json, true);

        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded_array)) {
            $attributes = $decoded_array;
        } else {
            error_log('Block Factory JSON Decode Error for ' . $block_slug . ': ' . json_last_error_msg());
        }
    }

    // 3. Define the path to your render.php
    $template_path = plugin_dir_path(__FILE__) . 'blocks/' . $block_slug . '/render.php';

    // 4. Render the template
    if (file_exists($template_path)) {
        ob_start();

        // Ensure $content is available for the included render.php
        $content = $atts['content'] ?? '';

        // $attributes and $content are now available inside render.php
        include $template_path;

        return ob_get_clean();
    } else {
        return '<div class="block-factory-error">Error: Template not found for: ' . esc_html($block_slug) . '</div>';
    }
}
add_shortcode('bf_block', 'block_factory_handle_shortcode');

// ------------------------------------------------------------------
// BLOCK REGISTRATION
// - Prefer build/{block} for registration (production), fallback to blocks/{block} (dev convenience).
// ------------------------------------------------------------------

function block_factory_register_blocks()
{
    if (is_dir(BUILD_BASE_PATH)) {
        $blocks_directory = BUILD_BASE_PATH;
        error_log('Block Factory: Registering blocks from build/ directory.');
    } else {
        // fallback to source dir
        $blocks_directory = BLOCKS_BASE_PATH;
        error_log('Block Factory: build/ not found. Falling back to blocks/ source directory.');
    }
    if (!is_dir($blocks_directory)) {
        error_log('Block Factory ERROR: blocks directory not found: ' . $blocks_directory);
        return;
    }

    $block_folders = glob($blocks_directory . '*', GLOB_ONLYDIR);

    if (empty($block_folders)) {
        error_log('Block Factory: No block folders found in ' . $blocks_directory);
    }

    foreach ($block_folders as $block_path) {
        $block_json = $block_path . '/block.json';

        if (!file_exists($block_json)) {
            error_log("Block Factory WARNING: No block.json found in $block_path - skipping.");
            continue;
        }

        // --- STEP 1: Get the Block Name (Slug) ---
        $block_name = basename($block_path);

        // Register block
        try {
            register_block_type_from_metadata($block_path, array(
                // --- STEP 2: Use a Closure for Dynamic Rendering ---
                'render_callback' => function ($attributes, $content) use ($block_name) {
                    // $attributes_json = json_encode($attributes);
                    // $shortcode_content = '[bf_block slug="' . esc_attr($block_name) . '" attributes=\'' . esc_attr($attributes_json) . '\' content="' . esc_attr($content) . '"]';
                    $attributes_json = json_encode($attributes);
                    $encoded_data = base64_encode($attributes_json);
                    $shortcode_content = '[bf_block slug="' . esc_attr($block_name) . '" attributes="' . $encoded_data . '" content="' . esc_attr($content) . '"]';
                    return do_shortcode($shortcode_content);
                },
                // --- END render_callback ---
            ));
            error_log("Block Factory: Registered block from $block_path");
        } catch (Throwable $e) {
            error_log('Block Factory ERROR registering block at ' . $block_path . ': ' . $e->getMessage());
        }
    }
}
add_action('init', 'block_factory_register_blocks');

// ------------------------------------------------------------------
// AJAX: Save structure
// ------------------------------------------------------------------
function block_factory_handle_save_structure()
{
    if (
        !isset($_POST['nonce']) ||
        !wp_verify_nonce($_POST['nonce'], 'block_factory_save_structure_action') ||
        !current_user_can('manage_options')
    ) {
        wp_send_json_error(array('message' => 'Security check failed.'));
    }

    $block_slug = sanitize_title($_POST['block_slug']);
    $config_data_json = isset($_POST['config_data']) ? wp_unslash($_POST['config_data']) : '';

    if (empty($block_slug) || empty($config_data_json)) {
        wp_send_json_error(array('message' => 'Missing block slug or configuration data.'));
    }

    $config_data = json_decode($config_data_json, true);

    if (is_null($config_data)) {
        wp_send_json_error(array('message' => 'Invalid configuration JSON format.'));
    }

    $success = block_factory_write_config($block_slug, $config_data);

    if ($success) {
        // 1. Update block.json and edit.js (Existing)
        block_factory_update_block_json($block_slug, $config_data);
        block_factory_regenerate_edit_js($block_slug, $config_data);

        // 2. NEW: Generate the cooked render.php file
        if (isset($config_data['template'])) {
            block_factory_generate_render_php($block_slug, $config_data);
        }

        wp_send_json_success(array(
            'message' => 'Block structure and Template saved successfully!',
            'next_step' => 'Run `npm run build` to compile changes.'
        ));
    } else {
        wp_send_json_error(array('message' => 'Failed to write configuration file.'));
    }
}
add_action('wp_ajax_block_factory_save_structure', 'block_factory_handle_save_structure');


function block_factory_generate_render_php($slug, $config)
{
    $template = $config['template'];
    $fields = $config['fields'];
    $block_dir = BLOCK_FACTORY_PATH . 'blocks/' . $slug; // Adjust path to your plugin structure
    foreach ($fields as $field) {
        $key = $field['key'];
        $type = $field['type'];

        // Determine the PHP replacement based on field type

        switch ($type) {
            case 'image':
            case 'file':
                // Standard object with URL and Alt
                $php_replacement = "<?php if(!empty(\$attributes['$key']['url'])): ?>";
                $php_replacement .= "<img src=\"<?php echo esc_url(\$attributes['$key']['url']); ?>\" alt=\"<?php echo esc_attr(\$attributes['$key']['alt'] ?? ''); ?>\" />";
                $php_replacement .= "<?php endif; ?>";
                break;

            case 'gallery':
                // For galleries, we know each item should be an image
                $php_replacement = "<?php if(!empty(\$attributes['$key']) && is_array(\$attributes['$key'])): ?>\n";
                $php_replacement .= "    <div class=\"custom-gallery\">\n";
                $php_replacement .= "        <?php foreach(\$attributes['$key'] as \$item): \n";
                $php_replacement .= "            \$img_url = \$item['url'] ?? ''; \n"; // Standard image object URL
                $php_replacement .= "            \$img_alt = \$item['alt'] ?? ''; \n";
                $php_replacement .= "        ?>\n";
                $php_replacement .= "            <div class=\"gallery-item\">\n";
                $php_replacement .= "                <img src=\"<?php echo esc_url(\$img_url); ?>\" alt=\"<?php echo esc_attr(\$img_alt); ?>\" />\n";
                $php_replacement .= "            </div>\n";
                $php_replacement .= "        <?php endforeach; ?>\n";
                $php_replacement .= "    </div>\n";
                $php_replacement .= "<?php endif; ?>";
                break;

            case 'relational':
                // For relational, we assume $item is a Post ID
                $php_replacement = "<?php if(!empty(\$attributes['$key']) && is_array(\$attributes['$key'])): ?>\n";
                $php_replacement .= "    <ul class=\"related-posts\">\n";
                $php_replacement .= "        <?php foreach(\$attributes['$key'] as \$post_id): ?>\n";
                $php_replacement .= "            <li><a href=\"<?php echo get_permalink(\$post_id); ?>\"><?php echo get_the_title(\$post_id); ?></a></li>\n";
                $php_replacement .= "        <?php endforeach; ?>\n";
                $php_replacement .= "    </ul>\n";
                $php_replacement .= "<?php endif; ?>";
                break;

            case 'repeater':
                // Repeaters are generic; we leave a comment so the admin knows to add sub-fields
                $php_replacement = "<?php if(!empty(\$attributes['$key']) && is_array(\$attributes['$key'])): ?>\n";
                $php_replacement .= "    <?php foreach(\$attributes['$key'] as \$item): ?>\n";
                $php_replacement .= "        \n";
                $php_replacement .= "    <?php endforeach; ?>\n";
                $php_replacement .= "<?php endif; ?>";
                break;

            case 'url':
                // Standard link
                $php_replacement = "<a href=\"<?php echo esc_url(\$attributes['$key'] ?? '#'); ?>\">Link Label</a>";
                break;

            case 'button':
                // Usually a button link
                $php_replacement = "<a href=\"<?php echo esc_url(\$attributes['$key']['url'] ?? '#'); ?>\" class=\"button\">";
                $php_replacement .= "<?php echo esc_html(\$attributes['$key']['text'] ?? 'Click Here'); ?>";
                $php_replacement .= "</a>";
                break;

            case 'textarea':
            case 'contentEditor':
                // Rich text or multiline text requiring HTML tags
                $php_replacement = "<?php echo wp_kses_post(\$attributes['$key'] ?? ''); ?>";
                break;

            case 'color':
                // Inline style output
                $php_replacement = "style=\"color: <?php echo esc_attr(\$attributes['$key'] ?? 'inherit'); ?>;\"";
                break;

            case 'icon':
                // FontAwesome or SVG class/slug
                $php_replacement = "<i class=\"<?php echo esc_attr(\$attributes['$key'] ?? ''); ?>\"></i>";
                break;

            case 'email':
                $php_replacement = "<a href=\"mailto:<?php echo antispambot(\$attributes['$key'] ?? ''); ?>\"><?php echo antispambot(\$attributes['$key'] ?? ''); ?></a>";
                break;

            case 'number':
            case 'range':
            case 'date':
            case 'time':
            case 'datetime':
                // Clean numeric/date strings
                $php_replacement = "<?php echo esc_attr(\$attributes['$key'] ?? ''); ?>";
                break;

            case 'text':
            default:
                // Plain text
                $php_replacement = "<?php echo esc_html(\$attributes['$key'] ?? ''); ?>";
                break;
        }
        // Replace the tag in the HTML
        $template = str_replace('{{' . $key . '}}', $php_replacement, $template);
    }

    // Wrap the final HTML in a standard PHP block template
    $file_content = "<?php\n";
    $file_content .= "/**\n * Auto-generated render file for $slug\n */\n";
    $file_content .= "\$wrapper_classes = 'bf-block-' . esc_attr('$slug');\n";
    $file_content .= "?>\n";
    $file_content .= "<div class=\"<?php echo \$wrapper_classes; ?>\">\n";
    $file_content .= $template . "\n";
    $file_content .= "</div>";

    // Save to the block folder
    if (!file_exists($block_dir)) {
        mkdir($block_dir, 0755, true);
    }

    return file_put_contents($block_dir . '/render.php', $file_content);
}

// Hook the AJAX action
add_action('wp_ajax_block_factory_delete_block', 'block_factory_delete_block_handler');

function block_factory_delete_block_handler()
{
    // 1. Security Checks
    check_ajax_referer('block_factory_nonce', 'nonce'); // Replace with your actual nonce name

    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Permission denied.'], 403);
        return;
    }

    $block_slug = sanitize_title($_POST['block_slug']);
    if (empty($block_slug)) {
        wp_send_json_error(['message' => 'Invalid block slug.'], 400);
        return;
    }

    // 2. Define Paths to Delete
    $blocks_path = BLOCKS_BASE_PATH . $block_slug;
    $build_path = BUILD_BASE_PATH . $block_slug;

    $errors = [];
    $success = [];

    // 3. Recursive Directory Deletion Helper
    $delete_dir_recursive = function ($dir) use (&$errors, $block_slug) {
        if (!is_dir($dir)) {
            return true; // Nothing to delete
        }

        // Use a recursive iterator to delete contents
        $it = new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);

        foreach ($files as $file) {
            if ($file->isDir()) {
                if (!@rmdir($file->getRealPath())) { // Use @ to suppress PHP warnings
                    $errors[] = "Failed to remove directory: " . $file->getRealPath();
                }
            } else {
                if (!@unlink($file->getRealPath())) {
                    $errors[] = "Failed to remove file: " . $file->getRealPath();
                }
            }
        }

        // Finally, delete the directory itself
        if (!@rmdir($dir)) {
            $errors[] = "Failed to remove block directory: " . $dir;
            return false;
        }
        return true;
    };


    // 4. Execute Deletion

    // Delete from the /blocks directory
    if ($delete_dir_recursive($blocks_path)) {
        $success[] = "Successfully deleted source files from /blocks/$block_slug";
    }

    // Delete from the /build directory (this contains compiled assets and config/block files)
    if ($delete_dir_recursive($build_path)) {
        $success[] = "Successfully deleted build files from /build/$block_slug";
    }

    // 5. Send Response
    if (empty($errors)) {
        wp_send_json_success([
            'message' => 'Block files successfully removed.',
            'details' => $success
        ]);
    } else {
        // Log errors to the WP debug log if available
        error_log('Block Deletion Errors for ' . $block_slug . ': ' . print_r($errors, true));

        wp_send_json_error([
            'message' => 'Deletion failed for one or more files. Check PHP error logs for details.',
            'details' => $errors
        ]);
    }
}

function block_factory_regenerate_edit_js($block_slug, $config_data)
{

    $block_dir = BLOCKS_BASE_PATH . $block_slug . '/';
    $template_path = BLOCK_FACTORY_PATH . 'templates/edit.js.tpl';

    $edit_js_path = $block_dir . 'edit.js';

    if (!file_exists($template_path)) {
        return false;
    }

    $template = file_get_contents($template_path);

    // IMPORTANT: keep field casing exactly as stored
    $fields_json = wp_json_encode($config_data['fields'], JSON_PRETTY_PRINT);

    $replacements = [
        '{{BLOCK_SLUG}}' => $block_slug,
        '{{FIELDS_JSON}}' => $fields_json,
    ];

    $final_js = str_replace(
        array_keys($replacements),
        array_values($replacements),
        $template
    );

    return file_put_contents($edit_js_path, $final_js) !== false;
}

function block_factory_update_block_json($block_slug, $config_data)
{
    // print_r($config_data);exit;
    $json_path = BLOCKS_BASE_PATH . $block_slug . '/block.json';
    if (!file_exists($json_path))
        return;

    $block_meta = json_decode(file_get_contents($json_path), true);

    // Ensure the attributes key exists
    if (!isset($block_meta['attributes'])) {
        $block_meta['attributes'] = [];
    }

    // Add every field from your config to the attributes list
    // foreach ($config_data['fields'] as $field) {
    //     $key = $field['key'];
    //     if (!isset($block_meta['attributes'][$key])) {
    //         // Map field types to JSON types
    //         $type = ($field['type'] === 'number' || $field['type'] === 'range') ? 'number' : 'string';

    //         if ($field['type'] === 'repeater' || $field['type'] === 'gallery') {
    //             $type = 'array';
    //         }
    //         if ($field['type'] === 'image' || $field['type'] === 'file') {
    //             $type = 'object';
    //         }
    //         $block_meta['attributes'][$key] = [
    //             'type' => $type
    //         ];
    //     }
    // }
    foreach ($config_data['fields'] as $field) {
        $key = $field['key'];

        if (!isset($block_meta['attributes'][$key])) {
            // Default to string
            $type = 'string';

            // 1. Map basic types
            if ($field['type'] === 'number' || $field['type'] === 'range' || $field['type'] === 'relational') {
                $type = 'number';
            } elseif ($field['type'] === 'image' || $field['type'] === 'file' || $field['type'] === 'button') {
                $type = 'object';
            } elseif ($field['type'] === 'repeater' || $field['type'] === 'gallery') {
                $type = 'array';
            }

            // 2. Build the attribute definition
            $attr_definition = ['type' => $type];

            // 3. CRITICAL: Add the items schema for arrays (Gallery/Repeater)
            if ($type === 'array') {
                $attr_definition['default'] = [];
                $attr_definition['items'] = [
                    'type' => 'object' // This allows the {id, url, alt} objects to be saved
                ];
            }

            $block_meta['attributes'][$key] = $attr_definition;
        }
    }

    file_put_contents($json_path, json_encode($block_meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}