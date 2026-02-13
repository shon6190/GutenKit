?>
<?php
// Check for node_modules and offer installation if missing
if (!file_exists(BLOCK_FACTORY_PATH . 'node_modules')) {
    ?>
    <div class="notice notice-warning">
        <p><strong>Node.js Dependencies Missing!</strong> The plugin requires dependencies to build blocks.</p>
        <button id="bf-install-dependencies-btn" class="button button-secondary">Install Dependencies</button>
        <span id="bf-install-progress" style="display:none; margin-left: 10px;">
            <span class="spinner is-active" style="float:none; margin:0;"></span> Installing... (this may take a few
            minutes)
        </span>
        <pre id="bf-install-output"
            style="display:none; margin-top: 10px; background: #f0f0f0; padding: 10px; overflow: auto; max-height: 200px;"></pre>
    </div>
    <?php
}

// Display success message if block was created
if (isset($_GET['block_created'])) {
    $block_slug = sanitize_text_field($_GET['block_created']);
    $block_name = ucwords(str_replace('-', ' ', $block_slug));
    ?>
    <div class="notice notice-success is-dismissible">
        <p>🎉 Success! The **<?php echo esc_html($block_name); ?>** block boilerplate has been created in
            <code>/blocks/<?php echo esc_html($block_slug); ?></code>.
        </p>
        <p>You can now start developing the block!</p>
    </div>
    <?php
}
?>

<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
    <input type="hidden" name="action" value="block_factory_generate">
    <?php wp_nonce_field('block_factory_action', 'block_factory_nonce'); ?>

    <table class="form-table" role="presentation">
        <tr>
            <th scope="row"><label for="component_name">Component Name (Title)</label></th>
            <td>
                <input name="component_name" type="text" id="component_name" class="regular-text"
                    placeholder="e.g., Hero Banner" required>
                <p class="description">This will be the display name in the editor. It will be slugified for file names.
                </p>
            </td>
        </tr>
        <tr>
            <th scope="row"><label for="component_icon">Component Icon (Dashicon)</label></th>
            <td>
                <input name="component_icon" type="text" id="component_icon" class="regular-text"
                    placeholder="e.g., star-filled" value="editor-code">
                <p class="description">A <a href="https://developer.wordpress.org/resource/dashicons/"
                        target="_blank">Dashicon</a> slug. Defaults to <code>editor-code</code>.</p>
            </td>
        </tr>
    </table>

    <?php submit_button('Generate New Gutenberg Block'); ?>
</form>