<?php
/**
 * Dynamic rendering template for the 'home-banner' block.
 * * NOTE: This file is included via the block's render_callback.
 *
 * @var array $attributes  An associative array of block attributes from the database.
 * @var string $content    The block's inner RichText content (if used).
 */

// You can use a wrapper based on the component slug for unique styling
$wrapper_classes = 'bf-block-' . esc_attr('home-banner');

// Define safe defaults for easier access
$attributes = $attributes ?? [];
$content = $content ?? '';

// --- START BLOCK HTML OUTPUT ---
?>

<div class="<?php echo $wrapper_classes; ?>">
    
    <div class="bf-inner-content">
        
        <?php 
        // Example: Display the 'default_title' attribute
        if ( ! empty($attributes['default_title']) ) : ?>
            <h2><?php echo esc_html($attributes['default_title']); ?></h2>
        <?php endif; ?>

        <?php 
        // Display the standard RichText content passed from the editor
        if ( ! empty($content) ) : ?>
            <div class="bf-message">
                <?php echo wp_kses_post($content); ?>
            </div>
        <?php endif; ?>

        </div>
</div>