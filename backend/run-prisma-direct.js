const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Prisma Migration (Direct Method)...\n');

const prismaCmd = process.platform === 'win32' 
  ? path.join(__dirname, 'node_modules', '.bin', 'prisma.cmd')
  : path.join(__dirname, 'node_modules', '.bin', 'prisma');

// Step 1: db push
console.log('📦 Step 1: Running prisma db push...');
console.log('─────────────────────────────────────────────\n');

const pushProcess = spawn(prismaCmd, ['db', 'push', '--accept-data-loss'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

pushProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ prisma db push failed with code ${code}`);
    process.exit(1);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('🔧 Step 2: Running prisma generate...');
  console.log('─────────────────────────────────────────────\n');

  // Step 2: generate
  const generateProcess = spawn(prismaCmd, ['generate'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  generateProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`\n❌ prisma generate failed with code ${code}`);
      process.exit(1);
    }

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
  });
});

