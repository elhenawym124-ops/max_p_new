const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔄 Updating Prisma Client (with retry logic)...\n');

try {
  const backendDir = path.join(__dirname, 'backend');
  process.chdir(backendDir);
  
  console.log('📁 Changed to backend directory');
  
  // Try to delete the problematic file if it exists
  const dllPath = path.join(backendDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
  const tmpDllPath = path.join(backendDir, 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node.tmp*');
  
  console.log('🔧 Running prisma generate...\n');
  
  // Try multiple times
  let success = false;
  for (let i = 0; i < 3; i++) {
    try {
      execSync('npx prisma generate', { 
        stdio: 'inherit',
        cwd: backendDir,
        timeout: 30000
      });
      success = true;
      break;
    } catch (error) {
      if (i < 2) {
        console.log(`\n⚠️ Attempt ${i + 1} failed, retrying in 2 seconds...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }
  }
  
  if (success) {
    console.log('\n✅ Prisma Client updated successfully!');
    console.log('✅ The sizeGuide field is now available in Prisma Client.');
    console.log('\n✨ You can now save products with sizeGuide field!');
    console.log('\n⚠️ Note: If the server is running, please restart it to use the updated Prisma Client.');
  }
  
} catch (error) {
  console.error('\n❌ Error updating Prisma Client:', error.message);
  console.log('\n💡 Solution:');
  console.log('1. Stop your backend server (if running)');
  console.log('2. Run: cd backend && npx prisma generate');
  console.log('3. Restart your backend server');
  process.exit(1);
}

