/**
 * MongoDB Atlas Connection via Mongoose
 *
 * MONGO_URI format:
 *   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
 *
 * Get this string from:
 *   MongoDB Atlas → Your Cluster → Connect → Drivers → Node.js
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('❌ MONGO_URI is not set in your .env file.');
    console.error('   Add your Atlas connection string:');
    console.error('   MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/medicore');
    process.exit(1);
  }

  if (!uri.startsWith('mongodb+srv://') && !uri.startsWith('mongodb://')) {
    console.error('❌ MONGO_URI looks invalid. It should start with mongodb+srv:// for Atlas.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      // Recommended Atlas options
      serverSelectionTimeoutMS: 10000,  // fail fast if Atlas unreachable
      socketTimeoutMS:          45000,
      maxPoolSize:              10,
    });

    const host = conn.connection.host;
    console.log(`✅ MongoDB Atlas connected → ${host}`);
    console.log(`   Database: ${conn.connection.name}`);
  } catch (err) {
    console.error(`❌ MongoDB Atlas connection failed: ${err.message}`);
    console.error('');
    console.error('   Common fixes:');
    console.error('   1. Check your MONGO_URI in .env matches Atlas exactly');
    console.error('   2. Whitelist your IP in Atlas → Network Access → Add IP Address');
    console.error('      (Use 0.0.0.0/0 to allow all IPs during development)');
    console.error('   3. Confirm your Atlas username/password are correct');
    console.error('   4. Make sure your cluster is not paused in Atlas dashboard');
    process.exit(1);
  }
};

// Handle connection events after initial connect
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB Atlas disconnected. Attempting to reconnect…');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB Atlas reconnected.');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB Atlas connection closed (app terminated).');
  process.exit(0);
});

module.exports = connectDB;
