/**
 * LivePreview — renders processed template HTML with placeholder badges.
 */
import { createElement, useState } from '@wordpress/element';

// Inline SVG placeholder for image fields.
const PREVIEW_PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23f1f5f9'/%3E%3Cg fill='%2394a3b8'%3E%3Crect x='160' y='100' width='80' height='60' rx='4'/%3E%3Ccircle cx='185' cy='120' r='10'/%3E%3Cpolygon points='160,160 200,120 240,160'/%3E%3C/g%3E%3Ctext x='50%25' y='85%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='13' font-family='sans-serif'%3EImage Placeholder%3C/text%3E%3C/svg%3E";

/**
 * Processes the raw Mustache template for safe display in the admin live preview.
 */
export function processTemplateForPreview(htmlTemplate, fieldList) {
    if (!htmlTemplate) return htmlTemplate;
    let processed = htmlTemplate;

    fieldList.forEach(field => {
        const escapedKey = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (field.type === 'image' || field.type === 'file') {
            // Replace src="{{key}}" with placeholder image
            processed = processed.replace(
                new RegExp('src=["\']\\{\\{\\s*' + escapedKey + '\\s*\\}\\}["\']', 'gi'),
                'src="' + PREVIEW_PLACEHOLDER_SVG + '" style="max-width:100%;display:block;"'
            );
            // Replace {{key_alt}} with descriptive text
            processed = processed.replace(
                new RegExp('\\{\\{\\s*' + escapedKey + '_alt\\s*\\}\\}', 'g'),
                field.label + ' alt text'
            );
            // Replace bare {{key}} (outside src attr) with a small placeholder image
            processed = processed.replace(
                new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g'),
                '<img src="' + PREVIEW_PLACEHOLDER_SVG + '" alt="' + field.label + '" style="max-width:80px;height:50px;object-fit:cover;display:inline-block;vertical-align:middle;" />'
            );
        }

        if (field.type === 'button') {
            processed = processed.replace(
                new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g'),
                '<a href="#" class="bf-preview-btn">' + (field.label || 'Button') + '</a>'
            );
        }

        if (field.type === 'repeater') {
            processed = processed
                .replace(new RegExp('\\{\\{#(?:each\\s+)?' + escapedKey + '\\}\\}', 'g'), '<!-- repeater: ' + field.label + ' (loop start) -->')
                .replace(new RegExp('\\{\\{/(?:' + escapedKey + '|each)\\}\\}', 'g'), '<!-- repeater: ' + field.label + ' (loop end) -->');
        }

        // Replace remaining {{key}} tokens with a styled badge
        processed = processed.replace(
            new RegExp('\\{\\{\\s*' + escapedKey + '\\s*\\}\\}', 'g'),
            '<span style="background:var(--gk-primary-fixed);color:var(--gk-primary-dark);padding:1px 7px;border-radius:4px;font-size:11px;font-family:var(--gk-font-mono);">' + (field.label || field.key) + '</span>'
        );
    });

    return processed;
}

const VIEWPORTS = ['Desktop', 'Tablet', 'Mobile'];
const VIEWPORT_WIDTHS = { Desktop: '100%', Tablet: '768px', Mobile: '390px' };

export default function LivePreview({ template, css, fields }) {
    const [viewport, setViewport] = useState('Desktop');

    const scopedCss = css ? css.replace(/\.gk-block-wrapper/g, '.gutenkit-live-preview-wrapper') : '';
    const previewHtml = template
        ? processTemplateForPreview(template, fields)
        : null;

    return createElement('div', { className: 'gk-live-preview' },

        // Header row
        createElement('div', { className: 'gk-live-preview__header' },
            createElement('h3', { className: 'gk-live-preview__title' },
                createElement('span', { className: 'material-symbols-outlined' }, 'preview'),
                'Live Preview'
            ),
            createElement('div', { className: 'gk-viewport-toggle' },
                VIEWPORTS.map(v =>
                    createElement('button', {
                        key: v,
                        type: 'button',
                        className: 'gk-viewport-btn' + (viewport === v ? ' is-active' : ''),
                        onClick: () => setViewport(v),
                    }, v)
                )
            )
        ),

        // Canvas
        createElement('div', { className: 'gk-preview-canvas' },
            createElement('style', null, scopedCss),
            createElement('div', {
                className: 'gk-preview-canvas__inner',
                style: {
                    maxWidth: VIEWPORT_WIDTHS[viewport],
                    margin: '0 auto',
                    transition: 'max-width 0.25s ease',
                },
            },
                previewHtml
                    ? createElement('div', {
                        className: 'gutenkit-live-preview-wrapper',
                        dangerouslySetInnerHTML: { __html: previewHtml },
                    })
                    : createElement('p', { className: 'gk-preview-canvas__empty' },
                        'Preview will appear here once you add HTML above.'
                    )
            )
        )
    );
}
