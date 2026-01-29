<?php
/**
 * Admin UI Handler
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'router' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	public function add_menu() {
		add_menu_page(
			'Block Factory',
			'Block Factory',
			'manage_options',
			'block-factory',
			array( $this, 'render_dashboard' ),
			'dashicons-code-standards',
			25
		);
	}

	public function enqueue_scripts( $hook ) {
		// Generic Admin Scripts
		wp_enqueue_script( 'jquery' );

		// Custom Admin Script (for Deletion, etc.)
		wp_enqueue_script(
			'gutenkit-admin-script',
			BLOCK_FACTORY_URL . 'assets/js/admin.js',
			array( 'jquery' ),
			'1.0',
			true
		);

		wp_localize_script(
			'gutenkit-admin-script',
			'blockFactoryAdmin',
			array(
				'ajaxurl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'block_factory_nonce' ),
			)
		);
	}

	public function router() {
		// Serve the component editor (React app)
		if ( isset( $_GET['page'] ) && $_GET['page'] === 'block-factory' ) {
			if ( isset( $_GET['action'] ) && $_GET['action'] === 'edit_structure' && isset( $_GET['block_slug'] ) ) {
				$this->render_editor();
			}
		}
	}

	private function render_editor() {
		require_once( ABSPATH . 'wp-admin/admin-header.php' );

		$block_slug = sanitize_title( $_GET['block_slug'] );

		// Read Config
		$config = array( 'fields' => array() );
		$config_file = BLOCKS_BASE_PATH . $block_slug . '/config.json';
		if ( file_exists( $config_file ) ) {
			$config = json_decode( file_get_contents( $config_file ), true ) ?: array( 'fields' => array() );
		}

		$nonce = wp_create_nonce( 'block_factory_save_structure_action' );
		$script_handle = 'block-factory-editor-app';

		// Enqueue React Editor
		$editor_app_path = BLOCK_FACTORY_PATH . 'admin/js/editor-app.js';
		$editor_app_url  = BLOCK_FACTORY_URL . 'admin/js/editor-app.js';

		if ( file_exists( $editor_app_path ) ) {
			wp_enqueue_script(
				$script_handle,
				$editor_app_url,
				array( 'jquery', 'wp-element', 'wp-components' ),
				filemtime( $editor_app_path ),
				true
			);

			wp_localize_script( $script_handle, 'blockFactoryEditor', array(
				'config'    => $config,
				'blockSlug' => $block_slug,
				'nonce'     => $nonce,
				'ajaxurl'   => admin_url( 'admin-ajax.php' ),
			) );
		} else {
			echo '<div class="notice notice-warning"><p>GutenKit: Admin editor-app.js missing. Run build.</p></div>';
		}

		// Include View Wrapper
		$view = BLOCK_FACTORY_PATH . 'admin/component-editor.php';
		if ( file_exists( $view ) ) {
			include( $view );
		} else {
			echo '<div class="notice notice-error"><p>GutenKit: component-editor.php missing.</p></div>';
		}

		require_once( ABSPATH . 'wp-admin/admin-footer.php' );
		exit;
	}

	public function render_dashboard() {
		?>
		<div class="wrap">
			<h1>GutenKit Dashboard</h1>
			<?php
			$blocks_directory = BLOCKS_BASE_PATH;
			// Use the same search logic (glob) or just list from blocks dir
			$block_folders = glob( $blocks_directory . '*', GLOB_ONLYDIR );

			if ( empty( $block_folders ) ) {
				echo '<p>No blocks found. Use the generator form to create one!</p>';
				include( BLOCK_FACTORY_PATH . 'admin/generator-form.php' );
				return;
			}

			echo '<h2>Existing Blocks</h2>';
			echo '<table class="wp-list-table widefat fixed striped">';
			echo '<thead><tr><th>Name</th><th>Slug</th><th>Actions</th></tr></thead>';
			echo '<tbody>';

			foreach ( $block_folders as $block_path ) {
				$block_slug = basename( $block_path );
				$block_name = ucwords( str_replace( '-', ' ', $block_slug ) );
				$edit_url   = admin_url( 'admin.php?page=block-factory&action=edit_structure&block_slug=' . $block_slug );

				echo '<tr>';
				echo '<td><strong>' . esc_html( $block_name ) . '</strong></td>';
				echo '<td><code>' . esc_html( $block_slug ) . '</code></td>';
				echo '<td><a href="' . esc_url( $edit_url ) . '">Edit Structure</a>';
				
				// Delete Button
				echo ' | <a href="#" 
					class="block-factory-delete-btn" 
					data-slug="' . esc_attr( $block_slug ) . '" 
					style="color: red;"
					title="Permanently delete all files for this block."
					>Delete</a></td>';
				echo '</tr>';
			}

			echo '</tbody></table>';
			include( BLOCK_FACTORY_PATH . 'admin/generator-form.php' );
			?>
		</div>
		<?php
	}
}
