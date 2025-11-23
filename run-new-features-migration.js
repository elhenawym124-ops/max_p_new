const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting migration for new storefront features...\n');

try {
  const backendDir = path.join(__dirname, 'backend');
  process.chdir(backendDir);
  console.log('📁 Changed to backend directory');

  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  const requiredFields = [
    'navigationEnabled',
    'soldNumberEnabled',
    'variantColorStyle',
    'stockProgressEnabled',
    'securityBadgesEnabled',
    'reasonsToPurchaseEnabled',
    'onlineVisitorsEnabled'
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
    process.exit(1);
  }

  console.log('\n📤 Running prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      cwd: backendDir 
    });
    console.log('\n✅ Migration completed successfully!');
    console.log('✅ The new features have been added to the database.');
    console.log('\n📊 New features added:');
    console.log('  - Product Navigation (Previous/Next)');
    console.log('  - Sold Number Display');
    console.log('  - Variant Styles (Color & Size)');
    console.log('  - Stock Progress Bar');
    console.log('  - Security Badges');
    console.log('  - Reasons to Purchase');
    console.log('  - Online Visitors Count');
  } catch (error) {
    console.log('\n⚠️ prisma db push failed');
    console.log('Please run the SQL migration manually');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('\n✨ Done!');


