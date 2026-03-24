<?php
// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

if (!isset($_GET['block_slug'])) {
    wp_die('Error: Block slug not provided for editing.', 'Missing Block Slug');
}

$block_slug = sanitize_title($_GET['block_slug']);
$block_name = ucwords(str_replace('-', ' ', $block_slug));
$dashboard_url = admin_url('admin.php?page=block-factory');
?>

<div class="wrap gutenkit-wrap gk-editor-shell">

    <!-- Breadcrumb + Hero -->
    <div class="gutenkit-header-editor">
        <div class="gk-page-hero">
            <nav class="gk-breadcrumb">
                <a href="<?php echo esc_url($dashboard_url); ?>">Dashboard</a>
                <span class="gk-breadcrumb__sep material-symbols-outlined" style="font-size:14px;">chevron_right</span>
                <span class="gk-breadcrumb__current"><?php echo esc_html($block_name); ?></span>
            </nav>
            <h1 class="gk-page-hero__title">Build your structure.</h1>
            <p class="gk-page-hero__subtitle">Define the fields that editors will fill in for the <strong><?php echo esc_html($block_name); ?></strong> block.</p>

            <div class="gk-step-indicator">
                <div class="gk-step-indicator__item is-active">
                    <span class="gk-step-indicator__dot"></span>
                    Step 1: Fields
                </div>
                <div class="gk-step-indicator__connector"></div>
                <div class="gk-step-indicator__item" id="gk-step2-indicator">
                    <span class="gk-step-indicator__dot"></span>
                    Step 2: Template
                </div>
            </div>
        </div>
    </div>

    <!-- React Editor Root -->
    <div class="gutenkit-editor-container">
        <div id="component-editor-root">
            <div class="gutenkit-loading">
                <span class="spinner is-active"></span> Loading editor...
            </div>
        </div>
    </div>

</div>

<script>
// Update step indicator when React app advances to step 2
(function() {
    var observer = new MutationObserver(function() {
        var root = document.getElementById('component-editor-root');
        if (!root) return;
        // Detect step 2 by presence of the template editor textarea
        var isStep2 = !!root.querySelector('#bf-html-template-area');
        var step1 = document.querySelector('.gk-step-indicator .gk-step-indicator__item:first-child');
        var step2 = document.getElementById('gk-step2-indicator');
        if (!step1 || !step2) return;
        if (isStep2) {
            step1.classList.remove('is-active');
            step1.classList.add('is-complete');
            step2.classList.add('is-active');
        } else {
            step1.classList.add('is-active');
            step1.classList.remove('is-complete');
            step2.classList.remove('is-active');
        }
    });
    document.addEventListener('DOMContentLoaded', function() {
        var root = document.getElementById('component-editor-root');
        if (root) observer.observe(root, { childList: true, subtree: true });
    });
})();
</script>
