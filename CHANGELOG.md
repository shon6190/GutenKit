# GutenKit - Development Changelog

This document summarizes the development history, features, and fixes implemented in the GutenKit plugin based on the Git commit history.

## 2026-03-07
- **Bug Fix & Validation**: Fixed validation issues related to field label and attribute key generation. Added real-time checks ensuring both fields are required and correctly formatted before allowing blocks to save or proceed.

## 2026-03-06
- **UI & Experience Improvements**: 
  - Improved the user interface of the Template and Design sections.
  - Updated and refined the "Add Block" page UI.
  - Implemented image placeholders for image fields to enhance visual feedback in the block editor.
- **Stability**: Added comprehensive error handling to improve the robustness of block saving and generation.

## 2026-02-19
- **Editor Enhancements**:
  - Introduced a dynamic **Cheat Sheet** for fields to help developers easily copy template tags into the render configuration.
  - Updated the overall block editor UI for a smoother administration experience.

## 2026-02-18
- **Bug Fix**: Fixed issues preventing proper backend block rendering in the WordPress block editor.

## 2026-02-17
- **Styling**:
  - Added dedicated CSS styles to the editor interface for a more polished look.
  - Styled the Repeater blocks for better organization and nested visibility.
- **Documentation**: Added initial documentation text.
- **Fixes**: Addressed specific issues with certain fields failing to render properly.

## 2026-02-13
- **Automation**: Setup functionality to automatically download and install NPM modules upon plugin activation.
- **Optimization**: Completed major code optimization and syntax cleanup (including removing unneeded PHP tags).
- **Backend Setup**: Migrated and set up the blocks backend view configuration.

## 2026-01-29
- **Refactoring**: Optimized the core project directory structure for better performance and maintainability.

## 2025-12-29
- **New Feature**: Added the capability to add block templates.
- **Cleanup**: Purged redundant backup files.

## 2025-12-18
- **Core Builder Features**: Added the core editor interface functionality allowing the building of blocks.
- **Update Capabilities**: Integrated the ability to update existing blocks seamlessly rather than just creating new ones.
- **Bug Fixes**: 
  - Fixed a critical problem preventing block updates from saving securely.
  - Fixed issues with the gallery field updates.

## 2025-12-16
- **Bug Fixes**: Resolved persistent issues with file uploads occurring inside repeater sub-fields and direct upload fields. Fixed general bugs within the repeater field implementation.

## 2025-12-15
- **Initial Setup & Foundation**: 
  - Initialized the plugin repository, base files, and documentation (`README.md`).
  - Implemented the first version of the **Repeater Field** and its nested sub-fields capability on the admin side.
  - Set up build environments and `.gitignore` exceptions.
