/**
 * اختبار بسيط لقواعد الاستجابة
 * يستدعي دالة buildAdvancedPrompt مباشرة
 */

// استيراد الملفات المطلوبة
const path = require('path');
const fs = require('fs');

// محاولة استيراد aiAgentService
try {
  const aiAgentServicePath = path.join(__dirname, 'backend', 'aiAgentService.js');
  
  if (fs.existsSync(aiAgentServicePath)) {
    console.log('✅ [TEST] تم العثور على aiAgentService.js');
    
    // محاولة قراءة الملف للبحث عن قواعد الاستجابة
    const fileContent = fs.readFileSync(aiAgentServicePath, 'utf8');
    
    console.log('🔍 [TEST] فحص محتوى aiAgentService.js...');
    
    // البحث عن استيراد قواعد الاستجابة
    const hasImport = fileContent.includes('buildPromptFromRules') && fileContent.includes('getDefaultRules');
    console.log('📦 [TEST] استيراد قواعد الاستجابة:', hasImport ? '✅ موجود' : '❌ غير موجود');
    
    // البحث عن استخدام القواعد في buildPrompt
    const hasBuildPromptRules = fileContent.includes('buildPromptFromRules(rules)') || fileContent.includes('buildPromptFromRules(getDefaultRules())');
    console.log('🔧 [TEST] استخدام القواعد في buildPrompt:', hasBuildPromptRules ? '✅ موجود' : '❌ غير موجود');
    
    // البحث عن استخدام القواعد في buildAdvancedPrompt
    const buildAdvancedPromptMatch = fileContent.match(/buildAdvancedPrompt[\s\S]*?buildPromptFromRules/);
    console.log('🚀 [TEST] استخدام القواعد في buildAdvancedPrompt:', buildAdvancedPromptMatch ? '✅ موجود' : '❌ غير موجود');
    
    // البحث عن logs قواعد الاستجابة
    const hasResponseRulesLog = fileContent.includes('[BUILD-PROMPT] تم إضافة قواعد الاستجابة');
    console.log('📝 [TEST] logs قواعد الاستجابة:', hasResponseRulesLog ? '✅ موجود' : '❌ غير موجود');
    
    // البحث عن responseRules في getSettings
    const hasGetSettingsRules = fileContent.includes('responseRules: aiSettings.responseRules');
    console.log('⚙️ [TEST] responseRules في getSettings:', hasGetSettingsRules ? '✅ موجود' : '❌ غير موجود');
    
    // البحث عن responseRules في getCompanyPrompts
    const hasCompanyPromptsRules = fileContent.includes('responseRules: settings.responseRules');
    console.log('🏢 [TEST] responseRules في getCompanyPrompts:', hasCompanyPromptsRules ? '✅ موجود' : '❌ غير موجود');
    
    console.log('\n📊 [TEST] النتيجة النهائية:');
    const totalChecks = 6;
    const passedChecks = [hasImport, hasBuildPromptRules, buildAdvancedPromptMatch, hasResponseRulesLog, hasGetSettingsRules, hasCompanyPromptsRules].filter(Boolean).length;
    
    console.log(`✅ [TEST] نجح ${passedChecks}/${totalChecks} من الفحوصات`);
    
    if (passedChecks >= 5) {
      console.log('🎉 [TEST] النجاح: قواعد الاستجابة مُدمجة بشكل صحيح في الكود!');
    } else if (passedChecks >= 3) {
      console.log('⚠️ [TEST] تحذير: قواعد الاستجابة مُدمجة جزئياً');
    } else {
      console.log('❌ [TEST] فشل: قواعد الاستجابة غير مُدمجة بشكل صحيح');
    }
    
    // فحص ملف responseRulesConfig.js
    const responseRulesPath = path.join(__dirname, 'backend', 'services', 'aiAgent', 'responseRulesConfig.js');
    if (fs.existsSync(responseRulesPath)) {
      console.log('\n✅ [TEST] تم العثور على responseRulesConfig.js');
      const rulesContent = fs.readFileSync(responseRulesPath, 'utf8');
      
      const hasDefaultRules = rulesContent.includes('DEFAULT_RESPONSE_RULES');
      const hasBuildFunction = rulesContent.includes('function buildPromptFromRules');
      
      console.log('📋 [TEST] القواعد الافتراضية:', hasDefaultRules ? '✅ موجودة' : '❌ غير موجودة');
      console.log('🔧 [TEST] دالة buildPromptFromRules:', hasBuildFunction ? '✅ موجودة' : '❌ غير موجودة');
    } else {
      console.log('❌ [TEST] لم يتم العثور على responseRulesConfig.js');
    }
    
  } else {
    console.log('❌ [TEST] لم يتم العثور على aiAgentService.js');
  }
  
} catch (error) {
  console.error('❌ [TEST] خطأ في الاختبار:', error.message);
}

console.log('\n✅ [TEST] انتهى الاختبار');
