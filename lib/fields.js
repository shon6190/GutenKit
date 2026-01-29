const { PACKAGE_MAP } = require('./constants');

// --- Helper: Generate JSX for Repeater Inner Fields ---
const generateRepeaterInnerJSX = (subFields, repeaterKey, componentImports, blockEditorImports) => {
    let innerJSX = '';

    subFields.forEach(subField => {
        // Access FIELD_MAP directly (circular dependency workaround if needed, but here simple const ref acts up)
        // We will define FIELD_MAP below and use it.
        const map = FIELD_MAP[subField.type];

        if (map) {
            // Add imports for the sub-field
            map.imports.forEach(i => {
                const pkg = PACKAGE_MAP[i];
                if (pkg === 'BLOCK_EDITOR') blockEditorImports.add(i);
                else componentImports.add(i);
            });

            const itemKey = `item.${subField.key}`;
            const itemLabel = `${subField.label}`;

            if (['text', 'number', 'url'].includes(subField.type)) {
                innerJSX += `
                            <TextControl
                                label="${itemLabel}"
                                type="${subField.type === 'number' ? 'number' : 'text'}"
                                value={ ${itemKey} || '' }
                                onChange={ ( value ) => {
                                    const items = Array.isArray(attributes.${repeaterKey}) ? attributes.${repeaterKey} : [];
                                    const newItems = [...items];
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
                                    const items = Array.isArray(attributes.${repeaterKey}) ? attributes.${repeaterKey} : [];
                                    const newItems = [...items];
                                    newItems[index] = { ...item, ${subField.key}: value };
                                    setAttributes({ ${repeaterKey}: newItems });
                                }}
                            />
                `;
            } else if (subField.type === 'image') {
                componentImports.add('Button');
                blockEditorImports.add('MediaUpload');
                blockEditorImports.add('MediaUploadCheck');

                innerJSX += `
                            <MediaUploadCheck>
                                <MediaUpload
                                    onSelect={ ( media ) => {
                                        const items = Array.isArray(attributes.${repeaterKey}) ? attributes.${repeaterKey} : [];
                                        const newItems = [...items];
                                        newItems[index] = { ...item, ${subField.key}: media };
                                        setAttributes({ ${repeaterKey}: newItems });
                                    }}
                                    allowedTypes={ [ 'image' ] }
                                    value={ ${itemKey} && ${itemKey}.id }
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
            }
        } else {
            console.warn(`  ⚠️ Unknown sub-field type '${subField.type}' in repeater.`);
        }
    });

    return innerJSX;
};

// --- Field Map Definitions ---
const FIELD_MAP = {
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
    'image': {
        imports: ['Button', 'InspectorControls', 'PanelBody'], // MediaUpload handled explicitly in main
        attributeType: 'object',
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
            { attributes.${key} && typeof attributes.${key} === 'object' && attributes.${key}.url && (
                <img src={ attributes.${key}.url } alt={ attributes.${key}.alt } style={{maxWidth: '100%', height: 'auto'}} />
            ) }
        `,
    },
    'file': {
        imports: ['Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'object',
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
        imports: ['Button', 'InspectorControls', 'PanelBody'],
        attributeType: 'array',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <MediaUploadCheck>
                        <MediaUpload
                            onSelect={ ( media ) => setAttributes( { ${key}: media } ) }
                            allowedTypes={ [ 'image' ] }
                            multiple={ true }
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
    'date': {
        imports: ['DatePicker', 'InspectorControls', 'PanelBody'],
        attributeType: 'string',
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
        attributeType: 'string',
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
        attributeType: 'string',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <p style={{ fontWeight: 'bold' }}>Date</p>
                    <DatePicker
                        currentDate={ attributes.${key} }
                        onChange={ ( date ) => {
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
        attributeType: 'string',
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
        attributeType: 'object',
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
    'contentEditor': {
        imports: ['RichText', 'InspectorControls', 'PanelBody', 'ToggleControl', 'TextareaControl'],
        attributeType: 'string',
        jsx: (key, label) => {
            const htmlModeKey = `is_html_mode_${key}`;
            return `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Content Settings" initialOpen={true}>
                    <ToggleControl
                        label="Enable HTML/Text View"
                        checked={ attributes.${htmlModeKey} }
                        onChange={ ( isChecked ) => setAttributes( { ${htmlModeKey}: isChecked } ) }
                        help={ attributes.${htmlModeKey} ? 'Editing in HTML/Text mode.' : 'Editing in Visual mode.' }
                    />
                    { attributes.${htmlModeKey} ? (
                        <TextareaControl
                            label="${label} (HTML/Text)"
                            value={ attributes.${key} }
                            onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                            rows={ 10 }
                        />
                    ) : (
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
        attributeType: 'array',
        jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                {(Array.isArray(attributes.${key}) ? attributes.${key} : []).map((item, index) => (
                        <div key={index} style={{ border: '1px solid #ccc', padding: '10px', margin: '10px 0' }}>
                            <p style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
                                ${label} Item #{index + 1}
                            </p>
                            __REPEATER_INNER_JSX_HOOK__
                            <Button 
                                isDestructive 
                                onClick={() => {
                                    const items = Array.isArray(attributes.${key}) ? attributes.${key} : [];
                                    const newItems = items.filter((_, i) => i !== index);
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
                            const items = Array.isArray(attributes.${key}) ? attributes.${key} : [];
                            setAttributes({ ${key}: [...items, {}] });
                        }}
                    >
                        Add ${label} Item
                    </Button>
                </PanelBody>
            </InspectorControls>
        `,
    },
    'relational': {
        imports: ['SelectControl', 'InspectorControls', 'PanelBody'],
        attributeType: 'number',
        jsx: (key, label) => `
            <InspectorControls key="${key}-settings">
                <PanelBody title="${label} Settings" initialOpen={true}>
                    <SelectControl
                        label="${label} (Post Selector)"
                        help="NOTE: Requires custom logic (useSelect/wp.data) to fetch posts."
                        value={ attributes.${key} }
                        options={ [ { label: '--- Select Post ---', value: '' }, { label: 'Sample Post (ID 1)', value: 1 } ] }
                        onChange={ ( value ) => setAttributes( { ${key}: parseInt(value) } ) }
                    />
                </PanelBody>
            </InspectorControls>
        `,
    },
    'icon': {
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

module.exports = {
    FIELD_MAP,
    generateRepeaterInnerJSX
};
