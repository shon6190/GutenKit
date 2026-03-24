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

const styles = {
    root: { marginTop: '20px' },
    stepBar: {
        marginBottom: '20px',
        padding: '10px',
        background: '#e5e5e5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    stepTitle: { margin: 0 },
    columns: { display: 'flex', gap: '20px' },
    settingsCol: { width: '40%' },
    editorRow: { display: 'flex', gap: '20px' },
    cheatPanel: { marginBottom: '20px', background: '#f0f6fc', border: '1px solid #cce5ff' },
    cheatContent: { fontSize: '13px', lineHeight: '1.6', maxHeight: '250px', overflowY: 'auto', padding: '10px' },
    divider: { margin: '30px 0 20px' },
};

function messageStyle(msg) {
    const isSuccess = msg.includes('Saved') || msg.includes('Complete') || msg.includes('ready');
    return {
        padding: '15px',
        backgroundColor: isSuccess ? '#d4edda' : '#f8d7da',
        color: isSuccess ? '#155724' : '#721c24',
        border: '1px solid',
        borderColor: isSuccess ? '#c3e6cb' : '#f5c6cb',
        borderRadius: '4px',
        textAlign: 'center',
        fontWeight: 'bold',
    };
}

export default function App({ initialConfig, blockSlug }) {
    const config = useBlockConfig({ initialConfig, blockSlug });

    // ==========================================
    // STEP 0: Structure
    // ==========================================
    if (config.step === 0) {
        return createElement('div', { style: styles.root },
            // Step bar
            createElement('div', { style: styles.stepBar },
                createElement('h2', { style: styles.stepTitle }, 'Step 1: Define Block Structure'),
                createElement('div', null,
                    createElement(Button, {
                        isPrimary: true,
                        isBusy: config.isSaving,
                        onClick: () => config.handleSave(false, 1),
                    }, 'Next: Edit Template >')
                )
            ),

            // Three-column layout
            createElement('div', { style: styles.columns },
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
                createElement('div', { style: styles.settingsCol },
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
            )
        );
    }

    // ==========================================
    // STEP 1: Template & Design
    // ==========================================
    if (config.step === 1) {
        // Determine if message is AI-related (shown inside AIGenerator)
        const isAiMessage = config.message && (config.message.includes('AI') || config.message.includes('generating') || config.message.includes('prompt'));

        return createElement('div', { style: styles.root },
            // Step bar
            createElement('div', { style: styles.stepBar },
                createElement(Button, {
                    isSecondary: true,
                    onClick: () => config.setStep(0),
                }, '< Back to Structure'),
                createElement('h2', { style: styles.stepTitle }, 'Step 2: Template & Design'),
                createElement(Button, {
                    isPrimary: true,
                    isBusy: config.isSaving,
                    onClick: () => config.handleSave(true),
                }, config.isSaving ? 'Building...' : 'Save & Build Block')
            ),

            // Cheat sheet
            config.cheatSheet && createElement(PanelBody, {
                title: 'Template Snippets (Use these keys in your HTML)',
                initialOpen: true,
                style: styles.cheatPanel,
            },
                createElement('div', {
                    dangerouslySetInnerHTML: { __html: config.cheatSheet },
                    style: styles.cheatContent,
                })
            ),

            // AI Generator
            createElement(AIGenerator, {
                aiPrompt: config.aiPrompt,
                setAiPrompt: config.setAiPrompt,
                isGenerating: config.isGenerating,
                handleGenerateAI: config.handleGenerateAI,
                message: config.message,
            }),

            // Template + CSS editors side by side
            createElement('div', { style: styles.editorRow },
                createElement(TemplateEditor, {
                    template: config.template,
                    setTemplate: config.setTemplate,
                    fields: config.fields,
                    insertTagAtCursor: config.insertTagAtCursor,
                }),
                createElement(CSSEditor, {
                    css: config.css,
                    setCss: config.setCss,
                })
            ),

            // Live preview
            createElement(LivePreview, {
                template: config.template,
                css: config.css,
                fields: config.fields,
            }),

            createElement('hr', { style: styles.divider }),

            // General save message (non-AI)
            config.message && !isAiMessage && createElement('div', {
                style: messageStyle(config.message),
            }, config.message)
        );
    }

    return null;
}
