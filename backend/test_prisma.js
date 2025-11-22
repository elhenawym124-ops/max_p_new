/**
 * Test Prisma Client
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('✅ Prisma Client loaded successfully');
    
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test query (just check if we can query)
    const count = await prisma.company.count();
    console.log(`✅ Database accessible - Companies count: ${count}`);
    
    await prisma.$disconnect();
    console.log('✅ Prisma disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

test();

