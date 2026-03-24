/**
 * TemplateEditor — HTML textarea with Mustache tag insertion.
 */
import { createElement } from '@wordpress/element';

function getSnippet(field) {
    if (field.type === 'image' || field.type === 'file') {
        return '<img src="{{' + field.key + '}}" alt="{{' + field.key + '_alt}}" />';
    }
    if (field.type === 'gallery') {
        return '{{#each ' + field.key + '}}\n  <img src="{{url}}" alt="{{alt}}" />\n{{/each}}';
    }
    if (field.type === 'repeater') {
        const subFields = field.subFields || [];
        const inner = subFields.map(sf => {
            if (sf.type === 'image' || sf.type === 'file') {
                return '  <img src="{{' + sf.key + '}}" alt="{{' + sf.key + '_alt}}" />';
            }
            if (sf.type === 'gallery') {
                return '  {{#each ' + sf.key + '}}\n    <img src="{{url}}" alt="{{alt}}" />\n  {{/each}}';
            }
            return '  {{' + sf.key + '}}';
        });
        const body = inner.length ? '\n' + inner.join('\n') + '\n' : '\n  \n';
        return '{{#each ' + field.key + '}}' + body + '{{/each}}';
    }
    return '{{' + field.key + '}}';
}

function chipLabel(field) {
    if (field.type === 'image' || field.type === 'file')       return field.key + ' [img]';
    if (field.type === 'repeater' || field.type === 'gallery') return field.key + ' [loop]';
    return field.key;
}

export default function TemplateEditor({ template, setTemplate, fields, insertTagAtCursor }) {
    const placeholder = '<div class="banner">\n  <h2>{{' + (fields[0] ? fields[0].key : 'field_key') + '}}</h2>\n</div>';

    return createElement('div', { className: 'gk-editor-card' },

        // Header
        createElement('div', { className: 'gk-editor-card__header' },
            createElement('div', { className: 'gk-editor-card__title' },
                createElement('span', { className: 'material-symbols-outlined' }, 'html'),
                'HTML Template'
            ),
            createElement('div', { className: 'gk-editor-card__actions' })
        ),

        // Chip row + textarea (dark body)
        createElement('div', { className: 'gk-editor-card__body' },

            fields.length > 0 && createElement('div', { className: 'gk-editor-chip-row' },
                createElement('span', { className: 'gk-editor-chip-label' }, 'Click to insert:'),
                fields.map((field, i) =>
                    createElement('button', {
                        key: i,
                        type: 'button',
                        title: getSnippet(field),
                        className: 'gk-editor-chip',
                        onClick: () => insertTagAtCursor && insertTagAtCursor(getSnippet(field)),
                    }, chipLabel(field))
                )
            ),

            createElement('textarea', {
                id: 'bf-html-template-area',
                value: template,
                onChange: (e) => setTemplate(e.target.value),
                className: 'gk-editor-textarea',
                placeholder,
                spellCheck: false,
            })
        )
    );
}
