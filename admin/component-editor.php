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

<div class="wrap">
    <div class="row">
        <h1>Editing Structure for: <?php echo esc_html($block_name); ?></h1>
        <button id="build-block-btn" class="button button-primary">Build Block</button>
    </div>

    <p class="description">Define the fields (Text, Textarea, Image, Repeater, etc.) for this block here.</p>

    <div id="component-editor-root">
        Loading component editor...
    </div>
</div>