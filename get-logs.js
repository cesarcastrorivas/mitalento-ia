const { execSync } = require('child_process');

try {
    // We use firebase functions:log but we pipe it to a file so PowerShell 
    // doesn't mangle the encoding or truncate the output randomly.
    execSync('firebase functions:log > logs.txt', { stdio: 'inherit' });
    const fs = require('fs');
    const logs = fs.readFileSync('logs.txt', 'utf8');

    // Extract only the most recent ERROR logs
    const errors = logs.split('\n')
        .filter(line => line.includes(' E ') || line.includes('Error'))
        .slice(-20);

    console.log('=== LATEST ERRORS ===');
    console.log(errors.join('\n'));
} catch (e) {
    console.error(e.message);
}
