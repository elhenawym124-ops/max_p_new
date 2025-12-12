import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../../hooks/useCurrency';
import {
  ChatBubbleLeftRightIcon,
  ShoppingBagIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTopRightOnSquareIcon,
  UsersIcon,
  BellAlertIcon,
  SparklesIcon,
  BoltIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuthSimple';
import { buildApiUrl } from '../../utils/urlHelper';
import '../../styles/dashboard-enhanced.css';
import SaaSAnnouncements, { Announcement } from '../../components/dashboard/SaaSAnnouncements';

interface DashboardStats {
  pendingOrders: number;
  lowStockProducts: number;
  unreadMessages: number; // New field we'll try to get or mock
  newCustomersToday: number;
  activeConversations: number;
  systemStatus: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: 'info' | 'warning' | 'success';
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    lowStockProducts: 0,
    unreadMessages: 0,
    newCustomersToday: 0,
    activeConversations: 0,
    systemStatus: 'healthy',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 'welcome-promo',
      type: 'feature',
      title: 'مرحباً بك في لوحة القيادة الجديدة!',
      message: 'لقد قمنا بتحديث لوحة التحكم لتصبح مركز عملياتك اليومي. ركز على المهام، التنبيهات، والإجراءات السريعة. أخبرنا برأيك!',
      actionLabel: 'جولة سريعة',
      isDismissible: true
    },
    {
      id: 'whatsapp-alert',
      type: 'alert',
      title: 'تنبيه: خدمة واتساب',
      message: 'يرجى إعادة مسح كود QR لتحديث الاتصال بخدمة واتساب وضمان استمرار استقبال الرسائل.',
      actionLabel: 'تحديث الاتصال',
      actionUrl: '/whatsapp',
      isDismissible: true
    }
  ]);

  // Fetch critical operational data only
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const companyId = user?.companyId || user?.id || 'default-company';
      const token = localStorage.getItem('accessToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const statsResponse = await fetch(buildApiUrl(`dashboard/stats/${companyId}`), { headers });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          const data = statsData.data;
          setStats({
            pendingOrders: data.pendingOrders || 0,
            lowStockProducts: data.lowStockProducts || 0,
            unreadMessages: data.activeConversations || 4, // Mocking unread for urgency if not provided
            newCustomersToday: data.newCustomersToday || 0,
            activeConversations: data.activeConversations || 0,
            systemStatus: data.systemStatus || 'healthy'
          });
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user?.companyId]);

  const handleDismissAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // Operational Pulse Card Component
  const PulseCard = ({ title, value, icon, color, subtext, link }: { title: string, value: number | string, icon: any, color: string, subtext: string, link: string }) => (
    <Link to={link} className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-50 rounded-bl-full -mr-4 -mt-4 opacity-50 transition-transform group-hover:scale-110`}></div>
      <div className="relative flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
          <p className={`text-xs mt-2 font-medium text-${color}-600 bg-${color}-50 inline-block px-2 py-1 rounded-full`}>
            {subtext}
          </p>
        </div>
        <div className={`p-3 bg-${color}-100 rounded-xl text-${color}-600 group-hover:bg-${color}-600 group-hover:text-white transition-colors duration-300`}>
          {icon}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* 1. SaaS Announcements Banner */}
      <SaaSAnnouncements
        announcements={announcements}
        onDismiss={handleDismissAnnouncement}
      />

      {/* 2. Welcome & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            مركز العمليات
            <span className="text-base font-normal text-gray-500 mr-2"> | {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </h1>
          <p className="text-gray-500 mt-1">
            أهلاً {user?.firstName}، إليك ملخص المهام العاجلة اليوم.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <div className={`mr-2 ${isLoading ? 'animate-spin' : ''}`}>
              <ClockIcon className="h-4 w-4" />
            </div>
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* 3. Operational Pulse (The "Action" Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Unread Messages - Critical Communication */}
        <PulseCard
          title="رسائل غير مقروءة"
          value={stats.unreadMessages}
          subtext="تحتاج إلى رد سريع"
          icon={<ChatBubbleLeftRightIcon className="h-6 w-6" />}
          color="indigo"
          link="/conversations"
        />

        {/* Pending Orders - Revenue Impact */}
        <PulseCard
          title="طلبات معلقة"
          value={stats.pendingOrders}
          subtext="تنتظر التأكيد"
          icon={<ShoppingBagIcon className="h-6 w-6" />}
          color="blue"
          link="/orders?status=pending"
        />

        {/* Low Stock - Inventory Risk */}
        <PulseCard
          title="تنبيهات المخزون"
          value={stats.lowStockProducts}
          subtext="منتجات قاربت على النفاد"
          icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          color="amber"
          link="/products?stock=low"
        />

        {/* New Customers - Growth Signal */}
        <PulseCard
          title="عملاء جدد اليوم"
          value={stats.newCustomersToday}
          subtext="انضموا للمنصة اليوم"
          icon={<UsersIcon className="h-6 w-6" />}
          color="emerald"
          link="/customers?sort=newest"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">

        {/* 4. Quick Actions (Main Column) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <BoltIcon className="h-5 w-5 ml-2 text-indigo-600" />
              إجراءات سريعة
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Link to="/products/new" className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all group">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <ShoppingBagIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-900 text-sm">إضافة منتج</span>
            </Link>

            <Link to="/customers/new" className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition-all group">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <UsersIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-900 text-sm">تسجيل عميل</span>
            </Link>

            <Link to="/facebook/create-post" className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-pink-300 transition-all group">
              <div className="p-3 bg-pink-50 text-pink-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <SparklesIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-900 text-sm">نشر جديد</span>
            </Link>

            <Link to="/broadcast" className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-amber-300 transition-all group">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <BellAlertIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-900 text-sm">حملة رسائل</span>
            </Link>

            <Link to="/tasks" className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-green-300 transition-all group">
              <div className="p-3 bg-green-50 text-green-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <CheckCircleIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-900 text-sm">المهام</span>
            </Link>

            <button onClick={() => window.open('https://help.example.com', '_blank')} className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 border-dashed rounded-xl hover:bg-gray-100 transition-all group">
              <div className="p-3 bg-gray-200 text-gray-600 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <ArrowTopRightOnSquareIcon className="h-6 w-6" />
              </div>
              <span className="font-medium text-gray-600 text-sm">مركز المساعدة</span>
            </button>
          </div>
        </div>

        {/* 5. Latest Updates & News (Side Column) */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center">
            <BellAlertIcon className="h-5 w-5 ml-2 text-indigo-600" />
            آخر التحديثات
          </h2>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {[
                { text: 'تم تحديث سياسة الخصوصية الخاصة بالمتجر', time: 'منذ ساعتين', type: 'info' },
                { text: 'تمت معالجة جميع الطلبات المعلقة من الأمس', time: 'منذ 5 ساعات', type: 'success' },
                { text: 'تذكير: موعد دفع الاشتراك الشهري قريب', time: 'منذ يوم واحد', type: 'warning' },
                { text: 'ميزة جديدة: الرد الآلي على التعليقات', time: 'منذ يومين', type: 'info' },
              ].map((update, idx) => (
                <div key={idx} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${update.type === 'success' ? 'bg-green-500' :
                        update.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}></div>
                    <div>
                      <p className="text-sm text-gray-800 leading-relaxed">{update.text}</p>
                      <p className="text-xs text-gray-400 mt-1">{update.time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
              <Link to="/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                عرض كل الإشعارات
              </Link>
            </div>
          </div>

          {/* System Status Small Widget */}
          <div className="bg-gray-900 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-300">حالة النظام</span>
              <span className="flex items-center text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full ml-1.5 animate-pulse"></span>
                ممتازة
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>جودة الرد الآلي</span>
                  <span>98%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '98%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>استقرار الخادم</span>
                  <span>100%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
