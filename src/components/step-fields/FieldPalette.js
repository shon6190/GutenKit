/**
 * FieldPalette — the left-hand column of field-type buttons.
 */
import { createElement } from '@wordpress/element';
import { Button } from '@wordpress/components';
import { FIELD_TYPES } from './fieldTypes.js';

const styles = {
    wrapper: {
        width: '20%',
        borderRight: '1px solid #ddd',
        paddingRight: '20px',
    },
    heading: {
        marginTop: 0,
        fontSize: '13px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#666',
    },
    hint: {
        fontSize: '11px',
        color: '#999',
        margin: '0 0 8px',
    },
    button: {
        display: 'block',
        width: '100%',
        marginBottom: '6px',
        textAlign: 'left',
    },
    divider: {
        margin: '12px 0',
        borderColor: '#eee',
    },
};

const INSPECTOR_TYPES = ['text', 'number', 'range', 'url', 'color', 'date', 'datetime', 'time', 'icon', 'relational', 'button'];
const CONTENT_TYPES   = ['textarea', 'contentEditor', 'image', 'file', 'gallery', 'repeater'];

function renderGroup(types, addField) {
    return types.map(val => {
        const t = FIELD_TYPES.find(f => f.value === val);
        if (!t) return null;
        return createElement(Button, {
            key: t.value,
            isSecondary: true,
            style: styles.button,
            onClick: () => addField(t.value),
        }, t.label);
    });
}

export default function FieldPalette({ addField }) {
    return createElement('div', { style: styles.wrapper },
        createElement('h3', { style: styles.heading }, 'Inspector Controls'),
        createElement('p', { style: styles.hint }, 'Added to the Sidebar'),
        ...renderGroup(INSPECTOR_TYPES, addField),
        createElement('hr', { style: styles.divider }),
        createElement('h3', { style: styles.heading }, 'Content / Media'),
        createElement('p', { style: styles.hint }, 'Also in Sidebar'),
        ...renderGroup(CONTENT_TYPES, addField)
    );
}
