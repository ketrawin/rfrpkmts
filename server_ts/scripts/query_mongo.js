const mongoose = require('mongoose');
(async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/pokemmo_refactor');
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const u = await User.findOne({ username: 'testuser' }).lean();
    console.log('[query_mongo] result:', JSON.stringify(u, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('[query_mongo] error', e);
    process.exit(2);
  }
})();
