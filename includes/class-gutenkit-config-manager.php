<?php
/**
 * ConfigManager — owns the save-structure AJAX endpoint and config.json I/O.
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_ConfigManager {

	/** @var GutenKit_CheatSheet|null */
	private $cheat_sheet = null;

	/** @var GutenKit_Generator|null Temporary transition bridge — removed in Task 5 */
	private $generator = null;

	public function __construct() {
		add_action( 'wp_ajax_block_factory_save_structure', array( $this, 'handle_save_structure' ) );
	}

	/**
	 * Inject the CheatSheet dependency.
	 */
	public function set_cheat_sheet( GutenKit_CheatSheet $cheat_sheet ) {
		$this->cheat_sheet = $cheat_sheet;
	}

	/**
	 * Inject the Generator dependency (transition bridge).
	 */
	public function set_generator( $generator ) {
		$this->generator = $generator;
	}

	/**
	 * AJAX handler: wp_ajax_block_factory_save_structure
	 *
	 * Saves config.json, triggers file regeneration (transition), and returns cheat-sheet HTML.
	 */
	public function handle_save_structure() {
		// Nonce action MUST match class-gutenkit-admin.php line 101
		if (
			! isset( $_POST['nonce'] ) ||
			! wp_verify_nonce( $_POST['nonce'], 'block_factory_save_structure_action' ) ||
			! current_user_can( 'manage_options' )
		) {
			wp_send_json_error( array( 'message' => 'Security check failed.' ) );
		}

		$block_slug      = isset( $_POST['block_slug'] ) ? sanitize_title( $_POST['block_slug'] ) : '';
		$config_data_json = isset( $_POST['config_data'] ) ? wp_unslash( $_POST['config_data'] ) : '';

		if ( empty( $block_slug ) || empty( $config_data_json ) ) {
			wp_send_json_error( array( 'message' => 'Missing data.' ) );
		}

		$config_data = json_decode( $config_data_json, true );

		if ( is_null( $config_data ) ) {
			wp_send_json_error( array( 'message' => 'Invalid JSON.' ) );
		}

		// Save config (merge, hash check, backup/restore)
		$result = $this->save( $block_slug, $config_data );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ) );
		}

		// TRANSITION: Call Generator for file regeneration until Tasks 4-5 remove this
		$regen_skipped = false;
		if ( $result === 'unchanged' ) {
			$regen_skipped = true;
		} elseif ( $this->generator ) {
			$this->generator->regenerate_files_from_config( $block_slug, $config_data );
		}

		// Generate cheat sheet
		$cheat_sheet_html = '';
		if ( $this->cheat_sheet && ! empty( $config_data['fields'] ) ) {
			$cheat_sheet_html = $this->cheat_sheet->generate( $config_data['fields'] );
			$this->cheat_sheet->write( $block_slug, $config_data['fields'] );
		}

		$this->delete_transient_cache();

		$unchanged_note = $regen_skipped ? ' (files already up to date, skipped regeneration)' : '';
		wp_send_json_success( array(
			'message'     => 'Block structure saved!' . $unchanged_note,
			'next_step'   => 'Run build.',
			'cheat_sheet' => $cheat_sheet_html,
		) );
	}

	/**
	 * Save config.json with merge, hash check, backup/restore, and file locking.
	 *
	 * @param string $slug       Block slug.
	 * @param array  $configData Config data array (will be merged with existing).
	 * @return true|string|WP_Error  true on write, 'unchanged' if hash matches, WP_Error on failure.
	 */
	public function save( $slug, &$configData ) {
		$block_dir   = BLOCKS_BASE_PATH . $slug . '/';
		$config_path = $block_dir . 'config.json';

		$filesystem = $this->get_filesystem();
		if ( ! $filesystem ) {
			return new WP_Error( 'filesystem', 'Could not initialize WP_Filesystem.' );
		}

		// Load existing config to merge (preserves `scripts` key)
		if ( $filesystem->exists( $config_path ) ) {
			$existing = json_decode( $filesystem->get_contents( $config_path ), true );
			if ( is_array( $existing ) ) {
				$configData = array_merge( $existing, $configData );
			}
		}

		// Config hash check — skip write if unchanged
		$new_hash  = md5( wp_json_encode( $configData ) );
		$hash_path = $block_dir . '.config_hash';
		if ( $filesystem->exists( $hash_path ) ) {
			$old_hash = trim( $filesystem->get_contents( $hash_path ) );
			if ( $old_hash === $new_hash ) {
				return 'unchanged';
			}
		}

		// Backup before write
		$this->backup( $slug );

		// File lock using separate .lock file (mutex pattern)
		$json      = wp_json_encode( $configData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
		$lock_path = $block_dir . '.config.lock';
		$lock_handle = fopen( $lock_path, 'w' );
		if ( ! $lock_handle ) {
			$this->restore( $slug );
			return new WP_Error( 'lock', 'Could not create lock file.' );
		}

		if ( ! flock( $lock_handle, LOCK_EX ) ) {
			fclose( $lock_handle );
			$this->restore( $slug );
			return new WP_Error( 'lock', 'Could not acquire file lock.' );
		}

		$write_result = $filesystem->put_contents( $config_path, $json, FS_CHMOD_FILE );
		flock( $lock_handle, LOCK_UN );
		fclose( $lock_handle );

		if ( ! $write_result ) {
			$this->restore( $slug );
			return new WP_Error( 'write', 'Failed to write config.json.' );
		}

		// Update hash
		$filesystem->put_contents( $hash_path, $new_hash, FS_CHMOD_FILE );

		// Cleanup backup on success
		$this->cleanup_backup( $slug );

		return true;
	}

	/**
	 * Load config.json for a block.
	 *
	 * @param string $slug Block slug.
	 * @return array|null Config data or null if not found.
	 */
	public function load( $slug ) {
		$config_path = BLOCKS_BASE_PATH . $slug . '/config.json';
		$filesystem  = $this->get_filesystem();
		if ( ! $filesystem || ! $filesystem->exists( $config_path ) ) {
			return null;
		}
		$data = json_decode( $filesystem->get_contents( $config_path ), true );
		return is_array( $data ) ? $data : null;
	}

	/**
	 * Clear the blocks transient cache.
	 */
	public function delete_transient_cache() {
		delete_transient( 'gutenkit_blocks_cache' );
	}

	// --- Backup / Restore ---

	/** @var string */
	private $_backup_dir;

	/** @var string */
	private $_backup_source;

	/**
	 * Back up config.json before a write.
	 */
	private function backup( $slug ) {
		$source_dir = BLOCKS_BASE_PATH . $slug . '/';
		$backup_dir = BLOCKS_BASE_PATH . $slug . '/.backup_' . time() . '/';
		$filesystem = $this->get_filesystem();
		if ( ! $filesystem ) {
			return;
		}
		if ( ! $filesystem->is_dir( $backup_dir ) ) {
			$filesystem->mkdir( $backup_dir, FS_CHMOD_DIR );
		}
		if ( $filesystem->exists( $source_dir . 'config.json' ) ) {
			$filesystem->copy( $source_dir . 'config.json', $backup_dir . 'config.json', true );
		}
		$this->_backup_dir    = $backup_dir;
		$this->_backup_source = $source_dir;
	}

	/**
	 * Restore config.json from backup.
	 */
	private function restore( $slug ) {
		if ( empty( $this->_backup_dir ) ) {
			return;
		}
		$filesystem = $this->get_filesystem();
		if ( ! $filesystem ) {
			return;
		}
		if ( $filesystem->exists( $this->_backup_dir . 'config.json' ) ) {
			$filesystem->copy( $this->_backup_dir . 'config.json', $this->_backup_source . 'config.json', true );
		}
		$this->cleanup_backup_dir();
	}

	/**
	 * Clean up backup after successful write.
	 */
	private function cleanup_backup( $slug ) {
		$this->cleanup_backup_dir();
	}

	/**
	 * Remove the backup directory.
	 */
	private function cleanup_backup_dir() {
		if ( empty( $this->_backup_dir ) ) {
			return;
		}
		$filesystem = $this->get_filesystem();
		if ( $filesystem && $filesystem->is_dir( $this->_backup_dir ) ) {
			$filesystem->delete( $this->_backup_dir, true );
		}
	}

	/**
	 * Returns an initialised WP_Filesystem instance.
	 *
	 * @return WP_Filesystem_Base|null
	 */
	private function get_filesystem() {
		global $wp_filesystem;
		if ( ! $wp_filesystem ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}
		return $wp_filesystem ? $wp_filesystem : null;
	}
}
