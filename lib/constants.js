const path = require('path');

module.exports = {
    BLOCKS_SRC_DIR: path.resolve(__dirname, '../blocks'),
    TEMPLATE_FILENAME: 'edit.js',
    BLOCK_JSON_FILENAME: 'block.json',
    INJECTION_MARKER: '// __INJECT_UI_CODE__',
    ATTRIBUTES_HOOK: '"__INJECT_ATTRIBUTES_HOOK__": {}',
    ATTRIBUTES_HOOK_REGEX: /,\s*"__INJECT_ATTRIBUTES_HOOK__"\s*:\s*{}\s*/,
    FINAL_HOOK_REGEX: /(,\s*)"__INJECT_ATTRIBUTES_HOOK__"\s*:\s*{}\s*/,
    PACKAGE_MAP: {
        'RichText': 'BLOCK_EDITOR',
        'InspectorControls': 'BLOCK_EDITOR',
        'MediaUpload': 'BLOCK_EDITOR',
        'MediaUploadCheck': 'BLOCK_EDITOR',
        'useBlockProps': 'BLOCK_EDITOR',
        'PanelBody': 'COMPONENTS',
        'TextControl': 'COMPONENTS',
        'Button': 'COMPONENTS',
        'ToggleControl': 'COMPONENTS',
        'RangeControl': 'COMPONENTS',
        'TextareaControl': 'COMPONENTS',
        'SelectControl': 'COMPONENTS',
        'DatePicker': 'COMPONENTS',
        'ColorPalette': 'COMPONENTS',
    }
};
