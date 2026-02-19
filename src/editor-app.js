/**
 * Editor Application for defining block components.
 */
const {
    useState,
    useEffect,
    createElement
} = wp.element;
const {
    Button,
    TextControl,
    Panel,
    PanelBody,
    SelectControl,
    TabPanel
} = wp.components;

// Define the available field types (your component palette)
const FIELD_TYPES = [{
        label: 'Text Input',
        value: 'text'
    },
    {
        label: 'Number Input',
        value: 'number'
    },
    {
        label: 'Range Slider',
        value: 'range'
    }, // New
    // { label: 'Email Address', value: 'email' }, // New (uses TextControl)
    {
        label: 'URL Link',
        value: 'url'
    }, // New (uses URLInput or TextControl)

    {
        label: 'Text Area',
        value: 'textarea'
    },
    {
        label: 'Rich Text Content',
        value: 'contentEditor'
    }, // Existing/Renamed (WYSIWYG)

    {
        label: 'Image/Media',
        value: 'image'
    },
    {
        label: 'File Upload',
        value: 'file'
    }, // New (uses MediaUpload)
    {
        label: 'Gallery',
        value: 'gallery'
    }, // New (complex, placeholder added)

    {
        label: 'Date Picker',
        value: 'date'
    },
    {
        label: 'Date Time Picker',
        value: 'datetime'
    }, // New
    {
        label: 'Time Picker',
        value: 'time'
    }, // New

    {
        label: 'Color Picker',
        value: 'color'
    },
    {
        label: 'Icon Picker',
        value: 'icon'
    }, // New (Placeholder)

    {
        label: 'Repeater/Group',
        value: 'repeater'
    }, // Complex, requires nested fields
    {
        label: 'Relational (Post Select)',
        value: 'relational'
    }, // Complex, placeholder added
];

// --- NEW CODE ADDED HERE (Utility Function) ---
const slugifyKey = (value) => value.toLowerCase().replace(/[^a-z0-9_]/g, '');

// --- 1. The Main Application Component ---
// --- 1. The Main Application Component ---
const ComponentEditorApp = ({
    initialConfig,
    blockSlug
}) => {
    // State to hold the array of fields (the component structure)
    const [fields, setFields] = useState(initialConfig.fields || []);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedField, setSelectedField] = useState(null); // Field being edited
    const [message, setMessage] = useState('');
    const [template, setTemplate] = useState(initialConfig.template || '');
    const [css, setCss] = useState(initialConfig.css || ''); // NEW: CSS State

    // WIZARD STATE: 0 = Structure, 1 = Template & Build
    const [step, setStep] = useState(0);

    // --- Drag and Drop State ---
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [draggedSubIndex, setDraggedSubIndex] = useState(null); // NEW: Sub-field drag state

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e, index) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    // Live Reordering on Drag Enter
    const handleDragEnter = (e, targetIndex) => {
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const newFields = [...fields];
        const item = newFields[draggedIndex];

        // Retrieve item at draggedIndex and move it to targetIndex
        newFields.splice(draggedIndex, 1);
        newFields.splice(targetIndex, 0, item);

        setFields(newFields);
        setDraggedIndex(targetIndex); // Update dragged index to new position
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDraggedIndex(null); // Reset drag state
    };

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
                return {
                    ...field,
                    [property]: value
                };
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
        if (!textarea) return; // Guard

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

    // --- AJAX Build Trigger ---
    const triggerBuild = () => {
        jQuery.post(ajaxurl, {
                action: 'bf_run_npm_build',
                nonce: blockFactoryEditor.nonce
            })
            .done(response => {
                if (response.success) {
                    setMessage('✅ Build Complete! Your block is ready.');
                } else {
                    setMessage(`⚠️ Build Failed. Error Details:\n${response.output}`);
                }
            })
            .fail(() => {
                setMessage('⚠️ Save success, but Build request failed.');
            })
            .always(() => {
                setIsSaving(false);
            });
    };

    // --- Cheat Sheet State ---
    const [cheatSheet, setCheatSheet] = useState(null);

    // Save Handling (Supports "Save & Next" and "Save & Build")
    const handleSave = (shouldBuild = false, nextStep = null) => {
        setIsSaving(true);
        setMessage(shouldBuild ? 'Saving & Building...' : 'Saving Structure...');
        setCheatSheet(null); // Reset to ensure we get fresh one

        const data = {
            action: 'block_factory_save_structure',
            nonce: blockFactoryEditor.nonce,
            block_slug: blockSlug,
            config_data: JSON.stringify({
                fields,
                template,
                css
            }),
        };

        jQuery.post(ajaxurl, data)
            .done(response => {
                if (response.success) {
                    // Capture Cheat Sheet Content
                    if (response.data.cheat_sheet) {
                        setCheatSheet(response.data.cheat_sheet);
                    }

                    if (shouldBuild) {
                        setMessage('✅ Saved! Starting build...');
                        triggerBuild(); // Auto-trigger build
                    } else {
                        setMessage('✅ Structure Saved.');
                        setIsSaving(false);
                        if (nextStep !== null) {
                            setStep(nextStep);
                        }
                    }
                } else {
                    setMessage(`❌ Error: ${response.data.message}`);
                    setIsSaving(false);
                }
            })
            .fail(() => {
                setMessage('❌ Critical Error: Could not reach the server.');
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
                    return {
                        ...subField,
                        [property]: value
                    };
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

        // --- Sub-Field Drag Handlers ---
        const handleSubDragStart = (e, subIndex) => {
            e.stopPropagation(); // Prevent bubbling to main field drag
            setDraggedSubIndex(subIndex);
            e.dataTransfer.effectAllowed = "move";
        };

        const handleSubDragEnter = (e, targetSubIndex) => {
            e.stopPropagation();
            if (draggedSubIndex === null || draggedSubIndex === targetSubIndex) return;

            const newSubFields = [...subFields];
            const item = newSubFields[draggedSubIndex];

            newSubFields.splice(draggedSubIndex, 1);
            newSubFields.splice(targetSubIndex, 0, item);

            updateFieldProp(fieldIndex, 'subFields', newSubFields);
            setDraggedSubIndex(targetSubIndex);
        };

        const handleSubDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            setDraggedSubIndex(null);
        };

        // Function to render the settings for an individual sub-field
        const renderSubFieldSettings = (subField, subIndex) => {
            return createElement(
                'div', // Wrap PanelBody in a div to handle drag events properly
                {
                    key: subIndex,
                    draggable: true,
                    onDragStart: (e) => handleSubDragStart(e, subIndex),
                    onDragOver: (e) => e.preventDefault(),
                    onDragEnter: (e) => handleSubDragEnter(e, subIndex),
                    onDrop: (e) => handleSubDrop(e),
                    style: {
                        marginTop: '10px',
                        opacity: draggedSubIndex === subIndex ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                        cursor: 'grab'
                    }
                },
                createElement(
                    PanelBody, {
                        title: `${subField.label} (${subField.type})`,
                        initialOpen: false,
                        className: 'repeater-sub-field-settings'
                    },
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
                        options: FIELD_TYPES.map(t => ({
                            label: t.label,
                            value: t.value
                        })).filter(t => t.value !== 'repeater'),
                        onChange: val => updateSubField(subIndex, 'type', val),
                    }),
                    createElement(Button, {
                        isDestructive: true,
                        onClick: () => removeSubField(subIndex),
                        style: {
                            marginTop: '10px'
                        }
                    }, 'Delete Sub-Field')
                )
            );
        };

        return createElement(
            PanelBody, {
                title: 'Repeater Sub-Fields',
                initialOpen: true
            },
            // 1. Add New Sub-Field Palette
            createElement('h4', null, 'Add New Sub-Field'),
            createElement('div', {
                    style: {
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '5px',
                        marginBottom: '15px'
                    }
                },
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
    const renderSettings = () => {
        if (!selectedField) return createElement('p', {
            style: {
                padding: '20px',
                color: '#666',
                fontStyle: 'italic',
                border: '1px dashed #ccc',
                marginTop: '20px'
            }
        }, 'Select a field on the left to edit its settings.');

        const index = fields.indexOf(selectedField);

        return createElement(
            Panel, {
                header: "Field Settings"
            },
            createElement(
                PanelBody, {
                    title: `Editing: ${selectedField.label} (${selectedField.type})`,
                    initialOpen: true
                },
                createElement(TextControl, {
                    label: "Field Label",
                    value: selectedField.label,
                    onChange: val => updateField(index, 'label', val)
                }),
                createElement(TextControl, {
                    label: "Attribute Key (Variable Name)",
                    value: selectedField.key,
                    help: "Must be unique, lowercase, and contain only letters, numbers, and underscores.",
                    onChange: val => updateField(index, 'key', val)
                }),
                createElement(TextControl, {
                    label: "Default Value (Optional)",
                    value: selectedField.default,
                    onChange: val => updateField(index, 'default', val)
                }),
                createElement(Button, {
                    isDestructive: true,
                    onClick: () => removeField(index),
                    style: {
                        marginTop: '10px'
                    }
                }, 'Delete Field')
            ),

            // CONDITIONAL REPEATER SETTINGS
            selectedField.type === 'repeater' && renderRepeaterSettings(selectedField, index, updateField, removeField)
        );
    };


    // ==========================================
    // RENDER: STEP 1 - STRUCTURE
    // ==========================================
    if (step === 0) {
        return createElement(
            'div', {
                style: {
                    marginTop: '20px'
                }
            },
            // Progress Indicator
            createElement('div', {
                    style: {
                        marginBottom: '20px',
                        padding: '10px',
                        background: '#e5e5e5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }
                },
                createElement('h2', {
                    style: {
                        margin: 0
                    }
                }, 'Step 1: Define Block Structure'),
                createElement('div', null,
                    createElement(Button, {
                        isPrimary: true,
                        isBusy: isSaving,
                        onClick: () => handleSave(false, 1)
                    }, 'Next: Edit Template >') // Save & Go Next
                )
            ),

            createElement(
                'div', {
                    style: {
                        display: 'flex',
                        gap: '20px',
                    }
                },
                // --- Left: Palette ---
                createElement(
                    'div', {
                        style: {
                            width: '20%',
                            borderRight: '1px solid #ccc',
                            paddingRight: '20px'
                        }
                    },
                    createElement('h3', null, 'Add Fields'),
                    FIELD_TYPES.map(type =>
                        createElement(Button, {
                            isSecondary: true,
                            style: {
                                display: 'block',
                                width: '100%',
                                marginBottom: '10px'
                            },
                            onClick: () => addField(type.value)
                        }, type.label)
                    )
                ),
                // --- Middle: Field List ---
                createElement(
                    'div', {
                        style: {
                            width: '40%'
                        }
                    },
                    createElement('h3', null, 'Block Fields'),
                    fields.length === 0 && createElement('p', {
                        style: {
                            fontStyle: 'italic',
                            color: '#777'
                        }
                    }, 'No fields added. Click a field type on the left to begin.'),

                    fields.map((field, index) =>
                        createElement('div', {
                                key: index,
                                draggable: true,
                                onDragStart: (e) => handleDragStart(e, index),
                                onDragOver: (e) => handleDragOver(e, index),
                                onDragEnter: (e) => handleDragEnter(e, index),
                                onDrop: (e) => handleDrop(e),
                                style: {
                                    padding: '10px',
                                    marginBottom: '8px',
                                    border: '1px solid #ddd',
                                    backgroundColor: selectedField === field ? '#eaf4ff' : (draggedIndex === index ? '#f0f0f0' : '#fff'),
                                    opacity: draggedIndex === index ? 0.5 : 1,
                                    cursor: 'grab',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center', // Center vertically
                                    transition: 'all 0.2s',
                                    borderLeft: selectedField === field ? '4px solid #007cba' : '1px solid #ddd'
                                },
                                onClick: () => setSelectedField(field)
                            },
                            createElement('div', {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }
                                },
                                createElement('span', {
                                    style: {
                                        cursor: 'grab',
                                        color: '#ccc',
                                        fontSize: '18px'
                                    }
                                }, '⋮⋮'),
                                createElement('span', {
                                    style: {
                                        fontWeight: '500'
                                    }
                                }, field.label),
                                createElement('span', {
                                    style: {
                                        color: '#666',
                                        fontSize: '0.9em'
                                    }
                                }, `(${field.type})`)
                            ),
                            createElement('span', {
                                style: {
                                    color: '#007cba',
                                    fontSize: '20px'
                                }
                            }, '›') // Arrow indicating edit
                        )
                    )
                ),
                // --- Right: Settings ---
                createElement(
                    'div', {
                        style: {
                            width: '40%'
                        }
                    },
                    renderSettings()
                )
            )
        );
    }

    // ==========================================
    // RENDER: STEP 2 - TEMPLATE & STYLE
    // ==========================================
    if (step === 1) {
        return createElement(
            'div', {
                style: {
                    marginTop: '20px'
                }
            },
            // Progress Indicator
            createElement('div', {
                    style: {
                        marginBottom: '20px',
                        padding: '10px',
                        background: '#e5e5e5',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }
                },
                createElement(Button, {
                    isSecondary: true,
                    onClick: () => setStep(0)
                }, '< Back to Structure'),
                createElement('h2', {
                    style: {
                        margin: 0
                    }
                }, 'Step 2: Template & Design'),
                createElement(Button, {
                    isPrimary: true,
                    isBusy: isSaving,
                    onClick: () => handleSave(true)
                }, isSaving ? 'Building...' : 'Save & Build Block')
            ),

            // --- CHEAT SHEET ---
            cheatSheet && createElement(
                PanelBody, {
                    title: 'Template Snippets (Use these keys in your HTML)',
                    initialOpen: true,
                    style: {
                        marginBottom: '20px',
                        background: '#f0f6fc',
                        border: '1px solid #cce5ff'
                    }
                },
                createElement('div', {
                    dangerouslySetInnerHTML: {
                        __html: cheatSheet
                    },
                    style: {
                        fontSize: '13px',
                        lineHeight: '1.6',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        padding: '10px'
                    }
                })
            ),

            createElement('div', {
                    style: {
                        display: 'flex',
                        gap: '20px'
                    }
                },
                // --- HTML Column ---
                createElement('div', {
                        style: {
                            width: '50%'
                        }
                    },
                    createElement('h3', null, 'HTML Template'),
                    createElement('p', {
                        style: {
                            fontSize: '12px',
                            color: '#666'
                        }
                    }, 'Use Mustache syntax {{key}} for dynamic data.'),
                    createElement('textarea', {
                        id: 'bf-html-template-area',
                        value: template,
                        onChange: (e) => setTemplate(e.target.value),
                        style: {
                            width: '100%',
                            minHeight: '400px',
                            fontFamily: 'monospace',
                            padding: '12px',
                            fontSize: '13px',
                            border: '1px solid #757575',
                            borderRadius: '4px',
                            whiteSpace: 'pre'
                        },
                        placeholder: `<div class="banner">\n  <h2>{{${fields[0]?.key || 'field_key'}}}</h2>\n</div>`
                    })
                ),

                // --- CSS Column ---
                createElement('div', {
                        style: {
                            width: '50%'
                        }
                    },
                    createElement('h3', null, 'CSS Styles'),
                    createElement('p', {
                        style: {
                            fontSize: '12px',
                            color: '#666'
                        }
                    }, 'Scoped automatically to the block wrapper.'),
                    createElement('textarea', {
                        value: css,
                        onChange: (e) => setCss(e.target.value),
                        style: {
                            width: '100%',
                            minHeight: '400px',
                            fontFamily: 'monospace',
                            padding: '12px',
                            fontSize: '13px',
                            border: '1px solid #757575',
                            borderRadius: '4px',
                            whiteSpace: 'pre'
                        },
                        placeholder: `.bf-block-example {\n  background: #f0f0f0;\n  padding: 20px;\n}`
                    })
                )
            ),

            createElement('hr', {
                style: {
                    margin: '20px 0'
                }
            }),

            message && createElement('div', {
                style: {
                    padding: '15px',
                    backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
                    color: message.includes('✅') ? '#155724' : '#721c24',
                    border: '1px solid',
                    borderColor: message.includes('✅') ? '#c3e6cb' : '#f5c6cb',
                    borderRadius: '4px',
                    textAlign: 'center',
                    fontWeight: 'bold'
                }
            }, message)
        );
    }

    // Fallback? Should not happen.
    return null;
};


// --- Render the application once the DOM is ready ---
jQuery(document).ready(function () {
    const rootElement = document.getElementById('component-editor-root');

    // Check if the localized data object exists (blockFactoryEditor)
    if (rootElement && typeof blockFactoryEditor !== 'undefined') {
        wp.element.render(
            createElement(ComponentEditorApp, {
                // CRITICAL: Access the nested properties
                initialConfig: blockFactoryEditor.config,
                blockSlug: blockFactoryEditor.blockSlug
            }),
            rootElement
        );
    }
});