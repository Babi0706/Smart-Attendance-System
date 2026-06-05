const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

// Replace GlobalStyles
const globalStylesRegex = /\/\/ ==========================================\r?\n\/\/ 1\. GLOBAL STYLES & ASSETS \(INJECTED\)\r?\n\/\/ ==========================================\r?\nconst GlobalStyles = \(\) => \([\s\S]*?\r?\n\);/g;

code = code.replace(globalStylesRegex, `import GlobalStyles from './components/ui/GlobalStyles';
import Card from './components/ui/Card';
import Badge from './components/ui/Badge';`);

// Replace Card and Badge
const uiComponentsRegex = /function Card\(\{[\s\S]*?\}\r?\n\r?\nfunction Badge\(\{[\s\S]*?\}\r?\n/g;
code = code.replace(uiComponentsRegex, "");

fs.writeFileSync('src/App.jsx', code);
console.log("App.jsx refactored successfully.");
