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
        $keys = array(
            'gutenkit_openai_api_key',
            'gutenkit_gemini_api_key',
            'gutenkit_groq_api_key',
            'gutenkit_openrouter_api_key',
        );
        foreach ( $keys as $option_name ) {
            register_setting( 'gutenkit_ai_settings_group', $option_name, array(
                'sanitize_callback' => array( $this, 'encrypt_key' ),
            ) );
            // Preserve existing key when form field is submitted blank
            add_filter( "pre_update_option_{$option_name}", function( $new_value, $old_value ) {
                return empty( $new_value ) ? $old_value : $new_value;
            }, 10, 2 );
        }
    }

    public function encrypt_key( $plaintext ) {
        if ( empty( $plaintext ) ) return '';
        $key    = substr( hash( 'sha256', wp_salt( 'auth' ) ), 0, 32 );
        $iv     = openssl_random_pseudo_bytes( 16 );
        $cipher = openssl_encrypt( $plaintext, 'AES-256-CBC', $key, 0, $iv );
        return base64_encode( $iv . $cipher );
    }

    private function decrypt_key( $encrypted ) {
        if ( empty( $encrypted ) ) return '';
        $key  = substr( hash( 'sha256', wp_salt( 'auth' ) ), 0, 32 );
        $data = base64_decode( $encrypted );
        if ( strlen( $data ) < 17 ) return '';
        $iv     = substr( $data, 0, 16 );
        $cipher = substr( $data, 16 );
        $result = openssl_decrypt( $cipher, 'AES-256-CBC', $key, 0, $iv );
        return $result !== false ? $result : '';
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

                <?php
                $openai_saved      = get_option( 'gutenkit_openai_api_key', '' );
                $gemini_saved      = get_option( 'gutenkit_gemini_api_key', '' );
                $groq_saved        = get_option( 'gutenkit_groq_api_key', '' );
                $openrouter_saved  = get_option( 'gutenkit_openrouter_api_key', '' );
                ?>
                <table class="form-table">
                    <tr valign="top">
                        <th scope="row">OpenAI API Key</th>
                        <td>
                            <input type="password" name="gutenkit_openai_api_key"
                                value=""
                                placeholder="<?php echo ! empty( $openai_saved ) ? '********' : ''; ?>"
                                style="width:100%; max-width:400px;" />
                            <?php if ( ! empty( $openai_saved ) ) : ?>
                                <p class="description" style="color:#2271b1;">A key is currently saved. Leave blank to keep it unchanged.</p>
                            <?php endif; ?>
                            <p class="description">Get your key from the <a href="https://platform.openai.com/api-keys"
                                    target="_blank">OpenAI Dashboard</a>.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Google Gemini API Key</th>
                        <td>
                            <input type="password" name="gutenkit_gemini_api_key"
                                value=""
                                placeholder="<?php echo ! empty( $gemini_saved ) ? '********' : ''; ?>"
                                style="width:100%; max-width:400px;" />
                            <?php if ( ! empty( $gemini_saved ) ) : ?>
                                <p class="description" style="color:#2271b1;">A key is currently saved. Leave blank to keep it unchanged.</p>
                            <?php endif; ?>
                            <p class="description">Get your key from <a href="https://aistudio.google.com/app/apikey"
                                    target="_blank">Google AI Studio</a>.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">Groq API Key</th>
                        <td>
                            <input type="password" name="gutenkit_groq_api_key"
                                value=""
                                placeholder="<?php echo ! empty( $groq_saved ) ? '********' : ''; ?>"
                                style="width:100%; max-width:400px;" />
                            <?php if ( ! empty( $groq_saved ) ) : ?>
                                <p class="description" style="color:#2271b1;">A key is currently saved. Leave blank to keep it unchanged.</p>
                            <?php endif; ?>
                            <p class="description">Llama 3 70b models. High rate limit. Get your key from <a href="https://console.groq.com/keys" target="_blank">Groq Console</a>.</p>
                        </td>
                    </tr>
                    <tr valign="top">
                        <th scope="row">OpenRouter API Key</th>
                        <td>
                            <input type="password" name="gutenkit_openrouter_api_key"
                                value=""
                                placeholder="<?php echo ! empty( $openrouter_saved ) ? '********' : ''; ?>"
                                style="width:100%; max-width:400px;" />
                            <?php if ( ! empty( $openrouter_saved ) ) : ?>
                                <p class="description" style="color:#2271b1;">A key is currently saved. Leave blank to keep it unchanged.</p>
                            <?php endif; ?>
                            <p class="description">Free Llama 3 models available. Get your key from <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a>.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save API Keys'); ?>
            </form>

            <hr>
            <h2>✨ Free Tier Available</h2>
            <p>Don't want to pay for API usage while building blocks? <strong>Groq, OpenRouter, and Google Gemini offer generous Free Tiers</strong>!</p>
            <p>Groq provides up to 30 requests per minute completely free, while OpenRouter provides free Llama 3 models without any credit requirements.</p>

        </div>
        <?php
    }

    private function get_providers() {
        return array(
            'groq' => array(
                'option'   => 'gutenkit_groq_api_key',
                'endpoint' => 'https://api.groq.com/openai/v1/chat/completions',
                'model'    => 'llama3-70b-8192',
                'format'   => 'openai',
                'headers'  => array(),
            ),
            'openrouter' => array(
                'option'   => 'gutenkit_openrouter_api_key',
                'endpoint' => 'https://openrouter.ai/api/v1/chat/completions',
                'model'    => 'openrouter/auto',
                'format'   => 'openai',
                'headers'  => array( 'HTTP-Referer' => site_url() ),
            ),
            'openai' => array(
                'option'   => 'gutenkit_openai_api_key',
                'endpoint' => 'https://api.openai.com/v1/chat/completions',
                'model'    => 'gpt-4o-mini',
                'format'   => 'openai',
                'headers'  => array(),
            ),
            'gemini' => array(
                'option'   => 'gutenkit_gemini_api_key',
                'endpoint' => '', // Built dynamically
                'model'    => 'gemini-2.5-flash',
                'format'   => 'gemini',
                'headers'  => array(),
            ),
        );
    }

    private function call_provider( $provider, $api_key, $system_message, $prompt ) {
        $timeout = 60;

        if ( $provider['format'] === 'gemini' ) {
            $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$provider['model']}:generateContent?key={$api_key}";
            // Gemini doesn't use standard system instructions in the same exact format in the free basic REST API as OpenAI,
            // but we can prepend it to the prompt or use the system_instruction field if available.
            // For broad compatibility, we combine them.
            $combined_prompt = "System Instructions:\n" . $system_message . "\n\nUser Request:\n" . $prompt;
            $body = array(
                'contents' => array(
                    array( 'parts' => array( array( 'text' => $combined_prompt ) ) ),
                ),
                'generationConfig' => array( 'temperature' => 0.2 ),
            );
            $response = wp_remote_post( $endpoint, array(
                'headers' => array( 'Content-Type' => 'application/json' ),
                'body'    => wp_json_encode( $body ),
                'timeout' => $timeout,
            ) );
            if ( is_wp_error( $response ) ) return $response;
            $data = json_decode( wp_remote_retrieve_body( $response ), true );
            if ( isset( $data['error'] ) ) {
                return new WP_Error( 'api_error', $data['error']['message'] ?? 'Gemini API error' );
            }
            return $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
        }

        // OpenAI-compatible format (OpenAI, Groq, OpenRouter)
        $headers = array_merge(
            array(
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ),
            $provider['headers']
        );
        $body = array(
            'model'       => $provider['model'],
            'messages'    => array(
                array( 'role' => 'system', 'content' => $system_message ),
                array( 'role' => 'user', 'content' => $prompt ),
            ),
            'temperature' => 0.2,
        );
        $response = wp_remote_post( $provider['endpoint'], array(
            'headers' => $headers,
            'body'    => wp_json_encode( $body ),
            'timeout' => $timeout,
        ) );
        if ( is_wp_error( $response ) ) return $response;
        $data = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( isset( $data['error'] ) ) {
            $err_msg = $data['error']['message'] ?? 'API error';
            if ( isset( $data['error']['metadata'] ) ) {
                $err_msg .= ' (' . wp_json_encode( $data['error']['metadata'] ) . ')';
            }
            return new WP_Error( 'api_error', $err_msg );
        }
        return $data['choices'][0]['message']['content'] ?? '';
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

        // 4. Build System Prompt
        $system_message = "You are an expert web developer building a Gutenberg block. The user has defined the following fields:\n" . json_encode($fields) . "\n\n";
        $system_message .= "Task: Create the HTML and Vanilla CSS based on the user's prompt.\n";
        $system_message .= "Rules:\n";
        $system_message .= "1. Return ONLY a valid JSON object with exactly two keys: 'html' and 'css'. No markdown wrapping like ```json.\n";
        $system_message .= "2. In the HTML, use the field 'key' surrounded by double curly braces for dynamic data. Example: {{title_field}} or {{image_field}}.\n";
        $system_message .= "3. For repeaters, use a pseudo {{#each repeater_key}} ... {{/each}} syntax.\n";
        $system_message .= "4. Output clean, modern HTML and CSS (use flexbox/grid layout).\n";
        $system_message .= "5. Wrap the main HTML in a div with a unique class (e.g. .gk-block-wrapper) and namespace the CSS to that class so it doesn't affect the rest of the site.\n";

        // 5. Try each provider in priority order; stop at first success
        $providers = $this->get_providers();
        $result = null;

        foreach ( $providers as $name => $provider ) {
            $key = $this->decrypt_key( get_option( $provider['option'], '' ) );
            if ( empty( $key ) ) continue;
            $result = $this->call_provider( $provider, $key, $system_message, $prompt );
            if ( ! is_wp_error( $result ) && ! empty( $result ) ) break;
        }

        if ( is_wp_error( $result ) ) {
            wp_send_json_error( array( 'message' => $result->get_error_message() ) );
        }
        if ( empty( $result ) ) {
            wp_send_json_error( array( 'message' => 'To use the AI Template Generator, please enter your free Groq, OpenRouter, OpenAI, or Gemini API Key in the GutenKit Settings.' ) );
        }

        // 6. Parse Result
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
}
