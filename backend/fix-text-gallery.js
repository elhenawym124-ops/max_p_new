/**
 * Script to fix text_gallery table by adding missing columns
 * Run: node fix-text-gallery.js
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

async function fixTextGallery() {
  try {
    console.log('🔄 Fixing text_gallery table...');

    // Check current columns
    const tableInfo = await getSharedPrismaClient().$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'text_gallery'
      ORDER BY ORDINAL_POSITION
    `;

    console.log('📊 Current columns:', tableInfo);

    // Check if imageUrls exists
    const hasImageUrls = tableInfo.some(col => col.COLUMN_NAME === 'imageUrls');
    const hasIsPinned = tableInfo.some(col => col.COLUMN_NAME === 'isPinned');

    console.log(`\n📋 Status:`);
    console.log(`  - imageUrls: ${hasImageUrls ? '✅ exists' : '❌ missing'}`);
    console.log(`  - isPinned: ${hasIsPinned ? '✅ exists' : '❌ missing'}`);

    if (!hasImageUrls) {
      console.log('\n➕ Adding imageUrls column...');
      await getSharedPrismaClient().$executeRaw`
        ALTER TABLE text_gallery 
        ADD COLUMN imageUrls JSON NULL AFTER content
      `;
      console.log('✅ imageUrls column added');
    }

    if (!hasIsPinned) {
      console.log('\n➕ Adding isPinned column...');
      await getSharedPrismaClient().$executeRaw`
        ALTER TABLE text_gallery 
        ADD COLUMN isPinned BOOLEAN NOT NULL DEFAULT FALSE AFTER imageUrls
      `;
      console.log('✅ isPinned column added');
    }

    // Add index if needed
    try {
      await getSharedPrismaClient().$executeRaw`
        CREATE INDEX IF NOT EXISTS text_gallery_isPinned_idx ON text_gallery(isPinned)
      `;
      console.log('✅ Index on isPinned created/verified');
    } catch (error) {
      if (!error.message.includes('Duplicate key name')) {
        console.log('⚠️ Index might already exist:', error.message);
      }
    }

    console.log('\n✅ text_gallery table fixed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Restart your backend server');
    console.log('  2. Test the pin functionality');

  } catch (error) {
    console.error('❌ Error fixing text_gallery:', error);
    throw error;
  } finally {
    await getSharedPrismaClient().$disconnect();
  }
}

// Run the fix
fixTextGallery()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });


