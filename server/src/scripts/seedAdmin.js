/* eslint-disable no-console */
const { connectDB } = require('../config/db');
const { logger } = require('../config/logger');
const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL } = require('../config/env');
const User = require('../models/user/user.model');
const { hashPassword } = require('../utils/passwordUtils');

async function main() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('❌ Missing ADMIN_USERNAME or ADMIN_PASSWORD in environment variables.');
    process.exit(1);
  }

  await connectDB();

  // Check if an Admin user already exists
  const existing = await User.findOne({ username: ADMIN_USERNAME });
  if (existing) {
    console.log(`⚠️  Admin user "${ADMIN_USERNAME}" already exists (id: ${existing._id}).`);
    process.exit(0);
  }

  // Create Admin user
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await User.create({
    username: ADMIN_USERNAME,
    passwordHash,
    email: ADMIN_EMAIL || undefined,
    role: 'Admin',
    active: true,
  });

  logger.info(`✅ Created admin user "${admin.username}" (id: ${admin._id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error seeding admin:', err);
  process.exit(1);
});
