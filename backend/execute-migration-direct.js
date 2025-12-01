// Execute migration directly
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting migration...\n');

try {
    // Change to backend directory
    process.chdir(path.join(__dirname));
    
    // Execute migration
    const output = execSync('node run-migrate-now.js', {
        cwd: __dirname,
        encoding: 'utf-8',
        stdio: 'inherit'
    });
    
    console.log('\n✅ Migration completed!');
} catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
}


