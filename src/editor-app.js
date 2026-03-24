/**
 * Editor Application entry point.
 *
 * Mounts the <App /> component into the #component-editor-root element
 * when the DOM is ready and localized data (blockFactoryEditor) is available.
 */
import { createElement, render } from '@wordpress/element';
import App from './components/App.js';

document.addEventListener('DOMContentLoaded', function () {
    var rootElement = document.getElementById('component-editor-root');

    if (rootElement && typeof window.blockFactoryEditor !== 'undefined') {
        render(
            createElement(App, {
                initialConfig: window.blockFactoryEditor.config,
                blockSlug: window.blockFactoryEditor.blockSlug,
            }),
            rootElement
        );
    }
});
