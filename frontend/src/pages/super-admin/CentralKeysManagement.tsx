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
  Cancel as CancelIcon,
  BugReport as BugReportIcon,
  DeleteSweep as DeleteSweepIcon,
  Warning as WarningIcon
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [scanningKeys, setScanningKeys] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'none' | 'activate' | 'deactivate' | 'delete'>('none');
  const [statistics, setStatistics] = useState({
    totalKeys: 0,
    centralKeys: 0,
    companyKeys: 0,
    activeKeys: 0,
    totalModels: 0,
    availableModels: 0
  });
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
  }, [filter, selectedCompany, activeFilter]);

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
        let processedKeys = (data.data || []).map((key: any) => ({
          ...key,
          keyType: key.keyType || (key.companyId ? 'COMPANY' : 'CENTRAL'),
          models: key.models || [],
          totalModels: key.totalModels || (key.models ? key.models.length : 0),
          availableModels: key.availableModels || 0,
          usage: key.usage || { used: 0, limit: 0 },
          createdAt: key.createdAt || new Date().toISOString()
        }));
        
        // Apply active filter
        if (activeFilter === 'active') {
          processedKeys = processedKeys.filter(key => key.isActive);
        } else if (activeFilter === 'inactive') {
          processedKeys = processedKeys.filter(key => !key.isActive);
        }
        
        console.log('✅ [CENTRAL-KEYS] Processed keys:', processedKeys.length);
        setKeys(processedKeys);
        
        // Update statistics if available
        if (data.summary) {
          setStatistics({
            totalKeys: data.summary.totalKeys || 0,
            centralKeys: data.summary.centralKeys || 0,
            companyKeys: data.summary.companyKeys || 0,
            activeKeys: data.summary.activeKeys || 0,
            totalModels: data.summary.totalModels || 0,
            availableModels: data.summary.availableModels || 0
          });
        }
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
        // إزالة من قائمة المفاتيح الفاسدة إذا نجح
        setInvalidKeys(prev => {
          const newSet = new Set(prev);
          newSet.delete(keyId);
          return newSet;
        });
        alert(`${data.message || '✅ المفتاح يعمل بشكل صحيح!'}\n\n` +
              `النموذج المستخدم: ${data.model || 'غير محدد'}\n` +
              `الحالة: ${data.status || 'غير محدد'}\n` +
              (data.response ? `عينة من الرد: ${data.response}` : ''));
      } else {
        // إضافة للمفاتيح الفاسدة
        setInvalidKeys(prev => new Set(prev).add(keyId));
        alert(`${data.message || '❌ المفتاح لا يعمل'}\n\nسبب الخطأ: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error testing key:', error);
      setInvalidKeys(prev => new Set(prev).add(keyId));
      alert('❌ حدث خطأ في اختبار المفتاح');
    } finally {
      setTestingKey(null);
    }
  };

  // فحص جميع المفاتيح للعثور على الفاسدة
  const handleScanAllKeys = async () => {
    if (!confirm(`سيتم فحص ${keys.length} مفتاح. قد يستغرق هذا بعض الوقت. هل تريد المتابعة؟`)) {
      return;
    }

    setScanningKeys(true);
    const newInvalidKeys = new Set<string>();
    let scannedCount = 0;
    let invalidCount = 0;

    for (const key of keys) {
      try {
        const response = await fetch(buildApiUrl(`admin/gemini-keys/${key.id}/test`), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();
        if (!data.success) {
          newInvalidKeys.add(key.id);
          invalidCount++;
        }
      } catch (error) {
        newInvalidKeys.add(key.id);
        invalidCount++;
      }
      scannedCount++;
      
      // تأخير بسيط لتجنب rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setInvalidKeys(newInvalidKeys);
    setScanningKeys(false);
    
    if (invalidCount > 0) {
      alert(`✅ تم فحص ${scannedCount} مفتاح\n❌ تم العثور على ${invalidCount} مفتاح فاسد\n\nيمكنك الآن فلترة المفاتيح الفاسدة وحذفها`);
      setShowInvalidOnly(true);
    } else {
      alert(`✅ تم فحص ${scannedCount} مفتاح\n✅ جميع المفاتيح تعمل بشكل صحيح!`);
    }
  };

  // حذف جميع المفاتيح الفاسدة
  const handleDeleteInvalidKeys = async () => {
    if (invalidKeys.size === 0) {
      alert('لا توجد مفاتيح فاسدة للحذف');
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف ${invalidKeys.size} مفتاح فاسد؟\n\n⚠️ هذا الإجراء لا يمكن التراجع عنه!`)) {
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const keyId of invalidKeys) {
      try {
        const response = await fetch(buildApiUrl(`admin/gemini-keys/${keyId}`), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    alert(`✅ تم حذف ${successCount} مفتاح بنجاح${errorCount > 0 ? `\n❌ فشل حذف ${errorCount} مفتاح` : ''}`);
    setInvalidKeys(new Set());
    setShowInvalidOnly(false);
    loadKeys();
  };

  const handleSelectKey = (keyId: string) => {
    const newSelected = new Set(selectedKeys);
    if (newSelected.has(keyId)) {
      newSelected.delete(keyId);
    } else {
      newSelected.add(keyId);
    }
    setSelectedKeys(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === keys.length && keys.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(keys.map(k => k.id)));
    }
  };

  const handleBulkAction = async () => {
    if (selectedKeys.size === 0) {
      alert('يرجى اختيار مفاتيح أولاً');
      return;
    }

    if (bulkAction === 'none') {
      alert('يرجى اختيار إجراء جماعي');
      return;
    }

    if (bulkAction === 'delete' && !confirm(`هل أنت متأكد من حذف ${selectedKeys.size} مفتاح؟`)) {
      return;
    }

    try {
      const keyIds = Array.from(selectedKeys);
      let successCount = 0;
      let errorCount = 0;

      for (const keyId of keyIds) {
        try {
          if (bulkAction === 'delete') {
            const response = await fetch(buildApiUrl(`admin/gemini-keys/${keyId}`), {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
              }
            });
            const data = await response.json();
            if (data.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } else if (bulkAction === 'activate' || bulkAction === 'deactivate') {
            // Get current key status
            const key = keys.find(k => k.id === keyId);
            if (key && key.isActive !== (bulkAction === 'activate')) {
              const response = await fetch(buildApiUrl(`admin/gemini-keys/${keyId}/toggle`), {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                  'Content-Type': 'application/json'
                }
              });
              const data = await response.json();
              if (data.success) {
                successCount++;
              } else {
                errorCount++;
              }
            } else {
              successCount++; // Already in desired state
            }
          }
        } catch (error) {
          console.error(`Error processing key ${keyId}:`, error);
          errorCount++;
        }
      }

      alert(`${bulkAction === 'delete' ? 'حذف' : bulkAction === 'activate' ? 'تفعيل' : 'إيقاف'} ${successCount} مفتاح بنجاح${errorCount > 0 ? `\n${errorCount} فشل` : ''}`);
      setSelectedKeys(new Set());
      setBulkAction('none');
      loadKeys();
    } catch (error) {
      console.error('Error in bulk action:', error);
      alert('حدث خطأ في تنفيذ الإجراء الجماعي');
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

      {/* Statistics Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
        <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              المفاتيح المركزية
            </Typography>
            <Typography variant="h4" component="div">
              {statistics.centralKeys}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {statistics.activeKeys > 0 ? `${statistics.activeKeys} نشط` : 'لا توجد مفاتيح نشطة'}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              مفاتيح الشركات
            </Typography>
            <Typography variant="h4" component="div">
              {statistics.companyKeys}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              مفاتيح خاصة بالشركات
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              إجمالي المفاتيح
            </Typography>
            <Typography variant="h4" component="div">
              {statistics.totalKeys}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {statistics.totalModels} نموذج | {statistics.availableModels} متاح
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
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

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>حالة المفاتيح</InputLabel>
              <Select
                value={activeFilter}
                label="حالة المفاتيح"
                onChange={(e) => setActiveFilter(e.target.value as any)}
              >
                <MenuItem value="all">الكل</MenuItem>
                <MenuItem value="active">نشطة فقط</MenuItem>
                <MenuItem value="inactive">غير نشطة فقط</MenuItem>
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

            {/* زر فحص المفاتيح الفاسدة */}
            <Tooltip title="فحص جميع المفاتيح للعثور على الفاسدة">
              <Button
                variant="outlined"
                color="warning"
                startIcon={scanningKeys ? <CircularProgress size={20} /> : <BugReportIcon />}
                onClick={handleScanAllKeys}
                disabled={scanningKeys || loading || keys.length === 0}
                size="small"
              >
                {scanningKeys ? 'جاري الفحص...' : 'فحص المفاتيح'}
              </Button>
            </Tooltip>

            {/* فلتر المفاتيح الفاسدة */}
            {invalidKeys.size > 0 && (
              <>
                <Chip
                  icon={<WarningIcon />}
                  label={`${invalidKeys.size} مفتاح فاسد`}
                  color="error"
                  onClick={() => setShowInvalidOnly(!showInvalidOnly)}
                  variant={showInvalidOnly ? 'filled' : 'outlined'}
                />
                <Tooltip title="حذف جميع المفاتيح الفاسدة">
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    onClick={handleDeleteInvalidKeys}
                    size="small"
                  >
                    حذف الفاسدة
                  </Button>
                </Tooltip>
              </>
            )}
          </Box>

          {/* Bulk Actions */}
          {selectedKeys.size > 0 && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                {selectedKeys.size} مفتاح محدد
              </Typography>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>إجراء جماعي</InputLabel>
                <Select
                  value={bulkAction}
                  label="إجراء جماعي"
                  onChange={(e) => setBulkAction(e.target.value as any)}
                >
                  <MenuItem value="none">اختر إجراء</MenuItem>
                  <MenuItem value="activate">تفعيل</MenuItem>
                  <MenuItem value="deactivate">إيقاف</MenuItem>
                  <MenuItem value="delete">حذف</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleBulkAction}
                disabled={bulkAction === 'none'}
              >
                تنفيذ
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setSelectedKeys(new Set());
                  setBulkAction('none');
                }}
              >
                إلغاء
              </Button>
            </Box>
          )}
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
          {/* Select All Checkbox */}
          {keys.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <input
                type="checkbox"
                checked={selectedKeys.size === keys.length && keys.length > 0}
                onChange={handleSelectAll}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <Typography variant="body2" color="text.secondary">
                تحديد الكل ({selectedKeys.size} محدد)
              </Typography>
            </Box>
          )}

          {keys
          .filter(key => !showInvalidOnly || invalidKeys.has(key.id))
          .map((key) => (
            <Card key={key.id} sx={{ 
            borderLeft: `4px solid ${invalidKeys.has(key.id) ? '#f44336' : key.isActive ? '#4caf50' : '#9e9e9e'}`,
            bgcolor: invalidKeys.has(key.id) ? 'rgba(244, 67, 54, 0.05)' : 'inherit'
          }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key.id)}
                      onChange={() => handleSelectKey(key.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', marginTop: 4 }}
                    />
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
                      {invalidKeys.has(key.id) && (
                        <Chip
                          icon={<WarningIcon />}
                          label="فاسد"
                          color="error"
                          size="small"
                        />
                      )}
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

