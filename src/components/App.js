/**
 * App — top-level wizard step routing.
 *
 * Step 0: Define block fields (FieldPalette + FieldList + FieldSettings).
 * Step 1: Template & design  (AIGenerator + TemplateEditor + CSSEditor + LivePreview).
 */
import { createElement } from '@wordpress/element';
import { Button, PanelBody } from '@wordpress/components';
import useBlockConfig from '../hooks/useBlockConfig.js';

// Step 0 components
import FieldPalette from './step-fields/FieldPalette.js';
import FieldList from './step-fields/FieldList.js';
import FieldSettings from './step-fields/FieldSettings.js';

// Step 1 components
import TemplateEditor from './step-template/TemplateEditor.js';
import CSSEditor from './step-template/CSSEditor.js';
import LivePreview from './step-template/LivePreview.js';
import AIGenerator from './step-template/AIGenerator.js';
import ScriptEditor from './step-template/ScriptEditor.js';

function Icon({ name, style }) {
    return createElement('span', {
        className: 'material-symbols-outlined',
        style,
    }, name);
}

// ── Script HTML templates (copy-ready snippets shown in the cheat sheet) ─────

const SCRIPT_HTML_TEMPLATES = {
    slider: {
        label: 'Slider — required data-embla-* structure',
        icon: 'view_carousel',
        code:
`<div class="gk-block-wrapper">

  <!-- Viewport: needs overflow:hidden in CSS -->
  <div class="my-viewport" data-embla-viewport>

    <!-- Track: needs display:flex in CSS -->
    <div class="my-track">
      {{#each slides}}
        <div class="my-slide">
          <!-- slide content here -->
        </div>
      {{/each}}
    </div>

  </div>

  <!-- Optional prev/next buttons -->
  <button data-embla-prev>Prev</button>
  <button data-embla-next>Next</button>

  <!-- Optional dot navigation -->
  <div data-embla-dots>
    <button data-embla-dot></button>
  </div>

</div>`,
    },

    accordion: {
        label: 'Accordion — trigger + panel structure',
        icon: 'expand',
        code:
`{{#each items}}
<div class="accordion-item">

  <!-- Button class must contain "accordion-trigger" -->
  <button class="accordion-trigger" aria-expanded="false">
    {{title}}
  </button>

  <!-- Panel must be the immediate next sibling -->
  <div class="accordion-panel" style="max-height:0;overflow:hidden;">
    {{content}}
  </div>

</div>
{{/each}}`,
    },

    ajax: {
        label: 'AJAX — trigger + container structure',
        icon: 'cloud_sync',
        code:
`<!-- Results are rendered into this container -->
<div data-ajax-container>
  {{#each items}}
    <div class="result-item">{{title}}</div>
  {{/each}}
</div>

<!-- Trigger button — data-* attrs are sent as the request body -->
<button data-ajax-trigger data-page="1">
  Load More
</button>`,
    },
};

function ScriptCheatSection({ scripts }) {
    if (!scripts || !scripts.type || !SCRIPT_HTML_TEMPLATES[scripts.type]) return null;
    const tpl = SCRIPT_HTML_TEMPLATES[scripts.type];
    return createElement('div', { className: 'gk-cheatsheet__script-section' },
        createElement('div', { className: 'gk-cheatsheet__script-heading' },
            createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '15px' } }, tpl.icon),
            tpl.label
        ),
        createElement('pre', {
            className: 'gk-cheatsheet__script-pre',
            title: 'Click to select all',
            onClick: (e) => {
                const range = document.createRange();
                range.selectNodeContents(e.currentTarget);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            },
        }, tpl.code)
    );
}

function saveMessageClass(msg) {
    const isSuccess = msg.includes('Saved') || msg.includes('Complete') || msg.includes('ready');
    return 'gk-save-message ' + (isSuccess ? 'is-success' : 'is-error');
}

export default function App({ initialConfig, blockSlug }) {
    const config = useBlockConfig({ initialConfig, blockSlug });

    // ==========================================
    // STEP 0: Structure
    // ==========================================
    if (config.step === 0) {
        return createElement('div', null,

            // Step bar
            createElement('div', { className: 'gk-step-bar' },
                createElement('h2', { className: 'gk-step-bar__title' }, 'Step 1 — Define Block Structure'),
                createElement('div', { className: 'gk-step-bar__actions' },
                    config.message && createElement('span', {
                        style: {
                            fontSize: '13px',
                            color: config.message.startsWith('Warning') ? 'var(--gk-error)' : 'var(--gk-on-surface-variant)',
                            maxWidth: '300px',
                        },
                    }, config.message),
                    createElement(Button, {
                        isPrimary: true,
                        isBusy: config.isSaving,
                        onClick: () => config.handleSave(false, 1),
                    }, createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                        'Next: Edit Template',
                        Icon({ name: 'arrow_forward', style: { fontSize: '16px' } })
                    ))
                )
            ),

            // Three-column layout
            createElement('div', { className: 'gk-fields-layout' },
                createElement(FieldPalette, { addField: config.addField }),
                createElement(FieldList, {
                    fields: config.fields,
                    setFields: config.setFields,
                    selectedField: config.selectedField,
                    setSelectedField: config.setSelectedField,
                    draggedIndex: config.draggedIndex,
                    setDraggedIndex: config.setDraggedIndex,
                    invalidFields: config.invalidFields,
                }),
                createElement(FieldSettings, {
                    fields: config.fields,
                    setFields: config.setFields,
                    selectedField: config.selectedField,
                    setSelectedField: config.setSelectedField,
                    updateField: config.updateField,
                    removeField: config.removeField,
                    invalidFields: config.invalidFields,
                    draggedSubIndex: config.draggedSubIndex,
                    setDraggedSubIndex: config.setDraggedSubIndex,
                })
            )
        );
    }

    // ==========================================
    // STEP 1: Template & Design
    // ==========================================
    if (config.step === 1) {
        const isAiMessage = config.message && (config.message.includes('AI') || config.message.includes('generating') || config.message.includes('prompt'));

        return createElement('div', null,

            // Step bar
            createElement('div', { className: 'gk-step-bar' },
                createElement(Button, {
                    isSecondary: true,
                    onClick: () => config.setStep(0),
                }, createElement('span', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                    Icon({ name: 'arrow_back', style: { fontSize: '16px' } }),
                    'Back to Structure'
                )),
                createElement('h2', { className: 'gk-step-bar__title' }, 'Step 2 — Template & Design'),
                createElement(Button, {
                    isPrimary: true,
                    isBusy: config.isSaving,
                    onClick: () => config.handleSave(true),
                }, config.isSaving ? 'Building...' : createElement('span', {
                    style: { display: 'flex', alignItems: 'center', gap: '6px' },
                },
                    Icon({ name: 'rocket_launch', style: { fontSize: '16px' } }),
                    'Save & Build Block'
                ))
            ),

            // AI Generator
            createElement(AIGenerator, {
                aiPrompt: config.aiPrompt,
                setAiPrompt: config.setAiPrompt,
                isGenerating: config.isGenerating,
                handleGenerateAI: config.handleGenerateAI,
                message: config.message,
            }),

            // Cheat sheet + editors (12-col split: 8 editors / 4 cheat sheet)
            createElement('div', { className: 'gk-template-layout' },

                // Left: HTML + CSS + Script editors stacked
                createElement('div', { className: 'gk-editors-col' },
                    createElement(TemplateEditor, {
                        template: config.template,
                        setTemplate: config.setTemplate,
                        fields: config.fields,
                        insertTagAtCursor: config.insertTagAtCursor,
                    }),
                    createElement(CSSEditor, {
                        css: config.css,
                        setCss: config.setCss,
                    }),
                    createElement(ScriptEditor, {
                        scripts: config.scripts,
                        setScripts: config.setScripts,
                        blockSlug,
                    })
                ),

                // Right: sticky cheat sheet (fields + script template)
                (config.cheatSheet || (config.scripts && config.scripts.type && SCRIPT_HTML_TEMPLATES[config.scripts.type])) &&
                createElement('div', { className: 'gk-cheatsheet' },
                    createElement('h3', { className: 'gk-cheatsheet__heading' },
                        createElement('span', { className: 'material-symbols-outlined' }, 'info'),
                        'Cheat Sheet'
                    ),
                    config.cheatSheet && createElement('div', {
                        className: 'gk-cheatsheet__content',
                        dangerouslySetInnerHTML: { __html: config.cheatSheet },
                    }),
                    createElement(ScriptCheatSection, { scripts: config.scripts })
                )
            ),

            // Live preview
            createElement(LivePreview, {
                template: config.template,
                css: config.css,
                fields: config.fields,
                scripts: config.scripts,
            }),

            // General save message (non-AI)
            config.message && !isAiMessage && createElement('div', {
                className: saveMessageClass(config.message),
            }, config.message)
        );
    }

    return null;
}
