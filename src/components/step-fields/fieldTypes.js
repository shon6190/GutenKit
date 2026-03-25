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
