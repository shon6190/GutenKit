/**
 * TemplateEditor — HTML textarea with Mustache tag insertion.
 */
import { createElement } from '@wordpress/element';

const styles = {
    textarea: {
        width: '100%',
        minHeight: '400px',
        fontFamily: 'monospace',
        padding: '12px',
        fontSize: '13px',
        border: '1px solid #757575',
        borderRadius: '4px',
        whiteSpace: 'pre',
    },
    hint: { fontSize: '12px', color: '#666' },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' },
    chipLabel: { fontSize: '11px', color: '#666', margin: '0 0 4px 0' },
    chip: {
        fontSize: '11px',
        cursor: 'pointer',
        padding: '2px 8px',
        borderRadius: '3px',
        background: '#e0e7ff',
        border: '1px solid #a5b4fc',
        color: '#3730a3',
        fontFamily: 'monospace',
        lineHeight: '1.5',
    },
};

function getSnippet(field) {
    if (field.type === 'image' || field.type === 'file') {
        return '<img src="{{' + field.key + '}}" alt="{{' + field.key + '_alt}}" />';
    }
    if (field.type === 'repeater' || field.type === 'gallery') {
        return '{{#each ' + field.key + '}}\n  \n{{/each}}';
    }
    return '{{' + field.key + '}}';
}

export default function TemplateEditor({ template, setTemplate, fields, insertTagAtCursor }) {
    const placeholder = '<div class="banner">\n  <h2>{{' + (fields[0] ? fields[0].key : 'field_key') + '}}</h2>\n</div>';

    return createElement('div', { style: { width: '50%' } },
        createElement('h3', null, 'HTML Template'),
        createElement('p', { style: styles.hint }, 'Use Mustache syntax {{key}} for dynamic data.'),

        fields.length > 0 && createElement('div', null,
            createElement('p', { style: styles.chipLabel }, 'Click to insert:'),
            createElement('div', { style: styles.chipRow },
                fields.map((field, i) =>
                    createElement('button', {
                        key: i,
                        type: 'button',
                        title: getSnippet(field),
                        style: styles.chip,
                        onClick: () => insertTagAtCursor && insertTagAtCursor(getSnippet(field)),
                    }, field.key + (field.type === 'image' || field.type === 'file' ? ' [img]' : field.type === 'repeater' || field.type === 'gallery' ? ' [loop]' : ''))
                )
            )
        ),

        createElement('textarea', {
            id: 'bf-html-template-area',
            value: template,
            onChange: (e) => setTemplate(e.target.value),
            style: styles.textarea,
            placeholder,
        })
    );
}
