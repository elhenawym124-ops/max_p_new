/**
 * Execute Migration - تشغيل migration مباشرة
 */

const path = require('path');

// Change to backend directory
process.chdir(__dirname);

// Import and run migration
const { main } = require('./migrate-auth.js');

// Execute
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});


