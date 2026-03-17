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

    // 2. Incremental Build Check
    // Include view.js and style.scss so they are regenerated when config changes
    const stylePath = path.join(blockPath, 'style.scss');
    const outputFiles = [templatePath, blockJsonPath, attributesOutputPath, stylePath];
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

            // Attributes
            generatedAttributes[field.key] = {
                type: map.attributeType,
                default: field.default || undefined,
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

    // 6b. Inject required base CSS for slider blocks into style.scss
    generateBaseStyleCss(blockPath, config);

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
