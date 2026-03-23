/**
 * CSSEditor — CSS textarea for block styles.
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

export default function CSSEditor({ css, setCss }) {
    return createElement('div', { style: { width: '50%' } },
        createElement('h3', null, 'CSS Styles'),
        createElement('p', { style: styles.hint }, 'Scoped automatically to the block wrapper.'),
        createElement('textarea', {
            value: css,
            onChange: (e) => setCss(e.target.value),
            style: styles.textarea,
            placeholder: '.bf-block-example {\n  background: #f0f0f0;\n  padding: 20px;\n}',
        })
    );
}
