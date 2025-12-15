// blocks/my-custom-block/edit.js (This is the template the script overwrites)
// This line handles all core block editing components (RichText, MediaUpload, etc.)
import { 
    useBlockProps, 
    RichText, 
    InspectorControls 
    // __INJECT_BLOCK_EDITOR_IMPORTS__  <-- Your script should add MediaUpload, MediaUploadCheck here
} from '@wordpress/block-editor'; 

// This line handles all standard UI components (TextControl, Button, PanelBody, etc.)
import { 
    PanelBody 
    // __INJECT_COMPONENTS_IMPORTS__  <-- Your script should add TextControl, Button, ToggleControl, etc. here
} from '@wordpress/components';

const Edit = ( { attributes, setAttributes } ) => {
	const blockProps = useBlockProps();

	return (
		<div { ...blockProps }>
			// __INJECT_UI_CODE__
			<RichText
				tagName="p"
				value={ attributes.message }
				allowedFormats={ [ 'core/bold', 'core/italic' ] }
				onChange={ ( message ) => setAttributes( { message } ) }
				placeholder="Write your Home Banner message here..."
			/>
		</div>
	);
};
export default Edit;