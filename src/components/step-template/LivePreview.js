/**
 * LivePreview — renders processed template HTML with realistic sample data
 * and initialises block scripts (slider / accordion) inside the preview iframe.
 */
import { createElement, useState, useEffect, useRef } from '@wordpress/element';
import EmblaCarousel from 'embla-carousel';

// ── Placeholder image (SVG data URI) ─────────────────────────────────────────
const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='800' height='500' fill='%23e2e8f0'/%3E%3Cg fill='%2394a3b8'%3E%3Crect x='340' y='180' width='120' height='90' rx='6'/%3E%3Ccircle cx='375' cy='205' r='16'/%3E%3Cpolygon points='340,270 400,195 460,270'/%3E%3C/g%3E%3Ctext x='50%25' y='88%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='18' font-family='sans-serif'%3EImage Placeholder%3C/text%3E%3C/svg%3E";

// ── Varied sample data ────────────────────────────────────────────────────────
const SAMPLE_TITLES  = ['Discover Amazing Features', 'Transform Your Workflow', 'Build Something Great', 'Unlock New Possibilities'];
const SAMPLE_BODY    = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
];
const SAMPLE_NAMES   = ['Alex Johnson', 'Maria Garcia', 'James Chen', 'Sarah Williams'];
const SAMPLE_DATES   = ['Jan 15, 2024', 'Mar 8, 2024', 'Jul 22, 2024', 'Nov 3, 2024'];
const SAMPLE_NUMBERS = ['42', '128', '7', '256'];
const SAMPLE_COLORS  = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

function pick(arr, i) { return arr[i % arr.length]; }

function sampleValue(field, index = 0) {
    const label = field.label || field.key;
    const low   = label.toLowerCase();
    if (/name|author|person/i.test(low))       return pick(SAMPLE_NAMES, index);
    if (/date|time|when/i.test(low))           return pick(SAMPLE_DATES, index);
    if (/number|count|qty|price/i.test(low))   return pick(SAMPLE_NUMBERS, index);
    if (/desc|body|content|summary/i.test(low)) return pick(SAMPLE_BODY, index);
    if (/title|heading/i.test(low))            return pick(SAMPLE_TITLES, index);
    switch (field.type) {
        case 'text':          return pick(SAMPLE_TITLES, index);
        case 'number':        return pick(SAMPLE_NUMBERS, index);
        case 'range':         return String(25 + (index % 4) * 20);
        case 'url':           return '#';
        case 'textarea':      return pick(SAMPLE_BODY, index);
        case 'contentEditor': return '<p style="margin:0;line-height:1.6">' + pick(SAMPLE_BODY, index) + '</p>';
        case 'date':          return pick(SAMPLE_DATES, index);
        case 'datetime':      return pick(SAMPLE_DATES, index) + ' 9:00 AM';
        case 'time':          return '9:00 AM';
        case 'color':         return pick(SAMPLE_COLORS, index);
        case 'icon':          return '★';
        case 'relational':    return pick(SAMPLE_NAMES, index);
        case 'email':       return 'hello@example.com';
        case 'toggle':      return 'true';
        case 'gradient':    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        case 'select':
        case 'radio':       return (field.options && field.options[0]) ? field.options[0].value : 'option_1';
        case 'multiselect': return (field.options && field.options[0]) ? field.options[0].value : 'option_1';
        case 'link':        return '#';
        case 'spacing':     return '16px 24px 16px 24px';
        case 'dimension':   return '100%';
        case 'typography':  return 'font-family:Inter,sans-serif;font-size:16px;font-weight:400;line-height:1.5';
        default:              return pick(SAMPLE_TITLES, index);
    }
}

function replaceField(html, field, index) {
    const esc = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (field.type === 'image' || field.type === 'file') {
        html = html.replace(new RegExp('src=["\']\\{\\{\\s*' + esc + '\\s*\\}\\}["\']', 'gi'),
            'src="' + PLACEHOLDER + '" style="max-width:100%;display:block;"');
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_alt\\s*\\}\\}', 'g'),
            (field.label || field.key) + ' image');
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
            '<img src="' + PLACEHOLDER + '" alt="' + (field.label || field.key) + '" style="max-width:120px;height:80px;object-fit:cover;display:inline-block;vertical-align:middle;border-radius:4px;" />');
        return html;
    }
    if (field.type === 'button') {
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
            '<a href="#" class="bf-preview-btn">' + (field.label || 'Button') + '</a>');
        return html;
    }
    if (field.type === 'link') {
        const url   = '#';
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
            const val = p === 'unit' ? 'px' : (16 + i * 4) + 'px';
            html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_' + p + '\\s*\\}\\}', 'g'), val);
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
        const typoVals = { family: 'Inter, sans-serif', size: '16px', weight: '400', lineHeight: '1.5' };
        ['family','size','weight','lineHeight'].forEach(p => {
            html = html.replace(new RegExp('\\{\\{\\s*' + esc + '_' + p + '\\s*\\}\\}', 'g'), typoVals[p]);
        });
        html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
            'font-family:Inter,sans-serif;font-size:16px;font-weight:400;line-height:1.5');
        return html;
    }
    html = html.replace(new RegExp('\\{\\{\\s*' + esc + '\\s*\\}\\}', 'g'),
        sampleValue(field, index));
    return html;
}

function processInnerTemplate(inner, subFields, index) {
    let html = inner;
    subFields.forEach(sf => { html = replaceField(html, sf, index); });
    html = html.replace(/src=["']\{\{[^}]+\}\}["']/gi, 'src="' + PLACEHOLDER + '" style="max-width:100%;display:block;"');
    html = html.replace(/\{\{\s*url\s*\}\}/gi, PLACEHOLDER);
    html = html.replace(/\{\{\s*alt\s*\}\}/gi, 'Image ' + (index + 1));
    html = html.replace(/\{\{[^}]+\}\}/g, pick(SAMPLE_TITLES, index));
    return html;
}

export function processTemplateForPreview(htmlTemplate, fieldList) {
    if (!htmlTemplate) return htmlTemplate;
    let processed = htmlTemplate;

    // Pass 1: expand repeaters / galleries
    fieldList.forEach(field => {
        if (field.type !== 'repeater' && field.type !== 'gallery') return;
        const esc = field.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        processed = processed.replace(
            new RegExp('\\{\\{#(?:each\\s+)?' + esc + '\\}\\}([\\s\\S]*?)\\{\\{/(?:each|' + esc + ')\\}\\}', 'g'),
            (_, inner) => {
                let out = '';
                for (let i = 0; i < 2; i++) out += processInnerTemplate(inner, field.subFields || [], i);
                return out;
            }
        );
    });

    // Pass 2: replace remaining field tokens
    fieldList.forEach(field => {
        if (field.type === 'repeater' || field.type === 'gallery') return;
        processed = replaceField(processed, field, 0);
    });

    // Pass 3: strip any unresolved {{tokens}}
    processed = processed.replace(/\{\{[^}]+\}\}/g, '');

    return processed;
}

// ── Script initialiser (runs after each preview render) ──────────────────────

function usePreviewScript(wrapperRef, scripts, previewHtml) {
    const emblaRef = useRef(null);

    useEffect(() => {
        const root = wrapperRef.current;
        if (!root || !scripts || !scripts.type) return;

        // ── Slider (Embla Carousel) ──────────────────────────────────────────
        if (scripts.type === 'slider') {
            // Destroy previous instance before re-init
            if (emblaRef.current) {
                try { emblaRef.current.destroy(); } catch (_) {}
                emblaRef.current = null;
            }

            const viewport = root.querySelector('[data-embla-viewport]');
            if (!viewport) return;

            // Embla needs the track to have display:flex — inject minimal inline style
            const track = viewport.firstElementChild;
            if (track) track.style.display = 'flex';

            const opts = scripts.options || {};
            try {
                emblaRef.current = EmblaCarousel(viewport, {
                    loop:  !!opts.loop,
                    align: opts.align || 'start',
                });

                const prevBtn = root.querySelector('[data-embla-prev]');
                const nextBtn = root.querySelector('[data-embla-next]');
                prevBtn?.addEventListener('click', () => emblaRef.current?.scrollPrev());
                nextBtn?.addEventListener('click', () => emblaRef.current?.scrollNext());

                // Dot sync
                const dots = Array.from(root.querySelectorAll('[data-embla-dots] [data-embla-dot]'));
                if (dots.length) {
                    const syncDots = () => {
                        const active = emblaRef.current.selectedScrollSnap();
                        dots.forEach((dot, i) => dot.classList.toggle('is-active', i === active));
                    };
                    dots.forEach((dot, i) => dot.addEventListener('click', () => emblaRef.current?.scrollTo(i)));
                    emblaRef.current.on('select', syncDots);
                    syncDots();
                }
            } catch (e) {
                console.warn('[LivePreview] Embla init failed:', e);
            }

            return () => {
                if (emblaRef.current) {
                    try { emblaRef.current.destroy(); } catch (_) {}
                    emblaRef.current = null;
                }
            };
        }

        // ── Accordion ────────────────────────────────────────────────────────
        if (scripts.type === 'accordion') {
            const single = !!(scripts.options && scripts.options.single);

            const handleClick = (e) => {
                const btn = e.target.closest('[class*="accordion-trigger"], [class*="accordion__header"]');
                if (!btn || !root.contains(btn)) return;
                const panel  = btn.nextElementSibling;
                const isOpen = btn.getAttribute('aria-expanded') === 'true';
                if (single) {
                    root.querySelectorAll('[aria-expanded="true"]').forEach(other => {
                        if (other !== btn) {
                            other.setAttribute('aria-expanded', 'false');
                            const op = other.nextElementSibling;
                            if (op) op.style.maxHeight = '0';
                        }
                    });
                }
                btn.setAttribute('aria-expanded', String(!isOpen));
                if (panel) panel.style.maxHeight = isOpen ? '0' : panel.scrollHeight + 'px';
            };

            root.addEventListener('click', handleClick);
            return () => root.removeEventListener('click', handleClick);
        }

        // ── Custom / AJAX — no preview execution ─────────────────────────────
        // (nothing to init, badge shown in canvas overlay)

    }, [previewHtml, scripts && scripts.type, scripts && scripts.options]);
}

// ── Component ─────────────────────────────────────────────────────────────────

const VIEWPORTS = ['Desktop', 'Tablet', 'Mobile'];
const VIEWPORT_WIDTHS = { Desktop: '100%', Tablet: '768px', Mobile: '390px' };

const SCRIPT_BADGES = {
    slider:    { icon: 'view_carousel', label: 'Slider active',    color: 'var(--gk-primary)' },
    accordion: { icon: 'expand',        label: 'Accordion active', color: 'var(--gk-secondary)' },
    ajax:      { icon: 'cloud_sync',    label: 'AJAX — not run in preview', color: 'var(--gk-outline)' },
    custom:    { icon: 'integration_instructions', label: 'Custom JS — not run in preview', color: 'var(--gk-outline)' },
};

export default function LivePreview({ template, css, fields, scripts }) {
    const [viewport, setViewport]  = useState('Desktop');
    const wrapperRef               = useRef(null);

    const scopedCss   = css ? css.replace(/\.gk-block-wrapper/g, '.gutenkit-live-preview-wrapper') : '';
    const previewHtml = template ? processTemplateForPreview(template, fields) : null;

    usePreviewScript(wrapperRef, scripts, previewHtml);

    const badge = scripts && scripts.type ? SCRIPT_BADGES[scripts.type] : null;

    return createElement('div', { className: 'gk-live-preview' },

        createElement('div', { className: 'gk-live-preview__header' },
            createElement('h3', { className: 'gk-live-preview__title' },
                createElement('span', { className: 'material-symbols-outlined' }, 'preview'),
                'Live Preview'
            ),
            createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                // Script type badge
                badge && createElement('span', {
                    style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: badge.color,
                        background: 'rgba(0,0,0,.04)',
                        padding: '3px 10px',
                        borderRadius: '99px',
                        border: '1px solid ' + badge.color + '33',
                    },
                },
                    createElement('span', { className: 'material-symbols-outlined', style: { fontSize: '13px' } }, badge.icon),
                    badge.label
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
            )
        ),

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
                        ref: wrapperRef,
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
