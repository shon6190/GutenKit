# New Field Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 new field types (email, toggle, gradient, select, radio, multiselect, link, spacing, dimension, typography) to Block Factory's field system.

**Architecture:** Each field type must be wired into 6 layers: (1) palette UI (`fieldTypes.js`), (2) editor controls (`lib/fields.js` FIELD_MAP), (3) PHP render output (`generate-block-code-multi.js` switch), (4) JSX canvas preview (`lib/php-to-jsx.js`), (5) cheat sheet docs (`class-gutenkit-cheat-sheet.php`), (6) live preview sample data (`LivePreview.js` + `TemplateEditor.js`). Options-based types (select/radio/multiselect) also need a new `OptionsEditor` component in FieldSettings. Object-type fields (link, spacing, dimension, typography) use compound tokens like `{{key_url}}`, `{{key_top}}` etc. instead of a single `{{key}}`.

**Tech Stack:** React (`@wordpress/element`, `@wordpress/components`, `@wordpress/block-editor`), PHP 7.4, Node.js code generator, WordPress Gutenberg blocks.

---

## File Map

| File | Change |
|---|---|
| `src/components/step-fields/fieldTypes.js` | Add 10 new entries to FIELD_TYPES |
| `lib/fields.js` | Add 10 new FIELD_MAP entries; update `generateRepeaterInnerJSX`; change `jsx(key, label)` → `jsx(key, label, field)` signature for options-based types |
| `generate-block-code-multi.js` | Change `map.jsx(field.key, field.label)` → `map.jsx(field.key, field.label, field)`; add switch cases for all new types including compound token replacement for object types |
| `src/components/step-fields/OptionsEditor.js` | **NEW** — reusable options list editor (add/remove/edit {label,value} pairs) used by select, radio, multiselect |
| `src/components/step-fields/FieldSettings.js` | Render `OptionsEditor` when selected field type is select/radio/multiselect |
| `lib/php-to-jsx.js` | Add canvas preview conversions for toggle (→ 'true'/'false'), link (→ `<a>`), spacing/dimension/typography (→ inline style strings) |
| `includes/class-gutenkit-cheat-sheet.php` | Add cheat sheet documentation for all new types |
| `src/components/step-template/LivePreview.js` | Add `sampleValue` cases + `replaceField` handling for all new types |
| `src/components/step-template/TemplateEditor.js` | Add `getSnippet` cases for new types (especially object types with compound tokens) |

---

## Task 1: Add new types to fieldTypes.js

**Files:**
- Modify: `src/components/step-fields/fieldTypes.js`

- [ ] **Step 1: Add the 10 new entries to FIELD_TYPES**

Replace the entire file content with:

```js
/**
 * Field type definitions shared across field-related components.
 */
export const FIELD_TYPES = [
    // Text-based
    { label: 'Text Input',              value: 'text' },
    { label: 'Number Input',            value: 'number' },
    { label: 'Range Slider',            value: 'range' },
    { label: 'URL Link',                value: 'url' },
    { label: 'Email Input',             value: 'email' },
    { label: 'Text Area',               value: 'textarea' },
    { label: 'Rich Text Content',       value: 'contentEditor' },
    // Toggle / Select
    { label: 'Toggle (On/Off)',         value: 'toggle' },
    { label: 'Select Dropdown',         value: 'select' },
    { label: 'Radio Buttons',           value: 'radio' },
    { label: 'Multi-Select',            value: 'multiselect' },
    // Media
    { label: 'Image/Media',             value: 'image' },
    { label: 'File Upload',             value: 'file' },
    { label: 'Gallery',                 value: 'gallery' },
    // Pickers
    { label: 'Date Picker',             value: 'date' },
    { label: 'Date Time Picker',        value: 'datetime' },
    { label: 'Time Picker',             value: 'time' },
    { label: 'Color Picker',            value: 'color' },
    { label: 'Gradient Picker',         value: 'gradient' },
    { label: 'Icon Picker',             value: 'icon' },
    // Composite / Structural
    { label: 'Button (Link)',           value: 'button' },
    { label: 'Link',                    value: 'link' },
    { label: 'Spacing',                 value: 'spacing' },
    { label: 'Dimension',               value: 'dimension' },
    { label: 'Typography',              value: 'typography' },
    { label: 'Repeater/Group',          value: 'repeater' },
    { label: 'Relational (Post Select)', value: 'relational' },
];
```

- [ ] **Step 2: Update FieldSettings `handleTypeChange` to set correct defaults for new types**

In `src/components/step-fields/FieldSettings.js`, find `handleTypeChange` and update the default-setting logic:

```js
const handleTypeChange = (val) => {
    const objTypes    = ['image', 'file', 'link', 'spacing', 'dimension', 'typography'];
    const arrayTypes  = ['gallery', 'repeater', 'multiselect'];
    const boolTypes   = ['toggle'];
    let newDefault = '';
    if (val === 'button')                newDefault = { text: '', url: '' };
    else if (val === 'link')             newDefault = { url: '', title: '', target: '_self' };
    else if (val === 'spacing')          newDefault = { top: '0', right: '0', bottom: '0', left: '0', unit: 'px' };
    else if (val === 'dimension')        newDefault = { width: '', height: '', unit: 'px' };
    else if (val === 'typography')       newDefault = { family: '', size: '', weight: '400', lineHeight: '1.5' };
    else if (objTypes.includes(val))     newDefault = null;
    else if (arrayTypes.includes(val))   newDefault = [];
    else if (boolTypes.includes(val))    newDefault = false;
    const newFields = fields.map((f, i) => i === index ? { ...f, type: val, default: newDefault } : f);
    setFields(newFields);
    setSelectedField(newFields[index]);
};
```

---

## Task 2: Build OptionsEditor component

Options-based fields (select, radio, multiselect) need a UI to define the `[{label, value}]` list.

**Files:**
- Create: `src/components/step-fields/OptionsEditor.js`

- [ ] **Step 1: Create OptionsEditor.js**

```js
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
```

- [ ] **Step 2: Wire OptionsEditor into FieldSettings**

In `src/components/step-fields/FieldSettings.js`:

Add import at top:
```js
import OptionsEditor from './OptionsEditor.js';
```

Add this block inside the `return createElement(...)` just before the RepeaterSettings section (after the default value input section):

```js
// Options editor for select / radio / multiselect
['select', 'radio', 'multiselect'].includes(selectedField.type) &&
    createElement(OptionsEditor, {
        options: selectedField.options || [],
        onChange: (opts) => updateField(index, 'options', opts),
    }),
```

---

## Task 3: Add simple new types to FIELD_MAP (email, toggle, gradient)

**Files:**
- Modify: `lib/fields.js`

- [ ] **Step 1: Add email entry to FIELD_MAP**

Email is already in FIELD_MAP but the existing entry is correct — no change needed. Verify it exists around line 152 with `attributeType: 'string'` and `TextControl type="email"`.

- [ ] **Step 2: Add toggle entry**

Add after the `email` entry in FIELD_MAP:

```js
'toggle': {
    imports: ['ToggleControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'boolean',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <ToggleControl
                    label="${label}"
                    checked={ !! attributes.${key} }
                    onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

- [ ] **Step 3: Add gradient entry**

```js
'gradient': {
    imports: ['GradientPicker', 'InspectorControls', 'PanelBody'],
    attributeType: 'string',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <p style={{ marginBottom: '8px', fontWeight: 600 }}>${label}</p>
                <GradientPicker
                    value={ attributes.${key} }
                    onChange={ ( value ) => setAttributes( { ${key}: value || '' } ) }
                    gradients={ [] }
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

Note: `GradientPicker` is imported from `@wordpress/block-editor`. Add it to `PACKAGE_MAP` in `lib/constants.js`:
```js
GradientPicker: 'BLOCK_EDITOR',
```

- [ ] **Step 4: Add ToggleControl to PACKAGE_MAP in lib/constants.js**

```js
ToggleControl: 'COMPONENTS',
```

---

## Task 4: Add options-based types to FIELD_MAP (select, radio, multiselect)

**Files:**
- Modify: `lib/fields.js`
- Modify: `generate-block-code-multi.js` (change `map.jsx` call signature)

- [ ] **Step 1: Update the generator to pass the full field to jsx()**

In `generate-block-code-multi.js` find line:
```js
let fieldJSX = map.jsx(field.key, field.label);
```
Change to:
```js
let fieldJSX = map.jsx(field.key, field.label, field);
```

This is a non-breaking change — all existing `jsx: (key, label) => ...` functions simply ignore the third parameter.

- [ ] **Step 2: Add select entry**

```js
'select': {
    imports: ['SelectControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'string',
    jsx: (key, label, field) => {
        const opts = (field && field.options && field.options.length)
            ? JSON.stringify(field.options.map(o => ({ label: o.label, value: o.value })))
            : '[{ label: "Option 1", value: "option_1" }]';
        return `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <SelectControl
                    label="${label}"
                    value={ attributes.${key} }
                    options={ ${opts} }
                    onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                />
            </PanelBody>
        </InspectorControls>
        `;
    },
},
```

- [ ] **Step 3: Add radio entry**

```js
'radio': {
    imports: ['RadioControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'string',
    jsx: (key, label, field) => {
        const opts = (field && field.options && field.options.length)
            ? JSON.stringify(field.options.map(o => ({ label: o.label, value: o.value })))
            : '[{ label: "Option 1", value: "option_1" }]';
        return `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <RadioControl
                    label="${label}"
                    selected={ attributes.${key} }
                    options={ ${opts} }
                    onChange={ ( value ) => setAttributes( { ${key}: value } ) }
                />
            </PanelBody>
        </InspectorControls>
        `;
    },
},
```

- [ ] **Step 4: Add multiselect entry**

```js
'multiselect': {
    imports: ['CheckboxControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'array',
    jsx: (key, label, field) => {
        const opts = (field && field.options && field.options.length)
            ? field.options
            : [{ label: 'Option 1', value: 'option_1' }];
        const checkboxes = opts.map(o => `
                <CheckboxControl
                    label="${o.label}"
                    checked={ (attributes.${key} || []).includes('${o.value}') }
                    onChange={ ( checked ) => {
                        const current = Array.isArray(attributes.${key}) ? attributes.${key} : [];
                        setAttributes({ ${key}: checked
                            ? [...current, '${o.value}']
                            : current.filter(v => v !== '${o.value}')
                        });
                    }}
                />`).join('\n');
        return `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>${label}</p>
                ${checkboxes}
            </PanelBody>
        </InspectorControls>
        `;
    },
},
```

- [ ] **Step 5: Add RadioControl and CheckboxControl to PACKAGE_MAP in lib/constants.js**

```js
RadioControl:    'COMPONENTS',
CheckboxControl: 'COMPONENTS',
```

---

## Task 5: Add object field types to FIELD_MAP (link, spacing, dimension, typography)

**Files:**
- Modify: `lib/fields.js`

These types use **compound tokens** in templates:
- `link` → `{{key_url}}`, `{{key_title}}`, `{{key_target}}`
- `spacing` → `{{key_top}}`, `{{key_right}}`, `{{key_bottom}}`, `{{key_left}}`, `{{key_unit}}`
- `dimension` → `{{key_width}}`, `{{key_height}}`, `{{key_unit}}`
- `typography` → `{{key_family}}`, `{{key_size}}`, `{{key_weight}}`, `{{key_line_height}}`

- [ ] **Step 1: Add link entry**

```js
'link': {
    imports: ['TextControl', 'ToggleControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'object',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <TextControl
                    label="URL"
                    type="url"
                    value={ attributes.${key}?.url || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), url: v } }) }
                />
                <TextControl
                    label="Link Title"
                    value={ attributes.${key}?.title || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), title: v } }) }
                />
                <ToggleControl
                    label="Open in new tab"
                    checked={ attributes.${key}?.target === '_blank' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), target: v ? '_blank' : '_self' } }) }
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

- [ ] **Step 2: Add spacing entry**

Uses `BoxControl` from `@wordpress/components`.

```js
'spacing': {
    imports: ['BoxControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'object',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <BoxControl
                    label="${label}"
                    values={ attributes.${key} || { top: '0px', right: '0px', bottom: '0px', left: '0px' } }
                    onChange={ ( next ) => setAttributes({ ${key}: next }) }
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

Add to `lib/constants.js`:
```js
BoxControl: 'COMPONENTS',
```

- [ ] **Step 3: Add dimension entry**

Uses `UnitControl` from `@wordpress/components`.

```js
'dimension': {
    imports: ['UnitControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'object',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <UnitControl
                    label="Width"
                    value={ attributes.${key}?.width || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), width: v } }) }
                />
                <UnitControl
                    label="Height"
                    value={ attributes.${key}?.height || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), height: v } }) }
                    style={{ marginTop: '8px' }}
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

Add to `lib/constants.js`:
```js
UnitControl: 'COMPONENTS',
```

- [ ] **Step 4: Add typography entry**

```js
'typography': {
    imports: ['TextControl', 'SelectControl', 'InspectorControls', 'PanelBody'],
    attributeType: 'object',
    jsx: (key, label) => `
        <InspectorControls key="${key}-settings">
            <PanelBody title="${label} Settings" initialOpen={true}>
                <TextControl
                    label="Font Family"
                    value={ attributes.${key}?.family || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), family: v } }) }
                    placeholder="e.g. Inter, sans-serif"
                />
                <TextControl
                    label="Font Size"
                    value={ attributes.${key}?.size || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), size: v } }) }
                    placeholder="e.g. 16px or 1rem"
                />
                <SelectControl
                    label="Font Weight"
                    value={ attributes.${key}?.weight || '400' }
                    options={[
                        { label: 'Thin (100)',        value: '100' },
                        { label: 'Light (300)',       value: '300' },
                        { label: 'Normal (400)',      value: '400' },
                        { label: 'Medium (500)',      value: '500' },
                        { label: 'Semi-Bold (600)',   value: '600' },
                        { label: 'Bold (700)',        value: '700' },
                        { label: 'Extra-Bold (800)',  value: '800' },
                    ]}
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), weight: v } }) }
                />
                <TextControl
                    label="Line Height"
                    value={ attributes.${key}?.lineHeight || '' }
                    onChange={ ( v ) => setAttributes({ ${key}: { ...(attributes.${key} || {}), lineHeight: v } }) }
                    placeholder="e.g. 1.5"
                />
            </PanelBody>
        </InspectorControls>
    `,
},
```

---

## Task 6: Update render.php generator switch

**Files:**
- Modify: `generate-block-code-multi.js`

The render.php generator needs cases for all new types. Object types need compound token replacement.

- [ ] **Step 1: Add simple type cases to the switch**

Find the switch statement in `generateRenderPhp`. Add these cases:

```js
case 'email':
    php = `<?php echo esc_attr( $attributes['${key}'] ?? '' ); ?>`;
    break;
case 'toggle':
    php = `<?php echo ! empty( $attributes['${key}'] ) ? 'true' : 'false'; ?>`;
    break;
case 'gradient':
    php = `<?php echo esc_attr( $attributes['${key}'] ?? '' ); ?>`;
    break;
case 'select':
case 'radio':
    php = `<?php echo esc_html( $attributes['${key}'] ?? '' ); ?>`;
    break;
```

- [ ] **Step 2: Add multiselect case**

```js
case 'multiselect':
    // Outputs comma-separated selected values
    php = `<?php echo esc_html( implode( ', ', is_array( $attributes['${key}'] ?? [] ) ? $attributes['${key}'] : [] ) ); ?>`;
    break;
```

- [ ] **Step 3: Add compound token replacement for link**

After the main switch, before the `template.split(...).join(php)` call, handle compound tokens for object types. Add a new section at the end of the top-level fields loop:

```js
// --- Compound token replacement for object types ---
if (type === 'link') {
    template = template.split(`{{${key}_url}}`).join(`<?php echo esc_url( $attributes['${key}']['url'] ?? '' ); ?>`);
    template = template.split(`{{${key}_title}}`).join(`<?php echo esc_html( $attributes['${key}']['title'] ?? '' ); ?>`);
    template = template.split(`{{${key}_target}}`).join(`<?php echo esc_attr( $attributes['${key}']['target'] ?? '_self' ); ?>`);
    // {{key}} shorthand = full anchor tag
    php = `<?php if ( ! empty( $attributes['${key}']['url'] ) ): ?>`
        + `<a href="<?php echo esc_url( $attributes['${key}']['url'] ); ?>"`
        + ` target="<?php echo esc_attr( $attributes['${key}']['target'] ?? '_self' ); ?>">`
        + `<?php echo esc_html( $attributes['${key}']['title'] ?? '' ); ?>`
        + `</a><?php endif; ?>`;
} else if (type === 'spacing') {
    ['top', 'right', 'bottom', 'left', 'unit'].forEach(prop => {
        template = template.split(`{{${key}_${prop}}}`).join(`<?php echo esc_attr( $attributes['${key}']['${prop}'] ?? '0' ); ?>`);
    });
    php = `<?php echo esc_attr( ($attributes['${key}']['top'] ?? '0') . ' ' . ($attributes['${key}']['right'] ?? '0') . ' ' . ($attributes['${key}']['bottom'] ?? '0') . ' ' . ($attributes['${key}']['left'] ?? '0') ); ?>`;
} else if (type === 'dimension') {
    ['width', 'height', 'unit'].forEach(prop => {
        template = template.split(`{{${key}_${prop}}}`).join(`<?php echo esc_attr( $attributes['${key}']['${prop}'] ?? '' ); ?>`);
    });
    php = ''; // no single {{key}} output for dimension — use compound tokens
} else if (type === 'typography') {
    ['family', 'size', 'weight', 'lineHeight'].forEach(prop => {
        template = template.split(`{{${key}_${prop}}}`).join(`<?php echo esc_attr( $attributes['${key}']['${prop}'] ?? '' ); ?>`);
    });
    // {{key}} = inline style string
    php = `<?php echo esc_attr( 'font-family:' . ($attributes['${key}']['family'] ?? '') . ';font-size:' . ($attributes['${key}']['size'] ?? '') . ';font-weight:' . ($attributes['${key}']['weight'] ?? '400') . ';line-height:' . ($attributes['${key}']['lineHeight'] ?? '1.5') ); ?>`;
}
```

- [ ] **Step 4: Skip object types in the main switch**

Add these to the `if (type === 'repeater' || type === 'gallery') continue;` guard:

```js
if (['repeater', 'gallery', 'link', 'spacing', 'dimension', 'typography'].includes(type)) continue;
```

The compound replacements above already handle them before this guard, so `continue` prevents the switch from producing a wrong fallback.

---

## Task 7: Update php-to-jsx.js canvas preview conversion

**Files:**
- Modify: `lib/php-to-jsx.js`

The canvas preview is generated by converting render.php back to JSX. New object types need their compound PHP expressions converted back to JSX equivalents.

- [ ] **Step 1: Add toggle conversion**

After the existing step 7 (simple text interpolations), add:

```js
// Toggle: convert PHP conditional to 'true'/'false' string
jsx = jsx.replace(/<\?php echo ! empty\(\$(attributes|item)\['(\w+)'\]\) \? 'true' : 'false'; \?>/g,
    '{$1.$2 ? "true" : "false"}');
```

- [ ] **Step 2: Add link conversion**

```js
// Link: full anchor tag
jsx = jsx.replace(/<\?php if[^?]*?\$(?:attributes|item)\['(\w+)'\]\['url'\][^?]*?\?>([\s\S]*?)<\?php endif; \?>/g,
    (match, key, inner) => {
        if (!/<a\s/.test(inner)) return match;
        return `<a href={attributes.${key}?.url || "#"} target={attributes.${key}?.target || "_self"}>{attributes.${key}?.title || ""}</a>`;
    }
);
// Compound link tokens
jsx = jsx.replace(/<\?php echo esc_url\(\s*\$(?:attributes|item)\['(\w+)'\]\['url'\]\s*\?\?\s*''\s*\);\s*\?>/g, '{attributes.$1?.url || ""}');
jsx = jsx.replace(/<\?php echo esc_html\(\s*\$(?:attributes|item)\['(\w+)'\]\['title'\]\s*\?\?\s*''\s*\);\s*\?>/g, '{attributes.$1?.title || ""}');
jsx = jsx.replace(/<\?php echo esc_attr\(\s*\$(?:attributes|item)\['(\w+)'\]\['target'\]\s*\?\?\s*'_self'\s*\);\s*\?>/g, '{attributes.$1?.target || "_self"}');
```

- [ ] **Step 3: Add spacing/dimension/typography compound token conversions**

```js
// Spacing/dimension/typography compound tokens: {{key_prop}} already replaced in render.php
// The <?php echo esc_attr( $attributes['key']['prop'] ... ) ?> pattern:
jsx = jsx.replace(/<\?php echo esc_attr\(\s*\$attributes\['(\w+)'\]\['(\w+)'\]\s*\?\?\s*'[^']*'\s*\);\s*\?>/g,
    '{attributes.$1?.$2 || ""}');
```

---

## Task 8: Update cheat sheet PHP documentation

**Files:**
- Modify: `includes/class-gutenkit-cheat-sheet.php`

- [ ] **Step 1: Add cases for all new types in the generate() foreach**

After the `} elseif ($type === 'image' || $type === 'file') {` block and before the `} else {` default, add:

```php
} elseif ( $type === 'toggle' ) {
    $lines[] = 'Value: <code>{{' . $key . '}}</code> <small>(outputs "true" or "false")</small>';
    $lines[] = '<br><small>Tip: use in a class attribute: <code>class="block {{' . $key . '}}"</code></small>';
} elseif ( $type === 'email' ) {
    $lines[] = 'Value: <code>{{' . $key . '}}</code>';
} elseif ( $type === 'gradient' ) {
    $lines[] = 'CSS gradient value: <code>{{' . $key . '}}</code>';
    $lines[] = '<br><small>Example: <code>style="background: {{' . $key . '}}"</code></small>';
} elseif ( $type === 'select' || $type === 'radio' ) {
    $lines[] = 'Selected value: <code>{{' . $key . '}}</code>';
} elseif ( $type === 'multiselect' ) {
    $lines[] = 'Comma-separated values: <code>{{' . $key . '}}</code>';
} elseif ( $type === 'link' ) {
    $link_snippet = '{{' . $key . '_title}}';
    $lines[] = 'Full anchor: <code>{{' . $key . '}}</code><br>';
    $lines[] = 'Or individual tokens:<br>';
    $lines[] = '&nbsp;&nbsp; URL: <code>{{' . $key . '_url}}</code><br>';
    $lines[] = '&nbsp;&nbsp; Title: <code>{{' . $key . '_title}}</code><br>';
    $lines[] = '&nbsp;&nbsp; Target: <code>{{' . $key . '_target}}</code>';
} elseif ( $type === 'spacing' ) {
    $lines[] = 'Shorthand (T R B L): <code>{{' . $key . '}}</code><br>';
    $lines[] = 'Individual sides:<br>';
    foreach ( ['top', 'right', 'bottom', 'left'] as $side ) {
        $lines[] = '&nbsp;&nbsp; <code>{{' . $key . '_' . $side . '}}</code><br>';
    }
    $lines[] = '<small>Example: <code>style="padding: {{' . $key . '}}"</code></small>';
} elseif ( $type === 'dimension' ) {
    $lines[] = 'Width: <code>{{' . $key . '_width}}</code><br>';
    $lines[] = 'Height: <code>{{' . $key . '_height}}</code><br>';
    $lines[] = '<small>Example: <code>style="width:{{' . $key . '_width}};height:{{' . $key . '_height}}"</code></small>';
} elseif ( $type === 'typography' ) {
    $lines[] = 'Inline CSS string: <code>{{' . $key . '}}</code><br>';
    $lines[] = 'Individual properties:<br>';
    foreach ( ['family', 'size', 'weight', 'lineHeight'] as $prop ) {
        $lines[] = '&nbsp;&nbsp; <code>{{' . $key . '_' . $prop . '}}</code><br>';
    }
    $lines[] = '<small>Example: <code>style="{{' . $key . '}}"</code></small>';
```

---

## Task 9: Update LivePreview sample data + TemplateEditor snippets

**Files:**
- Modify: `src/components/step-template/LivePreview.js`
- Modify: `src/components/step-template/TemplateEditor.js`

- [ ] **Step 1: Add sampleValue cases in LivePreview.js**

In the `sampleValue` switch statement, add:

```js
case 'email':     return 'hello@example.com';
case 'toggle':    return 'true';
case 'gradient':  return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
case 'select':
case 'radio':     return (field.options && field.options[0]) ? field.options[0].value : 'option_1';
case 'multiselect': return (field.options && field.options[0]) ? field.options[0].value : 'option_1';
case 'link':      return '#';   // fallback; compound tokens handled below
case 'spacing':   return '16px 24px 16px 24px';
case 'dimension': return '100%'; // fallback
case 'typography': return 'font-family:Inter,sans-serif;font-size:16px;font-weight:400;line-height:1.5';
```

- [ ] **Step 2: Add replaceField handling for compound token types in LivePreview.js**

In the `replaceField` function, add before the final `html.replace` call:

```js
if (field.type === 'link') {
    const url = '#';
    const title = field.label || 'Learn More';
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_url\\s*\\}\\}', 'g'), url);
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_title\\s*\\}\\}', 'g'), title);
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_target\\s*\\}\\}', 'g'), '_self');
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
        '<a href="' + url + '">' + title + '</a>');
    return html;
}
if (field.type === 'spacing') {
    ['top','right','bottom','left','unit'].forEach((p, i) => {
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_' + p + '\\s*\\}\\}', 'g'),
            p === 'unit' ? 'px' : (16 + i * 4) + 'px');
    });
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'), '16px 24px 16px 24px');
    return html;
}
if (field.type === 'dimension') {
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_width\\s*\\}\\}', 'g'), '320px');
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_height\\s*\\}\\}', 'g'), '240px');
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_unit\\s*\\}\\}', 'g'), 'px');
    return html;
}
if (field.type === 'typography') {
    ['family','size','weight','lineHeight'].forEach(p => {
        const vals = { family: 'Inter, sans-serif', size: '16px', weight: '400', lineHeight: '1.5' };
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_' + p + '\\s*\\}\\}', 'g'), vals[p]);
    });
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
        'font-family:Inter,sans-serif;font-size:16px;font-weight:400;line-height:1.5');
    return html;
}
```

- [ ] **Step 3: Update TemplateEditor getSnippet for new types**

In `src/components/step-template/TemplateEditor.js`, extend `getSnippet`:

```js
if (field.type === 'email')     return '{{' + field.key + '}}';
if (field.type === 'toggle')    return '{{' + field.key + '}}';
if (field.type === 'gradient')  return '{{' + field.key + '}}';
if (field.type === 'select' || field.type === 'radio') return '{{' + field.key + '}}';
if (field.type === 'multiselect') return '{{' + field.key + '}}';
if (field.type === 'link') {
    return '<a href="{{' + field.key + '_url}}" target="{{' + field.key + '_target'}}">\n  {{' + field.key + '_title}}\n</a>';
}
if (field.type === 'spacing') {
    return 'style="padding: {{' + field.key + '}}"';
}
if (field.type === 'dimension') {
    return 'style="width: {{' + field.key + '_width}}; height: {{' + field.key + '_height}}"';
}
if (field.type === 'typography') {
    return 'style="{{' + field.key + '}}"';
}
```

Also update `chipLabel` to show useful hints:

```js
if (field.type === 'toggle')     return field.key + ' [bool]';
if (field.type === 'gradient')   return field.key + ' [gradient]';
if (field.type === 'select' || field.type === 'radio') return field.key + ' [select]';
if (field.type === 'multiselect') return field.key + ' [multi]';
if (field.type === 'link')       return field.key + ' [link]';
if (field.type === 'spacing')    return field.key + ' [spacing]';
if (field.type === 'dimension')  return field.key + ' [dimension]';
if (field.type === 'typography') return field.key + ' [typography]';
```

---

## Task 10: Build, verify, commit

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: `webpack compiled successfully` (both passes — admin app + blocks).

- [ ] **Step 2: Manual verification checklist**

Open the Block Factory admin UI and verify:
- [ ] All 10 new types appear in the field palette (Step 0)
- [ ] Toggle renders a ToggleControl in the sidebar
- [ ] Select/Radio show the OptionsEditor for adding options
- [ ] Multiselect shows checkboxes for each defined option
- [ ] Link shows URL + Title + "open in new tab" toggle
- [ ] Spacing shows BoxControl
- [ ] Dimension shows two UnitControl inputs
- [ ] Typography shows Family / Size / Weight / Line Height inputs
- [ ] Cheat sheet shows compound tokens for link/spacing/dimension/typography
- [ ] TemplateEditor chips insert the correct snippets
- [ ] LivePreview shows sample values (not `{{token}}` placeholders)

- [ ] **Step 3: Commit**

```bash
git add lib/fields.js lib/constants.js \
        src/components/step-fields/fieldTypes.js \
        src/components/step-fields/OptionsEditor.js \
        src/components/step-fields/FieldSettings.js \
        src/components/step-template/TemplateEditor.js \
        src/components/step-template/LivePreview.js \
        generate-block-code-multi.js \
        lib/php-to-jsx.js \
        includes/class-gutenkit-cheat-sheet.php \
        admin/js/editor-app.js \
        admin/js/editor-app.asset.php

git commit -m "feat: add 10 new field types (email, toggle, gradient, select, radio, multiselect, link, spacing, dimension, typography)"
```

---

## Notes

- `BoxControl`, `UnitControl`, `RadioControl`, `CheckboxControl`, `ToggleControl` are all in `@wordpress/components` — already a dependency.
- `GradientPicker` is in `@wordpress/block-editor` — already a dependency.
- No new npm packages needed.
- The `multiselect` checkbox generation in FIELD_MAP is **build-time** — options are baked into the generated `edit.js`. Changing options requires triggering a rebuild (Save & Build).
- `relational` field fix (real post fetching via `useSelect`) is out of scope for this plan.
