const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Running prisma generate...\n');

const backendPath = __dirname;

try {
  // Use execSync with shell: true to run the .cmd file properly
  execSync('npx prisma generate', {
    cwd: backendPath,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PATH: process.env.PATH }
  });
  
  console.log('\n✅ Prisma Client generated successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Restart your backend server');
  console.log('   2. Go to /settings/storefront-features');
  console.log('   3. Enable the new features\n');
} catch (error) {
  console.error('\n❌ Failed to generate Prisma Client');
  console.error('Error:', error.message);
  
  // Try alternative method
  console.log('\n🔄 Trying alternative method...\n');
  try {
    const prismaPath = path.join(backendPath, 'node_modules', '.bin', 'prisma.cmd');
    execSync(`"${prismaPath}" generate`, {
      cwd: backendPath,
      stdio: 'inherit',
      shell: true
    });
    console.log('\n✅ Prisma Client generated successfully!');
  } catch (error2) {
    console.error('\n❌ Both methods failed');
    console.error('Please try running manually:');
    console.error('  1. Open Command Prompt (cmd) not PowerShell');
    console.error('  2. cd to backend folder');
    console.error('  3. Run: npx prisma generate');
    process.exit(1);
  }
}

