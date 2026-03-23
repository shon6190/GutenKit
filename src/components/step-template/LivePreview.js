/**
 * LivePreview — renders processed template HTML with placeholder badges.
 */
import { createElement } from '@wordpress/element';

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
            processed = processed.replace(
                new RegExp('src=["\']\\{\\{\\s*' + escapedKey + '\\s*\\}\\}["\']', 'gi'),
                'src="' + PREVIEW_PLACEHOLDER_SVG + '" style="max-width:100%;display:block;"'
            );
            processed = processed.replace(
                new RegExp('\\{\\{\\s*' + escapedKey + '_alt\\s*\\}\\}', 'g'),
                field.label + ' alt'
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
            '<span style="background:#e0e7ff;color:#3730a3;padding:1px 6px;border-radius:3px;font-size:11px;font-family:monospace;">' + (field.label || field.key) + '</span>'
        );
    });

    return processed;
}

const styles = {
    wrapper: { marginTop: '30px' },
    hint: { fontSize: '12px', color: '#666' },
    previewBox: {
        border: '1px solid #ddd',
        borderRadius: '4px',
        padding: '20px',
        minHeight: '200px',
        backgroundColor: '#fff',
        position: 'relative',
        overflow: 'hidden',
    },
    emptyHtml: '<p style="color:#aaa;text-align:center;font-style:italic;margin-top:80px;">Preview will appear here...</p>',
};

export default function LivePreview({ template, css, fields }) {
    const scopedCss = css ? css.replace(/\.gk-block-wrapper/g, '.gutenkit-live-preview-wrapper') : '';
    const previewHtml = template
        ? processTemplateForPreview(template, fields)
        : styles.emptyHtml;

    return createElement('div', { style: styles.wrapper },
        createElement('h3', null, 'Live Preview'),
        createElement('p', { style: styles.hint }, 'This is a rough preview of the generated HTML and CSS. Mustache tags are not evaluated here.'),
        createElement('div', { style: styles.previewBox },
            createElement('style', null, scopedCss),
            createElement('div', {
                className: 'gutenkit-live-preview-wrapper',
                dangerouslySetInnerHTML: { __html: previewHtml },
            })
        )
    );
}
