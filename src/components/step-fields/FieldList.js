/**
 * FieldList — the middle column showing the draggable list of defined fields.
 */
import { createElement } from '@wordpress/element';
import { createDragHandlers } from '../shared/DragDrop.js';

const styles = {
    wrapper: { width: '40%' },
    empty: {
        fontStyle: 'italic',
        color: '#999',
        padding: '20px',
        textAlign: 'center',
        border: '2px dashed #e0e0e0',
        borderRadius: '6px',
        background: '#fafafa',
    },
    dragHandle: { cursor: 'grab', color: '#b0bec5', fontSize: '16px', flexShrink: 0 },
    label: { fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    meta: { fontSize: '11px', color: '#9e9e9e', marginTop: '1px' },
};

function fieldItemStyle(isSelected, isDragging, hasError) {
    return {
        padding: '8px 12px',
        marginBottom: '4px',
        border: '1px solid ' + (hasError ? '#f2c7c7' : (isSelected ? '#007cba' : '#e0e0e0')),
        borderLeft: '4px solid ' + (hasError ? '#d94f4f' : (isSelected ? '#007cba' : '#c8c8c8')),
        borderRadius: '3px',
        backgroundColor: isDragging ? '#f0f0f0' : (isSelected ? '#f0f7ff' : '#fff'),
        opacity: isDragging ? 0.45 : 1,
        cursor: 'grab',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'border-color 0.15s, background-color 0.15s',
        boxShadow: isSelected ? '0 1px 4px rgba(0,124,186,0.12)' : 'none',
    };
}

export default function FieldList({
    fields,
    setFields,
    selectedField,
    setSelectedField,
    draggedIndex,
    setDraggedIndex,
    invalidFields,
}) {
    const drag = createDragHandlers({
        getDraggedIndex: () => draggedIndex,
        setDraggedIndex,
        getItems: () => fields,
        setItems: setFields,
    });

    return createElement('div', { style: styles.wrapper },
        createElement('h3', { style: { marginTop: 0 } }, 'Block Fields (' + fields.length + ')'),

        fields.length === 0 && createElement('div', { style: styles.empty },
            'No fields yet. Click a field type on the left to begin.'
        ),

        fields.map((field, index) => {
            const isSelected = selectedField === field;
            const isDragging = draggedIndex === index;
            const hasError   = !!invalidFields[index];

            return createElement('div', {
                key: index,
                draggable: true,
                onDragStart: (e) => drag.onDragStart(e, index),
                onDragOver: drag.onDragOver,
                onDragEnter: (e) => drag.onDragEnter(e, index),
                onDrop: drag.onDrop,
                style: fieldItemStyle(isSelected, isDragging, hasError),
                onClick: () => setSelectedField(field),
            },
                createElement('div', {
                    style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
                },
                    createElement('span', { style: styles.dragHandle }, '\u2807'),
                    createElement('div', { style: { minWidth: 0 } },
                        createElement('div', { style: styles.label }, field.label),
                        createElement('div', { style: styles.meta }, field.key + ' \u00B7 ' + field.type)
                    )
                ),
                createElement('span', {
                    style: { color: isSelected ? '#007cba' : '#c0c0c0', fontSize: '18px', flexShrink: 0, marginLeft: '8px' },
                }, '\u203A')
            );
        })
    );
}
