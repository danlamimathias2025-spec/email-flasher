const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

// Remove all endpoints from // Register endpoint to end, but before app.listen or similar.
// Actually, it's easier to just let them be, they don't hurt.
// Wait, they read/write to /tmp/users.json, which is harmless.
