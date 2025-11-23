const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting migration...\n');

const backendPath = path.join(__dirname, 'backend');

if (!fs.existsSync(backendPath)) {
  console.error('❌ Backend directory not found!');
  process.exit(1);
}

try {
  process.chdir(backendPath);
  console.log('📁 Changed to backend directory\n');

  console.log('📦 Running: npx prisma db push --accept-data-loss');
  console.log('─────────────────────────────────────────────\n');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    cwd: backendPath,
    shell: true
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('🔧 Running: npx prisma generate');
  console.log('─────────────────────────────────────────────\n');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: backendPath,
    shell: true
  });

  console.log('\n─────────────────────────────────────────────');
  console.log('✅ Migration completed successfully!');
  console.log('─────────────────────────────────────────────\n');
  console.log('📋 New features added:');
  console.log('   ✅ Estimated Delivery Time');
  console.log('   ✅ Pre-order Product');
  console.log('   ✅ FOMO Popup\n');
  console.log('💡 Next steps:');
  console.log('   1. Restart your backend server');
  console.log('   2. Go to /settings/storefront-features');
  console.log('   3. Enable the new features\n');

} catch (error) {
  console.error('\n❌ Migration failed!');
  console.error('Error:', error.message);
  if (error.stdout) console.error('Stdout:', error.stdout.toString());
  if (error.stderr) console.error('Stderr:', error.stderr.toString());
  process.exit(1);
}

