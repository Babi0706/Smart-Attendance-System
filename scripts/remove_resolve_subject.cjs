const fs = require('fs');
let code = fs.readFileSync('src/App.jsx', 'utf-8');

// Find the index of "const resolveSubjectAtTime ="
const startIndex = code.indexOf('/**\r\n * Resolves the subject for a given timestamp');
if (startIndex !== -1) {
    // Find the end index of the function
    const endIndex = code.indexOf('// ==========================================\r\n// 5. WALLET GATE', startIndex);

    if (endIndex !== -1) {
        // We only want to remove the function itself, which ends with "};\r\n" before the next section
        const actualEndIndex = code.indexOf('};\r\n', startIndex) + 4;

        const part1 = code.slice(0, startIndex);
        const part2 = code.slice(actualEndIndex);

        fs.writeFileSync('src/App.jsx', part1 + part2);
        console.log("Successfully removed resolveSubjectAtTime.");
    } else {
        console.log("Could not find the end of the section.");
    }
} else {
    console.log("Could not find resolveSubjectAtTime.");
}
