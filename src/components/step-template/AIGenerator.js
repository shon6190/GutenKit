/**
 * AIGenerator — AI prompt textarea + generate button.
 */
import { createElement } from '@wordpress/element';

function aiMessageClass(msg) {
    if (!msg) return '';
    if (msg.includes('Complete')) return 'gk-ai-message is-success';
    if (msg.includes('generating') || msg.includes('Saving')) return 'gk-ai-message is-working';
    return 'gk-ai-message is-error';
}

export default function AIGenerator({ aiPrompt, setAiPrompt, isGenerating, handleGenerateAI, message }) {
    const showAiMessage = message && (message.includes('AI') || message.includes('generating') || message.includes('prompt'));

    return createElement('div', { className: 'gk-ai-hero' },
        createElement('div', { className: 'gk-ai-hero__icon' },
            createElement('span', {
                className: 'material-symbols-outlined filled',
                style: { fontVariationSettings: "'FILL' 1" },
            }, 'auto_awesome')
        ),

        createElement('div', { className: 'gk-ai-hero__body' },
            createElement('p', { className: 'gk-ai-hero__label' }, 'AI Smart Engine'),
            createElement('p', { className: 'gk-ai-hero__desc' },
                'Describe the layout you want. AI will generate HTML & CSS based on your fields.'
            ),
            createElement('textarea', {
                className: 'gk-ai-hero__textarea',
                value: aiPrompt,
                onChange: (e) => setAiPrompt(e.target.value),
                placeholder: 'E.g., "A two-column card with image on the left and title + description on the right. Modern, with a subtle shadow."',
            }),
            createElement('div', { className: 'gk-ai-hero__row' },
                createElement('button', {
                    type: 'button',
                    className: 'gk-btn-ai',
                    disabled: isGenerating,
                    onClick: handleGenerateAI,
                },
                    createElement('span', {
                        className: 'material-symbols-outlined',
                        style: { fontSize: '16px', fontVariationSettings: "'FILL' 1" },
                    }, 'colors_spark'),
                    isGenerating ? 'Generating...' : 'Generate Template'
                ),
                createElement('a', {
                    href: 'admin.php?page=gutenkit-ai-settings',
                    target: '_blank',
                    className: 'gk-ai-settings-link',
                }, 'AI Settings')
            ),
            showAiMessage && createElement('div', { className: aiMessageClass(message) }, message)
        )
    );
}
