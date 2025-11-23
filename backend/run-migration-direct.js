const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Prisma Migration...\n');

const prismaPath = path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd');

try {
  console.log('📦 Step 1: Running prisma db push...');
  console.log('─────────────────────────────────────────────\n');
  
  execSync(`"${prismaPath}" db push --accept-data-loss`, {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('🔧 Step 2: Running prisma generate...');
  console.log('─────────────────────────────────────────────\n');
  
  execSync(`"${prismaPath}" generate`, {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('✅ Migration completed successfully!');
  console.log('─────────────────────────────────────────────\n');
  console.log('📋 New features added:');
  console.log('   ✅ Estimated Delivery Time');
  console.log('   ✅ Pre-order Product');
  console.log('   ✅ FOMO Popup\n');

} catch (error) {
  console.error('\n❌ Migration failed!');
  console.error('Error:', error.message);
  process.exit(1);
}

