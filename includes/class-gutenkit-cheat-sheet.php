<?php
/**
 * CheatSheet — generates the field reference HTML for the editor.
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_CheatSheet {

	/**
	 * Generate cheat-sheet HTML for the given fields array.
	 *
	 * @param array $fields The block fields definition.
	 * @return string HTML string.
	 */
	public function generate( $fields ) {
		if ( empty( $fields ) || ! is_array( $fields ) ) {
			return '<p>No fields defined yet.</p>';
		}

		$lines   = array();
		$lines[] = '<h3>Field Cheat Sheet</h3>';
		$lines[] = '<p>Copy these snippets into your <strong>Render Template</strong> or <strong>Canvas Template</strong>.</p>';
		$lines[] = '<hr>';

		foreach ( $fields as $field ) {
			$key   = $field['key'];
			$label = $field['label'];
			$type  = $field['type'];

			$lines[] = "<div style='margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;'>";
			$lines[] = "<strong>$label ($key) - $type</strong><br>";

			if ( $type === 'repeater' ) {
				// Build a single copyable snippet with sub-fields inside the loop.
				// Use explicit string concatenation to avoid PHP brace-interpolation quirks.
				$snippet_lines   = array();
				$snippet_lines[] = '{{#each ' . $key . '}}';

				if ( isset( $field['subFields'] ) && is_array( $field['subFields'] ) ) {
					foreach ( $field['subFields'] as $sub ) {
						$sKey  = isset( $sub['key'] ) ? $sub['key'] : '';
						$sType = isset( $sub['type'] ) ? $sub['type'] : 'text';

						if ( ! $sKey ) {
							continue; // skip sub-fields with no key
						}

						if ( $sType === 'gallery' ) {
							$snippet_lines[] = '  {{#each ' . $sKey . '}}';
							$snippet_lines[] = '    <img src="{{url}}" alt="{{alt}}" />';
							$snippet_lines[] = '  {{/each}}';
						} elseif ( $sType === 'image' || $sType === 'file' ) {
							$snippet_lines[] = '  <img src="{{' . $sKey . '}}" alt="{{' . $sKey . '_alt}}" />';
						} else {
							$snippet_lines[] = '  {{' . $sKey . '}}';
						}
					}
				}

				$snippet_lines[] = '{{/each}}';

				$snippet = htmlspecialchars( implode( "\n", $snippet_lines ) );
				$lines[] = '<pre style="background:#f6f8fa;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin:6px 0 0;font-size:12px;line-height:1.6;white-space:pre;overflow-x:auto;cursor:pointer;user-select:all;" title="Click to select all" onclick="var r=document.createRange();r.selectNodeContents(this);var s=window.getSelection();s.removeAllRanges();s.addRange(r);">' . $snippet . '</pre>';
			} elseif ( $type === 'gallery' ) {
				$gallery_snippet = htmlspecialchars( "{{#each $key}}\n  <img src=\"{{url}}\" alt=\"{{alt}}\" />\n{{/each}}" );
				$lines[] = '<pre style="background:#f6f8fa;border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin:6px 0 0;font-size:12px;line-height:1.6;white-space:pre;overflow-x:auto;cursor:pointer;user-select:all;" title="Click to select all" onclick="var r=document.createRange();r.selectNodeContents(this);var s=window.getSelection();s.removeAllRanges();s.addRange(r);">' . $gallery_snippet . '</pre>';
			} elseif ( $type === 'image' || $type === 'file' ) {
				$img_snippet = htmlspecialchars( '<img src="{{' . $key . '}}" alt="{{' . $key . '_alt}}" />' );
				$lines[] = "<em>Copy snippet:</em><br>";
				$lines[] = "<code style='display:block;background:#f6f8fa;padding:4px 8px;margin:4px 0;border-radius:3px;user-select:all;'>$img_snippet</code>";
				$lines[] = "<small style='color:#555;'>Alt falls back to filename if not set.</small><br>";
				$lines[] = '<br>URL only: <code>{{' . $key . '}}</code><br>';
				$lines[] = 'Alt text: <code>{{' . $key . '_alt}}</code>';
			} else {
				$lines[] = 'Value: <code>{{' . $key . '}}</code>';
			}

			$lines[] = '</div>';
		}

		return implode( "\n", $lines );
	}

	/**
	 * Generate and write the cheat-sheet HTML file for a block.
	 *
	 * @param string $slug   Block slug.
	 * @param array  $fields The block fields definition.
	 */
	public function write( $slug, $fields ) {
		$html      = $this->generate( $fields );
		$file_path = BLOCKS_BASE_PATH . $slug . '/cheat_sheet.html';

		global $wp_filesystem;
		if ( ! $wp_filesystem ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
			WP_Filesystem();
		}
		if ( $wp_filesystem ) {
			$wp_filesystem->put_contents( $file_path, $html, FS_CHMOD_FILE );
		}
	}
}
