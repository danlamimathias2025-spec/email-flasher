const fs = require('fs');

let rules = fs.readFileSync('firestore.rules', 'utf-8');

if (!rules.includes('isValidId')) {
  rules = rules.replace('function isOwner(userId) {', 
    'function isValidId(id) { return id is string && id.size() <= 128 && id.matches("^[a-zA-Z0-9_\\\\-]+$"); }\n    function isOwner(userId) {\n      return isValidId(userId) && isSignedIn() && request.auth.uid == userId;\n    }'
  );
}

fs.writeFileSync('firestore.rules', rules);
