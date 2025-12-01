/**
 * 🔄 Execute Migration - تشغيل migration مباشرة
 */

// Ensure we're in the right directory
const path = require('path');
const originalDir = process.cwd();
process.chdir(__dirname);

// Load environment variables if needed
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import migration
const { main } = require('./migrate-auth.js');

// Execute
console.log('🚀 Starting migration...\n');
main()
    .then(() => {
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    });


