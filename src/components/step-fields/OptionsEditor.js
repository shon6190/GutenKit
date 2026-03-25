/**
 * OptionsEditor — add/remove/edit {label, value} pairs for select/radio/multiselect fields.
 */
import { createElement } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';

export default function OptionsEditor({ options = [], onChange }) {
    const add = () => onChange([...options, { label: 'Option ' + (options.length + 1), value: 'option_' + (options.length + 1) }]);
    const remove = (i) => onChange(options.filter((_, idx) => idx !== i));
    const update = (i, prop, val) => {
        const next = options.map((o, idx) => idx === i ? { ...o, [prop]: val } : o);
        onChange(next);
    };

    return createElement('div', { className: 'gk-options-editor' },
        createElement('p', { style: { fontWeight: 600, marginBottom: 8, fontSize: 12 } }, 'Options'),
        options.map((opt, i) =>
            createElement('div', {
                key: i,
                style: { display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 6 },
            },
                createElement(TextControl, {
                    label: i === 0 ? 'Label' : undefined,
                    value: opt.label,
                    onChange: (v) => update(i, 'label', v),
                    style: { flex: 1 },
                }),
                createElement(TextControl, {
                    label: i === 0 ? 'Value' : undefined,
                    value: opt.value,
                    onChange: (v) => update(i, 'value', v),
                    style: { flex: 1 },
                }),
                createElement(Button, {
                    isDestructive: true,
                    onClick: () => remove(i),
                    style: { marginBottom: i === 0 ? 2 : 0 },
                }, '✕')
            )
        ),
        createElement(Button, { isSecondary: true, onClick: add, style: { marginTop: 4 } }, '+ Add Option')
    );
}
