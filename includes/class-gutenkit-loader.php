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
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-register.php';
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

		// Instantiate Generator (AJAX handlers)
		$generator = new GutenKit_Generator();

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
		$node_env = self::detect_node_environment();
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

	private static function detect_node_environment()
	{
		$node_path = '';
		$npm_cmd = 'npm'; // Default

		// 1. Check for constant override
		if (defined('WP_BLOCK_FACTORY_NODE_PATH')) {
			$node_path = WP_BLOCK_FACTORY_NODE_PATH;
		}

		// 2. Attempt to find node using 'where' (Windows) or 'which' (Linux/Mac)
		if (empty($node_path)) {
			$cmd = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'where node' : 'which node';
			exec($cmd, $output, $return_var);
			if ($return_var === 0 && !empty($output)) {
				$node_executable = $output[0];
				$node_path = dirname($node_executable);
			}
		}

		// 3. Common fallback paths
		if (empty($node_path)) {
			$common_paths = [
				'/usr/local/bin',
				'/usr/bin',
				'/opt/homebrew/bin',
				'C:\\Program Files\\nodejs',
				'C:\\Program Files (x86)\\nodejs'
			];
			foreach ($common_paths as $path) {
				$check_file = $path . ((strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? '\\node.exe' : '/node');
				if (file_exists($check_file)) {
					$node_path = $path;
					break;
				}
			}
		}

		// Determine npm command based on node path
		if (!empty($node_path)) {
			// Check if we are on Windows
			if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
				$npm_cmd = '"' . $node_path . '\\npm.cmd"';
			} else {
				$npm_cmd = '"' . $node_path . '/npm"';
			}
		}

		return [
			'node_dir' => $node_path,
			'npm_cmd' => $npm_cmd
		];
	}
}
