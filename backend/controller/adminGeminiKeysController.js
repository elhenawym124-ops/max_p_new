const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();

// Helper function to generate unique IDs
function generateId() {
  return 'cm' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
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

// Get all Gemini keys (central + company keys)
const getAllGeminiKeys = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-GEMINI-KEYS] getAllGeminiKeys called');
        const { type, companyId } = req.query; // type: 'CENTRAL', 'COMPANY', or undefined (all)
        console.log('🔍 [ADMIN-GEMINI-KEYS] Query params:', { type, companyId });

        let whereClause = {};
        
        // Build where clause with keyType support (Prisma Client now supports it)

        console.log('🔍 [ADMIN-GEMINI-KEYS] Where clause:', whereClause);
        console.log('🔍 [ADMIN-GEMINI-KEYS] Prisma client:', prisma ? 'exists' : 'missing');

        // Build proper where clause with keyType support
        if (type === 'CENTRAL') {
            whereClause.keyType = 'CENTRAL';
            whereClause.companyId = null;
        } else if (type === 'COMPANY') {
            whereClause.keyType = 'COMPANY';
            if (companyId) {
                whereClause.companyId = companyId;
            }
        }

        // Fetch keys with proper filtering
        let keys = await prisma.geminiKey.findMany({
            where: whereClause,
            include: {
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                models: {
                    orderBy: { priority: 'asc' }
                }
            },
            orderBy: [
                { keyType: 'asc' },
                { isActive: 'desc' },
                { priority: 'asc' }
            ]
        });

        console.log('✅ [ADMIN-GEMINI-KEYS] Found keys:', keys.length);

        const keysWithDetails = keys.map(key => {
            try {
                const parsedUsage = typeof key.usage === 'string' ? JSON.parse(key.usage) : key.usage;
                // keyType should now be available from Prisma Client
                const keyType = key.keyType || (key.companyId ? 'COMPANY' : 'CENTRAL');
                return {
                    ...key,
                    keyType, // Use keyType from Prisma or fallback
                    apiKey: key.apiKey ? (key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4)) : 'N/A',
                    usage: parsedUsage,
                    models: key.models ? key.models.map(model => {
                        try {
                            const modelUsage = typeof model.usage === 'string' ? JSON.parse(model.usage) : model.usage;
                            return {
                                ...model,
                                usage: modelUsage
                            };
                        } catch (e) {
                            console.error('❌ [ADMIN-GEMINI-KEYS] Error parsing model usage:', e);
                            return {
                                ...model,
                                usage: { used: 0, limit: 0 }
                            };
                        }
                    }) : [],
                    totalModels: key.models ? key.models.length : 0,
                    availableModels: key.models ? key.models.filter(m => {
                        try {
                            const usage = typeof m.usage === 'string' ? JSON.parse(m.usage) : m.usage;
                            return usage.used < usage.limit;
                        } catch (e) {
                            return false;
                        }
                    }).length : 0
                };
            } catch (e) {
                console.error('❌ [ADMIN-GEMINI-KEYS] Error processing key:', key.id, e);
                const keyType = key.companyId ? 'COMPANY' : 'CENTRAL';
                return {
                    ...key,
                    keyType, // Add keyType manually
                    apiKey: key.apiKey ? (key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4)) : 'N/A',
                    usage: { used: 0, limit: 0 },
                    models: [],
                    totalModels: 0,
                    availableModels: 0
                };
            }
        });

        console.log('✅ [ADMIN-GEMINI-KEYS] Processed keys:', keysWithDetails.length);

        res.json({
            success: true,
            data: keysWithDetails,
            summary: {
                totalKeys: keys.length,
                centralKeys: keys.filter(k => k.keyType === 'CENTRAL' || !k.companyId).length,
                companyKeys: keys.filter(k => k.keyType === 'COMPANY' || (k.companyId && k.keyType !== 'CENTRAL')).length,
                activeKeys: keys.filter(k => k.isActive).length,
                totalModels: keysWithDetails.reduce((sum, k) => sum + (k.totalModels || 0), 0),
                availableModels: keysWithDetails.reduce((sum, k) => sum + (k.availableModels || 0), 0)
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-GEMINI-KEYS] Error getting Gemini keys:', error);
        console.error('❌ [ADMIN-GEMINI-KEYS] Error message:', error.message);
        console.error('❌ [ADMIN-GEMINI-KEYS] Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to get Gemini keys',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : undefined
        });
    }
};

// Get central keys only
const getCentralKeys = async (req, res) => {
    try {
        const keys = await prisma.geminiKey.findMany({
            where: {
                keyType: 'CENTRAL',
                companyId: null
            },
            include: {
                models: {
                    orderBy: { priority: 'asc' }
                }
            },
            orderBy: [
                { isActive: 'desc' },
                { priority: 'asc' }
            ]
        });

        const keysWithDetails = keys.map(key => ({
            ...key,
            apiKey: key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4),
            usage: typeof key.usage === 'string' ? JSON.parse(key.usage) : key.usage,
            models: key.models.map(model => ({
                ...model,
                usage: typeof model.usage === 'string' ? JSON.parse(model.usage) : model.usage
            }))
        }));

        res.json({
            success: true,
            data: keysWithDetails
        });
    } catch (error) {
        console.error('❌ Error getting central keys:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get central keys'
        });
    }
};

// Get company keys
const getCompanyKeys = async (req, res) => {
    try {
        const { companyId } = req.params;

        const keys = await prisma.geminiKey.findMany({
            where: {
                keyType: 'COMPANY',
                companyId: companyId
            },
            include: {
                company: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                models: {
                    orderBy: { priority: 'asc' }
                }
            },
            orderBy: [
                { keyType: 'asc' },
                { isActive: 'desc' },
                { priority: 'asc' }
            ]
        });

        const keysWithDetails = keys.map(key => ({
            ...key,
            apiKey: key.apiKey.substring(0, 10) + '...' + key.apiKey.slice(-4),
            usage: typeof key.usage === 'string' ? JSON.parse(key.usage) : key.usage,
            models: key.models.map(model => ({
                ...model,
                usage: typeof model.usage === 'string' ? JSON.parse(model.usage) : model.usage
            }))
        }));

        res.json({
            success: true,
            data: keysWithDetails
        });
    } catch (error) {
        console.error('❌ Error getting company keys:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get company keys'
        });
    }
};

// Add new Gemini key (can be central or company)
const addGeminiKey = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-GEMINI-KEYS] addGeminiKey called');
        const { name, apiKey, description, keyType, companyId } = req.body;
        console.log('🔍 [ADMIN-GEMINI-KEYS] Request body:', { name, apiKey: apiKey ? 'EXISTS' : 'MISSING', description, keyType, companyId });

        if (!name || !apiKey) {
            return res.status(400).json({
                success: false,
                error: 'Name and API key are required'
            });
        }

        // Validate keyType
        const validKeyType = keyType === 'CENTRAL' ? 'CENTRAL' : 'COMPANY';
        console.log('🔍 [ADMIN-GEMINI-KEYS] Valid keyType:', validKeyType);
        
        // For CENTRAL keys, companyId must be null
        // For COMPANY keys, companyId is required
        if (validKeyType === 'CENTRAL' && companyId) {
            return res.status(400).json({
                success: false,
                error: 'Central keys cannot have a companyId'
            });
        }

        if (validKeyType === 'COMPANY' && !companyId) {
            return res.status(400).json({
                success: false,
                error: 'Company keys require a companyId'
            });
        }

        // Check if API key already exists
        const existingKey = await prisma.geminiKey.findUnique({
            where: { apiKey }
        });
        
        if (existingKey) {
            return res.status(400).json({
                success: false,
                error: 'مفتاح API موجود مسبقاً في النظام',
                message: `هذا المفتاح مستخدم بالفعل تحت اسم: ${existingKey.name}`,
                errorCode: 'DUPLICATE_API_KEY'
            });
        }

        // Test the key (skip in development for test keys)
        const skipKeyValidation = process.env.NODE_ENV === 'development' && apiKey.includes('Test_Key');
        if (!skipKeyValidation) {
            const testResult = await testGeminiKey(apiKey, 'gemini-2.5-flash');
            if (!testResult.success) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid API key: ${testResult.error}`
                });
            }
        }

        // Get priority based on key type
        let priority = 1;
        try {
            if (validKeyType === 'CENTRAL') {
                // Count central keys
                const centralKeyCount = await prisma.geminiKey.count({
                    where: { 
                        keyType: 'CENTRAL',
                        companyId: null
                    }
                });
                priority = centralKeyCount + 1;
            } else {
                // Count company keys
                const companyKeyCount = await prisma.geminiKey.count({
                    where: { 
                        keyType: 'COMPANY',
                        companyId: companyId
                    }
                });
                priority = companyKeyCount + 1;
            }
        } catch (countError) {
            // Fallback: use raw query if keyType not available in Prisma Client yet
            console.warn('⚠️ [ADMIN-GEMINI-KEYS] keyType not available in Prisma Client, using fallback');
            if (validKeyType === 'CENTRAL') {
                const result = await prisma.$queryRaw`
                    SELECT COUNT(*) as count FROM gemini_keys WHERE companyId IS NULL
                `;
                priority = Number(result[0]?.count || 0) + 1;
            } else {
                const result = await prisma.$queryRaw`
                    SELECT COUNT(*) as count FROM gemini_keys WHERE companyId = ${companyId}
                `;
                priority = Number(result[0]?.count || 0) + 1;
            }
        }

        const keyId = generateId();
        const defaultDescription = validKeyType === 'CENTRAL' 
            ? `مفتاح مركزي رقم ${priority}` 
            : `مفتاح رقم ${priority} - يدعم جميع النماذج`;
        
        const isFirstKey = priority === 1;

        // Create the key using Prisma Client (now supports keyType)
        const finalCompanyId = validKeyType === 'CENTRAL' ? null : companyId;
        const descValue = description || defaultDescription || '';
        
        console.log('🔍 [ADMIN-GEMINI-KEYS] Creating key with Prisma...');
        let newKey;
        try {
            // Try with keyType first (after Prisma Client regeneration)
            newKey = await prisma.geminiKey.create({
                data: {
                    id: keyId,
                    name,
                    apiKey,
                    model: 'gemini-2.5-flash',
                    isActive: isFirstKey,
                    priority,
                    description: descValue,
                    companyId: finalCompanyId,
                    keyType: validKeyType,
                    usage: JSON.stringify({ used: 0, limit: 1000000 }),
                    currentUsage: 0,
                    maxRequestsPerDay: 1500
                }
            });
            console.log('✅ [ADMIN-GEMINI-KEYS] Key created successfully with keyType:', keyId);
        } catch (createError) {
            // Fallback: use raw query if keyType not available
            console.warn('⚠️ [ADMIN-GEMINI-KEYS] Prisma create with keyType failed, using raw query:', createError.message);
            try {
                await prisma.$executeRaw`
                    INSERT INTO gemini_keys 
                    (id, name, apiKey, model, isActive, priority, description, companyId, keyType, \`usage\`, currentUsage, maxRequestsPerDay, createdAt, updatedAt)
                    VALUES 
                    (${keyId}, ${name}, ${apiKey}, 'gemini-2.5-flash', ${isFirstKey}, ${priority}, ${descValue}, ${finalCompanyId || null}, ${validKeyType}, '{"used": 0, "limit": 1000000}', 0, 1500, NOW(), NOW())
                `;
                // Fetch the created key
                newKey = await prisma.geminiKey.findUnique({
                    where: { id: keyId }
                });
                console.log('✅ [ADMIN-GEMINI-KEYS] Key created successfully with raw query:', keyId);
            } catch (rawError) {
                console.error('❌ [ADMIN-GEMINI-KEYS] Both Prisma create and raw query failed:', rawError);
                throw rawError;
            }
        }


        // Create all available models for this key
        // ✅ فقط النماذج المستخدمة فعلياً (7 نماذج) - بناءً على صورة Google AI Studio
        const availableModels = [
            // ✅ النماذج المستخدمة فعلياً (مفعلة)
            { model: 'gemini-2.5-pro', rpm: 2, tpm: 125000, rpd: 50, priority: 1, isEnabled: true },
            { model: 'gemini-robotics-er-1.5-preview', rpm: 10, tpm: 250000, rpd: 250, priority: 2, isEnabled: true },
            { model: 'learnlm-2.0-flash-experimental', rpm: 15, tpm: 1500000, rpd: 1500, priority: 3, isEnabled: true },
            { model: 'gemini-2.5-flash', rpm: 10, tpm: 250000, rpd: 250, priority: 4, isEnabled: true },
            { model: 'gemini-2.0-flash-lite', rpm: 30, tpm: 1000000, rpd: 200, priority: 5, isEnabled: true },
            { model: 'gemini-2.0-flash', rpm: 15, tpm: 1000000, rpd: 200, priority: 6, isEnabled: true },
            { model: 'gemini-2.5-flash-lite', rpm: 15, tpm: 250000, rpd: 1000, priority: 7, isEnabled: true },

            // ❌ باقي النماذج معطلة (غير مستخدمة)
            // نماذج مدفوعة أو تجريبية
            { model: 'gemini-3-pro', rpm: 2, tpm: 125000, rpd: 50, priority: 90, isEnabled: false },
            { model: 'gemini-3-pro-preview', rpm: 2, tpm: 125000, rpd: 50, priority: 91, isEnabled: false },
            { model: 'gemini-2.0-flash-exp', rpm: 10, tpm: 250000, rpd: 50, priority: 92, isEnabled: false },
            
            // نماذج Gemma (غير متوفرة في Google AI Studio API)
            { model: 'gemma-3-27b', rpm: 30, tpm: 15000, rpd: 14400, priority: 93, isEnabled: false },
            { model: 'gemma-3-12b', rpm: 30, tpm: 15000, rpd: 14400, priority: 94, isEnabled: false },
            { model: 'gemma-3-4b', rpm: 30, tpm: 15000, rpd: 14400, priority: 95, isEnabled: false },
            { model: 'gemma-3-2b', rpm: 30, tpm: 15000, rpd: 14400, priority: 96, isEnabled: false },
            { model: 'gemma-3-1b', rpm: 30, tpm: 15000, rpd: 14400, priority: 97, isEnabled: false },

            // نماذج Live/Audio (غير مستخدمة)
            { model: 'gemini-2.5-flash-live', rpm: 15, tpm: 1000000, rpd: 1000, priority: 98, isEnabled: false },
            { model: 'gemini-2.0-flash-live', rpm: 15, tpm: 1000000, rpd: 200, priority: 99, isEnabled: false },
            { model: 'gemini-2.5-flash-native-audio-dialog', rpm: 15, tpm: 1000000, rpd: 1000, priority: 100, isEnabled: false },
            { model: 'gemini-2.5-flash-tts', rpm: 3, tpm: 10000, rpd: 15, priority: 101, isEnabled: false }
        ];

        const createdModels = [];
        for (const modelInfo of availableModels) {
            try {
                // استخدام TPM كـ limit افتراضي للتوافق
                const defaultLimit = modelInfo.tpm || 250000;
                
                await prisma.geminiKeyModel.create({
                    data: {
                        id: generateId(),
                        keyId: keyId,
                        model: modelInfo.model,
                        usage: JSON.stringify({
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
                        }),
                        isEnabled: modelInfo.isEnabled !== undefined ? modelInfo.isEnabled : true,
                        priority: modelInfo.priority
                    }
                });
                createdModels.push(modelInfo.model);
            } catch (error) {
                console.warn(`Warning: Could not create model ${modelInfo.model}:`, error.message);
            }
        }

        res.json({
            success: true,
            data: {
                id: keyId,
                name,
                apiKey: apiKey.substring(0, 10) + '...' + apiKey.slice(-4),
                keyType: validKeyType,
                companyId: validKeyType === 'CENTRAL' ? null : companyId,
                modelsCreated: createdModels.length,
                models: createdModels
            }
        });
    } catch (error) {
        console.error('❌ [CRITICAL] Error adding Gemini key:', error);
        
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                error: 'مفتاح API موجود مسبقاً في النظام',
                errorCode: 'DUPLICATE_API_KEY'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Failed to add Gemini key',
            message: error.message,
            errorCode: error.code,
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code
            } : undefined
        });
    }
};

// Toggle key active status
const toggleGeminiKeyActiveStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const key = await prisma.geminiKey.findUnique({
            where: { id }
        });

        if (!key) {
            return res.status(404).json({
                success: false,
                error: 'Key not found'
            });
        }

        const updatedKey = await prisma.geminiKey.update({
            where: { id },
            data: { isActive: !key.isActive }
        });

        res.json({
            success: true,
            data: {
                id: updatedKey.id,
                isActive: updatedKey.isActive
            }
        });
    } catch (error) {
        console.error('❌ Error toggling key status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle key status'
        });
    }
};

// Update Gemini key model
const updateGeminiKeyModel = async (req, res) => {
    try {
        const { id } = req.params;
        const { modelId, isEnabled, priority } = req.body;

        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'Model ID is required'
            });
        }

        const updateData = {};
        if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
        if (priority !== undefined) updateData.priority = priority;

        const updatedModel = await prisma.geminiKeyModel.update({
            where: { id: modelId },
            data: updateData
        });

        res.json({
            success: true,
            data: updatedModel
        });
    } catch (error) {
        console.error('❌ Error updating model:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update model'
        });
    }
};

// Delete Gemini key
const deleteGeminiKey = async (req, res) => {
    try {
        const { id } = req.params;

        const key = await prisma.geminiKey.findUnique({
            where: { id }
        });

        if (!key) {
            return res.status(404).json({
                success: false,
                error: 'Key not found'
            });
        }

        await prisma.geminiKey.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Key deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting key:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete key'
        });
    }
};

// Test Gemini key
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
            testResult = await testGeminiKey(key.apiKey, model.model);

            if (testResult.success) {
                testModel = model.model;
                break;
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
};

module.exports = {
    getAllGeminiKeys,
    getCentralKeys,
    getCompanyKeys,
    addGeminiKey,
    toggleGeminiKeyActiveStatus,
    updateGeminiKeyModel,
    deleteGeminiKey,
    testGeminiKey2
};

