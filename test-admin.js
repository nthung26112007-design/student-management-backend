// test-admin.js
const bcrypt = require("bcrypt");

const hash = "$2b$10$.QyNS4ybC7Ii2gSsEH6LUOVZ1h8zYTilJZCCE6yq3bLWWvKOiiwB2";

bcrypt.compare("admin123", hash).then(result => {
    console.log("Khớp:", result); // true hoặc false
});