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

    // $('#build-block-btn').on('click', function () {
    //     // Optionally, add a spinner or disable button here
    //     $.ajax({
    //         url: blockFactoryAdmin.ajaxurl,
    //         type: 'POST',
    //         data: {
    //             action: 'bf_run_npm_build',
    //             nonce: blockFactoryAdmin.nonce, // Add nonce for security
    //         },
    //         success: function (response) {
    //             alert(response); // Or update UI with success/failure
    //         },
    //         error: function () {
    //             alert('Error running build.');
    //         }
    //     });
    // });

    // Handle Install Dependencies
    $('#bf-install-dependencies-btn').on('click', function (e) {
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
            .done(function (response) {
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
            .fail(function () {
                alert('Server Error: Request failed or timed out. Please check your server logs.');
                $btn.prop('disabled', false).text('Install Dependencies');
            });
    });

    // --- Dashicon Picker Logic ---

    // Curated list of useful dashboard icons for blocks
    const curatedDashicons = [
        'editor-code', 'star-filled', 'star-half', 'star-empty', 'format-image',
        'format-gallery', 'format-video', 'format-audio', 'layout', 'grid-view',
        'list-view', 'admin-users', 'businessman', 'admin-site', 'admin-page',
        'admin-comments', 'admin-media', 'admin-settings', 'admin-network',
        'admin-home', 'admin-appearance', 'admin-plugins', 'dashboard',
        'chart-line', 'chart-bar', 'chart-pie', 'megaphone', 'awards',
        'location-alt', 'store', 'cart', 'products', 'tickets-alt', 'calendar-alt',
        'clock', 'camera', 'images-alt', 'image-filter', 'image-crop',
        'cover-image', 'testimonial', 'portfolio', 'welcome-widgets-menus',
        'email', 'buddicons-groups', 'buddicons-replies', 'buddicons-topics',
        'edit', 'media-document', 'welcome-learn-more', 'shield', 'thumbs-up'
    ];

    const $pickerBtn = $('#gutenkit-open-icon-picker');
    const $pickerDropdown = $('#gutenkit-icon-picker-dropdown');
    const $pickerGrid = $('#gutenkit-icon-picker-grid');
    const $iconSearch = $('#gutenkit-icon-search');
    const $iconInput = $('#component_icon');
    const $iconPreview = $('#gutenkit-current-icon-preview');

    // Populate grid
    function renderIcons(iconsToRender) {
        $pickerGrid.empty();
        if (iconsToRender.length === 0) {
            $pickerGrid.html('<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #64748b; font-size: 12px;">No icons found.</div>');
            return;
        }

        const currentVal = $iconInput.val().trim();

        iconsToRender.forEach(slug => {
            const isSelected = slug === currentVal ? 'is-selected' : '';
            const $icon = $(`
                <div class="gutenkit-icon-item ${isSelected}" data-slug="${slug}" title="${slug}">
                    <span class="dashicons dashicons-${slug}"></span>
                </div>
            `);
            $pickerGrid.append($icon);
        });
    }

    if ($pickerGrid.length) {
        renderIcons(curatedDashicons);

        // Open Picker
        $pickerBtn.on('click', function (e) {
            e.stopPropagation();
            $pickerDropdown.toggleClass('is-open');
            if ($pickerDropdown.hasClass('is-open')) {
                // Re-render to show updated selection state based on current input
                renderIcons(curatedDashicons);
                // Clear search and refocus
                $iconSearch.val('').focus();
            }
        });

        // Close on outside click
        $(document).on('click', function (e) {
            if (!$(e.target).closest('.gutenkit-icon-picker-wrapper').length) {
                $pickerDropdown.removeClass('is-open');
            }
        });

        // Prevent closing when clicking inside picker
        $pickerDropdown.on('click', function (e) {
            e.stopPropagation();
        });

        // Handle icon click
        $pickerGrid.on('click', '.gutenkit-icon-item', function () {
            const selectedSlug = $(this).data('slug');
            $iconInput.val(selectedSlug);
            $iconPreview.attr('class', 'dashicons dashicons-' + selectedSlug);
            $pickerDropdown.removeClass('is-open');
        });

        // Search logic
        $iconSearch.on('input', function () {
            const query = $(this).val().toLowerCase().trim();
            const filtered = curatedDashicons.filter(slug => slug.includes(query));
            renderIcons(filtered);
        });

        // Sync preview when input is typed manually
        $iconInput.on('input', function () {
            const val = $(this).val().trim() || 'editor-code';
            $iconPreview.attr('class', 'dashicons dashicons-' + val);
        });
    }

});