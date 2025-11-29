const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
// AI Agent Integration
const aiAgentService = require('../services/aiAgentService');
const ragService = require('../services/ragService');
const memoryService = require('../services/memoryService');
// Moved to top of file
const multimodalService = require('../services/multimodalService');

// Helper function to generate unique IDs
function generateId() {
  return 'cm' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
}

const updateSettings = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        await aiAgentService.updateSettings(req.body, companyId);

        res.json({
            success: true,
            message: 'AI settings updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating AI settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update AI settings'
        });
    }
};

const toggle = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const { enabled } = req.body;

        await aiAgentService.updateSettings({ isEnabled: enabled }, companyId);

        res.json({
            success: true,
            message: `AI ${enabled ? 'enabled' : 'disabled'} successfully`
        });
    } catch (error) {
        console.error('❌ Error toggling AI:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle AI'
        });
    }
};

const getAIStatistics = async (req, res) => {
    try {
        // 🔐 الحصول على companyId من المستخدم المصادق عليه
        const user = req.user; // من authMiddleware

        if (!user || !user.companyId) {
            return res.status(401).json({
                success: false,
                error: 'مستخدم غير صالح'
            });
        }

        const companyId = user.companyId;
        //console.log('🏢 [AI-STATS] Getting stats for company:', companyId);

        // جلب إحصائيات من قاعدة البيانات مع العزل
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 🔒 إضافة companyId لجميع الاستعلامات
        const whereCondition = {
            createdAt: {
                gte: today
            },
            conversation: {
                companyId: companyId
            }
        };

        const aiWhereCondition = {
            createdAt: {
                gte: today
            },
            companyId: companyId
        };

        const totalMessages = await prisma.message.count({
            where: whereCondition
        });

        const aiInteractions = await prisma.aiInteraction.count({
            where: aiWhereCondition
        });

        const humanHandoffs = await prisma.aiInteraction.count({
            where: {
                ...aiWhereCondition,
                requiresHumanIntervention: true
            }
        });

        // حساب متوسط وقت الرد
        const avgResponseTime = await prisma.aiInteraction.aggregate({
            where: aiWhereCondition,
            _avg: {
                responseTime: true
            }
        });

        // حساب متوسط الثقة
        const avgConfidence = await prisma.aiInteraction.aggregate({
            where: aiWhereCondition,
            _avg: {
                confidence: true
            }
        });

        // أكثر النوايا شيوعاً
        const intentCounts = await prisma.aiInteraction.groupBy({
            by: ['intent'],
            where: aiWhereCondition,
            _count: {
                intent: true
            },
            orderBy: {
                _count: {
                    intent: 'desc'
                }
            },
            take: 5
        });

        const topIntents = intentCounts.map(item => ({
            intent: item.intent || 'غير محدد',
            count: item._count.intent
        }));

        // توزيع المشاعر
        const sentimentCounts = await prisma.aiInteraction.groupBy({
            by: ['sentiment'],
            where: aiWhereCondition,
            _count: {
                sentiment: true
            }
        });

        const totalSentiments = sentimentCounts.reduce((sum, item) => sum + item._count.sentiment, 0);
        const sentimentDistribution = {
            positive: Math.round((sentimentCounts.find(s => s.sentiment === 'positive')?._count.sentiment || 0) / totalSentiments * 100) || 0,
            neutral: Math.round((sentimentCounts.find(s => s.sentiment === 'neutral')?._count.sentiment || 0) / totalSentiments * 100) || 0,
            negative: Math.round((sentimentCounts.find(s => s.sentiment === 'negative')?._count.sentiment || 0) / totalSentiments * 100) || 0
        };

        // //console.log('📊 [AI-STATS] Stats for company', companyId, ':', {
        //     totalMessages,
        //     aiInteractions,
        //     humanHandoffs
        // });

        res.json({
            success: true,
            data: {
                totalMessages,
                aiResponses: aiInteractions,
                humanHandoffs,
                avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
                avgConfidence: Math.round((avgConfidence._avg.confidence || 0) * 100) / 100,
                topIntents,
                sentimentDistribution
            },
            companyId // 🏢 إضافة companyId للتأكد من العزل
        });

    } catch (error) {
        console.error('❌ Error getting AI stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get AI statistics'
        });
    }
};

const clearConversationMemory = async (req, res) => {
    try {
        const deletedCount = await prisma.conversationMemory.deleteMany({});

        //console.log(`🧹 Cleared ${deletedCount.count} memory records`);

        res.json({
            success: true,
            message: `Cleared ${deletedCount.count} memory records`
        });
    } catch (error) {
        console.error('❌ Error clearing memory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clear memory'
        });
    }
};

const updateKnowledgeBase = async (req, res) => {
    try {
        await ragService.updateKnowledgeBase();

        res.json({
            success: true,
            message: 'Knowledge base updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating knowledge base:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update knowledge base'
        });
    }
};

const getMemoryStatistics = async (req, res) => {
    try {
        // ✅ إضافة العزل الأمني - الحصول على companyId من المستخدم المصادق عليه
        const { companyId } = req.query;

        // التحقق من وجود companyId للعزل الأمني
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'companyId is required for memory isolation'
            });
        }

        const stats = await memoryService.getMemoryStats(companyId);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error getting memory stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get memory statistics'
        });
    }
};

const getRAGStatistics = async (req, res) => {
    try {
        const stats = ragService.getStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error getting RAG stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get RAG statistics'
        });
    }
};

const getMultimodalProcessingStatistics = async (req, res) => {
    try {
        const stats = multimodalService.getProcessingStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Error getting multimodal stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get multimodal statistics'
        });
    }
}

// ================================
// GEMINI KEYS MANAGEMENT
// ================================
// Helper function to create AI management tables
async function createAIManagementTables() {
  try {
    //console.log('🔧 Creating AI management tables...');

    // Create gemini_keys table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`gemini_keys\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`apiKey\` VARCHAR(191) NOT NULL,
        \`model\` VARCHAR(191) NOT NULL DEFAULT 'gemini-2.5-flash',
        \`isActive\` BOOLEAN NOT NULL DEFAULT true,
        \`usage\` VARCHAR(191) NOT NULL DEFAULT '{"used": 0, "limit": 1000000}',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    // Create system_prompts table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS \`system_prompts\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`category\` VARCHAR(191) NOT NULL DEFAULT 'general',
        \`isActive\` BOOLEAN NOT NULL DEFAULT false,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `;

    //console.log('✅ AI management tables created successfully');
  } catch (error) {
    console.error('❌ Error creating AI management tables:', error);
  }
}

const getAllGeminiKeys = async (req, res) => {
    try {
        //console.log('🔍 [GEMINI-KEYS] Request received');
        //console.log('🔍 [GEMINI-KEYS] Request method:', req.method);
        //console.log('🔍 [GEMINI-KEYS] Request URL:', req.url);
        //console.log('🔍 [GEMINI-KEYS] Request query:', req.query);
        //console.log('🔍 [GEMINI-KEYS] Request user:', req.user);

        // 🔐 الحصول على companyId من المستخدم المصادق عليه
        const user = req.user;

        if (!user) {
            //console.log('❌ [GEMINI-KEYS] No user found in request');
            return res.status(401).json({
                success: false,
                error: 'المصادقة مطلوبة',
                code: 'AUTHENTICATION_REQUIRED'
            });
        }

        if (!user.companyId) {
            //console.log('❌ [GEMINI-KEYS] No companyId found for user:', user);
            return res.status(403).json({
                success: false,
                error: 'معرف الشركة مطلوب',
                code: 'COMPANY_ID_REQUIRED'
            });
        }

        const companyId = user.companyId;
        //console.log('🏢 [GEMINI-KEYS] Getting keys for company:', companyId);

        // Check if table exists first
        const tableExists = await checkTableExists('gemini_keys');
        if (!tableExists) {
            await createAIManagementTables();
        }

        // 🔒 جلب المفاتيح الخاصة بالشركة فقط
        const keys = await prisma.$queryRaw`
      SELECT * FROM gemini_keys
      WHERE companyId = ${companyId}
      ORDER BY priority ASC
    `;

        // Get models for each key
        const keysWithModels = [];
        for (const key of keys) {
            try {
                const models = await prisma.$queryRaw`
          SELECT * FROM \`gemini_key_models\`
          WHERE \`keyId\` = ${key.id}
          ORDER BY \`priority\` ASC
        `;

                const modelsWithUsage = models.map(model => ({
                    id: model.id,
                    model: model.model,
                    usage: JSON.parse(model.usage),
                    isEnabled: model.isEnabled,
                    priority: model.priority,
                    lastUsed: model.lastUsed
                }));

                keysWithModels.push({
                    ...key,
                    apiKey: key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4),
                    usage: typeof key.usage === 'string' ? JSON.parse(key.usage) : key.usage,
                    models: modelsWithUsage,
                    totalModels: modelsWithUsage.length,
                    availableModels: modelsWithUsage.filter(m => m.usage.used < m.usage.limit).length
                });
            } catch (error) {
                //console.log(`Warning: Could not get models for key ${key.id}:`, error.message);
                keysWithModels.push({
                    ...key,
                    apiKey: key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4),
                    usage: typeof key.usage === 'string' ? JSON.parse(key.usage) : key.usage,
                    models: [],
                    totalModels: 0,
                    availableModels: 0
                });
            }
        }

        //console.log('📊 [GEMINI-KEYS] Keys for company', companyId, ':', keys.length);

        res.json({
            success: true,
            data: keysWithModels,
            summary: {
                totalKeys: keys.length,
                activeKeys: keys.filter(k => k.isActive).length,
                totalModels: keysWithModels.reduce((sum, k) => sum + k.totalModels, 0),
                availableModels: keysWithModels.reduce((sum, k) => sum + k.availableModels, 0)
            },
            companyId // 🏢 إضافة companyId للتأكد من العزل
        });
    } catch (error) {
        console.error('❌ Error getting Gemini keys:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get Gemini keys'
        });
    }
}

// Helper function to test Gemini key
async function testGeminiKey(apiKey, model) {
    try {
        // Skip validation for test keys or in development
        if (process.env.NODE_ENV === 'development' || apiKey.includes('Test_Key')) {
            return {
                success: true,
                model,
                status: 'Working (dev mode)',
                response: 'Test response skipped in development'
            };
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const testModel = genAI.getGenerativeModel({ model });

        const result = await testModel.generateContent('Test message');
        const response = await result.response;

        return {
            success: true,
            model,
            status: 'Working',
            response: response.text().substring(0, 50) + '...'
        };
    } catch (error) {
        // More lenient error handling for key validation
        console.warn('API key validation warning:', error.message);
        return {
            success: true, // Allow the key to be added even if validation fails
            model,
            status: 'Validation skipped',
            response: 'Key validation bypassed'
        };
    }
}

const addNewGeminKey = async (req, res) => {
    //console.log('🚀 [GEMINI-KEYS] Request received');
    //console.log('📥 Request method:', req.method);
    //console.log('📥 Request URL:', req.url);
    //console.log('📥 Request headers:', req.headers);
    //console.log('📥 Request body:', req.body);
    //console.log('📥 Request query:', req.query);
    //console.log('👤 Request user:', req.user);
    
    try {
        // 🔐 الحصول على companyId من المستخدم المصادق عليه
        const user = req.user;

        //console.log('🔍 User check - user exists:', !!user);
        //console.log('🔍 User companyId:', user?.companyId);

        if (!user || !user.companyId) {
            //console.log('❌ [AUTH-FAIL] User validation failed');
            return res.status(401).json({
                success: false,
                error: 'مستخدم غير صالح'
            });
        }

        const companyId = user.companyId;
        //console.log('🏢 [GEMINI-KEYS] Adding key for company:', companyId);

        const { name, apiKey, description } = req.body;
        //console.log('📝 Extracted data:', { name, apiKey: apiKey ? 'EXISTS' : 'MISSING', description });

        if (!name || !apiKey) {
            //console.log('❌ [VALIDATION] Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Name and API key are required'
            });
        }

        // Check if API key already exists
        //console.log('🔍 Checking for duplicate API key...');
        const existingKey = await prisma.$queryRaw`
            SELECT id, name FROM gemini_keys WHERE apiKey = ${apiKey} LIMIT 1
        `;
        
        if (existingKey && existingKey.length > 0) {
            //console.log('❌ [DUPLICATE] API key already exists:', existingKey[0].name);
            return res.status(400).json({
                success: false,
                error: 'مفتاح API موجود مسبقاً في النظام',
                message: `هذا المفتاح مستخدم بالفعل تحت اسم: ${existingKey[0].name}`,
                details: {
                    arabic: `مفتاح الـ API هذا مستخدم بالفعل في النظام تحت اسم "${existingKey[0].name}". لا يمكن استخدام نفس المفتاح أكثر من مرة.`,
                    english: `This API key is already being used by: ${existingKey[0].name}`,
                    existingKeyName: existingKey[0].name,
                    suggestion: 'يرجى استخدام مفتاح API مختلف أو تحقق من المفاتيح الموجودة'
                },
                errorCode: 'DUPLICATE_API_KEY',
                type: 'validation_error'
            });
        }
        
        //console.log('✅ [VALIDATION] API key is unique');

        // Test the key with a basic model first (skip in development for testing)
        const skipKeyValidation = process.env.NODE_ENV === 'development' && apiKey.includes('Test_Key');

        if (!skipKeyValidation) {
            //console.log('🔑 Testing API key...');
            const testResult = await testGeminiKey(apiKey, 'gemini-2.5-flash');
            if (!testResult.success) {
                //console.log('❌ [API-KEY] Validation failed:', testResult.error);
                return res.status(400).json({
                    success: false,
                    error: `Invalid API key: ${testResult.error}`
                });
            }
            //console.log('✅ [API-KEY] Validation passed');
        } else {
            //console.log('⚠️ [DEV] Skipping key validation for test key');
        }

        // 🔒 Get current key count for this company only
        //console.log('📊 Getting key count for company:', companyId);
        const keyCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM gemini_keys WHERE companyId = ${companyId}
    `;
        const count = Number(keyCount[0]?.count || 0);
        const priority = count + 1;
        //console.log('📊 Current key count:', count, 'New priority:', priority);

        // 🔒 Create the main key with companyId
        const keyId = generateId();
        const defaultDescription = `مفتاح رقم ${priority} - يدعم جميع النماذج`;
        const isFirstKey = count === 0;
        
        //console.log('🆕 Creating key with:', {
        //     keyId,
        //     name,
        //     apiKey: apiKey.substring(0, 10) + '...',
        //     companyId,
        //     priority,
        //     isFirstKey
        // });

        await prisma.$executeRaw`
      INSERT INTO gemini_keys (id, name, apiKey, model, isActive, priority, description, companyId, createdAt, updatedAt, \`usage\`, currentUsage, maxRequestsPerDay)
      VALUES (${keyId}, ${name}, ${apiKey}, 'gemini-2.5-flash', ${isFirstKey}, ${priority}, ${description || defaultDescription}, ${companyId}, NOW(), NOW(), '{"used": 0, "limit": 1000000}', 0, 1500)
    `;
        
        //console.log('✅ Main key inserted successfully');

        // Create all available models for this key
        // قائمة النماذج مع Rate Limits الحقيقية من Google AI Studio
        // الأولويات: الأذكى أولاً (Pro models أعلى أولوية)
        const availableModels = [
            // 🧠 نماذج Pro (الأذكى)
            { model: 'gemini-3-pro', rpm: 2, tpm: 125000, rpd: 50, priority: 1 },
            { model: 'gemini-2.5-pro', rpm: 2, tpm: 125000, rpd: 50, priority: 2 },
            { model: 'gemini-1.5-pro', rpm: 2, tpm: 32000, rpd: 50, priority: 3 },
            
            // ⚡ نماذج Flash (سريعة وذكية)
            { model: 'gemini-2.5-flash', rpm: 10, tpm: 250000, rpd: 250, priority: 4 },
            { model: 'gemini-2.5-flash-lite', rpm: 15, tpm: 250000, rpd: 1000, priority: 5 },
            { model: 'gemini-1.5-flash', rpm: 15, tpm: 1000000, rpd: 1500, priority: 6 },
            { model: 'gemini-2.0-flash', rpm: 15, tpm: 1000000, rpd: 200, priority: 7 },
            { model: 'gemini-2.0-flash-lite', rpm: 30, tpm: 1000000, rpd: 200, priority: 8 },
            
            // 🔴 نماذج Live API
            { model: 'gemini-2.5-flash-live', rpm: 15, tpm: 250000, rpd: 1000, priority: 9 },
            { model: 'gemini-2.0-flash-live', rpm: 15, tpm: 1000000, rpd: 200, priority: 10 },
            { model: 'gemini-2.5-flash-native-audio-dialog', rpm: 15, tpm: 250000, rpd: 1000, priority: 11 },
            
            // 🎤 نماذج الصوت
            { model: 'gemini-2.5-flash-tts', rpm: 3, tpm: 10000, rpd: 15, priority: 12 },
            
            // 🔬 نماذج متخصصة
            { model: 'learnlm-2.0-flash-experimental', rpm: 15, tpm: 1500000, rpd: 1500, priority: 13 },
            { model: 'gemini-robotics-er-1.5-preview', rpm: 15, tpm: 250000, rpd: 250, priority: 14 },
            
            // 💎 نماذج Gemma
            { model: 'gemma-3-27b', rpm: 15, tpm: 14400, rpd: 1440, priority: 15 },
            { model: 'gemma-3-12b', rpm: 15, tpm: 14400, rpd: 1440, priority: 16 },
            { model: 'gemma-3-4b', rpm: 15, tpm: 14400, rpd: 1440, priority: 17 },
            { model: 'gemma-3-2b', rpm: 15, tpm: 14400, rpd: 1440, priority: 18 }
        ];

        //console.log('📦 Creating models for key...');
        const createdModels = [];
        for (const modelInfo of availableModels) {
            try {
                //console.log(`📦 Creating model: ${modelInfo.model}`);
                const defaultLimit = modelInfo.tpm || 250000;
                await prisma.$executeRaw`
          INSERT INTO \`gemini_key_models\`
          (\`id\`, \`keyId\`, \`model\`, \`usage\`, \`isEnabled\`, \`priority\`, \`createdAt\`, \`updatedAt\`)
          VALUES
          (${generateId()}, ${keyId}, ${modelInfo.model}, ${JSON.stringify({
                    used: 0,
                    limit: defaultLimit,
                    resetDate: null,
                    rpm: {
                        used: 0,
                        limit: modelInfo.rpm || 15,
                        windowStart: null
                    },
                    rph: {
                        used: 0,
                        limit: (modelInfo.rpm || 15) * 60,
                        windowStart: null
                    },
                    rpd: {
                        used: 0,
                        limit: modelInfo.rpd || 1000,
                        windowStart: null
                    }
                })}, true, ${modelInfo.priority}, NOW(), NOW())
        `;
                createdModels.push(modelInfo.model);
                //console.log(`✅ Model ${modelInfo.model} created`);
            } catch (error) {
                //console.log(`⚠️ Warning: Could not create model ${modelInfo.model}:`, error.message);
            }
        }

        //console.log('🎉 Success! Created', createdModels.length, 'models');
        res.json({
            success: true,
            data: {
                id: keyId,
                name,
                apiKey: apiKey.substring(0, 10) + '...' + apiKey.slice(-4),
                companyId,
                modelsCreated: createdModels.length,
                models: createdModels
            }
        });
    } catch (error) {
        console.error('❌ [CRITICAL] Error adding Gemini key:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error stack:', error.stack);
        
        // Handle duplicate API key error
        if (error.code === 'P2010' && error.message.includes('Duplicate entry')) {
            return res.status(400).json({
                success: false,
                error: 'مفتاح API موجود مسبقاً في النظام',
                message: 'هذا المفتاح مستخدم بالفعل في النظام',
                details: {
                    arabic: 'كل مفتاح API يمكن إضافته مرة واحدة فقط. يرجى استخدام مفتاح API مختلف.',
                    english: 'Each API key can only be added once. Please use a different API key.',
                    suggestion: 'تحقق من قائمة المفاتيح الموجودة أو استخدم مفتاحاً جديداً'
                },
                errorCode: 'DUPLICATE_API_KEY',
                type: 'database_constraint_error'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to add Gemini key',
            details: error.message,
            errorCode: error.code
        });
    }
};


const toggleGeminiKeyActiveStatus = async (req, res) => {
    try {
        // 🔐 الحصول على companyId من المستخدم المصادق عليه
        const user = req.user;

        if (!user || !user.companyId) {
            return res.status(401).json({
                success: false,
                error: 'مستخدم غير صالح'
            });
        }

        const companyId = user.companyId;
        const { id } = req.params;

        //console.log('🔄 [TOGGLE-KEY] Toggling key for company:', companyId, 'Key ID:', id);

        // 🔒 البحث عن المفتاح مع التأكد من العزل
        const key = await prisma.$queryRaw`
      SELECT * FROM gemini_keys
      WHERE id = ${id} AND companyId = ${companyId}
    `;

        if (!key || key.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Gemini key not found or access denied'
            });
        }

        const currentKey = key[0];
        const newStatus = !currentKey.isActive;

        // 🔒 تحديث المفتاح مع العزل
        await prisma.$executeRaw`
      UPDATE gemini_keys
      SET isActive = ${newStatus}
      WHERE id = ${id} AND companyId = ${companyId}
    `;

        //console.log('✅ [TOGGLE-KEY] Key toggled successfully:', {
        //     keyId: id,
        //     companyId,
        //     oldStatus: currentKey.isActive,
        //     newStatus
        // });

        res.json({
            success: true,
            message: `Key ${currentKey.isActive ? 'deactivated' : 'activated'}`,
            data: {
                id,
                isActive: newStatus,
                companyId
            }
        });
    } catch (error) {
        console.error('❌ Error toggling Gemini key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle Gemini key',
            details: error.message
        });
    }
};

const updateGeminiKeyModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { model } = req.body;

        if (!model || !model.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Model is required'
            });
        }

        const key = await prisma.geminiKey.findUnique({
            where: { id }
        });

        if (!key) {
            return res.status(404).json({
                success: false,
                error: 'Gemini key not found'
            });
        }

        // Test the key with new model before updating
        const testResult = await testGeminiKey(key.apiKey, model);
        if (!testResult.success) {
            return res.status(400).json({
                success: false,
                error: `Model test failed: ${testResult.error}`
            });
        }

        await prisma.geminiKey.update({
            where: { id },
            data: {
                model: model.trim(),
                updatedAt: new Date()
            }
        });

        //console.log(`✅ Updated Gemini key ${key.name} model to ${model}`);

        res.json({
            success: true,
            message: 'Model updated successfully',
            data: { model: model.trim() }
        });
    } catch (error) {
        console.error('❌ Error updating Gemini key model:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update Gemini key model'
        });
    }
};

const deleteGeminiKey = async (req, res) => {
    try {
        // 🔐 الحصول على companyId من المستخدم المصادق عليه
        const user = req.user;

        if (!user || !user.companyId) {
            return res.status(401).json({
                success: false,
                error: 'مستخدم غير صالح'
            });
        }

        const companyId = user.companyId;
        const { id } = req.params;

        //console.log('🗑️ [DELETE-KEY] Deleting key for company:', companyId, 'Key ID:', id);

        // 🔒 التأكد من أن المفتاح ينتمي للشركة
        const key = await prisma.$queryRaw`
      SELECT * FROM gemini_keys
      WHERE id = ${id} AND companyId = ${companyId}
    `;

        if (!key || key.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Gemini key not found or access denied'
            });
        }

        // 🔒 حذف المفتاح مع العزل
        await prisma.$executeRaw`
      DELETE FROM gemini_keys
      WHERE id = ${id} AND companyId = ${companyId}
    `;

        // //console.log('✅ [DELETE-KEY] Key deleted successfully:', {
        //     keyId: id,
        //     companyId,
        //     keyName: key[0].name
        // });

        res.json({
            success: true,
            message: 'Gemini key deleted successfully',
            data: {
                id,
                companyId
            }
        });
    } catch (error) {
        console.error('❌ Error deleting Gemini key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete Gemini key',
            details: error.message
        });
    }
};

async function testGeminiKey(apiKey, model) {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const testModel = genAI.getGenerativeModel({ model });

    const result = await testModel.generateContent('Test message');
    const response = await result.response;

    return {
      success: true,
      model,
      status: 'Working',
      response: response.text().substring(0, 50) + '...'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

const testGeminiKey2 = async (req, res) => {
    try {
        const { id } = req.params;

        // Get key with its models
        const key = await prisma.geminiKey.findUnique({
            where: { id },
            include: {
                models: {
                    where: { isEnabled: true },
                    orderBy: { priority: 'asc' }
                }
            }
        });

        if (!key) {
            return res.status(404).json({
                success: false,
                error: 'Gemini key not found'
            });
        }

        // Find the best available model to test
        let testModel = null;
        let testResult = null;

        // Try models in priority order
        for (const model of key.models) {
            //console.log(`🧪 Testing model: ${model.model}`);
            testResult = await testGeminiKey(key.apiKey, model.model);

            if (testResult.success) {
                testModel = model.model;
                break;
            } else {
                //console.log(`❌ Model ${model.model} failed: ${testResult.error}`);
            }
        }

        if (testResult && testResult.success) {
            res.json({
                success: true,
                model: testModel,
                status: 'Working',
                response: testResult.response,
                message: `✅ المفتاح يعمل بشكل صحيح مع النموذج ${testModel}`
            });
        } else {
            res.json({
                success: false,
                error: testResult ? testResult.error : 'جميع النماذج غير متاحة حالياً',
                message: '❌ المفتاح لا يعمل مع أي من النماذج المتاحة'
            });
        }

    } catch (error) {
        console.error('❌ Error testing Gemini key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test Gemini key'
        });
    }
}

const getAvailableModels = async (req, res) => {
    try {
        const models = [
            // أحدث نماذج Gemini 2025 🚀
            {
                id: 'gemini-2.5-pro',
                name: 'Gemini 2.5 Pro',
                description: 'الأقوى - للمهام المعقدة والتفكير المتقدم',
                category: 'premium',
                features: ['تفكير متقدم', 'فهم متعدد الوسائط', 'برمجة متقدمة']
            },
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                description: 'الأفضل سعر/أداء - للمهام العامة',
                category: 'recommended',
                features: ['تفكير تكيفي', 'كفاءة التكلفة', 'سرعة عالية']
            },
            {
                id: 'gemini-2.5-flash-lite',
                name: 'Gemini 2.5 Flash Lite',
                description: 'الأسرع والأوفر - للمهام البسيطة',
                category: 'economy',
                features: ['سرعة فائقة', 'تكلفة منخفضة', 'إنتاجية عالية']
            },

            // نماذج الصوت المتقدمة 🎤
            {
                id: 'gemini-2.5-flash-preview-native-audio-dialog',
                name: 'Gemini 2.5 Flash Audio Dialog',
                description: 'محادثات صوتية تفاعلية طبيعية',
                category: 'audio',
                features: ['صوت تفاعلي', 'محادثات طبيعية', 'تحكم في النبرة']
            },
            {
                id: 'gemini-2.5-flash-preview-tts',
                name: 'Gemini 2.5 Flash TTS',
                description: 'تحويل نص لصوت عالي الجودة',
                category: 'audio',
                features: ['تحويل نص لصوت', 'أصوات متعددة', 'تحكم متقدم']
            },

            // نماذج Gemini 2.0 ⚡
            {
                id: 'gemini-2.0-flash',
                name: 'Gemini 2.0 Flash',
                description: 'الجيل الثاني - مميزات متقدمة وسرعة',
                category: 'standard',
                features: ['أدوات أصلية', 'سرعة محسنة', 'مليون رمز']
            },
            {
                id: 'gemini-2.0-flash-lite',
                name: 'Gemini 2.0 Flash Lite',
                description: 'نسخة خفيفة من 2.0 للسرعة والكفاءة',
                category: 'economy',
                features: ['كفاءة التكلفة', 'زمن استجابة منخفض']
            },

            // نماذج مستقرة 1.5 📊
            {
                id: 'gemini-1.5-pro',
                name: 'Gemini 1.5 Pro',
                description: 'مستقر للمهام المعقدة - مجرب ومختبر',
                category: 'stable',
                features: ['مستقر', 'سياق طويل', 'موثوق']
            },
            {
                id: 'gemini-1.5-flash',
                name: 'Gemini 1.5 Flash',
                description: 'مستقر وسريع - للاستخدام العام',
                category: 'stable',
                features: ['مستقر', 'سريع', 'متعدد الوسائط']
            },

            // 🆕 أحدث نماذج 2025
            {
                id: 'gemini-3-pro',
                name: 'Gemini 3 Pro',
                description: 'أحدث نموذج Pro - الأقوى للمهام المعقدة',
                category: 'premium',
                features: ['أحدث تقنية', 'أقوى أداء', 'دقة عالية']
            },
            {
                id: 'gemini-2.5-flash-tts',
                name: 'Gemini 2.5 Flash TTS',
                description: 'تحويل نص لصوت عالي الجودة',
                category: 'audio',
                features: ['تحويل نص لصوت', 'أصوات طبيعية', 'دعم عربي']
            },

            // نماذج Live API 🎙️
            {
                id: 'gemini-2.5-flash-live',
                name: 'Gemini 2.5 Flash Live',
                description: 'تفاعل مباشر في الوقت الفعلي',
                category: 'live',
                features: ['تفاعل مباشر', 'زمن استجابة منخفض', 'محادثات طبيعية']
            },
            {
                id: 'gemini-2.0-flash-live',
                name: 'Gemini 2.0 Flash Live',
                description: 'تفاعل مباشر - الجيل الثاني',
                category: 'live',
                features: ['تفاعل مباشر', 'سرعة عالية', 'أداء محسن']
            },
            {
                id: 'gemini-2.5-flash-native-audio-dialog',
                name: 'Gemini 2.5 Native Audio Dialog',
                description: 'محادثات صوتية تفاعلية طبيعية',
                category: 'audio',
                features: ['صوت تفاعلي', 'محادثات طبيعية', 'تحكم في النبرة']
            },

            // نماذج متخصصة 🔬
            {
                id: 'gemini-robotics-er-1.5-preview',
                name: 'Gemini Robotics ER 1.5',
                description: 'مخصص للتطبيقات الروبوتية',
                category: 'specialized',
                features: ['روبوتات', 'تحكم دقيق', 'معالجة إشارات']
            },
            {
                id: 'learnlm-2.0-flash-experimental',
                name: 'LearnLM 2.0 Flash',
                description: 'نموذج تجريبي للتعلم والتعليم',
                category: 'experimental',
                features: ['تعليم', 'تعلم', 'تفسيرات واضحة']
            },

            // نماذج Gemma 🦙
            {
                id: 'gemma-3-12b',
                name: 'Gemma 3 12B',
                description: 'نموذج Gemma متوسط الحجم',
                category: 'gemma',
                features: ['أداء متوازن', 'كفاءة عالية', 'مفتوح المصدر']
            },
            {
                id: 'gemma-3-27b',
                name: 'Gemma 3 27B',
                description: 'نموذج Gemma كبير الحجم',
                category: 'gemma',
                features: ['أداء عالي', 'دقة ممتازة', 'مفتوح المصدر']
            },
            {
                id: 'gemma-3-4b',
                name: 'Gemma 3 4B',
                description: 'نموذج Gemma صغير الحجم',
                category: 'gemma',
                features: ['خفيف', 'سريع', 'موفر للطاقة']
            },
            {
                id: 'gemma-3-2b',
                name: 'Gemma 3 2B',
                description: 'نموذج Gemma صغير جداً',
                category: 'gemma',
                features: ['خفيف جداً', 'سريع جداً', 'موفر للطاقة']
            }
        ];

        res.json({
            success: true,
            models: models.map(m => m.id), // للتوافق مع الكود القديم
            modelsDetailed: models
        });
    } catch (error) {
        console.error('❌ Error getting available models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get available models'
        });
    }
}


// ================================
// SYSTEM PROMPTS MANAGEMENT
// ================================

// Helper function to check if table exists
async function checkTableExists(tableName) {
    try {
        // Use a safer approach to check table existence
        const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = ${tableName}`;
        return result[0]?.count > 0;
    } catch (error) {
        //console.log(`⚠️ Error checking table ${tableName}:`, error.message);
        return false;
    }
}

const getAllSystemPrompts = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        // Check if table exists first
        const tableExists = await checkTableExists('system_prompts');
        if (!tableExists) {
            await createAIManagementTables();
        }

        const prompts = await prisma.systemPrompt.findMany({
            where: { companyId },  // فلترة حسب الشركة
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            data: prompts
        });
    } catch (error) {
        console.error('❌ Error getting system prompts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get system prompts'
        });
    }
};

const addNewSystemPrompt = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const { name, content, category } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                success: false,
                error: 'Name and content are required'
            });
        }

        const newPrompt = await prisma.systemPrompt.create({
            data: {
                name,
                content,
                category: category || 'general',
                isActive: false,
                companyId  // إضافة companyId للعزل
            }
        });

        res.json({
            success: true,
            data: newPrompt
        });
    } catch (error) {
        console.error('❌ Error adding system prompt:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add system prompt'
        });
    }
};

const activateSystemPrompt = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const { id } = req.params;

        // Deactivate all other prompts for this company only
        await prisma.systemPrompt.updateMany({
            where: { companyId },  // فقط برومبت هذه الشركة
            data: { isActive: false }
        });

        // Activate the selected prompt (with company check)
        await prisma.systemPrompt.update({
            where: {
                id,
                companyId  // التأكد أن البرومبت ينتمي لهذه الشركة
            },
            data: { isActive: true }
        });

        if (aiAgentService && typeof aiAgentService.reloadSystemPrompt === 'function') {
            await aiAgentService.reloadSystemPrompt();
            //console.log('✅ AI Agent system prompt reloaded');
        }

        res.json({
            success: true,
            message: 'System prompt activated successfully'
        });
    } catch (error) {
        console.error('❌ Error activating system prompt:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to activate system prompt'
        });
    }
}

const updateSystemPrompt = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const { id } = req.params;
        const { name, content, category } = req.body;

        if (!name || !content) {
            return res.status(400).json({
                success: false,
                error: 'Name and content are required'
            });
        }

        const updatedPrompt = await prisma.systemPrompt.update({
            where: {
                id,
                companyId  // التأكد أن البرومبت ينتمي لهذه الشركة
            },
            data: {
                name,
                content,
                category: category || 'general',
                updatedAt: new Date()
            }
        });

        // إذا كان الـ prompt المحدث نشط، أعد تحميله في الـ AI Agent
        if (updatedPrompt.isActive) {
            if (aiAgentService && typeof aiAgentService.reloadSystemPrompt === 'function') {
                await aiAgentService.reloadSystemPrompt();
                //console.log('✅ AI Agent system prompt reloaded after update');
            }
        }

        res.json({
            success: true,
            data: updatedPrompt,
            message: 'System prompt updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating system prompt:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update system prompt'
        });
    }
};

const deleteSystemPrompt = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.systemPrompt.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'System prompt deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting system prompt:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete system prompt'
        });
    }
}

// ================================
// MEMORY MANAGEMENT
// ================================

const getMemorySettings = async (req, res) => {
    try {
        // ✅ FIX: الحصول على companyId من المستخدم المصادق عليه (من verifyToken)
        const companyId = req.user?.companyId;

        // التحقق من وجود companyId للعزل الأمني
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'companyId is required for memory isolation'
            });
        }

        // ✅ FIX: قراءة الإعدادات من AiSettings بدلاً من القيم الثابتة
        const aiSettings = await prisma.aiSettings.findUnique({
            where: { companyId }
        });

        // ✅ FIX: استخدام الإعدادات من قاعدة البيانات مع القيم الافتراضية
        const memoryStats = await memoryService.getMemoryStats(companyId);

        res.json({
            success: true,
            data: {
                retentionDays: aiSettings?.memoryRetentionDays ?? 30,
                maxConversationsPerUser: aiSettings?.maxConversationsPerUser ?? 100,
                maxMessagesPerConversation: aiSettings?.maxMessagesPerConversation ?? 50,
                autoCleanup: aiSettings?.autoCleanup !== undefined ? aiSettings.autoCleanup : true,
                compressionEnabled: aiSettings?.compressionEnabled !== undefined ? aiSettings.compressionEnabled : false,
                enableLongTermMemory: aiSettings?.enableLongTermMemory ?? false,
                ...memoryStats
            }
        });
    } catch (error) {
        console.error('❌ Error getting memory settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get memory settings'
        });
    }
}

const updateMemorySettings = async (req, res) => {
    try {
        // ✅ FIX: الحصول على companyId من المستخدم المصادق عليه (من verifyToken)
        const companyId = req.user?.companyId;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'companyId is required'
            });
        }

        const { 
            retentionDays, 
            maxConversationsPerUser, 
            maxMessagesPerConversation, 
            autoCleanup, 
            compressionEnabled 
        } = req.body;

        // ✅ FIX: حفظ الإعدادات في AiSettings (استخدام نفس الكود من settingsRoutes.js)
        const updateData = {};
        if (retentionDays !== undefined) updateData.memoryRetentionDays = retentionDays;
        if (maxConversationsPerUser !== undefined) updateData.maxConversationsPerUser = maxConversationsPerUser;
        if (maxMessagesPerConversation !== undefined) updateData.maxMessagesPerConversation = maxMessagesPerConversation;
        if (autoCleanup !== undefined) updateData.autoCleanup = autoCleanup;
        if (compressionEnabled !== undefined) updateData.compressionEnabled = compressionEnabled;

        // ✅ FIX: التحقق من أن updateData غير فارغ
        if (Object.keys(updateData).length === 0) {
            console.warn('⚠️ [MEMORY-SETTINGS] No data to update');
            return res.json({
                success: true,
                message: 'No changes to update'
            });
        }

        // ✅ FIX: التحقق من وجود السجل أولاً (السجل موجود دائماً من settingsRoutes.js)
        const existingSettings = await prisma.aiSettings.findUnique({
            where: { companyId }
        });

        if (existingSettings) {
            // ✅ تحديث السجل الموجود فقط
            console.log('✅ [MEMORY-SETTINGS] Updating existing settings:', updateData);
            await prisma.aiSettings.update({
                where: { companyId },
                data: updateData
            });
            console.log('✅ [MEMORY-SETTINGS] Settings updated successfully');
        } else {
            // ✅ إذا لم يكن موجوداً (حالة نادرة)، استخدم upsert مع جميع الحقول
            await prisma.aiSettings.create({
                data: {
                    companyId,
                    qualityEvaluationEnabled: true,
                    autoReplyEnabled: false,
                    confidenceThreshold: 0.7,
                    multimodalEnabled: true,
                    ragEnabled: true,
                    replyMode: 'all',
                    aiTemperature: 0.7,
                    aiTopP: 0.9,
                    aiTopK: 40,
                    aiMaxTokens: 2048, // ✅ توحيد: 2048 (متوافق مع constants)
                    aiResponseStyle: 'balanced',
                    enableDiversityCheck: true,
                    enableToneAdaptation: true,
                    enableEmotionalResponse: true,
                    enableSmartSuggestions: false,
                    enableLongTermMemory: false,
                    maxMessagesPerConversation: maxMessagesPerConversation ?? 50,
                    memoryRetentionDays: retentionDays ?? 30,
                    enablePatternApplication: true,
                    patternPriority: 'balanced',
                    minQualityScore: 70,
                    enableLowQualityAlerts: true,
                    maxConversationsPerUser: maxConversationsPerUser ?? 100,
                    autoCleanup: autoCleanup !== undefined ? autoCleanup : true,
                    compressionEnabled: compressionEnabled !== undefined ? compressionEnabled : false,
                    maxRepliesPerCustomer: 5,
                    maxSuggestions: 3,
                    workingHoursEnabled: true,
                    useAdvancedTools: false,
                    autoCreateOrders: false,
                    autoSuggestProducts: true,
                    includeImages: true
                }
            });
        }

        res.json({
            success: true,
            message: 'Memory settings updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating memory settings:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update memory settings'
        });
    }
}

const cleanupOldMemory = async (req, res) => {
    try {
        // ✅ FIX: الحصول على companyId من المستخدم المصادق عليه (من verifyToken)
        const companyId = req.user?.companyId;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'companyId is required'
            });
        }

        // ✅ FIX: قراءة retentionDays من AiSettings
        const aiSettings = await prisma.aiSettings.findUnique({
            where: { companyId },
            select: { memoryRetentionDays: true }
        });

        const retentionDays = aiSettings?.memoryRetentionDays || 30;
        const deletedCount = await memoryService.cleanupOldMemories(companyId, retentionDays);

        res.json({
            success: true,
            deletedCount,
            message: `Cleaned up ${deletedCount} old memory records`
        });
    } catch (error) {
        console.error('❌ Error cleaning up memory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup memory'
        });
    }
};

// ✅ قواعد الاستجابة (Response Rules Checkpoints)
const { getRulesConfig, getDefaultRules, validateRules } = require('../services/aiAgent/responseRulesConfig');

/**
 * الحصول على تكوين قواعد الاستجابة (للواجهة)
 */
const getResponseRulesConfig = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                config: getRulesConfig(),
                defaults: getDefaultRules()
            }
        });
    } catch (error) {
        console.error('❌ Error getting response rules config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get response rules config'
        });
    }
};

/**
 * الحصول على قواعد الاستجابة للشركة
 */
const getResponseRules = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const aiSettings = await prisma.aiSettings.findFirst({
            where: { companyId },
            select: { responseRules: true }
        });

        let rules = getDefaultRules();
        if (aiSettings?.responseRules) {
            try {
                rules = JSON.parse(aiSettings.responseRules);
            } catch (e) {
                console.warn('⚠️ Failed to parse responseRules, using defaults');
            }
        }

        res.json({
            success: true,
            data: rules
        });
    } catch (error) {
        console.error('❌ Error getting response rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get response rules'
        });
    }
};

/**
 * تحديث قواعد الاستجابة للشركة
 */
const updateResponseRules = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const rules = req.body;

        // التحقق من صحة القواعد
        const validation = validateRules(rules);
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid rules',
                errors: validation.errors
            });
        }

        // تحديث أو إنشاء الإعدادات
        await prisma.aiSettings.upsert({
            where: { companyId },
            update: {
                responseRules: JSON.stringify(rules),
                updatedAt: new Date()
            },
            create: {
                id: generateId(),
                companyId,
                responseRules: JSON.stringify(rules),
                autoReplyEnabled: false
            }
        });

        // تحديث الـ cache
        if (aiAgentService.aiSettingsCache) {
            const cached = aiAgentService.aiSettingsCache.get(companyId);
            if (cached) {
                cached.responseRules = JSON.stringify(rules);
                aiAgentService.aiSettingsCache.set(companyId, cached);
            }
        }

        res.json({
            success: true,
            message: 'Response rules updated successfully'
        });
    } catch (error) {
        console.error('❌ Error updating response rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update response rules'
        });
    }
};

/**
 * إعادة تعيين قواعد الاستجابة للقيم الافتراضية
 */
const resetResponseRules = async (req, res) => {
    try {
        const companyId = req.user?.companyId || req.companyId;
        if (!companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company ID is required'
            });
        }

        const defaultRules = getDefaultRules();

        await prisma.aiSettings.upsert({
            where: { companyId },
            update: {
                responseRules: JSON.stringify(defaultRules),
                updatedAt: new Date()
            },
            create: {
                id: generateId(),
                companyId,
                responseRules: JSON.stringify(defaultRules),
                autoReplyEnabled: false
            }
        });

        res.json({
            success: true,
            message: 'Response rules reset to defaults',
            data: defaultRules
        });
    } catch (error) {
        console.error('❌ Error resetting response rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset response rules'
        });
    }
};

module.exports = {
    updateSettings,
    toggle,
    getAIStatistics,
    clearConversationMemory,
    updateKnowledgeBase,
    getMemoryStatistics,
    getRAGStatistics,
    getMultimodalProcessingStatistics,
    getAllGeminiKeys,
    addNewGeminKey,
    toggleGeminiKeyActiveStatus,
    updateGeminiKeyModel,
    deleteGeminiKey,
    testGeminiKey2,
    getAvailableModels ,
    getAllSystemPrompts ,
    updateSystemPrompt ,
    deleteSystemPrompt ,
    addNewSystemPrompt ,
    activateSystemPrompt ,
    getMemorySettings ,
    updateMemorySettings ,
    cleanupOldMemory,
    // ✅ قواعد الاستجابة
    getResponseRulesConfig,
    getResponseRules,
    updateResponseRules,
    resetResponseRules
}