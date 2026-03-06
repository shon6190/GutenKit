<div class="gutenkit-generator-card">
    <div class="gutenkit-generator-header">
        <h2>Create New Block</h2>
        <p>Set up a new block boilerplate in seconds.</p>
    </div>

    <?php
    // Check for node_modules and offer installation if missing
    if (!file_exists(BLOCK_FACTORY_PATH . 'node_modules')) {
        ?>
        <div class="gutenkit-alert gutenkit-alert-warning">
            <div class="gutenkit-alert-icon"><span class="dashicons dashicons-warning"></span></div>
            <div class="gutenkit-alert-content">
                <strong>Node.js Dependencies Missing!</strong>
                <p>The plugin requires dependencies to build blocks.</p>
                <button id="bf-install-dependencies-btn" class="button button-secondary">Install Dependencies</button>
                <span id="bf-install-progress" style="display:none; margin-left: 10px;">
                    <span class="spinner is-active" style="float:none; margin:0;"></span> Installing...
                </span>
                <pre id="bf-install-output"
                    style="display:none; margin-top: 10px; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #e2e8f0; overflow: auto; max-height: 200px; font-size: 12px;"></pre>
            </div>
        </div>
        <?php
    }

    // Display success message if block was created
    if (isset($_GET['block_created'])) {
        $block_slug = sanitize_text_field($_GET['block_created']);
        $block_name = ucwords(str_replace('-', ' ', $block_slug));
        ?>
        <div class="gutenkit-alert gutenkit-alert-success is-dismissible">
            <div class="gutenkit-alert-icon"><span class="dashicons dashicons-yes-alt"></span></div>
            <div class="gutenkit-alert-content">
                <strong>🎉 Success!</strong>
                <p>The <strong><?php echo esc_html($block_name); ?></strong> block boilerplate has been created in
                    <code>/blocks/<?php echo esc_html($block_slug); ?></code>.
                </p>
                <p>You can now start developing the block structure.</p>
            </div>
        </div>
        <?php
    }
    ?>

    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="gutenkit-form">
        <input type="hidden" name="action" value="block_factory_generate">
        <?php wp_nonce_field('block_factory_action', 'block_factory_nonce'); ?>

        <div class="gutenkit-form-group">
            <label for="component_name">Component Name (Title)</label>
            <input name="component_name" type="text" id="component_name" class="gutenkit-input"
                placeholder="e.g., Hero Banner" required>
            <p class="description">This will be the display name in the editor. It will be slugified for file names.</p>
        </div>

        <div class="gutenkit-form-group">
            <label for="component_icon">Component Icon (Dashicon)</label>
            <div class="gutenkit-input-with-icon gutenkit-icon-picker-wrapper">
                <span class="dashicons dashicons-editor-code" id="gutenkit-current-icon-preview"></span>
                <input name="component_icon" type="text" id="component_icon" class="gutenkit-input"
                    placeholder="e.g., star-filled" value="editor-code" autocomplete="off" readonly
                    style="cursor: pointer;">
                <button type="button" class="gutenkit-btn-secondary" id="gutenkit-open-icon-picker">
                    Browse Icons
                </button>

                <!-- Icon Picker Dropdown (Hidden initially) -->
                <div class="gutenkit-icon-picker-dropdown" id="gutenkit-icon-picker-dropdown">
                    <div class="gutenkit-icon-picker-search">
                        <input type="text" id="gutenkit-icon-search" placeholder="Search icons..."
                            class="gutenkit-input">
                    </div>
                    <div class="gutenkit-icon-picker-grid" id="gutenkit-icon-picker-grid">
                        <!-- Icons populated via JS -->
                    </div>
                </div>
            </div>
            <p class="description">A <a href="https://developer.wordpress.org/resource/dashicons/"
                    target="_blank">Dashicon</a> slug. Defaults to <code>editor-code</code>.</p>
        </div>

        <div class="gutenkit-form-actions">
            <button type="submit" name="submit" id="submit" class="gutenkit-btn gutenkit-btn-primary">
                <span class="dashicons dashicons-plus-alt2"></span> Generate New Gutenberg Block
            </button>
        </div>
    </form>
</div>