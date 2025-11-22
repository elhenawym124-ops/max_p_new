const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearToken() {
  await prisma.company.update({
    where: { id: 'cmem8ayyr004cufakqkcsyn97' },
    data: { facebookUserAccessToken: null }
  });
  console.log('✅ Token cleared');
  await prisma.$disconnect();
}

clearToken();
