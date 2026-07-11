const fetch = require('node-fetch');
const bcrypt = require('bcryptjs');

async function addUser() {
  const userId = 'newuser'; // Change this
  const name = 'New User'; // Change this
  const password = 'newuser2024'; // {username}2024 format
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  
  // You need to insert this manually or use the registration API
  console.log(`${userId}: ${hashedPassword}`);
}

addUser();