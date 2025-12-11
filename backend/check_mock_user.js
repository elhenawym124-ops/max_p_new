const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkUser() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        const userId = 'cmem8azlv004eufakbko0wmn1';
        log(`🔍 Checking user with ID: ${userId}`);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { company: true }
        });

        if (user) {
            log('✅ User found:');
            log(`- Name: ${user.firstName} ${user.lastName}`);
            log(`- Email: ${user.email}`);
            log(`- Role: ${user.role}`);
            log(`- Company ID: ${user.companyId}`);
            log(`- Has Company Relation: ${!!user.company}`);
        } else {
            log('❌ Mock User NOT found inside the database.');
        }

        // Check if the mock token's company ID exists separately
        const companyId = 'cmem8azyrr004cufakqkcsyn97';
        const company = await prisma.company.findUnique({
            where: { id: companyId }
        });

        if (company) {
            log(`✅ Mock Company ${companyId} exists in DB: ${company.name}`);
        } else {
            log(`❌ Mock Company ${companyId} does NOT exist in DB.`);
        }

        // Find a valid admin user to replace if needed
        if (!user || !user.companyId) {
            log('\n🔍 Searching for a valid COMPANY_ADMIN...');
            const validAdmin = await prisma.user.findFirst({
                where: {
                    role: 'COMPANY_ADMIN',
                    companyId: { not: null }
                },
                include: { company: true }
            });

            if (validAdmin) {
                log('✅ Valid Alternative Admin found:');
                log(`- ID: ${validAdmin.id}`);
                log(`- Email: ${validAdmin.email}`);
                log(`- Company ID: ${validAdmin.companyId}`);
                log(`- Company Name: ${validAdmin.company?.name}`);
            } else {
                log('❌ No valid COMPANY_ADMIN found in database.');
            }
        }

    } catch (error) {
        log(`❌ Error checking user: ${error.message}`);
    } finally {
        fs.writeFileSync('db_check_result.txt', output);
        await prisma.$disconnect();
    }
}

checkUser();
