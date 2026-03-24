/**
 * Field validation logic extracted from handleSave.
 *
 * Validates that every field (and repeater sub-field) has a non-empty
 * label and key.
 *
 * @param {Array} fields - The fields array from state.
 * @returns {{ isValid: boolean, invalidFields: Object }}
 *   invalidFields is keyed by field index (e.g. "2") or
 *   composite key for sub-fields (e.g. "2_1").
 */
export function validateFields(fields) {
    let isValid = true;
    const invalidFields = {};

    fields.forEach((field, index) => {
        if (!field.label || field.label.trim() === '' || !field.key || field.key.trim() === '') {
            isValid = false;
            invalidFields[index] = 'Label and Key cannot be empty.';
        }
        if (field.type === 'repeater' && field.subFields) {
            field.subFields.forEach((subField, subIndex) => {
                if (!subField.label || subField.label.trim() === '' || !subField.key || subField.key.trim() === '') {
                    isValid = false;
                    invalidFields[index + '_' + subIndex] = 'Sub-Field Label and Key cannot be empty.';
                }
            });
        }
    });

    return { isValid, invalidFields };
}
