const { PrismaClient } = require('@prisma/client');

/**
 * Script to restore data from backup database (u339372869_test2)
 * This script connects to the backup database and copies data to current database
 */

// Get current DATABASE_URL
const currentDbUrl = process.env.DATABASE_URL;
if (!currentDbUrl) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Parse database URL and create backup URL
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

// Create backup database URL
const backupDbUrl = `mysql://${currentDb.user}:${currentDb.password}@${currentDb.host}:${currentDb.port}/${backupDbName}`;

console.log('🔍 [RESTORE] Database Restore Script (Prisma)');
console.log('='.repeat(60));
console.log('📊 Current Database:', currentDb.database);
console.log('📦 Backup Database:', backupDbName);
console.log('='.repeat(60));

// Create Prisma clients for both databases
const currentPrisma = new PrismaClient({
  datasources: {
    db: {
      url: currentDbUrl
    }
  }
});

const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: backupDbUrl
    }
  }
});

async function checkBackupDatabase() {
  try {
    console.log('\n🔍 [RESTORE] Checking backup database...');
    
    // Test connection to backup database
    await backupPrisma.$connect();
    console.log(`✅ [RESTORE] Connected to backup database "${backupDbName}"`);
    
    // Get statistics from backup database
    console.log('\n📊 [RESTORE] Backup database statistics:');
    
    const backupStats = {
      users: await backupPrisma.user.count(),
      companies: await backupPrisma.company.count(),
      customers: await backupPrisma.customer.count(),
      conversations: await backupPrisma.conversation.count(),
      messages: await backupPrisma.message.count(),
      products: await backupPrisma.product.count(),
      orders: await backupPrisma.order.count(),
      facebookPages: await backupPrisma.facebookPage.count(),
      facebookComments: await backupPrisma.facebookComment.count(),
      categories: await backupPrisma.category.count(),
      integrations: await backupPrisma.integration.count(),
      userInvitations: await backupPrisma.userInvitation.count(),
      aiInteractions: await backupPrisma.aiInteraction.count(),
      tasks: await backupPrisma.task.count(),
      projects: await backupPrisma.project.count()
    };
    
    Object.entries(backupStats).forEach(([table, count]) => {
      if (count > 0) {
        console.log(`   ✅ ${table}: ${count} records`);
      }
    });
    
    return backupStats;
    
  } catch (error) {
    console.error('❌ [RESTORE] Error connecting to backup database:', error.message);
    if (error.message.includes('Unknown database')) {
      console.error(`\n❌ Database "${backupDbName}" does not exist!`);
      console.log('\n💡 Available databases might be:');
      console.log('   - Check your database server for available databases');
      console.log('   - Make sure the backup database name is correct');
    }
    return null;
  }
}

async function restoreCompanies() {
  try {
    console.log('\n📦 [RESTORE] Restoring companies...');
    
    const backupCompanies = await backupPrisma.company.findMany();
    console.log(`   📥 Found ${backupCompanies.length} companies in backup`);
    
    if (backupCompanies.length === 0) {
      console.log('   ⚠️  No companies to restore');
      return { success: true, inserted: 0, skipped: 0 };
    }
    
    // Get existing company IDs
    const existingCompanies = await currentPrisma.company.findMany({
      select: { id: true }
    });
    const existingIds = new Set(existingCompanies.map(c => c.id));
    
    // Filter new companies
    const newCompanies = backupCompanies.filter(c => !existingIds.has(c.id));
    
    if (newCompanies.length === 0) {
      console.log('   ⚠️  All companies already exist');
      return { success: true, inserted: 0, skipped: backupCompanies.length };
    }
    
    console.log(`   📤 Inserting ${newCompanies.length} new companies...`);
    
    // Insert companies one by one to handle errors
    let inserted = 0;
    let skipped = 0;
    
    for (const company of newCompanies) {
      try {
        // Remove id to let Prisma generate new one, or use existing id
        const { id, ...companyData } = company;
        
        await currentPrisma.company.create({
          data: {
            ...companyData,
            id: id // Use same ID to maintain relationships
          }
        });
        inserted++;
      } catch (error) {
        if (error.code === 'P2002') {
          // Unique constraint violation - already exists
          skipped++;
        } else {
          console.error(`   ❌ Error inserting company ${company.name}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Companies: ${inserted} inserted, ${skipped} skipped`);
    return { success: true, inserted, skipped };
    
  } catch (error) {
    console.error('   ❌ Error restoring companies:', error.message);
    return { success: false, error: error.message };
  }
}

async function restoreUsers() {
  try {
    console.log('\n📦 [RESTORE] Restoring users...');
    
    const backupUsers = await backupPrisma.user.findMany({
      include: {
        company: true
      }
    });
    console.log(`   📥 Found ${backupUsers.length} users in backup`);
    
    if (backupUsers.length === 0) {
      console.log('   ⚠️  No users to restore');
      return { success: true, inserted: 0, skipped: 0 };
    }
    
    // Get existing user IDs
    const existingUsers = await currentPrisma.user.findMany({
      select: { id: true }
    });
    const existingIds = new Set(existingUsers.map(u => u.id));
    
    // Filter new users
    const newUsers = backupUsers.filter(u => !existingIds.has(u.id));
    
    if (newUsers.length === 0) {
      console.log('   ⚠️  All users already exist');
      return { success: true, inserted: 0, skipped: backupUsers.length };
    }
    
    console.log(`   📤 Inserting ${newUsers.length} new users...`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const user of newUsers) {
      try {
        const { id, company, ...userData } = user;
        
        // Check if company exists in current database
        const companyExists = await currentPrisma.company.findUnique({
          where: { id: user.companyId }
        });
        
        if (!companyExists) {
          console.log(`   ⚠️  User ${user.email} skipped - company not found`);
          skipped++;
          continue;
        }
        
        await currentPrisma.user.create({
          data: {
            ...userData,
            id: id, // Use same ID
            companyId: user.companyId
          }
        });
        inserted++;
      } catch (error) {
        if (error.code === 'P2002') {
          skipped++;
        } else {
          console.error(`   ❌ Error inserting user ${user.email}:`, error.message);
        }
      }
    }
    
    console.log(`   ✅ Users: ${inserted} inserted, ${skipped} skipped`);
    return { success: true, inserted, skipped };
    
  } catch (error) {
    console.error('   ❌ Error restoring users:', error.message);
    return { success: false, error: error.message };
  }
}

async function restoreTable(tableName, model) {
  try {
    console.log(`\n📦 [RESTORE] Restoring ${tableName}...`);
    
    const backupData = await backupPrisma[model].findMany();
    console.log(`   📥 Found ${backupData.length} records in backup`);
    
    if (backupData.length === 0) {
      console.log(`   ⚠️  No ${tableName} to restore`);
      return { success: true, inserted: 0, skipped: 0 };
    }
    
    // Get existing IDs
    const existingData = await currentPrisma[model].findMany({
      select: { id: true }
    });
    const existingIds = new Set(existingData.map(d => d.id));
    
    // Filter new records
    const newRecords = backupData.filter(d => !existingIds.has(d.id));
    
    if (newRecords.length === 0) {
      console.log(`   ⚠️  All ${tableName} already exist`);
      return { success: true, inserted: 0, skipped: backupData.length };
    }
    
    console.log(`   📤 Inserting ${newRecords.length} new records...`);
    
    // Insert in batches
    const batchSize = 50;
    let inserted = 0;
    let skipped = 0;
    
    for (let i = 0; i < newRecords.length; i += batchSize) {
      const batch = newRecords.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          const { id, ...recordData } = record;
          await currentPrisma[model].create({
            data: {
              ...recordData,
              id: id
            }
          });
          inserted++;
        } catch (error) {
          if (error.code === 'P2002') {
            skipped++;
          } else if (error.code === 'P2003') {
            // Foreign key constraint - related record doesn't exist
            skipped++;
          } else {
            console.error(`   ⚠️  Error inserting record:`, error.message);
            skipped++;
          }
        }
      }
      
      if (i % (batchSize * 10) === 0) {
        console.log(`   📊 Progress: ${inserted} inserted, ${skipped} skipped`);
      }
    }
    
    console.log(`   ✅ ${tableName}: ${inserted} inserted, ${skipped} skipped`);
    return { success: true, inserted, skipped };
    
  } catch (error) {
    console.error(`   ❌ Error restoring ${tableName}:`, error.message);
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
    
    console.log('\n🚀 [RESTORE] Starting restore process...');
    console.log('⚠️  [RESTORE] This will restore data from backup database');
    console.log('⚠️  [RESTORE] Existing records will be skipped\n');
    
    const results = {};
    
    // Restore in order: companies first, then users, then everything else
    if (backupStats.companies > 0) {
      results.companies = await restoreCompanies();
    }
    
    if (backupStats.users > 0) {
      results.users = await restoreUsers();
    }
    
    // Restore other tables
    const tablesToRestore = [
      { name: 'customers', model: 'customer' },
      { name: 'conversations', model: 'conversation' },
      { name: 'messages', model: 'message' },
      { name: 'products', model: 'product' },
      { name: 'orders', model: 'order' },
      { name: 'facebookPages', model: 'facebookPage' },
      { name: 'facebookComments', model: 'facebookComment' },
      { name: 'categories', model: 'category' },
      { name: 'integrations', model: 'integration' },
      { name: 'userInvitations', model: 'userInvitation' },
      { name: 'aiInteractions', model: 'aiInteraction' },
      { name: 'tasks', model: 'task' },
      { name: 'projects', model: 'project' }
    ];
    
    for (const { name, model } of tablesToRestore) {
      if (backupStats[name] > 0) {
        results[name] = await restoreTable(name, model);
        // Small delay to avoid overwhelming the database
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
        console.log(`❌ ${table}: Failed - ${result.error}`);
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
  } finally {
    await currentPrisma.$disconnect();
    await backupPrisma.$disconnect();
  }
}

// Run the restore
main().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});




