const fs = require('fs');

const phpContent = fs.readFileSync('blocks/home-banner/render.php', 'utf8');
const convertRenderPhpToJsx = require('./lib/php-to-jsx');

const result = convertRenderPhpToJsx(phpContent);
console.log(result.includes('style="background-image'));
console.log(result.match(/style=.*?background-image.*?;/g));
