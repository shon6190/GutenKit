/**
 * FieldSettings — the right-hand settings panel for the selected field.
 */
import { createElement } from '@wordpress/element';
import { Button, TextControl, SelectControl } from '@wordpress/components';
import { FIELD_TYPES } from './fieldTypes.js';
import RepeaterSettings from './RepeaterSettings.js';

const styles = {
    placeholder: {
        padding: '20px',
        color: '#666',
        fontStyle: 'italic',
        border: '1px dashed #ccc',
        marginTop: '10px',
        borderRadius: '8px',
    },
    heading: {
        margin: '0 0 20px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: 'var(--gk-text-main)',
        borderBottom: '1px solid var(--gk-border-light)',
        paddingBottom: '15px',
    },
    errorBox: {
        color: '#d94f4f',
        fontSize: '12px',
        marginBottom: '10px',
        padding: '10px',
        backgroundColor: '#fbeaea',
        border: '1px solid #f2c7c7',
        borderRadius: '4px',
    },
};

export default function FieldSettings({
    fields,
    setFields,
    selectedField,
    setSelectedField,
    updateField,
    removeField,
    invalidFields,
    draggedSubIndex,
    setDraggedSubIndex,
}) {
    if (!selectedField) {
        return createElement('p', { style: styles.placeholder },
            'Select a field on the left to edit its settings.'
        );
    }

    const index = fields.indexOf(selectedField);

    const handleTypeChange = (val) => {
        const objTypes   = ['image', 'file'];
        const arrayTypes = ['gallery', 'repeater'];
        let newDefault = '';
        if (val === 'button')              newDefault = { text: '', url: '' };
        else if (objTypes.includes(val))   newDefault = null;
        else if (arrayTypes.includes(val)) newDefault = [];
        const newFields = fields.map((f, i) => i === index ? { ...f, type: val, default: newDefault } : f);
        setFields(newFields);
        setSelectedField(newFields[index]);
    };

    return createElement('div', { className: 'gutenkit-field-settings-wrapper' },
        createElement('h3', { style: styles.heading },
            'Editing: ' + selectedField.label + ' (' + selectedField.type + ')'
        ),

        createElement('div', { style: { marginBottom: '20px' } },
            createElement(TextControl, {
                label: 'Field Label',
                value: selectedField.label,
                onChange: (val) => updateField(index, 'label', val),
            }),
            createElement(TextControl, {
                label: 'Attribute Key (Variable Name)',
                value: selectedField.key,
                help: 'Must be unique, lowercase, and contain only letters, numbers, and underscores.',
                onChange: (val) => updateField(index, 'key', val),
            }),
            createElement(SelectControl, {
                label: 'Field Type',
                value: selectedField.type,
                options: FIELD_TYPES.map(t => ({ label: t.label, value: t.value })),
                onChange: handleTypeChange,
            }),

            // Default value — hide for object/array types
            !['image', 'file', 'gallery', 'repeater', 'button'].includes(selectedField.type) &&
                createElement(TextControl, {
                    label: 'Default Value (Optional)',
                    value: selectedField.default || '',
                    onChange: (val) => updateField(index, 'default', val),
                }),

            // Button defaults
            selectedField.type === 'button' && createElement('div', { className: 'bf-button-defaults' },
                createElement('p', { className: 'bf-button-defaults__label' }, 'Default Button Values'),
                createElement(TextControl, {
                    label: 'Default Text',
                    value: (selectedField.default && selectedField.default.text) || '',
                    onChange: (val) => updateField(index, 'default', { ...(selectedField.default || {}), text: val }),
                }),
                createElement(TextControl, {
                    label: 'Default URL',
                    value: (selectedField.default && selectedField.default.url) || '',
                    onChange: (val) => updateField(index, 'default', { ...(selectedField.default || {}), url: val }),
                })
            ),

            // Validation error
            invalidFields[index] && createElement('div', { style: styles.errorBox }, invalidFields[index]),

            createElement(Button, {
                isDestructive: true,
                onClick: () => removeField(index),
                style: { marginTop: '10px' },
            }, 'Delete Field')
        ),

        // Repeater sub-fields
        selectedField.type === 'repeater' && createElement(RepeaterSettings, {
            field: selectedField,
            fieldIndex: index,
            updateField,
            invalidFields,
            draggedSubIndex,
            setDraggedSubIndex,
        })
    );
}
