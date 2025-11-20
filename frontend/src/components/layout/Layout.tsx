import React, { useState, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildStoreUrl } from '../../utils/storeUrl';
import { useAuth } from '../../hooks/useAuthSimple';
import NotificationDropdown from '../notifications/NotificationDropdown';
import LanguageSwitcher from '../common/LanguageSwitcher';
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  BellIcon,
  ChevronDownIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  UsersIcon,
  ShoppingBagIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
  BuildingOfficeIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  CheckCircleIcon,
  SpeakerWaveIcon,
  TagIcon,
  ArchiveBoxIcon,
  TicketIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  CreditCardIcon,
  PresentationChartLineIcon,
  WrenchScrewdriverIcon,
  BellAlertIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  KeyIcon,
  TruckIcon,
  DocumentCheckIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('sidebar-collapsed-sections');
    return saved ? JSON.parse(saved) : {};
  });

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newState = { ...prev, [sectionId]: !prev[sectionId] };
      localStorage.setItem('sidebar-collapsed-sections', JSON.stringify(newState));
      return newState;
    });
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
    localStorage.setItem('sidebar-collapsed', (!isSidebarCollapsed).toString());
  };

  // تعريف الأقسام والروابط
  const menuSections = useMemo(() => [
    {
      id: 'main',
      title: t('sidebar.mainSection'),
      icon: '📊',
      items: [
        { to: '/dashboard', icon: <ChartBarIcon className="h-5 w-5" />, label: t('sidebar.dashboard') },
      ]
    },
    {
      id: 'communication',
      title: t('sidebar.conversationsSection'),
      icon: '💬',
      items: [
        { to: '/conversations-improved', icon: <ChatBubbleLeftRightIcon className="h-5 w-5" />, label: t('sidebar.conversationsImproved') },
        { to: '/unified-comments', icon: <ChatBubbleLeftRightIcon className="h-5 w-5" />, label: t('sidebar.unifiedComments') },
        { to: '/customers', icon: <UsersIcon className="h-5 w-5" />, label: t('sidebar.customers') },
      ]
    },
    {
      id: 'ecommerce',
      title: t('sidebar.ecommerceSection'),
      icon: '🛒',
      items: [
        { to: '/shop', icon: <BuildingStorefrontIcon className="h-5 w-5" />, label: t('sidebar.visitStore'), badge: 'جديد', external: true },
        { to: '/products', icon: <ShoppingBagIcon className="h-5 w-5" />, label: t('sidebar.products') },
        { to: '/categories', icon: <TagIcon className="h-5 w-5" />, label: t('sidebar.categories') },
        { to: '/orders', icon: <ArchiveBoxIcon className="h-5 w-5" />, label: t('sidebar.orders') },
        { to: '/inventory', icon: <ClipboardDocumentListIcon className="h-5 w-5" />, label: t('sidebar.inventory') },
        { to: '/coupons', icon: <TicketIcon className="h-5 w-5" />, label: t('sidebar.coupons') },
        { to: '/posts/ai-tracking', icon: <ChartBarIcon className="h-5 w-5" />, label: 'تتبع تحديد المنتجات' },
        { to: '/store-settings', icon: <Cog6ToothIcon className="h-5 w-5" />, label: t('sidebar.storeSettings') },
      ]
    },
    {
      id: 'business',
      title: t('sidebar.businessSection'),
      icon: '📅',
      items: [
        { to: '/appointments', icon: <CalendarIcon className="h-5 w-5" />, label: t('sidebar.appointments') },
        { to: '/tasks', icon: <CheckCircleIcon className="h-5 w-5" />, label: t('sidebar.tasks') },
      ]
    },
    {
      id: 'marketing',
      title: t('sidebar.marketingSection'),
      icon: '📢',
      items: [
        { to: '/broadcast', icon: <SpeakerWaveIcon className="h-5 w-5" />, label: t('sidebar.broadcast') },
      ]
    },
    {
      id: 'billing',
      title: t('sidebar.billingSection'),
      icon: '💰',
      items: [
        { to: '/invoices', icon: <DocumentTextIcon className="h-5 w-5" />, label: t('sidebar.myInvoices') },
        { to: '/payments', icon: <BanknotesIcon className="h-5 w-5" />, label: t('sidebar.myPayments') },
        { to: '/subscription', icon: <CreditCardIcon className="h-5 w-5" />, label: t('sidebar.mySubscription') },
      ]
    },
    {
      id: 'analytics',
      title: t('sidebar.analyticsSection'),
      icon: '📈',
      items: [
        { to: '/reports', icon: <ChartBarIcon className="h-5 w-5" />, label: t('sidebar.reports') },
        { to: '/analytics', icon: <PresentationChartLineIcon className="h-5 w-5" />, label: t('sidebar.advancedAnalytics') },
      ]
    },
    {
      id: 'ai',
      title: t('sidebar.aiSection'),
      icon: '🤖',
      items: [
        { to: '/ai-management', icon: <BeakerIcon className="h-5 w-5" />, label: t('sidebar.aiManagement') },
        { to: '/test-chat', icon: <SparklesIcon className="h-5 w-5" />, label: 'اختبار الرد' },
        { to: '/ai-quality', icon: <BeakerIcon className="h-5 w-5" />, label: t('sidebar.aiQuality') },
      ]
    },
    {
      id: 'notifications',
      title: t('sidebar.toolsSection'),
      icon: '🔔',
      items: [
        { to: '/notifications', icon: <BellIcon className="h-5 w-5" />, label: t('sidebar.notifications') },
        { to: '/reminders', icon: <BellAlertIcon className="h-5 w-5" />, label: t('sidebar.reminders') },
        { to: '/notification-settings', icon: <CogIcon className="h-5 w-5" />, label: t('sidebar.notificationSettings') },
      ]
    },
    {
      id: 'learning',
      title: t('sidebar.learningSection'),
      icon: '📚',
      items: [
        { to: '/learning/settings', icon: <CogIcon className="h-5 w-5" />, label: t('sidebar.learningSettings') },
        { to: '/success-analytics', icon: <PresentationChartLineIcon className="h-5 w-5" />, label: t('sidebar.successAnalytics') },
        { to: '/pattern-management', icon: <WrenchScrewdriverIcon className="h-5 w-5" />, label: t('sidebar.patternManagement') },
        { to: '/quality-advanced', icon: <PresentationChartLineIcon className="h-5 w-5" />, label: t('sidebar.advancedQuality') },
      ]
    },
    ...(user?.role === 'SUPER_ADMIN' || user?.role === 'COMPANY_ADMIN' ? [{
      id: 'admin',
      title: t('sidebar.advancedAdminSection'),
      icon: '⚙️',
      items: [
        { to: '/admin/dashboard', icon: <WrenchScrewdriverIcon className="h-5 w-5" />, label: t('sidebar.adminDashboard') },
        { to: '/monitoring', icon: <ChartBarIcon className="h-5 w-5" />, label: t('sidebar.systemMonitoring') },
        { to: '/alert-settings', icon: <ExclamationTriangleIcon className="h-5 w-5" />, label: t('sidebar.alertSettings') },
      ]
    }] : []),
    ...(user?.role === 'SUPER_ADMIN' ? [{
      id: 'system',
      title: t('sidebar.systemManagementSection'),
      icon: '🏢',
      items: [
        { to: '/companies', icon: <BuildingOfficeIcon className="h-5 w-5" />, label: t('sidebar.companiesManagement') },
      ]
    }] : []),
    ...(user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' ? [{
      id: 'company',
      title: t('sidebar.companyManagementSection'),
      icon: '👥',
      items: [
        { to: '/users', icon: <UserGroupIcon className="h-5 w-5" />, label: t('sidebar.usersManagement') },
        { to: '/roles', icon: <KeyIcon className="h-5 w-5" />, label: t('sidebar.rolesManagement') },
      ]
    }] : []),
    {
      id: 'legal',
      title: t('sidebar.legalSection'),
      icon: '📄',
      items: [
        { to: '/terms', icon: <DocumentCheckIcon className="h-5 w-5" />, label: t('sidebar.terms') },
        { to: '/privacy', icon: <ShieldExclamationIcon className="h-5 w-5" />, label: t('sidebar.privacy') },
      ]
    },
  ], [user?.role, t]);

  // فلترة القوائم حسب البحث
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return menuSections;
    
    const query = searchQuery.toLowerCase();
    return menuSections.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.label.toLowerCase().includes(query) ||
        section.title.toLowerCase().includes(query)
      )
    })).filter(section => section.items.length > 0);
  }, [menuSections, searchQuery]);

  // Helper function for navigation links
  const NavLink: React.FC<{
    to: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    external?: boolean;
    badge?: string;
  }> = ({ to, icon, children, external, badge }) => {
    const isActive = !external && location.pathname === to;

    // للينكات الخارجية (المتجر العام)
    if (external) {
      // استخدم slug إذا موجود، وإلا استخدم companyId كـ fallback
      const identifier = user?.company?.slug || user?.companyId;
      const shopUrl = identifier ? buildStoreUrl(identifier, to) : to;
      
      return (
        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
          title={isSidebarCollapsed ? children as string : undefined}
        >
          <span className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors mr-3">
            {icon}
          </span>
          {!isSidebarCollapsed && (
            <span className="text-sm font-medium truncate flex items-center gap-2">
              {children}
              {badge && (
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  {badge}
                </span>
              )}
            </span>
          )}
        </a>
      );
    }

    return (
      <Link
        to={to}
        className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        title={isSidebarCollapsed ? children as string : undefined}
      >
        <span className={`${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'} transition-colors ${isSidebarCollapsed ? 'mr-0' : 'mr-3'}`}>
          {icon}
        </span>
        {!isSidebarCollapsed && (
          <span className="text-sm font-medium truncate">{children}</span>
        )}
      </Link>
    );
  };

  // مكون قسم قابل للطي
  const CollapsibleSection: React.FC<{
    section: typeof menuSections[0];
  }> = ({ section }) => {
    const isCollapsed = collapsedSections[section.id];
    const hasActiveItem = section.items.some(item => location.pathname === item.to);

    return (
      <div className="mb-4">
        <button
          onClick={() => toggleSection(section.id)}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group ${
            hasActiveItem && !isSidebarCollapsed
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <div className="flex items-center">
            <span className="text-xl mr-2">{section.icon}</span>
            {!isSidebarCollapsed && (
              <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {section.title}
              </h3>
            )}
          </div>
          {!isSidebarCollapsed && (
            <ChevronRightIcon
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                isCollapsed ? '' : 'rotate-90'
              }`}
            />
          )}
        </button>
        {(!isCollapsed || isSidebarCollapsed) && (
          <div className={`mt-1 space-y-1 ${isSidebarCollapsed ? 'mt-2' : ''}`}>
            {section.items.map((item) => (
              <NavLink 
                key={item.to} 
                to={item.to} 
                icon={item.icon}
                external={(item as any).external}
                badge={(item as any).badge}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div 
          className={`${
            isSidebarCollapsed ? 'w-20' : 'w-72'
          } h-full bg-white dark:bg-gray-800 shadow-xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700`}
        >
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              {!isSidebarCollapsed && (
                <div className="flex items-center flex-1">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mr-3 shadow-lg">
                    <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                      {t('sidebar.platformName')}
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.company?.name}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title={isSidebarCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
              >
                {isSidebarCollapsed ? (
                  <Bars3Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <XMarkIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            </div>

            {/* Search Bar */}
            {!isSidebarCollapsed && (
              <div className="mt-4 relative">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="بحث في القائمة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <XMarkIcon className="h-3 w-3 text-gray-400" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
            <div className="px-3 space-y-2">
              {filteredSections.map((section) => (
                <CollapsibleSection key={section.id} section={section} />
              ))}

              {/* Settings at bottom */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <NavLink to="/settings" icon={<CogIcon className="h-5 w-5" />}>
                  {t('sidebar.settings')}
                </NavLink>
              </div>
            </div>

            {/* No Results Message */}
            {searchQuery && filteredSections.length === 0 && (
              <div className="px-6 py-8 text-center">
                <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  لا توجد نتائج للبحث
                </p>
              </div>
            )}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300">
          {/* Header */}
          <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 z-10">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                {/* تنبيه دخول المدير العام */}
                {(user as any)?.loginType === 'super_admin_impersonation' && (
                  <div className="flex items-center bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mr-4">
                    <svg className="h-5 w-5 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium text-orange-700 ml-2">
                      {t('sidebar.superAdminLogin')}
                    </span>
                    <button
                      onClick={() => window.location.href = '/super-admin/companies'}
                      className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded text-sm mr-3 transition-colors"
                    >
                      {t('sidebar.backToCompanies')}
                    </button>
                  </div>
                )}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('sidebar.welcome')}
                </h2>
                <div className="flex items-center space-x-4 space-x-reverse">
                  {/* Language Switcher */}
                  <LanguageSwitcher />
                  
                  {/* Notifications */}
                  <NotificationDropdown />

                  {/* Profile Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                      className="flex items-center space-x-2 space-x-reverse text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 p-2"
                    >
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-700">
                          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                        </span>
                      </div>
                      <div className="hidden md:block text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {user?.firstName} {user?.lastName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</div>
                      </div>
                      <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                    </button>

                    {/* Profile Dropdown Menu */}
                    {isProfileMenuOpen && (
                      <>
                        {/* Overlay */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsProfileMenuOpen(false)}
                        />

                        {/* Dropdown Menu */}
                        <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1">
                            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                              <div className="font-medium">{user?.firstName} {user?.lastName}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</div>
                              <div className="text-xs text-indigo-600 dark:text-indigo-400">{user?.company?.name}</div>
                            </div>

                            <Link
                              to="/profile"
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setIsProfileMenuOpen(false)}
                            >
                              <UserCircleIcon className="h-4 w-4 ml-2" />
                              {t('sidebar.profile')}
                            </Link>

                            <Link
                              to="/settings"
                              className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setIsProfileMenuOpen(false)}
                            >
                              <Cog6ToothIcon className="h-4 w-4 ml-2" />
                              {t('sidebar.settings')}
                            </Link>

                            {/* زر العودة لمدير النظام */}
                            {(user as any)?.loginType === 'super_admin_impersonation' && (
                              <Link
                                to="/super-admin/companies"
                                className="flex items-center px-4 py-2 text-sm text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-t border-gray-100 dark:border-gray-700"
                                onClick={() => setIsProfileMenuOpen(false)}
                              >
                                <ArrowLeftIcon className="h-4 w-4 ml-2" />
                                {t('sidebar.backToCompanies')}
                              </Link>
                            )}

                            <div className="border-t border-gray-100 dark:border-gray-700">
                              <button
                                onClick={handleLogout}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <ArrowRightOnRectangleIcon className="h-4 w-4 ml-2" />
                                {t('sidebar.logout')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
