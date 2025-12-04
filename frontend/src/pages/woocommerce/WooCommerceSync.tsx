import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

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
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'settings' | 'logs'>('import');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Import State
  const [wooOrders, setWooOrders] = useState<WooOrder[]>([]);
  const [selectedWooOrders, setSelectedWooOrders] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  
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
  }, []);

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
  // 📥 Import Functions
  // ═══════════════════════════════════════════════════════════════

  const fetchWooOrders = async () => {
    if (!settings?.hasCredentials && !settingsForm.consumerKey) {
      toast.error('يرجى إعداد بيانات الاتصال أولاً');
      setActiveTab('settings');
      return;
    }

    setLoading(true);
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
          consumerSecret: settingsForm.consumerSecret
        })
      });

      const data = await response.json();
      if (data.success) {
        setWooOrders(data.data.orders);
        // تحديد كل الطلبات افتراضياً
        setSelectedWooOrders(new Set(data.data.orders.map((o: WooOrder) => o.wooCommerceId)));
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error: any) {
      toast.error('خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ orders: ordersToImport })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`تم استيراد ${data.data.imported} طلب بنجاح`);
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
  // 📤 Export Functions
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
                    جلب الطلبات
                  </button>
                </div>

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
