const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://Reyrove:Reyhan76@cluster0.zaizl4g.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function updatePasswords() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const users = ['papa', 'reyhan', 'pedram', 'palmer'];
    
    for (const userId of users) {
      const password = userId + '2024';
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      
      await db.collection('users').updateOne(
        { userId: userId },
        { $set: { password: hash } }
      );
      
      console.log(`✅ Updated ${userId} password`);
    }
    
    console.log('All passwords updated!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updatePasswords();