import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShoppingCartIcon,
  LinkIcon,
  BellAlertIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  PlayIcon,
  PauseIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

// نوع مهمة الاستيراد
interface ImportJob {
  jobId: string;
  type: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: {
    currentPage: number;
    currentBatch: number;
    totalBatches: number;
    processedOrders: number;
    grandTotal: number;
    imported: number;
    updated: number;
    skipped: number;
    failed: number;
    percentage: number;
    status?: string;
  };
  createdAt: string;
  completedAt?: string;
  error?: string;
}

interface WooOrder {
  wooCommerceId: string;
  orderNumber: string;
  status: string;
  wooCommerceStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  total: number;
  currency: string;
  items: any[];
  wooCommerceDateCreated: string;
}

interface WooProduct {
  wooCommerceId: string;
  name: string;
  description: string;
  price: number;
  comparePrice?: number;
  sku?: string;
  stock: number;
  images: string[];
  category?: string;
  isActive: boolean;
}

interface LocalOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  total: number;
  syncedToWoo: boolean;
  wooCommerceId?: string;
  createdAt: string;
}

interface SyncLog {
  id: string;
  syncType: string;
  syncDirection: string;
  status: string;
  totalItems: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  errorMessage?: string;
  errorDetails?: any;
}

interface Settings {
  storeUrl: string;
  hasCredentials: boolean;
  syncEnabled: boolean;
  syncDirection: string;
  webhookEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  webhookUrl?: string;
}

const WooCommerceSync: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [activeTab, setActiveTab] = useState<'import' | 'products' | 'export' | 'settings' | 'logs'>('import');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Import State
  const [wooOrders, setWooOrders] = useState<WooOrder[]>([]);
  const [selectedWooOrders, setSelectedWooOrders] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  
  // Import Options State
  const [importOptions, setImportOptions] = useState({
    limit: '100' as '10' | '50' | '100' | 'all',
    batchSize: '100' as '50' | '100',
    status: 'any',
    dateFrom: '',
    dateTo: '',
    importMode: 'review' as 'review' | 'direct',
    duplicateAction: 'skip' as 'skip' | 'update'
  });
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [importProgress, setImportProgress] = useState({ 
    current: 0, 
    total: 0, 
    status: '',
    currentBatch: 0,
    totalBatches: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  });
  const [totalOrdersCount, setTotalOrdersCount] = useState<number | null>(null);
  
  // حالة الاستئناف - لحفظ نقطة التوقف
  const [resumeState, setResumeState] = useState<{
    lastPage: number;
    lastBatch: number;
    totalImported: number;
    totalUpdated: number;
    totalSkipped: number;
    totalFailed: number;
    processedOrders: number;
    grandTotal: number;
    totalBatches: number;
    timestamp: string;
  } | null>(null);
  const [countingOrders, setCountingOrders] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  
  // 🚀 Backend Import Job State
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  
  // Products State
  const [wooProducts, setWooProducts] = useState<WooProduct[]>([]);
  const [selectedWooProducts, setSelectedWooProducts] = useState<Set<string>>(new Set());
  const [importingProducts, setImportingProducts] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  
  // Export State
  const [localOrders, setLocalOrders] = useState<LocalOrder[]>([]);
  const [selectedLocalOrders, setSelectedLocalOrders] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  
  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    storeUrl: '',
    consumerKey: '',
    consumerSecret: '',
    syncEnabled: false,
    syncDirection: 'both',
    syncInterval: 15,
    autoImport: false,
    autoExport: false,
    webhookEnabled: false
  });
  
  // Logs State
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadSyncLogs();
    loadActiveJobs(); // جلب المهام النشطة عند تحميل الصفحة
  }, []);

  // جلب المهام النشطة من الـ Backend
  const loadActiveJobs = async () => {
    try {
      const response = await fetch('/api/v1/import-jobs/list', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success && data.data.length > 0) {
        // البحث عن مهمة نشطة (running أو paused أو failed)
        const activeJobData = data.data.find((job: any) => 
          job.status === 'running' || job.status === 'paused' || job.status === 'failed'
        );
        
        if (activeJobData) {
          setActiveJob(activeJobData);
          setImporting(activeJobData.status === 'running');
          
          // تحديث شريط التقدم
          if (activeJobData.progress) {
            setImportProgress({
              current: activeJobData.progress.processedOrders || 0,
              total: activeJobData.progress.grandTotal || 0,
              status: activeJobData.progress.status || '',
              currentBatch: activeJobData.progress.currentBatch || 0,
              totalBatches: activeJobData.progress.totalBatches || 0,
              imported: activeJobData.progress.imported || 0,
              updated: activeJobData.progress.updated || 0,
              skipped: activeJobData.progress.skipped || 0,
              failed: activeJobData.progress.failed || 0
            });
          }
          
          console.log('📦 [IMPORT] Found active job:', activeJobData);
        }
      }
    } catch (error) {
      console.error('Error loading active jobs:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/v1/woocommerce/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success && data.data) {
        setSettings(data.data);
        setSettingsForm(prev => ({
          ...prev,
          storeUrl: data.data.storeUrl || '',
          syncEnabled: data.data.syncEnabled || false,
          syncDirection: data.data.syncDirection || 'both',
          webhookEnabled: data.data.webhookEnabled || false
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadSyncLogs = async () => {
    try {
      const response = await fetch('/api/v1/woocommerce/sync-logs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSyncLogs(data.data);
      }
    } catch (error) {
      console.error('Error loading sync logs:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 🔌 WebSocket Connection للتحديثات الفورية
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    // إنشاء اتصال WebSocket
    const newSocket = io(window.location.origin, {
      auth: { token: localStorage.getItem('accessToken') },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔌 [SOCKET] Connected for import updates');
      
      // الانضمام لغرفة الشركة لاستقبال تحديثات الاستيراد
      // نحتاج companyId من الـ user - سنحصل عليه من localStorage أو API
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          if (user.companyId) {
            newSocket.emit('join_company_room', { companyId: user.companyId });
            console.log('📦 [SOCKET] Joined company room:', user.companyId);
          }
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
    });

    // الاستماع لتحديثات مهام الاستيراد
    newSocket.on('import_job_update', (data: { jobId: string; status: string; message: string; progress: any }) => {
      console.log('📊 [IMPORT-UPDATE]', data);
      
      setActiveJob(prev => {
        if (prev && prev.jobId === data.jobId) {
          return {
            ...prev,
            status: data.status as ImportJob['status'],
            progress: data.progress
          };
        }
        return prev;
      });

      // تحديث شريط التقدم
      if (data.progress) {
        setImportProgress({
          current: data.progress.processedOrders || 0,
          total: data.progress.grandTotal || 0,
          status: data.progress.status || data.message || '',
          currentBatch: data.progress.currentBatch || 0,
          totalBatches: data.progress.totalBatches || 0,
          imported: data.progress.imported || 0,
          updated: data.progress.updated || 0,
          skipped: data.progress.skipped || 0,
          failed: data.progress.failed || 0
        });
      }

      // إشعارات الحالة
      if (data.status === 'completed') {
        toast.success(`🎉 تم الانتهاء! استيراد: ${data.progress.imported} | تحديث: ${data.progress.updated}`, { duration: 10000 });
        setImporting(false);
        loadSyncLogs();
      } else if (data.status === 'failed') {
        toast.error(`❌ فشل الاستيراد: ${data.progress?.status || 'خطأ غير معروف'}`);
        setImporting(false);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 [SOCKET] Disconnected');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 🚀 Backend Import Functions (الاستيراد في الخلفية)
  // ═══════════════════════════════════════════════════════════════

  const startBackendImport = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setImporting(true);
    resetProgress();

    try {
      const response = await fetch('/api/v1/import-jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          type: 'orders',
          batchSize: parseInt(importOptions.batchSize) || 100,
          status: importOptions.status,
          dateFrom: importOptions.dateFrom || undefined,
          dateTo: importOptions.dateTo || undefined,
          duplicateAction: importOptions.duplicateAction
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setActiveJob(data.data);
        toast.success('🚀 تم بدء الاستيراد في الخلفية - يمكنك إغلاق المتصفح!', { duration: 5000 });
        
        setImportProgress(prev => ({
          ...prev,
          status: '🚀 جاري الاستيراد في الخلفية...'
        }));
      } else {
        toast.error(data.message);
        setImporting(false);
      }
    } catch (error: any) {
      toast.error('خطأ في بدء الاستيراد');
      setImporting(false);
    }
  };

  const pauseBackendImport = async () => {
    if (!activeJob) return;

    try {
      const response = await fetch(`/api/v1/import-jobs/pause/${activeJob.jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('⏸️ تم إيقاف الاستيراد مؤقتاً');
        setActiveJob(prev => prev ? { ...prev, status: 'paused' } : null);
      }
    } catch (error) {
      toast.error('خطأ في إيقاف الاستيراد');
    }
  };

  const resumeBackendImport = async () => {
    if (!activeJob) return;

    try {
      const response = await fetch(`/api/v1/import-jobs/resume/${activeJob.jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('▶️ تم استئناف الاستيراد');
        setActiveJob(prev => prev ? { ...prev, status: 'running' } : null);
      }
    } catch (error) {
      toast.error('خطأ في استئناف الاستيراد');
    }
  };

  const cancelBackendImport = async () => {
    if (!activeJob) return;

    if (!confirm('هل أنت متأكد من إلغاء الاستيراد؟')) return;

    try {
      const response = await fetch(`/api/v1/import-jobs/cancel/${activeJob.jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success('🛑 تم إلغاء الاستيراد');
        setActiveJob(null);
        setImporting(false);
        resetProgress();
      }
    } catch (error) {
      toast.error('خطأ في إلغاء الاستيراد');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 📥 Import Functions
  // ═══════════════════════════════════════════════════════════════

  const resetProgress = () => {
    setImportProgress({ 
      current: 0, total: 0, status: '', 
      currentBatch: 0, totalBatches: 0, 
      imported: 0, updated: 0, skipped: 0, failed: 0 
    });
  };

  // جلب عدد الطلبات الكلي
  const fetchOrdersCount = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setCountingOrders(true);
    try {
      const response = await fetch('/api/v1/woocommerce/orders/count', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          consumerKey: 'from_settings',
          consumerSecret: 'from_settings',
          status: importOptions.status,
          dateFrom: importOptions.dateFrom || undefined,
          dateTo: importOptions.dateTo || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setTotalOrdersCount(data.data.totalOrders);
        const totalOrders = data.data.totalOrders;
        const batchSize = parseInt(importOptions.batchSize) || 100;
        const totalPages = Math.ceil(totalOrders / 100); // WooCommerce يجلب 100 طلب لكل صفحة
        const estimatedBatches = Math.ceil(totalOrders / batchSize);
        
        toast.success(
          `📊 إحصائيات الطلبات:\n` +
          `• إجمالي الطلبات: ${totalOrders.toLocaleString()} طلب\n` +
          `• عدد الصفحات: ${totalPages.toLocaleString()} صفحة\n` +
          `• عدد الدفعات المتوقعة: ${estimatedBatches.toLocaleString()} دفعة (${batchSize} طلب/دفعة)`,
          { duration: 8000 }
        );
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('خطأ في جلب عدد الطلبات');
    } finally {
      setCountingOrders(false);
    }
  };

  const fetchWooOrders = async () => {
    if (!settings?.hasCredentials && !settingsForm.consumerKey) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setLoading(true);
    resetProgress();
    setImportProgress(prev => ({ ...prev, status: 'جاري جلب الطلبات...' }));
    
    try {
      const response = await fetch('/api/v1/woocommerce/orders/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          storeUrl: settingsForm.storeUrl,
          consumerKey: settingsForm.consumerKey,
          consumerSecret: settingsForm.consumerSecret,
          limit: importOptions.limit,
          status: importOptions.status,
          dateFrom: importOptions.dateFrom || undefined,
          dateTo: importOptions.dateTo || undefined,
          fetchAll: importOptions.limit === 'all'
        })
      });

      const data = await response.json();
      if (data.success) {
        setWooOrders(data.data.orders);
        // تحديد كل الطلبات افتراضياً
        setSelectedWooOrders(new Set(data.data.orders.map((o: WooOrder) => o.wooCommerceId)));
        toast.success(data.message);
        resetProgress();
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
    }
  };

  // استيراد مباشر بدون مراجعة - على دفعات (مع دعم الاستئناف)
  const importDirectly = async (resumeFromCheckpoint = false) => {
    if (!settings?.hasCredentials && !settingsForm.consumerKey) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setImporting(true);
    
    try {
      const batchSize = parseInt(importOptions.batchSize) || 100;
      let grandTotal = 0;
      let totalBatches = 0;
      let page = 1;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;
      let processedOrders = 0;
      let batchNumber = 0;

      // ═══════════════════════════════════════════════════════════════
      // 🔄 التحقق من الاستئناف
      // ═══════════════════════════════════════════════════════════════
      if (resumeFromCheckpoint && resumeState) {
        // استئناف من نقطة التوقف
        page = resumeState.lastPage;
        batchNumber = resumeState.lastBatch - 1; // سيزيد في الـ loop
        totalImported = resumeState.totalImported;
        totalUpdated = resumeState.totalUpdated;
        totalSkipped = resumeState.totalSkipped;
        totalFailed = resumeState.totalFailed;
        processedOrders = resumeState.processedOrders;
        grandTotal = resumeState.grandTotal;
        totalBatches = resumeState.totalBatches;

        toast.success(`🔄 استئناف من الدفعة ${resumeState.lastBatch}/${totalBatches} (${processedOrders.toLocaleString()} طلب تم معالجتهم)`);
        
        setImportProgress(prev => ({ 
          ...prev, 
          total: grandTotal,
          totalBatches: totalBatches,
          current: processedOrders,
          imported: totalImported,
          updated: totalUpdated,
          skipped: totalSkipped,
          failed: totalFailed,
          status: `🔄 استئناف من الدفعة ${resumeState.lastBatch}...`
        }));
      } else {
        // بداية جديدة
        resetProgress();
        setResumeState(null);
        
        // ═══════════════════════════════════════════════════════════════
        // 📊 الخطوة 1: جلب العدد الإجمالي أولاً
        // ═══════════════════════════════════════════════════════════════
        setImportProgress(prev => ({ 
          ...prev, 
          status: '📊 جاري حساب إجمالي الطلبات...'
        }));

        const countResponse = await fetch('/api/v1/woocommerce/orders/count', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            consumerKey: 'from_settings',
            consumerSecret: 'from_settings',
            status: importOptions.status,
            dateFrom: importOptions.dateFrom || undefined,
            dateTo: importOptions.dateTo || undefined
          })
        });

        const countData = await countResponse.json();
        grandTotal = countData.success ? countData.data.totalOrders : 0;
        totalBatches = Math.ceil(grandTotal / batchSize);

        if (grandTotal > 0) {
          toast.success(`📊 إجمالي الطلبات: ${grandTotal.toLocaleString()} طلب (${totalBatches} دفعة)`);
        }

        setImportProgress(prev => ({ 
          ...prev, 
          total: grandTotal,
          totalBatches: totalBatches,
          status: `🚀 بدء استيراد ${grandTotal.toLocaleString()} طلب...`
        }));
      }

      // ═══════════════════════════════════════════════════════════════
      // 📥 الخطوة 2: جلب واستيراد على دفعات مع عداد تصاعدي
      // ═══════════════════════════════════════════════════════════════
      let hasMore = true;

      while (hasMore) {
        batchNumber++;
        
        // 💾 حفظ نقطة التوقف قبل كل دفعة
        setResumeState({
          lastPage: page,
          lastBatch: batchNumber,
          totalImported,
          totalUpdated,
          totalSkipped,
          totalFailed,
          processedOrders,
          grandTotal,
          totalBatches,
          timestamp: new Date().toISOString()
        });
        
        // تحديث الحالة - جلب الدفعة
        setImportProgress(prev => ({ 
          ...prev, 
          status: `📥 جلب الدفعة ${batchNumber}/${totalBatches}...`,
          currentBatch: batchNumber
        }));

        const fetchResponse = await fetch('/api/v1/woocommerce/orders/fetch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({
            consumerKey: 'from_settings',
            consumerSecret: 'from_settings',
            limit: batchSize.toString(),
            page: page,
            status: importOptions.status,
            dateFrom: importOptions.dateFrom || undefined,
            dateTo: importOptions.dateTo || undefined
          })
        });

        const fetchData = await fetchResponse.json();
        if (!fetchData.success) {
          toast.error(`❌ فشل في الدفعة ${batchNumber}: ${fetchData.message}\n\n💡 يمكنك الاستئناف من هذه النقطة`);
          // حفظ نقطة التوقف للاستئناف
          setImportProgress(prev => ({ 
            ...prev, 
            status: `⚠️ توقف عند الدفعة ${batchNumber}/${totalBatches} - يمكنك الاستئناف`
          }));
          return; // الخروج مع الحفاظ على resumeState
        }

        const batchOrders = fetchData.data.orders;
        
        if (!batchOrders || batchOrders.length === 0) {
          hasMore = false;
          break;
        }

        // تحديث الحالة - استيراد الدفعة
        const progressPercent = Math.round((processedOrders / grandTotal) * 100);
        setImportProgress(prev => ({ 
          ...prev, 
          status: `⏳ استيراد الدفعة ${batchNumber}/${totalBatches} (${batchOrders.length} طلب) - ${progressPercent}%`,
          current: processedOrders
        }));

        // استيراد هذه الدفعة
        const importResponse = await fetch('/api/v1/woocommerce/orders/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          },
          body: JSON.stringify({ 
            orders: batchOrders,
            importMode: 'direct',
            duplicateAction: importOptions.duplicateAction
          })
        });

        const importData = await importResponse.json();
        if (importData.success) {
          const { imported, updated, skipped, failed } = importData.data;
          totalImported += imported || 0;
          totalUpdated += updated || 0;
          totalSkipped += skipped || 0;
          totalFailed += failed || 0;
          processedOrders += batchOrders.length;

          const newProgressPercent = Math.round((processedOrders / grandTotal) * 100);
          setImportProgress(prev => ({ 
            ...prev, 
            current: processedOrders,
            imported: totalImported,
            updated: totalUpdated,
            skipped: totalSkipped,
            failed: totalFailed,
            status: `✅ تم: ${processedOrders.toLocaleString()}/${grandTotal.toLocaleString()} (${newProgressPercent}%) - استيراد: ${totalImported} | تحديث: ${totalUpdated}`
          }));
        } else {
          toast.error(`❌ فشل استيراد الدفعة ${batchNumber}: ${importData.message}\n\n💡 يمكنك الاستئناف`);
          setImportProgress(prev => ({ 
            ...prev, 
            status: `⚠️ توقف عند الدفعة ${batchNumber}/${totalBatches} - يمكنك الاستئناف`
          }));
          return; // الخروج مع الحفاظ على resumeState
        }

        // التحقق من الانتهاء
        if (batchOrders.length < batchSize) {
          hasMore = false;
        } else if (importOptions.limit !== 'all') {
          hasMore = false;
        } else {
          page++;
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🎉 الخطوة 3: رسالة النهاية الشاملة
      // ═══════════════════════════════════════════════════════════════
      const finalMessage = `🎉 تم الانتهاء!\n\n` +
        `📊 الإجمالي: ${grandTotal.toLocaleString()} طلب\n` +
        `✅ تم استيراد: ${totalImported.toLocaleString()}\n` +
        `🔄 تم تحديث: ${totalUpdated.toLocaleString()}\n` +
        `⏭️ تم تخطي: ${totalSkipped.toLocaleString()}\n` +
        `❌ فشل: ${totalFailed.toLocaleString()}`;
      
      toast.success(finalMessage, { duration: 10000 });
      
      setImportProgress(prev => ({ 
        ...prev, 
        current: grandTotal,
        status: `🎉 تم الانتهاء! استيراد: ${totalImported} | تحديث: ${totalUpdated} | تخطي: ${totalSkipped} | فشل: ${totalFailed}`
      }));
      
      // مسح نقطة التوقف بعد الانتهاء بنجاح
      setResumeState(null);
      
      loadSyncLogs();
    } catch (error: any) {
      toast.error(`❌ خطأ في الاستيراد: ${error.message}\n\n💡 يمكنك الاستئناف من آخر نقطة`);
      setImportProgress(prev => ({ 
        ...prev, 
        status: `⚠️ حدث خطأ - يمكنك الاستئناف من آخر نقطة`
      }));
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const importSelectedOrders = async () => {
    if (selectedWooOrders.size === 0) {
      toast.error('يرجى اختيار طلب واحد على الأقل');
      return;
    }

    setImporting(true);
    try {
      const ordersToImport = wooOrders.filter(o => selectedWooOrders.has(o.wooCommerceId));
      
      const response = await fetch('/api/v1/woocommerce/orders/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ 
          orders: ordersToImport,
          importMode: importOptions.importMode,
          duplicateAction: importOptions.duplicateAction
        })
      });

      const data = await response.json();
      if (data.success) {
        const { imported, updated, skipped } = data.data;
        let message = `تم استيراد ${imported} طلب`;
        if (updated > 0) message += ` وتحديث ${updated}`;
        if (skipped > 0) message += ` (تم تخطي ${skipped})`;
        toast.success(message);
        setWooOrders([]);
        setSelectedWooOrders(new Set());
        loadSyncLogs();
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في استيراد الطلبات');
    } finally {
      setImporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // � Products Functions
  // ═══════════════════════════════════════════════════════════════

  const fetchWooProducts = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setFetchingProducts(true);
    try {
      const response = await fetch('/api/v1/woocommerce/fetch-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          // إرسال إشارة للـ Backend لاستخدام الإعدادات المحفوظة
          consumerKey: 'from_settings', // سيتم جلبها من قاعدة البيانات
          consumerSecret: 'from_settings' // سيتم جلبها من قاعدة البيانات
        })
      });

      const data = await response.json();
      if (data.success) {
        setWooProducts(data.data.products);
        setSelectedWooProducts(new Set(data.data.products.map((p: WooProduct) => p.wooCommerceId)));
        toast.success(`تم جلب ${data.data.count} منتج من WooCommerce`);
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في جلب المنتجات');
    } finally {
      setFetchingProducts(false);
    }
  };

  const importSelectedProducts = async () => {
    if (selectedWooProducts.size === 0) {
      toast.error('يرجى اختيار منتج واحد على الأقل');
      return;
    }

    setImportingProducts(true);
    try {
      const productsToImport = wooProducts.filter(p => selectedWooProducts.has(p.wooCommerceId));
      
      const response = await fetch('/api/v1/woocommerce/import-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ products: productsToImport })
      });

      const data = await response.json();
      if (data.success) {
        const { imported, skipped, failed } = data.data;
        let message = `تم استيراد ${imported} منتج`;
        if (skipped > 0) message += ` (تم تخطي ${skipped})`;
        if (failed > 0) message += ` (فشل ${failed})`;
        toast.success(message);
        setWooProducts([]);
        setSelectedWooProducts(new Set());
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في استيراد المنتجات');
    } finally {
      setImportingProducts(false);
    }
  };

  const importAllProductsDirectly = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setImportingProducts(true);
    try {
      // جلب المنتجات أولاً
      const fetchResponse = await fetch('/api/v1/woocommerce/fetch-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          consumerKey: 'from_settings',
          consumerSecret: 'from_settings'
        })
      });

      const fetchData = await fetchResponse.json();
      if (!fetchData.success) {
        toast.error(fetchData.message);
        return;
      }

      toast(`جاري استيراد ${fetchData.data.count} منتج...`, { icon: '⏳' });

      // استيراد مباشر
      const importResponse = await fetch('/api/v1/woocommerce/import-selected', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ products: fetchData.data.products })
      });

      const importData = await importResponse.json();
      if (importData.success) {
        const { imported, skipped, failed } = importData.data;
        let message = `تم استيراد ${imported} منتج`;
        if (skipped > 0) message += ` (تم تخطي ${skipped})`;
        if (failed > 0) message += ` (فشل ${failed})`;
        toast.success(message);
      } else {
        toast.error(importData.message);
      }
    } catch (error: any) {
      toast.error('خطأ في استيراد المنتجات');
    } finally {
      setImportingProducts(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // � Export Functions
  // ═══════════════════════════════════════════════════════════════

  const fetchLocalOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/woocommerce/orders/local?syncedToWoo=false', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setLocalOrders(data.data.orders);
        setSelectedLocalOrders(new Set(data.data.orders.map((o: LocalOrder) => o.id)));
      }
    } catch (error: any) {
      toast.error('خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
    }
  };

  const exportSelectedOrders = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    if (selectedLocalOrders.size === 0) {
      toast.error('يرجى اختيار طلب واحد على الأقل');
      return;
    }

    setExporting(true);
    try {
      const response = await fetch('/api/v1/woocommerce/orders/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ orderIds: Array.from(selectedLocalOrders) })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`تم تصدير ${data.data.exported} طلب بنجاح`);
        fetchLocalOrders();
        loadSyncLogs();
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في تصدير الطلبات');
    } finally {
      setExporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ⚙️ Settings Functions
  // ═══════════════════════════════════════════════════════════════

  const saveSettings = async () => {
    if (!settingsForm.storeUrl || !settingsForm.consumerKey || !settingsForm.consumerSecret) {
      toast.error('جميع بيانات الاتصال مطلوبة');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/woocommerce/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify(settingsForm)
      });

      const data = await response.json();
      if (data.success) {
        toast.success('تم حفظ الإعدادات بنجاح');
        loadSettings();
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في حفظ الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!settingsForm.storeUrl || !settingsForm.consumerKey || !settingsForm.consumerSecret) {
      toast.error('يرجى ملء جميع الحقول أولاً');
      return;
    }

    setTestingConnection(true);
    try {
      const response = await fetch('/api/v1/woocommerce/fetch-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          storeUrl: settingsForm.storeUrl,
          consumerKey: settingsForm.consumerKey,
          consumerSecret: settingsForm.consumerSecret
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`✅ الاتصال ناجح! تم العثور على ${data.data.count} منتج`);
      } else {
        toast.error(`❌ فشل الاتصال: ${data.message}`);
      }
    } catch (error: any) {
      toast.error('❌ خطأ في اختبار الاتصال');
    } finally {
      setTestingConnection(false);
    }
  };

  const setupWebhooks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/woocommerce/webhooks/setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        loadSettings();
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في إعداد Webhooks');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    if (!settings?.hasCredentials) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v1/woocommerce/auto-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        const results = data.data?.results;
        toast.success(`تمت المزامنة! استيراد: ${results?.imported || 0}, تصدير: ${results?.exported || 0}`);
        loadSyncLogs();
      } else {
        toast.error(data.message || 'فشلت المزامنة');
      }
    } catch (error: any) {
      toast.error('خطأ في المزامنة');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // 🎨 Render Functions
  // ═══════════════════════════════════════════════════════════════

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'PROCESSING': 'bg-blue-100 text-blue-800',
      'SHIPPED': 'bg-purple-100 text-purple-800',
      'DELIVERED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'success': 'bg-green-100 text-green-800',
      'failed': 'bg-red-100 text-red-800',
      'in_progress': 'bg-blue-100 text-blue-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/orders')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            العودة للطلبات
          </button>
          <div className="flex items-center gap-3">
            <ArrowsRightLeftIcon className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              مزامنة WooCommerce
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            استيراد وتصدير الطلبات بين موقعك و WooCommerce
          </p>
        </div>

        {/* Connection Status */}
        {settings && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            settings.hasCredentials 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
          }`}>
            <div className="flex items-center gap-3">
              {settings.hasCredentials ? (
                <>
                  <CheckCircleSolid className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">متصل بـ WooCommerce</p>
                    <p className="text-sm text-green-600 dark:text-green-400">{settings.storeUrl}</p>
                  </div>
                </>
              ) : (
                <>
                  <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">غير متصل</p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">يرجى إعداد بيانات الاتصال</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Sync Now Button */}
            {settings.hasCredentials && (
              <button
                onClick={triggerSync}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowPathIcon className="h-5 w-5" />
                )}
                مزامنة الآن
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              {[
                { id: 'import', label: 'استيراد الطلبات', icon: CloudArrowDownIcon },
                { id: 'products', label: 'استيراد المنتجات', icon: ShoppingCartIcon },
                { id: 'export', label: 'تصدير الطلبات', icon: CloudArrowUpIcon },
                { id: 'settings', label: 'الإعدادات', icon: Cog6ToothIcon },
                { id: 'logs', label: 'سجل المزامنة', icon: DocumentTextIcon }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  <tab.icon className="h-5 w-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Import Tab */}
            {activeTab === 'import' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      استيراد الطلبات من WooCommerce
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      جلب الطلبات من متجر WooCommerce واستيرادها
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowImportOptions(!showImportOptions)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-2"
                    >
                      <Cog6ToothIcon className="h-5 w-5" />
                      خيارات
                    </button>
                    <button
                      onClick={fetchWooOrders}
                      disabled={loading}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <CloudArrowDownIcon className="h-5 w-5" />
                      )}
                      جلب للمراجعة
                    </button>
                    
                    {/* 🚀 زر الاستيراد في الخلفية (الجديد) */}
                    {!activeJob && (
                      <button
                        onClick={startBackendImport}
                        disabled={importing}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-lg"
                        title="الاستيراد يعمل في الخلفية - يمكنك إغلاق المتصفح!"
                      >
                        {importing ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <PlayIcon className="h-5 w-5" />
                        )}
                        🚀 استيراد في الخلفية
                      </button>
                    )}

                    {/* أزرار التحكم عند وجود مهمة نشطة */}
                    {activeJob && activeJob.status === 'running' && (
                      <>
                        <button
                          onClick={pauseBackendImport}
                          className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg flex items-center gap-2"
                        >
                          <PauseIcon className="h-5 w-5" />
                          إيقاف مؤقت
                        </button>
                        <button
                          onClick={cancelBackendImport}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2"
                        >
                          <StopIcon className="h-5 w-5" />
                          إلغاء
                        </button>
                      </>
                    )}

                    {activeJob && activeJob.status === 'paused' && (
                      <>
                        <button
                          onClick={resumeBackendImport}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 animate-pulse"
                        >
                          <PlayIcon className="h-5 w-5" />
                          استئناف
                        </button>
                        <button
                          onClick={cancelBackendImport}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2"
                        >
                          <StopIcon className="h-5 w-5" />
                          إلغاء
                        </button>
                      </>
                    )}

                    {activeJob && activeJob.status === 'failed' && (
                      <button
                        onClick={resumeBackendImport}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 animate-pulse"
                      >
                        <ArrowPathIcon className="h-5 w-5" />
                        إعادة المحاولة
                      </button>
                    )}
                  </div>
                </div>

                {/* 📊 صندوق حالة المهمة النشطة */}
                {activeJob && (
                  <div className={`mb-6 p-4 rounded-xl border ${
                    activeJob.status === 'running' 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : activeJob.status === 'paused'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                      : activeJob.status === 'failed'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {activeJob.status === 'running' && <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />}
                        {activeJob.status === 'paused' && <PauseIcon className="h-5 w-5 text-yellow-600" />}
                        {activeJob.status === 'failed' && <XCircleIcon className="h-5 w-5 text-red-600" />}
                        {activeJob.status === 'completed' && <CheckCircleSolid className="h-5 w-5 text-green-600" />}
                        <span className="font-bold text-gray-900 dark:text-white">
                          {activeJob.status === 'running' && '🚀 جاري الاستيراد في الخلفية...'}
                          {activeJob.status === 'paused' && '⏸️ الاستيراد متوقف مؤقتاً'}
                          {activeJob.status === 'failed' && '❌ فشل الاستيراد'}
                          {activeJob.status === 'completed' && '✅ تم الانتهاء'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {activeJob.progress?.percentage || 0}%
                      </span>
                    </div>

                    {/* شريط التقدم */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-500 ${
                          activeJob.status === 'running' ? 'bg-blue-500' :
                          activeJob.status === 'paused' ? 'bg-yellow-500' :
                          activeJob.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${activeJob.progress?.percentage || 0}%` }}
                      />
                    </div>

                    {/* تفاصيل التقدم */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {(activeJob.progress?.processedOrders || 0).toLocaleString()} / {(activeJob.progress?.grandTotal || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">الطلبات المعالجة</div>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="font-bold text-green-600">
                          {(activeJob.progress?.imported || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">تم استيراده</div>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="font-bold text-blue-600">
                          {(activeJob.progress?.updated || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">تم تحديثه</div>
                      </div>
                      <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                        <div className="font-bold text-gray-600">
                          الدفعة {activeJob.progress?.currentBatch || 0} / {activeJob.progress?.totalBatches || 0}
                        </div>
                        <div className="text-xs text-gray-500">الدفعات</div>
                      </div>
                    </div>

                    {activeJob.status === 'running' && (
                      <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 text-center">
                        💡 يمكنك إغلاق المتصفح - الاستيراد يستمر في الخلفية!
                      </p>
                    )}
                  </div>
                )}

                {/* Import Options Panel */}
                {showImportOptions && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">خيارات الاستيراد</h3>
                      
                      {/* زر معرفة العدد الكلي */}
                      <div className="flex items-center gap-3">
                        {totalOrdersCount !== null && (
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
                            إجمالي الطلبات: {totalOrdersCount.toLocaleString()}
                          </span>
                        )}
                        <button
                          onClick={fetchOrdersCount}
                          disabled={countingOrders}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                        >
                          {countingOrders ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <span>🔢</span>
                          )}
                          معرفة العدد الكلي
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* عدد الطلبات */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          عدد الطلبات
                        </label>
                        <select
                          value={importOptions.limit}
                          onChange={(e) => setImportOptions({ ...importOptions, limit: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="10">آخر 10 طلبات</option>
                          <option value="50">آخر 50 طلب</option>
                          <option value="100">آخر 100 طلب</option>
                          <option value="all">جميع الطلبات</option>
                        </select>
                      </div>

                      {/* حجم الدفعة - يظهر فقط عند اختيار "جميع الطلبات" */}
                      {importOptions.limit === 'all' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            حجم الدفعة
                          </label>
                          <select
                            value={importOptions.batchSize}
                            onChange={(e) => setImportOptions({ ...importOptions, batchSize: e.target.value as any })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="50">50 طلب في الدفعة</option>
                            <option value="100">100 طلب في الدفعة</option>
                          </select>
                        </div>
                      )}

                      {/* حالة الطلب */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          حالة الطلب
                        </label>
                        <select
                          value={importOptions.status}
                          onChange={(e) => setImportOptions({ ...importOptions, status: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="any">جميع الحالات</option>
                          <option value="pending">معلق</option>
                          <option value="processing">قيد المعالجة</option>
                          <option value="on-hold">في الانتظار</option>
                          <option value="completed">مكتمل</option>
                          <option value="cancelled">ملغي</option>
                          <option value="refunded">مسترد</option>
                        </select>
                      </div>

                      {/* من تاريخ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          من تاريخ
                        </label>
                        <input
                          type="date"
                          value={importOptions.dateFrom}
                          onChange={(e) => setImportOptions({ ...importOptions, dateFrom: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* إلى تاريخ */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          إلى تاريخ
                        </label>
                        <input
                          type="date"
                          value={importOptions.dateTo}
                          onChange={(e) => setImportOptions({ ...importOptions, dateTo: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* الطلبات المكررة */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          الطلبات المكررة
                        </label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="duplicateAction"
                              value="skip"
                              checked={importOptions.duplicateAction === 'skip'}
                              onChange={() => setImportOptions({ ...importOptions, duplicateAction: 'skip' })}
                              className="text-purple-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">تخطي</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="duplicateAction"
                              value="update"
                              checked={importOptions.duplicateAction === 'update'}
                              onChange={() => setImportOptions({ ...importOptions, duplicateAction: 'update' })}
                              className="text-purple-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">تحديث</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Bar - محسن */}
                {importProgress.status && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-sm">
                    {/* الحالة الرئيسية */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{importProgress.status}</span>
                      {importProgress.total > 0 && (
                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {Math.round((importProgress.current / importProgress.total) * 100)}%
                        </span>
                      )}
                    </div>

                    {/* معلومات الدفعات والعدد */}
                    {importProgress.total > 0 && (
                      <div className="flex items-center justify-between mb-2 text-sm">
                        <div className="flex items-center gap-4">
                          {importProgress.currentBatch > 0 && importProgress.totalBatches > 0 && (
                            <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-blue-600 dark:text-blue-400 font-medium">
                              📦 الدفعة {importProgress.currentBatch}/{importProgress.totalBatches}
                            </span>
                          )}
                        </div>
                        <span className="text-blue-700 dark:text-blue-300 font-medium">
                          {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()} طلب
                        </span>
                      </div>
                    )}
                    
                    {/* شريط التقدم */}
                    {importProgress.total > 0 && (
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-4 mb-3 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
                          style={{ width: `${Math.min((importProgress.current / importProgress.total) * 100, 100)}%` }}
                        >
                          {(importProgress.current / importProgress.total) * 100 > 15 && (
                            <span className="text-xs text-white font-bold">
                              {Math.round((importProgress.current / importProgress.total) * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* إحصائيات تفصيلية */}
                    {(importProgress.imported > 0 || importProgress.updated > 0 || importProgress.skipped > 0 || importProgress.failed > 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center justify-center px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
                          <span className="font-bold">✅ مستورد: {importProgress.imported.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-center px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                          <span className="font-bold">🔄 محدث: {importProgress.updated.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-center px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg">
                          <span className="font-bold">⏭️ متخطى: {importProgress.skipped.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-center px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
                          <span className="font-bold">❌ فشل: {importProgress.failed.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* معلومات نقطة التوقف للاستئناف */}
                    {resumeState && !importing && (
                      <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-600 dark:text-orange-400 text-lg">💾</span>
                            <div>
                              <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                                نقطة توقف محفوظة
                              </p>
                              <p className="text-xs text-orange-600 dark:text-orange-400">
                                الدفعة {resumeState.lastBatch}/{resumeState.totalBatches} • 
                                تم معالجة {resumeState.processedOrders.toLocaleString()}/{resumeState.grandTotal.toLocaleString()} طلب
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => importDirectly(true)}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                          >
                            <ArrowPathIcon className="h-4 w-4" />
                            استئناف
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {wooOrders.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedWooOrders.size} من {wooOrders.length} طلب محدد
                      </span>
                      <button
                        onClick={importSelectedOrders}
                        disabled={importing || selectedWooOrders.size === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        {importing ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                        استيراد المحدد ({selectedWooOrders.size})
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-right">
                              <input
                                type="checkbox"
                                checked={selectedWooOrders.size === wooOrders.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedWooOrders(new Set(wooOrders.map(o => o.wooCommerceId)));
                                  } else {
                                    setSelectedWooOrders(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">رقم الطلب</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">العميل</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">الحالة</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">الإجمالي</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">التاريخ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {wooOrders.map(order => (
                            <tr key={order.wooCommerceId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedWooOrders.has(order.wooCommerceId)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedWooOrders);
                                    if (e.target.checked) {
                                      newSet.add(order.wooCommerceId);
                                    } else {
                                      newSet.delete(order.wooCommerceId);
                                    }
                                    setSelectedWooOrders(newSet);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                #{order.orderNumber}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-900 dark:text-white">{order.customerName}</div>
                                <div className="text-xs text-gray-500">{order.customerPhone}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(order.wooCommerceStatus)}`}>
                                  {order.wooCommerceStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {order.total} {order.currency}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {new Date(order.wooCommerceDateCreated).toLocaleDateString('ar-EG')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {wooOrders.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <ShoppingCartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      اضغط على "جلب الطلبات" لعرض الطلبات من WooCommerce
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      استيراد المنتجات من WooCommerce
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      جلب المنتجات من متجر WooCommerce واستيرادها للنظام
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchWooProducts}
                      disabled={fetchingProducts}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {fetchingProducts ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <CloudArrowDownIcon className="h-5 w-5" />
                      )}
                      جلب للمراجعة
                    </button>
                    <button
                      onClick={importAllProductsDirectly}
                      disabled={importingProducts}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                    >
                      {importingProducts ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircleSolid className="h-5 w-5" />
                      )}
                      استيراد مباشر
                    </button>
                  </div>
                </div>

                {/* Products List */}
                {wooProducts.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedWooProducts.size} من {wooProducts.length} منتج محدد
                      </span>
                      <button
                        onClick={importSelectedProducts}
                        disabled={importingProducts || selectedWooProducts.size === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        {importingProducts ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                        استيراد المحدد ({selectedWooProducts.size})
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-right">
                              <input
                                type="checkbox"
                                checked={selectedWooProducts.size === wooProducts.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedWooProducts(new Set(wooProducts.map(p => p.wooCommerceId)));
                                  } else {
                                    setSelectedWooProducts(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">الصورة</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">المنتج</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">السعر</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">المخزون</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">الفئة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {wooProducts.map(product => (
                            <tr key={product.wooCommerceId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedWooProducts.has(product.wooCommerceId)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedWooProducts);
                                    if (e.target.checked) {
                                      newSelected.add(product.wooCommerceId);
                                    } else {
                                      newSelected.delete(product.wooCommerceId);
                                    }
                                    setSelectedWooProducts(newSelected);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3">
                                {product.images && product.images[0] ? (
                                  <img 
                                    src={product.images[0]} 
                                    alt={product.name}
                                    className="w-12 h-12 object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                                    <ShoppingCartIcon className="w-6 h-6 text-gray-400" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{product.name}</div>
                                {product.description && (
                                  <div className="text-xs text-gray-500 truncate max-w-xs">{product.description.substring(0, 50)}...</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{product.sku || '-'}</td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{product.price} ج.م</div>
                                {product.comparePrice && product.comparePrice > product.price && (
                                  <div className="text-xs text-gray-500 line-through">{product.comparePrice} ج.م</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  product.stock > 0 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {product.stock > 0 ? product.stock : 'نفد'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">{product.category || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {wooProducts.length === 0 && !fetchingProducts && (
                  <div className="text-center py-12">
                    <ShoppingCartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      اضغط على "جلب للمراجعة" لعرض المنتجات من WooCommerce
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      أو اضغط "استيراد مباشر" لاستيراد جميع المنتجات دفعة واحدة
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      تصدير الطلبات إلى WooCommerce
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      إرسال الطلبات المحلية إلى متجر WooCommerce
                    </p>
                  </div>
                  <button
                    onClick={fetchLocalOrders}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowPathIcon className="h-5 w-5" />
                    )}
                    تحديث القائمة
                  </button>
                </div>

                {localOrders.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedLocalOrders.size} من {localOrders.length} طلب محدد
                      </span>
                      <button
                        onClick={exportSelectedOrders}
                        disabled={exporting || selectedLocalOrders.size === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                      >
                        {exporting ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CloudArrowUpIcon className="h-5 w-5" />
                        )}
                        تصدير المحدد ({selectedLocalOrders.size})
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-right">
                              <input
                                type="checkbox"
                                checked={selectedLocalOrders.size === localOrders.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLocalOrders(new Set(localOrders.map(o => o.id)));
                                  } else {
                                    setSelectedLocalOrders(new Set());
                                  }
                                }}
                                className="rounded"
                              />
                            </th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">رقم الطلب</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">العميل</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">الحالة</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">الإجمالي</th>
                            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">مصدّر؟</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {localOrders.map(order => (
                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedLocalOrders.has(order.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedLocalOrders);
                                    if (e.target.checked) {
                                      newSet.add(order.id);
                                    } else {
                                      newSet.delete(order.id);
                                    }
                                    setSelectedLocalOrders(newSet);
                                  }}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {order.orderNumber}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                {order.customerName}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(order.status)}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                {order.total} EGP
                              </td>
                              <td className="px-4 py-3">
                                {order.syncedToWoo ? (
                                  <CheckCircleSolid className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircleIcon className="h-5 w-5 text-gray-400" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {localOrders.length === 0 && !loading && (
                  <div className="text-center py-12">
                    <ShoppingCartIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      اضغط على "تحديث القائمة" لعرض الطلبات المحلية
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  إعدادات الاتصال بـ WooCommerce
                </h2>

                <div className="space-y-6">
                  {/* Store URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      رابط المتجر *
                    </label>
                    <input
                      type="text"
                      value={settingsForm.storeUrl}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, storeUrl: e.target.value }))}
                      placeholder="https://yourstore.com"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Consumer Key */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Key *
                    </label>
                    <input
                      type="text"
                      value={settingsForm.consumerKey}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, consumerKey: e.target.value }))}
                      placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Consumer Secret */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Secret *
                    </label>
                    <input
                      type="password"
                      value={settingsForm.consumerSecret}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, consumerSecret: e.target.value }))}
                      placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      احصل على المفاتيح من: WooCommerce → Settings → Advanced → REST API
                    </p>
                  </div>

                  {/* Test Connection Button */}
                  <div className="flex gap-3">
                    <button
                      onClick={testConnection}
                      disabled={testingConnection || !settingsForm.storeUrl || !settingsForm.consumerKey || !settingsForm.consumerSecret}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testingConnection ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <LinkIcon className="h-5 w-5" />
                      )}
                      {testingConnection ? 'جاري الاختبار...' : 'اختبار الاتصال'}
                    </button>
                  </div>

                  {/* Sync Direction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      اتجاه المزامنة
                    </label>
                    <select
                      value={settingsForm.syncDirection}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, syncDirection: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="both">ثنائي الاتجاه (استيراد + تصدير)</option>
                      <option value="import_only">استيراد فقط</option>
                      <option value="export_only">تصدير فقط</option>
                    </select>
                  </div>

                  {/* Auto Sync Section */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                      <ClockIcon className="h-5 w-5" />
                      المزامنة التلقائية
                    </h3>
                    
                    {/* Auto Import */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          استيراد تلقائي من WooCommerce
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          جلب الطلبات الجديدة تلقائياً
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.autoImport}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, autoImport: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Auto Export */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          تصدير تلقائي إلى WooCommerce
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          إرسال الطلبات الجديدة تلقائياً
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.autoExport}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, autoExport: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-500 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Sync Interval */}
                    {(settingsForm.autoImport || settingsForm.autoExport) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          فترة المزامنة (بالدقائق)
                        </label>
                        <select
                          value={settingsForm.syncInterval}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, syncInterval: parseInt(e.target.value) }))}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value={5}>كل 5 دقائق</option>
                          <option value={10}>كل 10 دقائق</option>
                          <option value={15}>كل 15 دقيقة</option>
                          <option value={30}>كل 30 دقيقة</option>
                          <option value={60}>كل ساعة</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveSettings}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <Cog6ToothIcon className="h-5 w-5" />
                    )}
                    حفظ الإعدادات
                  </button>

                  {/* Webhook Setup */}
                  {settings?.hasCredentials && (
                    <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <BellAlertIcon className="h-5 w-5" />
                        إعداد Webhooks (للمزامنة التلقائية)
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        عند تفعيل Webhooks، ستصل الطلبات الجديدة من WooCommerce تلقائياً
                      </p>
                      
                      {settings.webhookEnabled ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircleSolid className="h-5 w-5" />
                          <span>Webhooks مفعّلة</span>
                        </div>
                      ) : (
                        <button
                          onClick={setupWebhooks}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                          <LinkIcon className="h-5 w-5" />
                          إعداد Webhooks
                        </button>
                      )}

                      {settings.webhookUrl && (
                        <div className="mt-3">
                          <p className="text-xs text-gray-500 mb-1">Webhook URL:</p>
                          <code className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded break-all">
                            {settings.webhookUrl}
                          </code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    سجل المزامنة
                  </h2>
                  <button
                    onClick={loadSyncLogs}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <ArrowPathIcon className="h-5 w-5" />
                    تحديث
                  </button>
                </div>

                {syncLogs.length > 0 ? (
                  <div className="space-y-3">
                    {syncLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {log.syncDirection === 'from_woo' ? (
                              <CloudArrowDownIcon className="h-5 w-5 text-blue-500" />
                            ) : (
                              <CloudArrowUpIcon className="h-5 w-5 text-green-500" />
                            )}
                            <span className="font-medium text-gray-900 dark:text-white">
                              {log.syncType === 'import_orders' ? 'استيراد طلبات' :
                               log.syncType === 'export_orders' ? 'تصدير طلبات' :
                               log.syncType === 'webhook' ? 'Webhook' : log.syncType}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(log.startedAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>الإجمالي: {log.totalItems}</span>
                          <span className="text-green-600">نجح: {log.successCount}</span>
                          {log.failedCount > 0 && (
                            <span className="text-red-600">فشل: {log.failedCount}</span>
                          )}
                          {log.skippedCount > 0 && (
                            <span className="text-yellow-600">تخطي: {log.skippedCount}</span>
                          )}
                          {log.duration && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="h-4 w-4" />
                              {log.duration} ثانية
                            </span>
                          )}
                        </div>
                        
                        {/* عرض رسالة الخطأ إذا كانت موجودة */}
                        {(log.errorMessage || log.errorDetails) && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                                  تفاصيل الخطأ:
                                </p>
                                {log.errorMessage && (
                                  <p className="text-sm text-red-700 dark:text-red-400 mb-2">
                                    {log.errorMessage}
                                  </p>
                                )}
                                {log.errorDetails && (
                                  <pre className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-x-auto max-h-40">
                                    {typeof log.errorDetails === 'string' 
                                      ? log.errorDetails 
                                      : JSON.stringify(log.errorDetails, null, 2)}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <DocumentTextIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      لا يوجد سجل مزامنة بعد
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WooCommerceSync;
