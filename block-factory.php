<?php
/**
 * Plugin Name: Block Factory
 * Description: A tool to quickly generate Gutenberg block boilerplate files. (Built with GutenKit)
 * Version: 2.0
 * Author: Your Name
 *
 * Notes:
 * - Refactored to use object-oriented structure.
 * - Logic moved to includes/ directory.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Include Loader
require_once plugin_dir_path( __FILE__ ) . 'includes/class-gutenkit-loader.php';

// Initialize
new GutenKit_Loader();