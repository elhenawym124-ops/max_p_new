const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Updating Prisma Client...\n');

try {
  const backendDir = path.join(__dirname, 'backend');
  process.chdir(backendDir);
  
  console.log('📁 Changed to backend directory');
  console.log('🔧 Running prisma generate...\n');
  
  execSync('npx prisma generate', { 
    stdio: 'inherit',
    cwd: backendDir 
  });
  
  console.log('\n✅ Prisma Client updated successfully!');
  console.log('✅ The sizeGuide field is now available in Prisma Client.');
  console.log('\n✨ You can now save products with sizeGuide field!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

