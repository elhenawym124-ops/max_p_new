const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting migration for new features (Estimated Delivery, Pre-order, FOMO)...\n');

try {
  // Navigate to backend directory
  const backendPath = path.join(__dirname, 'backend');
  process.chdir(backendPath);
  console.log('📁 Changed directory to:', backendPath);

  // Run prisma db push
  console.log('\n📦 Running prisma db push...');
  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    cwd: backendPath
  });

  // Run prisma generate
  console.log('\n🔧 Running prisma generate...');
  execSync('npx prisma generate', {
    stdio: 'inherit',
    cwd: backendPath
  });

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📋 New features added:');
  console.log('   - Estimated Delivery Time');
  console.log('   - Pre-order Product');
  console.log('   - FOMO Popup');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  process.exit(1);
}

