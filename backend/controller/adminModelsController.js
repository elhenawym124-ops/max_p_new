const { getSharedPrismaClient } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();

/**
 * Get all models across all keys (central + company keys)
 * Super Admin can see all models
 */
const getAllModels = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODELS] getAllModels called');
        const { keyId, keyType, companyId, model, isEnabled } = req.query;

        let whereClause = {};
        
        // Filter by keyId if provided
        if (keyId) {
            whereClause.keyId = keyId;
        }
        
        // Filter by model name if provided
        if (model) {
            whereClause.model = { contains: model, mode: 'insensitive' };
        }
        
        // Filter by isEnabled if provided
        if (isEnabled !== undefined) {
            whereClause.isEnabled = isEnabled === 'true';
        }

        const models = await prisma.geminiKeyModel.findMany({
            where: whereClause,
            include: {
                key: {
                    select: {
                        id: true,
                        name: true,
                        keyType: true,
                        isActive: true,
                        companyId: true,
                        company: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { model: 'asc' },
                { priority: 'asc' }
            ]
        });

        // Additional filtering by keyType and companyId if needed
        let filteredModels = models;
        
        if (keyType) {
            filteredModels = filteredModels.filter(m => m.key.keyType === keyType);
        }
        
        if (companyId) {
            filteredModels = filteredModels.filter(m => m.key.companyId === companyId);
        }

        // Parse usage for each model
        const modelsWithDetails = filteredModels.map(modelRecord => {
            try {
                const parsedUsage = typeof modelRecord.usage === 'string' 
                    ? JSON.parse(modelRecord.usage) 
                    : modelRecord.usage;
                
                return {
                    ...modelRecord,
                    usage: parsedUsage,
                    keyName: modelRecord.key.name,
                    keyType: modelRecord.key.keyType,
                    keyIsActive: modelRecord.key.isActive,
                    companyName: modelRecord.key.company?.name || null,
                    companyId: modelRecord.key.companyId,
                    usagePercentage: parsedUsage.limit > 0 
                        ? (parsedUsage.used / parsedUsage.limit) * 100 
                        : 0,
                    isAvailable: parsedUsage.used < parsedUsage.limit && modelRecord.isEnabled
                };
            } catch (e) {
                console.error('❌ [ADMIN-MODELS] Error parsing model usage:', e);
                return {
                    ...modelRecord,
                    usage: { used: 0, limit: 0 },
                    usagePercentage: 0,
                    isAvailable: false
                };
            }
        });

        // Group by model name for summary
        const modelSummary = {};
        modelsWithDetails.forEach(m => {
            if (!modelSummary[m.model]) {
                modelSummary[m.model] = {
                    model: m.model,
                    totalInstances: 0,
                    enabledInstances: 0,
                    availableInstances: 0,
                    totalUsage: 0,
                    totalLimit: 0
                };
            }
            modelSummary[m.model].totalInstances++;
            if (m.isEnabled) modelSummary[m.model].enabledInstances++;
            if (m.isAvailable) modelSummary[m.model].availableInstances++;
            modelSummary[m.model].totalUsage += m.usage.used || 0;
            modelSummary[m.model].totalLimit += m.usage.limit || 0;
        });

        res.json({
            success: true,
            data: modelsWithDetails,
            summary: {
                totalModels: modelsWithDetails.length,
                enabledModels: modelsWithDetails.filter(m => m.isEnabled).length,
                availableModels: modelsWithDetails.filter(m => m.isAvailable).length,
                byModel: Object.values(modelSummary)
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODELS] Error getting models:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get models',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
};

/**
 * Toggle model enabled/disabled status
 */
const toggleModelEnabled = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODELS] toggleModelEnabled called');
        const { id } = req.params;
        const { isEnabled } = req.body;

        const model = await prisma.geminiKeyModel.findUnique({
            where: { id },
            include: {
                key: {
                    select: {
                        name: true,
                        keyType: true
                    }
                }
            }
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        const updatedModel = await prisma.geminiKeyModel.update({
            where: { id },
            data: {
                isEnabled: isEnabled !== undefined ? isEnabled : !model.isEnabled,
                updatedAt: new Date()
            },
            include: {
                key: {
                    select: {
                        name: true,
                        keyType: true,
                        company: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        res.json({
            success: true,
            message: `Model ${updatedModel.isEnabled ? 'enabled' : 'disabled'} successfully`,
            data: {
                id: updatedModel.id,
                model: updatedModel.model,
                isEnabled: updatedModel.isEnabled,
                keyName: updatedModel.key.name,
                keyType: updatedModel.key.keyType
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODELS] Error toggling model:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle model',
            message: error.message
        });
    }
};

/**
 * Update model priority
 */
const updateModelPriority = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODELS] updateModelPriority called');
        const { id } = req.params;
        const { priority } = req.body;

        if (priority === undefined || priority < 1) {
            return res.status(400).json({
                success: false,
                error: 'Priority must be a positive number'
            });
        }

        const model = await prisma.geminiKeyModel.findUnique({
            where: { id }
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        const updatedModel = await prisma.geminiKeyModel.update({
            where: { id },
            data: {
                priority: parseInt(priority),
                updatedAt: new Date()
            },
            include: {
                key: {
                    select: {
                        name: true,
                        keyType: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: 'Model priority updated successfully',
            data: {
                id: updatedModel.id,
                model: updatedModel.model,
                priority: updatedModel.priority,
                keyName: updatedModel.key.name
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODELS] Error updating model priority:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update model priority',
            message: error.message
        });
    }
};

/**
 * Update model usage limit
 */
const updateModelLimit = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODELS] updateModelLimit called');
        const { id } = req.params;
        const { limit } = req.body;

        if (limit === undefined || limit < 0) {
            return res.status(400).json({
                success: false,
                error: 'Limit must be a non-negative number'
            });
        }

        const model = await prisma.geminiKeyModel.findUnique({
            where: { id }
        });

        if (!model) {
            return res.status(404).json({
                success: false,
                error: 'Model not found'
            });
        }

        const usage = typeof model.usage === 'string' 
            ? JSON.parse(model.usage) 
            : model.usage;

        const updatedUsage = {
            ...usage,
            limit: parseInt(limit)
        };

        const updatedModel = await prisma.geminiKeyModel.update({
            where: { id },
            data: {
                usage: JSON.stringify(updatedUsage),
                updatedAt: new Date()
            },
            include: {
                key: {
                    select: {
                        name: true,
                        keyType: true
                    }
                }
            }
        });

        const parsedUsage = typeof updatedModel.usage === 'string'
            ? JSON.parse(updatedModel.usage)
            : updatedModel.usage;

        res.json({
            success: true,
            message: 'Model limit updated successfully',
            data: {
                id: updatedModel.id,
                model: updatedModel.model,
                usage: parsedUsage,
                keyName: updatedModel.key.name
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODELS] Error updating model limit:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update model limit',
            message: error.message
        });
    }
};

/**
 * Get models grouped by model name
 */
const getModelsByModelName = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODELS] getModelsByModelName called');
        const { modelName } = req.params;

        const models = await prisma.geminiKeyModel.findMany({
            where: {
                model: modelName
            },
            include: {
                key: {
                    select: {
                        id: true,
                        name: true,
                        keyType: true,
                        isActive: true,
                        companyId: true,
                        company: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { key: { keyType: 'asc' } },
                { priority: 'asc' }
            ]
        });

        const modelsWithDetails = models.map(modelRecord => {
            try {
                const parsedUsage = typeof modelRecord.usage === 'string' 
                    ? JSON.parse(modelRecord.usage) 
                    : modelRecord.usage;
                
                return {
                    ...modelRecord,
                    usage: parsedUsage,
                    keyName: modelRecord.key.name,
                    keyType: modelRecord.key.keyType,
                    keyIsActive: modelRecord.key.isActive,
                    companyName: modelRecord.key.company?.name || null,
                    usagePercentage: parsedUsage.limit > 0 
                        ? (parsedUsage.used / parsedUsage.limit) * 100 
                        : 0,
                    isAvailable: parsedUsage.used < parsedUsage.limit && modelRecord.isEnabled
                };
            } catch (e) {
                return {
                    ...modelRecord,
                    usage: { used: 0, limit: 0 },
                    usagePercentage: 0,
                    isAvailable: false
                };
            }
        });

        res.json({
            success: true,
            data: modelsWithDetails,
            summary: {
                model: modelName,
                totalInstances: modelsWithDetails.length,
                enabledInstances: modelsWithDetails.filter(m => m.isEnabled).length,
                availableInstances: modelsWithDetails.filter(m => m.isAvailable).length
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODELS] Error getting models by name:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get models',
            message: error.message
        });
    }
};

module.exports = {
    getAllModels,
    toggleModelEnabled,
    updateModelPriority,
    updateModelLimit,
    getModelsByModelName
};

