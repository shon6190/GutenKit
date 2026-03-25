/**
 * FieldSettings — the right-hand settings panel for the selected field.
 */
import { createElement } from '@wordpress/element';
import { Button, TextControl, SelectControl } from '@wordpress/components';
import { FIELD_TYPES } from './fieldTypes.js';
import RepeaterSettings from './RepeaterSettings.js';
import OptionsEditor from './OptionsEditor.js';

const styles = {
    errorBox: {
        color: 'var(--gk-error)',
        fontSize: '12px',
        marginBottom: '10px',
        padding: '10px',
        backgroundColor: 'var(--gk-error-container)',
        border: '1px solid rgba(186,26,26,.3)',
        borderRadius: 'var(--gk-radius)',
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
        return createElement('div', { className: 'gk-field-settings' },
            createElement('p', { className: 'gk-field-settings__placeholder' },
                'Select a field on the left to configure it.'
            )
        );
    }

    const index = fields.indexOf(selectedField);

    const COMPLEX_FIELD_TYPES = ['image', 'file', 'gallery', 'repeater', 'button', 'link', 'spacing', 'dimension', 'typography', 'toggle', 'multiselect'];

    const handleTypeChange = (val) => {
        const objTypes   = COMPLEX_FIELD_TYPES.filter(t => ['image', 'file'].includes(t));
        const arrayTypes = COMPLEX_FIELD_TYPES.filter(t => ['gallery', 'repeater', 'multiselect'].includes(t));
        let newDefault = '';
        if (val === 'button')          newDefault = { text: '', url: '' };
        else if (val === 'link')       newDefault = { url: '', title: '', target: '_self' };
        else if (val === 'spacing')    newDefault = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
        else if (val === 'dimension')  newDefault = { width: '', height: '' };
        else if (val === 'typography') newDefault = { family: '', size: '', weight: '400', lineHeight: '1.5' };
        else if (val === 'toggle')     newDefault = false;
        else if (objTypes.includes(val))   newDefault = null;
        else if (arrayTypes.includes(val)) newDefault = [];
        const newFields = fields.map((f, i) => i === index ? { ...f, type: val, default: newDefault } : f);
        setFields(newFields);
        setSelectedField(newFields[index]);
    };

    return createElement('div', { className: 'gk-field-settings' },
        createElement('h3', { className: 'gk-field-settings__heading' },
            selectedField.label + ' — ' + selectedField.type
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
            !COMPLEX_FIELD_TYPES.includes(selectedField.type) &&
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

        // Options editor for select / radio / multiselect
        ['select', 'radio', 'multiselect'].includes(selectedField.type) &&
            createElement(OptionsEditor, {
                options: selectedField.options || [],
                onChange: (opts) => updateField(index, 'options', opts),
            }),

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
