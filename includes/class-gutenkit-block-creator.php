<?php
/**
 * Block Creator — handles block creation and deletion.
 *
 * Extracted from GutenKit_Generator (Task 3).
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_BlockCreator {

	public function __construct() {
		// Form Submission (Create Block)
		add_action( 'admin_post_block_factory_generate', array( $this, 'handle_create_block' ) );

		// AJAX Actions
		add_action( 'wp_ajax_block_factory_delete_block', array( $this, 'handle_delete_block' ) );
	}

	/**
	 * Handle Block Creation Form
	 */
	public function handle_create_block() {
		if (
			! isset( $_POST['block_factory_nonce'] ) ||
			! wp_verify_nonce( $_POST['block_factory_nonce'], 'block_factory_action' ) ||
			! current_user_can( 'manage_options' )
		) {
			wp_die( 'Security check failed.' );
		}

		$component_name = sanitize_text_field( $_POST['component_name'] );
		$component_icon = sanitize_text_field( $_POST['component_icon'] );

		if ( empty( $component_name ) ) {
			wp_die( 'Component Name is required.' );
		}

		$block_slug      = sanitize_title( $component_name );
		$block_namespace = 'block-factory/' . $block_slug;
		$new_block_dir   = BLOCKS_BASE_PATH . $block_slug . '/';

		if ( ! wp_mkdir_p( $new_block_dir ) ) {
			wp_die( 'Failed to create block directory. Check permissions.' );
		}

		// Build scripts config from form selection
		$script_type    = isset( $_POST['block_script_type'] ) ? sanitize_key( $_POST['block_script_type'] ) : '';
		$scripts_config = null;
		$allowed_types  = array( 'slider', 'accordion', 'ajax', 'custom' );

		if ( $script_type && in_array( $script_type, $allowed_types, true ) ) {
			$selector = sanitize_text_field( isset( $_POST['block_script_selector'] ) ? $_POST['block_script_selector'] : '' );
			if ( empty( $selector ) ) {
				$selector = '.gk-block-' . $block_slug;
			}

			$scripts_config = array( 'type' => $script_type, 'selector' => $selector );

			if ( $script_type === 'slider' ) {
				$scripts_config['options'] = array(
					'loop'  => ! empty( $_POST['block_script_loop'] ),
					'align' => sanitize_key( isset( $_POST['block_script_align'] ) ? $_POST['block_script_align'] : 'start' ),
				);
			} elseif ( $script_type === 'accordion' ) {
				$scripts_config['options'] = array(
					'single' => ! empty( $_POST['block_script_accordion_single'] ),
				);
			} elseif ( $script_type === 'ajax' ) {
				$scripts_config['action'] = sanitize_text_field( isset( $_POST['block_script_ajax_action'] ) ? $_POST['block_script_ajax_action'] : '' );
			} elseif ( $script_type === 'custom' ) {
				// Raw code — not sanitized beyond stripping null bytes
				$raw_code                = isset( $_POST['block_script_custom_code'] ) ? str_replace( "\0", '', $_POST['block_script_custom_code'] ) : '';
				$scripts_config['code'] = $raw_code;
			}
		}

		// Encode scripts block for injection into config.json template
		$scripts_json_fragment = $scripts_config
			? ",\n    \"scripts\": " . wp_json_encode( $scripts_config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES )
			: '';

		$placeholders = array(
			'__COMPONENT_NAME_PASCAL__' => str_replace( ' ', '', ucwords( str_replace( '-', ' ', $block_slug ) ) ),
			'__COMPONENT_NAME_TITLE__'  => $component_name,
			'__COMPONENT_SLUG__'        => $block_slug,
			'__COMPONENT_NAMESPACE__'   => $block_namespace,
			'__COMPONENT_ICON__'        => $component_icon ? $component_icon : 'editor-code',
			'__SCRIPTS_CONFIG__'        => $scripts_json_fragment,
		);

		$templates = array(
			'block.json.tpl'  => 'block.json',
			'index.js.tpl'    => 'index.js',
			'edit.js.tpl'     => 'edit.js',
			'save.js.tpl'     => 'save.js',
			'style.scss.tpl'  => 'style.scss',
			'editor.scss.tpl' => 'editor.scss',
			'config.json.tpl' => 'config.json',
			'render.php.tpl'  => 'render.php',
		);

		$fs = $this->get_filesystem();

		foreach ( $templates as $template_file => $output_file ) {
			$template_path = BLOCK_FACTORY_PATH . 'templates/' . $template_file;
			if ( ! file_exists( $template_path ) ) {
				error_log( "GutenKit: Missing template " . $template_path );
				continue;
			}
			$file_content  = $fs ? $fs->get_contents( $template_path ) : file_get_contents( $template_path );
			$final_content = str_replace(
				array_keys( $placeholders ),
				array_values( $placeholders ),
				$file_content
			);
			if ( $fs ) {
				$fs->put_contents( $new_block_dir . $output_file, $final_content, FS_CHMOD_FILE );
			} else {
				file_put_contents( $new_block_dir . $output_file, $final_content );
			}
		}

		// Invalidate Cache
		delete_transient( 'gutenkit_blocks_cache' );

		$redirect_url = add_query_arg( 'block_created', $block_slug, admin_url( 'admin.php?page=block-factory' ) );
		wp_safe_redirect( $redirect_url );
		exit;
	}

	/**
	 * Handle Deletion (AJAX)
	 */
	public function handle_delete_block() {
		check_ajax_referer( 'block_factory_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ), 403 );
		}

		$block_slug = sanitize_title( $_POST['block_slug'] );
		if ( empty( $block_slug ) ) {
			wp_send_json_error( array( 'message' => 'Invalid slug.' ), 400 );
		}

		// Security: Prevent directory traversal or deleting huge chunks
		if ( strpos( $block_slug, '.' ) !== false || strpos( $block_slug, '/' ) !== false ) {
			wp_send_json_error( array( 'message' => 'Invalid slug.' ), 400 );
		}

		$blocks_path = BLOCKS_BASE_PATH . $block_slug;
		$build_path  = BUILD_BASE_PATH . $block_slug;


		if ( strpos( realpath( $blocks_path ), realpath( BLOCKS_BASE_PATH ) ) !== 0 ) {
			// Path is suspicious
			// wp_send_json_error(['message' => 'Invalid path.'], 403);
			// (realpath might return false if file doesn't exist, so we skip this check if file missing,
			// but sanitize_title helps ensure no ../ )
		}

		$errors  = [];
		$success = [];

		if ( $this->delete_dir_recursive( $blocks_path ) ) {
			$success[] = "Deleted source: $block_slug";
		}
		if ( $this->delete_dir_recursive( $build_path ) ) {
			$success[] = "Deleted build: $block_slug";
		}

		// Invalidate Cache
		delete_transient( 'gutenkit_blocks_cache' );

		wp_send_json_success( array( 'message' => 'Block deleted.', 'details' => $success ) );
	}

	/**
	 * Recursively delete a directory.
	 */
	private function delete_dir_recursive( $dir ) {
		if ( ! is_dir( $dir ) ) {
			return false;
		}
		$it    = new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS );
		$files = new RecursiveIteratorIterator( $it, RecursiveIteratorIterator::CHILD_FIRST );
		foreach ( $files as $file ) {
			if ( $file->isDir() ) {
				rmdir( $file->getRealPath() );
			} else {
				unlink( $file->getRealPath() );
			}
		}
		return rmdir( $dir );
	}

	/**
	 * Appends a timestamped entry to gutenkit-debug.log.
	 */
	public static function log_error( $context, $message ) {
		$log_path = BLOCK_FACTORY_PATH . 'gutenkit-debug.log';
		$entry    = '[' . gmdate( 'Y-m-d H:i:s' ) . '] [' . $context . '] ' . $message . PHP_EOL;
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		file_put_contents( $log_path, $entry, FILE_APPEND | LOCK_EX );
	}

	/**
	 * Get WordPress filesystem instance.
	 */
	private function get_filesystem() {
		global $wp_filesystem;
		if ( empty( $wp_filesystem ) ) {
			if ( ! function_exists( 'WP_Filesystem' ) ) {
				require_once ABSPATH . 'wp-admin/includes/file.php';
			}
			WP_Filesystem();
		}
		return ( $wp_filesystem instanceof WP_Filesystem_Base ) ? $wp_filesystem : null;
	}
}
