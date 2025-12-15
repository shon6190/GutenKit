# GutenKit

GutenKit is a lightweight, Git-friendly framework that provides the perfect middle ground for building scalable Gutenberg blocks. It uses the WordPress admin solely for block registration and defining dynamic fields, while delegating all rendering (front-end and editor HTML/PHP) to dedicated files within your codebase.

Admin UI (Configuration): Developers define the block's name, icon, settings, and, most importantly, the dynamic field types (Text, Image, Repeater, etc.) in a simple admin interface.

Codebase (Implementation): Upon saving the configuration, GutenKit instantly generates the necessary file structure (e.g., render.php, style.css) in your designated plugin or theme directory.

Version Control: Every front-end and back-end change is trackable, mergeable, and auditable using Git.

Clean Ownership: Easily manage and test block appearance across environments.

Developer Comfort: Work in your preferred IDE using standard HTML, CSS, and PHP, leveraging the field data provided by the framework.




