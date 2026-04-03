const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@domain.com';
  const username = 'admin';
  const plainPassword = 'admin12345';

  // Check if user already exists
  const existingUser = await prisma.accounts.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`✅ User with email ${email} already exists. Skipping seed.`);
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Create the user
  const user = await prisma.accounts.create({
    data: {
      username,
      email,
      password: hashedPassword,
    },
  });

  console.log(`🎉 Seeded admin user: ${user.email} (${user.username})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });