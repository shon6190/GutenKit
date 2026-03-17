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

        <div class="gutenkit-form-group">
            <label>Block Scripts</label>
            <p class="description" style="margin-bottom: 8px;">Does this block need interactive JavaScript on the frontend?</p>

            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                <label class="bf-script-type-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff;">
                    <input type="radio" name="block_script_type" value="" checked onchange="bfToggleScriptOptions(this)"> None
                </label>
                <label class="bf-script-type-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff;">
                    <input type="radio" name="block_script_type" value="slider" onchange="bfToggleScriptOptions(this)">
                    <span class="dashicons dashicons-images-alt2" style="font-size:16px;width:16px;height:16px;"></span> Slider
                </label>
                <label class="bf-script-type-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff;">
                    <input type="radio" name="block_script_type" value="accordion" onchange="bfToggleScriptOptions(this)">
                    <span class="dashicons dashicons-menu-alt" style="font-size:16px;width:16px;height:16px;"></span> Accordion
                </label>
                <label class="bf-script-type-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff;">
                    <input type="radio" name="block_script_type" value="ajax" onchange="bfToggleScriptOptions(this)">
                    <span class="dashicons dashicons-update" style="font-size:16px;width:16px;height:16px;"></span> AJAX
                </label>
                <label class="bf-script-type-label" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; background: #fff;">
                    <input type="radio" name="block_script_type" value="custom" onchange="bfToggleScriptOptions(this)">
                    <span class="dashicons dashicons-editor-code" style="font-size:16px;width:16px;height:16px;"></span> Custom JS
                </label>
            </div>

            <!-- Slider options -->
            <div id="bf-script-opts-slider" class="bf-script-opts" style="display:none; background:#f9f9f9; border:1px solid #e2e8f0; border-radius:4px; padding:12px; margin-top:6px;">
                <strong style="display:block; margin-bottom:8px;">Slider Options (Embla Carousel)</strong>
                <label style="display:inline-flex; align-items:center; gap:6px; margin-bottom:6px;">
                    <input type="checkbox" name="block_script_loop" value="1"> Loop slides
                </label>
                <br>
                <label style="display:block; margin-top:8px; margin-bottom:12px;">
                    Align
                    <select name="block_script_align" class="gutenkit-input" style="margin-top:4px; width:auto;">
                        <option value="start">Start</option>
                        <option value="center">Center</option>
                        <option value="end">End</option>
                    </select>
                </label>
                <details style="margin-top:4px;">
                    <summary style="cursor:pointer; font-weight:600; color:#1d2327;">Required template structure</summary>
                    <p style="margin:8px 0 4px; color:#555; font-size:12px;">Your block template <strong>must</strong> use these <code>data-embla-*</code> attributes so the slider initialises correctly regardless of CSS class names:</p>
                    <pre style="background:#1e1e1e; color:#d4d4d4; padding:12px; border-radius:4px; font-size:11px; overflow-x:auto; line-height:1.5; margin:0;">&lt;!-- Outer slider root (rendered by the generator as .bf-block-{slug}) --&gt;
&lt;div class="gk-block-wrapper"&gt;

  &lt;!-- Viewport: overflow:hidden — Embla attaches here --&gt;
  &lt;div class="my-slider-viewport" data-embla-viewport&gt;

    &lt;!-- Track: display:flex — slides are direct children --&gt;
    &lt;div class="my-slider-track"&gt;
      {{#each slides}}
        &lt;div class="my-slide"&gt;...&lt;/div&gt;
      {{/each}}
    &lt;/div&gt;

  &lt;/div&gt;

  &lt;!-- Optional controls --&gt;
  &lt;button data-embla-prev&gt;Prev&lt;/button&gt;
  &lt;button data-embla-next&gt;Next&lt;/button&gt;

  &lt;!-- Optional dot navigation --&gt;
  &lt;div data-embla-dots&gt;
    &lt;button data-embla-dot&gt;&lt;/button&gt;
    &lt;button data-embla-dot&gt;&lt;/button&gt;
  &lt;/div&gt;

&lt;/div&gt;</pre>
                    <p style="margin:8px 0 0; color:#555; font-size:12px;">The CSS for the viewport needs <code>overflow: hidden</code> and the track needs <code>display: flex</code>. Do <strong>not</strong> add <code>transition: transform</code> on the track — Embla handles animation internally.</p>
                </details>
            </div>

            <!-- Accordion options -->
            <div id="bf-script-opts-accordion" class="bf-script-opts" style="display:none; background:#f9f9f9; border:1px solid #e2e8f0; border-radius:4px; padding:12px; margin-top:6px;">
                <strong style="display:block; margin-bottom:8px;">Accordion Options</strong>
                <label style="display:block; margin-bottom:6px;">
                    Block Wrapper Selector
                    <input type="text" name="block_script_selector" value="" placeholder=".gk-accordion" class="gutenkit-input" style="margin-top:4px;">
                    <span class="description">CSS class on the block's root element. Leave blank to auto-generate.</span>
                </label>
                <label style="display:inline-flex; align-items:center; gap:6px; margin-top:4px;">
                    <input type="checkbox" name="block_script_accordion_single" value="1"> Close others when one opens
                </label>
            </div>

            <!-- AJAX options -->
            <div id="bf-script-opts-ajax" class="bf-script-opts" style="display:none; background:#f9f9f9; border:1px solid #e2e8f0; border-radius:4px; padding:12px; margin-top:6px;">
                <strong style="display:block; margin-bottom:8px;">AJAX Options</strong>
                <label style="display:block; margin-bottom:6px;">
                    Block Wrapper Selector
                    <input type="text" name="block_script_selector" value="" placeholder=".gk-ajax-block" class="gutenkit-input" style="margin-top:4px;">
                </label>
                <label style="display:block; margin-bottom:6px;">
                    REST Endpoint / WP Action
                    <input type="text" name="block_script_ajax_action" value="" placeholder="my-plugin/v1/data" class="gutenkit-input" style="margin-top:4px;">
                    <span class="description">WP REST route (e.g. <code>my-plugin/v1/data</code>) or admin-ajax action name.</span>
                </label>
            </div>

            <!-- Custom JS options -->
            <div id="bf-script-opts-custom" class="bf-script-opts" style="display:none; background:#f9f9f9; border:1px solid #e2e8f0; border-radius:4px; padding:12px; margin-top:6px;">
                <strong style="display:block; margin-bottom:8px;">Custom JS</strong>
                <label style="display:block;">
                    JavaScript code (runs on DOMContentLoaded on the frontend)
                    <textarea name="block_script_custom_code" rows="6" class="gutenkit-input" style="margin-top:4px; font-family:monospace; font-size:12px;" placeholder="// document.querySelectorAll('.gk-my-block').forEach(el => { ... });"></textarea>
                </label>
            </div>
        </div>

        <div class="gutenkit-form-actions">
            <button type="submit" name="submit" id="submit" class="gutenkit-btn gutenkit-btn-primary">
                <span class="dashicons dashicons-plus-alt2"></span> Generate New Gutenberg Block
            </button>
        </div>
    </form>

    <script>
    function bfToggleScriptOptions(radio) {
        document.querySelectorAll('.bf-script-opts').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.bf-script-type-label').forEach(el => {
            el.style.borderColor = '#ddd';
            el.style.background = '#fff';
        });
        if (radio.value) {
            var opts = document.getElementById('bf-script-opts-' + radio.value);
            if (opts) opts.style.display = 'block';
            radio.closest('.bf-script-type-label').style.borderColor = '#007cba';
            radio.closest('.bf-script-type-label').style.background = '#f0f6fc';
        }
    }
    </script>
</div>