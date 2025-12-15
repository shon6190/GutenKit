// block-factory/webpack.config.js (The FINAL, WORKING CODE)

const path = require('path');
const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const glob = require('glob');
const CopyWebpackPlugin = require('copy-webpack-plugin'); // MUST BE INSTALLED: npm install copy-webpack-plugin --save-dev

// --- 1. Define Paths ---
const BLOCKS_SRC_DIR = path.resolve(__dirname, 'blocks');
const BLOCKS_BUILD_DIR = path.resolve(__dirname, 'build');
// Using 'admin' as the output folder, as defined in your block-factory.php
const ADMIN_BUILD_DIR = path.resolve(__dirname, 'admin/js');

// --- 2. Dynamically find all block entries ---
const blockEntries = {};
const files = glob.sync(`${BLOCKS_SRC_DIR}/*/index.js`);

files.forEach(file => {
    const blockSlug = path.basename(path.dirname(file));
    blockEntries[`${blockSlug}/index`] = file;
});


// --- 3. Export an array of two configurations ---
module.exports = [
    // =======================================================
    // CONFIGURATION 1: The Admin Editor App (outputs to /admin)
    // =======================================================
    {
        ...defaultConfig,
        entry: {
            'editor-app': './src/editor-app.js',
        },
        output: {
            path: ADMIN_BUILD_DIR, // Output directory is /admin
            filename: '[name].js',
        },
    },

    // =======================================================
    // CONFIGURATION 2: ALL Gutenberg Blocks (outputs to /build)
    // =======================================================
    {
        ...defaultConfig,
        entry: blockEntries,
        output: {
            path: BLOCKS_BUILD_DIR, // Output directory is /build
            filename: '[name].js',
        },

        // CRITICAL FIX: PLUGINS SECTION TO COPY STATIC FILES
        plugins: [
            ...defaultConfig.plugins,
            new CopyWebpackPlugin({
                patterns: [
                    // FIX: 'from' is now RELATIVE to the 'context' (BLOCKS_SRC_DIR)
                    {
                        from: `*/block.json`, // Looks for block.json inside any subdirectory of /blocks/
                        to: '[path]/[name][ext]',
                        context: BLOCKS_SRC_DIR // Tells the plugin the root path is C:\...\blocks
                    },
                    {
                        from: `*/config.json`, // Looks for config.json
                        to: '[path]/[name][ext]',
                        context: BLOCKS_SRC_DIR
                    }
                ],
            }),
        ],

        resolve: {
            extensions: [...defaultConfig.resolve.extensions, '.json', '.js']
        }
    }
];