import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Switch,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  FilterList as FilterListIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';
import { useAuth } from '../../hooks/useAuthSimple';
import { useNavigate } from 'react-router-dom';

interface GeminiKeyModel {
  id: string;
  model: string;
  usage: {
    used: number;
    limit: number;
    resetDate?: string;
    rpm?: {
      used: number;
      limit: number;
      windowStart?: string | null;
    };
    rph?: {
      used: number;
      limit: number;
      windowStart?: string | null;
    };
    rpd?: {
      used: number;
      limit: number;
      windowStart?: string | null;
    };
  };
  isEnabled: boolean;
  priority: number;
  lastUsed?: string;
  keyId: string;
  keyName: string;
  keyType: 'COMPANY' | 'CENTRAL';
  keyIsActive: boolean;
  companyName?: string;
  companyId?: string;
  usagePercentage: number;
  isAvailable: boolean;
}

interface ModelSummary {
  model: string;
  totalInstances: number;
  enabledInstances: number;
  availableInstances: number;
  totalUsage: number;
  totalLimit: number;
}

const ModelsManagement: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<GeminiKeyModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModel, setFilterModel] = useState<string>('');
  const [filterKeyType, setFilterKeyType] = useState<'all' | 'COMPANY' | 'CENTRAL'>('all');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [editPriority, setEditPriority] = useState<number>(1);
  const [editLimit, setEditLimit] = useState<number>(0);
  const [summary, setSummary] = useState<{
    totalModels: number;
    enabledModels: number;
    availableModels: number;
    byModel: ModelSummary[];
  } | null>(null);

  useEffect(() => {
    // Check if user is authenticated and is Super Admin
    if (!isAuthenticated || !user) {
      console.warn('⚠️ [MODELS-MGMT] User not authenticated, redirecting to login');
      navigate('/super-admin/login');
      return;
    }

    if (user.role !== 'SUPER_ADMIN') {
      console.warn('⚠️ [MODELS-MGMT] User is not Super Admin');
      navigate('/super-admin/login');
      return;
    }

    loadModels();
  }, [isAuthenticated, user, navigate]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('admin/models');
      console.log('🔍 [MODELS-MGMT] Loading models from:', url);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Handle 401 - Unauthorized
        if (response.status === 401) {
          console.warn('⚠️ [MODELS-MGMT] Unauthorized - redirecting to login');
          // Clear tokens
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          // Redirect to super admin login
          window.location.href = '/super-admin/login';
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('📦 [MODELS-MGMT] Response:', result);

      if (result.success) {
        setModels(result.data || []);
        setSummary(result.summary || null);
      } else {
        console.error('❌ [MODELS-MGMT] Error response:', result);
        alert('فشل تحميل النماذج: ' + (result.error || 'خطأ غير معروف'));
      }
    } catch (error: any) {
      console.error('❌ [MODELS-MGMT] Error loading models:', error);
      // Don't show alert for 401 errors as we're redirecting
      if (!error.message?.includes('401')) {
        alert('خطأ في تحميل النماذج: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleModelEnabled = async (modelId: string, currentStatus: boolean) => {
    try {
      const url = buildApiUrl(`admin/models/${modelId}/toggle`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isEnabled: !currentStatus })
      });

      const result = await response.json();
      if (result.success) {
        loadModels();
      } else {
        alert('فشل تحديث حالة النموذج: ' + (result.error || ''));
      }
    } catch (error: any) {
      console.error('Error toggling model:', error);
      alert('خطأ في تحديث حالة النموذج');
    }
  };

  const startEdit = (model: GeminiKeyModel) => {
    setEditingModel(model.id);
    setEditPriority(model.priority);
    setEditLimit(model.usage.limit);
  };

  const cancelEdit = () => {
    setEditingModel(null);
    setEditPriority(1);
    setEditLimit(0);
  };

  const savePriority = async (modelId: string) => {
    try {
      const url = buildApiUrl(`admin/models/${modelId}/priority`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priority: editPriority })
      });

      const result = await response.json();
      if (result.success) {
        setEditingModel(null);
        loadModels();
      } else {
        alert('فشل تحديث الأولوية: ' + (result.error || ''));
      }
    } catch (error: any) {
      console.error('Error updating priority:', error);
      alert('خطأ في تحديث الأولوية');
    }
  };

  const saveLimit = async (modelId: string) => {
    try {
      const url = buildApiUrl(`admin/models/${modelId}/limit`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: editLimit })
      });

      const result = await response.json();
      if (result.success) {
        setEditingModel(null);
        loadModels();
      } else {
        alert('فشل تحديث الحد: ' + (result.error || ''));
      }
    } catch (error: any) {
      console.error('Error updating limit:', error);
      alert('خطأ في تحديث الحد');
    }
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = limit > 0 ? (used / limit) * 100 : 0;
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const getModelBadges = (modelName: string) => {
    const badges = [];
    if (modelName.includes('2.5')) badges.push({ label: 'Latest', color: 'success' });
    if (modelName.includes('pro')) badges.push({ label: 'Pro', color: 'primary' });
    if (modelName.includes('flash')) badges.push({ label: 'Fast', color: 'info' });
    if (modelName.includes('exp')) badges.push({ label: 'Experimental', color: 'warning' });
    return badges;
  };

  // Filter models
  const filteredModels = models.filter(model => {
    if (filterModel && !model.model.toLowerCase().includes(filterModel.toLowerCase())) {
      return false;
    }
    if (filterKeyType !== 'all' && model.keyType !== filterKeyType) {
      return false;
    }
    if (filterEnabled === 'enabled' && !model.isEnabled) {
      return false;
    }
    if (filterEnabled === 'disabled' && model.isEnabled) {
      return false;
    }
    return true;
  });

  // Group models by model name
  const groupedModels: { [key: string]: GeminiKeyModel[] } = {};
  filteredModels.forEach(model => {
    if (!groupedModels[model.model]) {
      groupedModels[model.model] = [];
    }
    groupedModels[model.model].push(model);
  });

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
          إدارة النماذج (Models Management)
        </Typography>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={loadModels}
          disabled={loading}
        >
          تحديث
        </Button>
      </Box>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  إجمالي النماذج
                </Typography>
                <Typography variant="h5">
                  {summary.totalModels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  النماذج المفعلة
                </Typography>
                <Typography variant="h5" color="success.main">
                  {summary.enabledModels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  النماذج المتاحة
                </Typography>
                <Typography variant="h5" color="primary.main">
                  {summary.availableModels}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  أنواع النماذج
                </Typography>
                <Typography variant="h5">
                  {summary.byModel?.length || 0}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="بحث عن نموذج"
            variant="outlined"
            size="small"
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>نوع المفتاح</InputLabel>
            <Select
              value={filterKeyType}
              label="نوع المفتاح"
              onChange={(e) => setFilterKeyType(e.target.value as any)}
            >
              <MenuItem value="all">الكل</MenuItem>
              <MenuItem value="CENTRAL">مركزي</MenuItem>
              <MenuItem value="COMPANY">شركة</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>الحالة</InputLabel>
            <Select
              value={filterEnabled}
              label="الحالة"
              onChange={(e) => setFilterEnabled(e.target.value as any)}
            >
              <MenuItem value="all">الكل</MenuItem>
              <MenuItem value="enabled">مفعل</MenuItem>
              <MenuItem value="disabled">معطل</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Models by Group */}
      {Object.keys(groupedModels).length === 0 && !loading && (
        <Alert severity="info">لا توجد نماذج مطابقة للفلتر</Alert>
      )}

      {Object.entries(groupedModels).map(([modelName, modelInstances]) => (
        <Card key={modelName} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">{modelName}</Typography>
                {getModelBadges(modelName).map((badge, idx) => (
                  <Chip
                    key={idx}
                    label={badge.label}
                    color={badge.color as any}
                    size="small"
                  />
                ))}
                <Chip
                  label={`${modelInstances.length} مثيل`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${modelInstances.filter(m => m.isEnabled).length} مفعل`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${modelInstances.filter(m => m.isAvailable).length} متاح`}
                  color="primary"
                  size="small"
                  variant="outlined"
                />
              </Box>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>المفتاح</TableCell>
                    <TableCell>النوع</TableCell>
                    <TableCell>الشركة</TableCell>
                    <TableCell>الأولوية</TableCell>
                    <TableCell>الاستخدام</TableCell>
                    <TableCell>الحالة</TableCell>
                    <TableCell>الإجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {modelInstances.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {model.keyName}
                          </Typography>
                          <Chip
                            label={model.keyIsActive ? 'نشط' : 'غير نشط'}
                            color={model.keyIsActive ? 'success' : 'default'}
                            size="small"
                            sx={{ mt: 0.5 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={model.keyType === 'CENTRAL' ? 'مركزي' : 'شركة'}
                          color={model.keyType === 'CENTRAL' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {model.companyName || '-'}
                      </TableCell>
                      <TableCell>
                        {editingModel === model.id ? (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              type="number"
                              value={editPriority}
                              onChange={(e) => setEditPriority(parseInt(e.target.value) || 1)}
                              size="small"
                              sx={{ width: 80 }}
                            />
                            <IconButton size="small" onClick={() => savePriority(model.id)} color="success">
                              <SaveIcon />
                            </IconButton>
                            <IconButton size="small" onClick={cancelEdit} color="error">
                              <CancelIcon />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2">{model.priority}</Typography>
                            <IconButton size="small" onClick={() => startEdit(model)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ minWidth: 200 }}>
                          {/* Total Usage (TPM) */}
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="caption" fontWeight="bold">
                                Total: {model.usage.used.toLocaleString()} / {model.usage.limit.toLocaleString()}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {model.usagePercentage.toFixed(1)}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(model.usagePercentage, 100)}
                              color={getUsageColor(model.usage.used, model.usage.limit) as any}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>

                          {/* RPM (Requests Per Minute) */}
                          {model.usage.rpm && model.usage.rpm.limit > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" fontWeight="bold" color="primary">
                                RPM: {model.usage.rpm.used || 0} / {model.usage.rpm.limit}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={model.usage.rpm.limit > 0 ? Math.min(((model.usage.rpm.used || 0) / model.usage.rpm.limit) * 100, 100) : 0}
                                color={getUsageColor(model.usage.rpm.used || 0, model.usage.rpm.limit) as any}
                                sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                              />
                            </Box>
                          )}

                          {/* RPH (Requests Per Hour) */}
                          {model.usage.rph && model.usage.rph.limit > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" fontWeight="bold" sx={{ color: 'info.main' }}>
                                RPH: {model.usage.rph.used || 0} / {model.usage.rph.limit}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={model.usage.rph.limit > 0 ? Math.min(((model.usage.rph.used || 0) / model.usage.rph.limit) * 100, 100) : 0}
                                color={getUsageColor(model.usage.rph.used || 0, model.usage.rph.limit) as any}
                                sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                              />
                            </Box>
                          )}

                          {/* RPD (Requests Per Day) */}
                          {model.usage.rpd && model.usage.rpd.limit > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" fontWeight="bold" sx={{ color: 'secondary.main' }}>
                                RPD: {model.usage.rpd.used || 0} / {model.usage.rpd.limit}
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={model.usage.rpd.limit > 0 ? Math.min(((model.usage.rpd.used || 0) / model.usage.rpd.limit) * 100, 100) : 0}
                                color={getUsageColor(model.usage.rpd.used || 0, model.usage.rpd.limit) as any}
                                sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                              />
                            </Box>
                          )}

                          {/* Edit Limit */}
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                            {editingModel === model.id ? (
                              <>
                                <TextField
                                  type="number"
                                  value={editLimit}
                                  onChange={(e) => setEditLimit(parseInt(e.target.value) || 0)}
                                  size="small"
                                  sx={{ width: 100 }}
                                  label="Limit"
                                />
                                <IconButton size="small" onClick={() => saveLimit(model.id)} color="success">
                                  <SaveIcon />
                                </IconButton>
                                <IconButton size="small" onClick={cancelEdit} color="error">
                                  <CancelIcon />
                                </IconButton>
                              </>
                            ) : (
                              <Tooltip title="تعديل الحد">
                                <IconButton size="small" onClick={() => startEdit(model)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={model.isEnabled ? 'معطل' : 'تفعيل'}>
                          <Switch
                            checked={model.isEnabled}
                            onChange={() => toggleModelEnabled(model.id, model.isEnabled)}
                            color="success"
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      ))}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
};

export default ModelsManagement;

