<?php
/**
 * Block Registration Handler
 *
 * @package GutenKit
 */

if (!defined('ABSPATH')) {
	exit;
}

class GutenKit_Register
{

	public function __construct()
	{
		add_action('init', array($this, 'register_blocks'));
		// Shortcode support for backward compatibility or usage in posts
		add_shortcode('bf_block', array($this, 'handle_shortcode'));
	}

	public function register_blocks()
	{
		// 1. Try to get blocks from cache
		$cached_blocks = get_transient('gutenkit_blocks_cache');

		if (false === $cached_blocks || defined('WP_DEBUG') && WP_DEBUG) {
			// Cache miss or debug mode: Scan directories
			// Cache miss or debug mode: Scan directories
			$blocks_data = $this->scan_blocks();

			// Cache for 24 hours
			set_transient('gutenkit_blocks_cache', $blocks_data, DAY_IN_SECONDS);
		} else {
			$blocks_data = $cached_blocks;
		}

		// 2. Register each block
		foreach ($blocks_data as $block) {
			$this->register_single_block($block);
		}
	}

	private function scan_blocks()
	{
		$blocks_data = array();

		// Prefer build directory for metadata overrides, but we always need source for render.php
		$search_dir = is_dir(BUILD_BASE_PATH) ? BUILD_BASE_PATH : BLOCKS_BASE_PATH;

		if (!is_dir($search_dir)) {
			return $blocks_data;
		}

		$block_folders = glob($search_dir . '*', GLOB_ONLYDIR);

		if (empty($block_folders)) {
			return $blocks_data;
		}

		foreach ($block_folders as $path) {
			$slug = basename($path);
			// We register using the path where block.json resides
			$blocks_data[] = array(
				'slug' => $slug,
				'path' => $path,
			);
		}

		return $blocks_data;
	}

	private function register_single_block($block)
	{
		$slug = $block['slug'];
		$path = $block['path'];
		$block_json = $path . '/block.json';

		if (!file_exists($block_json)) {
			return;
		}

		register_block_type_from_metadata($path, array(
			'render_callback' => function ($attributes, $content) use ($slug) {
				return $this->render_block($slug, $attributes, $content);
			}
		));
	}

	public function render_block($slug, $attributes, $content)
	{
		// Logic: render.php is always in the SOURCE directory (blocks/$slug/)
		// even if we registered using block.json from BUILD directory.
		$template_path = BLOCKS_BASE_PATH . $slug . '/render.php';

		if (file_exists($template_path)) {
			ob_start();
			// $attributes and $content variables are available to the included file
			include $template_path;
			return ob_get_clean();
		} else {
			return '<div class="gutenkit-error">Template not found for: ' . esc_html($slug) . '</div>';
		}
	}

	/**
	 * Shortcode Handler for [bf_block]
	 * Keeps compatibility and allows manual placement.
	 */
	public function handle_shortcode($atts)
	{
		$a = shortcode_atts(array(
			'slug' => '',
			'attributes' => '',
			'content' => '',
		), $atts);

		if (empty($a['slug'])) {
			return '';
		}

		$attributes = array();
		if (!empty($a['attributes'])) {
			// Try standard JSON decode first
			$decoded = json_decode($a['attributes'], true);
			if (json_last_error() === JSON_ERROR_NONE) {
				$attributes = $decoded;
			} else {
				// Try Base64 decode (new format)
				$decoded_b64 = base64_decode($a['attributes']);
				$decoded_json = json_decode($decoded_b64, true);
				if (json_last_error() === JSON_ERROR_NONE) {
					$attributes = $decoded_json;
				}
			}
		}

		return $this->render_block($a['slug'], $attributes, $a['content']);
	}
}
