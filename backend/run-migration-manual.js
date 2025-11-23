const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function runMigration() {
  console.log('🔧 Starting manual migration using Prisma...\n');

  const prisma = new PrismaClient();

  try {
    console.log('🔌 Connecting to database...');
    
    // Execute raw SQL to create table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS \`homepage_templates\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`companyId\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`description\` TEXT NULL,
        \`content\` LONGTEXT NOT NULL,
        \`thumbnail\` TEXT NULL,
        \`isActive\` BOOLEAN NOT NULL DEFAULT false,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        INDEX \`homepage_templates_companyId_idx\`(\`companyId\`),
        INDEX \`homepage_templates_isActive_idx\`(\`isActive\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `;

    console.log('📝 Creating homepage_templates table...');
    await prisma.$executeRawUnsafe(createTableSQL);
    console.log('✅ Table created successfully!\n');

    // Try to add foreign key (might fail if already exists)
    try {
      const addForeignKeySQL = `
        ALTER TABLE \`homepage_templates\` 
        ADD CONSTRAINT \`homepage_templates_companyId_fkey\` 
        FOREIGN KEY (\`companyId\`) 
        REFERENCES \`companies\`(\`id\`) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
      `;
      
      console.log('🔗 Adding foreign key constraint...');
      await prisma.$executeRawUnsafe(addForeignKeySQL);
      console.log('✅ Foreign key added successfully!\n');
    } catch (fkError) {
      if (fkError.code === 'ER_DUP_KEYNAME' || fkError.message.includes('Duplicate')) {
        console.log('⚠️  Foreign key already exists (OK)\n');
      } else {
        console.log('⚠️  Could not add foreign key:', fkError.message, '\n');
      }
    }

    // Verify table exists
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'homepage_templates'`;
    
    if (tables && tables.length > 0) {
      console.log('✅ Table "homepage_templates" verified!');
      
      // Show table structure
      const columns = await prisma.$queryRaw`DESCRIBE homepage_templates`;
      console.log('\n📋 Table structure:');
      columns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ You can now use the homepage system.\n');
    console.log('💡 Tip: Restart your backend server to ensure all changes are loaded.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
      console.log('\n⚠️  Table already exists. Migration might have run before.');
      console.log('✅ This is OK - your system should work fine!\n');
    } else {
      console.error('\nFull error:', error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed.');
  }
}

runMigration();
