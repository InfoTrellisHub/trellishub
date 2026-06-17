// One-off local helper: node scripts/hash-password.js "your-password-here"
// Prints a bcrypt hash to paste into ADMIN_PASSWORD_HASH_1 / _2 in Vercel env vars.
const bcrypt = require('bcryptjs');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "your-password-here"');
  process.exit(1);
}

bcrypt.hash(password, 12, (err, hash) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(hash);
});
