<?php
// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// The block_factory_router() function (in block-factory.php) ensures 
// that 'block_slug' is set before this file is included, but we'll include a safety check.
if (!isset($_GET['block_slug'])) {
    wp_die('Error: Block slug not provided for editing.', 'Missing Block Slug');
}

// Sanitize and derive variables used in the HTML
$block_slug = sanitize_title($_GET['block_slug']);
// The component name is derived from the slug for display purposes
$block_name = ucwords(str_replace('-', ' ', $block_slug));

// Note: The admin-header.php is required in the router (block-factory.php) before this file is included
?>

<div class="wrap gutenkit-wrap">
    <div class="gutenkit-header gutenkit-header-editor">
        <div class="gutenkit-header-title">
            <a href="<?php echo esc_url(admin_url('admin.php?page=block-factory')); ?>" class="gutenkit-back-link">
                <span class="dashicons dashicons-arrow-left-alt2"></span> Back to Dashboard
            </a>
            <h1>Editing Structure: <strong><?php echo esc_html($block_name); ?></strong></h1>
            <p>Define the fields (Text, Textarea, Image, Repeater, etc.) for this block below.</p>
        </div>
    </div>

    <div class="gutenkit-editor-container">
        <div id="component-editor-root">
            <div class="gutenkit-loading">
                <span class="spinner is-active"></span> Loading component editor...
            </div>
        </div>
    </div>
</div>