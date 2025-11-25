import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Switch,
  Button,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Grid,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';
import { useAuth } from '../../hooks/useAuthSimple';
import { useNavigate } from 'react-router-dom';

interface ModelType {
  model: string;
  totalInstances: number;
  enabledInstances: number;
  disabledInstances: number;
  availableInstances: number;
  totalUsage: number;
  totalLimit: number;
  isGloballyEnabled: boolean;
  enabledPercentage: number;
  usagePercentage: number;
  keys: Array<{
    keyId: string;
    keyName: string;
    keyType: 'COMPANY' | 'CENTRAL';
    keyIsActive: boolean;
    companyName?: string;
    isEnabled: boolean;
  }>;
}

const ModelTypesManagement: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [modelTypes, setModelTypes] = useState<ModelType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [modelDetails, setModelDetails] = useState<any>(null);
  const [summary, setSummary] = useState<{
    totalModelTypes: number;
    globallyEnabledTypes: number;
    globallyDisabledTypes: number;
  } | null>(null);

  useEffect(() => {
    // Check if user is authenticated and is Super Admin
    if (!isAuthenticated || !user) {
      console.warn('⚠️ [MODEL-TYPES-MGMT] User not authenticated, redirecting to login');
      navigate('/super-admin/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      console.warn('⚠️ [MODEL-TYPES-MGMT] User is not Super Admin');
      navigate('/super-admin/login');
      return;
    }

    loadModelTypes();
  }, [isAuthenticated, user, navigate]);

  const loadModelTypes = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('admin/model-types');
      console.log('🔍 [MODEL-TYPES-MGMT] Loading model types from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('⚠️ [MODEL-TYPES-MGMT] Unauthorized - redirecting to login');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/super-admin/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📦 [MODEL-TYPES-MGMT] Response:', result);

      if (result.success) {
        setModelTypes(result.data || []);
        setSummary(result.summary || null);
      } else {
        console.error('❌ [MODEL-TYPES-MGMT] Error response:', result);
        alert('فشل تحميل أنواع النماذج: ' + (result.error || 'خطأ غير معروف'));
      }
    } catch (error: any) {
      console.error('❌ [MODEL-TYPES-MGMT] Error loading model types:', error);
      if (!error.message?.includes('401')) {
        alert('خطأ في تحميل أنواع النماذج: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleModelType = async (modelName: string, currentStatus: boolean) => {
    try {
      const url = buildApiUrl(`admin/model-types/${modelName}/toggle`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !currentStatus })
      });

      const result = await response.json();
      if (result.success) {
        alert(result.message || `تم ${!currentStatus ? 'تفعيل' : 'تعطيل'} نوع النموذج "${modelName}"`);
        loadModelTypes();
      } else {
        alert('فشل تحديث حالة نوع النموذج: ' + (result.error || ''));
      }
    } catch (error: any) {
      console.error('Error toggling model type:', error);
      alert('خطأ في تحديث حالة نوع النموذج');
    }
  };

  const viewModelDetails = async (modelName: string) => {
    try {
      const url = buildApiUrl(`admin/model-types/${modelName}`);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success) {
        setModelDetails(result.data);
        setSelectedModel(modelName);
        setDetailsDialogOpen(true);
      } else {
        alert('فشل تحميل تفاصيل نوع النموذج: ' + (result.error || ''));
      }
    } catch (error: any) {
      console.error('Error loading model details:', error);
      alert('خطأ في تحميل تفاصيل نوع النموذج');
    }
  };

  const getModelBadges = (modelName: string) => {
    const badges = [];
    
    // Gemini 3.x
    if (modelName.includes('gemini-3')) {
      badges.push({ label: '🆕 Gemini 3', color: 'success' });
      if (modelName.includes('pro')) badges.push({ label: '🧠 Pro', color: 'primary' });
    }
    
    // Gemini 2.5
    if (modelName.includes('2.5')) {
      badges.push({ label: '🚀 Gemini 2.5', color: 'success' });
      if (modelName.includes('pro')) badges.push({ label: '🧠 Pro', color: 'primary' });
      if (modelName.includes('flash')) badges.push({ label: '⚡ Flash', color: 'info' });
      if (modelName.includes('lite')) badges.push({ label: '💡 Lite', color: 'secondary' });
      if (modelName.includes('tts')) badges.push({ label: '🔊 TTS', color: 'warning' });
      if (modelName.includes('live')) badges.push({ label: '🎙️ Live', color: 'info' });
      if (modelName.includes('audio-dialog')) badges.push({ label: '🎤 Audio Dialog', color: 'warning' });
    }
    
    // Gemini 2.0
    if (modelName.includes('2.0')) {
      badges.push({ label: '✨ Gemini 2.0', color: 'info' });
      if (modelName.includes('flash')) badges.push({ label: '⚡ Flash', color: 'info' });
      if (modelName.includes('lite')) badges.push({ label: '💡 Lite', color: 'secondary' });
      if (modelName.includes('live')) badges.push({ label: '🎙️ Live', color: 'info' });
    }
    
    // Gemini 1.5
    if (modelName.includes('1.5')) {
      badges.push({ label: '📊 Gemini 1.5', color: 'default' });
      if (modelName.includes('pro')) badges.push({ label: '🧠 Pro', color: 'primary' });
      if (modelName.includes('flash')) badges.push({ label: '⚡ Flash', color: 'info' });
      if (modelName.includes('robotics')) badges.push({ label: '🤖 Robotics', color: 'warning' });
    }
    
    // Gemma models
    if (modelName.includes('gemma-3')) {
      badges.push({ label: '🦙 Gemma 3', color: 'secondary' });
      if (modelName.includes('27b')) badges.push({ label: '🔷 27B', color: 'primary' });
      if (modelName.includes('12b')) badges.push({ label: '🔹 12B', color: 'primary' });
      if (modelName.includes('4b')) badges.push({ label: '🔸 4B', color: 'info' });
      if (modelName.includes('2b')) badges.push({ label: '🔹 2B', color: 'info' });
      if (modelName.includes('1b')) badges.push({ label: '🔸 1B', color: 'info' });
    }
    
    // LearnLM
    if (modelName.includes('learnlm')) {
      badges.push({ label: '📚 LearnLM', color: 'warning' });
      if (modelName.includes('experimental')) badges.push({ label: '🔬 Experimental', color: 'warning' });
    }
    
    // General badges
    if (modelName.includes('exp') || modelName.includes('preview')) {
      badges.push({ label: '🔬 تجريبي', color: 'warning' });
    }
    
    return badges;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  // Show loading or auth message
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
          <Button
            variant="contained"
            onClick={() => navigate('/super-admin/login')}
            sx={{ mt: 2 }}
          >
            الانتقال إلى صفحة تسجيل الدخول
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          إدارة أنواع النماذج (Model Types Management)
        </Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={loadModelTypes}
          disabled={loading}
        >
          تحديث
        </Button>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  إجمالي الأنواع
                </Typography>
                <Typography variant="h5">
                  {summary.totalModelTypes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  الأنواع المفعلة
                </Typography>
                <Typography variant="h5" color="success.main">
                  {summary.globallyEnabledTypes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  الأنواع المعطلة
                </Typography>
                <Typography variant="h5" color="error.main">
                  {summary.globallyDisabledTypes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Model Types List */}
      <Grid container spacing={2}>
        {modelTypes.map((modelType) => {
          const badges = getModelBadges(modelType.model);
          return (
            <Grid item xs={12} md={6} key={modelType.model}>
              <Card sx={{ borderLeft: `4px solid ${modelType.isGloballyEnabled ? '#4caf50' : '#9e9e9e'}` }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <Typography variant="h6" component="div">
                          {modelType.model}
                        </Typography>
                        {badges.map((badge, idx) => (
                          <Chip
                            key={idx}
                            label={badge.label}
                            color={badge.color as any}
                            size="small"
                          />
                        ))}
                        <Chip
                          label={modelType.isGloballyEnabled ? 'مفعل' : 'معطل'}
                          color={modelType.isGloballyEnabled ? 'success' : 'default'}
                          size="small"
                        />
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          المثيلات: {modelType.enabledInstances}/{modelType.totalInstances}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          المتاحة: {modelType.availableInstances}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          الاستخدام: {modelType.totalUsage.toLocaleString()} / {modelType.totalLimit.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="عرض التفاصيل">
                        <IconButton
                          size="small"
                          onClick={() => viewModelDetails(modelType.model)}
                          color="primary"
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Enabled/Disabled Progress */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        النسبة المفعلة: {modelType.enabledPercentage.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={modelType.enabledPercentage}
                      color={modelType.isGloballyEnabled ? 'success' : 'error'}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>

                  {/* Usage Progress */}
                  {modelType.totalLimit > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          الاستخدام: {modelType.usagePercentage.toFixed(1)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(modelType.usagePercentage, 100)}
                        color={getUsageColor(modelType.usagePercentage) as any}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    </Box>
                  )}

                  {/* Toggle Switch */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2">
                      {modelType.isGloballyEnabled ? 'نشط عالمياً' : 'معطل عالمياً'}
                    </Typography>
                    <Tooltip title={modelType.isGloballyEnabled ? 'تعطيل النوع لجميع المفاتيح' : 'تفعيل النوع لجميع المفاتيح'}>
                      <Switch
                        checked={modelType.isGloballyEnabled}
                        onChange={() => toggleModelType(modelType.model, modelType.isGloballyEnabled)}
                        color="success"
                      />
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          تفاصيل نوع النموذج: {selectedModel}
        </DialogTitle>
        <DialogContent>
          {modelDetails && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                إجمالي المثيلات: {modelDetails.totalInstances} | 
                مفعلة: {modelDetails.enabledInstances} | 
                معطلة: {modelDetails.disabledInstances}
              </Typography>
              
              <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>المفتاح</TableCell>
                      <TableCell>النوع</TableCell>
                      <TableCell>الشركة</TableCell>
                      <TableCell>الحالة</TableCell>
                      <TableCell>الأولوية</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {modelDetails.instances.map((instance: any) => (
                      <TableRow key={instance.id}>
                        <TableCell>{instance.keyName}</TableCell>
                        <TableCell>
                          <Chip
                            label={instance.keyType === 'CENTRAL' ? 'مركزي' : 'شركة'}
                            color={instance.keyType === 'CENTRAL' ? 'primary' : 'secondary'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{instance.companyName || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={instance.isEnabled ? 'مفعل' : 'معطل'}
                            color={instance.isEnabled ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{instance.priority}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {loading && modelTypes.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && modelTypes.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          لا توجد أنواع نماذج في النظام
        </Alert>
      )}
    </Box>
  );
};

export default ModelTypesManagement;

