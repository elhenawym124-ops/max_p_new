import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Avatar,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  FileDownload as FileDownloadIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const CompanyActivity = () => {
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalActivities, setTotalActivities] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    userId: '',
    category: '',
    action: '',
    severity: '',
    isSuccess: '',
    startDate: '',
    endDate: '',
    search: ''
  });

  // Dialog
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch company activities
  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await axios.get(`${API_URL}/api/v1/activity/company/activities`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setActivities(response.data.data.activities);
        setTotalActivities(response.data.data.pagination.total);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء جلب النشاطات');
    } finally {
      setLoading(false);
    }
  };

  // Fetch company stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/activity/company/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [page, rowsPerPage, filters]);

  // Export activities
  const handleExport = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/v1/activity/export/csv`, {
        params: filters,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `company-activities-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('حدث خطأ أثناء تصدير النشاطات');
    }
  };

  // View activity details
  const handleViewDetails = (activity) => {
    setSelectedActivity(activity);
    setDialogOpen(true);
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'LOW': return 'success';
      case 'MEDIUM': return 'info';
      case 'HIGH': return 'warning';
      case 'CRITICAL': return 'error';
      default: return 'default';
    }
  };

  // Get category label in Arabic
  const getCategoryLabel = (category) => {
    const labels = {
      AUTH: 'المصادقة',
      ADS: 'الإعلانات',
      CONVERSATIONS: 'المحادثات',
      BILLING: 'الفواتير',
      SETTINGS: 'الإعدادات',
      SUPPORT: 'الدعم الفني',
      FILES: 'الملفات',
      USERS: 'المستخدمين',
      COMPANY: 'الشركة',
      REPORTS: 'التقارير'
    };
    return labels[category] || category;
  };

  // Get action label in Arabic
  const getActionLabel = (action) => {
    const labels = {
      CREATE: 'إنشاء',
      UPDATE: 'تعديل',
      DELETE: 'حذف',
      LOGIN: 'تسجيل دخول',
      LOGOUT: 'تسجيل خروج',
      UPLOAD: 'رفع',
      DOWNLOAD: 'تحميل',
      VIEW: 'عرض',
      SEND: 'إرسال',
      RECEIVE: 'استقبال',
      ACTIVATE: 'تفعيل',
      DEACTIVATE: 'إيقاف'
    };
    return labels[action] || action;
  };

  // Prepare chart data
  const prepareCategoryChartData = () => {
    if (!stats || !stats.categoryStats) return [];
    return stats.categoryStats.map(cat => ({
      name: getCategoryLabel(cat._id),
      value: cat.totalCount
    }));
  };

  const prepareDailyChartData = () => {
    if (!stats || !stats.dailyStats) return [];
    return stats.dailyStats.reverse().map(day => ({
      date: format(new Date(day._id), 'dd/MM', { locale: ar }),
      نجح: day.successCount,
      فشل: day.failureCount,
      الإجمالي: day.count
    }));
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        📊 نشاطات الشركة
      </Typography>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="لوحة التحكم" />
          <Tab label="جميع النشاطات" />
          <Tab label="أكثر المستخدمين نشاطاً" />
          <Tab label="النشاطات الحساسة" />
        </Tabs>
      </Box>

      {/* Tab 0: Dashboard */}
      {tabValue === 0 && stats && (
        <Box>
          {/* Stats Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    إجمالي النشاطات
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalActivities}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    المستخدمين النشطين
                  </Typography>
                  <Typography variant="h4">
                    {stats.mostActiveUsers?.length || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    النشاطات الحرجة
                  </Typography>
                  <Typography variant="h4" color="error">
                    {stats.severityStats?.find(s => s._id === 'CRITICAL')?.count || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    النشاطات العالية
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {stats.severityStats?.find(s => s._id === 'HIGH')?.count || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  توزيع النشاطات حسب التصنيف
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prepareCategoryChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareCategoryChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  النشاطات اليومية (آخر 30 يوم)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={prepareDailyChartData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="الإجمالي" stroke="#8884d8" />
                    <Line type="monotone" dataKey="نجح" stroke="#82ca9d" />
                    <Line type="monotone" dataKey="فشل" stroke="#ff8042" />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Tab 1: All Activities */}
      {tabValue === 1 && (
        <Box>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>التصنيف</InputLabel>
                  <Select
                    value={filters.category}
                    label="التصنيف"
                    onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="AUTH">المصادقة</MenuItem>
                    <MenuItem value="ADS">الإعلانات</MenuItem>
                    <MenuItem value="CONVERSATIONS">المحادثات</MenuItem>
                    <MenuItem value="BILLING">الفواتير</MenuItem>
                    <MenuItem value="SETTINGS">الإعدادات</MenuItem>
                    <MenuItem value="SUPPORT">الدعم الفني</MenuItem>
                    <MenuItem value="FILES">الملفات</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>الخطورة</InputLabel>
                  <Select
                    value={filters.severity}
                    label="الخطورة"
                    onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="LOW">منخفض</MenuItem>
                    <MenuItem value="MEDIUM">متوسط</MenuItem>
                    <MenuItem value="HIGH">عالي</MenuItem>
                    <MenuItem value="CRITICAL">حرج</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>الحالة</InputLabel>
                  <Select
                    value={filters.isSuccess}
                    label="الحالة"
                    onChange={(e) => setFilters({ ...filters, isSuccess: e.target.value })}
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="true">نجح</MenuItem>
                    <MenuItem value="false">فشل</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="بحث"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="ابحث في الوصف..."
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleExport}
                >
                  تصدير CSV
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Activities Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>المستخدم</TableCell>
                  <TableCell>التاريخ والوقت</TableCell>
                  <TableCell>التصنيف</TableCell>
                  <TableCell>الإجراء</TableCell>
                  <TableCell>الوصف</TableCell>
                  <TableCell>الخطورة</TableCell>
                  <TableCell>الحالة</TableCell>
                  <TableCell>تفاصيل</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      لا توجد نشاطات
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((activity) => (
                    <TableRow key={activity._id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {activity.userId?.name?.charAt(0) || 'U'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">
                              {activity.userId?.name || 'غير معروف'}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {activity.userId?.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {format(new Date(activity.createdAt), 'PPp', { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getCategoryLabel(activity.category)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{getActionLabel(activity.action)}</TableCell>
                      <TableCell>{activity.description}</TableCell>
                      <TableCell>
                        <Chip
                          label={activity.severity}
                          size="small"
                          color={getSeverityColor(activity.severity)}
                        />
                      </TableCell>
                      <TableCell>
                        {activity.isSuccess ? (
                          <CheckCircleIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="عرض التفاصيل">
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(activity)}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalActivities}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="عدد الصفوف:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} من ${count}`}
            />
          </TableContainer>
        </Box>
      )}

      {/* Tab 2: Most Active Users */}
      {tabValue === 2 && stats && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            أكثر 10 مستخدمين نشاطاً
          </Typography>
          <List>
            {stats.mostActiveUsers?.map((user, index) => (
              <React.Fragment key={user.userId}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={`${user.email} - ${user.activityCount} نشاط`}
                  />
                  <Chip
                    icon={<TrendingUpIcon />}
                    label={`${user.activityCount} نشاط`}
                    color="primary"
                  />
                </ListItem>
                {index < stats.mostActiveUsers.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Tab 3: Critical Activities */}
      {tabValue === 3 && stats && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom color="error">
            النشاطات الحساسة الأخيرة
          </Typography>
          <List>
            {stats.criticalActivities?.map((activity, index) => (
              <React.Fragment key={activity._id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: getSeverityColor(activity.severity) + '.main' }}>
                      <WarningIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={activity.description}
                    secondary={
                      <>
                        <Typography component="span" variant="body2">
                          {activity.userId?.name} - {format(new Date(activity.createdAt), 'PPp', { locale: ar })}
                        </Typography>
                      </>
                    }
                  />
                  <Chip
                    label={activity.severity}
                    size="small"
                    color={getSeverityColor(activity.severity)}
                  />
                </ListItem>
                {index < stats.criticalActivities.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}

      {/* Activity Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>تفاصيل النشاط</DialogTitle>
        <DialogContent>
          {selectedActivity && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    المستخدم
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Avatar>
                      {selectedActivity.userId?.name?.charAt(0) || 'U'}
                    </Avatar>
                    <Box>
                      <Typography variant="body1">
                        {selectedActivity.userId?.name || 'غير معروف'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {selectedActivity.userId?.email}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    التصنيف
                  </Typography>
                  <Typography variant="body1">
                    {getCategoryLabel(selectedActivity.category)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    الإجراء
                  </Typography>
                  <Typography variant="body1">
                    {getActionLabel(selectedActivity.action)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">
                    الوصف
                  </Typography>
                  <Typography variant="body1">
                    {selectedActivity.description}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    التاريخ والوقت
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedActivity.createdAt), 'PPpp', { locale: ar })}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">
                    الحالة
                  </Typography>
                  <Typography variant="body1">
                    {selectedActivity.isSuccess ? 'نجح ✅' : 'فشل ❌'}
                  </Typography>
                </Grid>
                {selectedActivity.metadata && (
                  <>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        عنوان IP
                      </Typography>
                      <Typography variant="body1">
                        {selectedActivity.metadata.ipAddress || 'غير متوفر'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">
                        المتصفح
                      </Typography>
                      <Typography variant="body1">
                        {selectedActivity.metadata.browser || 'غير متوفر'}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default CompanyActivity;
