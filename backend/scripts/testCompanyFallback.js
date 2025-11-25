/**
 * اختبار fallback للمفاتيح المركزية لشركة "شركة التسويق"
 * عن طريق إرسال رسالة عبر test-chat API
 */

const fetch = require('node-fetch');
const { getSharedPrismaClient } = require('../services/sharedDatabase');

const API_BASE = 'http://localhost:3007/api/v1';
const prisma = getSharedPrismaClient();

async function getAuthToken() {
    try {
        // البحث عن مستخدم لشركة "شركة التسويق"
        const company = await prisma.company.findFirst({
            where: {
                OR: [
                    { name: { contains: 'التسويق' } },
                    { name: { contains: 'تسويق' } }
                ]
            },
            include: {
                users: {
                    where: {
                        role: { in: ['COMPANY_ADMIN', 'MANAGER'] },
                        isActive: true
                    },
                    take: 1
                }
            }
        });

        if (!company || !company.users || company.users.length === 0) {
            console.log('❌ لم يتم العثور على مستخدم لشركة "شركة التسويق"');
            return null;
        }

        const user = company.users[0];
        console.log(`✅ تم العثور على مستخدم: ${user.email}`);

        // محاولة تسجيل الدخول
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: user.email,
                password: 'admin123' // أو أي كلمة مرور افتراضية
            })
        });

        const loginData = await loginResponse.json();
        
        if (loginData.success && loginData.data?.token) {
            console.log('✅ تم تسجيل الدخول بنجاح');
            return loginData.data.token;
        }

        console.log('❌ فشل تسجيل الدخول:', loginData);
        return null;
    } catch (error) {
        console.error('❌ خطأ في الحصول على token:', error);
        return null;
    }
}

async function testCompanyFallback() {
    try {
        console.log('\n🔍 ========== اختبار Fallback للمفاتيح المركزية ==========\n');

        // 1. الحصول على token
        const token = await getAuthToken();
        if (!token) {
            console.log('❌ فشل الحصول على token');
            return;
        }

        // 2. البحث عن الشركة
        const company = await prisma.company.findFirst({
            where: {
                OR: [
                    { name: { contains: 'التسويق' } },
                    { name: { contains: 'تسويق' } }
                ]
            }
        });

        if (!company) {
            console.log('❌ لم يتم العثور على شركة "شركة التسويق"');
            return;
        }

        console.log(`✅ الشركة: ${company.name} (ID: ${company.id})`);

        // 3. إنشاء محادثة اختبار
        console.log('\n📝 إنشاء محادثة اختبار...');
        const conversationResponse = await fetch(`${API_BASE}/test-chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const conversationData = await conversationResponse.json();
        
        if (!conversationData.success) {
            console.log('❌ فشل إنشاء المحادثة:', conversationData);
            return;
        }

        const conversationId = conversationData.data?.id;
        console.log(`✅ تم إنشاء المحادثة: ${conversationId}`);

        // 4. إرسال رسالة اختبار
        console.log('\n📤 إرسال رسالة اختبار: "السلام عليكم"');
        const messageResponse = await fetch(`${API_BASE}/test-chat/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                message: 'السلام عليكم'
            })
        });

        const messageData = await messageResponse.json();
        
        if (!messageData.success) {
            console.log('❌ فشل إرسال الرسالة:', messageData);
            return;
        }

        console.log('✅ تم إرسال الرسالة بنجاح');
        console.log('\n📋 الرد من AI:');
        
        if (messageData.data?.aiMessage) {
            console.log(`   ✅ ${messageData.data.aiMessage.content}`);
            console.log('\n✅ ✅ ✅ SUCCESS: تم استلام رد من AI باستخدام المفاتيح المركزية!');
        } else if (messageData.data?.aiResponse?.silent) {
            console.log('   ❌ النظام صامت - لم يتم إرسال رد');
            console.log('   ⚠️ هذا يعني أن النظام لم يجد مفاتيح متاحة');
        } else {
            console.log('   ⚠️ لم يتم استلام رد من AI');
            console.log('   Response:', JSON.stringify(messageData, null, 2));
        }

        // 5. الانتظار قليلاً ثم التحقق من الرسائل
        console.log('\n⏳ الانتظار 2 ثانية ثم التحقق من الرسائل...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const messagesResponse = await fetch(`${API_BASE}/test-chat/conversations/${conversationId}/messages`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const messagesData = await messagesResponse.json();
        
        if (messagesData.success && messagesData.data) {
            console.log(`\n📬 إجمالي الرسائل: ${messagesData.data.length}`);
            messagesData.data.forEach((msg, index) => {
                const sender = msg.isFromCustomer ? '👤 العميل' : '🤖 AI';
                console.log(`   ${index + 1}. ${sender}: ${msg.content.substring(0, 50)}...`);
            });
        }

        console.log('\n✅ ========== انتهى الاختبار ==========\n');

    } catch (error) {
        console.error('❌ خطأ في الاختبار:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCompanyFallback();

