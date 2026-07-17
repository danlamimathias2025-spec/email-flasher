const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf-8');
rules = rules.replace('      return isSignedIn() && request.auth.uid == userId;\n    }', '');

fs.writeFileSync('firestore.rules', rules);
