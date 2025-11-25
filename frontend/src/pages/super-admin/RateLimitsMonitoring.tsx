import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
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
  LinearProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';
import { useAuth } from '../../hooks/useAuthSimple';
import { useNavigate } from 'react-router-dom';

interface RateLimitInfo {
  model: string;
  keyId: string;
  keyName: string;
  rpm: { used: number; limit: number; percentage: number; status: 'ok' | 'warning' | 'exceeded' };
  rph: { used: number; limit: number; percentage: number; status: 'ok' | 'warning' | 'exceeded' };
  rpd: { used: number; limit: number; percentage: number; status: 'ok' | 'warning' | 'exceeded' };
  totalUsage: { used: number; limit: number; percentage: number };
  isEnabled: boolean;
  windowStart: {
    rpm?: string | null;
    rph?: string | null;
    rpd?: string | null;
  };
}

const RateLimitsMonitoring: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<RateLimitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterModel, setFilterModel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'warning' | 'exceeded'>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'SUPER_ADMIN') {
      navigate('/super-admin/login');
      return;
    }
    loadRateLimits();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadRateLimits();
      }, 60000); // كل دقيقة

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadRateLimits = async () => {
    setLoading(true);
    try {
      const url = buildApiUrl('admin/models');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load rate limits');
      }

      const result = await response.json();
      if (result.success) {
        const rateLimitInfo: RateLimitInfo[] = result.data.map((model: any) => {
          const usage = model.usage || {};
          const rpm = usage.rpm || { used: 0, limit: 0, windowStart: null };
          const rph = usage.rph || { used: 0, limit: 0, windowStart: null };
          const rpd = usage.rpd || { used: 0, limit: 0, windowStart: null };

          const calculatePercentage = (used: number, limit: number) => {
            if (limit === 0) return 0;
            return Math.min((used / limit) * 100, 100);
          };

          const getStatus = (percentage: number): 'ok' | 'warning' | 'exceeded' => {
            if (percentage >= 100) return 'exceeded';
            if (percentage >= 80) return 'warning';
            return 'ok';
          };

          const rpmPercentage = calculatePercentage(rpm.used || 0, rpm.limit || 0);
          const rphPercentage = calculatePercentage(rph.used || 0, rph.limit || 0);
          const rpdPercentage = calculatePercentage(rpd.used || 0, rpd.limit || 0);

          return {
            model: model.model,
            keyId: model.keyId,
            keyName: model.keyName || 'Unknown',
            rpm: {
              used: rpm.used || 0,
              limit: rpm.limit || 0,
              percentage: rpmPercentage,
              status: getStatus(rpmPercentage)
            },
            rph: {
              used: rph.used || 0,
              limit: rph.limit || 0,
              percentage: rphPercentage,
              status: getStatus(rphPercentage)
            },
            rpd: {
              used: rpd.used || 0,
              limit: rpd.limit || 0,
              percentage: rpdPercentage,
              status: getStatus(rpdPercentage)
            },
            totalUsage: {
              used: usage.used || 0,
              limit: usage.limit || 0,
              percentage: calculatePercentage(usage.used || 0, usage.limit || 0)
            },
            isEnabled: model.isEnabled,
            windowStart: {
              rpm: rpm.windowStart,
              rph: rph.windowStart,
              rpd: rpd.windowStart
            }
          };
        });

        setModels(rateLimitInfo);
      }
    } catch (error: any) {
      console.error('Error loading rate limits:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'exceeded') => {
    switch (status) {
      case 'ok':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'warning':
        return <WarningIcon color="warning" fontSize="small" />;
      case 'exceeded':
        return <ErrorIcon color="error" fontSize="small" />;
    }
  };

  const getStatusColor = (status: 'ok' | 'warning' | 'exceeded') => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'warning':
        return 'warning';
      case 'exceeded':
        return 'error';
    }
  };

  const getTimeRemaining = (windowStart: string | null | undefined, windowType: 'rpm' | 'rph' | 'rpd') => {
    if (!windowStart) return 'غير محدد';
    
    const now = new Date();
    const start = new Date(windowStart);
    let windowMs = 0;

    switch (windowType) {
      case 'rpm':
        windowMs = 60 * 1000; // 1 دقيقة
        break;
      case 'rph':
        windowMs = 60 * 60 * 1000; // 1 ساعة
        break;
      case 'rpd':
        windowMs = 24 * 60 * 60 * 1000; // 1 يوم
        break;
    }

    const elapsed = now.getTime() - start.getTime();
    const remaining = windowMs - elapsed;

    if (remaining <= 0) return 'انتهت النافذة';

    const seconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (windowType === 'rpd') {
      return `${hours} ساعة`;
    }
    if (windowType === 'rph') {
      return `${minutes} دقيقة`;
    }
    return `${seconds} ثانية`;
  };

  const filteredModels = models.filter(model => {
    if (filterModel !== 'all' && model.model !== filterModel) return false;
    if (filterStatus === 'all') return true;
    
    return model.rpm.status === filterStatus || 
           model.rph.status === filterStatus || 
           model.rpd.status === filterStatus;
  });

  const uniqueModels = [...new Set(models.map(m => m.model))];

  if (!isAuthenticated || !user || user.role !== 'SUPER_ADMIN') {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Alert severity="warning" sx={{ maxWidth: 500 }}>
          <Typography variant="h6" gutterBottom>
            🔐 مطلوب تسجيل الدخول
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          متابعة Rate Limits
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>النموذج</InputLabel>
            <Select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              label="النموذج"
            >
              <MenuItem value="all">الكل</MenuItem>
              {uniqueModels.map(model => (
                <MenuItem key={model} value={model}>{model}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>الحالة</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              label="الحالة"
            >
              <MenuItem value="all">الكل</MenuItem>
              <MenuItem value="ok">✅ طبيعي</MenuItem>
              <MenuItem value="warning">⚠️ تحذير</MenuItem>
              <MenuItem value="exceeded">❌ تجاوز</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title={autoRefresh ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}>
            <Chip
              label={autoRefresh ? "تحديث تلقائي: مفعل" : "تحديث تلقائي: معطل"}
              onClick={() => setAutoRefresh(!autoRefresh)}
              color={autoRefresh ? "success" : "default"}
              clickable
            />
          </Tooltip>
          <Tooltip title="تحديث">
            <IconButton onClick={loadRateLimits} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                ✅ طبيعي
              </Typography>
              <Typography variant="h4">
                {models.filter(m => m.rpm.status === 'ok' && m.rph.status === 'ok' && m.rpd.status === 'ok').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                ⚠️ تحذير
              </Typography>
              <Typography variant="h4">
                {models.filter(m => m.rpm.status === 'warning' || m.rph.status === 'warning' || m.rpd.status === 'warning').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                ❌ تجاوز
              </Typography>
              <Typography variant="h4">
                {models.filter(m => m.rpm.status === 'exceeded' || m.rph.status === 'exceeded' || m.rpd.status === 'exceeded').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                📊 إجمالي
              </Typography>
              <Typography variant="h4">
                {models.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>النموذج</TableCell>
                <TableCell>المفتاح</TableCell>
                <TableCell>RPM (الدقيقة)</TableCell>
                <TableCell>RPH (الساعة)</TableCell>
                <TableCell>RPD (اليوم)</TableCell>
                <TableCell>الاستخدام الإجمالي</TableCell>
                <TableCell>الحالة</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModels.map((model, index) => (
                <TableRow key={`${model.model}-${model.keyId}-${index}`}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {model.model}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">{model.keyName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption">
                          {model.rpm.used} / {model.rpm.limit}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          {getStatusIcon(model.rpm.status)}
                          <Typography variant="caption">
                            {model.rpm.percentage.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={model.rpm.percentage}
                        color={getStatusColor(model.rpm.status) as any}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                        باقي: {getTimeRemaining(model.windowStart.rpm, 'rpm')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption">
                          {model.rph.used} / {model.rph.limit}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          {getStatusIcon(model.rph.status)}
                          <Typography variant="caption">
                            {model.rph.percentage.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={model.rph.percentage}
                        color={getStatusColor(model.rph.status) as any}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                        باقي: {getTimeRemaining(model.windowStart.rph, 'rph')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption">
                          {model.rpd.used} / {model.rpd.limit}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                          {getStatusIcon(model.rpd.status)}
                          <Typography variant="caption">
                            {model.rpd.percentage.toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={model.rpd.percentage}
                        color={getStatusColor(model.rpd.status) as any}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                        باقي: {getTimeRemaining(model.windowStart.rpd, 'rpd')}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption">
                        {model.totalUsage.used.toLocaleString()} / {model.totalUsage.limit.toLocaleString()}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={model.totalUsage.percentage}
                        sx={{ height: 4, borderRadius: 2, mt: 0.5 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={model.isEnabled ? 'مفعل' : 'معطل'}
                      color={model.isEnabled ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default RateLimitsMonitoring;

