const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting migration for Sticky Add to Cart improvements...\n');

try {
  // Change to backend directory
  const backendDir = path.join(__dirname, 'backend');
  process.chdir(backendDir);
  console.log('📁 Changed to backend directory');

  // Check if prisma schema has the new fields
  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  const requiredFields = [
    'stickyScrollThreshold',
    'stickyShowBuyNow',
    'stickyTrackAnalytics',
    'stickyAutoScrollToCheckout'
  ];

  let allFieldsExist = true;
  requiredFields.forEach(field => {
    if (schemaContent.includes(field)) {
      console.log(`✅ ${field} field found in schema.prisma`);
    } else {
      console.log(`❌ ${field} field NOT found in schema.prisma`);
      allFieldsExist = false;
    }
  });

  if (!allFieldsExist) {
    console.log('\n⚠️ Some fields are missing in schema.prisma');
    console.log('Please make sure all fields are added to the schema first.');
    process.exit(1);
  }

  // Run prisma db push
  console.log('\n📤 Running prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      cwd: backendDir 
    });
    console.log('\n✅ Migration completed successfully!');
    console.log('✅ The new Sticky Add to Cart fields have been added to the database.');
    console.log('\n📊 New fields added:');
    console.log('  - stickyScrollThreshold (INT, default: 300)');
    console.log('  - stickyShowBuyNow (BOOLEAN, default: true)');
    console.log('  - stickyTrackAnalytics (BOOLEAN, default: true)');
    console.log('  - stickyAutoScrollToCheckout (BOOLEAN, default: false)');
  } catch (error) {
    console.log('\n⚠️ prisma db push failed, trying prisma generate...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: backendDir 
    });
    console.log('\n✅ Prisma Client generated successfully.');
    console.log('⚠️ Please run the SQL migration manually or use prisma migrate dev');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('\n✨ Done!');

