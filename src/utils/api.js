/**
 * Vanilla fetch wrappers replacing jQuery.post for AJAX calls.
 *
 * All endpoints hit admin-ajax.php. Nonces come from
 * window.blockFactoryEditor (editor app) or window.blockFactoryAdmin (admin page).
 */

/**
 * Post to admin-ajax.php with FormData (matches jQuery.post behaviour).
 *
 * @param {Object} params - Key/value pairs sent as form data.
 * @returns {Promise<Object>} Parsed JSON response.
 */
export function ajaxPost(params) {
    const body = new FormData();
    Object.entries(params).forEach(([key, value]) => {
        body.append(key, value);
    });

    return fetch(window.ajaxurl, {
        method: 'POST',
        credentials: 'same-origin',
        body,
    }).then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    });
}

/**
 * Save block structure (fields + template + css).
 */
export function saveStructure({ nonce, blockSlug, configData }) {
    return ajaxPost({
        action: 'block_factory_save_structure',
        nonce,
        block_slug: blockSlug,
        config_data: JSON.stringify(configData),
    });
}

/**
 * Trigger npm build via AJAX.
 */
export function runBuild({ nonce }) {
    return ajaxPost({
        action: 'bf_run_npm_build',
        nonce,
    });
}

/**
 * Generate AI template from prompt + fields.
 */
export function generateAITemplate({ nonce, prompt, fields }) {
    return ajaxPost({
        action: 'bf_generate_ai_template',
        nonce,
        prompt,
        fields: JSON.stringify(fields),
    });
}
