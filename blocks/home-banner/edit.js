// blocks/my-custom-block/edit.js (This is the template the script overwrites)
// This line handles all core block editing components (RichText, MediaUpload, etc.)
import { useBlockProps, InspectorControls, RichText } from '@wordpress/block-editor'; 

// This line handles all standard UI components (TextControl, Button, PanelBody, etc.)
import { PanelBody, TextControl, RangeControl, ToggleControl, TextareaControl } from '@wordpress/components';

const Edit = ( { attributes, setAttributes } ) => {
	const blockProps = useBlockProps();

	return (
		<div { ...blockProps }>
			
            <InspectorControls key="default_title-settings">
                <PanelBody title="Default Block Title Settings" initialOpen={true}>
                    <TextControl
                        label="Default Block Title"
                        value={ attributes.default_title }
                        onChange={ ( value ) => setAttributes( { default_title: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        

            <InspectorControls key="new_field_1-settings">
                <PanelBody title="New text Field Settings" initialOpen={true}>
                    <TextControl
                        label="New text Field"
                        value={ attributes.new_field_1 }
                        onChange={ ( value ) => setAttributes( { new_field_1: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        

            <InspectorControls key="new_field_2-settings">
                <PanelBody title="New number Field Settings" initialOpen={true}>
                    <TextControl
                        label="New number Field"
                        type="number" 
                        value={ attributes.new_field_2 }
                        onChange={ ( value ) => setAttributes( { new_field_2: parseFloat(value) } ) }
                    />
                </PanelBody>
            </InspectorControls>
        

            <InspectorControls key="new_field_3-settings">
                <PanelBody title="New range Field Settings" initialOpen={true}>
                    <RangeControl
                        label="New range Field"
                        value={ attributes.new_field_3 }
                        onChange={ ( value ) => setAttributes( { new_field_3: value } ) }
                        min={ 0 } 
                        max={ 100 }
                        step={ 1 }
                    />
                </PanelBody>
            </InspectorControls>
        

            <InspectorControls key="new_field_4-settings">
                <PanelBody title="New url Field Settings" initialOpen={true}>
                    <TextControl
                        label="New url Field"
                        type="url"
                        value={ attributes.new_field_4 }
                        onChange={ ( value ) => setAttributes( { new_field_4: value } ) }
                    />
                </PanelBody>
            </InspectorControls>
        

            <InspectorControls key="new_field_5-settings">
                <PanelBody title="New contentEditor Field Content Settings" initialOpen={true}>
                    
                    {/* Toggle to switch between Visual and HTML/Text View */}
                    <ToggleControl
                        label="Enable HTML/Text View"
                        checked={ attributes.is_html_mode_new_field_5 }
                        onChange={ ( isChecked ) => setAttributes( { is_html_mode_new_field_5: isChecked } ) }
                        help={ attributes.is_html_mode_new_field_5 ? 'Editing in HTML/Text mode.' : 'Editing in Visual mode.' }
                    />

                    {/* Conditional Rendering based on the toggle */}
                    { attributes.is_html_mode_new_field_5 ? (
                        /* --- 1. HTML/Text Area View --- */
                        <TextareaControl
                            label="New contentEditor Field (HTML/Text)"
                            value={ attributes.new_field_5 }
                            onChange={ ( value ) => setAttributes( { new_field_5: value } ) }
                            rows={ 10 }
                        />
                    ) : (
                        /* --- 2. Visual/RichText View --- */
                        <div style={{ padding: '10px', border: '1px solid #ddd' }}>
                            <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>New contentEditor Field (Visual)</p>
                            <RichText
                                tagName="div" 
                                value={ attributes.new_field_5 }
                                allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] } 
                                onChange={ ( value ) => setAttributes( { new_field_5: value } ) }
                                placeholder="Enter rich content here..."
                            />
                        </div>
                    )}
                </PanelBody>
            </InspectorControls>
        

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