const { execSync } = require('child_process');
const path = require('path');

const prismaPath = path.join(__dirname, 'node_modules', 'prisma', 'build', 'index.js');

console.log('🔄 تحديث Prisma Client...');
console.log('📦 مسار Prisma:', prismaPath);

try {
  execSync(`node "${prismaPath}" generate`, {
    stdio: 'inherit',
    cwd: __dirname
  });
  console.log('✅ تم تحديث Prisma Client بنجاح!');
} catch (error) {
  console.error('❌ حدث خطأ:', error.message);
  process.exit(1);
}

