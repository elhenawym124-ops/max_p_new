/**
 * 📱 WhatsApp Settings Page
 * صفحة إعدادات WhatsApp
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Paper,
  Avatar,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  QrCode as QrCodeIcon,
  PhoneAndroid as PhoneIcon,
  Settings as SettingsIcon,
  SmartToy as AIIcon,
  NotificationsActive as NotificationIcon,
  Storage as StorageIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  CheckCircle as ConnectedIcon,
  Cancel as DisconnectedIcon,
  HourglassEmpty as PendingIcon,
  Save as SaveIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiClient } from '../../services/apiClient';
import useSocket from '../../hooks/useSocket';
import QRCode from 'qrcode.react';

// Alias for easier usage
const api = apiClient;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface Session {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  liveStatus: string;
  qrCode: string | null;
  aiEnabled: boolean;
  autoReply: boolean;
  aiMode: string;
  welcomeMessage: string | null;
  awayMessage: string | null;
  workingHoursEnabled: boolean;
  workingHours: any;
  isDefault: boolean;
  createdAt: string;
  _count: {
    messages: number;
    contacts: number;
  };
}

interface Settings {
  id: string;
  isEnabled: boolean;
  maxSessions: number;
  notificationSound: boolean;
  browserNotifications: boolean;
  defaultAIMode: string;
  aiWelcomeEnabled: boolean;
  aiAwayEnabled: boolean;
  maxImageSize: number;
  maxVideoSize: number;
  maxDocumentSize: number;
  autoCompressImages: boolean;
  autoArchiveDays: number | null;
}

interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string;
  usageCount: number;
  isActive: boolean;
}

const WhatsAppSettings: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [currentQR, setCurrentQR] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<Settings | null>(null);

  // Quick Replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [quickReplyDialogOpen, setQuickReplyDialogOpen] = useState(false);
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const [quickReplyForm, setQuickReplyForm] = useState({
    title: '',
    shortcut: '',
    content: '',
    category: 'general',
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Socket.IO listeners for real-time updates
  useEffect(() => {
    console.log('🔌 Socket status:', socket ? 'Connected' : 'Not connected');
    if (!socket) return;

    console.log('🔌 Setting up WhatsApp Socket listeners...');

    const handleQRCode = (data: { sessionId: string; qr: string }) => {
      console.log('📱 QR Code received:', data.sessionId, 'QR length:', data.qr?.length);
      
      // Update session with QR code
      setSessions(prev => prev.map(session => 
        session.id === data.sessionId 
          ? { ...session, qrCode: data.qr, status: 'QR_PENDING' }
          : session
      ));
      
      // Show QR dialog
      setCurrentQR(data.qr);
      setQrDialogOpen(true);
      enqueueSnackbar('تم إنشاء رمز الاستجابة السريعة - امسحه بهاتفك', { variant: 'info' });
    };

    const handleConnectionUpdate = (data: { sessionId: string; status: string; phoneNumber?: string }) => {
      console.log('📱 Connection update:', data);
      
      setSessions(prev => prev.map(session => 
        session.id === data.sessionId 
          ? { 
              ...session, 
              status: data.status,
              liveStatus: data.status.toLowerCase(),
              phoneNumber: data.phoneNumber || session.phoneNumber,
              qrCode: data.status === 'CONNECTED' ? null : session.qrCode
            }
          : session
      ));

      if (data.status === 'CONNECTED') {
        setQrDialogOpen(false);
        enqueueSnackbar('تم ربط WhatsApp بنجاح!', { variant: 'success' });
      } else if (data.status === 'DISCONNECTED') {
        enqueueSnackbar('تم قطع الاتصال مع WhatsApp', { variant: 'warning' });
      }
    };

    socket.on('whatsapp:qr', handleQRCode);
    socket.on('whatsapp:connection', handleConnectionUpdate);

    return () => {
      socket.off('whatsapp:qr', handleQRCode);
      socket.off('whatsapp:connection', handleConnectionUpdate);
    };
  }, [socket, enqueueSnackbar]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, settingsRes, quickRepliesRes] = await Promise.all([
        api.get('/whatsapp/sessions'),
        api.get('/whatsapp/settings'),
        api.get('/whatsapp/quick-replies'),
      ]);

      setSessions(sessionsRes.data.sessions || []);
      setSettings(settingsRes.data.settings);
      setQuickReplies(quickRepliesRes.data.quickReplies || []);
    } catch (error: any) {
      enqueueSnackbar('حدث خطأ أثناء تحميل البيانات', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Session handlers
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) {
      enqueueSnackbar('يرجى إدخال اسم الجلسة', { variant: 'warning' });
      return;
    }

    try {
      setSaving(true);
      const res = await api.post('/whatsapp/sessions', { name: newSessionName });
      setSessions([...sessions, res.data.session]);
      setSessionDialogOpen(false);
      setNewSessionName('');
      enqueueSnackbar('تم إنشاء الجلسة بنجاح', { variant: 'success' });
      
      // Show QR code
      if (res.data.session.qrCode) {
        setCurrentQR(res.data.session.qrCode);
        setQrDialogOpen(true);
      }
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectSession = async (sessionId: string) => {
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/connect`);
      enqueueSnackbar('جاري الاتصال...', { variant: 'info' });
      loadData();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    }
  };

  const handleDisconnectSession = async (sessionId: string) => {
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/disconnect`);
      enqueueSnackbar('تم قطع الاتصال', { variant: 'success' });
      loadData();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الجلسة؟')) return;

    try {
      await api.delete(`/whatsapp/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
      enqueueSnackbar('تم حذف الجلسة', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    }
  };

  const handleUpdateSession = async (sessionId: string, data: Partial<Session>) => {
    try {
      await api.put(`/whatsapp/sessions/${sessionId}`, data);
      setSessions(sessions.map(s => s.id === sessionId ? { ...s, ...data } : s));
      enqueueSnackbar('تم تحديث الجلسة', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    }
  };

  // Settings handlers
  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await api.put('/whatsapp/settings', settings);
      enqueueSnackbar('تم حفظ الإعدادات', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Quick Reply handlers
  const handleSaveQuickReply = async () => {
    try {
      setSaving(true);
      if (editingQuickReply) {
        await api.put(`/whatsapp/quick-replies/${editingQuickReply.id}`, quickReplyForm);
        setQuickReplies(quickReplies.map(qr => 
          qr.id === editingQuickReply.id ? { ...qr, ...quickReplyForm } : qr
        ));
      } else {
        const res = await api.post('/whatsapp/quick-replies', quickReplyForm);
        setQuickReplies([...quickReplies, res.data.quickReply]);
      }
      setQuickReplyDialogOpen(false);
      setEditingQuickReply(null);
      setQuickReplyForm({ title: '', shortcut: '', content: '', category: 'general' });
      enqueueSnackbar('تم حفظ الرد السريع', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuickReply = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الرد السريع؟')) return;

    try {
      await api.delete(`/whatsapp/quick-replies/${id}`);
      setQuickReplies(quickReplies.filter(qr => qr.id !== id));
      enqueueSnackbar('تم حذف الرد السريع', { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ', { variant: 'error' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'CONNECTED':
        return <ConnectedIcon color="success" />;
      case 'qr_pending':
      case 'QR_PENDING':
        return <PendingIcon color="warning" />;
      default:
        return <DisconnectedIcon color="error" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
      case 'CONNECTED':
        return 'متصل';
      case 'qr_pending':
      case 'QR_PENDING':
        return 'في انتظار QR';
      case 'connecting':
      case 'CONNECTING':
        return 'جاري الاتصال';
      default:
        return 'غير متصل';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PhoneIcon color="primary" />
        إعدادات WhatsApp
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
        <Tab icon={<PhoneIcon />} label="الجلسات" />
        <Tab icon={<SettingsIcon />} label="الإعدادات العامة" />
        <Tab icon={<AIIcon />} label="إعدادات AI" />
        <Tab icon={<CopyIcon />} label="الردود السريعة" />
      </Tabs>

      {/* Sessions Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">جلسات WhatsApp</Typography>
          <Box>
            <Button
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ mr: 1 }}
            >
              تحديث
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setSessionDialogOpen(true)}
              disabled={sessions.length >= (settings?.maxSessions || 3)}
            >
              إضافة جلسة
            </Button>
          </Box>
        </Box>

        {sessions.length === 0 ? (
          <Alert severity="info">
            لا توجد جلسات. اضغط على "إضافة جلسة" لربط رقم WhatsApp جديد.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            {sessions.map((session) => (
              <Grid item xs={12} md={6} lg={4} key={session.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={getStatusIcon(session.liveStatus || session.status)}
                        >
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <PhoneIcon />
                          </Avatar>
                        </Badge>
                        <Box>
                          <Typography variant="h6">{session.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {session.phoneNumber || 'غير متصل'}
                          </Typography>
                        </Box>
                      </Box>
                      {session.isDefault && (
                        <Chip label="افتراضي" size="small" color="primary" />
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip
                        size="small"
                        label={getStatusText(session.liveStatus || session.status)}
                        color={session.liveStatus === 'connected' ? 'success' : 'default'}
                      />
                      {session.aiEnabled && (
                        <Chip size="small" label="AI" color="info" icon={<AIIcon />} />
                      )}
                      {session.autoReply && (
                        <Chip size="small" label="رد تلقائي" color="warning" />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {session._count?.contacts || 0} جهة اتصال • {session._count?.messages || 0} رسالة
                    </Typography>

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {session.liveStatus === 'connected' || session.status === 'CONNECTED' ? (
                        <Button
                          size="small"
                          color="error"
                          startIcon={<LinkOffIcon />}
                          onClick={() => handleDisconnectSession(session.id)}
                        >
                          قطع الاتصال
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="success"
                          startIcon={<LinkIcon />}
                          onClick={() => handleConnectSession(session.id)}
                        >
                          اتصال
                        </Button>
                      )}
                      
                      {session.qrCode && (
                        <Button
                          size="small"
                          startIcon={<QrCodeIcon />}
                          onClick={() => {
                            setCurrentQR(session.qrCode);
                            setQrDialogOpen(true);
                          }}
                        >
                          QR Code
                        </Button>
                      )}

                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => setSelectedSession(session)}
                      >
                        تعديل
                      </Button>

                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </TabPanel>

      {/* General Settings Tab */}
      <TabPanel value={tabValue} index={1}>
        {settings && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    إعدادات عامة
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.isEnabled}
                        onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                      />
                    }
                    label="تفعيل WhatsApp"
                  />

                  <Box sx={{ mt: 2 }}>
                    <Typography gutterBottom>الحد الأقصى للجلسات: {settings.maxSessions}</Typography>
                    <Slider
                      value={settings.maxSessions}
                      onChange={(_, v) => setSettings({ ...settings, maxSessions: v as number })}
                      min={1}
                      max={10}
                      marks
                      valueLabelDisplay="auto"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <NotificationIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    الإشعارات
                  </Typography>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notificationSound}
                        onChange={(e) => setSettings({ ...settings, notificationSound: e.target.checked })}
                      />
                    }
                    label="صوت الإشعارات"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.browserNotifications}
                        onChange={(e) => setSettings({ ...settings, browserNotifications: e.target.checked })}
                      />
                    }
                    label="إشعارات المتصفح"
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    إعدادات الوسائط
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography gutterBottom>حد حجم الصور: {settings.maxImageSize} MB</Typography>
                    <Slider
                      value={settings.maxImageSize}
                      onChange={(_, v) => setSettings({ ...settings, maxImageSize: v as number })}
                      min={1}
                      max={50}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography gutterBottom>حد حجم الفيديو: {settings.maxVideoSize} MB</Typography>
                    <Slider
                      value={settings.maxVideoSize}
                      onChange={(_, v) => setSettings({ ...settings, maxVideoSize: v as number })}
                      min={1}
                      max={100}
                      valueLabelDisplay="auto"
                    />
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoCompressImages}
                        onChange={(e) => setSettings({ ...settings, autoCompressImages: e.target.checked })}
                      />
                    }
                    label="ضغط الصور تلقائياً"
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? <CircularProgress size={20} /> : 'حفظ الإعدادات'}
              </Button>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* AI Settings Tab */}
      <TabPanel value={tabValue} index={2}>
        {settings && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    <AIIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    إعدادات الذكاء الصناعي
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>وضع AI الافتراضي</InputLabel>
                    <Select
                      value={settings.defaultAIMode}
                      onChange={(e) => setSettings({ ...settings, defaultAIMode: e.target.value })}
                      label="وضع AI الافتراضي"
                    >
                      <MenuItem value="off">إيقاف</MenuItem>
                      <MenuItem value="suggest">اقتراح (بدون إرسال تلقائي)</MenuItem>
                      <MenuItem value="auto">رد تلقائي</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.aiWelcomeEnabled}
                        onChange={(e) => setSettings({ ...settings, aiWelcomeEnabled: e.target.checked })}
                      />
                    }
                    label="رسالة ترحيب تلقائية"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.aiAwayEnabled}
                        onChange={(e) => setSettings({ ...settings, aiAwayEnabled: e.target.checked })}
                      />
                    }
                    label="رسالة عدم التواجد"
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? <CircularProgress size={20} /> : 'حفظ الإعدادات'}
              </Button>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Quick Replies Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">الردود السريعة</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingQuickReply(null);
              setQuickReplyForm({ title: '', shortcut: '', content: '', category: 'general' });
              setQuickReplyDialogOpen(true);
            }}
          >
            إضافة رد سريع
          </Button>
        </Box>

        {quickReplies.length === 0 ? (
          <Alert severity="info">
            لا توجد ردود سريعة. اضغط على "إضافة رد سريع" لإنشاء قوالب جاهزة.
          </Alert>
        ) : (
          <List>
            {quickReplies.map((qr) => (
              <Paper key={qr.id} sx={{ mb: 1 }}>
                <ListItem>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {qr.title}
                        {qr.shortcut && (
                          <Chip size="small" label={qr.shortcut} variant="outlined" />
                        )}
                        <Chip size="small" label={qr.category} color="primary" />
                      </Box>
                    }
                    secondary={qr.content.substring(0, 100) + (qr.content.length > 100 ? '...' : '')}
                  />
                  <ListItemSecondaryAction>
                    <Typography variant="caption" sx={{ mr: 2 }}>
                      استخدم {qr.usageCount} مرة
                    </Typography>
                    <IconButton
                      onClick={() => {
                        setEditingQuickReply(qr);
                        setQuickReplyForm({
                          title: qr.title,
                          shortcut: qr.shortcut || '',
                          content: qr.content,
                          category: qr.category,
                        });
                        setQuickReplyDialogOpen(true);
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDeleteQuickReply(qr.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              </Paper>
            ))}
          </List>
        )}
      </TabPanel>

      {/* Create Session Dialog */}
      <Dialog open={sessionDialogOpen} onClose={() => setSessionDialogOpen(false)}>
        <DialogTitle>إضافة جلسة WhatsApp جديدة</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="اسم الجلسة"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            placeholder="مثال: رقم المبيعات"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleCreateSession} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'إنشاء'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onClose={() => setQrDialogOpen(false)} maxWidth="sm">
        <DialogTitle>امسح QR Code بهاتفك</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          {currentQR && (
            <Box>
              <QRCode value={currentQR} size={256} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                افتح WhatsApp على هاتفك → الإعدادات → الأجهزة المرتبطة → ربط جهاز
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrDialogOpen(false)}>إغلاق</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog 
        open={!!selectedSession} 
        onClose={() => setSelectedSession(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>تعديل الجلسة: {selectedSession?.name}</DialogTitle>
        <DialogContent>
          {selectedSession && (
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="اسم الجلسة"
                value={selectedSession.name}
                onChange={(e) => setSelectedSession({ ...selectedSession, name: e.target.value })}
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={selectedSession.aiEnabled}
                    onChange={(e) => setSelectedSession({ ...selectedSession, aiEnabled: e.target.checked })}
                  />
                }
                label="تفعيل الذكاء الصناعي"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={selectedSession.autoReply}
                    onChange={(e) => setSelectedSession({ ...selectedSession, autoReply: e.target.checked })}
                  />
                }
                label="الرد التلقائي"
              />

              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>وضع AI</InputLabel>
                <Select
                  value={selectedSession.aiMode}
                  onChange={(e) => setSelectedSession({ ...selectedSession, aiMode: e.target.value })}
                  label="وضع AI"
                >
                  <MenuItem value="off">إيقاف</MenuItem>
                  <MenuItem value="suggest">اقتراح</MenuItem>
                  <MenuItem value="auto">تلقائي</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="رسالة الترحيب"
                value={selectedSession.welcomeMessage || ''}
                onChange={(e) => setSelectedSession({ ...selectedSession, welcomeMessage: e.target.value })}
                sx={{ mt: 2 }}
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="رسالة عدم التواجد"
                value={selectedSession.awayMessage || ''}
                onChange={(e) => setSelectedSession({ ...selectedSession, awayMessage: e.target.value })}
                sx={{ mt: 2 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={selectedSession.isDefault}
                    onChange={(e) => setSelectedSession({ ...selectedSession, isDefault: e.target.checked })}
                  />
                }
                label="جعلها الجلسة الافتراضية"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSession(null)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (selectedSession) {
                handleUpdateSession(selectedSession.id, selectedSession);
                setSelectedSession(null);
              }
            }}
          >
            حفظ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Reply Dialog */}
      <Dialog 
        open={quickReplyDialogOpen} 
        onClose={() => setQuickReplyDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingQuickReply ? 'تعديل الرد السريع' : 'إضافة رد سريع جديد'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="العنوان"
              value={quickReplyForm.title}
              onChange={(e) => setQuickReplyForm({ ...quickReplyForm, title: e.target.value })}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="الاختصار"
              value={quickReplyForm.shortcut}
              onChange={(e) => setQuickReplyForm({ ...quickReplyForm, shortcut: e.target.value })}
              placeholder="/welcome"
              helperText="اختصار للوصول السريع (اختياري)"
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>التصنيف</InputLabel>
              <Select
                value={quickReplyForm.category}
                onChange={(e) => setQuickReplyForm({ ...quickReplyForm, category: e.target.value })}
                label="التصنيف"
              >
                <MenuItem value="general">عام</MenuItem>
                <MenuItem value="welcome">ترحيب</MenuItem>
                <MenuItem value="thanks">شكر</MenuItem>
                <MenuItem value="apology">اعتذار</MenuItem>
                <MenuItem value="info">معلومات</MenuItem>
                <MenuItem value="order">طلبات</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="المحتوى"
              value={quickReplyForm.content}
              onChange={(e) => setQuickReplyForm({ ...quickReplyForm, content: e.target.value })}
              helperText="يمكنك استخدام المتغيرات: {customer_name}, {order_number}, {product_name}"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickReplyDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSaveQuickReply} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'حفظ'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WhatsAppSettings;
