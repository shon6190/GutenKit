<?php
/**
 * AI Template Generator
 * Handles all AI integration, Settings, and AJAX logic.
 *
 * @package GutenKit
 */

if (!defined('ABSPATH')) {
    exit;
}

class GutenKit_AI
{
    public function __construct()
    {
        // Settings page - priority 20 to run after the primary menu is registered
        add_action('admin_menu', array($this, 'add_ai_settings_page'), 20);
        add_action('admin_init', array($this, 'register_ai_settings'));

        // AJAX Action for AI Generation
        add_action('wp_ajax_bf_generate_ai_template', array($this, 'generate_ai_template'));
    }

    public function add_ai_settings_page()
    {
        add_submenu_page(
            'block-factory', // This must match the main menu slug created in GutenKit_Admin (which is 'block-factory')
            'AI Settings',
            'AI Settings',
            'manage_options',
            'gutenkit-ai-settings',
            array($this, 'render_settings_page')
        );
    }

    public function register_ai_settings()
    {
        register_setting('gutenkit_ai_settings_group', 'gutenkit_openai_api_key');
        register_setting('gutenkit_ai_settings_group', 'gutenkit_gemini_api_key');
    }

    public function render_settings_page()
    {
        ?>
        <div class="wrap">
            <h1>GutenKit AI Settings</h1>
            <p>Enter your API keys below to enable the AI Template Generator.</p>

            <form method="post" action="options.php">
                <?php settings_fields('gutenkit_ai_settings_group'); ?>
                <?php do_settings_sections('gutenkit_ai_settings_group'); ?>

                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">OpenAI API Key</th>
                        <td>
                            <input type="password" name="gutenkit_openai_api_key"
                                value="<?php echo esc_attr(get_option('gutenkit_openai_api_key')); ?>"
                                style="width:100%; max-width:400px;" />
                            <p class="description">Get your key from the <a href="https://platform.openai.com/api-keys"
                                    target="_blank">OpenAI Dashboard</a>.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Google Gemini API Key</th>
                        <td>
                            <input type="password" name="gutenkit_gemini_api_key"
                                value="<?php echo esc_attr(get_option('gutenkit_gemini_api_key')); ?>"
                                style="width:100%; max-width:400px;" />
                            <p class="description">Get your key from <a href="https://aistudio.google.com/app/apikey"
                                    target="_blank">Google AI Studio</a>.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save API Keys'); ?>
            </form>

            <hr>
            <h2>✨ Free Tier Available</h2>
            <p>Don't want to pay for API usage while building blocks? <strong>Google Gemini offers a generous Free
                    Tier</strong>!</p>
            <p>By creating a free API key in Google AI Studio, you get access to the Gemini 1.5/2.0 Flash models with rate
                limits of approximately <strong>15 requests per minute</strong> completely free of charge. This is usually more
                than enough for building custom blocks!</p>

        </div>
        <?php
    }

    public function generate_ai_template()
    {
        // 1. Validate Nonce
        check_ajax_referer('block_factory_save_structure_action', 'nonce');

        // 2. Check Permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => 'Unauthorized access.'));
        }

        // 3. Get Data
        $prompt = isset($_POST['prompt']) ? sanitize_text_field($_POST['prompt']) : '';
        $fields_json = isset($_POST['fields']) ? wp_unslash($_POST['fields']) : '[]';
        $fields = json_decode($fields_json, true);

        if (empty($prompt)) {
            wp_send_json_error(array('message' => 'Prompt cannot be empty.'));
        }

        // 4. API Key Resolution
        $openai_key = get_option('gutenkit_openai_api_key');
        $gemini_key = get_option('gutenkit_gemini_api_key');

        $provider = '';
        $api_key = '';

        if (!empty($openai_key)) {
            $provider = 'openai';
            $api_key = $openai_key;
        } elseif (!empty($gemini_key)) {
            $provider = 'gemini';
            $api_key = $gemini_key;
        } else {
            wp_send_json_error(array('message' => 'To use the AI Template Generator, please enter your free OpenAI or Gemini API Key in the GutenKit Settings.'));
        }

        // 5. Build System Prompt
        $system_message = "You are an expert web developer building a Gutenberg block. The user has defined the following fields:\n" . json_encode($fields) . "\n\n";
        $system_message .= "Task: Create the HTML and Vanilla CSS based on the user's prompt.\n";
        $system_message .= "Rules:\n";
        $system_message .= "1. Return ONLY a valid JSON object with exactly two keys: 'html' and 'css'. No markdown wrapping like ```json.\n";
        $system_message .= "2. In the HTML, use the field 'key' surrounded by double curly braces for dynamic data. Example: {{title_field}} or {{image_field}}.\n";
        $system_message .= "3. For repeaters, use a pseudo {{#each repeater_key}} ... {{/each}} syntax.\n";
        $system_message .= "4. Output clean, modern HTML and CSS (use flexbox/grid layout).\n";
        $system_message .= "5. Wrap the main HTML in a div with a unique class (e.g. .gk-block-wrapper) and namespace the CSS to that class so it doesn't affect the rest of the site.\n";

        // 6. Call the appropriate API
        if ($provider === 'openai') {
            $result = $this->call_openai($api_key, $system_message, $prompt);
        } elseif ($provider === 'gemini') {
            $result = $this->call_gemini($api_key, $system_message, $prompt);
        }

        if (is_wp_error($result)) {
            wp_send_json_error(array('message' => $result->get_error_message()));
        }

        // 7. Parse Result
        $json_response = json_decode($result, true);

        if (json_last_error() === JSON_ERROR_NONE && isset($json_response['html']) && isset($json_response['css'])) {
            wp_send_json_success(array(
                'html' => $json_response['html'],
                'css' => $json_response['css']
            ));
        } else {
            // Sometimes the AI returns markdown like ```json ... ```, try to strip it
            $cleaned_result = preg_replace('/```json|```/', '', $result);
            $json_response = json_decode(trim($cleaned_result), true);

            if (json_last_error() === JSON_ERROR_NONE && isset($json_response['html']) && isset($json_response['css'])) {
                wp_send_json_success(array(
                    'html' => $json_response['html'],
                    'css' => $json_response['css']
                ));
            }

            wp_send_json_error(array('message' => 'The AI response was not formatted correctly. Please try again.', 'debug' => $result));
        }
    }

    private function call_openai($api_key, $system_message, $prompt)
    {
        $url = 'https://api.openai.com/v1/chat/completions';
        $body = wp_json_encode(array(
            'model' => 'gpt-4o-mini',
            'messages' => array(
                array('role' => 'system', 'content' => $system_message),
                array('role' => 'user', 'content' => $prompt),
            ),
            'temperature' => 0.2, // Low temp for more deterministic code
        ));

        $args = array(
            'body' => $body,
            'headers' => array(
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type' => 'application/json',
            ),
            'timeout' => 60,
        );

        $response = wp_remote_post($url, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (isset($data['error'])) {
            return new WP_Error('api_error', $data['error']['message']);
        }

        return isset($data['choices'][0]['message']['content']) ? $data['choices'][0]['message']['content'] : '';
    }

    private function call_gemini($api_key, $system_message, $prompt)
    {
        // Simple implementation of Gemini REST API call
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $api_key;

        // Gemini doesn't use standard system instructions in the same exact format in the free basic REST API as OpenAI,
        // but we can prepend it to the prompt or use the system_instruction field if available.
        // For broad compatibility, we combine them.

        $combined_prompt = "System Instructions:\n" . $system_message . "\n\nUser Request:\n" . $prompt;

        $body = wp_json_encode(array(
            'contents' => array(
                array(
                    'parts' => array(
                        array('text' => $combined_prompt)
                    )
                )
            ),
            'generationConfig' => array(
                'temperature' => 0.2
            )
        ));

        $args = array(
            'body' => $body,
            'headers' => array(
                'Content-Type' => 'application/json',
            ),
            'timeout' => 60,
        );

        $response = wp_remote_post($url, $args);

        if (is_wp_error($response)) {
            return $response;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (isset($data['error'])) {
            return new WP_Error('api_error', $data['error']['message']);
        }

        // Parse Gemini response
        if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            return $data['candidates'][0]['content']['parts'][0]['text'];
        }

        return '';
    }


}
