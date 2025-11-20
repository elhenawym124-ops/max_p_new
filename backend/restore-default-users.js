const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('./services/sharedDatabase');
const bcrypt = require('bcryptjs');

async function restoreDefaultUsers() {
  try {
    console.log('🚀 [RESTORE] Restoring default users...');
    
    // Initialize database
    await initializeSharedDatabase();
    const prisma = getSharedPrismaClient();
    
    // List of default users to create/restore
    const defaultUsers = [
      {
        email: 'admin@test.com',
        password: 'admin123',
        firstName: 'أحمد',
        lastName: 'المدير',
        role: 'COMPANY_ADMIN',
        companyName: 'شركة الاختبار'
      },
      {
        email: 'superadmin@system.com',
        password: 'SuperAdmin123!',
        firstName: 'مدير',
        lastName: 'النظام',
        role: 'SUPER_ADMIN',
        companyName: 'شركة النظام' // Super admin needs a company too (schema requirement)
      },
      {
        email: 'ali@ali.com',
        password: '0165676135',
        firstName: 'علي',
        lastName: 'المستخدم',
        role: 'COMPANY_ADMIN',
        companyName: 'شركة علي'
      }
    ];
    
    // Find or create default company for regular users
    let defaultCompany = await executeWithRetry(async () => {
      return await prisma.company.findFirst({
        where: {
          name: {
            contains: 'الاختبار'
          }
        }
      });
    }, 3);
    
    if (!defaultCompany) {
      defaultCompany = await executeWithRetry(async () => {
        return await prisma.company.create({
          data: {
            name: 'شركة الاختبار',
            email: 'test@company.com',
            phone: '+20123456789',
            plan: 'PRO',
            isActive: true
          }
        });
      }, 3);
      console.log('✅ [RESTORE] Created default company:', defaultCompany.name);
    } else {
      console.log('✅ [RESTORE] Using existing company:', defaultCompany.name);
    }
    
    console.log('\n📋 [RESTORE] Processing users...\n');
    
    for (const userData of defaultUsers) {
      try {
        // Check if user exists
        const existingUser = await executeWithRetry(async () => {
          return await prisma.user.findUnique({
            where: { email: userData.email.toLowerCase() },
            include: { company: true }
          });
        }, 3);
        
        if (existingUser) {
          console.log(`⚠️  [RESTORE] User ${userData.email} already exists, updating...`);
          
          // Update password and ensure active
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          
          // Determine company
          let companyId = null;
          if (userData.role !== 'SUPER_ADMIN') {
            if (userData.companyName === 'شركة علي') {
              // Find or create Ali's company
              let aliCompany = await executeWithRetry(async () => {
                return await prisma.company.findFirst({
                  where: {
                    name: {
                      contains: 'علي'
                    }
                  }
                });
              }, 3);
              
              if (!aliCompany) {
                aliCompany = await executeWithRetry(async () => {
                  return await prisma.company.create({
                    data: {
                      name: 'شركة علي',
                      email: userData.email,
                      phone: '+201234567890',
                      plan: 'PRO',
                      isActive: true
                    }
                  });
                }, 3);
              }
              companyId = aliCompany.id;
            } else {
              companyId = defaultCompany.id;
            }
          }
          
          await executeWithRetry(async () => {
            return await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                password: hashedPassword,
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(),
                companyId: companyId || existingUser.companyId
              }
            });
          }, 3);
          
          console.log(`✅ [RESTORE] Updated user: ${userData.email}`);
        } else {
          console.log(`➕ [RESTORE] Creating user: ${userData.email}`);
          
          // Determine company
          let companyId = null;
          if (userData.companyName === 'شركة علي') {
            // Find or create Ali's company
            let aliCompany = await executeWithRetry(async () => {
              return await prisma.company.findFirst({
                where: {
                  name: {
                    contains: 'علي'
                  }
                }
              });
            }, 3);
            
            if (!aliCompany) {
              aliCompany = await executeWithRetry(async () => {
                return await prisma.company.create({
                  data: {
                    name: 'شركة علي',
                    email: userData.email,
                    phone: '+201234567890',
                    plan: 'PRO',
                    isActive: true
                  }
                });
              }, 3);
            }
            companyId = aliCompany.id;
          } else if (userData.companyName === 'شركة النظام') {
            // Find or create system company for SUPER_ADMIN
            let systemCompany = await executeWithRetry(async () => {
              return await prisma.company.findFirst({
                where: {
                  name: {
                    contains: 'النظام'
                  }
                }
              });
            }, 3);
            
            if (!systemCompany) {
              systemCompany = await executeWithRetry(async () => {
                return await prisma.company.create({
                  data: {
                    name: 'شركة النظام',
                    email: userData.email,
                    phone: '+201234567890',
                    plan: 'PRO',
                    isActive: true
                  }
                });
              }, 3);
            }
            companyId = systemCompany.id;
          } else {
            companyId = defaultCompany.id;
          }
          
          // Hash password
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          
          // Create user
          await executeWithRetry(async () => {
            return await prisma.user.create({
              data: {
                email: userData.email.toLowerCase(),
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role,
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(),
                companyId: companyId
              }
            });
          }, 3);
          
          console.log(`✅ [RESTORE] Created user: ${userData.email}`);
        }
      } catch (error) {
        console.error(`❌ [RESTORE] Error processing ${userData.email}:`, error.message);
      }
    }
    
    console.log('\n🎉 [RESTORE] Default users restoration completed!');
    console.log('\n📋 Login Credentials:');
    console.log('='.repeat(60));
    defaultUsers.forEach(user => {
      console.log(`\n👤 ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.role}`);
    });
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ [RESTORE] Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the restoration
restoreDefaultUsers().then(() => {
  console.log('\n✅ Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});

