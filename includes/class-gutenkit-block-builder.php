<?php
/**
 * Block Builder — handles npm build and dependency installation via AJAX.
 *
 * Extracted from GutenKit_Generator (Task 3).
 * Uses proc_open with 120-second timeout instead of bare exec().
 *
 * @package GutenKit
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class GutenKit_BlockBuilder {

	/** @var GutenKit_NodeEnvironment */
	private $node_env;

	/**
	 * @param GutenKit_NodeEnvironment $node_env Detected node environment instance.
	 */
	public function __construct( GutenKit_NodeEnvironment $node_env ) {
		$this->node_env = $node_env;

		add_action( 'wp_ajax_bf_run_npm_build', array( $this, 'handle_run_build' ) );
		add_action( 'wp_ajax_bf_install_dependencies', array( $this, 'handle_install_dependencies' ) );
	}

	/**
	 * Handle Run Build (AJAX)
	 */
	public function handle_run_build() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Forbidden' ) );
		}

		$dir     = BLOCK_FACTORY_PATH;
		$npm_cmd = $this->node_env->get_npm_cmd();

		$cmd    = "cd " . escapeshellarg( $dir ) . " && $npm_cmd run build --if-present 2>&1";
		$result = $this->exec_with_timeout( $cmd, 120 );

		if ( $result['timed_out'] ) {
			wp_send_json( array(
				'success' => false,
				'output'  => 'Build timed out after 120 seconds.',
				'debug'   => array(
					'npm_cmd'  => $npm_cmd,
					'node_dir' => $this->node_env->get_node_dir(),
				),
			) );
		}

		$ret = $result['exit_code'];
		if ( $ret === 0 ) {
			delete_transient( 'gutenkit_blocks_cache' );
		}

		wp_send_json( array(
			'success' => $ret === 0,
			'output'  => str_replace( "\n", '<br>', $result['output'] ),
			'debug'   => array(
				'npm_cmd'  => $npm_cmd,
				'node_dir' => $this->node_env->get_node_dir(),
			),
		) );
	}

	/**
	 * Handle Install Dependencies (AJAX)
	 * Skips execution if node_modules already exists and package.json is unchanged.
	 */
	public function handle_install_dependencies() {
		check_ajax_referer( 'block_factory_nonce', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => 'Permission denied.' ) );
		}

		$plugin_dir   = BLOCK_FACTORY_PATH;
		$pkg_json     = $plugin_dir . 'package.json';
		$hash_file    = $plugin_dir . '.npm_pkg_hash';
		$node_modules = $plugin_dir . 'node_modules';

		// Only install if node_modules is missing or package.json has changed
		$needs_install = ! is_dir( $node_modules );
		if ( ! $needs_install && file_exists( $pkg_json ) ) {
			$current_hash = md5_file( $pkg_json );
			$stored_hash  = file_exists( $hash_file ) ? trim( file_get_contents( $hash_file ) ) : ''; // phpcs:ignore
			if ( $current_hash !== $stored_hash ) {
				$needs_install = true;
			}
		}

		if ( ! $needs_install ) {
			wp_send_json_success( array(
				'message' => 'Dependencies are already up to date. Skipped install.',
				'output'  => '',
			) );
		}

		$node_dir = $this->node_env->get_node_dir();

		$cmd    = "cd " . escapeshellarg( $plugin_dir ) . " && npm install 2>&1";
		$result = $this->exec_with_timeout( $cmd, 120 );

		if ( $result['timed_out'] ) {
			wp_send_json_error( array(
				'message'            => 'npm install timed out after 120 seconds.',
				'output'             => $result['output'],
				'node_path_detected' => $node_dir,
			) );
		}

		$output_str = $result['output'];

		if ( $result['exit_code'] === 0 ) {
			// Record hash so future activations/installs can skip if unchanged
			if ( file_exists( $pkg_json ) ) {
				file_put_contents( $hash_file, md5_file( $pkg_json ) ); // phpcs:ignore
			}
			wp_send_json_success( array(
				'message' => 'Dependencies installed successfully.',
				'output'  => $output_str,
			) );
		} else {
			wp_send_json_error( array(
				'message'            => 'npm install failed with exit code ' . $result['exit_code'] . '. Ensure Node.js and npm are installed on the server.',
				'output'             => $output_str,
				'node_path_detected' => $node_dir,
			) );
		}
	}

	/**
	 * Execute a shell command with a timeout using proc_open.
	 *
	 * @param string $cmd     Shell command to run.
	 * @param int    $timeout Timeout in seconds.
	 * @return array{ output: string, exit_code: int, timed_out: bool }
	 */
	private function exec_with_timeout( $cmd, $timeout ) {
		$node_dir = $this->node_env->get_node_dir();

		// Build environment with node dir in PATH
		$env = null; // inherit current env by default
		if ( $node_dir ) {
			$path_sep     = ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) ? ';' : ':';
			$current_path = getenv( 'PATH' );
			$env          = array( 'PATH' => $node_dir . $path_sep . $current_path );

			// On Windows, inherit SYSTEMROOT and other essentials
			if ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) {
				$env['SYSTEMROOT'] = getenv( 'SYSTEMROOT' ) ?: 'C:\\Windows';
				$env['TEMP']       = getenv( 'TEMP' ) ?: sys_get_temp_dir();
				$env['TMP']        = getenv( 'TMP' ) ?: sys_get_temp_dir();
				$env['APPDATA']    = getenv( 'APPDATA' ) ?: '';
				$env['USERPROFILE'] = getenv( 'USERPROFILE' ) ?: '';
			}
		}

		$descriptors = array(
			0 => array( 'pipe', 'r' ), // stdin
			1 => array( 'pipe', 'w' ), // stdout
			2 => array( 'pipe', 'w' ), // stderr
		);

		$process = proc_open( $cmd, $descriptors, $pipes, null, $env );

		if ( ! is_resource( $process ) ) {
			return array(
				'output'    => 'Failed to start process.',
				'exit_code' => -1,
				'timed_out' => false,
			);
		}

		// Close stdin — we don't need to write to the process
		fclose( $pipes[0] );

		// Set stdout and stderr to non-blocking
		stream_set_blocking( $pipes[1], false );
		stream_set_blocking( $pipes[2], false );

		$output    = '';
		$start     = time();
		$timed_out = false;

		while ( true ) {
			$status = proc_get_status( $process );

			// Read available data from stdout and stderr
			$stdout_chunk = stream_get_contents( $pipes[1] );
			$stderr_chunk = stream_get_contents( $pipes[2] );

			if ( $stdout_chunk !== false && $stdout_chunk !== '' ) {
				$output .= $stdout_chunk;
			}
			if ( $stderr_chunk !== false && $stderr_chunk !== '' ) {
				$output .= $stderr_chunk;
			}

			// Process has exited
			if ( ! $status['running'] ) {
				break;
			}

			// Check timeout
			if ( ( time() - $start ) >= $timeout ) {
				$timed_out = true;
				$pid       = $status['pid'];

				// Cross-platform process kill
				if ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) {
					exec( "taskkill /T /F /PID $pid 2>NUL" );
				} else {
					exec( "kill -9 $pid 2>/dev/null" );
				}

				break;
			}

			// Small sleep to avoid busy-waiting
			usleep( 100000 ); // 100ms
		}

		// Read any remaining data after process exit
		$stdout_remaining = stream_get_contents( $pipes[1] );
		$stderr_remaining = stream_get_contents( $pipes[2] );
		if ( $stdout_remaining !== false && $stdout_remaining !== '' ) {
			$output .= $stdout_remaining;
		}
		if ( $stderr_remaining !== false && $stderr_remaining !== '' ) {
			$output .= $stderr_remaining;
		}

		fclose( $pipes[1] );
		fclose( $pipes[2] );

		$exit_code = $timed_out ? -1 : proc_close( $process );

		if ( $timed_out ) {
			proc_close( $process );
		}

		return array(
			'output'    => $output,
			'exit_code' => $exit_code,
			'timed_out' => $timed_out,
		);
	}
}
