/**
 * FieldList — the middle column showing the draggable list of defined fields.
 */
import { createElement } from '@wordpress/element';
import { createDragHandlers } from '../shared/DragDrop.js';

const FIELD_ICONS = {
    text:          'text_fields',
    number:        'pin',
    range:         'tune',
    url:           'link',
    email:         'email',
    textarea:      'notes',
    contentEditor: 'article',
    toggle:        'toggle_on',
    select:        'arrow_drop_down_circle',
    radio:         'radio_button_checked',
    multiselect:   'checklist',
    image:         'image',
    file:          'attach_file',
    gallery:       'collections',
    date:          'calendar_today',
    datetime:      'schedule',
    time:          'schedule',
    color:         'palette',
    gradient:      'gradient',
    icon:          'emoji_emotions',
    button:        'smart_button',
    link:          'add_link',
    spacing:       'padding',
    dimension:     'aspect_ratio',
    typography:    'title',
    repeater:      'repeat',
    relational:    'account_tree',
};

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

    return createElement('div', { className: 'gk-field-list' },
        createElement('h3', { className: 'gk-field-list__heading' },
            'Block Fields (' + fields.length + ')'
        ),

        fields.length === 0 && createElement('div', { className: 'gk-field-list__empty' },
            'No fields yet. Click a type on the left to begin.'
        ),

        fields.map((field, index) => {
            const isSelected = selectedField === field;
            const isDragging = draggedIndex === index;
            const hasError   = !!invalidFields[index];

            let className = 'gk-field-item';
            if (isSelected) className += ' is-selected';
            if (isDragging) className += ' is-dragging';
            if (hasError)   className += ' has-error';

            return createElement('div', {
                key: index,
                className,
                draggable: true,
                onDragStart: (e) => drag.onDragStart(e, index),
                onDragOver: drag.onDragOver,
                onDragEnter: (e) => drag.onDragEnter(e, index),
                onDrop: drag.onDrop,
                onClick: () => setSelectedField(field),
            },
                createElement('div', { className: 'gk-field-item__left' },
                    createElement('span', { className: 'gk-field-item__handle' }, '\u2807'),
                    createElement('div', { className: 'gk-field-item__icon' },
                        createElement('span', { className: 'material-symbols-outlined' },
                            FIELD_ICONS[field.type] || 'input'
                        )
                    ),
                    createElement('div', { style: { minWidth: 0 } },
                        createElement('div', { className: 'gk-field-item__label' }, field.label),
                        createElement('div', { className: 'gk-field-item__meta' },
                            field.key + ' \u00B7 ' + field.type
                        )
                    )
                ),
                createElement('span', { className: 'gk-field-item__arrow material-symbols-outlined' }, 'chevron_right')
            );
        })
    );
}
