<?php
/**
 * Admin UI Handler
 *
 * @package GutenKit
 */

if (!defined('ABSPATH')) {
	exit;
}

class GutenKit_Admin
{

	public function __construct()
	{
		add_action('admin_menu', array($this, 'add_menu'));
		add_action('admin_init', array($this, 'router'));
		add_action('admin_enqueue_scripts', array($this, 'enqueue_scripts'));
		add_action('enqueue_block_editor_assets', array($this, 'enqueue_block_editor_assets'));
	}

	public function add_menu()
	{
		add_menu_page(
			'Block Factory',
			'Block Factory',
			'manage_options',
			'block-factory',
			array($this, 'render_dashboard'),
			'dashicons-code-standards',
			25
		);
	}

	public function enqueue_scripts($hook)
	{
		// Generic Admin Scripts
		wp_enqueue_script('jquery');

		// Custom Admin Script (for Deletion, etc.)
		wp_enqueue_script(
			'gutenkit-admin-script',
			BLOCK_FACTORY_URL . 'assets/js/admin.js',
			array('jquery'),
			'1.0',
			true
		);

		wp_localize_script(
			'gutenkit-admin-script',
			'blockFactoryAdmin',
			array(
				'ajaxurl' => admin_url('admin-ajax.php'),
				'nonce' => wp_create_nonce('block_factory_nonce'),
			)
		);

		// Google Fonts — Plus Jakarta Sans, Inter, Fira Code
		wp_enqueue_style(
			'gutenkit-google-fonts',
			'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap',
			array(),
			null
		);

		// Material Symbols Outlined
		wp_enqueue_style(
			'gutenkit-material-symbols',
			'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
			array(),
			null
		);

		// New modern UI styles
		wp_enqueue_style(
			'gutenkit-admin-ui-css',
			BLOCK_FACTORY_URL . 'assets/css/admin-ui.css',
			array('gutenkit-google-fonts', 'gutenkit-material-symbols'),
			filemtime(BLOCK_FACTORY_PATH . 'assets/css/admin-ui.css') ?: '2.0'
		);
	}

	public function enqueue_block_editor_assets()
	{
		wp_enqueue_style(
			'gutenkit-admin-css',
			BLOCK_FACTORY_URL . 'assets/css/gutenkit-admin.css',
			array(),
			filemtime(BLOCK_FACTORY_PATH . 'assets/css/gutenkit-admin.css')
		);
	}

	public function router()
	{
		// Serve the component editor (React app)
		if (isset($_GET['page']) && $_GET['page'] === 'block-factory') {
			if (isset($_GET['action']) && $_GET['action'] === 'edit_structure' && isset($_GET['block_slug'])) {
				$this->render_editor();
			}
		}
	}

	private function render_editor()
	{
		require_once(ABSPATH . 'wp-admin/admin-header.php');

		$block_slug = sanitize_title($_GET['block_slug']);

		// Read Config
		$config = array('fields' => array());
		$config_file = BLOCKS_BASE_PATH . $block_slug . '/config.json';
		if (file_exists($config_file)) {
			$config = json_decode(file_get_contents($config_file), true) ?: array('fields' => array());
		}

		$nonce = wp_create_nonce('block_factory_save_structure_action');
		$script_handle = 'block-factory-editor-app';

		// Pre-generate cheat sheet for existing fields
		$cheat_sheet_html = '';
		if ( ! empty( $config['fields'] ) ) {
			$cheat = new GutenKit_CheatSheet();
			$cheat_sheet_html = $cheat->generate( $config['fields'] );
		}

		// Enqueue React Editor
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

			wp_localize_script($script_handle, 'blockFactoryEditor', array(
				'config'     => $config,
				'blockSlug'  => $block_slug,
				'nonce'      => $nonce,
				'ajaxurl'    => admin_url('admin-ajax.php'),
				'cheatSheet' => $cheat_sheet_html,
			));
		} else {
			echo '<div class="notice notice-warning"><p>GutenKit: Admin editor-app.js missing. Run build.</p></div>';
		}

		// Include View Wrapper
		$view = BLOCK_FACTORY_PATH . 'admin/component-editor.php';
		if (file_exists($view)) {
			include($view);
		} else {
			echo '<div class="notice notice-error"><p>GutenKit: component-editor.php missing.</p></div>';
		}

		require_once(ABSPATH . 'wp-admin/admin-footer.php');
		exit;
	}

	public function render_dashboard()
	{
		$blocks_directory = BLOCKS_BASE_PATH;
		$block_folders    = glob( $blocks_directory . '*', GLOB_ONLYDIR );
		$block_count      = is_array( $block_folders ) ? count( $block_folders ) : 0;
		?>
		<div class="wrap gutenkit-wrap">

			<!-- Page Hero -->
			<div class="gk-page-hero">
				<h1 class="gk-page-hero__title">Manage your blocks.</h1>
				<p class="gk-page-hero__subtitle">Build, edit, and publish custom Gutenberg blocks — no boilerplate required.</p>
				<div class="gk-page-hero__meta">
					<span class="gk-badge gk-badge--primary">
						<span class="material-symbols-outlined" style="font-size:12px;">widgets</span>
						<?php echo esc_html( $block_count ); ?> block<?php echo $block_count !== 1 ? 's' : ''; ?>
					</span>
					<span class="gk-badge gk-badge--surface">Block Factory</span>
				</div>
			</div>

			<div class="gutenkit-dashboard-grid">
				<!-- Main: Block Cards -->
				<div class="gutenkit-main-content">
					<?php if ( empty( $block_folders ) ) : ?>
						<div class="gutenkit-empty-state">
							<span class="material-symbols-outlined" style="font-size:40px;display:block;margin:0 auto 14px;color:var(--gk-outline);">widgets</span>
							<h3>No blocks yet</h3>
							<p>Use the form on the right to create your first custom block.</p>
						</div>
					<?php else : ?>
						<p class="gk-section-title">Your Blocks</p>
						<div class="gutenkit-blocks-grid">
							<?php foreach ( $block_folders as $block_path ) :
								$block_slug = basename( $block_path );
								$block_name = ucwords( str_replace( '-', ' ', $block_slug ) );
								$edit_url   = admin_url( 'admin.php?page=block-factory&action=edit_structure&block_slug=' . $block_slug );

								// Read config to get icon
								$config_file = $block_path . '/config.json';
								$block_icon  = 'layout';
								if ( file_exists( $config_file ) ) {
									$cfg = json_decode( file_get_contents( $config_file ), true );
									if ( ! empty( $cfg['icon'] ) ) {
										$block_icon = esc_attr( $cfg['icon'] );
									}
								}
							?>
							<div class="gutenkit-block-card">
								<div class="gutenkit-block-card-header">
									<div class="gk-card-icon">
										<span class="dashicons dashicons-<?php echo esc_attr( $block_icon ); ?>"></span>
									</div>
									<div class="gk-card-title-group">
										<h3><?php echo esc_html( $block_name ); ?></h3>
										<span class="gk-badge gk-badge--success" style="font-size:10px;">Active</span>
									</div>
								</div>
								<div class="gutenkit-block-card-body">
									<code><?php echo esc_html( $block_slug ); ?></code>
								</div>
								<div class="gutenkit-block-card-actions">
									<a href="<?php echo esc_url( $edit_url ); ?>" class="button button-primary">Edit Structure</a>
									<button
										class="button block-factory-delete-btn gutenkit-delete-btn"
										data-slug="<?php echo esc_attr( $block_slug ); ?>"
										title="Permanently delete all files for this block."
									><span class="dashicons dashicons-trash"></span></button>
								</div>
							</div>
							<?php endforeach; ?>
						</div>
					<?php endif; ?>
				</div>

				<!-- Sidebar: Create Form -->
				<div class="gutenkit-sidebar">
					<?php include( BLOCK_FACTORY_PATH . 'admin/generator-form.php' ); ?>
				</div>
			</div>
		</div>
		<?php
	}
}
