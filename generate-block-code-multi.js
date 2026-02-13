const fs = require('fs');
const path = require('path');
const glob = require('glob');

// --- Imports ---
const { 
    BLOCKS_SRC_DIR, 
    TEMPLATE_FILENAME, 
    BLOCK_JSON_FILENAME, 
    INJECTION_MARKER, 
    ATTRIBUTES_HOOK, 
    ATTRIBUTES_HOOK_REGEX, 
    FINAL_HOOK_REGEX, 
    PACKAGE_MAP 
} = require('./lib/constants');

const { FIELD_MAP, generateRepeaterInnerJSX } = require('./lib/fields');
const convertRenderPhpToJsx = require('./lib/php-to-jsx');

// --- Core Generation Logic for a single block ---
function generateBlock(blockPath) {
    const blockSlug = path.basename(blockPath);
    const configPath = path.join(blockPath, 'config.json');
    const templatePath = path.join(blockPath, TEMPLATE_FILENAME);
    const attributesOutputPath = path.join(blockPath, 'attributes.json');
    const blockJsonPath = path.join(blockPath, BLOCK_JSON_FILENAME);
    const renderPhpPath = path.join(blockPath, 'render.php');
    console.log(`Processing block: ${blockSlug}`);

    // 1. Read config.json
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.error(`  ❌ Error reading or parsing config.json for ${blockSlug}:`, error.message);
        return;
    }

    if (!config || !config.fields) {
        console.warn(`  ⚠️ Config file for ${blockSlug} is missing "fields" array. Skipping.`);
        return;
    }

    // 2. Incremental Build Check
    if (fs.existsSync(templatePath) && fs.existsSync(blockJsonPath) && fs.existsSync(attributesOutputPath)) {
        const configStats = fs.statSync(configPath);
        const editStats = fs.statSync(templatePath);
        const blockJsonStats = fs.statSync(blockJsonPath);
        const attrStats = fs.statSync(attributesOutputPath);

        if (configStats.mtime < editStats.mtime && 
            configStats.mtime < blockJsonStats.mtime && 
            configStats.mtime < attrStats.mtime) {
            console.log(`  ⏩ Skipping ${blockSlug} (Up to date).`);
            return;
        }
    }

    // 3. Prepare Imports, JSX, and Attributes
    let componentsImports = new Set();
    let blockEditorImports = new Set();
    let generatedJSX = '';
    let generatedAttributes = {};

    // Defaults
    blockEditorImports.add('useBlockProps');
    blockEditorImports.add('InspectorControls');
    blockEditorImports.add('RichText');
    componentsImports.add('PanelBody');

    config.fields.forEach(field => {
        const map = FIELD_MAP[field.type];
        if (map) {
            // Add imports
            map.imports.forEach(componentName => {
                const packageKey = PACKAGE_MAP[componentName];
                if (packageKey === 'BLOCK_EDITOR') blockEditorImports.add(componentName);
                else if (packageKey === 'COMPONENTS') componentsImports.add(componentName);
            });

            // Special handling for MediaUpload helpers which might not be in the direct map import list for some types
            if (['image', 'file', 'gallery'].includes(field.type)) {
                blockEditorImports.add('MediaUpload');
                blockEditorImports.add('MediaUploadCheck');
            }

            // Generate field JSX
            let fieldJSX = map.jsx(field.key, field.label);

            // Handle Repeater
            if (field.type === 'repeater') {
                const subFields = field.subFields || [];
                if (subFields.length > 0) {
                    const innerJSX = generateRepeaterInnerJSX(subFields, field.key, componentsImports, blockEditorImports);
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__', innerJSX);
                    field.default = field.default || [];
                } else {
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__',
                        `<p style={{color: 'red'}}>Please define sub-fields in the Block Editor structure.</p>`);
                }
            }

            generatedJSX += fieldJSX + '\n';

            // Attributes
            generatedAttributes[field.key] = {
                type: map.attributeType,
                default: field.default || undefined,
            };

            if (field.type === 'contentEditor') {
                generatedAttributes[`is_html_mode_${field.key}`] = { type: 'boolean', default: false };
            }

        } else {
            console.warn(` ⚠️ Unknown field type '${field.type}'. Skipping.`);
        }
    });

    // Clean imports
    componentsImports.delete('RichText');
    componentsImports.delete('useBlockProps');
    componentsImports.delete('InspectorControls');

    const blockEditorImportStatement = `import { ${Array.from(blockEditorImports).join(', ')} } from '@wordpress/block-editor';`;
    const componentsImportStatement = `import { ${Array.from(componentsImports).join(', ')} } from '@wordpress/components';`;

    // 4. Save Attributes
    fs.writeFileSync(attributesOutputPath, JSON.stringify(generatedAttributes, null, 4), 'utf8');
    console.log(` ✅ Attributes saved to ${attributesOutputPath}.`);

    // 5. Inject Attributes into block.json
    try {
        let blockJsonContent = fs.readFileSync(blockJsonPath, 'utf8');
        
        let injectionAttributes = {};
        const reservedAttributes = ['message', 'default_title'];
        Object.keys(generatedAttributes).forEach(key => {
            if (!reservedAttributes.includes(key)) {
                injectionAttributes[key] = generatedAttributes[key];
            }
        });

        let newAttributesJsonString = '';
        if (Object.keys(injectionAttributes).length > 0) {
            const attrString = JSON.stringify(injectionAttributes, null, 4).slice(1, -1).trim();
            newAttributesJsonString = ',\n' + attrString;
        }

        let finalBlockJsonContent;
        if (blockJsonContent.match(FINAL_HOOK_REGEX)) {
            finalBlockJsonContent = blockJsonContent.replace(FINAL_HOOK_REGEX, newAttributesJsonString);
        } else {
            finalBlockJsonContent = blockJsonContent.replace(ATTRIBUTES_HOOK, newAttributesJsonString);
        }

        finalBlockJsonContent = finalBlockJsonContent.replace(/,\s*,/g, ',').replace(/},\s*,/g, '},');
        
        fs.writeFileSync(blockJsonPath, finalBlockJsonContent, 'utf8');
        console.log(` ✅ Dynamic attributes injected and saved to ${blockJsonPath}.`);
    } catch (error) {
        console.error(` ❌ Error writing block.json code for ${blockSlug}:`, error.message);
    }

    // 6. Generate Edit.js
    try {
        let templateContent = fs.readFileSync(templatePath, 'utf8');

        // Generate Preview
        let canvasPreviewJsx = '<p>No preview template found.</p>';
        if (fs.existsSync(renderPhpPath)) {
            const phpContent = fs.readFileSync(renderPhpPath, 'utf8');
            canvasPreviewJsx = convertRenderPhpToJsx(phpContent);
        }

        const blockEditorImportRegex = /import\s*{[^}]+}\s*from\s*'@wordpress\/block-editor';/;
        const componentsImportRegex = /import\s*{[^}]+}\s*from\s*'@wordpress\/components';/;

        let finalCode = templateContent
            .replace(blockEditorImportRegex, blockEditorImportStatement)
            .replace(componentsImportRegex, componentsImportStatement)
            .replace(INJECTION_MARKER, generatedJSX)
            .replace('// __INJECT_CANVAS_PREVIEW__', canvasPreviewJsx);

        fs.writeFileSync(templatePath, finalCode, 'utf8');
        console.log(` ✅ Generated code saved back to ${templatePath}.`);
    } catch (error) {
        console.error(` ❌ Error writing edit.js code for ${blockSlug}:`, error.message);
    }
}

// --- Main Execution ---
function generateAllBlocks() {
    console.log('--- Starting Multi-Block Code Generation ---');
    const blockDirectories = glob.sync(`${BLOCKS_SRC_DIR.replace(/\\/g, '/')}/*/`);
    if (blockDirectories.length === 0) {
        console.log('No block directories found in blocks/. Nothing to generate.');
        return;
    }
    blockDirectories.forEach(generateBlock);
    console.log('--- Block Code Generation Complete ---');
}

generateAllBlocks();