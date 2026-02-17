<?php
/**
 * Generator & AJAX Handler
 *
 * @package GutenKit
 */

if (!defined('ABSPATH')) {
	exit;
}

class GutenKit_Generator
{

	public function __construct()
	{
		// Form Submission (Create Block)
		add_action('admin_post_block_factory_generate', array($this, 'handle_create_block'));

		// AJAX Actions
		add_action('wp_ajax_block_factory_save_structure', array($this, 'handle_save_structure'));
		add_action('wp_ajax_block_factory_delete_block', array($this, 'handle_delete_block'));
		add_action('wp_ajax_bf_run_npm_build', array($this, 'handle_run_build'));
		add_action('wp_ajax_bf_install_dependencies', array($this, 'handle_install_dependencies'));
	}

	/**
	 * Handle Block Creation Form
	 */
	public function handle_create_block()
	{
		if (
			!isset($_POST['block_factory_nonce']) ||
			!wp_verify_nonce($_POST['block_factory_nonce'], 'block_factory_action') ||
			!current_user_can('manage_options')
		) {
			wp_die('Security check failed.');
		}

		$component_name = sanitize_text_field($_POST['component_name']);
		$component_icon = sanitize_text_field($_POST['component_icon']);

		if (empty($component_name)) {
			wp_die('Component Name is required.');
		}

		$block_slug = sanitize_title($component_name);
		$block_namespace = 'block-factory/' . $block_slug;
		$new_block_dir = BLOCKS_BASE_PATH . $block_slug . '/';

		if (!wp_mkdir_p($new_block_dir)) {
			wp_die('Failed to create block directory. Check permissions.');
		}

		$placeholders = array(
			'__COMPONENT_NAME_PASCAL__' => str_replace(' ', '', ucwords(str_replace('-', ' ', $block_slug))),
			'__COMPONENT_NAME_TITLE__' => $component_name,
			'__COMPONENT_SLUG__' => $block_slug,
			'__COMPONENT_NAMESPACE__' => $block_namespace,
			'__COMPONENT_ICON__' => $component_icon ? $component_icon : 'editor-code',
		);

		$templates = array(
			'block.json.tpl' => 'block.json',
			'index.js.tpl' => 'index.js',
			'edit.js.tpl' => 'edit.js',
			'save.js.tpl' => 'save.js',
			'style.scss.tpl' => 'style.scss',
			'editor.scss.tpl' => 'editor.scss',
			'config.json.tpl' => 'config.json',
			'render.php.tpl' => 'render.php',
		);

		foreach ($templates as $template_file => $output_file) {
			$template_path = BLOCK_FACTORY_PATH . 'templates/' . $template_file;
			if (!file_exists($template_path)) {
				error_log("GutenKit: Missing template " . $template_path);
				continue;
			}
			$file_content = file_get_contents($template_path);
			$final_content = str_replace(
				array_keys($placeholders),
				array_values($placeholders),
				$file_content
			);
			file_put_contents($new_block_dir . $output_file, $final_content);
		}

		// Invalidate Cache
		delete_transient('gutenkit_blocks_cache');

		$redirect_url = add_query_arg('block_created', $block_slug, admin_url('admin.php?page=block-factory'));
		wp_safe_redirect($redirect_url);
		exit;
	}

	/**
	 * Handle Config Save (AJAX)
	 */
	public function handle_save_structure()
	{
		if (
			!isset($_POST['nonce']) ||
			!wp_verify_nonce($_POST['nonce'], 'block_factory_save_structure_action') ||
			!current_user_can('manage_options')
		) {
			wp_send_json_error(array('message' => 'Security check failed.'));
		}

		$block_slug = sanitize_title($_POST['block_slug']);
		$config_data_json = isset($_POST['config_data']) ? wp_unslash($_POST['config_data']) : '';

		if (empty($block_slug) || empty($config_data_json)) {
			wp_send_json_error(array('message' => 'Missing data.'));
		}

		$config_data = json_decode($config_data_json, true);

		if (is_null($config_data)) {
			wp_send_json_error(array('message' => 'Invalid JSON.'));
		}

		$path = BLOCKS_BASE_PATH . $block_slug . '/config.json';
		$success = file_put_contents($path, wp_json_encode($config_data, JSON_PRETTY_PRINT)) !== false;

		if ($success) {
			// Update related files
			$this->update_block_json($block_slug, $config_data);
			$this->regenerate_edit_js($block_slug, $config_data);

			// Generate render.php if template is provided
			if (isset($config_data['template'])) {
				$this->generate_render_php($block_slug, $config_data);
			}

			// Generate style.scss if css is provided
			if (isset($config_data['css'])) {
				$style_scss_path = BLOCKS_BASE_PATH . $block_slug . '/style.scss';
				// We overwrite style.scss with the user's CSS/SCSS
				file_put_contents($style_scss_path, $config_data['css']);
			}

			wp_send_json_success(array(
				'message' => 'Block structure saved!',
				'next_step' => 'Run build.'
			));
		} else {
			wp_send_json_error(array('message' => 'Failed to write config file.'));
		}
	}

	/**
	 * Handle Deletion (AJAX)
	 */
	public function handle_delete_block()
	{
		check_ajax_referer('block_factory_nonce', 'nonce');

		if (!current_user_can('manage_options')) {
			wp_send_json_error(array('message' => 'Permission denied.'), 403);
		}

		$block_slug = sanitize_title($_POST['block_slug']);
		if (empty($block_slug)) {
			wp_send_json_error(array('message' => 'Invalid slug.'), 400);
		}

		// Security: Prevent directory traversal or deleting huge chunks
		if (strpos($block_slug, '.') !== false || strpos($block_slug, '/') !== false) {
			wp_send_json_error(array('message' => 'Invalid slug.'), 400);
		}

		$blocks_path = BLOCKS_BASE_PATH . $block_slug;
		$build_path = BUILD_BASE_PATH . $block_slug;


		if (strpos(realpath($blocks_path), realpath(BLOCKS_BASE_PATH)) !== 0) {
			// Path is suspicious
			// wp_send_json_error(['message' => 'Invalid path.'], 403);
			// (realpath might return false if file doesn't exist, so we skip this check if file missing, 
			// but sanitize_title helps ensure no ../ )
		}

		$errors = [];
		$success = [];

		if ($this->delete_dir_recursive($blocks_path)) {
			$success[] = "Deleted source: $block_slug";
		}
		if ($this->delete_dir_recursive($build_path)) {
			$success[] = "Deleted build: $block_slug";
		}

		// Invalidate Cache
		delete_transient('gutenkit_blocks_cache');

		wp_send_json_success(array('message' => 'Block deleted.', 'details' => $success));
	}

	/**
	 * Handle Run Build (AJAX)
	 */
	public function handle_run_build()
	{
		if (!current_user_can('manage_options')) {
			wp_send_json_error(array('message' => 'Forbidden'));
		}

		$dir = BLOCK_FACTORY_PATH;

		// Detect Node environment
		$node_env = $this->detect_node_environment();
		$npm_cmd = $node_env['npm_cmd'];
		$node_dir = $node_env['node_dir'];

		// Prepare Command
		// We need to add the node directory to the PATH environment variable so that
		// subprocesses spawned by npm (like 'node generate-block-code-multi.js') can find 'node'.
		$path_env = getenv('PATH');
		if ($node_dir && strpos($path_env, $node_dir) === false) {
			// Prepend node directory to PATH
			$separator = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? ';' : ':';
			putenv("PATH=$node_dir" . $separator . $path_env);
		}

		$cmd = "cd " . escapeshellarg($dir) . " && $npm_cmd run build --if-present 2>&1";
		exec($cmd, $output, $ret);

		if ($ret === 0) {
			delete_transient('gutenkit_blocks_cache');
		}

		wp_send_json(array(
			'success' => $ret === 0,
			'output' => implode("<br>", $output),
			'debug' => [
				'npm_cmd' => $npm_cmd,
				'node_dir' => $node_dir,
			]
		));
	}


	// --- Helper Methods ---

	private function update_block_json($block_slug, $config_data)
	{
		$json_path = BLOCKS_BASE_PATH . $block_slug . '/block.json';
		if (!file_exists($json_path)) {
			return;
		}

		$block_meta = json_decode(file_get_contents($json_path), true);

		if (!isset($block_meta['attributes'])) {
			$block_meta['attributes'] = [];
		}

		foreach ($config_data['fields'] as $field) {
			$key = $field['key'];
			if (!isset($block_meta['attributes'][$key])) {
				$type = 'string';
				if (in_array($field['type'], ['number', 'range', 'relational'])) {
					$type = 'number';
				} elseif (in_array($field['type'], ['image', 'file', 'button'])) {
					$type = 'object';
				} elseif (in_array($field['type'], ['repeater', 'gallery'])) {
					$type = 'array';
				}

				$attr_definition = ['type' => $type];
				if ($type === 'array') {
					$attr_definition['default'] = [];
					$attr_definition['items'] = ['type' => 'object'];
				}
				$block_meta['attributes'][$key] = $attr_definition;
			}
		}

		file_put_contents($json_path, json_encode($block_meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
	}

	private function regenerate_edit_js($block_slug, $config_data)
	{
		$block_dir = BLOCKS_BASE_PATH . $block_slug . '/';
		$template_path = BLOCK_FACTORY_PATH . 'templates/edit.js.tpl';
		$edit_js_path = $block_dir . 'edit.js';

		if (!file_exists($template_path)) {
			return false;
		}

		$template = file_get_contents($template_path);
		$fields = $config_data['fields'];
		$block_template = isset($config_data['template']) ? $config_data['template'] : '';

		// 1. Generate Inspector Controls (Sidebar)
		$inspector_controls = $this->generate_inspector_controls($fields);

		// 2. Generate Canvas Preview (HTML)
		$canvas_preview = $this->generate_canvas_preview($block_template, $fields);

		// 3. Imports
		$extra_imports_editor = [];
		$extra_imports_components = ['PanelBody'];

		foreach ($fields as $field) {
			if ($field['type'] === 'text' || $field['type'] === 'textarea') {
				if (!in_array('TextControl', $extra_imports_components))
					$extra_imports_components[] = 'TextControl';
				if (!in_array('TextareaControl', $extra_imports_components))
					$extra_imports_components[] = 'TextareaControl';
			} elseif ($field['type'] === 'image' || $field['type'] === 'file') {
				if (!in_array('MediaUpload', $extra_imports_editor))
					$extra_imports_editor[] = 'MediaUpload';
				if (!in_array('MediaUploadCheck', $extra_imports_editor))
					$extra_imports_editor[] = 'MediaUploadCheck';
				if (!in_array('Button', $extra_imports_components))
					$extra_imports_components[] = 'Button';
			} elseif ($field['type'] === 'range') {
				if (!in_array('RangeControl', $extra_imports_components))
					$extra_imports_components[] = 'RangeControl';
			} elseif ($field['type'] === 'toggle') {
				if (!in_array('ToggleControl', $extra_imports_components))
					$extra_imports_components[] = 'ToggleControl';
			}
		}

		$replacements = [
			'{{BLOCK_SLUG}}' => $block_slug,
			'// __INJECT_BLOCK_EDITOR_IMPORTS__' => !empty($extra_imports_editor) ? ', ' . implode(', ', $extra_imports_editor) : '',
			'// __INJECT_COMPONENTS_IMPORTS__' => !empty($extra_imports_components) ? ', ' . implode(', ', $extra_imports_components) : '',
			'// __INJECT_UI_CODE__' => $inspector_controls,
			'// __INJECT_CANVAS_PREVIEW__' => $canvas_preview,
		];

		$final_js = str_replace(array_keys($replacements), array_values($replacements), $template);
		return file_put_contents($edit_js_path, $final_js) !== false;
	}

	private function generate_inspector_controls($fields)
	{
		$jsx = '<PanelBody title="Settings" initialOpen={ true }>';

		foreach ($fields as $field) {
			$key = $field['key'];
			$label = $field['label'];
			$type = $field['type'];

			$jsx .= "\n\t\t\t\t";

			switch ($type) {
				case 'text':
					$jsx .= "<TextControl label=\"$label\" value={ attributes.$key } onChange={ ( val ) => setAttributes( { $key: val } ) } />";
					break;
				case 'textarea':
					$jsx .= "<TextareaControl label=\"$label\" value={ attributes.$key } onChange={ ( val ) => setAttributes( { $key: val } ) } />";
					break;
				case 'range':
					$jsx .= "<RangeControl label=\"$label\" value={ attributes.$key } onChange={ ( val ) => setAttributes( { $key: val } ) } min={ 0 } max={ 100 } />";
					break;
				case 'image':
					$jsx .= "<div className=\"media-control\">
						<label className=\"components-base-control__label\">$label</label>
						<MediaUploadCheck>
							<MediaUpload
								onSelect={ ( media ) => setAttributes( { $key: { url: media.url, alt: media.alt, id: media.id } } ) }
								allowedTypes={ ['image'] }
								value={ attributes.$key ? attributes.$key.id : null }
								render={ ( { open } ) => (
									<Button onClick={ open } variant=\"secondary\">
										{ attributes.$key && attributes.$key.url ? 'Replace Image' : 'Upload Image' }
									</Button>
								) }
							/>
						</MediaUploadCheck>
						{ attributes.$key && attributes.$key.url && (
							<div style={{ marginTop: '10px' }}>
								<img src={ attributes.$key.url } alt={ attributes.$key.alt } style={{ maxWidth: '100%' }} />
								<Button isLink isDestructive onClick={ () => setAttributes( { $key: null } ) }>Remove</Button>
							</div>
						) }
					</div>";
					break;
				default:
					// Fallback for types not strictly handled yet
					$jsx .= "<TextControl label=\"$label (Type: $type)\" value={ attributes.$key } onChange={ ( val ) => setAttributes( { $key: val } ) } />";
					break;
			}
			$jsx .= "<br />";
		}

		$jsx .= "\n\t\t\t</PanelBody>";
		return $jsx;
	}

	private function generate_canvas_preview($template, $fields)
	{
		if (empty($template)) {
			return '<div>Please define a template in the editor.</div>';
		}

		// We need to construct a JS template string from the HTML
		// Replace {{key}} with ${attributes.key}
		// NOTE: We need to be careful about quotes.

		// Escape backticks in the template because we will wrap it in backticks for JS
		$js_safe_template = str_replace('`', '\`', $template);

		foreach ($fields as $field) {
			$key = $field['key'];
			$type = $field['type'];

			// For images, attributes.key is an object {url, alt, id}. 
			// The user uses {{key}} in HTML. We should probably expect them to use it in src=""
			// OR we can try to be smart.
			// Simple approach: Replace {{key}} with ${attributes.key} and let the user handle sub-properties if complex?
			// User request says "call the created fields data in that textarea itself".
			// If they have an image field "hero_image", attributes.hero_image is an object.
			// The HTML might be <img src="{{hero_image}}">.
			// If we replace {{hero_image}} with ${attributes.hero_image}, it prints [object Object].
			// So for image types, we might want to flatten or guide them.
			// BUT, for text it's easy.

			// Let's assume for now simple text replacement.
			// Only special handling: if attributes.key is undefined/null, show empty string to avoid "undefined" in preview.

			if ($type === 'image' || $type === 'file') {
				// We'll replace {{key}} with ${attributes.key?.url || ''}
				$replacement = "\${attributes.$key?.url || ''}";
			} else {
				$replacement = "\${attributes.$key || ''}";
			}

			// Flexible regex for {{ key }} with spaces
			$js_safe_template = preg_replace('/\{\{\s*' . preg_quote($key, '/') . '\s*\}\}/', $replacement, $js_safe_template);
		}

		// Return the dangerouslySetInnerHTML
		// "dangerouslySetInnerHTML={{ __html: `...` }}"
		return "<div dangerouslySetInnerHTML={{ __html: `$js_safe_template` }} />";
	}
	private function generate_render_php($slug, $config)
	{
		$template = $config['template'];
		$fields = $config['fields'];
		$block_dir = BLOCKS_BASE_PATH . $slug;

		foreach ($fields as $field) {
			$key = $field['key'];
			$type = $field['type'];
			$php = '';

			switch ($type) {
				case 'image':
				case 'file':
					// Default to URL so it can be used in src="" attributes
					$php = "<?php echo esc_url(\$attributes['$key']['url'] ?? ''); ?>";
					break;
				case 'gallery':
					$php = "<?php if(!empty(\$attributes['$key']) && is_array(\$attributes['$key'])): ?><div class=\"custom-gallery\"><?php foreach(\$attributes['$key'] as \$item): ?><img src=\"<?php echo esc_url(\$item['url']); ?>\" /><?php endforeach; ?></div><?php endif; ?>";
					break;
				case 'repeater':
					$php = "<?php if(!empty(\$attributes['$key']) && is_array(\$attributes['$key'])): ?><?php foreach(\$attributes['$key'] as \$item): ?><!-- Loop --> <?php endforeach; ?><?php endif; ?>";
					break;
				default:
					$php = "<?php echo wp_kses_post(\$attributes['$key'] ?? ''); ?>";
					break;
			}
			$template = str_replace('{{' . $key . '}}', $php, $template);
		}

		$file_content = "<?php\n/**\n * Render $slug\n */\n";
		$file_content .= "\$wrapper_classes = 'bf-block-' . esc_attr('$slug');\n?>\n";
		$file_content .= "<div class=\"<?php echo \$wrapper_classes; ?>\">\n" . $template . "\n</div>";

		if (!file_exists($block_dir)) {
			mkdir($block_dir, 0755, true);
		}
		file_put_contents($block_dir . '/render.php', $file_content);
	}

	private function delete_dir_recursive($dir)
	{
		if (!is_dir($dir)) {
			return false;
		}
		$it = new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS);
		$files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
		foreach ($files as $file) {
			if ($file->isDir()) {
				rmdir($file->getRealPath());
			} else {
				unlink($file->getRealPath());
			}
		}
		return rmdir($dir);
	}

	/**
	 * Detect Node/NPM Environment
	 * 
	 * Tries to find the path to npm and the directory containing node.
	 * 
	 * @return array {
	 *     @type string $npm_cmd  The command to run npm (e.g. "npm", "/usr/bin/npm", "C:\...\npm.cmd")
	 *     @type string $node_dir The directory containing the node executable (to add to PATH)
	 * }
	 */
	private function detect_node_environment()
	{
		$is_win = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN');

		// Default values
		$npm_cmd = 'npm';
		$node_dir = '';

		// 1. Check for custom constant in wp-config.php
		if (defined('WP_BLOCK_FACTORY_NODE_PATH')) {
			$custom_path = dirname(WP_BLOCK_FACTORY_NODE_PATH); // If defined as /path/to/node/npm
			// Assume the user might point to the directory OR the executable.
			// Let's assume directory for simplicity or handle both.

			// If constant points to directory (e.g. /usr/local/bin)
			if (is_dir(WP_BLOCK_FACTORY_NODE_PATH)) {
				$node_dir = WP_BLOCK_FACTORY_NODE_PATH;
				$npm_cmd = $is_win ? '"' . $node_dir . '\npm.cmd"' : '"' . $node_dir . '/npm"';
			}
			// If constant points to executable (e.g. /usr/local/bin/node)
			elseif (is_file(WP_BLOCK_FACTORY_NODE_PATH)) {
				$node_dir = dirname(WP_BLOCK_FACTORY_NODE_PATH);
				$npm_cmd = $is_win ? '"' . $node_dir . '\npm.cmd"' : '"' . $node_dir . '/npm"';
			}

			return ['npm_cmd' => $npm_cmd, 'node_dir' => $node_dir];
		}

		// 2. Automated Detection
		if ($is_win) {
			// Windows Detection

			// Try 'where' command first
			$output = [];
			exec('where npm', $output, $ret);
			if ($ret === 0 && !empty($output)) {
				$npm_path = $output[0]; // First match
				// Check if it's a batch/cmd file
				if (preg_match('/\.cmd$/i', $npm_path) || preg_match('/\.bat$/i', $npm_path)) {
					$npm_cmd = '"' . $npm_path . '"';
					$node_dir = dirname($npm_path);
				}
				// Sometimes 'where npm' returns the shim (AppData\Roaming\npm\npm), finding node might be different.
				// Usually node.exe is in the same dir as npm.cmd in Program Files.
			}

			// Fallback to common paths if 'where' failed or we want to be sure
			if (empty($node_dir)) {
				$possible_paths = [
					'C:\\Program Files\\nodejs\\npm.cmd',
					'C:\\Program Files (x86)\\nodejs\\npm.cmd',
					getenv('APPDATA') . '\\npm\\npm.cmd',
				];
				foreach ($possible_paths as $path) {
					if (file_exists($path)) {
						$npm_cmd = '"' . $path . '"';
						$node_dir = dirname($path);
						break;
					}
				}
			}
		} else {
			// Linux/Unix Detection
			$output = [];
			exec('which npm', $output, $ret);
			if ($ret === 0 && !empty($output)) {
				$npm_cmd = trim($output[0]);
				$node_dir = dirname($npm_cmd);
			}
		}

		return [
			'npm_cmd' => $npm_cmd,
			'node_dir' => $node_dir,
		];
	}

	/**
	 * Handle Install Dependencies (AJAX)
	 */
	public function handle_install_dependencies()
	{
		check_ajax_referer('block_factory_nonce', 'nonce');

		if (!current_user_can('manage_options')) {
			wp_send_json_error(['message' => 'Permission denied.']);
		}

		$node_dir = $this->detect_node_environment()['node_dir'];
		$plugin_dir = BLOCK_FACTORY_PATH;

		// Prepare Command
		$cmd_prefix = '';

		// Add Node to PATH for this command execution
		if ($node_dir) {
			$path_sep = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? ';' : ':';
			$current_path = getenv('PATH');
			putenv("PATH=$node_dir$path_sep$current_path");
		}

		// Command to run
		$cmd = "cd " . escapeshellarg($plugin_dir) . " && npm install 2>&1";

		// Exec
		exec($cmd, $output, $return_var);

		$output_str = implode("\n", $output);

		if ($return_var === 0) {
			wp_send_json_success([
				'message' => 'Dependencies installed successfully.',
				'output' => $output_str
			]);
		} else {
			wp_send_json_error([
				'message' => 'npm install failed with exit code ' . $return_var . '. Ensure Node.js and npm are installed on the server.',
				'output' => $output_str,
				'node_path_detected' => $node_dir
			]);
		}
	}
}
