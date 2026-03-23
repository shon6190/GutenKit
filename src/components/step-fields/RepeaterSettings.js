/**
 * RepeaterSettings — sub-field editor for repeater fields.
 */
import { createElement } from '@wordpress/element';
import { Button, TextControl, SelectControl, PanelBody } from '@wordpress/components';
import { createDragHandlers } from '../shared/DragDrop.js';
import { FIELD_TYPES } from './fieldTypes.js';
import { slugifyKey, slugifyLabel } from '../../hooks/useBlockConfig.js';

const styles = {
    palette: { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '15px' },
    subFieldWrapper: (isDragging) => ({
        marginTop: '6px',
        opacity: isDragging ? 0.4 : 1,
        transition: 'opacity 0.15s, box-shadow 0.15s',
        borderLeft: '3px solid #007cba',
        borderRadius: '0 4px 4px 0',
        background: isDragging ? '#f0f6ff' : '#fafafa',
        boxShadow: isDragging ? '0 2px 8px rgba(0,124,186,0.15)' : 'none',
    }),
    dragHandle: { cursor: 'grab', marginRight: '6px', color: '#b0bec5', fontSize: '14px' },
    typeBadge: { marginLeft: '6px', color: '#9e9e9e', fontWeight: 'normal', fontSize: '11px' },
    errorBox: {
        color: '#d94f4f',
        fontSize: '12px',
        marginBottom: '10px',
        padding: '5px',
        backgroundColor: '#fbeaea',
        border: '1px solid #f2c7c7',
        borderRadius: '4px',
    },
};

export default function RepeaterSettings({
    field,
    fieldIndex,
    updateField,
    invalidFields,
    draggedSubIndex,
    setDraggedSubIndex,
}) {
    const subFields = field.subFields || [];

    // Sub-field CRUD
    const addSubField = (type) => {
        const newSubField = {
            type,
            key: slugifyKey('sub_field_' + subFields.length + '_' + type),
            label: 'New ' + type + ' Sub-Field',
            default: '',
        };
        updateField(fieldIndex, 'subFields', [...subFields, newSubField]);
    };

    const updateSubField = (subIndex, property, value) => {
        const newSubFields = subFields.map((sf, i) => {
            if (i === subIndex) {
                if (property === 'key')   value = slugifyKey(value);
                if (property === 'label') value = slugifyLabel(value);
                const updated = { ...sf, [property]: value };
                if (property === 'label') updated.key = slugifyKey(value);
                return updated;
            }
            return sf;
        });
        updateField(fieldIndex, 'subFields', newSubFields);
    };

    const removeSubField = (subIndex) => {
        updateField(fieldIndex, 'subFields', subFields.filter((_, i) => i !== subIndex));
    };

    // Drag handlers for sub-fields
    const drag = createDragHandlers({
        getDraggedIndex: () => draggedSubIndex,
        setDraggedIndex: setDraggedSubIndex,
        getItems: () => subFields,
        setItems: (newSubs) => updateField(fieldIndex, 'subFields', newSubs),
        stopPropagation: true,
    });

    const renderSubFieldSettings = (subField, subIndex) => {
        const isDragging = draggedSubIndex === subIndex;

        return createElement('div', {
            key: subIndex,
            draggable: true,
            onDragStart: (e) => drag.onDragStart(e, subIndex),
            onDragOver: drag.onDragOver,
            onDragEnter: (e) => drag.onDragEnter(e, subIndex),
            onDrop: drag.onDrop,
            style: styles.subFieldWrapper(isDragging),
        },
            createElement(PanelBody, {
                title: createElement('span', null,
                    createElement('span', { style: styles.dragHandle }, '\u2807'),
                    subField.label,
                    createElement('span', { style: styles.typeBadge }, '(' + subField.type + ')')
                ),
                initialOpen: false,
                className: 'repeater-sub-field-settings',
            },
                createElement(TextControl, {
                    label: 'Sub-Field Label',
                    value: subField.label,
                    onChange: (val) => updateSubField(subIndex, 'label', val),
                }),
                createElement(TextControl, {
                    label: 'Attribute Key (Variable Name)',
                    value: subField.key,
                    help: 'Must be unique, lowercase, and contain only letters, numbers, and underscores.',
                    onChange: (val) => updateSubField(subIndex, 'key', val),
                }),
                createElement(SelectControl, {
                    label: 'Sub-Field Type',
                    value: subField.type,
                    options: FIELD_TYPES.filter(t => t.value !== 'repeater').map(t => ({ label: t.label, value: t.value })),
                    onChange: (val) => updateSubField(subIndex, 'type', val),
                }),
                invalidFields[fieldIndex + '_' + subIndex] && createElement('div', { style: styles.errorBox },
                    invalidFields[fieldIndex + '_' + subIndex]
                ),
                createElement(Button, {
                    isDestructive: true,
                    onClick: () => removeSubField(subIndex),
                    style: { marginTop: '10px' },
                }, 'Delete Sub-Field')
            )
        );
    };

    const allowedTypes = FIELD_TYPES.filter(t => t.value !== 'repeater' && t.value !== 'relational');

    return createElement(PanelBody, { title: 'Repeater Sub-Fields', initialOpen: true },
        createElement('h4', null, 'Add New Sub-Field'),
        createElement('div', { style: styles.palette },
            allowedTypes.map(type =>
                createElement(Button, {
                    key: type.value,
                    isSecondary: true,
                    onClick: () => addSubField(type.value),
                }, type.label)
            )
        ),
        createElement('h4', null, 'Current Sub-Fields (' + subFields.length + ')'),
        subFields.length > 0
            ? subFields.map((sf, si) => renderSubFieldSettings(sf, si))
            : createElement('p', null, 'No sub-fields defined. Add one above.')
    );
}
