/**
 * FieldPalette — the left-hand column of field-type buttons.
 */
import { createElement } from '@wordpress/element';
import { FIELD_TYPES } from './fieldTypes.js';

// Material Symbol icon map for each field type
const FIELD_ICONS = {
    text:          'text_fields',
    number:        'pin',
    range:         'tune',
    url:           'link',
    textarea:      'notes',
    contentEditor: 'article',
    image:         'image',
    file:          'attach_file',
    gallery:       'collections',
    date:          'calendar_today',
    datetime:      'schedule',
    time:          'schedule',
    color:         'palette',
    icon:          'emoji_emotions',
    repeater:      'repeat',
    relational:    'account_tree',
    button:        'smart_button',
};

const INSPECTOR_TYPES = ['text', 'number', 'range', 'url', 'color', 'date', 'datetime', 'time', 'icon', 'relational', 'button'];
const CONTENT_TYPES   = ['textarea', 'contentEditor', 'image', 'file', 'gallery', 'repeater'];

function renderGroup(types, addField) {
    return types.map(val => {
        const t = FIELD_TYPES.find(f => f.value === val);
        if (!t) return null;
        return createElement('button', {
            key: t.value,
            type: 'button',
            className: 'gk-palette-btn',
            onClick: () => addField(t.value),
        },
            createElement('span', { className: 'material-symbols-outlined' }, FIELD_ICONS[t.value] || 'input'),
            t.label
        );
    });
}

export default function FieldPalette({ addField }) {
    return createElement('div', { className: 'gk-field-palette' },
        createElement('p', { className: 'gk-palette-heading' }, 'Inspector Controls'),
        createElement('p', { className: 'gk-palette-hint' }, 'Sidebar fields'),
        ...renderGroup(INSPECTOR_TYPES, addField),

        createElement('hr', { className: 'gk-palette-divider' }),

        createElement('p', { className: 'gk-palette-heading' }, 'Content / Media'),
        createElement('p', { className: 'gk-palette-hint' }, 'Also in sidebar'),
        ...renderGroup(CONTENT_TYPES, addField)
    );
}
