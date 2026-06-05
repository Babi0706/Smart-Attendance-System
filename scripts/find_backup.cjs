const fs = require('fs');
const path = require('path');
const os = require('os');

const historyDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'History');

function searchHistory() {
    if (!fs.existsSync(historyDir)) {
        console.log('No history dir found');
        return;
    }

    const matches = [];
    const dirs = fs.readdirSync(historyDir);

    for (const dir of dirs) {
        const fullDir = path.join(historyDir, dir);
        if (!fs.statSync(fullDir).isDirectory()) continue;

        try {
            const files = fs.readdirSync(fullDir);
            for (const file of files) {
                if (file === 'entries.json') continue;

                const filePath = path.join(fullDir, file);
                const stats = fs.statSync(filePath);

                // only check recent files (last 7 days)
                if (Date.now() - stats.mtimeMs > 7 * 24 * 60 * 60 * 1000) continue;

                const content = fs.readFileSync(filePath, 'utf8');
                if (content.includes('export default // --- Teacher View ---') || content.includes('function TeacherDashboard({ user')) {
                    if (content.includes('setKioskActive(')) {
                        matches.push({ file: filePath, time: stats.mtimeMs, size: content.length });
                    }
                }
            }
        } catch (e) {
            // ignore
        }
    }

    matches.sort((a, b) => b.time - a.time);
    console.log("Found matches:");
    matches.slice(0, 5).forEach(m => {
        console.log(`File: ${m.file}, Time: ${new Date(m.time).toISOString()}, Size: ${m.size}`);
    });
}
searchHistory();
