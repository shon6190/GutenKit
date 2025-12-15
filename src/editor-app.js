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

// --- 1. The Main Application Component ---
const ComponentEditorApp = ({ initialConfig, blockSlug }) => {
    // State to hold the array of fields (the component structure)
    const [fields, setFields] = useState(initialConfig.fields || []);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedField, setSelectedField] = useState(null); // Field being edited
    const [message, setMessage] = useState('');

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

    // --- AJAX Save Handler ---
    const handleSave = () => {
        setIsSaving(true);
        setMessage('');

        const data = {
            action: 'block_factory_save_structure',
            nonce: blockFactoryEditorData.nonce, // Retrieve nonce from PHP
            block_slug: blockSlug,
            config_data: JSON.stringify({ fields }),
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

    // --- Render the Field Settings Panel ---
    const renderSettings = () => {
        if (!selectedField) return <p>Select a field on the left to edit its properties.</p>;
        
        const index = fields.indexOf(selectedField);

        return (
            <Panel header="Field Settings">
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
                        cursor: 'pointer'
                    },
                    onClick: () => setSelectedField(field)
                }, 
                    `${field.label} (${field.type})`
                )
            ),
            
            createElement('hr', null),
            
            // Save Button and Messages
            createElement(Button, { 
                isPrimary: true,
                isBusy: isSaving,
                onClick: handleSave,
                disabled: isSaving
            }, isSaving ? 'Saving...' : 'Save Structure & Regenerate Code'),

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

