// temp_hasher.js (Create this file temporarily)
const bcrypt = require('bcryptjs');

const plainPassword = 'admin123';
const saltRounds = 10; // Standard salt rounds

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log('--- Copy this Hash ---');
  console.log(hash);
  console.log('----------------------');
});