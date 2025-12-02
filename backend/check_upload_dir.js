const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'public/uploads/whatsapp/temp');

console.log('Checking directory:', baseDir);

try {
    if (!fs.existsSync(baseDir)) {
        console.log('❌ Directory does NOT exist!');
        console.log('Attempting to create it...');
        fs.mkdirSync(baseDir, { recursive: true });
        console.log('✅ Directory created.');
    } else {
        console.log('✅ Directory exists.');
    }

    const testFile = path.join(baseDir, 'test_write.txt');
    fs.writeFileSync(testFile, 'Hello World');
    console.log('✅ Write permission confirmed.');
    fs.unlinkSync(testFile);
    console.log('✅ Test file deleted.');

} catch (error) {
    console.error('❌ Error:', error);
}
