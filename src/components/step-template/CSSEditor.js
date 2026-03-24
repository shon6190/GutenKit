/**
 * CSSEditor — CSS textarea for block styles.
 */
import { createElement } from '@wordpress/element';

export default function CSSEditor({ css, setCss }) {
    return createElement('div', { className: 'gk-editor-card' },

        // Header
        createElement('div', { className: 'gk-editor-card__header' },
            createElement('div', { className: 'gk-editor-card__title css-title' },
                createElement('span', { className: 'material-symbols-outlined' }, 'css'),
                'CSS Styles'
            ),
            createElement('div', { className: 'gk-editor-card__actions' },
                createElement('span', { className: 'gk-editor-badge' }, 'SCSS ENABLED')
            )
        ),

        // Dark textarea body
        createElement('div', { className: 'gk-editor-card__body' },
            createElement('textarea', {
                value: css,
                onChange: (e) => setCss(e.target.value),
                className: 'gk-editor-textarea',
                placeholder: '.bf-block-example {\n  background: #f0f0f0;\n  padding: 20px;\n}',
                spellCheck: false,
            })
        )
    );
}
