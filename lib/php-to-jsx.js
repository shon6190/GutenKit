/**
 * Converts PHP render code into JSX for the Editor preview
 */
function convertRenderPhpToJsx(phpContent) {
    let jsx = phpContent;

    // 1. Remove the PHP header boilerplate (wrapper classes logic)
    jsx = jsx.replace(/<\?php[\s\S]*?\$wrapper_classes[\s\S]*?\?>/m, '');

    // 2. Handle Simple Text / Number / Date / Time / Icon (esc_html)
    jsx = jsx.replace(/<\?php echo esc_html\(\$attributes\['(.*?)'\]\s*.*?\); \?>/g, '{attributes.$1}');

    // 3. Handle ContentEditor / Textarea (wp_kses_post)
    jsx = jsx.replace(/<\?php echo wp_kses_post\(\$attributes\['(.*?)'\]\s*.*?\); \?>/g, 
        '<div dangerouslySetInnerHTML={{ __html: attributes.$1 }} />');

    // 4. Handle Image / File (url and alt)
    jsx = jsx.replace(/<img src="<\?php echo esc_url\(\$attributes\['(.*?)'\]\['url'\]\); \?>" alt="<\?php echo esc_attr\(\$attributes\['.*?'\]\['alt'\]\s*.*?\); \?>" \/>/g, 
        '<img src={attributes.$1?.url} alt={attributes.$1?.alt || ""} style={{maxWidth: "100%", height: "auto"}} />');

    // 5. Handle Color (Inline styles)
    jsx = jsx.replace(/style="color:\s*<\?php echo esc_attr\(\$attributes\['(.*?)'\]\s*.*?\); \?>;"/g, 
        'style={{ color: attributes.$1 || "inherit" }}');

    // 6. Handle Button (Object with url and text)
    jsx = jsx.replace(/<a href="<\?php echo esc_url\(\$attributes\['(.*?)'\]\['url'\]\s*.*?\); \?>".*?>\s*<\?php echo esc_html\(\$attributes\['.*?'\]\['text'\]\s*.*?\); \?>\s*<\/a>/g, 
        '<a href={attributes.$1?.url || "#"} className="button">{attributes.$1?.text || "Click Here"}</a>');

    // 7. Handle Gallery (Array of objects)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\).*?foreach\(\$attributes\['.*?'\] as \$item\): [\s\S]*?src="<\?php echo esc_url\(\$img_url\); \?>"[\s\S]*?<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g, 
        `{attributes.$1 && attributes.$1.map((img, index) => (
            <div key={index} className="gallery-item">
                <img src={img.url} alt={img.alt} style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
            </div>
        ))}`);

    // 8. Handle Relational (Post IDs)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\).*?foreach\(\$attributes\['.*?'\] as \$post_id\): [\s\S]*?<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g, 
        `{attributes.$1 && <ul className="related-posts">
            {attributes.$1.map((id) => <li key={id}>Post ID: {id} (Preview title unavailable)</li>)}
        </ul>}`);

    // 9. Handle Repeater (Generic Loop)
    jsx = jsx.replace(/<\?php if\(!empty\(\$attributes\['(.*?)'\]\).*?foreach\(\$attributes\['.*?'\] as \$item\): \?>([\s\S]*?)<\?php endforeach; \?>[\s\S]*?<\?php endif; \?>/g, 
        `{attributes.$1 && attributes.$1.map((item, index) => (
            <div key={index} className="repeater-item">
                {/* Custom sub-field rendering required here */}
                Repeater Item #{index + 1}
            </div>
        ))}`);

    // 10. Final Cleanup
    jsx = jsx.replace(/class=/g, 'className=');
    jsx = jsx.replace(/<\?php[\s\S]*?\?>/g, '');

    return jsx.trim();
}

module.exports = convertRenderPhpToJsx;
