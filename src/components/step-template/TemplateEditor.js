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
};

export default function TemplateEditor({ template, setTemplate, fields }) {
    const placeholder = '<div class="banner">\n  <h2>{{' + (fields[0] ? fields[0].key : 'field_key') + '}}</h2>\n</div>';

    return createElement('div', { style: { width: '50%' } },
        createElement('h3', null, 'HTML Template'),
        createElement('p', { style: styles.hint }, 'Use Mustache syntax {{key}} for dynamic data.'),
        createElement('textarea', {
            id: 'bf-html-template-area',
            value: template,
            onChange: (e) => setTemplate(e.target.value),
            style: styles.textarea,
            placeholder,
        })
    );
}
