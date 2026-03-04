// パスワードハッシュ生成スクリプト
const bcrypt = require('bcrypt');

const password = 'demo123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  console.log('Password hash for "demo123":');
  console.log(hash);
  console.log('\nRun this SQL to update the demo user:');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE username = 'demo';`);
});
