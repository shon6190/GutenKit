/**
 * Shared drag-and-drop helpers.
 *
 * Used by both the main field list and repeater sub-field list.
 * Each consumer keeps its own draggedIndex in state; these helpers
 * accept the current index, the setter, and the items array/setter
 * so the logic is written once.
 */

/**
 * Create a set of drag-drop handlers for an ordered list.
 *
 * @param {Object} opts
 * @param {Function} opts.getDraggedIndex  - Returns the current dragged index.
 * @param {Function} opts.setDraggedIndex  - State setter for dragged index.
 * @param {Function} opts.getItems         - Returns the current items array.
 * @param {Function} opts.setItems         - State setter (or updater) for items array.
 * @param {boolean}  [opts.stopPropagation=false] - Whether to call e.stopPropagation().
 * @returns {Object} { onDragStart, onDragOver, onDragEnter, onDrop }
 */
export function createDragHandlers({ getDraggedIndex, setDraggedIndex, getItems, setItems, stopPropagation = false }) {
    const onDragStart = (e, index) => {
        if (stopPropagation) e.stopPropagation();
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e) => {
        e.preventDefault();
    };

    const onDragEnter = (e, targetIndex) => {
        if (stopPropagation) e.stopPropagation();
        const draggedIndex = getDraggedIndex();
        if (draggedIndex === null || draggedIndex === targetIndex) return;

        const newItems = [...getItems()];
        const item = newItems[draggedIndex];
        newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, item);

        setItems(newItems);
        setDraggedIndex(targetIndex);
    };

    const onDrop = (e) => {
        e.preventDefault();
        if (stopPropagation) e.stopPropagation();
        setDraggedIndex(null);
    };

    return { onDragStart, onDragOver, onDragEnter, onDrop };
}
