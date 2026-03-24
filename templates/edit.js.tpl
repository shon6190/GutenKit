// blocks/my-custom-block/edit.js (This is the template the script overwrites)
import { useRef, useEffect } from '@wordpress/element';

// This line handles all core block editing components (RichText, MediaUpload, etc.)
import { useBlockProps, RichText, InspectorControls } from '@wordpress/block-editor';

// This line handles all standard UI components (TextControl, Button, PanelBody, etc.)
import { PanelBody } from '@wordpress/components';

// __INJECT_SCRIPT_IMPORTS__

const Edit = ( { attributes, setAttributes } ) => {
	const blockProps = useBlockProps();
	const canvasRef = useRef( null );

	// __INJECT_EDITOR_EFFECTS__

	return (
        <div { ...blockProps }>
            {/* 1. SIDEBAR: Each field renders its own <InspectorControls> */}
            // __INJECT_UI_CODE__

            {/* 2. CANVAS: Real-time HTML preview goes here */}
            <div className="bf-block-canvas-preview" ref={ canvasRef }>
                // __INJECT_CANVAS_PREVIEW__
            </div>

        </div>
    );
};
export default Edit;
