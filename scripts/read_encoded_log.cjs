const fs = require('fs');
try {
    const data = fs.readFileSync('scripts/migration_log.txt', 'utf16le');
    console.log(data);
} catch (e) {
    console.log("Could not read:", e.message);
}
