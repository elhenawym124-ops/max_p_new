const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Script to restore data from backup database (u339372869_test2)
 * to the current database
 */

// Get current DATABASE_URL
const currentDbUrl = process.env.DATABASE_URL;
if (!currentDbUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Parse current database URL
const parseDatabaseUrl = (url) => {
  try {
    const dbUrl = new URL(url);
    return {
      host: dbUrl.hostname,
      port: dbUrl.port || 3306,
      user: dbUrl.username,
      password: dbUrl.password,
      database: dbUrl.pathname.substring(1) // Remove leading /
    };
  } catch (error) {
    console.error('❌ Error parsing DATABASE_URL:', error.message);
    return null;
  }
};

const currentDb = parseDatabaseUrl(currentDbUrl);
const backupDbName = 'u339372869_test2';

console.log('🔍 [RESTORE] Database Restore Script');
console.log('='.repeat(60));
console.log('📊 Current Database:', currentDb.database);
console.log('📦 Backup Database:', backupDbName);
console.log('='.repeat(60));

async function checkBackupDatabase() {
  try {
    console.log('\n🔍 [RESTORE] Checking backup database...');
    
    // Connect to MySQL server (without specifying database)
    const connection = await mysql.createConnection({
      host: currentDb.host,
      port: currentDb.port,
      user: currentDb.user,
      password: currentDb.password
    });
    
    // Check if backup database exists
    const [databases] = await connection.execute(
      'SHOW DATABASES LIKE ?',
      [backupDbName]
    );
    
    if (databases.length === 0) {
      console.log(`❌ [RESTORE] Backup database "${backupDbName}" not found!`);
      console.log('💡 [RESTORE] Available databases:');
      
      const [allDatabases] = await connection.execute('SHOW DATABASES');
      allDatabases.forEach(db => {
        console.log(`   - ${db.Database}`);
      });
      
      await connection.end();
      return false;
    }
    
    console.log(`✅ [RESTORE] Backup database "${backupDbName}" found!`);
    
    // Connect to backup database
    const backupConnection = await mysql.createConnection({
      host: currentDb.host,
      port: currentDb.port,
      user: currentDb.user,
      password: currentDb.password,
      database: backupDbName
    });
    
    // Get table counts from backup database
    console.log('\n📊 [RESTORE] Backup database statistics:');
    const tables = [
      'users', 'companies', 'customers', 'conversations', 'messages',
      'products', 'orders', 'facebookPages', 'facebookComments',
      'categories', 'integrations', 'userInvitations', 'aiInteractions',
      'tasks', 'projects'
    ];
    
    const backupStats = {};
    for (const table of tables) {
      try {
        const [rows] = await backupConnection.execute(
          `SELECT COUNT(*) as count FROM \`${table}\``
        );
        backupStats[table] = rows[0].count;
        if (rows[0].count > 0) {
          console.log(`   ✅ ${table}: ${rows[0].count} records`);
        }
      } catch (error) {
        // Table might not exist, skip it
        backupStats[table] = 0;
      }
    }
    
    await backupConnection.end();
    await connection.end();
    
    return backupStats;
    
  } catch (error) {
    console.error('❌ [RESTORE] Error checking backup database:', error.message);
    return false;
  }
}

async function restoreTable(tableName, primaryKey = 'id') {
  try {
    console.log(`\n📦 [RESTORE] Restoring table: ${tableName}...`);
    
    // Create connections
    const currentConnection = await mysql.createConnection({
      host: currentDb.host,
      port: currentDb.port,
      user: currentDb.user,
      password: currentDb.password,
      database: currentDb.database
    });
    
    const backupConnection = await mysql.createConnection({
      host: currentDb.host,
      port: currentDb.port,
      user: currentDb.user,
      password: currentDb.password,
      database: backupDbName
    });
    
    // Check if table exists in backup
    const [backupTables] = await backupConnection.execute(
      `SHOW TABLES LIKE '${tableName}'`
    );
    
    if (backupTables.length === 0) {
      console.log(`   ⚠️  Table ${tableName} not found in backup database`);
      await currentConnection.end();
      await backupConnection.end();
      return { success: false, reason: 'table_not_found' };
    }
    
    // Get data from backup
    const [backupData] = await backupConnection.execute(
      `SELECT * FROM \`${tableName}\``
    );
    
    if (backupData.length === 0) {
      console.log(`   ⚠️  Table ${tableName} is empty in backup database`);
      await currentConnection.end();
      await backupConnection.end();
      return { success: false, reason: 'empty_table' };
    }
    
    console.log(`   📥 Found ${backupData.length} records in backup`);
    
    // Get table structure to build INSERT query
    const [columns] = await backupConnection.execute(
      `DESCRIBE \`${tableName}\``
    );
    const columnNames = columns.map(col => col.Field).join(', ');
    
    // Check existing records in current database
    const [existingRecords] = await currentConnection.execute(
      `SELECT ${primaryKey} FROM \`${tableName}\``
    );
    const existingIds = new Set(existingRecords.map(r => r[primaryKey]));
    
    // Filter out existing records
    const newRecords = backupData.filter(record => !existingIds.has(record[primaryKey]));
    
    if (newRecords.length === 0) {
      console.log(`   ⚠️  All records already exist in current database`);
      await currentConnection.end();
      await backupConnection.end();
      return { success: true, inserted: 0, skipped: backupData.length };
    }
    
    console.log(`   📤 Inserting ${newRecords.length} new records...`);
    
    // Insert records in batches
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      
      // Build INSERT query with values
      const placeholders = batch.map(() => 
        `(${columns.map(() => '?').join(', ')})`
      ).join(', ');
      
      const values = batch.flatMap(record => 
        columns.map(col => record[col.Field])
      );
      
      const insertQuery = `INSERT INTO \`${tableName}\` (${columnNames}) VALUES ${placeholders}`;
      
      try {
        await currentConnection.execute(insertQuery, values);
        inserted += batch.length;
        console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      } catch (error) {
        console.error(`   ❌ Error inserting batch:`, error.message);
        // Continue with next batch
      }
    }
    
    await currentConnection.end();
    await backupConnection.end();
    
    console.log(`   ✅ [RESTORE] Table ${tableName}: ${inserted} records inserted, ${backupData.length - inserted} skipped`);
    
    return { success: true, inserted, skipped: backupData.length - inserted };
    
  } catch (error) {
    console.error(`   ❌ [RESTORE] Error restoring table ${tableName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  try {
    // Check backup database
    const backupStats = await checkBackupDatabase();
    
    if (!backupStats) {
      console.log('\n❌ [RESTORE] Cannot proceed without backup database');
      process.exit(1);
    }
    
    // Ask user which tables to restore
    console.log('\n📋 [RESTORE] Tables to restore:');
    const tablesToRestore = [];
    
    // Priority order: companies first, then users, then everything else
    const priorityTables = ['companies', 'users'];
    const otherTables = Object.keys(backupStats).filter(
      table => !priorityTables.includes(table) && backupStats[table] > 0
    );
    
    const allTables = [...priorityTables, ...otherTables];
    
    console.log('\n🚀 [RESTORE] Starting restore process...');
    console.log('⚠️  [RESTORE] This will restore data from backup database');
    console.log('⚠️  [RESTORE] Existing records will be skipped (by ID)\n');
    
    // Restore tables in order
    const results = {};
    
    for (const table of allTables) {
      if (backupStats[table] > 0) {
        results[table] = await restoreTable(table);
        // Small delay between tables to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 [RESTORE] Restore Summary');
    console.log('='.repeat(60));
    
    let totalInserted = 0;
    let totalSkipped = 0;
    
    Object.entries(results).forEach(([table, result]) => {
      if (result.success) {
        console.log(`✅ ${table}: ${result.inserted} inserted, ${result.skipped} skipped`);
        totalInserted += result.inserted;
        totalSkipped += result.skipped;
      } else {
        console.log(`❌ ${table}: Failed - ${result.error || result.reason}`);
      }
    });
    
    console.log('='.repeat(60));
    console.log(`📈 Total: ${totalInserted} records inserted, ${totalSkipped} records skipped`);
    console.log('='.repeat(60));
    
    console.log('\n✅ [RESTORE] Restore process completed!');
    console.log('💡 [RESTORE] Run "node check-database-status.js" to verify');
    
  } catch (error) {
    console.error('\n❌ [RESTORE] Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Install mysql2 if not available
if (!require('mysql2')) {
  console.log('❌ mysql2 package is required. Install it with:');
  console.log('   npm install mysql2');
  process.exit(1);
}

// Run the restore
main();




