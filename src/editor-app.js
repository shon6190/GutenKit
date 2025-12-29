/**
 * Editor Application for defining block components.
 */
const { useState, useEffect, createElement } = wp.element;
const { Button, TextControl, Panel, PanelBody, SelectControl } = wp.components;

// Define the available field types (your component palette)
const FIELD_TYPES = [
    { label: 'Text Input', value: 'text' },
    { label: 'Number Input', value: 'number' },
    { label: 'Range Slider', value: 'range' }, // New
    // { label: 'Email Address', value: 'email' }, // New (uses TextControl)
    { label: 'URL Link', value: 'url' },       // New (uses URLInput or TextControl)
    
    { label: 'Text Area', value: 'textarea' },
    { label: 'Rich Text Content', value: 'contentEditor' }, // Existing/Renamed (WYSIWYG)
    
    { label: 'Image/Media', value: 'image' },
    { label: 'File Upload', value: 'file' }, // New (uses MediaUpload)
    { label: 'Gallery', value: 'gallery' }, // New (complex, placeholder added)
    
    { label: 'Date Picker', value: 'date' },
    { label: 'Date Time Picker', value: 'datetime' }, // New
    { label: 'Time Picker', value: 'time' },         // New
    
    { label: 'Color Picker', value: 'color' },
    { label: 'Icon Picker', value: 'icon' }, // New (Placeholder)
    
    { label: 'Repeater/Group', value: 'repeater' }, // Complex, requires nested fields
    { label: 'Relational (Post Select)', value: 'relational' }, // Complex, placeholder added
];

// --- NEW CODE ADDED HERE (Utility Function) ---
const slugifyKey = (value) => value.toLowerCase().replace(/[^a-z0-9_]/g, '');

// --- 1. The Main Application Component ---
const ComponentEditorApp = ({ initialConfig, blockSlug }) => {
    // State to hold the array of fields (the component structure)
    const [fields, setFields] = useState(initialConfig.fields || []);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedField, setSelectedField] = useState(null); // Field being edited
    const [message, setMessage] = useState('');
    const [template, setTemplate] = useState(initialConfig.template || '');
    // --- Helper function to add a new field ---
    const addField = (type) => {
        const newField = {
            type: type,
            key: `new_field_${fields.length}`,
            label: `New ${type} Field`,
            default: '',
        };
        setFields([...fields, newField]);
        setSelectedField(newField); // Automatically select the new field for editing
    };

    // --- Helper function to update a field's properties ---
    const updateField = (index, property, value) => {
        const newFields = fields.map((field, i) => {
            if (i === index) {
                // Ensure key is slugified
                if (property === 'key') {
                    value = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                }
                return { ...field, [property]: value };
            }
            return field;
        });
        setFields(newFields);
        // Also update the selected field reference if it's the one being edited
        setSelectedField(newFields[index]); 
    };

    // --- Helper function to remove a field ---
    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
        setSelectedField(null);
    };

    // Helper to insert tags like {{field_key}} at cursor position
    const insertTagAtCursor = (key) => {
        const textarea = document.getElementById('bf-html-template-area');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const tag = `{{${key}}}`;
        
        const newContent = text.substring(0, start) + tag + text.substring(end);
        setTemplate(newContent);

        // Maintain focus and move cursor after the tag
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
    };
    // --- AJAX Save Handler ---
    const handleSave = () => {
        setIsSaving(true);
        setMessage('');

        const data = {
            action: 'block_factory_save_structure',
            nonce: blockFactoryEditorData.nonce, // Retrieve nonce from PHP
            block_slug: blockSlug,
            config_data: JSON.stringify({ fields, template }),
        };

        // Use standard jQuery/fetch for AJAX submission
        jQuery.post(ajaxurl, data)
            .done(response => {
                if (response.success) {
                    setMessage(`✅ Success! ${response.data.message} ${response.data.next_step}`);
                } else {
                    setMessage(`❌ Error: ${response.data.message}`);
                }
            })
            .fail(() => {
                setMessage('❌ Critical Error: Could not reach the server.');
            })
            .always(() => {
                setIsSaving(false);
            });
    };


    // --- NEW CODE ADDED HERE (Repeater Renderer) ---
    const renderRepeaterSettings = (field, fieldIndex, updateFieldProp, removeFieldAtIndex) => {
        // Initialize the subFields array if it doesn't exist
        const subFields = field.subFields || [];

        // Function to add a new sub-field to the repeater
        const addSubField = (type) => {
            const newSubField = {
                type: type,
                key: slugifyKey(`sub_field_${subFields.length}_${type}`),
                label: `New ${type} Sub-Field`,
                default: '',
            };
            // Update the main field's subFields property
            updateFieldProp(fieldIndex, 'subFields', [...subFields, newSubField]);
        };

        // Function to update a sub-field's properties
        const updateSubField = (subIndex, property, value) => {
            const newSubFields = subFields.map((subField, i) => {
                if (i === subIndex) {
                    // Ensure key is slugified for the sub-field
                    if (property === 'key') {
                        value = slugifyKey(value);
                    }
                    return { ...subField, [property]: value };
                }
                return subField;
            });
            updateFieldProp(fieldIndex, 'subFields', newSubFields);
        };

        // Function to remove a sub-field
        const removeSubField = (subIndex) => {
            const newSubFields = subFields.filter((_, i) => i !== subIndex);
            updateFieldProp(fieldIndex, 'subFields', newSubFields);
        };
        
        // Function to render the settings for an individual sub-field
        const renderSubFieldSettings = (subField, subIndex) => {
            return createElement(
                PanelBody,
                { title: `${subField.label} (${subField.type})`, initialOpen: false, key: subIndex, className: 'repeater-sub-field-settings' },
                createElement(TextControl, {
                    label: "Sub-Field Label",
                    value: subField.label,
                    onChange: val => updateSubField(subIndex, 'label', val),
                }),
                createElement(TextControl, {
                    label: "Attribute Key (Variable Name)",
                    value: subField.key,
                    help: "Must be unique, lowercase, and contain only letters, numbers, and underscores.",
                    onChange: val => updateSubField(subIndex, 'key', val),
                }),
                createElement(SelectControl, {
                    label: "Sub-Field Type",
                    value: subField.type,
                    options: FIELD_TYPES.map(t => ({ label: t.label, value: t.value })).filter(t => t.value !== 'repeater'),
                    onChange: val => updateSubField(subIndex, 'type', val),
                }),
                createElement(Button, { 
                    isDestructive: true, 
                    onClick: () => removeSubField(subIndex),
                    style: { marginTop: '10px' }
                }, 'Delete Sub-Field')
            );
        };

        return createElement(
            PanelBody,
            { title: 'Repeater Sub-Fields', initialOpen: true },
            
            // 1. Add New Sub-Field Palette
            createElement('h4', null, 'Add New Sub-Field'),
            createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' } },
                FIELD_TYPES.filter(t => t.value !== 'repeater' && t.value !== 'relational').map(type =>
                    createElement(Button, { 
                        isSecondary: true, 
                        onClick: () => addSubField(type.value)
                    }, type.label)
                )
            ),

            // 2. List of Existing Sub-Fields
            createElement('h4', null, `Current Sub-Fields (${subFields.length})`),
            subFields.length > 0 ? 
                subFields.map((subField, subIndex) => renderSubFieldSettings(subField, subIndex)) :
                createElement('p', null, 'No sub-fields defined. Add one above.')
        );
    };

    // --- Render the Field Settings Panel ---
    // const renderSettings = () => {
    //     if (!selectedField) return <p>Select a field on the left to edit its properties.</p>;
        
    //     const index = fields.indexOf(selectedField);

    //     return (
    //         <Panel header="Field Settings">
    //             <PanelBody title={`Editing: ${selectedField.label} (${selectedField.type})`} initialOpen={true}>
    //                 <TextControl
    //                     label="Field Label"
    //                     value={selectedField.label}
    //                     onChange={val => updateField(index, 'label', val)}
    //                 />
    //                 <TextControl
    //                     label="Attribute Key (Variable Name)"
    //                     value={selectedField.key}
    //                     help="Must be unique, lowercase, and contain only letters, numbers, and underscores."
    //                     onChange={val => updateField(index, 'key', val)}
    //                 />
    //                 <TextControl
    //                     label="Default Value (Optional)"
    //                     value={selectedField.default}
    //                     onChange={val => updateField(index, 'default', val)}
    //                 />
    //                 <Button 
    //                     isDestructive 
    //                     onClick={() => removeField(index)} 
    //                     style={{marginTop: '10px'}}
    //                 >
    //                     Delete Field
    //                 </Button>
    //             </PanelBody>
    //         </Panel>
    //     );
    // };
    // --- Render the Field Settings Panel ---
    const renderSettings = () => { // <--- THIS FUNCTION IS REPLACED
        if (!selectedField) return <p>Select a field on the left to edit its properties.</p>;
        
        const index = fields.indexOf(selectedField);

        return (
            <Panel header="Field Settings">
                {/* Standard Settings (Label, Key, Default, Delete) */}
                <PanelBody title={`Editing: ${selectedField.label} (${selectedField.type})`} initialOpen={true}>
                    <TextControl
                        label="Field Label"
                        value={selectedField.label}
                        onChange={val => updateField(index, 'label', val)}
                    />
                    <TextControl
                        label="Attribute Key (Variable Name)"
                        value={selectedField.key}
                        help="Must be unique, lowercase, and contain only letters, numbers, and underscores."
                        onChange={val => updateField(index, 'key', val)}
                    />
                    <TextControl
                        label="Default Value (Optional)"
                        value={selectedField.default}
                        onChange={val => updateField(index, 'default', val)}
                    />
                    <Button 
                        isDestructive 
                        onClick={() => removeField(index)} 
                        style={{marginTop: '10px'}}
                    >
                        Delete Field
                    </Button>
                </PanelBody>

                {/* CONDITIONALLY RENDER REPEATER SUB-FIELDS SETTINGS */}
                {selectedField.type === 'repeater' && 
                    renderRepeaterSettings(selectedField, index, updateField, removeField)
                }
            </Panel>
        );
    };


    return createElement(
        'div',
        { style: { display: 'flex', gap: '20px', marginTop: '20px' } },
        
        // --- Left Column: Component Palette ---
        createElement(
            'div',
            { style: { width: '20%', borderRight: '1px solid #ccc', paddingRight: '20px' } },
            createElement('h3', null, 'Component Palette'),
            FIELD_TYPES.map(type => 
                createElement(Button, { 
                    isSecondary: true, 
                    style: { display: 'block', width: '100%', marginBottom: '10px' },
                    onClick: () => addField(type.value)
                }, type.label)
            )
        ),
        
        // --- Middle Column: Component Structure (The Fields List) ---
        createElement(
            'div',
            { style: { width: '40%' } },
            createElement('h3', null, 'Block Structure'),
            
            // Render the list of fields
            fields.map((field, index) => 
                createElement('div', { 
                    key: index, 
                    style: { 
                        padding: '10px', 
                        marginBottom: '8px', 
                        border: '1px solid #ddd',
                        backgroundColor: selectedField === field ? '#eaf4ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between'
                    },
                    onClick: () => setSelectedField(field)
                }, 
                createElement('span', null, `${field.label} (${field.type})`),
                // NEW: Quick-add button next to field names
                createElement(Button, { 
                    isSmall: true, 
                    isTertiary: true,
                    onClick: (e) => { e.stopPropagation(); insertTagAtCursor(field.key); }
                }, 'Add to HTML')
                )
            ),
            createElement('hr', { style: { margin: '20px 0' } }),
            // --- NEW SECTION: HTML TEMPLATE EDITOR ---
            createElement('h3', null, '2. HTML Template'),
            createElement('p', { style: { fontSize: '12px', color: '#666' } }, 
                'Write your HTML below. Click the "Add to HTML" buttons above or use {{field_key}} placeholders.'
            ),
            
            createElement('textarea', {
                id: 'bf-html-template-area',
                value: template,
                onChange: (e) => setTemplate(e.target.value),
                style: { 
                    width: '100%', 
                    minHeight: '350px', 
                    fontFamily: 'monospace', 
                    padding: '12px',
                    fontSize: '13px',
                    border: '1px solid #757575',
                    borderRadius: '4px'
                },
                placeholder: `<div class="banner">\n  <h2>{{${fields[0]?.key || 'field_key'}}}</h2>\n</div>`
            }),
            createElement('hr', null),
            
            // Save Button and Messages
            createElement(Button, { 
                isPrimary: true,
                isBusy: isSaving,
                // onClick: handleSave,
                onClick: () => handleSave(fields, template), // Pass both to save function
                disabled: isSaving
            }, isSaving ? 'Compiling Code...' : 'Save Structure & Build Block'),

            message && createElement('p', { style: { marginTop: '15px', fontWeight: 'bold' } }, message)
        ),

        // --- Right Column: Settings Panel ---
        createElement(
            'div',
            { style: { width: '40%' } },
            renderSettings()
        )
    );
};

 
// --- Render the application once the DOM is ready ---
jQuery(document).ready(function() {
    const rootElement = document.getElementById('component-editor-root');
    
    // Check if the localized data object exists (blockFactoryEditorData)
    if (rootElement && typeof blockFactoryEditorData !== 'undefined') { 
        wp.element.render(
            createElement(ComponentEditorApp, { 
                // CRITICAL: Access the nested properties
                initialConfig: blockFactoryEditorData.config, 
                blockSlug: blockFactoryEditorData.blockSlug 
            }),
            rootElement
        );
    }
});