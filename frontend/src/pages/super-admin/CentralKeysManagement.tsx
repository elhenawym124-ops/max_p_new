import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  LinearProgress,
  Collapse,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PowerSettingsNew as PowerIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';

interface GeminiKeyModel {
  id: string;
  model: string;
  usage: {
    used: number;
    limit: number;
    resetDate?: string;
  };
  isEnabled: boolean;
  priority: number;
  lastUsed?: string;
}

interface GeminiKey {
  id: string;
  name: string;
  apiKey: string;
  keyType: 'COMPANY' | 'CENTRAL';
  isActive: boolean;
  priority: number;
  description?: string;
  company?: {
    id: string;
    name: string;
  };
  models: GeminiKeyModel[];
  totalModels: number;
  availableModels: number;
  createdAt?: string;
  usage?: {
    used: number;
    limit: number;
  };
}

const CentralKeysManagement: React.FC = () => {
  const [keys, setKeys] = useState<GeminiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'CENTRAL' | 'COMPANY'>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    apiKey: '',
    description: '',
    keyType: 'CENTRAL' as 'CENTRAL' | 'COMPANY',
    companyId: ''
  });

  useEffect(() => {
    loadKeys();
    loadCompanies();
  }, [filter, selectedCompany]);

  const loadCompanies = async () => {
    try {
      const response = await fetch(buildApiUrl('admin/companies'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.warn('⚠️ [CENTRAL-KEYS] Failed to load companies:', response.status);
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setCompanies(data.data?.companies || []);
      }
    } catch (error) {
      console.error('❌ [CENTRAL-KEYS] Error loading companies:', error);
      // Don't show alert for companies loading - it's not critical
    }
  };

  const loadKeys = async () => {
    try {
      setLoading(true);
      const url = buildApiUrl('admin/gemini-keys');
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('type', filter);
      }
      if (selectedCompany) {
        params.append('companyId', selectedCompany);
      }
      const queryString = params.toString();
      const finalUrl = queryString ? `${url}?${queryString}` : url;

      console.log('🔍 [CENTRAL-KEYS] Loading keys from:', finalUrl);

      const response = await fetch(finalUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📦 [CENTRAL-KEYS] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CENTRAL-KEYS] Error response:', errorText);
        throw new Error(`Failed to load keys: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ [CENTRAL-KEYS] Data received:', data);
      
      if (data.success) {
        // Ensure all keys have required fields and keyType
        const processedKeys = (data.data || []).map((key: any) => ({
          ...key,
          keyType: key.keyType || (key.companyId ? 'COMPANY' : 'CENTRAL'),
          models: key.models || [],
          totalModels: key.totalModels || (key.models ? key.models.length : 0),
          availableModels: key.availableModels || 0,
          usage: key.usage || { used: 0, limit: 0 },
          createdAt: key.createdAt || new Date().toISOString()
        }));
        console.log('✅ [CENTRAL-KEYS] Processed keys:', processedKeys.length);
        setKeys(processedKeys);
      } else {
        console.error('❌ [CENTRAL-KEYS] API returned success=false:', data.error);
        setKeys([]);
      }
    } catch (error: any) {
      console.error('❌ [CENTRAL-KEYS] Error loading keys:', error);
      alert(`خطأ في تحميل المفاتيح: ${error?.message || 'تحقق من أن السيرفر يعمل وتم إعادة تشغيله'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!newKey.name || !newKey.apiKey) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (newKey.keyType === 'COMPANY' && !newKey.companyId) {
      alert('يرجى اختيار الشركة');
      return;
    }

    try {
      const response = await fetch(buildApiUrl('admin/gemini-keys'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKey.name,
          apiKey: newKey.apiKey,
          description: newKey.description,
          keyType: newKey.keyType,
          companyId: newKey.keyType === 'COMPANY' ? newKey.companyId : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('تم إضافة المفتاح بنجاح! ✅');
        setShowAddDialog(false);
        setNewKey({ name: '', apiKey: '', description: '', keyType: 'CENTRAL', companyId: '' });
        loadKeys();
      } else {
        alert(`خطأ: ${data.error || 'فشل في إضافة المفتاح'}`);
      }
    } catch (error) {
      console.error('Error adding key:', error);
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  const handleToggleKey = async (id: string) => {
    try {
      const response = await fetch(buildApiUrl(`admin/gemini-keys/${id}/toggle`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        loadKeys();
      } else {
        alert('فشل في تغيير حالة المفتاح');
      }
    } catch (error) {
      console.error('Error toggling key:', error);
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المفتاح؟')) {
      return;
    }

    try {
      const response = await fetch(buildApiUrl(`admin/gemini-keys/${id}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('تم حذف المفتاح بنجاح! 🗑️');
        loadKeys();
      } else {
        alert('فشل في حذف المفتاح');
      }
    } catch (error) {
      console.error('Error deleting key:', error);
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  const handleToggleExpand = (keyId: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(keyId)) {
      newExpanded.delete(keyId);
    } else {
      newExpanded.add(keyId);
    }
    setExpandedKeys(newExpanded);
  };

  const handleTestKey = async (keyId: string) => {
    try {
      setTestingKey(keyId);
      const response = await fetch(buildApiUrl(`admin/gemini-keys/${keyId}/test`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        alert(`${data.message || '✅ المفتاح يعمل بشكل صحيح!'}\n\n` +
              `النموذج المستخدم: ${data.model || 'غير محدد'}\n` +
              `الحالة: ${data.status || 'غير محدد'}\n` +
              (data.response ? `عينة من الرد: ${data.response}` : ''));
      } else {
        alert(`${data.message || '❌ المفتاح لا يعمل'}\n\nسبب الخطأ: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error testing key:', error);
      alert('❌ حدث خطأ في اختبار المفتاح');
    } finally {
      setTestingKey(null);
    }
  };

  const getModelBadges = (modelName: string) => {
    const badges = [];
    if (modelName.includes('2.5')) {
      badges.push({ label: '🚀 أحدث', color: 'success' });
    }
    if (modelName.includes('flash')) {
      badges.push({ label: '⚡ سريع', color: 'info' });
    }
    if (modelName.includes('pro')) {
      badges.push({ label: '🧠 متقدم', color: 'secondary' });
    }
    return badges;
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 80) return 'error';
    if (percentage >= 60) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            إدارة مفاتيح Gemini
          </Typography>
          <Typography variant="body2" color="text.secondary">
            إدارة المفاتيح المركزية ومفاتيح الشركات
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
        >
          إضافة مفتاح جديد
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>نوع المفاتيح</InputLabel>
              <Select
                value={filter}
                label="نوع المفاتيح"
                onChange={(e) => setFilter(e.target.value as any)}
              >
                <MenuItem value="all">الكل</MenuItem>
                <MenuItem value="CENTRAL">مركزية</MenuItem>
                <MenuItem value="COMPANY">خاصة بالشركات</MenuItem>
              </Select>
            </FormControl>

            {filter === 'COMPANY' && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>الشركة</InputLabel>
                <Select
                  value={selectedCompany}
                  label="الشركة"
                  onChange={(e) => setSelectedCompany(e.target.value)}
                >
                  <MenuItem value="">الكل</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <IconButton onClick={loadKeys} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Keys Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
              لا توجد مفاتيح
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {keys.map((key) => (
            <Card key={key.id} sx={{ borderLeft: `4px solid ${key.isActive ? '#4caf50' : '#9e9e9e'}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" component="div">
                        {key.name}
                      </Typography>
                      <Chip
                        label={key.keyType === 'CENTRAL' ? 'مركزي' : 'شركة'}
                        color={key.keyType === 'CENTRAL' ? 'primary' : 'secondary'}
                        size="small"
                      />
                      <Chip
                        label={key.isActive ? 'نشط' : 'غير نشط'}
                        color={key.isActive ? 'success' : 'default'}
                        size="small"
                      />
                      <Chip
                        label={`أولوية: ${key.priority}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    {key.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {key.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        المفتاح: <span style={{ fontFamily: 'monospace' }}>{key.apiKey}</span>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        النماذج: {key.availableModels}/{key.totalModels}
                      </Typography>
                      {key.company && (
                        <Typography variant="caption" color="text.secondary">
                          الشركة: {key.company.name}
                        </Typography>
                      )}
                      {key.createdAt && (
                        <Typography variant="caption" color="text.secondary">
                          تاريخ الإضافة: {new Date(key.createdAt).toLocaleDateString('ar-EG')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="اختبار المفتاح">
                      <IconButton
                        size="small"
                        onClick={() => handleTestKey(key.id)}
                        disabled={testingKey === key.id}
                        color="primary"
                      >
                        {testingKey === key.id ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={key.isActive ? 'إيقاف' : 'تفعيل'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleKey(key.id)}
                        color={key.isActive ? 'error' : 'success'}
                      >
                        <PowerIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="حذف">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteKey(key.id)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(key.id)}
                    >
                      {expandedKeys.has(key.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                {/* Models List - Expandable */}
                <Collapse in={expandedKeys.has(key.id)}>
                  {key.models && key.models.length > 0 ? (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                        النماذج المدعومة:
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                        {key.models.map((model) => {
                          const usagePercentage = (model.usage.used / model.usage.limit) * 100;
                          const badges = getModelBadges(model.model);
                          return (
                            <Card key={model.id} variant="outlined" sx={{ p: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                    <Typography variant="body2" fontWeight="medium">
                                      {model.model}
                                    </Typography>
                                    {badges.map((badge, idx) => (
                                      <Chip
                                        key={idx}
                                        label={badge.label}
                                        color={badge.color as any}
                                        size="small"
                                        sx={{ height: 20, fontSize: '0.7rem' }}
                                      />
                                    ))}
                                  </Box>
                                  <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                    <Typography variant="caption" color="text.secondary">
                                      الاستخدام: {model.usage.used.toLocaleString()} / {model.usage.limit.toLocaleString()}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      الأولوية: {model.priority}
                                    </Typography>
                                  </Box>
                                  {model.lastUsed && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                                      آخر استخدام: {new Date(model.lastUsed).toLocaleDateString('ar-EG')}
                                    </Typography>
                                  )}
                                </Box>
                                <Chip
                                  icon={model.isEnabled ? <CheckCircleIcon /> : <CancelIcon />}
                                  label={model.isEnabled ? 'مُفعل' : 'معطل'}
                                  color={model.isEnabled ? 'success' : 'error'}
                                  size="small"
                                />
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(usagePercentage, 100)}
                                color={getUsageColor(model.usage.used, model.usage.limit) as any}
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                {usagePercentage.toFixed(1)}% مستخدم
                              </Typography>
                            </Card>
                          );
                        })}
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                      <Typography variant="body2" color="text.secondary">
                        لا توجد نماذج متاحة لهذا المفتاح
                      </Typography>
                    </Box>
                  )}
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Add Key Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إضافة مفتاح جديد</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>نوع المفتاح</InputLabel>
              <Select
                value={newKey.keyType}
                label="نوع المفتاح"
                onChange={(e) => setNewKey({ ...newKey, keyType: e.target.value as any })}
              >
                <MenuItem value="CENTRAL">مركزي</MenuItem>
                <MenuItem value="COMPANY">خاص بشركة</MenuItem>
              </Select>
            </FormControl>

            {newKey.keyType === 'COMPANY' && (
              <FormControl fullWidth>
                <InputLabel>الشركة</InputLabel>
                <Select
                  value={newKey.companyId}
                  label="الشركة"
                  onChange={(e) => setNewKey({ ...newKey, companyId: e.target.value })}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <TextField
              fullWidth
              label="الاسم"
              value={newKey.name}
              onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="API Key"
              value={newKey.apiKey}
              onChange={(e) => setNewKey({ ...newKey, apiKey: e.target.value })}
              required
              type="password"
            />
            <TextField
              fullWidth
              label="الوصف"
              value={newKey.description}
              onChange={(e) => setNewKey({ ...newKey, description: e.target.value })}
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>إلغاء</Button>
          <Button onClick={handleAddKey} variant="contained">
            إضافة
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CentralKeysManagement;

