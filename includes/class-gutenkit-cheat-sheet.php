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
				$lines[] = '<em>Loop:</em><br>';
				$lines[] = "<code>{{#each $key}}</code><br>";

				if ( isset( $field['subFields'] ) ) {
					foreach ( $field['subFields'] as $sub ) {
						$sKey  = $sub['key'];
						$sType = $sub['type'];

						if ( $sType === 'gallery' ) {
							$lines[] = '&nbsp;&nbsp; <em>Gallery Loop:</em><br>';
							$lines[] = "&nbsp;&nbsp; <code>{{#each $sKey}}</code><br>";
							$lines[] = "&nbsp;&nbsp;&nbsp;&nbsp; &lt;img src=\"{{url}}\" alt=\"{{alt}}\" /&gt;<br>";
							$lines[] = "&nbsp;&nbsp; <code>{{/each}}</code><br>";
						} else {
							$lines[] = "&nbsp;&nbsp; {{{$sKey}}} <small>($sType)</small><br>";
							if ( $sType === 'image' || $sType === 'file' ) {
								$lines[] = "&nbsp;&nbsp; {{{$sKey}_alt}} <small>(Alt Text)</small><br>";
							}
						}
					}
				}

				$lines[] = '<code>{{/each}}</code>';
			} elseif ( $type === 'gallery' ) {
				$lines[] = '<em>Loop (Gallery):</em><br>';
				$lines[] = "<code>{{#each $key}}</code><br>";
				$lines[] = "&nbsp;&nbsp; &lt;img src=\"{{url}}\" alt=\"{{alt}}\" /&gt;<br>";
				$lines[] = '<code>{{/each}}</code>';
			} elseif ( $type === 'image' || $type === 'file' ) {
				$lines[] = "URL: <code>{{{$key}}}</code><br>";
				$lines[] = "Alt/Filename: <code>{{{$key}_alt}}</code>";
			} else {
				$lines[] = "Value: <code>{{{$key}}}</code>";
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
