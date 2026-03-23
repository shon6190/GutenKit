/**
 * AIGenerator — AI prompt textarea + generate button.
 */
import { createElement } from '@wordpress/element';
import { Button, PanelBody } from '@wordpress/components';

const styles = {
    panel: {
        marginBottom: '20px',
        background: '#f8f9fa',
        border: '1px solid #e2e4e7',
        borderRadius: '4px',
    },
    description: { fontSize: '13px', margin: '0 0 10px 0', color: '#666' },
    textarea: {
        width: '100%',
        minHeight: '80px',
        padding: '10px',
        marginBottom: '10px',
        fontFamily: 'inherit',
        border: '1px solid #8c8f94',
        borderRadius: '4px',
        fontSize: '14px',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    generateBtn: { background: '#8a2be2', borderColor: '#8a2be2', color: '#fff' },
    settingsLink: { fontSize: '12px', color: '#007cba', textDecoration: 'none' },
};

function messageStyle(msg) {
    const isSuccess = msg.includes('Complete');
    const isWorking = msg.includes('generating');
    return {
        marginTop: '15px',
        padding: '10px 15px',
        backgroundColor: isSuccess ? '#d4edda' : (isWorking ? '#e2e3e5' : '#f8d7da'),
        color: isSuccess ? '#155724' : (isWorking ? '#383d41' : '#721c24'),
        border: '1px solid',
        borderColor: isSuccess ? '#c3e6cb' : (isWorking ? '#d6d8db' : '#f5c6cb'),
        borderRadius: '4px',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '13px',
    };
}

export default function AIGenerator({ aiPrompt, setAiPrompt, isGenerating, handleGenerateAI, message }) {
    const showAiMessage = message && (message.includes('AI') || message.includes('generating') || message.includes('prompt'));

    return createElement(PanelBody, {
        title: 'AI Template Generator',
        initialOpen: true,
        style: styles.panel,
    },
        createElement('p', { style: styles.description },
            'Describe the layout you want to build. The AI will look at your fields and generate the HTML & CSS automatically.'
        ),
        createElement('textarea', {
            value: aiPrompt,
            onChange: (e) => setAiPrompt(e.target.value),
            placeholder: 'E.g., "Create a two-column card with the image on the left and title on the right. Make it look modern with a subtle drop shadow."',
            style: styles.textarea,
        }),
        createElement('div', { style: styles.row },
            createElement(Button, {
                isPrimary: true,
                isBusy: isGenerating,
                onClick: handleGenerateAI,
                style: styles.generateBtn,
            }, isGenerating ? 'Generating...' : 'Generate with AI'),
            createElement('a', {
                href: 'admin.php?page=gutenkit-ai-settings',
                target: '_blank',
                style: styles.settingsLink,
            }, 'AI Settings (API Keys)')
        ),
        showAiMessage && createElement('div', { style: messageStyle(message) }, message)
    );
}
