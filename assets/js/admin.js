jQuery(document).ready(function ($) {
    $('.block-factory-delete-btn').on('click', function (e) {
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
                    nonce: blockFactoryAdmin.nonce, // Assuming you have a global nonce defined
                    block_slug: blockSlug
                })
                .done(function (response) {
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
                .fail(function () {
                    alert('Critical Error: Failed to communicate with the server.');
                    $btn.text('Delete');
                    $btn.prop('disabled', false);
                });
        }
    });

    $('#build-block-btn').on('click', function () {
        // Optionally, add a spinner or disable button here
        $.ajax({
            url: blockFactoryAdmin.ajaxurl,
            type: 'POST',
            data: {
                action: 'bf_run_npm_build',
                nonce: blockFactoryAdmin.nonce, // Add nonce for security
            },
            success: function (response) {
                alert(response); // Or update UI with success/failure
            },
            error: function () {
                alert('Error running build.');
            }
        });
    });

    // Handle Install Dependencies
    $('#bf-install-dependencies-btn').on('click', function(e) {
        e.preventDefault();
        const $btn = $(this);
        const $progress = $('#bf-install-progress');
        const $output = $('#bf-install-output');

        if (!confirm('This will download and install Node.js dependencies (approx 200MB). It may take a few minutes. Continue?')) {
            return;
        }

        $btn.prop('disabled', true).text('Installing...');
        $progress.show();
        $output.hide().empty();

        $.post(ajaxurl, {
            action: 'bf_install_dependencies',
            nonce: blockFactoryAdmin.nonce
        })
        .done(function(response) {
            if (response.success) {
                $output.html(response.data.output).show();
                alert('Dependencies installed successfully! Reloading page...');
                window.location.reload();
            } else {
                $output.html('Error:\n' + response.data.message + '\n\nOutput:\n' + response.data.output).show();
                alert('Installation Failed. Check the output log below.');
                $btn.prop('disabled', false).text('Install Dependencies');
            }
        })
        .fail(function() {
            alert('Server Error: Request failed or timed out. Please check your server logs.');
            $btn.prop('disabled', false).text('Install Dependencies');
        });
    });
});