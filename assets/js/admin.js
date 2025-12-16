
jQuery(document).ready(function($) {
    $('.block-factory-delete-btn').on('click', function(e) {
        e.preventDefault();
        
        const blockSlug = $(this).data('slug');
        
        if (confirm(`WARNING: Are you sure you want to permanently delete the block "${blockSlug}"? This action cannot be undone and will remove all associated files (config.json, edit.js, block.json, etc.)`)) {
            
            // Disable the link while saving
            const $btn = $(this);
            $btn.text('Deleting...');
            $btn.prop('disabled', true);

            // Send AJAX request to delete the files
            $.post(ajaxurl, {
                action: 'block_factory_delete_block',
                nonce: blockFactoryEditorData.nonce, // Assuming you have a global nonce defined
                block_slug: blockSlug
            })
            .done(function(response) {
                if (response.success) {
                    alert(`Block ${blockSlug} successfully deleted!`);
                    // Reload the page to refresh the component list
                    window.location.reload(); 
                } else {
                    alert('Deletion Error: ' + response.data.message);
                    $btn.text('Delete');
                    $btn.prop('disabled', false);
                }
            })
            .fail(function() {
                alert('Critical Error: Failed to communicate with the server.');
                $btn.text('Delete');
                $btn.prop('disabled', false);
            });
        }
    });
});