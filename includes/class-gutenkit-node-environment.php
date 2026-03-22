<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class GutenKit_NodeEnvironment {
    private $node_dir = null;
    private $npm_cmd = null;
    private $detected = false;

    public function detect() {
        if ( $this->detected ) {
            return array(
                'npm_cmd'  => $this->npm_cmd,
                'node_dir' => $this->node_dir,
            );
        }

        $this->npm_cmd  = false;
        $this->node_dir = false;

        // 1. Check constant override
        if ( defined( 'WP_BLOCK_FACTORY_NODE_PATH' ) && is_dir( WP_BLOCK_FACTORY_NODE_PATH ) ) {
            $this->node_dir = rtrim( WP_BLOCK_FACTORY_NODE_PATH, '/\\' );
            $npm_bin = $this->node_dir . ( PHP_OS_FAMILY === 'Windows' ? '\\npm.cmd' : '/npm' );
            if ( file_exists( $npm_bin ) ) {
                $this->npm_cmd = '"' . $npm_bin . '"';
                $this->detected = true;
                return $this->detect();
            }
        }

        // 2. Try `where` (Windows) or `which` (Unix)
        $which_cmd = PHP_OS_FAMILY === 'Windows' ? 'where npm 2>NUL' : 'which npm 2>/dev/null';
        $npm_path = trim( (string) shell_exec( $which_cmd ) );

        if ( ! empty( $npm_path ) ) {
            $npm_path = strtok( $npm_path, "\n" );
            $this->npm_cmd  = '"' . trim( $npm_path ) . '"';
            $this->node_dir = dirname( trim( $npm_path ) );
            $this->detected = true;
            return $this->detect();
        }

        // 3. Fallback paths
        $fallback_dirs = PHP_OS_FAMILY === 'Windows'
            ? array( 'C:\\Program Files\\nodejs', 'C:\\Program Files (x86)\\nodejs' )
            : array( '/usr/local/bin', '/usr/bin', '/opt/homebrew/bin' );

        foreach ( $fallback_dirs as $dir ) {
            $npm_bin = $dir . ( PHP_OS_FAMILY === 'Windows' ? '\\npm.cmd' : '/npm' );
            if ( file_exists( $npm_bin ) ) {
                $this->npm_cmd  = '"' . $npm_bin . '"';
                $this->node_dir = $dir;
                $this->detected = true;
                return $this->detect();
            }
        }

        $this->detected = true;
        return $this->detect();
    }

    public function get_npm_cmd() {
        if ( ! $this->detected ) {
            $this->detect();
        }
        return $this->npm_cmd;
    }

    public function get_node_dir() {
        if ( ! $this->detected ) {
            $this->detect();
        }
        return $this->node_dir;
    }
}
