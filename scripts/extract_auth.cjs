const fs = require('fs');

let code = fs.readFileSync('src/App.jsx', 'utf-8');

// Find start and end of the block containing the three auth screens
const walletGateIndex = code.indexOf('function WalletGateScreen');
const dashboardControllerIndex = code.indexOf('// ==========================================\r\n// 6. DASHBOARDS');

if (walletGateIndex !== -1 && dashboardControllerIndex !== -1) {
    const screensCode = code.slice(walletGateIndex, dashboardControllerIndex);

    // Split into individual screens
    const splashIndex = screensCode.indexOf('function SplashScreen');
    const authScreenIndex = screensCode.indexOf('function AuthScreen');

    const walletGateCode = screensCode.slice(0, splashIndex);
    const splashCode = screensCode.slice(splashIndex, authScreenIndex);
    const authCode = screensCode.slice(authScreenIndex);

    const walletGateFile = `import React, { useState } from 'react';\nimport GlobalStyles from '../ui/GlobalStyles';\nimport Card from '../ui/Card';\n\nexport default ${walletGateCode}`;
    const splashFile = `import React from 'react';\nimport GlobalStyles from '../ui/GlobalStyles';\n\nexport default ${splashCode}`;
    const authFile = `import React, { useState, useRef, useEffect } from 'react';\nimport authService from '../../services/authService';\nimport faceService from '../../services/faceService';\nimport GlobalStyles from '../ui/GlobalStyles';\nimport Card from '../ui/Card';\nimport Badge from '../ui/Badge';\n\nexport default ${authCode}`;

    fs.writeFileSync('src/components/auth/WalletGateScreen.jsx', walletGateFile);
    fs.writeFileSync('src/components/auth/SplashScreen.jsx', splashFile);
    fs.writeFileSync('src/components/auth/AuthScreen.jsx', authFile);

    // Replace the block in App.jsx with imports
    const newAppCode = code.slice(0, walletGateIndex) +
        "import WalletGateScreen from './components/auth/WalletGateScreen';\n" +
        "import SplashScreen from './components/auth/SplashScreen';\n" +
        "import AuthScreen from './components/auth/AuthScreen';\n\n" +
        code.slice(dashboardControllerIndex);

    fs.writeFileSync('src/App.jsx', newAppCode);
    console.log("Successfully extracted Auth screens.");
} else {
    console.log("Could not find Auth screens boundaries.");
}
