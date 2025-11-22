const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting migration for sizeGuide column...\n');

try {
  // Change to backend directory
  const backendDir = path.join(__dirname, 'backend');
  process.chdir(backendDir);
  console.log('📁 Changed to backend directory');

  // Check if prisma schema has sizeGuide
  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  if (schemaContent.includes('sizeGuide')) {
    console.log('✅ sizeGuide field found in schema.prisma');
  } else {
    console.log('❌ sizeGuide field NOT found in schema.prisma');
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
    console.log('✅ The sizeGuide column has been added to the products table.');
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

