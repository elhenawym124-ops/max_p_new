const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const execAsync = promisify(exec);

/**
 * Script to restore database from SQL backup file
 * This script uses MySQL command line to import the SQL file
 */

// Get DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Parse database URL
const parseDatabaseUrl = (url) => {
  try {
    const dbUrl = new URL(url);
    return {
      host: dbUrl.hostname,
      port: dbUrl.port || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.substring(1)
    };
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    return null;
  }
};

const dbConfig = parseDatabaseUrl(databaseUrl);
const sqlFile = 'E:\\maxp\\u339372869_test2.sql';

console.log('🔍 [RESTORE-SQL] Database Restore from SQL File');
console.log('='.repeat(60));
console.log('📊 Database:', dbConfig.database);
console.log('📁 SQL File:', sqlFile);
console.log('='.repeat(60));

// Check if SQL file exists
if (!fs.existsSync(sqlFile)) {
  console.error(`❌ SQL file not found: ${sqlFile}`);
  process.exit(1);
}

const fileStats = fs.statSync(sqlFile);
console.log(`📦 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`📅 Last modified: ${fileStats.mtime.toLocaleString()}`);

async function restoreFromSQL() {
  try {
    console.log('\n🚀 [RESTORE-SQL] Starting restore process...');
    console.log('⚠️  [RESTORE-SQL] This will import data from SQL file');
    console.log('⚠️  [RESTORE-SQL] Existing data might be replaced!\n');
    
    // Build MySQL command
    // For Windows, we need to use mysql.exe with proper escaping
    const mysqlCommand = `mysql -h ${dbConfig.host} -P ${dbConfig.port} -u ${dbConfig.user} -p"${dbConfig.password}" ${dbConfig.database} < "${sqlFile}"`;
    
    console.log('📥 [RESTORE-SQL] Importing SQL file...');
    console.log('⏳ This may take several minutes depending on file size...\n');
    
    // Execute MySQL import
    const { stdout, stderr } = await execAsync(mysqlCommand, {
      maxBuffer: 1024 * 1024 * 100, // 100MB buffer
      shell: true
    });
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('❌ [RESTORE-SQL] Error:', stderr);
      return false;
    }
    
    if (stdout) {
      console.log('📊 [RESTORE-SQL] Output:', stdout);
    }
    
    console.log('\n✅ [RESTORE-SQL] SQL file imported successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ [RESTORE-SQL] Error:', error.message);
    
    // Check if MySQL command is available
    if (error.message.includes('mysql') || error.message.includes('not found')) {
      console.error('\n💡 [RESTORE-SQL] MySQL command line tool not found!');
      console.log('💡 [RESTORE-SQL] Alternative methods:');
      console.log('   1. Install MySQL client tools');
      console.log('   2. Use phpMyAdmin to import the SQL file');
      console.log('   3. Use MySQL Workbench to import the SQL file');
      console.log('   4. Use a different restore method');
    }
    
    return false;
  }
}

// Alternative method using Node.js to read and execute SQL
async function restoreFromSQLNode() {
  try {
    console.log('\n🚀 [RESTORE-SQL] Starting restore process (Node.js method)...');
    console.log('⚠️  [RESTORE-SQL] This will import data from SQL file');
    console.log('⚠️  [RESTORE-SQL] This method reads SQL file and executes statements\n');
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Read SQL file
    console.log('📖 [RESTORE-SQL] Reading SQL file...');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log(`✅ [RESTORE-SQL] File read: ${sqlContent.length} characters`);
    
    // Split SQL file into individual statements
    // Remove comments and split by semicolons
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
      .filter(s => !s.toLowerCase().startsWith('set ') && 
                   !s.toLowerCase().startsWith('start transaction') &&
                   !s.toLowerCase().startsWith('commit'));
    
    console.log(`📊 [RESTORE-SQL] Found ${statements.length} SQL statements`);
    console.log('⏳ [RESTORE-SQL] This may take a long time...\n');
    
    let executed = 0;
    let errors = 0;
    
    // Execute statements in batches
    const batchSize = 10;
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      
      for (const statement of batch) {
        try {
          if (statement.length > 10) { // Skip very short statements
            await prisma.$executeRawUnsafe(statement);
            executed++;
          }
        } catch (error) {
          // Skip errors for CREATE TABLE if table exists, etc.
          if (!error.message.includes('already exists') && 
              !error.message.includes('Duplicate entry')) {
            errors++;
            if (errors <= 10) { // Only show first 10 errors
              console.error(`⚠️  [RESTORE-SQL] Error in statement ${executed + errors}:`, error.message.substring(0, 100));
            }
          }
        }
      }
      
      if (i % (batchSize * 100) === 0) {
        console.log(`📊 [RESTORE-SQL] Progress: ${executed} executed, ${errors} errors`);
      }
    }
    
    await prisma.$disconnect();
    
    console.log(`\n✅ [RESTORE-SQL] Completed: ${executed} statements executed, ${errors} errors`);
    return true;
    
  } catch (error) {
    console.error('\n❌ [RESTORE-SQL] Fatal error:', error.message);
    return false;
  }
}

async function main() {
  console.log('\n🔧 [RESTORE-SQL] Choose restore method:');
  console.log('   1. MySQL command line (faster, requires MySQL client)');
  console.log('   2. Node.js method (slower, no external tools needed)');
  console.log('\n💡 Recommendation: Try method 1 first, use method 2 if MySQL client is not available\n');
  
  // Try MySQL command line first
  console.log('🔄 [RESTORE-SQL] Trying MySQL command line method...');
  const method1Success = await restoreFromSQL();
  
  if (!method1Success) {
    console.log('\n🔄 [RESTORE-SQL] MySQL command line failed, trying Node.js method...');
    const method2Success = await restoreFromSQLNode();
    
    if (!method2Success) {
      console.log('\n❌ [RESTORE-SQL] Both methods failed!');
      console.log('\n💡 [RESTORE-SQL] Manual restore options:');
      console.log('   1. Use phpMyAdmin:');
      console.log('      - Open phpMyAdmin');
      console.log('      - Select database:', dbConfig.database);
      console.log('      - Go to Import tab');
      console.log('      - Choose file:', sqlFile);
      console.log('      - Click Go');
      console.log('\n   2. Use MySQL Workbench:');
      console.log('      - Open MySQL Workbench');
      console.log('      - Connect to database');
      console.log('      - File -> Run SQL Script');
      console.log('      - Select:', sqlFile);
      console.log('      - Click Run');
      process.exit(1);
    }
  }
  
  console.log('\n✅ [RESTORE-SQL] Restore process completed!');
  console.log('💡 [RESTORE-SQL] Run "node check-database-status.js" to verify');
}

main();




