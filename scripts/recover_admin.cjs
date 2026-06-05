const fs = require('fs');
const path = require('path');

const logPath = String.raw`C:\Users\dando\.gemini\antigravity\brain\bb030326-1e16-4b1e-986c-40c974597e99\.system_generated\logs\overview.txt`;
const targetPath = String.raw`C:\Users\dando\Downloads\Attendence\src\components\dashboards\AdminDashboard.jsx`;

try {
    const text = fs.readFileSync(logPath, 'utf8');
    const startIdx = text.lastIndexOf("The following changes were made by the multi_replace_file_content tool to: C:\\Users\\dando\\Downloads\\Attendence\\src\\components\\dashboards\\AdminDashboard.jsx");

    if (startIdx === -1) {
        console.log("No log entry found");
        process.exit(1);
    }

    const diffBlockStart = text.indexOf('[diff_block_start]', startIdx);
    const diffBlockEnd = text.indexOf('[diff_block_end]', diffBlockStart);

    if (diffBlockStart === -1 || diffBlockEnd === -1) {
        console.log("No diff block found");
        process.exit(1);
    }

    const diffText = text.substring(diffBlockStart + '[diff_block_start]'.length, diffBlockEnd);

    // Process diff to extract deleted lines
    const lines = diffText.split('\n');
    let recoveredCode = [];

    let inContext = false;

    for (const line of lines) {
        if (line.startsWith('@@')) {
            inContext = true;
            continue;
        }

        if (inContext) {
            if (line.startsWith('-')) {
                recoveredCode.push(line.substring(1));
            } else if (line.startsWith(' ')) {
                recoveredCode.push(line.substring(1));
            } else if (line.startsWith('+')) {
                // Ignore added lines, we want original
            } else {
                recoveredCode.push(line);
            }
        }
    }

    console.log("Recovered:");
    console.log(recoveredCode.join('\n').substring(0, 1000));

    fs.writeFileSync('recovered_admin.jsx', recoveredCode.join('\n'));
    console.log("Saved to recovered_admin.jsx. Length: " + recoveredCode.length);
} catch (e) {
    console.error(e);
}
