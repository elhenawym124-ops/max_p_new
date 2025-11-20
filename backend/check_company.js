/**
 * Check marketing company data
 */

const { getSharedPrismaClient } = require('./services/sharedDatabase');

async function checkCompany() {
  const prisma = getSharedPrismaClient();
  
  try {
    await prisma.$connect();
    console.log('✅ Connected to database\n');
    
    // البحث عن شركة التسويق
    console.log('🔍 Searching for marketing company...');
    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: 'تسويق' } },
          { name: { contains: 'marketing' } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        website: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            customers: true,
            conversations: true,
            geminiKeys: true,
            systemPrompts: true
          }
        }
      }
    });
    
    console.log('📊 Found companies:', companies.length);
    companies.forEach((company, index) => {
      console.log(`\n${index + 1}. ${company.name}`);
      console.log('   ID:', company.id);
      console.log('   Email:', company.email);
      console.log('   Phone:', company.phone || 'N/A');
      console.log('   Website:', company.website || 'N/A');
      console.log('   Active:', company.isActive ? '✅' : '❌');
      console.log('   Created:', company.createdAt.toISOString());
      console.log('   Products:', company._count.products);
      console.log('   Customers:', company._count.customers);
      console.log('   Conversations:', company._count.conversations);
      console.log('   Gemini Keys:', company._count.geminiKeys);
      console.log('   System Prompts:', company._count.systemPrompts);
    });
    
    // إذا لم نجد شركة تسويق، نعرض جميع الشركات
    if (companies.length === 0) {
      console.log('\n⚠️ No marketing company found. Showing all companies...\n');
      const allCompanies = await prisma.company.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true
        }
      });
      
      allCompanies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.name} (${company.id})`);
      });
    } else {
      // نفحص بيانات أول شركة تسويق بالتفصيل
      const company = companies[0];
      console.log('\n\n📋 Detailed data for:', company.name);
      console.log('='  .repeat(60));
      
      // المنتجات
      console.log('\n🛍️ PRODUCTS:');
      const products = await prisma.product.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: {
            select: { name: true }
          }
        },
        take: 10
      });
      
      if (products.length > 0) {
        products.forEach((product, index) => {
          console.log(`\n${index + 1}. ${product.name}`);
          console.log('   Price:', product.price);
          console.log('   Category:', product.category?.name || 'N/A');
          console.log('   Description:', product.description?.substring(0, 100) || 'N/A');
        });
      } else {
        console.log('   No products found');
      }
      
      // العملاء
      console.log('\n\n👥 CUSTOMERS:');
      const customers = await prisma.customer.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        },
        take: 5
      });
      
      if (customers.length > 0) {
        customers.forEach((customer, index) => {
          console.log(`${index + 1}. ${customer.firstName} ${customer.lastName || ''} - ${customer.phone || customer.email}`);
        });
      } else {
        console.log('   No customers found');
      }
      
      // مفاتيح Gemini
      console.log('\n\n🔑 GEMINI KEYS:');
      const geminiKeys = await prisma.geminiKey.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          model: true,
          isActive: true,
          createdAt: true
        }
      });
      
      if (geminiKeys.length > 0) {
        geminiKeys.forEach((key, index) => {
          console.log(`${index + 1}. ${key.name} - ${key.model} ${key.isActive ? '✅' : '❌'}`);
        });
      } else {
        console.log('   No Gemini keys found');
      }
      
      // System Prompts
      console.log('\n\n📝 SYSTEM PROMPTS:');
      const prompts = await prisma.systemPrompt.findMany({
        where: { companyId: company.id },
        select: {
          id: true,
          name: true,
          content: true,
          isActive: true
        }
      });
      
      if (prompts.length > 0) {
        prompts.forEach((prompt, index) => {
          console.log(`\n${index + 1}. ${prompt.name} ${prompt.isActive ? '✅' : '❌'}`);
          console.log('   Content:', prompt.content?.substring(0, 200) + '...');
        });
      } else {
        console.log('   No system prompts found');
      }
      
      // AI Settings
      console.log('\n\n🤖 AI SETTINGS:');
      const aiSettings = await prisma.aiSettings.findUnique({
        where: { companyId: company.id }
      });
      
      if (aiSettings) {
        console.log('   Temperature:', aiSettings.temperature);
        console.log('   Max Tokens:', aiSettings.maxTokens);
        console.log('   Reply Mode:', aiSettings.replyMode);
        console.log('   Auto Reply:', aiSettings.autoReply ? '✅' : '❌');
      } else {
        console.log('   No AI settings found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

checkCompany();

