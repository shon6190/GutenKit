const fs = require('fs');
const path = require('path');
const glob = require('glob');

// --- Imports ---
const {
    BLOCKS_SRC_DIR,
    TEMPLATE_FILENAME,
    BLOCK_JSON_FILENAME,
    INJECTION_MARKER,
    SCRIPT_IMPORTS_MARKER,
    EDITOR_EFFECTS_MARKER,
    ATTRIBUTES_HOOK,
    ATTRIBUTES_HOOK_REGEX,
    FINAL_HOOK_REGEX,
    PACKAGE_MAP
} = require('./lib/constants');

const { FIELD_MAP, generateRepeaterInnerJSX } = require('./lib/fields');
const convertRenderPhpToJsx = require('./lib/php-to-jsx');

// ─────────────────────────────────────────────────────────────────────────────
// Field key validation
// ─────────────────────────────────────────────────────────────────────────────

const VALID_KEY = /^[a-z][a-z0-9_]*$/;

function validateFieldKeys(fields, blockPath) {
    for (const field of fields) {
        if (!VALID_KEY.test(field.key)) {
            throw new Error(`Invalid field key "${field.key}" in ${blockPath}. Keys must match /^[a-z][a-z0-9_]*$/`);
        }
        if (field.subFields) {
            for (const sub of field.subFields) {
                if (!VALID_KEY.test(sub.key)) {
                    throw new Error(`Invalid sub-field key "${sub.key}" in repeater "${field.key}" in ${blockPath}`);
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// render.php generation — ported from GutenKit_Generator::generate_render_php()
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNjAwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2YxZjVmOSIgLz4KICA8ZyBmaWxsPSIjY2JkNWUxIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAsIDIyMCkiPgogICAgPHBhdGggZD0iTTM1LjIxNiAxMi43ODRDMzIuOTUxIDEwLjUxOSAzMC4yMDQgOS4zODMgMjcgOS4zODNzLTUuOTUyIDEuMTM2LTguMjE2IDMuNDAxQzE2LjUxOSAxNS4wNDkgMTUuMzgxIDE3Ljc5NiAxNS4zODEgMjFzMS4xMzYgNS45NTEgMy40IDguMjE2QzIxLjA0OSAzMS40ODEgMjMuNzk2IDMyLjYxOSAyNyAzMi42MTlzNS45NTEtMS4xMzYgOC4yMTYtMy40QzM3LjQ4MSAyNi45NTEgMzguNjE5IDI0LjIwNCAzOC42MTkgMjFzLTEuMTM2LTUuOTUxLTMuNC04LjIxNnoiIC8+CiAgICA8cGF0aCBkPSJNMTE1LjY1NCA4Ni4zOEw5Mi44MzIgNTQuNzAxYy0uODItMS4xMzQtMi4yNzItMS45Mi0zLjkwMi0xLjkyLTIuMDY0IDAtMy4yOTMgMS4xMDItMy45ODIgMi4wMjFsLTMxLjE2IDQyLjM2NC0yNS40NC0yOS40NzJhNC45MzUgNC45MzUgMCAwIDAtMy44ODQtMS43OWMtMS45NCAwLTMuNDkyIDEuMTgxLTQuMDU2IDIuMDVMNS4xODcgODUuNzc0di42NTljMCAxNy42NzIgMTQuMzI3IDMyIDMyIDMyaDEwMy40NTNjOC4yODQgMCAxNS4zNy0zLjE1NCAyMC4yMTQtOC42OTRMOTQuOTIgOTMuMjIxYzEuMDk2IDAgMi4xMzYtLjMxNiAzLjAyNS0uODg4Ljc4NC0uNTA1IDEuMzM1LTEuMjIxIDEuNTktMi4wNmwuNTc2LTIuMDFMMTE1LjY1NCA4Ni4zOEoiIC8+CiAgICA8cGF0aCBkPSJNMTQyLjEzMyA3Ljg2N0EyNi41NTYgMjYuNTU2IDAgMCAwIDEyMy4yNjcgMEgzMC43MzNDMTMuNzkyIDAgMCAxMy43OTIgMCAzMC43MzN2NzkuODE4bDkuODY3LTEzLjc2NmMxLjc4My0yLjQ5MyA0Ljc5OC00LjAxNiA3Ljk1LTQuMDE2czQuOTUgMS4xNTggNi43MTIgMy4xMjdMMzkuMjM2IDExNC4yeiIgLz4KICA8L2c+Cjwvc3ZnPg==';

/**
 * Generates render.php for a block from its config.json template and fields.
 * Ported from PHP GutenKit_Generator::generate_render_php().
 *
 * @param {string} blockPath  Absolute path to the block source directory.
 * @param {string} blockSlug  Block slug (kebab-case).
 * @param {object} config     Parsed config.json contents.
 */
function generateRenderPhp(blockPath, blockSlug, config) {
    if (!config.template) {
        console.warn(`  ⚠️ No template in config for ${blockSlug}. Skipping render.php.`);
        return;
    }

    let template = config.template;
    const fields = config.fields || [];

    // Build field type lookup maps
    const repeaterFields = {};
    const galleryFields = {};
    const fieldTypeMap = {};

    for (const field of fields) {
        fieldTypeMap[field.key] = field.type;
        if (field.type === 'repeater') {
            repeaterFields[field.key] = field;
        }
        if (field.type === 'gallery') {
            galleryFields[field.key] = field;
        }
    }

    // --- 1. Pre-check: reject deprecated {{#key}}...{{/key}} syntax ---
    const deprecatedMatch = template.match(/\{\{#(?!each\s)(\w+)\}\}/);
    if (deprecatedMatch) {
        throw new Error(
            `Build error in ${blockSlug}: deprecated loop syntax {{#${deprecatedMatch[1]}}} detected. ` +
            `Use {{#each ${deprecatedMatch[1]}}}...{{/each}} instead.`
        );
    }

    // --- 2. Process repeater/gallery loops ---
    // Only {{#each key}}...{{/each}} syntax is supported.

    template = template.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, loopKey, inner) => {
        return processLoop(loopKey, inner, repeaterFields, galleryFields, '$item');
    });

    // --- 3. Handle top-level fields ---
    for (const field of fields) {
        const key = field.key;
        const type = field.type;

        // Skip repeater/gallery — already handled by loop processing
        if (type === 'repeater' || type === 'gallery') continue;

        let php = '';
        switch (type) {
            case 'image':
            case 'file':
                php = `<?php echo esc_url(!empty($attributes['${key}']['url']) ? $attributes['${key}']['url'] : '${PLACEHOLDER_IMAGE}'); ?>`;
                // Handle alt: {{key_alt}}
                const altPhp = `<?php echo esc_attr($attributes['${key}']['alt'] ?? $attributes['${key}']['filename'] ?? ''); ?>`;
                template = template.split(`{{${key}_alt}}`).join(altPhp);
                break;
            case 'number':
            case 'range':
            case 'relational':
                php = `<?php echo esc_html($attributes['${key}'] ?? ''); ?>`;
                break;
            case 'url':
                php = `<?php echo esc_url($attributes['${key}'] ?? ''); ?>`;
                break;
            case 'color':
            case 'date':
            case 'time':
            case 'datetime':
            case 'icon':
                php = `<?php echo esc_attr($attributes['${key}'] ?? ''); ?>`;
                break;
            case 'button':
                php = `<?php if ( ! empty( $attributes['${key}']['url'] ) ): ?>`
                    + `<a href="<?php echo esc_url( $attributes['${key}']['url'] ); ?>" class="gk-btn">`
                    + `<?php echo esc_html( $attributes['${key}']['text'] ?? 'Click Here' ); ?>`
                    + `</a><?php endif; ?>`;
                break;
            default:
                // text, textarea, contentEditor — safe check for array
                php = `<?php echo wp_kses_post(is_array($attributes['${key}'] ?? '') ? json_encode($attributes['${key}'] ?? '') : ($attributes['${key}'] ?? '')); ?>`;
                break;
        }

        // Replace all {{key}} occurrences
        template = template.split(`{{${key}}}`).join(php);
    }

    // --- 4. Wrap in PHP template ---
    let fileContent = `<?php\n/**\n * Render ${blockSlug}\n */\n`;
    fileContent += `try {\n`;
    fileContent += `    $wrapper_classes = 'bf-block-' . esc_attr('${blockSlug}');\n`;
    fileContent += `?>\n`;
    fileContent += `<div class="<?php echo $wrapper_classes; ?>">\n${template}\n</div>\n`;
    fileContent += `<?php\n`;
    fileContent += `} catch (\\Throwable $e) {\n`;
    fileContent += `    if (current_user_can('edit_posts')) {\n`;
    fileContent += `        echo '<div style="border: 2px dashed red; padding: 10px; color: red;">';\n`;
    fileContent += `        echo '<strong>Block Error (${blockSlug}):</strong> ' . esc_html($e->getMessage());\n`;
    fileContent += `        echo '</div>';\n`;
    fileContent += `    }\n`;
    fileContent += `}\n?>`;

    const renderPhpPath = path.join(blockPath, 'render.php');
    fs.writeFileSync(renderPhpPath, fileContent, 'utf8');
    console.log(` ✅ render.php generated for ${blockSlug}`);
}

/**
 * Processes a single loop (repeater or gallery) and returns the PHP output.
 *
 * @param {string} loopKey         The field key being looped.
 * @param {string} innerContent    The template content inside the loop tags.
 * @param {object} repeaterFields  Map of repeater field keys to field definitions.
 * @param {object} galleryFields   Map of gallery field keys to field definitions.
 * @param {string} itemVar         PHP variable name for the loop item (e.g. '$item').
 * @returns {string} PHP code for the loop.
 */
function processLoop(loopKey, innerContent, repeaterFields, galleryFields, itemVar) {
    const isRepeater = loopKey in repeaterFields;
    const isGallery = loopKey in galleryFields;

    if (!isRepeater && !isGallery) {
        // Not a known repeater/gallery — leave as-is
        return `{{#each ${loopKey}}}${innerContent}{{/each}}`;
    }

    if (isGallery) {
        // Gallery loop: item is {id, url, alt}
        innerContent = innerContent.split('{{url}}').join(`<?php echo esc_url(${itemVar}['url'] ?? ''); ?>`);
        innerContent = innerContent.split('{{alt}}').join(`<?php echo esc_attr(${itemVar}['alt'] ?? ''); ?>`);
        innerContent = innerContent.split('{{id}}').join(`<?php echo esc_attr(${itemVar}['id'] ?? ''); ?>`);

        const loopStart = `<?php if(!empty($attributes['${loopKey}']) && is_array($attributes['${loopKey}'])): ?>\n`
            + `<?php foreach($attributes['${loopKey}'] as ${itemVar}): ?>`;
        const loopEnd = `<?php endforeach; ?>\n<?php endif; ?>`;
        return loopStart + innerContent + loopEnd;
    }

    // Repeater loop
    const subFields = repeaterFields[loopKey].subFields || [];

    for (const sub of subFields) {
        const sKey = sub.key;
        const sType = sub.type;
        let phpReplacement = '';

        switch (sType) {
            case 'image':
            case 'file':
                phpReplacement = `<?php echo esc_url(!empty(${itemVar}['${sKey}']['url']) ? ${itemVar}['${sKey}']['url'] : '${PLACEHOLDER_IMAGE}'); ?>`;
                // Handle Alt: {{key_alt}}
                const altReplacement = `<?php echo esc_attr(${itemVar}['${sKey}']['alt'] ?? ${itemVar}['${sKey}']['filename'] ?? ''); ?>`;
                innerContent = innerContent.replace(new RegExp(`\\{\\{\\s*${escapeRegex(sKey + '_alt')}\\s*\\}\\}`, 'g'), altReplacement);
                break;
            case 'number':
            case 'range':
            case 'relational':
                phpReplacement = `<?php echo esc_html(${itemVar}['${sKey}'] ?? ''); ?>`;
                break;
            case 'url':
                phpReplacement = `<?php echo esc_url(${itemVar}['${sKey}'] ?? ''); ?>`;
                break;
            case 'color':
            case 'date':
            case 'time':
            case 'datetime':
            case 'icon':
                phpReplacement = `<?php echo esc_attr(${itemVar}['${sKey}'] ?? ''); ?>`;
                break;
            case 'gallery':
                // Nested gallery loop inside repeater
                // Only {{#each gallery_key}}...{{/each}} syntax is supported.
                innerContent = innerContent.replace(
                    new RegExp(`\\{\\{#each\\s+${escapeRegex(sKey)}\\}\\}([\\s\\S]*?)\\{\\{\\/each\\}\\}`, 'g'),
                    (gMatch, gInner) => processNestedGallery(sKey, gInner, itemVar)
                );
                // Fallback for direct {{gallery_key}} access
                phpReplacement = `<?php echo (is_array(${itemVar}['${sKey}'] ?? '') ? count(${itemVar}['${sKey}'] ?? []) . ' images' : ''); ?>`;
                break;
            default:
                // text, textarea, contentEditor
                phpReplacement = `<?php echo wp_kses_post(is_array(${itemVar}['${sKey}'] ?? '') ? json_encode(${itemVar}['${sKey}'] ?? '') : (${itemVar}['${sKey}'] ?? '')); ?>`;
                break;
        }

        // Replace {{subkey}} with PHP code
        innerContent = innerContent.replace(new RegExp(`\\{\\{\\s*${escapeRegex(sKey)}\\s*\\}\\}`, 'g'), phpReplacement);
    }

    const loopStart = `<?php if(!empty($attributes['${loopKey}']) && is_array($attributes['${loopKey}'])): ?>\n`
        + `<?php foreach($attributes['${loopKey}'] as ${itemVar}): ?>`;
    const loopEnd = `<?php endforeach; ?>\n<?php endif; ?>`;
    return loopStart + innerContent + loopEnd;
}

/**
 * Processes a nested gallery loop inside a repeater.
 */
function processNestedGallery(sKey, gInner, parentItemVar) {
    gInner = gInner.split('{{url}}').join("<?php echo esc_url($gItem['url'] ?? ''); ?>");
    gInner = gInner.split('{{alt}}').join("<?php echo esc_attr($gItem['alt'] ?? ''); ?>");
    gInner = gInner.split('{{id}}').join("<?php echo esc_attr($gItem['id'] ?? ''); ?>");
    return `<?php if(!empty(${parentItemVar}['${sKey}']) && is_array(${parentItemVar}['${sKey}'])): foreach(${parentItemVar}['${sKey}'] as $gItem): ?>${gInner}<?php endforeach; endif; ?>`;
}

/**
 * Escapes a string for use in a RegExp.
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// Script helpers — one entry per supported type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the static import line(s) needed at the top of edit.js for a given
 * script type (empty string when no library import is required).
 */
function getScriptImport(scripts) {
    if (!scripts || !scripts.type) return '';
    switch (scripts.type) {
        case 'slider':
            return "import EmblaCarousel from 'embla-carousel';";
        default:
            return '';
    }
}

/**
 * Returns the useEffect body to inject into the Edit component for the
 * Gutenberg canvas preview (backend).  Empty string = no effect.
 */
function generateEditorEffect(scripts) {
    if (!scripts || !scripts.type) return '';

    const opts = scripts.options || {};

    switch (scripts.type) {
        case 'slider': {
            const emblaOpts = JSON.stringify({ loop: !!opts.loop, align: opts.align || 'start' });
            return `
	useEffect( () => {
		if ( ! canvasRef.current ) return;
		const viewport = canvasRef.current.querySelector( '[data-embla-viewport]' );
		if ( ! viewport ) return;

		const embla = EmblaCarousel( viewport, ${emblaOpts} );

		const prevBtn = canvasRef.current.querySelector( '[data-embla-prev]' );
		const nextBtn = canvasRef.current.querySelector( '[data-embla-next]' );
		prevBtn?.addEventListener( 'click', () => embla.scrollPrev() );
		nextBtn?.addEventListener( 'click', () => embla.scrollNext() );

		const dots = Array.from( canvasRef.current.querySelectorAll( '[data-embla-dots] [data-embla-dot]' ) );
		const syncDots = () => {
			const active = embla.selectedScrollSnap();
			dots.forEach( ( dot, i ) => dot.classList.toggle( 'is-active', i === active ) );
		};
		dots.forEach( ( dot, i ) => dot.addEventListener( 'click', () => embla.scrollTo( i ) ) );
		embla.on( 'select', syncDots );
		syncDots();

		return () => embla.destroy();
	}, [ attributes ] );`;
        }

        case 'accordion': {
            const trigger = `${rootSel} [class*="accordion-trigger"], ${rootSel} [class*="accordion__header"]`;
            return `
	useEffect( () => {
		if ( ! canvasRef.current ) return;
		canvasRef.current.querySelectorAll( '[class*="accordion-trigger"], [class*="accordion__header"]' ).forEach( ( btn ) => {
			btn.addEventListener( 'click', () => {
				const panel = btn.nextElementSibling;
				const isOpen = btn.getAttribute( 'aria-expanded' ) === 'true';
				btn.setAttribute( 'aria-expanded', String( ! isOpen ) );
				if ( panel ) panel.style.maxHeight = isOpen ? '0' : panel.scrollHeight + 'px';
			} );
		} );
	}, [ attributes ] );`;
        }

        // AJAX and Custom JS don't need an editor-side effect
        default:
            return '';
    }
}

/**
 * Generates and writes view.js for the given block if config.scripts is set.
 * This file is the frontend-only script compiled by webpack via viewScript.
 */
function generateViewJs(blockSlug, scripts) {
    if (!scripts || !scripts.type) return;

    // Root selector: render.php ALWAYS wraps with bf-block-{slug} — derive from slug, never user input
    const rootSel    = `.bf-block-${blockSlug}`;
    const opts       = scripts.options || {};
    const viewJsPath = path.join(BLOCKS_SRC_DIR, blockSlug, 'view.js');

    let content = '';

    switch (scripts.type) {

        case 'slider': {
            const emblaOpts = JSON.stringify({ loop: !!opts.loop, align: opts.align || 'start' });
            content = `/**
 * ${blockSlug} — frontend view script (auto-generated from config.scripts)
 * Initialises Embla Carousel on every instance of this block on the page.
 * Requires the template to use data-embla-* attributes (see generator-form.php).
 */
import EmblaCarousel from 'embla-carousel';

document.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '${rootSel}' ).forEach( ( sliderRoot ) => {
		const viewport = sliderRoot.querySelector( '[data-embla-viewport]' );
		if ( ! viewport ) return;

		const embla = EmblaCarousel( viewport, ${emblaOpts} );

		// Prev / Next buttons — use data-embla-prev / data-embla-next in your template
		const prevBtn = sliderRoot.querySelector( '[data-embla-prev]' );
		const nextBtn = sliderRoot.querySelector( '[data-embla-next]' );
		prevBtn?.addEventListener( 'click', () => embla.scrollPrev() );
		nextBtn?.addEventListener( 'click', () => embla.scrollNext() );

		// Dot indicators — wrap in data-embla-dots, each dot gets data-embla-dot
		const dots = Array.from( sliderRoot.querySelectorAll( '[data-embla-dots] [data-embla-dot]' ) );
		const syncDots = () => {
			const active = embla.selectedScrollSnap();
			dots.forEach( ( dot, i ) => dot.classList.toggle( 'is-active', i === active ) );
		};
		dots.forEach( ( dot, i ) => dot.addEventListener( 'click', () => embla.scrollTo( i ) ) );
		embla.on( 'select', syncDots );
		syncDots();
	} );
} );
`;
            break;
        }

        case 'accordion': {
            const single = !!(opts.single);
            content = `/**
 * ${blockSlug} — frontend view script (auto-generated from config.scripts)
 */
document.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.bf-block-${blockSlug}' ).forEach( ( root ) => {
		root.querySelectorAll( '[class*="accordion-trigger"], [class*="accordion__header"]' ).forEach( ( btn ) => {
			btn.addEventListener( 'click', () => {
				const panel   = btn.nextElementSibling;
				const isOpen  = btn.getAttribute( 'aria-expanded' ) === 'true';
${single ? `
				// Close all other items first
				root.querySelectorAll( '[aria-expanded="true"]' ).forEach( ( other ) => {
					if ( other !== btn ) {
						other.setAttribute( 'aria-expanded', 'false' );
						const otherPanel = other.nextElementSibling;
						if ( otherPanel ) otherPanel.style.maxHeight = '0';
					}
				} );` : ''}
				btn.setAttribute( 'aria-expanded', String( ! isOpen ) );
				if ( panel ) panel.style.maxHeight = isOpen ? '0' : panel.scrollHeight + 'px';
			} );
		} );
	} );
} );
`;
            break;
        }

        case 'ajax': {
            const action = scripts.action || '';
            content = `/**
 * ${blockSlug} — frontend view script (auto-generated from config.scripts)
 */
document.addEventListener( 'DOMContentLoaded', () => {
	document.querySelectorAll( '.bf-block-${blockSlug} [data-ajax-trigger]' ).forEach( ( el ) => {
		el.addEventListener( 'click', async () => {
			const endpoint = ( window.wpApiSettings?.root || '/wp-json/' ) + '${action}';
			const nonce    = window.wpApiSettings?.nonce || '';
			try {
				const res  = await fetch( endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
					body: JSON.stringify( { ...el.dataset } ),
				} );
				const data = await res.json();
				el.closest( '${rootSel}' )?.dispatchEvent(
					new CustomEvent( 'gk:ajax-response', { detail: data, bubbles: true } )
				);
			} catch ( err ) {
				console.error( 'AJAX error in ${blockSlug}:', err );
			}
		} );
	} );
} );
`;
            break;
        }

        case 'custom': {
            const code = (scripts.code || '// Custom JS goes here').trim();
            content = `/**
 * ${blockSlug} — frontend view script (auto-generated from config.scripts)
 */
document.addEventListener( 'DOMContentLoaded', () => {
${code.split('\n').map( l => '\t' + l ).join('\n')}
} );
`;
            break;
        }

        default:
            return;
    }

    fs.writeFileSync(viewJsPath, content, 'utf8');
    console.log(` ✅ view.js generated for ${blockSlug} (type: ${scripts.type})`);
}

const EMBLA_CSS_START = '/* [embla-base:start] */';
const EMBLA_CSS_END   = '/* [embla-base:end] */';

/**
 * Returns the required base CSS for a given script type using data-attribute
 * selectors — works regardless of user class names.
 */
function getScriptBaseCss(scripts) {
    if (!scripts || !scripts.type) return '';
    switch (scripts.type) {
        case 'slider':
            return `${EMBLA_CSS_START}
/* Embla Carousel required base styles — do not edit this block */
[data-embla-viewport] { overflow: hidden; }
[data-embla-viewport] > * { display: flex; touch-action: pan-y pinch-zoom; }
[data-embla-viewport] > * > * { flex: 0 0 100%; min-width: 0; }
${EMBLA_CSS_END}
`;
        default:
            return '';
    }
}

/**
 * Prepends (or replaces) the required script base CSS in the block's style.scss.
 */
function generateBaseStyleCss(blockPath, config) {
    const baseCss   = getScriptBaseCss(config.scripts || null);
    const stylePath = path.join(blockPath, 'style.scss');
    const existing  = fs.existsSync(stylePath) ? fs.readFileSync(stylePath, 'utf8') : (config.css || '');

    // Strip any previously injected base block
    const startIdx = existing.indexOf(EMBLA_CSS_START);
    const endIdx   = existing.indexOf(EMBLA_CSS_END);
    const userCss  = (startIdx !== -1 && endIdx !== -1)
        ? (existing.slice(0, startIdx) + existing.slice(endIdx + EMBLA_CSS_END.length + 1)).trimStart()
        : existing;

    const final = baseCss ? baseCss + '\n' + userCss : userCss;
    fs.writeFileSync(stylePath, final, 'utf8');

    if (baseCss) {
        console.log(` ✅ Embla base CSS injected into style.scss for ${path.basename(blockPath)}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Generation Logic for a single block
// ─────────────────────────────────────────────────────────────────────────────
function generateBlock(blockPath) {
    const blockSlug = path.basename(blockPath);
    const configPath = path.join(blockPath, 'config.json');
    const templatePath = path.join(blockPath, TEMPLATE_FILENAME);
    const attributesOutputPath = path.join(blockPath, 'attributes.json');
    const blockJsonPath = path.join(blockPath, BLOCK_JSON_FILENAME);
    const renderPhpPath = path.join(blockPath, 'render.php');
    const viewJsPath = path.join(blockPath, 'view.js');
    console.log(`Processing block: ${blockSlug}`);

    // 1. Read config.json
    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
        console.error(`  ❌ Error reading or parsing config.json for ${blockSlug}:`, error.message);
        return;
    }

    if (!config || !config.fields) {
        console.warn(`  ⚠️ Config file for ${blockSlug} is missing "fields" array. Skipping.`);
        return;
    }

    // 1b. Validate field keys
    validateFieldKeys(config.fields, blockPath);

    // 2. Incremental Build Check
    // Include view.js and style.scss so they are regenerated when config changes
    const stylePath = path.join(blockPath, 'style.scss');
    const outputFiles = [templatePath, blockJsonPath, attributesOutputPath, stylePath, renderPhpPath];
    if (config.scripts) outputFiles.push(viewJsPath);

    if (outputFiles.every(f => fs.existsSync(f))) {
        const configMtime = fs.statSync(configPath).mtime;
        const allNewer = outputFiles.every(f => fs.statSync(f).mtime > configMtime);
        if (allNewer) {
            console.log(`  ⏩ Skipping ${blockSlug} (Up to date).`);
            return;
        }
    }

    // 3. Prepare Imports, JSX, and Attributes
    let componentsImports = new Set();
    let blockEditorImports = new Set();
    let generatedJSX = '';
    let generatedAttributes = {};

    // Defaults
    blockEditorImports.add('useBlockProps');
    blockEditorImports.add('InspectorControls');
    blockEditorImports.add('RichText');
    componentsImports.add('PanelBody');

    config.fields.forEach(field => {
        const map = FIELD_MAP[field.type];
        if (map) {
            // Add imports
            map.imports.forEach(componentName => {
                const packageKey = PACKAGE_MAP[componentName];
                if (packageKey === 'BLOCK_EDITOR') blockEditorImports.add(componentName);
                else if (packageKey === 'COMPONENTS') componentsImports.add(componentName);
            });

            // Special handling for MediaUpload helpers
            if (['image', 'file', 'gallery'].includes(field.type)) {
                blockEditorImports.add('MediaUpload');
                blockEditorImports.add('MediaUploadCheck');
            }

            // Generate field JSX
            let fieldJSX = map.jsx(field.key, field.label);

            // Handle Repeater
            if (field.type === 'repeater') {
                const subFields = field.subFields || [];
                if (subFields.length > 0) {
                    const innerJSX = generateRepeaterInnerJSX(subFields, field.key, componentsImports, blockEditorImports);
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__', innerJSX);
                    field.default = field.default || [];
                } else {
                    fieldJSX = fieldJSX.replace('__REPEATER_INNER_JSX_HOOK__',
                        `<p style={{color: 'red'}}>Please define sub-fields in the Block Editor structure.</p>`);
                }
            }

            generatedJSX += fieldJSX + '\n';

            // Attributes — object types default to null so WordPress doesn't store undefined
            generatedAttributes[field.key] = {
                type: map.attributeType,
                default: map.attributeType === 'object' ? null : (field.default || undefined),
            };

            if (field.type === 'contentEditor') {
                generatedAttributes[`is_html_mode_${field.key}`] = { type: 'boolean', default: false };
            }

        } else {
            console.warn(` ⚠️ Unknown field type '${field.type}'. Skipping.`);
        }
    });

    // Clean imports
    componentsImports.delete('RichText');
    componentsImports.delete('useBlockProps');
    componentsImports.delete('InspectorControls');

    const blockEditorImportStatement = `import { ${Array.from(blockEditorImports).join(', ')} } from '@wordpress/block-editor';`;
    const componentsImportStatement = `import { ${Array.from(componentsImports).join(', ')} } from '@wordpress/components';`;

    // 4. Save Attributes
    fs.writeFileSync(attributesOutputPath, JSON.stringify(generatedAttributes, null, 4), 'utf8');
    console.log(` ✅ Attributes saved to ${attributesOutputPath}.`);

    // 5. Inject Attributes into block.json
    try {
        let blockJsonContent = fs.readFileSync(blockJsonPath, 'utf8');

        let injectionAttributes = {};
        const reservedAttributes = ['message'];
        Object.keys(generatedAttributes).forEach(key => {
            if (!reservedAttributes.includes(key)) {
                injectionAttributes[key] = generatedAttributes[key];
            }
        });

        let newAttributesJsonString = '';
        let newAttributesJsonStringNoComma = '';
        if (Object.keys(injectionAttributes).length > 0) {
            const attrString = JSON.stringify(injectionAttributes, null, 4).slice(1, -1).trim();
            newAttributesJsonString      = ',\n' + attrString;  // used when hook follows a preceding attribute
            newAttributesJsonStringNoComma = '\n    ' + attrString; // used when hook is the only attribute
        }

        let finalBlockJsonContent;
        if (blockJsonContent.match(FINAL_HOOK_REGEX)) {
            finalBlockJsonContent = blockJsonContent.replace(FINAL_HOOK_REGEX, newAttributesJsonString);
        } else {
            finalBlockJsonContent = blockJsonContent.replace(ATTRIBUTES_HOOK, newAttributesJsonString);
        }

        // Fix stray leading comma inside "attributes": { , ... } that appears when the
        // hook was the only entry (FINAL_HOOK_REGEX can match a comma from an outer property)
        finalBlockJsonContent = finalBlockJsonContent.replace(/"attributes"\s*:\s*\{\s*,/g, '"attributes": {');
        finalBlockJsonContent = finalBlockJsonContent.replace(/,\s*,/g, ',').replace(/},\s*,/g, '},');

        fs.writeFileSync(blockJsonPath, finalBlockJsonContent, 'utf8');
        console.log(` ✅ Dynamic attributes injected and saved to ${blockJsonPath}.`);
    } catch (error) {
        console.error(` ❌ Error writing block.json code for ${blockSlug}:`, error.message);
    }

    // 6. Generate view.js (frontend) from config.scripts — before edit.js so webpack picks it up
    generateViewJs(blockSlug, config.scripts || null);

    // 6a. Remove "viewScript" from block.json if no view.js was generated
    if (!fs.existsSync(viewJsPath)) {
        try {
            let blockJsonStr = fs.readFileSync(blockJsonPath, 'utf8');
            blockJsonStr = blockJsonStr.replace(/,?\s*"viewScript"\s*:\s*"[^"]*"/g, '');
            blockJsonStr = blockJsonStr.replace(/,\s*,/g, ',').replace(/,(\s*})/g, '$1');
            fs.writeFileSync(blockJsonPath, blockJsonStr, 'utf8');
        } catch (e) {
            console.warn(`  ⚠️ Could not remove viewScript from block.json: ${e.message}`);
        }
    }

    // 6b. Inject required base CSS for slider blocks into style.scss
    generateBaseStyleCss(blockPath, config);

    // 6c. Generate render.php from config template
    generateRenderPhp(blockPath, blockSlug, config);

    // 7. Generate Edit.js
    try {
        const tplPath = path.join(__dirname, 'templates/edit.js.tpl');
        let templateContent = fs.readFileSync(tplPath, 'utf8');

        // Canvas preview from render.php
        let canvasPreviewJsx = '<p>No preview template found.</p>';
        if (fs.existsSync(renderPhpPath)) {
            const phpContent = fs.readFileSync(renderPhpPath, 'utf8');
            canvasPreviewJsx = convertRenderPhpToJsx(phpContent);
        }

        // Script injection — library import + editor useEffect
        const scriptImport  = getScriptImport(config.scripts || null);
        const editorEffect  = generateEditorEffect(config.scripts || null);

        const blockEditorImportRegex = /import\s*{[^}]+}\s*from\s*'@wordpress\/block-editor';/;
        const componentsImportRegex  = /import\s*{[^}]+}\s*from\s*'@wordpress\/components';/;

        let finalCode = templateContent
            .replace(blockEditorImportRegex, blockEditorImportStatement)
            .replace(componentsImportRegex, componentsImportStatement)
            .replace(SCRIPT_IMPORTS_MARKER, scriptImport)
            .replace(EDITOR_EFFECTS_MARKER, editorEffect)
            .replace(INJECTION_MARKER, generatedJSX)
            .replace('// __INJECT_CANVAS_PREVIEW__', canvasPreviewJsx);

        fs.writeFileSync(templatePath, finalCode, 'utf8');
        console.log(` ✅ Generated code saved back to ${templatePath}.`);
    } catch (error) {
        console.error(` ❌ Error writing edit.js code for ${blockSlug}:`, error.message);
    }
}

// --- Main Execution ---
function generateAllBlocks() {
    console.log('--- Starting Multi-Block Code Generation ---');
    const blockDirectories = glob.sync(`${BLOCKS_SRC_DIR.replace(/\\/g, '/')}/*/`);
    if (blockDirectories.length === 0) {
        console.log('No block directories found in blocks/. Nothing to generate.');
        return;
    }
    blockDirectories.forEach(generateBlock);
    console.log('--- Block Code Generation Complete ---');
}

generateAllBlocks();
