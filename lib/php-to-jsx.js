/**
 * Converts PHP render code into JSX for the Editor preview
 */
function convertRenderPhpToJsx(phpContent) {
    let jsx = phpContent;

    const placeholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA4MDAgNjAwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2YxZjVmOSIgLz4KICA8ZyBmaWxsPSIjY2JkNWUxIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAsIDIyMCkiPgogICAgPHBhdGggZD0iTTM1LjIxNiAxMi43ODRDMzIuOTUxIDEwLjUxOSAzMC4yMDQgOS4zODMgMjcgOS4zODNzLTUuOTUyIDEuMTM2LTguMjE2IDMuNDAxQzE2LjUxOSAxNS4wNDkgMTUuMzgxIDE3Ljc5NiAxNS4zODEgMjFzMS4xMzYgNS45NTEgMy40IDguMjE2QzIxLjA0OSAzMS40ODEgMjMuNzk2IDMyLjYxOSAyNyAzMi42MTlzNS45NTEtMS4xMzYgOC4yMTYtMy40QzM3LjQ4MSAyNi45NTEgMzguNjE5IDI0LjIwNCAzOC42MTkgMjFzLTEuMTM2LTUuOTUxLTMuNC04LjIxNnoiIC8+CiAgICA8cGF0aCBkPSJNMTE1LjY1NCA4Ni4zOEw5Mi44MzIgNTQuNzAxYy0uODItMS4xMzQtMi4yNzItMS45Mi0zLjkwMi0xLjkyLTIuMDY0IDAtMy4yOTMgMS4xMDItMy45ODIgMi4wMjFsLTMxLjE2IDQyLjM2NC0yNS40NC0yOS40NzJhNC45MzUgNC45MzUgMCAwIDAtMy44ODQtMS43OWMtMS45NCAwLTMuNDkyIDEuMTgxLTQuMDU2IDIuMDVMNS4xODcgODUuNzc0di42NTljMCAxNy42NzIgMTQuMzI3IDMyIDMyIDMyaDEwMy40NTNjOC4yODQgMCAxNS4zNy0zLjE1NCAyMC4yMTQtOC42OTRMOTQuOTIgOTMuMjIxYzEuMDk2IDAgMi4xMzYtLjMxNiAzLjAyNS0uODg4Ljc4NC0uNTA1IDEuMzM1LTEuMjIxIDEuNTktMi4wNmwuNTc2LTIuMDFMMTE1LjY1NCA4Ni4zOEoiIC8+CiAgICA8cGF0aCBkPSJNMTQyLjEzMyA3Ljg2N0EyNi41NTYgMjYuNTU2IDAgMCAwIDEyMy4yNjcgMEgzMC43MzNDMTMuNzkyIDAgMCAxMy43OTIgMCAzMC43MzN2NzkuODE4bDkuODY3LTEzLjc2NmMxLjc4My0yLjQ5MyA0Ljc5OC00LjAxNiA3Ljk1LTQuMDE2czQuOTUgMS4xNTggNi43MTIgMy4xMjdMMzkuMjM2IDExNC4yeiIgLz4KICA8L2c+Cjwvc3ZnPg==';

    // 1. Remove the PHP header boilerplate (wrapper classes logic)
    jsx = jsx.replace(/<\?php[\s\S]*?\$wrapper_classes[\s\S]*?\?>/m, '');

    // 2. Handle Image / File URLs (with surrounding quotes: src="<?php echo... ?>")
    jsx = jsx.replace(/['"]<\?php echo esc_url\([^$]*?\$(attributes|item)\['(.*?)'\]\['url'\].*?\); \?>['"]/g,
        '{$1.$2?.url || "' + placeholder + '"}');

    // 3. Handle Image / File Alts (with surrounding quotes)
    jsx = jsx.replace(/['"]<\?php echo esc_attr\([^$]*?\$(attributes|item)\['(.*?)'\]\['alt'\].*?\); \?>['"]/g,
        '{$1.$2?.alt || $1.$2?.filename || ""}');

    // 4. Handle attributes wp_kses_post (e.g. alt="<?php echo wp_kses_post(...) ?>")
    jsx = jsx.replace(/['"]<\?php echo wp_kses_post\([^$]*?\$(attributes|item)\['(.*?)'\].*?\); \?>['"]/g,
        '{$1.$2}');

    // 5. Handle all other quoted values (e.g. href="<?php echo esc_url(...) ?>", class="<?php echo esc_attr(...) ?>")
    jsx = jsx.replace(/['"]<\?php echo (?:esc_html|esc_attr|esc_url)\([^$]*?\$(attributes|item)\['(.*?)'\].*?\); \?>['"]/g,
        '{$1.$2}');

    // 6. Handle ContentEditor / Textarea (wp_kses_post) as element children
    jsx = jsx.replace(/<\?php echo wp_kses_post\([^$]*?\$(attributes|item)\['(.*?)'\].*?\); \?>/g,
        '<span dangerouslySetInnerHTML={{ __html: $1.$2 }} />');

    // 7. Handle Simple Text / Number / Date / Time / Icon / Relational interpolations as children
    jsx = jsx.replace(/<\?php echo (?:esc_html|esc_attr|esc_url)\([^$]*?\$(attributes|item)\['(.*?)'\].*?\); \?>/g,
        '{$1.$2}');

    // 6. Handle Color / Inline styles loosely
    jsx = jsx.replace(/style=(?:'|")([-a-zA-Z]+):\s*\{([^}]+)\};?(?:'|")/g, (match, prop, val) => {
        const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        return `style={{ ${camelProp}: ${val} || "inherit" }}`;
    });

    // 7. Handle Button (Object with url and text)
    // Buttons are hard to parse perfectly if the markup changed. Fallback to simple matching if needed.
    jsx = jsx.replace(/<a href="<\?php echo esc_url\(\$attributes\['(.*?)'\]\['url'\].*?\); \?>".*?>\s*<\?php echo (?:esc_html|esc_attr)\(\$attributes\['.*?'\]\['text'\].*?\); \?>\s*<\/a>/g,
        '<a href={attributes.$1?.url || "#"} className="button">{attributes.$1?.text || "Click Here"}</a>');

    // 8. Handle Gallery (Array of objects)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\)[\s\S]*?foreach\(\$attributes\['.*?'\] as \$item\): [\s\S]*?src="<\?php echo esc_url\(\$img_url\); \?>"[\s\S]*?<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g,
        `{attributes.$1 && attributes.$1.map((img, index) => (
            <div key={index} className="gallery-item">
                <img src={img.url} alt={img.alt} style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
            </div>
        ))}`);

    // 9. Handle Relational (Post IDs)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\)[\s\S]*?foreach\(\$attributes\['.*?'\] as \$post_id\): [\s\S]*?<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g,
        `{attributes.$1 && <ul className="related-posts">
            {attributes.$1.map((id) => <li key={id}>Post ID: {id} (Preview title unavailable)</li>)}
        </ul>}`);

    // 10. Handle Repeater (Generic Loop)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\)[\s\S]*?foreach\(\$attributes\['.*?'\] as \$item\): \?>([\s\S]*?)<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g,
        `{attributes.$1 && attributes.$1.map((item, index) => (
            <div key={index} className="repeater-item-preview">
                $2
            </div>
        ))}`);

    // 11. Final Cleanup
    jsx = jsx.replace(/class=/g, 'className=');
    jsx = jsx.replace(/for=/g, 'htmlFor=');
    // Remove any remaining stray PHP tags just to be safe (MUST HAPPEN BEFORE VOID CLOSER)
    jsx = jsx.replace(/<\?php[\s\S]*?\?>/g, '');
    // Ensure common void elements are self-closed for JSX
    jsx = jsx.replace(/<(img|input|br|hr|link|meta)([^>]*?)(?<!\/)>/g, '<$1$2 />');

    return jsx.trim();
}

module.exports = convertRenderPhpToJsx;

module.exports = convertRenderPhpToJsx;