import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Grid,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Badge
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Key as KeyIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { buildApiUrl } from '../../utils/urlHelper';
import { useAuth } from '../../hooks/useAuthSimple';
import { useNavigate } from 'react-router-dom';

interface SystemStats {
  totalKeys: number;
  totalModels: number;
  excludedModelsCount: number;
  supportedModelsCount: number;
  lastUsedKey: {
    keyId: string;
    keyName: string;
    companyId: string;
  } | null;
}

interface ModelQuota {
  modelName: string;
  totalRPM: number;
  totalRPMUsed: number;
  rpmPercentage: number;
  totalTPM: number;
  totalTPMUsed: number;
  tpmPercentage: number;
  totalRPD: number;
  totalRPDUsed: number;
  rpdPercentage: number;
  availableModels: number;
  totalModels: number;
  status: 'healthy' | 'warning' | 'error';
}

interface ExcludedModel {
  id: string;
  modelName: string;
  keyId: string;
  keyName: string;
  companyId: string;
  reason: string;
  excludedAt: string;
  retryAt: string;
  retryCount: number;
  lastRetryAt: string | null;
}

interface SystemError {
  type: string;
  modelName: string;
  companyId: string;
  companyName: string;
  message: string;
  severity: 'error' | 'warning';
  timestamp: string;
}

interface RoundRobinKey {
  keyId: string;
  keyName: string;
  companyId: string;
  companyName: string;
  priority: number;
  modelsCount: number;
  isLastUsed: boolean;
}

const QuotaMonitoringDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [modelQuotas, setModelQuotas] = useState<ModelQuota[]>([]);
  const [excludedModels, setExcludedModels] = useState<ExcludedModel[]>([]);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [warnings, setWarnings] = useState<SystemError[]>([]);
  const [roundRobinKeys, setRoundRobinKeys] = useState<RoundRobinKey[]>([]);
  const [lastUsedKey, setLastUsedKey] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [autoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/super-admin/login');
      return undefined;
    }

    if (user.role !== 'SUPER_ADMIN') {
      navigate('/super-admin/login');
      return undefined;
    }

    loadData();

    // Auto-refresh every 30 seconds
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadData();
      }, 30000);

      return () => clearInterval(interval);
    }
    
    return undefined;
  }, [isAuthenticated, user, navigate, autoRefresh]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load system status
      const statusUrl = buildApiUrl('admin/quota-monitoring/status');
      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!statusResponse.ok) {
        if (statusResponse.status === 401) {
          console.warn('⚠️ [QUOTA-MONITORING] Unauthorized - redirecting to login');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/super-admin/login';
          return;
        }
        throw new Error(`HTTP error! status: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      console.log('📊 [QUOTA-MONITORING] Status data:', statusData);

      if (statusData.success) {
        console.log('📊 [QUOTA-MONITORING] Setting data:', {
          systemStats: statusData.data.systemStats,
          modelQuotasCount: statusData.data.modelQuotas?.length || 0,
          excludedModelsCount: statusData.data.excludedModels?.length || 0
        });
        setSystemStats(statusData.data.systemStats);
        setModelQuotas(statusData.data.modelQuotas || []);
        setExcludedModels(statusData.data.excludedModels || []);
      } else {
        console.error('❌ [QUOTA-MONITORING] API returned success: false', statusData);
      }

      // Load errors
      const errorsUrl = buildApiUrl('admin/quota-monitoring/errors');
      const errorsResponse = await fetch(errorsUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (errorsResponse.ok) {
        const errorsData = await errorsResponse.json();
        if (errorsData.success) {
          setErrors(errorsData.data.errors);
          setWarnings(errorsData.data.warnings);
        }
      }

      // Load Round-Robin status
      const roundRobinUrl = buildApiUrl('admin/quota-monitoring/round-robin');
      const roundRobinResponse = await fetch(roundRobinUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (roundRobinResponse.ok) {
        const roundRobinData = await roundRobinResponse.json();
        console.log('📊 [QUOTA-MONITORING] Round-Robin data:', roundRobinData);
        if (roundRobinData.success) {
          console.log('📊 [QUOTA-MONITORING] Setting Round-Robin data:', {
            activeKeysCount: roundRobinData.data.activeKeys?.length || 0,
            lastUsedKey: roundRobinData.data.lastUsedKey
          });
          setRoundRobinKeys(roundRobinData.data.activeKeys || []);
          setLastUsedKey(roundRobinData.data.lastUsedKey);
        }
      } else {
        console.error('❌ [QUOTA-MONITORING] Round-Robin response not OK:', roundRobinResponse.status);
      }

      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('❌ [QUOTA-MONITORING] Error loading quota monitoring data:', error);
      console.error('❌ [QUOTA-MONITORING] Error details:', {
        message: error?.message || 'Unknown error',
        stack: error?.stack
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CheckCircleIcon />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTimeRemaining = (retryAt: string) => {
    const now = new Date();
    const retry = new Date(retryAt);
    const diff = retry.getTime() - now.getTime();

    if (diff <= 0) return 'جاهز لإعادة المحاولة';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours} ساعة و ${minutes} دقيقة`;
    }
    return `${minutes} دقيقة`;
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          📊 متابعة نظام تجميع الكوتة وRound-Robin
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            label={autoRefresh ? 'تحديث تلقائي: مفعّل' : 'تحديث تلقائي: معطّل'}
            color={autoRefresh ? 'success' : 'default'}
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            آخر تحديث: {lastUpdate.toLocaleTimeString('ar-EG')}
          </Typography>
          <IconButton onClick={loadData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* System Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    المفاتيح النشطة
                  </Typography>
                  <Typography variant="h4">
                    {systemStats?.totalKeys || 0}
                  </Typography>
                </Box>
                <KeyIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    النماذج المفعلة
                  </Typography>
                  <Typography variant="h4">
                    {systemStats?.totalModels || 0}
                  </Typography>
                </Box>
                <TimelineIcon sx={{ fontSize: 40, color: 'info.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    النماذج المستثناة
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {systemStats?.excludedModelsCount || 0}
                  </Typography>
                </Box>
                <BlockIcon sx={{ fontSize: 40, color: 'warning.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    آخر مفتاح مستخدم
                  </Typography>
                  <Typography variant="body1" noWrap>
                    {systemStats?.lastUsedKey?.keyName || 'لا يوجد'}
                  </Typography>
                </Box>
                <RefreshIcon sx={{ fontSize: 40, color: 'success.main' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Total Quota Cards - إجماليات الكوتة لجميع النماذج */}
      {modelQuotas.length > 0 && (() => {
        const totalRPM = modelQuotas.reduce((sum, q) => sum + q.totalRPM, 0);
        const totalRPMUsed = modelQuotas.reduce((sum, q) => sum + q.totalRPMUsed, 0);
        const totalRPMRemaining = totalRPM - totalRPMUsed;
        const totalRPMPercentage = totalRPM > 0 ? (totalRPMUsed / totalRPM) * 100 : 0;

        const totalTPM = modelQuotas.reduce((sum, q) => sum + q.totalTPM, 0);
        const totalTPMUsed = modelQuotas.reduce((sum, q) => sum + q.totalTPMUsed, 0);
        const totalTPMRemaining = totalTPM - totalTPMUsed;
        const totalTPMPercentage = totalTPM > 0 ? (totalTPMUsed / totalTPM) * 100 : 0;

        const totalRPD = modelQuotas.reduce((sum, q) => sum + q.totalRPD, 0);
        const totalRPDUsed = modelQuotas.reduce((sum, q) => sum + q.totalRPDUsed, 0);
        const totalRPDRemaining = totalRPD - totalRPDUsed;
        const totalRPDPercentage = totalRPD > 0 ? (totalRPDUsed / totalRPD) * 100 : 0;

        return (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📊 إجمالي RPM (كل دقيقة)
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                    {totalRPMRemaining.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    متاح من {totalRPM.toLocaleString()} ({totalRPMPercentage.toFixed(1)}% مستخدم)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                    المستهلك: {totalRPMUsed.toLocaleString()} / {totalRPM.toLocaleString()}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(totalRPMPercentage, 100)}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'info.main', color: 'info.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    🚀 إجمالي TPM (كل دقيقة)
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                    {totalTPMRemaining.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    متاح من {totalTPM.toLocaleString()} ({totalTPMPercentage.toFixed(1)}% مستخدم)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                    المستهلك: {totalTPMUsed.toLocaleString()} / {totalTPM.toLocaleString()}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(totalTPMPercentage, 100)}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📅 إجمالي RPD (كل يوم)
                  </Typography>
                  <Typography variant="h4" component="div" sx={{ mb: 1 }}>
                    {totalRPDRemaining.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    متاح من {totalRPD.toLocaleString()} ({totalRPDPercentage.toFixed(1)}% مستخدم)
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
                    المستهلك اليوم: {totalRPDUsed.toLocaleString()} / {totalRPD.toLocaleString()}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(totalRPDPercentage, 100)}
                    sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );
      })()}

      {/* Errors and Warnings Summary */}
      {(errors.length > 0 || warnings.length > 0) && (
        <Box sx={{ mb: 3 }}>
          {errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h6">❌ {errors.length} خطأ</Typography>
              <Typography variant="body2">
                {errors.slice(0, 3).map(e => e.message).join(' • ')}
                {errors.length > 3 && ` • و ${errors.length - 3} خطأ آخر`}
              </Typography>
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert severity="warning">
              <Typography variant="h6">⚠️ {warnings.length} تحذير</Typography>
              <Typography variant="body2">
                {warnings.slice(0, 3).map(w => w.message).join(' • ')}
                {warnings.length > 3 && ` • و ${warnings.length - 3} تحذير آخر`}
              </Typography>
            </Alert>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_e, newValue) => setActiveTab(newValue)}>
          <Tab label={`حالة الكوتة (${modelQuotas.length})`} />
          <Tab label={
            <Badge badgeContent={excludedModels.length} color="warning">
              النماذج المستثناة
            </Badge>
          } />
          <Tab label="Round-Robin" />
          <Tab label={
            <Badge badgeContent={errors.length} color="error">
              الأخطاء والتحذيرات
            </Badge>
          } />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>النموذج</TableCell>
                <TableCell align="center">RPM</TableCell>
                <TableCell align="center">TPM</TableCell>
                <TableCell align="center">RPD</TableCell>
                <TableCell align="center">النماذج المتاحة</TableCell>
                <TableCell align="center">الحالة</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {modelQuotas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      لا توجد بيانات للعرض. تأكد من وجود مفاتيح نشطة ونماذج مفعلة.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                modelQuotas.map((quota) => (
                  <TableRow key={quota.modelName}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
                      {quota.modelName}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption">
                        {quota.totalRPMUsed} / {quota.totalRPM} ({quota.rpmPercentage.toFixed(1)}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(quota.rpmPercentage, 100)}
                        color={quota.rpmPercentage >= 80 ? 'warning' : 'primary'}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption">
                        {quota.totalTPMUsed.toLocaleString()} / {quota.totalTPM.toLocaleString()} ({quota.tpmPercentage.toFixed(1)}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(quota.tpmPercentage, 100)}
                        color={quota.tpmPercentage >= 80 ? 'warning' : 'primary'}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="caption">
                        {quota.totalRPDUsed} / {quota.totalRPD} ({quota.rpdPercentage.toFixed(1)}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(quota.rpdPercentage, 100)}
                        color={quota.rpdPercentage >= 100 ? 'error' : quota.rpdPercentage >= 80 ? 'warning' : 'primary'}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${quota.availableModels} / ${quota.totalModels}`}
                      size="small"
                      color={quota.availableModels === quota.totalModels ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={quota.status === 'healthy' ? 'صحي' : quota.status === 'warning' ? 'تحذير' : 'خطأ'}>
                      {getStatusIcon(quota.status)}
                    </Tooltip>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>النموذج</TableCell>
                <TableCell>المفتاح</TableCell>
                <TableCell>السبب</TableCell>
                <TableCell>وقت الاستثناء</TableCell>
                <TableCell>إعادة المحاولة</TableCell>
                <TableCell>عدد المحاولات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {excludedModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">لا توجد نماذج مستثناة</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                excludedModels.map((excluded) => (
                  <TableRow key={excluded.id}>
                    <TableCell>{excluded.modelName}</TableCell>
                    <TableCell>{excluded.keyName}</TableCell>
                    <TableCell>
                      <Chip label={excluded.reason} size="small" color="warning" />
                    </TableCell>
                    <TableCell>{formatDate(excluded.excludedAt)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTimeRemaining(excluded.retryAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(excluded.retryAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={excluded.retryCount} size="small" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {activeTab === 2 && (
        <Box>
          {lastUsedKey && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  آخر مفتاح مستخدم (Round-Robin)
                </Typography>
                <Typography variant="body1">
                  <strong>المفتاح:</strong> {lastUsedKey.keyName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>الشركة:</strong> {lastUsedKey.companyName}
                </Typography>
              </CardContent>
            </Card>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>المفتاح</TableCell>
                  <TableCell>الشركة</TableCell>
                  <TableCell>الأولوية</TableCell>
                  <TableCell>عدد النماذج</TableCell>
                  <TableCell>الحالة</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roundRobinKeys.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary" sx={{ py: 3 }}>
                        لا توجد مفاتيح نشطة للعرض.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  roundRobinKeys.map((key) => (
                    <TableRow
                    key={key.keyId}
                    sx={{
                      backgroundColor: key.isLastUsed ? 'action.selected' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {key.isLastUsed && <Chip label="آخر مستخدم" size="small" color="primary" />}
                        <Typography>{key.keyName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{key.companyName}</TableCell>
                    <TableCell align="center">{key.priority}</TableCell>
                    <TableCell align="center">{key.modelsCount}</TableCell>
                    <TableCell align="center">
                      {key.isLastUsed ? (
                        <Chip label="نشط" size="small" color="primary" />
                      ) : (
                        <Chip label="متاح" size="small" />
                      )}
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 3 && (
        <Box>
          {errors.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" color="error" gutterBottom>
                ❌ الأخطاء ({errors.length})
              </Typography>
              {errors.map((error, index) => (
                <Alert severity="error" key={index} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>{error.modelName}</strong> - {error.companyName}
                  </Typography>
                  <Typography variant="body2">{error.message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(error.timestamp)}
                  </Typography>
                </Alert>
              ))}
            </Box>
          )}

          {warnings.length > 0 && (
            <Box>
              <Typography variant="h6" color="warning.main" gutterBottom>
                ⚠️ التحذيرات ({warnings.length})
              </Typography>
              {warnings.map((warning, index) => (
                <Alert severity="warning" key={index} sx={{ mb: 1 }}>
                  <Typography variant="body2">
                    <strong>{warning.modelName}</strong> - {warning.companyName}
                  </Typography>
                  <Typography variant="body2">{warning.message}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(warning.timestamp)}
                  </Typography>
                </Alert>
              ))}
            </Box>
          )}

          {errors.length === 0 && warnings.length === 0 && (
            <Alert severity="success">
              لا توجد أخطاء أو تحذيرات - النظام يعمل بشكل طبيعي ✅
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default QuotaMonitoringDashboard;

