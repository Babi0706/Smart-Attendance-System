const fs = require('fs');
const content = fs.readFileSync('scripts/migration_log.txt', 'utf8');
console.log(content);
