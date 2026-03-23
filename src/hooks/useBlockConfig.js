/**
 * useBlockConfig — custom hook that owns all editor state and API calls.
 */
import { useState } from '@wordpress/element';
import { saveStructure, runBuild, generateAITemplate } from '../utils/api.js';
import { validateFields } from '../components/shared/Validation.js';

// --- Utility Functions ---
export const slugifyKey   = (value) => value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
export const slugifyLabel = (value) => value.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ');

export default function useBlockConfig({ initialConfig, blockSlug }) {
    // --- Core state ---
    const [fields, setFields]             = useState(initialConfig.fields || []);
    const [template, setTemplate]         = useState(initialConfig.template || '');
    const [css, setCss]                   = useState(initialConfig.css || '');
    const [step, setStep]                 = useState(0);
    const [isSaving, setIsSaving]         = useState(false);
    const [message, setMessage]           = useState('');
    const [cheatSheet, setCheatSheet]     = useState(null);
    const [invalidFields, setInvalidFields] = useState({});
    const [selectedField, setSelectedField] = useState(null);

    // --- AI state ---
    const [aiPrompt, setAiPrompt]         = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // --- Drag state ---
    const [draggedIndex, setDraggedIndex]       = useState(null);
    const [draggedSubIndex, setDraggedSubIndex] = useState(null);

    // --- Field CRUD ---
    const addField = (type) => {
        const newField = {
            type,
            key: 'new_field_' + fields.length,
            label: 'New ' + type + ' Field',
            default: '',
        };
        setFields([...fields, newField]);
        setSelectedField(newField);
    };

    const updateField = (index, property, value) => {
        const newFields = fields.map((field, i) => {
            if (i === index) {
                if (property === 'key')   value = slugifyKey(value);
                if (property === 'label') value = slugifyLabel(value);
                const updated = { ...field, [property]: value };
                if (property === 'label') updated.key = slugifyKey(value);
                return updated;
            }
            return field;
        });
        setFields(newFields);
        setSelectedField(newFields[index]);

        if (invalidFields[index]) {
            const next = { ...invalidFields };
            delete next[index];
            setInvalidFields(next);
        }
    };

    const removeField = (index) => {
        setFields(fields.filter((_, i) => i !== index));
        setSelectedField(null);

        if (invalidFields[index]) {
            const next = { ...invalidFields };
            delete next[index];
            setInvalidFields(next);
        }
    };

    // --- Template helpers ---
    const insertTagAtCursor = (key) => {
        const textarea = document.getElementById('bf-html-template-area');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end   = textarea.selectionEnd;
        const text  = textarea.value;
        const tag   = '{{' + key + '}}';
        const newContent = text.substring(0, start) + tag + text.substring(end);
        setTemplate(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
    };

    // --- API: Save ---
    const handleSave = (shouldBuild = false, nextStep = null) => {
        const result = validateFields(fields);
        if (!result.isValid) {
            setInvalidFields(result.invalidFields);
            setMessage('Warning: All fields and sub-fields must have a valid Field Label and Attribute Key.');
            return;
        }

        setInvalidFields({});
        setIsSaving(true);
        setMessage(shouldBuild ? 'Saving & Building...' : (nextStep !== null ? 'Saving Structure & Context...' : 'Saving Structure...'));
        setCheatSheet(null);

        const nonce = window.blockFactoryEditor.nonce;

        saveStructure({
            nonce,
            blockSlug,
            configData: { fields, template, css },
        })
            .then(response => {
                if (response.success) {
                    if (response.data.cheat_sheet) {
                        setCheatSheet(response.data.cheat_sheet);
                    }
                    if (shouldBuild) {
                        setMessage('Saved! Starting build...');
                        triggerBuild();
                    } else {
                        setMessage('Structure Saved.');
                        setIsSaving(false);
                        if (nextStep !== null) {
                            setStep(nextStep);
                        }
                    }
                } else {
                    setMessage('Error: ' + response.data.message);
                    setIsSaving(false);
                }
            })
            .catch(() => {
                setMessage('Critical Error: Could not reach the server.');
                setIsSaving(false);
            });
    };

    // --- API: Build ---
    const triggerBuild = () => {
        const nonce = window.blockFactoryEditor.nonce;
        runBuild({ nonce })
            .then(response => {
                if (response.success) {
                    setMessage('Build Complete! Your block is ready.');
                } else {
                    setMessage('Build Failed. Error Details:\n' + response.output);
                }
            })
            .catch(() => {
                setMessage('Save success, but Build request failed.');
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    // --- API: AI Generate ---
    const handleGenerateAI = () => {
        if (!aiPrompt.trim()) {
            setMessage('Please enter a prompt for the AI.');
            return;
        }
        setIsGenerating(true);
        setMessage('AI is generating your template...');

        const nonce = window.blockFactoryEditor.nonce;
        generateAITemplate({ nonce, prompt: aiPrompt, fields })
            .then(response => {
                if (response.success) {
                    setTemplate(response.data.html || '');
                    setCss(response.data.css || '');
                    setMessage('AI Generation Complete!');
                } else {
                    setMessage('AI Error: ' + (response.data.message || 'Unknown error'));
                }
            })
            .catch((error) => {
                setMessage('Critical Error: Could not reach the server for AI generation. ' + error.message);
            })
            .finally(() => {
                setIsGenerating(false);
            });
    };

    return {
        // State
        fields, setFields,
        template, setTemplate,
        css, setCss,
        step, setStep,
        isSaving,
        message, setMessage,
        cheatSheet,
        invalidFields, setInvalidFields,
        selectedField, setSelectedField,
        aiPrompt, setAiPrompt,
        isGenerating,
        draggedIndex, setDraggedIndex,
        draggedSubIndex, setDraggedSubIndex,

        // Field ops
        addField,
        updateField,
        removeField,
        insertTagAtCursor,

        // API ops
        handleSave,
        triggerBuild,
        handleGenerateAI,
    };
}
