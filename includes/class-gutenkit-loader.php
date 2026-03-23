<?php
/**
 * Main Loader Class
 *
 * @package GutenKit
 */

if (!defined('ABSPATH')) {
	exit;
}

class GutenKit_Loader
{

	public function __construct()
	{
		$this->define_constants();
		$this->includes();
		$this->init_hooks();
	}

	private function define_constants()
	{
		if (!defined('BLOCK_FACTORY_PATH')) {
			define('BLOCK_FACTORY_PATH', plugin_dir_path(dirname(__FILE__)));
		}
		if (!defined('BLOCK_FACTORY_URL')) {
			define('BLOCK_FACTORY_URL', plugin_dir_url(dirname(__FILE__)));
		}
		if (!defined('BLOCKS_BASE_PATH')) {
			define('BLOCKS_BASE_PATH', BLOCK_FACTORY_PATH . 'blocks/');
		}
		if (!defined('BUILD_BASE_PATH')) {
			define('BUILD_BASE_PATH', BLOCK_FACTORY_PATH . 'build/');
		}
	}

	private function includes()
	{
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-node-environment.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-register.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-cheat-sheet.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-config-manager.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-block-creator.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-block-builder.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-generator.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-ai.php';

		if (is_admin()) {
			require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-admin.php';
		}
	}

	private function init_hooks()
	{
		// Instantiate Registration
		$registrar = new GutenKit_Register();

		// Node environment (shared dependency)
		$this->node_env = new GutenKit_NodeEnvironment();
		$this->node_env->detect();

		// Instantiate ConfigManager + CheatSheet (owns save-structure endpoint)
		$cheat_sheet    = new GutenKit_CheatSheet();
		$config_manager = new GutenKit_ConfigManager();
		$config_manager->set_cheat_sheet( $cheat_sheet );

		// Instantiate BlockCreator (create / delete block endpoints)
		$block_creator = new GutenKit_BlockCreator();

		// Instantiate BlockBuilder (npm build / install endpoints)
		$block_builder = new GutenKit_BlockBuilder( $this->node_env );

		// Instantiate Generator (file regeneration only)
		$generator = new GutenKit_Generator();

		// Transition bridge: ConfigManager delegates file regen to Generator
		$config_manager->set_generator( $generator );

		// Instantiate AI Module
		$ai = new GutenKit_AI();

		// Instantiate Admin UI
		if (is_admin()) {
			new GutenKit_Admin();
		}
	}

	public static function activate()
	{
		// Define constants if not already defined (might not be if called early)
		if (!defined('BLOCK_FACTORY_PATH')) {
			define('BLOCK_FACTORY_PATH', plugin_dir_path(dirname(__FILE__)));
		}

		// Ensure NodeEnvironment class is available when activate() is called statically
		// (e.g. via register_activation_hook, before the constructor runs includes())
		if ( ! class_exists( 'GutenKit_NodeEnvironment' ) ) {
			require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-node-environment.php';
		}

		$node_modules = BLOCK_FACTORY_PATH . 'node_modules';
		$pkg_json     = BLOCK_FACTORY_PATH . 'package.json';
		$hash_file    = BLOCK_FACTORY_PATH . '.npm_pkg_hash';

		// Determine whether an install is actually needed:
		// 1. node_modules directory is missing, OR
		// 2. package.json has changed since the last successful install
		$needs_install = ! is_dir( $node_modules );

		if ( ! $needs_install && file_exists( $pkg_json ) ) {
			$current_hash = md5_file( $pkg_json );
			$stored_hash  = file_exists( $hash_file ) ? trim( file_get_contents( $hash_file ) ) : ''; // phpcs:ignore
			if ( $current_hash !== $stored_hash ) {
				$needs_install = true;
			}
		}

		if ( $needs_install ) {
			self::install_dependencies();

			// Record the package.json hash so future activations skip redundant installs
			if ( file_exists( $pkg_json ) ) {
				file_put_contents( $hash_file, md5_file( $pkg_json ) ); // phpcs:ignore
			}
		}
	}

	private static function install_dependencies()
	{
		$node_environment = new GutenKit_NodeEnvironment();
		$node_env = $node_environment->detect();
		$npm_cmd = $node_env['npm_cmd'];
		$node_dir = $node_env['node_dir'];

		// Verify we have a command
		if (empty($npm_cmd)) {
			error_log('GutenKit Activation: Could not detect npm.');
			return;
		}

		// Prepare Command
		$plugin_dir = BLOCK_FACTORY_PATH;
		$cmd_prefix = '';

		// Add Node to PATH
		if ($node_dir) {
			$path_sep = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? ';' : ':';
			$current_path = getenv('PATH');
			putenv("PATH=$node_dir$path_sep$current_path");
		}

		// Command to run
		$cmd = "cd " . escapeshellarg($plugin_dir) . " && $npm_cmd install 2>&1";

		// Execute
		exec($cmd, $output, $return_var);

		if ($return_var !== 0) {
			error_log('GutenKit Activation: npm install failed. Output: ' . implode("\n", $output));
		} else {
			error_log('GutenKit Activation: npm install successful.');
		}
	}

}
