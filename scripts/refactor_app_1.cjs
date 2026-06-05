const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

// Replace GlobalStyles
const globalStylesRegex = /\/\/ ==========================================\n\/\/ 1\. GLOBAL STYLES & ASSETS \(INJECTED\)\n\/\/ ==========================================\nconst GlobalStyles = \(\) => \([\s\S]*?\n\);/g;

code = code.replace(globalStylesRegex, `import GlobalStyles from './components/ui/GlobalStyles';
import Card from './components/ui/Card';
import Badge from './components/ui/Badge';`);

// Replace Card and Badge
const uiComponentsRegex = /function Card\(\{[\s\S]*?\}\n\nfunction Badge\(\{[\s\S]*?\}\n/g;
code = code.replace(uiComponentsRegex, "");

fs.writeFileSync('src/App.jsx', code);
console.log("App.jsx refactored successfully.");
