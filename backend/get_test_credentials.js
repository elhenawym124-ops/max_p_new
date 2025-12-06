const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function getCredentials() {
    try {
        const prisma = getSharedPrismaClient();

        // Get the first company with WooCommerce settings
        const settings = await prisma.wooCommerceSettings.findFirst({
            where: { webhookEnabled: true }
        });

        if (settings) {
            console.log('JSON_OUTPUT_START');
            console.log(JSON.stringify({
                companyId: settings.companyId,
                webhookSecret: settings.webhookSecret,
                storeUrl: settings.storeUrl
            }));
            console.log('JSON_OUTPUT_END');
        } else {
            console.log('No WooCommerce settings found with webhooks enabled.');

            // Try to find ANY company to fallback
            const company = await prisma.company.findFirst();
            if (company) {
                console.log('JSON_OUTPUT_START');
                console.log(JSON.stringify({
                    companyId: company.id,
                    note: "No WooCommerce settings found, using raw company ID",
                    webhookSecret: "need_to_set_this"
                }));
                console.log('JSON_OUTPUT_END');
            }
        }
    } catch (error) {
        console.error('Error fetching credentials:', error);
    } finally {
        // await prisma.$disconnect(); 
        process.exit(0);
    }
}

getCredentials();
