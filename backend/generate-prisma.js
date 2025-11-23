const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 Running prisma generate...\n');

const backendPath = __dirname;
const prismaCmd = path.join(backendPath, 'node_modules', '.bin', 'prisma.cmd');

try {
  execSync(`"${prismaCmd}" generate`, {
    cwd: backendPath,
    stdio: 'inherit',
    shell: true
  });
  
  console.log('\n✅ Prisma Client generated successfully!');
  console.log('\n💡 Next steps:');
  console.log('   1. Restart your backend server');
  console.log('   2. Go to /settings/storefront-features');
  console.log('   3. Enable the new features\n');
} catch (error) {
  console.error('\n❌ Failed to generate Prisma Client');
  console.error('Error:', error.message);
  process.exit(1);
}

