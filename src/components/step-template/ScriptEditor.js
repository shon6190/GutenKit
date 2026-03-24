/**
 * ScriptEditor — configure and preview the block's frontend JS (view.js).
 *
 * Mirrors the generateViewJs() logic from generate-block-code-multi.js so the
 * user can see exactly what will be written on Save & Build.
 */
import { createElement, useState } from '@wordpress/element';

// ─── Preview generator (mirrors generate-block-code-multi.js) ───────────────

function generatePreview(blockSlug, scripts) {
    if (!scripts || !scripts.type) {
        return '// No script type selected — no view.js will be generated.';
    }

    const slug    = blockSlug || 'my-block';
    const rootSel = `.bf-block-${slug}`;
    const opts    = scripts.options || {};

    switch (scripts.type) {

        case 'slider': {
            const emblaOpts = JSON.stringify({
                loop:  !!opts.loop,
                align: opts.align || 'start',
            });
            return [
                `import EmblaCarousel from 'embla-carousel';`,
                ``,
                `document.addEventListener( 'DOMContentLoaded', () => {`,
                `\tdocument.querySelectorAll( '${rootSel}' ).forEach( ( sliderRoot ) => {`,
                `\t\tconst viewport = sliderRoot.querySelector( '[data-embla-viewport]' );`,
                `\t\tif ( ! viewport ) return;`,
                ``,
                `\t\tconst embla = EmblaCarousel( viewport, ${emblaOpts} );`,
                ``,
                `\t\tconst prevBtn = sliderRoot.querySelector( '[data-embla-prev]' );`,
                `\t\tconst nextBtn = sliderRoot.querySelector( '[data-embla-next]' );`,
                `\t\tprevBtn?.addEventListener( 'click', () => embla.scrollPrev() );`,
                `\t\tnextBtn?.addEventListener( 'click', () => embla.scrollNext() );`,
                ``,
                `\t\tconst dots = Array.from( sliderRoot.querySelectorAll( '[data-embla-dots] [data-embla-dot]' ) );`,
                `\t\tconst syncDots = () => {`,
                `\t\t\tconst active = embla.selectedScrollSnap();`,
                `\t\t\tdots.forEach( ( dot, i ) => dot.classList.toggle( 'is-active', i === active ) );`,
                `\t\t};`,
                `\t\tdots.forEach( ( dot, i ) => dot.addEventListener( 'click', () => embla.scrollTo( i ) ) );`,
                `\t\tembla.on( 'select', syncDots );`,
                `\t\tsyncDots();`,
                `\t} );`,
                `} );`,
            ].join('\n');
        }

        case 'accordion': {
            const single = !!opts.single;
            const closeOthers = single ? [
                ``,
                `\t\t\t\t\t// Close all other open items`,
                `\t\t\t\t\troot.querySelectorAll( '[aria-expanded="true"]' ).forEach( ( other ) => {`,
                `\t\t\t\t\t\tif ( other !== btn ) {`,
                `\t\t\t\t\t\t\tother.setAttribute( 'aria-expanded', 'false' );`,
                `\t\t\t\t\t\t\tconst otherPanel = other.nextElementSibling;`,
                `\t\t\t\t\t\t\tif ( otherPanel ) otherPanel.style.maxHeight = '0';`,
                `\t\t\t\t\t\t}`,
                `\t\t\t\t\t} );`,
            ].join('\n') : '';

            return [
                `document.addEventListener( 'DOMContentLoaded', () => {`,
                `\tdocument.querySelectorAll( '${rootSel}' ).forEach( ( root ) => {`,
                `\t\troot.querySelectorAll( '[class*="accordion-trigger"], [class*="accordion__header"]' ).forEach( ( btn ) => {`,
                `\t\t\tbtn.addEventListener( 'click', () => {`,
                `\t\t\t\tconst panel  = btn.nextElementSibling;`,
                `\t\t\t\tconst isOpen = btn.getAttribute( 'aria-expanded' ) === 'true';`,
                closeOthers,
                `\t\t\t\tbtn.setAttribute( 'aria-expanded', String( ! isOpen ) );`,
                `\t\t\t\tif ( panel ) panel.style.maxHeight = isOpen ? '0' : panel.scrollHeight + 'px';`,
                `\t\t\t} );`,
                `\t\t} );`,
                `\t} );`,
                `} );`,
            ].filter(l => l !== '').join('\n');
        }

        case 'ajax': {
            const action = scripts.action || 'my-plugin/v1/data';
            return [
                `document.addEventListener( 'DOMContentLoaded', () => {`,
                `\tdocument.querySelectorAll( '${rootSel} [data-ajax-trigger]' ).forEach( ( el ) => {`,
                `\t\tel.addEventListener( 'click', async () => {`,
                `\t\t\tconst endpoint = ( window.wpApiSettings?.root || '/wp-json/' ) + '${action}';`,
                `\t\t\tconst nonce    = window.wpApiSettings?.nonce || '';`,
                `\t\t\ttry {`,
                `\t\t\t\tconst res  = await fetch( endpoint, {`,
                `\t\t\t\t\tmethod: 'POST',`,
                `\t\t\t\t\theaders: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },`,
                `\t\t\t\t\tbody: JSON.stringify( { ...el.dataset } ),`,
                `\t\t\t\t} );`,
                `\t\t\t\tconst data = await res.json();`,
                `\t\t\t\tel.closest( '${rootSel}' )?.dispatchEvent(`,
                `\t\t\t\t\tnew CustomEvent( 'gk:ajax-response', { detail: data, bubbles: true } )`,
                `\t\t\t\t);`,
                `\t\t\t} catch ( err ) {`,
                `\t\t\t\tconsole.error( 'AJAX error in ${slug}:', err );`,
                `\t\t\t}`,
                `\t\t} );`,
                `\t} );`,
                `} );`,
            ].join('\n');
        }

        case 'custom': {
            const code = (scripts.code || '// Your custom JS goes here.\n// The block root is: document.querySelectorAll( \'' + rootSel + '\' )').trim();
            return [
                `document.addEventListener( 'DOMContentLoaded', () => {`,
                code.split('\n').map(l => '\t' + l).join('\n'),
                `} );`,
            ].join('\n');
        }

        default:
            return '// Unknown script type.';
    }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Label({ text }) {
    return createElement('label', { className: 'gk-script-label' }, text);
}

function OptionRow({ children }) {
    return createElement('div', { className: 'gk-script-option-row' }, ...children);
}

function SliderOptions({ opts, onChange }) {
    return createElement('div', { className: 'gk-script-options' },
        createElement(OptionRow, null,
            createElement(Label, { text: 'Loop slides' }),
            createElement('input', {
                type: 'checkbox',
                className: 'gk-script-checkbox',
                checked: !!opts.loop,
                onChange: (e) => onChange({ ...opts, loop: e.target.checked }),
            })
        ),
        createElement(OptionRow, null,
            createElement(Label, { text: 'Slide alignment' }),
            createElement('select', {
                className: 'gk-script-select',
                value: opts.align || 'start',
                onChange: (e) => onChange({ ...opts, align: e.target.value }),
            },
                createElement('option', { value: 'start' }, 'Start'),
                createElement('option', { value: 'center' }, 'Center'),
                createElement('option', { value: 'end' }, 'End')
            )
        ),
        createElement('p', { className: 'gk-script-tip' },
            createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' } }, 'info'),
            'Template must use ',
            createElement('code', null, 'data-embla-viewport'),
            ' on the track wrapper, ',
            createElement('code', null, 'data-embla-prev'),
            ' / ',
            createElement('code', null, 'data-embla-next'),
            ' on buttons, and ',
            createElement('code', null, 'data-embla-dot'),
            ' on each dot.'
        )
    );
}

function AccordionOptions({ opts, onChange }) {
    return createElement('div', { className: 'gk-script-options' },
        createElement(OptionRow, null,
            createElement(Label, { text: 'Close others when one opens' }),
            createElement('input', {
                type: 'checkbox',
                className: 'gk-script-checkbox',
                checked: !!opts.single,
                onChange: (e) => onChange({ ...opts, single: e.target.checked }),
            })
        ),
        createElement('p', { className: 'gk-script-tip' },
            createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' } }, 'info'),
            'Trigger buttons need a class containing ',
            createElement('code', null, 'accordion-trigger'),
            ' or ',
            createElement('code', null, 'accordion__header'),
            '. The panel must be the immediate next sibling.'
        )
    );
}

function AjaxOptions({ scripts, onScriptsChange }) {
    const opts = scripts.options || {};
    return createElement('div', { className: 'gk-script-options' },
        createElement(OptionRow, null,
            createElement(Label, { text: 'REST endpoint / WP action' }),
            createElement('input', {
                type: 'text',
                className: 'gk-script-input',
                value: scripts.action || '',
                placeholder: 'my-plugin/v1/load-more',
                onChange: (e) => onScriptsChange({ ...scripts, action: e.target.value }),
            })
        ),
        createElement('p', { className: 'gk-script-tip' },
            createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' } }, 'info'),
            'Add ',
            createElement('code', null, 'data-ajax-trigger'),
            ' to your button and ',
            createElement('code', null, 'data-ajax-container'),
            ' to the results container. Any ',
            createElement('code', null, 'data-*'),
            ' attrs on the trigger are sent as the request body. The response fires a ',
            createElement('code', null, 'gk:ajax-response'),
            ' custom event — listen to it to render results.'
        ),
        // Load-more boilerplate hint
        createElement('details', { className: 'gk-script-details' },
            createElement('summary', null, 'Load More template example'),
            createElement('pre', { className: 'gk-script-pre' },
`<div data-ajax-container>
  {{#each items}}
    <div class="item">{{title}}</div>
  {{/each}}
</div>
<button data-ajax-trigger data-page="1">
  Load More
</button>`
            )
        )
    );
}

function CustomOptions({ scripts, onScriptsChange, blockSlug }) {
    return createElement('div', { className: 'gk-script-options' },
        createElement('p', { className: 'gk-script-tip', style: { marginBottom: '8px' } },
            createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' } }, 'info'),
            'Code runs inside ',
            createElement('code', null, 'DOMContentLoaded'),
            '. Block root: ',
            createElement('code', null, `.bf-block-${blockSlug || 'my-block'}`)
        ),
        createElement('textarea', {
            className: 'gk-editor-textarea',
            style: { minHeight: '220px' },
            spellCheck: false,
            value: scripts.code || '',
            placeholder: `document.querySelectorAll( '.bf-block-${blockSlug || 'my-block'}' ).forEach( ( el ) => {\n\t// your code here\n} );`,
            onChange: (e) => onScriptsChange({ ...scripts, code: e.target.value }),
        })
    );
}

// ─── Main component ──────────────────────────────────────────────────────────

const SCRIPT_TYPES = [
    { value: '',          label: 'None — no frontend JS' },
    { value: 'slider',    label: 'Slider (Embla Carousel)' },
    { value: 'accordion', label: 'Accordion' },
    { value: 'ajax',      label: 'AJAX (Fetch)' },
    { value: 'custom',    label: 'Custom JavaScript' },
];

export default function ScriptEditor({ scripts, setScripts, blockSlug }) {
    const [showPreview, setShowPreview] = useState(false);

    const currentType = (scripts && scripts.type) || '';
    const opts = (scripts && scripts.options) || {};

    function handleTypeChange(newType) {
        if (!newType) {
            setScripts(null);
            return;
        }
        // Reset options when type changes
        const base = { type: newType, selector: `.gk-block-${blockSlug || 'my-block'}`, options: {} };
        if (newType === 'slider') base.options = { loop: false, align: 'start' };
        setScripts(base);
    }

    function handleOptsChange(newOpts) {
        setScripts({ ...scripts, options: newOpts });
    }

    function handleScriptsChange(newScripts) {
        setScripts(newScripts);
    }

    const previewCode = generatePreview(blockSlug, scripts);
    const isCustom = currentType === 'custom';

    return createElement('div', { className: 'gk-editor-card' },

        // ── Header
        createElement('div', { className: 'gk-editor-card__header' },
            createElement('div', { className: 'gk-editor-card__title' },
                createElement('span', { className: 'material-symbols-outlined', style: { color: 'var(--gk-warning, #d97706)' } }, 'integration_instructions'),
                'Script / JS'
            ),
            createElement('div', { className: 'gk-editor-card__actions' },
                currentType && createElement('span', { className: 'gk-editor-badge', style: { background: 'rgba(217,119,6,.1)', color: '#b45309' } }, currentType.toUpperCase())
            )
        ),

        // ── Settings section (light bg)
        createElement('div', { className: 'gk-script-settings' },

            // Type selector
            createElement('div', { className: 'gk-script-option-row', style: { marginBottom: '16px' } },
                createElement(Label, { text: 'Script type' }),
                createElement('select', {
                    className: 'gk-script-select',
                    value: currentType,
                    onChange: (e) => handleTypeChange(e.target.value),
                },
                    SCRIPT_TYPES.map(t =>
                        createElement('option', { key: t.value, value: t.value }, t.label)
                    )
                )
            ),

            // Type-specific options
            currentType === 'slider'    && createElement(SliderOptions,  { opts, onChange: handleOptsChange }),
            currentType === 'accordion' && createElement(AccordionOptions, { opts, onChange: handleOptsChange }),
            currentType === 'ajax'      && createElement(AjaxOptions,    { scripts, onScriptsChange: handleScriptsChange }),
            currentType === 'custom'    && createElement(CustomOptions,   { scripts, onScriptsChange: handleScriptsChange, blockSlug }),

            !currentType && createElement('p', { className: 'gk-script-tip', style: { margin: 0 } },
                'Select a script type above to add frontend JavaScript to this block. The generated ',
                createElement('code', null, 'view.js'),
                ' is bundled by Webpack on Save & Build.'
            )
        ),

        // ── Generated preview (not shown for custom — textarea is the code)
        !isCustom && currentType && createElement('div', { className: 'gk-editor-card__body' },
            createElement('div', {
                className: 'gk-editor-chip-row',
                style: { cursor: 'pointer', userSelect: 'none' },
                onClick: () => setShowPreview(!showPreview),
            },
                createElement('span', { className: 'gk-editor-chip-label', style: { width: 'auto', marginBottom: 0 } },
                    createElement('span', {
                        className: 'material-symbols-outlined',
                        style: { fontSize: '13px', verticalAlign: 'middle', marginRight: '4px' },
                    }, showPreview ? 'expand_less' : 'expand_more'),
                    showPreview ? 'Hide view.js preview' : 'Show generated view.js preview'
                )
            ),
            showPreview && createElement('textarea', {
                className: 'gk-editor-textarea',
                readOnly: true,
                value: previewCode,
                style: { minHeight: '200px', opacity: 0.85, cursor: 'default' },
                title: 'Read-only preview of view.js that will be generated on Save & Build',
            })
        )
    );
}
