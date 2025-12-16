// generate-block-code-multi.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// --- Configuration ---
const BLOCKS_SRC_DIR = path.resolve(__dirname, 'blocks');
const TEMPLATE_FILENAME = 'edit.js'; // The name of your template file inside the block folder
const INJECTION_MARKER = '// __INJECT_UI_CODE__';

const PACKAGE_MAP = {
    // --- @wordpress/block-editor components ---
    'RichText': 'BLOCK_EDITOR',
    'InspectorControls': 'BLOCK_EDITOR',
    'MediaUpload': 'BLOCK_EDITOR',
    'MediaUploadCheck': 'BLOCK_EDITOR',
    'useBlockProps': 'BLOCK_EDITOR', // Already in template, but good to track

    // --- @wordpress/components components ---
    'PanelBody': 'COMPONENTS', // Already in template, but good to track
    'TextControl': 'COMPONENTS',
    'Button': 'COMPONENTS',
    'ToggleControl': 'COMPONENTS',
    'RangeControl': 'COMPONENTS',
    'TextareaControl': 'COMPONENTS',
    'SelectControl': 'COMPONENTS', // If you use SelectControl
    // Add all other non-editor components here (RangeControl, SelectControl, etc.)
};

// --- NEW CONSTANTS FOR block.json FIX ---
const BLOCK_JSON_FILENAME = 'block.json';

const ATTRIBUTES_HOOK = '"__INJECT_ATTRIBUTES_HOOK__": {}';
// The string you want to search for, in case the regex fails

// The REGEX to match the optional comma before the hook, plus all surrounding whitespace.
// CRUCIAL: We are targeting an optional comma (,) followed by whitespace (\s*)
// and the entire hook structure. We replace the whole match with our content.
const ATTRIBUTES_HOOK_REGEX = /,\s*"__INJECT_ATTRIBUTES_HOOK__"\s*:\s*{}\s*/;
// If your template had the hook without a preceding comma, change the regex to:
// const ATTRIBUTES_HOOK_REGEX = /\s*"__INJECT_ATTRIBUTES_HOOK__"\s*:\s*{}\s*/;
// --- Based on your error, let's assume the comma IS NOT in the regex but it is in the template.

// --- The Safest Regex (Targets the Hook and the Comma BEFORE IT) ---
// If the comma is present in the line BEFORE the hook, we must include it in the replacement pattern.
// Let's use the explicit string search on a modified target pattern:
const TARGET_PATTERN = '},\n\t\t\t' + ATTRIBUTES_HOOK; // Example: Look for the closing brace of the previous attribute, comma, newline, tabs, and the hook.

// --- Function to generate the JSX for a field nested inside a repeater ---
// This function is crucial for handling nested fields.
// const generateRepeaterInnerJSX = (subFields, repeaterKey, componentImports) => {
const generateRepeaterInnerJSX = (subFields, repeaterKey, componentImports, blockEditorImports) => {
    let innerJSX = '';

    subFields.forEach(subField => {
        const map = FIELD_MAP[subField.type];

        if (map) {
            // Add imports for the sub-field
            map.imports.forEach(i => componentImports.add(i));

            // CRITICAL: Generate the JSX, but scope the variables to the repeater item.
            // We use itemKey and itemLabel placeholders in the JSX function below
            // to ensure variables like 'item.sub_field_key' are used.
            const itemKey = `item.${subField.key}`;
            const itemLabel = `${subField.label}`;

            // The original JSX needs to be adapted. We'll only use simple TextControl for illustration
            // because adapting all FIELD_MAP JSX templates is too complex.
            // We will use a simplified, common wrapper for all sub-fields:

            // NOTE: A robust solution would require rewriting all FIELD_MAP.jsx functions 
            // to accept a scope variable (e.g., isNested). For simplicity, we create
            // custom, safe JSX for the core sub-field types here.

            if (subField.type === 'text' || subField.type === 'number' || subField.type === 'url') {
                // Use a simple TextControl for all simple string/number types
                innerJSX += `
                            <TextControl
                                label="${itemLabel}"
                                type="${subField.type === 'number' ? 'number' : 'text'}"
                                value={ ${itemKey} || '' }
                                onChange={ ( value ) => {
                                    const newItems = [...attributes.${repeaterKey}];
                                    newItems[index] = { ...item, ${subField.key}: value };
                                    setAttributes({ ${repeaterKey}: newItems });
                                }}
                            />
                `;
            } else if (subField.type === 'textarea') {
                innerJSX += `
                            <TextareaControl
                                label="${itemLabel}"
                                value={ ${itemKey} || '' }
                                onChange={ ( value ) => {
                                    const newItems = [...attributes.${repeaterKey}];
                                    newItems[index] = { ...item, ${subField.key}: value };
                                    setAttributes({ ${repeaterKey}: newItems });
                                }}
                            />
                `;
            } else if (subField.type === 'image') {
                // This is a complex example, showing MediaUpload within the repeater context
                innerJSX += `
                            <MediaUploadCheck>
                                <MediaUpload
                                    // ... rest of the MediaUpload JSX ...
                                    render={ ( { open } ) => (
                                        <Button onClick={ open } isSecondary>
                                            { ${itemKey} ? 'Change ${subField.label}' : 'Select ${subField.label}' }
                                        </Button>
                                    ) }
                                />
                                { ${itemKey} && ${itemKey}.url && (
                                    <img src={ ${itemKey}.url } alt={ ${itemKey}.alt } style={{maxWidth: '50px', maxHeight: '50px', margin: '5px 0'}} />
                                )}
                            </MediaUploadCheck>
                `;

                // --- FIX: Ensure Button is explicitly added to the import list ---
                componentImports.add('Button');
                // These are already correct:
                blockEditorImports.add('MediaUpload');
                blockEditorImports.add('MediaUploadCheck');
            }
            // Add more conditions here for other complex types if needed (color, date, etc.)

        } else {
            console.warn(`  ⚠️ Unknown sub-field type '${subField.type}'. Skipping nested field.`);
        }
    });

    return innerJSX;
};
// --- Field Type Mappings (As defined previously) ---
const FIELD_MAP = {
    // -------------------------------------------------------------------------
    // BASIC INPUTS (String/Number)
    // -------------------------------------------------------------------------

    'text': {
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label}"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'textarea': {
        imports: ['TextareaControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextareaControl
                        label="${label}"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'number': {
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'number',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label}"
                        type="number" 
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: parseFloat(value) } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'range': {
        imports: ['RangeControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'number',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <RangeControl
                        label="${label}"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                        min={ 0 } 
                        max={ 100 }
                        step={ 1 }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'email': {
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label}"
                        type="email"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'url': {
        // Using TextControl type="url" is the simplest implementation
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label}"
                        type="url"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },

    // -------------------------------------------------------------------------
    // MEDIA FIELDS
    // -------------------------------------------------------------------------

    'image': {
        // imports: ['MediaUpload', 'MediaUploadCheck', 'Button', 'InspectorControls', 'PanelBody'],
        imports: ['Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'object', // Stores {id, url, alt}
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={ ( media ) => setAttributes( { ${key}: media } ) }
                            allowedTypes={ [ 'image' ] }
                            value={ attributes.${key} && attributes.${key}.id }
                            render={ ( { open } ) => (
                                <Button onClick={ open } isPrimary>
                                    { attributes.${key} ? 'Change Image' : 'Select Image' }
                                </Button>
                            ) }
                        />
                        { attributes.${key} && (
                            <Button onClick={ () => setAttributes( { ${key}: null } ) } isDestructive>
                                Remove Image
                            </Button>
                        ) }
                    </MediaUploadCheck>
                </PanelBody>
            </InspectorControls>
            {/* Render the image on the canvas - Includes robust type check for safety */}
            { attributes.${key} && typeof attributes.${key} === 'object' && attributes.${key}.url && (
                <img src={ attributes.${key}.url } alt={ attributes.${key}.alt } style={{maxWidth: '100%', height: 'auto'}} />
            ) }
        `,
    },
    'file': {
        // imports: ['MediaUpload', 'MediaUploadCheck', 'Button', 'InspectorControls', 'PanelBody'],
        imports: ['Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'object', // Stores {id, url, filename}
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={ ( media ) => setAttributes( { ${key}: media } ) }
                            allowedTypes={ [ 'application/pdf', 'application/msword', 'text', 'application/zip' ] } 
                            value={ attributes.${key} && attributes.${key}.id }
                            render={ ( { open } ) => (
                                <Button onClick={ open } isPrimary>
                                    { attributes.${key} ? 'Change File' : 'Select File' }
                                </Button>
                            ) }
                        />
                        { attributes.${key} && attributes.${key}.url && (
                            <p>Selected File: <strong>{ attributes.${key}.filename || attributes.${key}.url.split('/').pop() }</strong></p>
                        ) }
                        { attributes.${key} && (
                            <Button onClick={ () => setAttributes( { ${key}: null } ) } isDestructive>
                                Remove File
                            </Button>
                        ) }
                    </MediaUploadCheck>
                </PanelBody>
            </InspectorControls>
        `,
    },
    'gallery': {
        // imports: ['MediaUpload', 'MediaUploadCheck', 'Button', 'InspectorControls', 'PanelBody'],
        imports: ['Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'array', // Stores an array of {id, url, alt} objects
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={ ( media ) => setAttributes( { ${key}: media } ) }
                            allowedTypes={ [ 'image' ] }
                            multiple={ true } // CRITICAL for gallery
                            value={ attributes.${key} ? attributes.${key}.map( ( item ) => item.id ) : [] }
                            render={ ( { open } ) => (
                                <Button onClick={ open } isPrimary>
                                    { attributes.${key} && attributes.${key}.length > 0 ? 'Edit Gallery (' + attributes.${key}.length + ')' : 'Create Gallery' }
                                </Button>
                            ) }
                        />
                    </MediaUploadCheck>
                    { attributes.${key} && (
                        <div style={{ marginTop: '10px' }}>
                            {attributes.${key}.map((img, index) => (
                                <img key={index} src={img.url} style={{ width: '50px', height: '50px', objectFit: 'cover', margin: '5px' }} title={img.alt} />
                            ))}
                        </div>
                    )}
                </PanelBody>
            </InspectorControls>
        `,
    },

    // -------------------------------------------------------------------------
    // DATE / TIME / COLOR / BUTTON
    // -------------------------------------------------------------------------

    'date': {
        imports: ['DatePicker', 'InspectorControls', 'PanelBody'],
        attributeType: 'string', // Stores date string (e.g., YYYY-MM-DD)
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <p style={{ fontWeight: 'bold' }}>${label}</p>
                    <DatePicker
                        currentDate={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'time': {
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string', // Stores time string (e.g., "14:30")
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label}"
                        type="time"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'datetime': {
        imports: ['DatePicker', 'TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string', // Stores ISO date/time string
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <p style={{ fontWeight: 'bold' }}>Date</p>
                    <DatePicker
                        currentDate={ attributes.${key} }
                        onChange={ ( date ) => {
                            // Ensure the time component is maintained if changing only the date part
                            const currentDateTime = attributes.${key} ? new Date(attributes.${key}) : new Date();
                            const newDate = new Date(date);
                            newDate.setHours(currentDateTime.getHours(), currentDateTime.getMinutes(), currentDateTime.getSeconds());
                            setAttributes( { ${key}: newDate.toISOString() } );
                        }}
                    />
                    <TextControl
                        label="Time (HH:MM)"
                        type="time"
                        value={ attributes.${key} ? new Date(attributes.${key}).toTimeString().slice(0, 5) : '' }
                        onChange={ ( time ) => {
                            const baseDate = attributes.${key} ? new Date(attributes.${key}) : new Date();
                            const [hours, minutes] = time.split(':');
                            baseDate.setHours(hours);
                            baseDate.setMinutes(minutes);
                            setAttributes( { ${key}: baseDate.toISOString() } );
                        }}
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'color': {
        imports: ['ColorPalette', 'InspectorControls', 'PanelBody'],
        attributeType: 'string', // Stores hex or color name string
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <p style={{ fontWeight: 'bold' }}>${label}</p>
                    <ColorPalette
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'button': {
        imports: ['TextControl', 'Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'object', // Stores { text: string, url: string }
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label} Text"
                        value={ attributes.${key}.text || '' }
                        onChange={ ( text ) => setAttributes( { ${key}: { ...attributes.${key}, text } } ) }
                    />
                    <TextControl
                        label="${label} URL"
                        value={ attributes.${key}.url || '' }
                        onChange={ ( url ) => setAttributes( { ${key}: { ...attributes.${key}, url } } ) }
                    />
                    <a href={ attributes.${key}.url } className="button" target="_blank" rel="noopener noreferrer">
                        { attributes.${key}.text || 'Preview Button' }
                    </a>
                </PanelBody>
            </InspectorControls>
        `,
    },

    // -------------------------------------------------------------------------
    // COMPLEX / CONTAINER FIELDS
    // -------------------------------------------------------------------------
    // 'contentEditor': { // WYSIWYG Editor mapping for the sidebar
    //     imports: ['RichText', 'InspectorControls', 'PanelBody'],
    //     attributeType: 'string',
    //     jsx: (key, label) => `
    //     <InspectorControls key="${key}-settings">
    //         <PanelBody title="${label} Content Settings" initialOpen={true}>
    //             <div style={{ padding: '10px', border: '1px solid #ddd' }}>
    //                 <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>${label} (Rich Content sss)</p>
    //                 <RichText
    //                     tagName="div" 
    //                     value={ attributes.${key} }
    //                     // You can customize allowed formats here
    //                     allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] } 
    //                     onChange={ ( value ) => setAttributes( { ${key}: value } ) }
    //                     placeholder="Enter rich content here..."
    //                 />
    //             </div>
    //         </PanelBody>
    //     </InspectorControls>
    // `,
    // },
    'contentEditor': {
        // Uses RichText for Visual mode and TextareaControl for HTML mode
        imports: ['RichText', 'InspectorControls', 'PanelBody', 'ToggleControl', 'TextareaControl'],
        attributeType: 'string',
        // NOTE: This implementation requires an additional attribute, 'is_html_mode_[key]', to be generated for the block!
        jsx: (key, label) => {
            // We need a unique key for the HTML mode toggle state, typically 'is_html_mode_' + key
            const htmlModeKey = `is_html_mode_${key}`;
            return `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Content Settings" initialOpen={true}>
                    
                    {/* Toggle to switch between Visual and HTML/Text View */}
                    <ToggleControl
                        label="Enable HTML/Text View"
                        checked={ attributes.${htmlModeKey} }
                        onChange={ ( isChecked ) => setAttributes( { ${htmlModeKey}: isChecked } ) }
                        help={ attributes.${htmlModeKey} ? 'Editing in HTML/Text mode.' : 'Editing in Visual mode.' }
                    />

                    {/* Conditional Rendering based on the toggle */}
                    { attributes.${htmlModeKey} ? (
                        /* --- 1. HTML/Text Area View --- */
                        <TextareaControl
                            label="${label} (HTML/Text)"
                            value={ attributes.${key} }
                            onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                            rows={ 10 }
                        />
                    ) : (
                        /* --- 2. Visual/RichText View --- */
                        <div style={{ padding: '10px', border: '1px solid #ddd' }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>${label} (Visual)</p>
                            <RichText
                                tagName="div" 
                                value={ attributes.${key} }
                                allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] } 
                                onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                                placeholder="Enter rich content here..."
                            />
                        </div>
                    )}
                </PanelBody>
            </InspectorControls>
        `;
        },
    },
    'repeater': {
        imports: ['PanelBody', 'Button', 'TextControl', 'InspectorControls'],
        attributeType: 'array', // Stores an array of objects
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    {attributes.${key}.map((item, index) => (
                        <div key={index} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
                            <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                                ${label} Item #{index + 1}
                            </p>
                             <p style={{ display: 'none', fontStyle: 'italic', color: '#666' }}>
                            // --------------------------------------------------------------------------------
                            // !!! HOOK FOR DYNAMIC SUB-FIELD CODE !!!
                            // --------------------------------------------------------------------------------
                            // This will be replaced by the generated JSX from subFields in the config file.
                            // The logic needs to reference 'item' and 'index'.
                            </p>
                            __REPEATER_INNER_JSX_HOOK__

                            <Button 
                                isDestructive 
                                onClick={() => {
                                    const newItems = attributes.${key}.filter((_, i) => i !== index);
                                    setAttributes({ ${key}: newItems });
                                }}
                                style={{ marginTop: '10px' }}
                            >
                                Remove Item
                            </Button>
                        </div>
                    ))}
                    <Button 
                        isPrimary 
                        onClick={() => {
                            // Initialize with default group fields based on your config.
                            // NOTE: This default initialization must be updated to match the sub-fields!
                            // For safety, we initialize an empty object here.
                            setAttributes({ ${key}: [...attributes.${key}, {}] }); 
                        }}
                    >
                        Add ${label} Item
                    </Button>
                </PanelBody>
            </InspectorControls>
        `,
    },
    'relational': {
        // Requires custom data fetching (e.g., wp.data, useSelect) for real post selection.
        imports: ['SelectControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'number', // Stores the selected Post ID
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <SelectControl
                        label="${label} (Post Selector)"
                        help="NOTE: Requires custom logic (useSelect/wp.data) to fetch posts."
                        value={ attributes.${key} }
                        options={ [ { label: '--- Select Post ---', value: '' }, { label: 'Sample Post (ID 1)', value: 1 } ] } // Placeholder options
                        onChange={ ( value ) => setAttributes( { ${key}: parseInt(value) } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'icon': {
        // Simple text input for icon class or custom component placeholder
        imports: ['TextControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <TextControl
                        label="${label} (Icon Class/Name)"
                        help="Example: fas fa-star (requires FontAwesome)"
                        value={ attributes.${key} }
                        onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
};

// --- Core Generation Logic for a single block ---
function generateBlock(blockPath) {
    const blockSlug = path.basename(blockPath);
    const configPath = path.join(blockPath, 'config.json');
    const templatePath = path.join(blockPath, TEMPLATE_FILENAME);
    const attributesOutputPath = path.join(blockPath, 'attributes.json');
    const blockJsonPath = path.join(blockPath, BLOCK_JSON_FILENAME); // Define path for block.json

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


    // --- 2. Prepare Imports, JSX, and Attributes ---

    // Components from @wordpress/components (TextControl, Button, PanelBody, etc.)
    let componentsImports = new Set();
    // Components from @wordpress/block-editor (useBlockProps, RichText, InspectorControls, etc.)
    let blockEditorImports = new Set();

    let generatedJSX = '';
    let generatedAttributes = {};

    // Always require these fundamental block editor components
    blockEditorImports.add('useBlockProps');
    blockEditorImports.add('InspectorControls');
    blockEditorImports.add('RichText'); // Even though it's in the template, it's safer to ensure it's tracked

    // Always require PanelBody for structuring sidebar settings
    componentsImports.add('PanelBody');

    config.fields.forEach(field => {
        const map = FIELD_MAP[field.type];
        if (map) {

            // ** --- 1. CORRECTED IMPORT ROUTING LOGIC (Applied to main field) --- **
            map.imports.forEach(componentName => {
                const packageKey = PACKAGE_MAP[componentName];

                if (packageKey === 'BLOCK_EDITOR') {
                    blockEditorImports.add(componentName);
                } else if (packageKey === 'COMPONENTS') {
                    componentsImports.add(componentName);
                }
            });
            // ** ----------------------------------- **

            // --- NEW: Explicitly route BLOCK_EDITOR imports for Image/File/Gallery ---
            // This fixes the crash for DIRECT image/file fields whose imports were removed 
            // from FIELD_MAP.imports to avoid double declaration.
            if (field.type === 'image' || field.type === 'file' || field.type === 'gallery') {
                blockEditorImports.add('MediaUpload');
                blockEditorImports.add('MediaUploadCheck');
            }
            // --- END NEW LOGIC ---

            // --- 2. Initialize JSX from the field map template ---
            let fieldJSX = map.jsx(field.key, field.label);

            // ** --- 3. NEW LOGIC FOR REPEATER FIELD --- **
            if (field.type === 'repeater') {
                const subFields = field.subFields || [];

                if (subFields.length > 0) {
                    // Pass both import sets for the helper to manage nested component imports
                    const innerJSX = generateRepeaterInnerJSX(subFields, field.key, componentsImports, blockEditorImports);

                    // Replace the hook in the repeater's template JSX
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__', innerJSX);

                    // Ensure default is array for repeater
                    field.default = field.default || [];

                } else {
                    // Warning if repeater is used but no sub-fields are defined
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__',
                        `// ⚠️ WARNING: Repeater field '${field.label}' has no sub-fields defined in config.json.
                    <p style={{color: 'red'}}>Please define sub-fields in the Block Editor structure.</p>`);
                }
            }
            // ** --- END NEW REPEATER LOGIC --- **


            // --- 4. Generate JSX for the Edit function body (using potentially modified JSX) ---
            generatedJSX += fieldJSX + '\n';

            // --- 5. Define Attributes ---
            generatedAttributes[field.key] = {
                type: map.attributeType,
                default: field.default || undefined,
            };

            // Additional logic for contentEditor's HTML toggle state attribute
            if (field.type === 'contentEditor') {
                generatedAttributes[`is_html_mode_${field.key}`] = {
                    type: 'boolean',
                    default: false,
                };
            }

        } else {
            console.warn(` ⚠️ Unknown field type '${field.type}'. Skipping.`);
        }
    });
    // --- 3. Generate Import Statements ---

    // Remove components that should be imported from @wordpress/block-editor
    componentsImports.delete('RichText');
    componentsImports.delete('useBlockProps');
    componentsImports.delete('InspectorControls');

    // Create the final import statements
    const blockEditorImportsArray = Array.from(blockEditorImports).join(', ');
    const componentsImportsArray = Array.from(componentsImports).join(', ');

    // The final import statements to be injected
    const blockEditorImportStatement = `import { ${blockEditorImportsArray} } from '@wordpress/block-editor';`;
    const componentsImportStatement = `import { ${componentsImportsArray} } from '@wordpress/components';`;

    // 3. Save Attributes for PHP
    fs.writeFileSync(attributesOutputPath, JSON.stringify(generatedAttributes, null, 4), 'utf8');
    console.log(` ✅ Attributes saved to ${attributesOutputPath}.`);
    // ==========================================================
    // --- STEP 3.5: FIX ATTRIBUTE INJECTION INTO block.json ---
    // ==========================================================
    let blockJsonContent;
    try {
        blockJsonContent = fs.readFileSync(blockJsonPath, 'utf8');
    } catch (error) {
        console.error(` ❌ Error reading block.json template ${blockJsonPath}:`, error.message);
        return;
    }

    // 3.5.1 Prepare dynamic attributes for injection
    let injectionAttributes = {};
    // 'message' and 'default_title' are already defined in the block.json template,
    // so we only grab the NEW fields from generatedAttributes for injection.
    const reservedAttributes = ['message', 'default_title'];
    // Populate injectionAttributes with only the *new* fields
    Object.keys(generatedAttributes).forEach(key => {
        if (!reservedAttributes.includes(key)) {
            injectionAttributes[key] = generatedAttributes[key];
        }
    });

    let newAttributesJsonString = '';



    const newKeys = Object.keys(injectionAttributes);

    if (newKeys.length > 0) {
        // Stringify only the new attributes for injection
        const fullJson = JSON.stringify(injectionAttributes, null, 4);

        // Remove the outer braces { } and trim whitespace
        const attributesContent = fullJson.slice(1, -1).trim();

        // Add the comma and newline required to correctly separate from the attribute above it
        newAttributesJsonString = ',\n' + attributesContent;
    }

    const FINAL_HOOK_REGEX = /(,\s*)"__INJECT_ATTRIBUTES_HOOK__"\s*:\s*{}\s*/;

    let finalBlockJsonContent;
    // Try to replace using the robust regex first:
    if (blockJsonContent.match(FINAL_HOOK_REGEX)) {
        // If the hook is found WITH a preceding comma, we replace the whole match
        finalBlockJsonContent = blockJsonContent.replace(FINAL_HOOK_REGEX, newAttributesJsonString);
    } else {
        // If the hook is found without a preceding comma, we replace the hook (string match)
        // and let the newAttributesJsonString (which starts with a comma) handle separation.
        finalBlockJsonContent = blockJsonContent.replace(ATTRIBUTES_HOOK, newAttributesJsonString);
    }

    // 3. Post-processing to remove any double commas (the final safety net)
    // This will clean up the final output if a double comma was introduced.
    // It searches for two commas separated by whitespace and replaces them with a single comma.
    finalBlockJsonContent = finalBlockJsonContent.replace(/,\s*,/g, ',');

    // 4. Clean up any trailing commas just before the closing brace of 'attributes'
    // This specifically addresses the error you saw: }, , "new_field_1"
    finalBlockJsonContent = finalBlockJsonContent.replace(/},\s*,/g, '},');
    // 3.5.2 Replace the hook and save the final block.json
    // let finalBlockJsonContent = blockJsonContent.replace(ATTRIBUTES_HOOK, newAttributesJsonString);

    try {
        fs.writeFileSync(blockJsonPath, finalBlockJsonContent, 'utf8');
        console.log(` ✅ Dynamic attributes injected and saved to ${blockJsonPath}.`);
    } catch (error) {
        console.error(` ❌ Error writing final block.json code for ${blockSlug}:`, error.message);
    }
    // ==========================================================

    // 4. Read the Edit File Template
    let templateContent;
    try {
        templateContent = fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
        console.error(` ❌ Error reading template file ${templatePath}:`, error.message);
        return;
    }

    // --- 5. Define Regex Patterns and Inject Code ---

    // Regex to match the existing block-editor import at the top of the file
    // Note: It's safer to capture the entire first line that imports from '@wordpress/block-editor'
    const blockEditorImportRegex = /import\s*{[^}]+}\s*from\s*'@wordpress\/block-editor';/;

    // Regex to match the existing components import (even if it's TextareaControl)
    const componentsImportRegex = /import\s*{[^}]+}\s*from\s*'@wordpress\/components';/;

    let finalCode = templateContent;

    // A. Replace the existing @wordpress/block-editor import with the newly generated one
    finalCode = finalCode.replace(blockEditorImportRegex, blockEditorImportStatement);

    // B. Replace the existing @wordpress/components import with the newly generated one
    // This is the line that was failing:
    finalCode = finalCode.replace(componentsImportRegex, componentsImportStatement);

    // C. Inject the JSX code into the function body
    finalCode = finalCode.replace(INJECTION_MARKER, generatedJSX);

    // 6. Save the Final `edit.js` (Overwriting the template, which Webpack will then read)
    try {
        fs.writeFileSync(templatePath, finalCode, 'utf8');
        console.log(` ✅ Generated code saved back to ${templatePath}.`);
    } catch (error) {
        console.error(` ❌ Error writing final block code for ${blockSlug}:`, error.message);
    }
}



// --- Main Execution ---
function generateAllBlocks() {
    console.log('--- Starting Multi-Block Code Generation ---');

    // Find all directories inside the blocks folder
    const blockDirectories = glob.sync(`${BLOCKS_SRC_DIR}/*/`);

    if (blockDirectories.length === 0) {
        console.log('No block directories found in blocks/. Nothing to generate.');
        return;
    }

    blockDirectories.forEach(generateBlock);

    console.log('--- Block Code Generation Complete ---');
}

generateAllBlocks();