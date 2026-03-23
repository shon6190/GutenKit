/**
 * Block Factory admin page — vanilla JS (no jQuery).
 *
 * Three features:
 * 1. Delete block button
 * 2. Install dependencies button
 * 3. Dashicon picker
 */
document.addEventListener('DOMContentLoaded', function () {

    // --- 1. Delete Block ---
    document.querySelectorAll('.block-factory-delete-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();

            var blockSlug = this.dataset.slug;

            if (!confirm('WARNING: Are you sure you want to permanently delete the block "' + blockSlug + '"? This action cannot be undone and will remove all associated files (config.json, edit.js, block.json, etc.)')) {
                return;
            }

            btn.textContent = 'Deleting...';
            btn.disabled = true;

            var body = new FormData();
            body.append('action', 'block_factory_delete_block');
            body.append('nonce', window.blockFactoryAdmin.nonce);
            body.append('block_slug', blockSlug);

            fetch(window.ajaxurl, { method: 'POST', credentials: 'same-origin', body: body })
                .then(function (r) { return r.json(); })
                .then(function (response) {
                    if (response.success) {
                        alert('Block ' + blockSlug + ' successfully deleted!');
                        window.location.reload();
                    } else {
                        alert('Deletion Error: ' + response.data.message);
                        btn.textContent = 'Delete';
                        btn.disabled = false;
                    }
                })
                .catch(function () {
                    alert('Critical Error: Failed to communicate with the server.');
                    btn.textContent = 'Delete';
                    btn.disabled = false;
                });
        });
    });

    // --- 2. Install Dependencies ---
    var installBtn = document.getElementById('bf-install-dependencies-btn');
    if (installBtn) {
        installBtn.addEventListener('click', function (e) {
            e.preventDefault();

            var progress = document.getElementById('bf-install-progress');
            var output   = document.getElementById('bf-install-output');

            if (!confirm('This will download and install Node.js dependencies (approx 200MB). It may take a few minutes. Continue?')) {
                return;
            }

            installBtn.disabled = true;
            installBtn.textContent = 'Installing...';
            if (progress) progress.style.display = '';
            if (output) { output.style.display = 'none'; output.innerHTML = ''; }

            var body = new FormData();
            body.append('action', 'bf_install_dependencies');
            body.append('nonce', window.blockFactoryAdmin.nonce);

            fetch(window.ajaxurl, { method: 'POST', credentials: 'same-origin', body: body })
                .then(function (r) { return r.json(); })
                .then(function (response) {
                    if (response.success) {
                        if (output) { output.innerHTML = response.data.output; output.style.display = ''; }
                        alert('Dependencies installed successfully! Reloading page...');
                        window.location.reload();
                    } else {
                        if (output) {
                            output.innerHTML = 'Error:\n' + response.data.message + '\n\nOutput:\n' + response.data.output;
                            output.style.display = '';
                        }
                        alert('Installation Failed. Check the output log below.');
                        installBtn.disabled = false;
                        installBtn.textContent = 'Install Dependencies';
                    }
                })
                .catch(function () {
                    alert('Server Error: Request failed or timed out. Please check your server logs.');
                    installBtn.disabled = false;
                    installBtn.textContent = 'Install Dependencies';
                });
        });
    }

    // --- 3. Dashicon Picker ---
    var curatedDashicons = [
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

    var pickerBtn      = document.getElementById('gutenkit-open-icon-picker');
    var pickerDropdown = document.getElementById('gutenkit-icon-picker-dropdown');
    var pickerGrid     = document.getElementById('gutenkit-icon-picker-grid');
    var iconSearch     = document.getElementById('gutenkit-icon-search');
    var iconInput      = document.getElementById('component_icon');
    var iconPreview    = document.getElementById('gutenkit-current-icon-preview');

    function renderIcons(iconsToRender) {
        if (!pickerGrid) return;
        pickerGrid.innerHTML = '';

        if (iconsToRender.length === 0) {
            pickerGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 10px; color: #64748b; font-size: 12px;">No icons found.</div>';
            return;
        }

        var currentVal = iconInput ? iconInput.value.trim() : '';

        iconsToRender.forEach(function (slug) {
            var div = document.createElement('div');
            div.className = 'gutenkit-icon-item' + (slug === currentVal ? ' is-selected' : '');
            div.dataset.slug = slug;
            div.title = slug;
            div.innerHTML = '<span class="dashicons dashicons-' + slug + '"></span>';
            pickerGrid.appendChild(div);
        });
    }

    if (pickerGrid) {
        renderIcons(curatedDashicons);

        // Open picker
        if (pickerBtn) {
            pickerBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                pickerDropdown.classList.toggle('is-open');
                if (pickerDropdown.classList.contains('is-open')) {
                    renderIcons(curatedDashicons);
                    if (iconSearch) { iconSearch.value = ''; iconSearch.focus(); }
                }
            });
        }

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (pickerDropdown && !e.target.closest('.gutenkit-icon-picker-wrapper')) {
                pickerDropdown.classList.remove('is-open');
            }
        });

        // Prevent closing when clicking inside picker
        if (pickerDropdown) {
            pickerDropdown.addEventListener('click', function (e) {
                e.stopPropagation();
            });
        }

        // Handle icon click (event delegation)
        pickerGrid.addEventListener('click', function (e) {
            var item = e.target.closest('.gutenkit-icon-item');
            if (!item) return;
            var selectedSlug = item.dataset.slug;
            if (iconInput) iconInput.value = selectedSlug;
            if (iconPreview) iconPreview.className = 'dashicons dashicons-' + selectedSlug;
            if (pickerDropdown) pickerDropdown.classList.remove('is-open');
        });

        // Search
        if (iconSearch) {
            iconSearch.addEventListener('input', function () {
                var query = this.value.toLowerCase().trim();
                var filtered = curatedDashicons.filter(function (slug) { return slug.includes(query); });
                renderIcons(filtered);
            });
        }

        // Sync preview on manual input
        if (iconInput) {
            iconInput.addEventListener('input', function () {
                var val = this.value.trim() || 'editor-code';
                if (iconPreview) iconPreview.className = 'dashicons dashicons-' + val;
            });
        }
    }
});
