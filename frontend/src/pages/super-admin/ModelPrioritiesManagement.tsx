import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Grid
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';
import { useAuth } from '../../hooks/useAuthSimple';
import { useNavigate } from 'react-router-dom';

interface ModelPriority {
  model: string;
  currentPriority: number;
  instances: number;
  enabledInstances: number;
  category: string;
}

const ModelPrioritiesManagement: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<ModelPriority[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<number>(1);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'SUPER_ADMIN') {
      navigate('/super-admin/login');
      return;
    }
    loadModelPriorities();
  }, [isAuthenticated, user]);

  const loadModelPriorities = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('admin/models');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load models');
      }

      const result = await response.json();
      if (result.success) {
        // ✅ قائمة النماذج المعطلة (يجب إخفاؤها) - نفس القائمة في modelManager.js
        const disabledModels = [
          'gemini-3-pro',
          'gemini-3-pro-preview',
          'gemini-2.5-pro-preview-05-06',
          'gemini-2.0-flash-exp',
          'gemini-1.5-pro',
          'gemini-1.5-flash',
          'gemini-pro',
          'gemini-flash',
          'gemini-2.5-flash-preview-05-20',
          'gemini-2.5-flash-live',
          'gemini-2.0-flash-live',
          'gemini-2.5-flash-native-audio-dialog',
          'gemini-2.5-flash-tts',
          'gemma-3-27b',
          'gemma-3-12b',
          'gemma-3-4b',
          'gemma-3-2b',
          'gemma-3-1b',
          'gemma-2-27b-it',
          'gemma-2-9b-it'
        ];
        
        // ✅ قائمة النماذج المفعلة فقط (7 نماذج)
        const allowedModels = [
          'gemini-2.5-pro',
          'gemini-robotics-er-1.5-preview',
          'learnlm-2.0-flash-experimental',
          'gemini-2.5-flash',
          'gemini-2.0-flash-lite',
          'gemini-2.0-flash',
          'gemini-2.5-flash-lite'
        ];
        
        // Group by model name and get average priority
        const modelMap: { [key: string]: ModelPriority } = {};
        
        result.data.forEach((model: any) => {
          // ✅ إخفاء النماذج المعطلة (isEnabled: false أو في قائمة المعطلة)
          // ✅ عرض فقط النماذج المفعلة (في قائمة allowedModels)
          if (!model.isEnabled || 
              disabledModels.includes(model.model) || 
              !allowedModels.includes(model.model)) {
            return; // تخطي النماذج المعطلة أو غير المفعلة
          }
          
          if (!modelMap[model.model]) {
            modelMap[model.model] = {
              model: model.model,
              currentPriority: model.priority,
              instances: 1,
              enabledInstances: model.isEnabled ? 1 : 0,
              category: getModelCategory(model.model)
            };
          } else {
            modelMap[model.model].instances++;
            if (model.isEnabled) {
              modelMap[model.model].enabledInstances++;
            }
            // Use the lowest priority (highest priority number = lower priority)
            if (model.priority < modelMap[model.model].currentPriority) {
              modelMap[model.model].currentPriority = model.priority;
            }
          }
        });

        // ✅ تصفية النماذج التي ليس لها enabledInstances (معطلة بالكامل)
        // ✅ أيضاً تصفية النماذج المعطلة من القائمة
        const filteredModels = Object.values(modelMap)
          .filter(m => m.enabledInstances > 0 && !disabledModels.includes(m.model));
        setModels(filteredModels.sort((a, b) => a.currentPriority - b.currentPriority));
      }
    } catch (error: any) {
      console.error('Error loading model priorities:', error);
      setMessage({ type: 'error', text: 'فشل تحميل أولويات النماذج' });
    } finally {
      setLoading(false);
    }
  };

  const getModelCategory = (modelName: string): string => {
    if (modelName.includes('3-pro') || modelName.includes('2.5-pro') || modelName.includes('1.5-pro')) {
      return '🧠 Pro';
    }
    if (modelName.includes('flash')) {
      return '⚡ Flash';
    }
    if (modelName.includes('live')) {
      return '🔴 Live';
    }
    if (modelName.includes('tts') || modelName.includes('audio')) {
      return '🎤 Audio';
    }
    if (modelName.includes('gemma')) {
      return '💎 Gemma';
    }
    if (modelName.includes('experimental') || modelName.includes('preview')) {
      return '🔬 Experimental';
    }
    return '📦 Other';
  };

  const startEdit = (model: ModelPriority) => {
    setEditingModel(model.model);
    setEditPriority(model.currentPriority);
  };

  const cancelEdit = () => {
    setEditingModel(null);
    setEditPriority(1);
  };

  const updatePriority = async (modelName: string) => {
    try {
      // Get all model instances for this model
      const url = buildApiUrl('admin/models');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch model instances');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('Failed to fetch model instances');
      }

      // Filter models by name
      const modelInstances = result.data.filter((m: any) => m.model === modelName);

      // Update all instances
      const updatePromises = modelInstances.map((instance: any) =>
        fetch(buildApiUrl(`admin/models/${instance.id}/priority`), {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ priority: editPriority })
        })
      );

      await Promise.all(updatePromises);
      
      setEditingModel(null);
      setMessage({ type: 'success', text: `تم تحديث أولوية ${modelName} بنجاح` });
      loadModelPriorities();
    } catch (error: any) {
      console.error('Error updating priority:', error);
      setMessage({ type: 'error', text: 'فشل تحديث الأولوية' });
    }
  };

  const movePriority = async (modelName: string, direction: 'up' | 'down') => {
    const modelIndex = models.findIndex(m => m.model === modelName);
    if (modelIndex === -1) return;

    const newPriority = direction === 'up' 
      ? models[modelIndex].currentPriority - 1
      : models[modelIndex].currentPriority + 1;

    if (newPriority < 1) {
      setMessage({ type: 'error', text: 'لا يمكن أن تكون الأولوية أقل من 1' });
      return;
    }

    setEditPriority(newPriority);
    await updatePriority(modelName);
  };

  const getPriorityBadge = (priority: number) => {
    if (priority <= 3) {
      return <Chip label={`أولوية ${priority}`} color="primary" size="small" />;
    }
    if (priority <= 6) {
      return <Chip label={`أولوية ${priority}`} color="info" size="small" />;
    }
    if (priority <= 10) {
      return <Chip label={`أولوية ${priority}`} color="warning" size="small" />;
    }
    return <Chip label={`أولوية ${priority}`} color="default" size="small" />;
  };

  if (!isAuthenticated || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Alert severity="warning" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            🔐 مطلوب تسجيل الدخول
          </Typography>
          <Typography variant="body2" paragraph>
            يجب تسجيل الدخول كـ Super Admin للوصول إلى هذه الصفحة
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          إدارة أولويات النماذج
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Tooltip title="تحديث">
            <IconButton onClick={loadModelPriorities} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {message && (
        <Alert 
          severity={message.type} 
          sx={{ mb: 2 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            📊 أولويات النماذج (الأذكى أولاً)
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>النموذج</TableCell>
                    <TableCell>الفئة</TableCell>
                    <TableCell>الأولوية</TableCell>
                    <TableCell>العدد الإجمالي</TableCell>
                    <TableCell>المفعل</TableCell>
                    <TableCell>الإجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((model, index) => (
                    <TableRow key={model.model}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {model.model}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={model.category} size="small" />
                      </TableCell>
                      <TableCell>
                        {editingModel === model.model ? (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              type="number"
                              value={editPriority}
                              onChange={(e) => setEditPriority(parseInt(e.target.value) || 1)}
                              size="small"
                              sx={{ width: 80 }}
                              inputProps={{ min: 1 }}
                            />
                            <IconButton size="small" onClick={() => updatePriority(model.model)} color="success">
                              <SaveIcon />
                            </IconButton>
                            <IconButton size="small" onClick={cancelEdit} color="error">
                              <CancelIcon />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {getPriorityBadge(model.currentPriority)}
                            <Tooltip title="تعديل">
                              <IconButton size="small" onClick={() => startEdit(model)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {index > 0 && (
                              <Tooltip title="رفع الأولوية">
                                <IconButton 
                                  size="small" 
                                  onClick={() => movePriority(model.model, 'up')}
                                  color="success"
                                >
                                  <ArrowUpIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {index < models.length - 1 && (
                              <Tooltip title="خفض الأولوية">
                                <IconButton 
                                  size="small" 
                                  onClick={() => movePriority(model.model, 'down')}
                                  color="warning"
                                >
                                  <ArrowDownIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>{model.instances}</TableCell>
                      <TableCell>
                        <Chip 
                          label={model.enabledInstances} 
                          color={model.enabledInstances > 0 ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => startEdit(model)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ℹ️ معلومات إضافية
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            • الأولوية الأقل = الأذكى = يتم استخدامه أولاً
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            • النماذج ذات الأولوية 1-3 هي الأذكى (Pro models)
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            • عند تحديث الأولوية، سيتم تحديث جميع نسخ النموذج في جميع المفاتيح
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ModelPrioritiesManagement;

