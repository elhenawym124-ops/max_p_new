const { getSharedPrismaClient } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

/**
 * Get all unique model types with statistics
 * Super Admin can see all model types and enable/disable them globally
 */
const getAllModelTypes = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODEL-TYPES] getAllModelTypes called');

        // Get all models grouped by model name
        const allModels = await getSharedPrismaClient().geminiKeyModel.findMany({
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
            }
        });

        // Group by model type (model name)
        const modelTypesMap = {};
        
        allModels.forEach(modelRecord => {
            const modelName = modelRecord.model;
            
            if (!modelTypesMap[modelName]) {
                modelTypesMap[modelName] = {
                    model: modelName,
                    totalInstances: 0,
                    enabledInstances: 0,
                    disabledInstances: 0,
                    availableInstances: 0,
                    totalUsage: 0,
                    totalLimit: 0,
                    keys: [],
                    isGloballyEnabled: true // Default: enabled if any instance is enabled
                };
            }

            const modelType = modelTypesMap[modelName];
            modelType.totalInstances++;
            
            if (modelRecord.isEnabled) {
                modelType.enabledInstances++;
            } else {
                modelType.disabledInstances++;
            }

            try {
                const usage = typeof modelRecord.usage === 'string' 
                    ? JSON.parse(modelRecord.usage) 
                    : modelRecord.usage;
                
                modelType.totalUsage += usage.used || 0;
                modelType.totalLimit += usage.limit || 0;
                
                if (usage.used < usage.limit && modelRecord.isEnabled) {
                    modelType.availableInstances++;
                }
            } catch (e) {
                console.error('Error parsing usage for model:', modelRecord.id, e);
            }

            // Track unique keys
            const keyInfo = {
                keyId: modelRecord.keyId,
                keyName: modelRecord.key.name,
                keyType: modelRecord.key.keyType,
                keyIsActive: modelRecord.key.isActive,
                companyName: modelRecord.key.company?.name || null,
                isEnabled: modelRecord.isEnabled
            };
            
            if (!modelType.keys.find(k => k.keyId === keyInfo.keyId)) {
                modelType.keys.push(keyInfo);
            }
        });

        // Calculate global status for each model type
        // A model type is globally enabled if at least one instance is enabled
        const modelTypes = Object.values(modelTypesMap).map(modelType => ({
            ...modelType,
            isGloballyEnabled: modelType.enabledInstances > 0,
            enabledPercentage: modelType.totalInstances > 0 
                ? (modelType.enabledInstances / modelType.totalInstances) * 100 
                : 0,
            usagePercentage: modelType.totalLimit > 0 
                ? (modelType.totalUsage / modelType.totalLimit) * 100 
                : 0
        }));

        // Sort by model name
        modelTypes.sort((a, b) => a.model.localeCompare(b.model));

        res.json({
            success: true,
            data: modelTypes,
            summary: {
                totalModelTypes: modelTypes.length,
                globallyEnabledTypes: modelTypes.filter(m => m.isGloballyEnabled).length,
                globallyDisabledTypes: modelTypes.filter(m => !m.isGloballyEnabled).length
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODEL-TYPES] Error getting model types:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model types',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
};

/**
 * Enable/Disable a model type globally (affects all instances of this model type)
 */
const toggleModelType = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODEL-TYPES] toggleModelType called');
        const { modelName } = req.params;
        const { enabled } = req.body;

        if (enabled === undefined) {
            return res.status(400).json({
                success: false,
                error: 'enabled field is required (true/false)'
            });
        }

        // Update all instances of this model type
        const result = await getSharedPrismaClient().geminiKeyModel.updateMany({
            where: {
                model: modelName
            },
            data: {
                isEnabled: enabled,
                updatedAt: new Date()
            }
        });

        console.log(`✅ [ADMIN-MODEL-TYPES] Updated ${result.count} instances of ${modelName} to ${enabled ? 'enabled' : 'disabled'}`);

        res.json({
            success: true,
            message: `تم ${enabled ? 'تفعيل' : 'تعطيل'} نوع النموذج "${modelName}" لجميع المفاتيح`,
            data: {
                modelName,
                enabled,
                affectedInstances: result.count
            }
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODEL-TYPES] Error toggling model type:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle model type',
            message: error.message
        });
    }
};

/**
 * Get details of a specific model type
 */
const getModelTypeDetails = async (req, res) => {
    try {
        console.log('🔍 [ADMIN-MODEL-TYPES] getModelTypeDetails called');
        const { modelName } = req.params;

        const models = await getSharedPrismaClient().geminiKeyModel.findMany({
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
            orderBy: {
                priority: 'asc'
            }
        });

        if (models.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Model type not found'
            });
        }

        const details = {
            model: modelName,
            totalInstances: models.length,
            enabledInstances: models.filter(m => m.isEnabled).length,
            disabledInstances: models.filter(m => !m.isEnabled).length,
            instances: models.map(m => {
                try {
                    const usage = typeof m.usage === 'string' ? JSON.parse(m.usage) : m.usage;
                    return {
                        id: m.id,
                        keyId: m.keyId,
                        keyName: m.key.name,
                        keyType: m.key.keyType,
                        keyIsActive: m.key.isActive,
                        companyName: m.key.company?.name || null,
                        isEnabled: m.isEnabled,
                        priority: m.priority,
                        usage,
                        lastUsed: m.lastUsed
                    };
                } catch (e) {
                    return {
                        ...m,
                        usage: { used: 0, limit: 0 }
                    };
                }
            })
        };

        res.json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error('❌ [ADMIN-MODEL-TYPES] Error getting model type details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get model type details',
            message: error.message
        });
    }
};

module.exports = {
    getAllModelTypes,
    toggleModelType,
    getModelTypeDetails
};


