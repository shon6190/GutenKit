<?php
/**
 * Main Loader Class
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_Loader {

	public function __construct() {
		$this->define_constants();
		$this->includes();
		$this->init_hooks();
	}

	private function define_constants() {
		if ( ! defined( 'BLOCK_FACTORY_PATH' ) ) {
			define( 'BLOCK_FACTORY_PATH', plugin_dir_path( dirname( __FILE__ ) ) );
		}
		if ( ! defined( 'BLOCK_FACTORY_URL' ) ) {
			define( 'BLOCK_FACTORY_URL', plugin_dir_url( dirname( __FILE__ ) ) );
		}
		if ( ! defined( 'BLOCKS_BASE_PATH' ) ) {
			define( 'BLOCKS_BASE_PATH', BLOCK_FACTORY_PATH . 'blocks/' );
		}
		if ( ! defined( 'BUILD_BASE_PATH' ) ) {
			define( 'BUILD_BASE_PATH', BLOCK_FACTORY_PATH . 'build/' );
		}
	}

	private function includes() {
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-register.php';
		require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-generator.php';

		if ( is_admin() ) {
			require_once BLOCK_FACTORY_PATH . 'includes/class-gutenkit-admin.php';
		}
	}

	private function init_hooks() {
		// Instantiate Registration
		$registrar = new GutenKit_Register();
		
		// Instantiate Generator (AJAX handlers)
		$generator = new GutenKit_Generator();

		// Instantiate Admin UI
		if ( is_admin() ) {
			new GutenKit_Admin();
		}
	}
}
