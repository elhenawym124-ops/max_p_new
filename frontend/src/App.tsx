import { Routes, Route, Navigate } from 'react-router-dom';

// Providers
import AppProviders from './providers/AppProviders';

// Layout components
import Layout from './components/layout/Layout';
import AuthLayout from './components/layout/AuthLayout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import StorefrontLayout from './components/layout/StorefrontLayout';

// Environment Indicator
import EnvironmentIndicator from './components/common/EnvironmentIndicator';
import PerformanceOptimizer from './components/PerformanceOptimizer';

// Import pages directly
import Dashboard from './pages/dashboard/Dashboard';
import Login from './pages/auth/Login';
import SimpleLogin from './pages/auth/SimpleLogin';
import ModernLogin from './pages/auth/ModernLogin';


import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import AcceptInvitation from './pages/auth/AcceptInvitation';

// Import pages
import CustomerList from './pages/customers/CustomerList';
import CommentsManagement from './pages/comments/CommentsManagement';
import CommentDetails from './pages/comments/CommentDetails';
import CommentSettings from './pages/comments/CommentSettings';
import PostsManagement from './pages/comments/PostsManagement';
import PostSettings from './pages/comments/PostSettings';
import PostComments from './pages/comments/PostComments';
import PostAITracking from './pages/posts/PostAITracking';
import ConversationsSimple from './pages/conversations/ConversationsSimple';
import ConversationsImprovedFixed from './pages/conversations/ConversationsImprovedFixed';
import TelegramConversations from './pages/conversations/TelegramConversations';
import ConversationsDashboard from './pages/conversations/ConversationsDashboard';
import ConversationsTest from './pages/conversations/ConversationsTest';
import ConversationsSimpleTest from './pages/conversations/ConversationsSimpleTest';
import MessengerChat from './pages/conversations/MessengerChat-final';
import AITestChat from './pages/testChat/AITestChat';
import Products from './pages/products/Products';
import ProductNewFinal from './pages/products/ProductNewFinal';
import ProductView from './pages/products/ProductView';
import EasyOrdersImport from './pages/products/EasyOrdersImport';
import WooCommerceImport from './pages/products/WooCommerceImport';
import WooCommerceSync from './pages/woocommerce/WooCommerceSync';
import OrderSettings from './pages/settings/OrderSettings';
import ProductReviewsSimple from './pages/products/ProductReviewsSimple';
import ProtectedRoute from './components/ProtectedRoute';
import Categories from './pages/categories/Categories';
import Reports from './pages/reports/Reports';
import Settings from './pages/settings/Settings';
import CompanySettings from './pages/settings/CompanySettings';
import FacebookSettings from './pages/settings/FacebookSettings';
import TelegramSettings from './pages/settings/TelegramSettings';
import TelegramConversationsPro from './pages/conversations/TelegramConversationsPro';
import TelegramUserbot from './pages/telegram/TelegramUserbot'; // System 2
import StoreSettings from './pages/settings/StoreSettings';
import StorePages from './pages/settings/StorePages';
import StorefrontFeaturesSettings from './pages/settings/StorefrontFeaturesSettings';
import DeliveryOptions from './pages/settings/DeliveryOptions';
import PromotionSettings from './pages/settings/PromotionSettings';
import RecommendationSettings from './pages/settings/RecommendationSettings';
import HomepageSettings from './pages/settings/HomepageSettings';
import HomepageEditor from './pages/settings/HomepageEditor';
import HomepagePreview from './pages/settings/HomepagePreview';
import ProductImageSettings from './pages/settings/ProductImageSettings';

// Advertising
import FacebookPixelSettings from './pages/advertising/FacebookPixelSettings';
import FacebookAdsDashboard from './pages/advertising/FacebookAdsDashboard';
import CreateCampaign from './pages/advertising/CreateCampaign';
import CreateAd from './pages/advertising/CreateAd';
import CampaignDetails from './pages/advertising/CampaignDetails';
import AudiencesManagement from './pages/advertising/AudiencesManagement';
import CreateCustomAudience from './pages/advertising/CreateCustomAudience';
import CreateLookalikeAudience from './pages/advertising/CreateLookalikeAudience';
import CustomAudienceDetails from './pages/advertising/CustomAudienceDetails';
import CreateAdSet from './pages/advertising/CreateAdSet';
import CatalogsManagement from './pages/advertising/CatalogsManagement';
import CatalogDetails from './pages/advertising/CatalogDetails';
import CreateDynamicAd from './pages/advertising/CreateDynamicAd';
import ABTestsManagement from './pages/advertising/ABTestsManagement';
import CreateABTest from './pages/advertising/CreateABTest';
import ABTestDetails from './pages/advertising/ABTestDetails';
import CreateAdWizard from './pages/advertising/CreateAdWizard';
import AutomationRules from './pages/advertising/AutomationRules';
import AsyncReports from './pages/advertising/AsyncReports';
import LeadFormsManagement from './pages/advertising/LeadFormsManagement';
import DynamicCreativeOptimization from './pages/advertising/DynamicCreativeOptimization';
import AdvantagePlusShopping from './pages/advertising/AdvantagePlusShopping';
import ConversionApiDashboard from './pages/advertising/ConversionApiDashboard';
import CreativeFormats from './pages/advertising/CreativeFormats';
import AdPreview from './pages/advertising/AdPreview';
import SavedAudiences from './pages/advertising/SavedAudiences';
import AttributionSettings from './pages/advertising/AttributionSettings';
import Profile from './pages/profile/Profile';
import TermsAndConditions from './pages/legal/TermsAndConditions';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicy';
import Orders from './pages/orders/Orders';
import OrdersEnhanced from './pages/orders/OrdersEnhanced';
import OrderDetails from './pages/orders/OrderDetails';
import OrderStats from './pages/orders/OrderStats';
import FacebookOAuth from './pages/settings/FacebookOAuth';
import Inventory from './pages/inventory/Inventory';
import Coupons from './pages/coupons/Coupons';
import Appointments from './pages/appointments/Appointments';
import OrderDemo from './pages/OrderDemo';
import Opportunities from './pages/opportunities/Opportunities';
import Tasks from './pages/tasks/Tasks';
import TasksDashboard from './pages/tasks/Dashboard';
import KanbanBoard from './pages/tasks/KanbanBoard';
import TaskDetails from './pages/tasks/TaskDetails';
import TaskNotifications from './pages/tasks/TaskNotifications';
import CalendarView from './pages/tasks/CalendarView';
import TimeReports from './pages/tasks/TimeReports';
import TaskTemplates from './pages/tasks/TaskTemplates';
import AdvancedReports from './pages/reports/AdvancedReports';
import PosPage from './pages/pos/PosPage';

// Storefront (Public Pages)
import Homepage from './pages/storefront/Homepage';
import ThemeHomepage from './pages/storefront/ThemeHomepage'; // New wrapper
import HomepageTest from './pages/storefront/HomepageTest';
import HomepageSimple from './pages/storefront/HomepageSimple';
import WoodmartReplica from './pages/storefront/WoodmartReplica';
import TestPublic from './pages/TestPublic';
import TestMinimal from './pages/TestMinimal';
import Shop from './pages/storefront/Shop';
import ProductDetails from './pages/storefront/ProductDetails';
import ThemeProductDetails from './pages/storefront/ThemeProductDetails'; // New wrapper
import Cart from './pages/storefront/Cart';
import Checkout from './pages/storefront/Checkout';
import OrderConfirmation from './pages/storefront/OrderConfirmation';
import TrackOrder from './pages/storefront/TrackOrder';
import WishlistPage from './pages/storefront/WishlistPage';
import StorePage from './pages/storefront/StorePage';

// AI Management
import AIManagement from './pages/ai/AIManagement';

// Support System
import SupportCenter from './pages/support/SupportCenter';
import CreateTicket from './pages/support/CreateTicket';
import MyTickets from './pages/support/MyTickets';
import TicketDetails from './pages/support/TicketDetails';
import FAQ from './pages/support/FAQ';
import SupportAdmin from './pages/admin/SupportAdmin';

// Activity Log System
import MyActivity from './pages/MyActivity';
import CompanyActivity from './pages/CompanyActivity';

import { BroadcastDashboard } from './pages/broadcast';
import Reminders from './pages/Reminders';
import NotificationSettings from './pages/NotificationSettings';
import Notifications from './pages/Notifications';
import MonitoringDashboard from './pages/MonitoringDashboard';
import AlertSettings from './pages/AlertSettings';
import ReportsPage from './pages/ReportsPage';
import QualityTestPage from './pages/QualityTestPage';
import QualityDashboard from './pages/QualityDashboard';
import AdvancedQualityDashboard from './pages/AdvancedQualityDashboard';
import AIQualityDashboard from './pages/AIQualityDashboard';
import SuccessAnalytics from './pages/SuccessAnalytics';
import PatternManagement from './pages/PatternManagement';
import CompaniesManagement from './pages/CompaniesManagement';
import UsersManagement from './pages/UsersManagement';
import RolesManagement from './pages/RolesManagement';
import CompanyDashboard from './pages/CompanyDashboard';

// Super Admin
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminCompanies from './pages/SuperAdminCompanies';
import SuperAdminReports from './pages/SuperAdminReports';
import SuperAdminPlans from './pages/SuperAdminPlans';
import SuperAdminSubscriptions from './pages/SuperAdminSubscriptions';
import SuperAdminInvoices from './pages/SuperAdminInvoices';
import SuperAdminPayments from './pages/SuperAdminPayments';
import SuperAdminSystemManagement from './pages/SuperAdminSystemManagement';
import SuperAdminPromptLibrary from './pages/SuperAdminPromptLibrary';
import SuperAdminThemes from './pages/SuperAdminThemes';
import SuperAdminHomepageTemplates from './pages/SuperAdminHomepageTemplates';
import CentralKeysManagement from './pages/super-admin/CentralKeysManagement';
import ModelsManagement from './pages/super-admin/ModelsManagement';
import ModelTypesManagement from './pages/super-admin/ModelTypesManagement';
import ModelPrioritiesManagement from './pages/super-admin/ModelPrioritiesManagement';
import QuotaMonitoringDashboard from './pages/super-admin/QuotaMonitoringDashboard';
import RateLimitsMonitoring from './pages/super-admin/RateLimitsMonitoring';

import PaymentPage from './pages/PaymentPage';
import WalletManagement from './pages/WalletManagement';
import CustomerInvoices from './pages/CustomerInvoices';
import CustomerPayments from './pages/CustomerPayments';
import CustomerSubscription from './pages/CustomerSubscription';
import SubscriptionRenewalPayment from './pages/SubscriptionRenewalPayment';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import TermsOfService from './pages/legal/TermsOfService';
import UnifiedCommentsManagement from "./pages/comments/UnifiedCommentsManagement"

// Page Builder
import PageBuilder from './pages/PageBuilder';
import LandingPageList from './pages/LandingPageList';

// WhatsApp
import { WhatsAppSettings, WhatsAppChat } from './pages/whatsapp';

// HR Module
import {
  HRDashboard, Employees, EmployeeDetails, Departments, Attendance, Leaves, Payroll,
  HRSettings, HRReports, Documents, SalaryHistory, PerformanceReviews, Training,
  Warnings, Shifts, Benefits, Goals, Feedback, Resignations
} from './pages/hr';

import { useAuth } from './hooks/useAuthSimple';

// Create a separate component that uses auth
const AppContent = () => {
  // Use real authentication state
  const { isAuthenticated, isLoading } = useAuth();

  // Debug: Log current route and auth status
  const currentPath = window.location.pathname;
  console.log('🔍 [App] Current path:', currentPath);
  console.log('🔍 [App] Is authenticated:', isAuthenticated);
  console.log('🔍 [App] Is loading:', isLoading);

  // Check if current path is a public route
  const isPublicRoute =
    currentPath.startsWith('/test-public') ||
    currentPath.startsWith('/home') ||
    currentPath.startsWith('/shop') ||
    currentPath.startsWith('/auth/') ||
    currentPath.startsWith('/payment/') ||
    currentPath.startsWith('/super-admin/login');

  // Only show loading for non-public routes
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // Check if path is /products/reviews and log debug info
  if (currentPath === '/products/reviews') {
    console.log('🔍 [App] Accessing /products/reviews');
    console.log('🔍 [App] Is authenticated:', isAuthenticated);
    console.log('🔍 [App] Token exists:', !!localStorage.getItem('accessToken'));
    console.log('🔍 [App] Will render:', isAuthenticated ? 'ProductReviews component' : 'Redirect to login');

    // If not authenticated but token exists, log more details
    if (!isAuthenticated && localStorage.getItem('accessToken')) {
      console.warn('⚠️ [App] User has token but isAuthenticated is false! This might be a timing issue.');
    }
  }

  return (
    <PerformanceOptimizer>
      <div className="App">
        <EnvironmentIndicator position="bottom-left" />
        <Routes>
          {/* Public Routes */}
          <Route path="/auth/login" element={<AuthLayout><ModernLogin /></AuthLayout>} />
          <Route path="/auth/login-simple" element={<AuthLayout><SimpleLogin /></AuthLayout>} />
          <Route path="/auth/login-old" element={<AuthLayout><Login /></AuthLayout>} />
          <Route path="/auth/register" element={<AuthLayout><Register /></AuthLayout>} />
          <Route path="/auth/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
          <Route path="/auth/reset-password" element={<AuthLayout><ResetPassword /></AuthLayout>} />
          <Route path="/auth/accept-invitation" element={<AuthLayout><AcceptInvitation /></AuthLayout>} />

          {/* Legal Pages - Public Access */}
          {/* <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} /> */}

          {/* Public Storefront Routes - No Authentication Required */}
          <Route path="/test-minimal" element={<TestMinimal />} />
          <Route path="/test-public" element={<TestPublic />} />
          <Route path="/home-test" element={<HomepageTest />} />
          <Route path="/home-simple" element={<HomepageSimple />} />
          <Route path="/home-no-layout" element={<Homepage />} />
          <Route path="/home" element={<StorefrontLayout><ThemeHomepage /></StorefrontLayout>} />
          <Route path="/shop" element={<StorefrontLayout><Shop /></StorefrontLayout>} />
          <Route path="/shop/products/:id" element={<StorefrontLayout><ThemeProductDetails /></StorefrontLayout>} />
          <Route path="/shop/cart" element={<StorefrontLayout><Cart /></StorefrontLayout>} />
          <Route path="/shop/wishlist" element={<StorefrontLayout><WishlistPage /></StorefrontLayout>} />
          <Route path="/shop/checkout" element={<StorefrontLayout><Checkout /></StorefrontLayout>} />
          <Route path="/shop/order-confirmation/:orderNumber" element={<StorefrontLayout><OrderConfirmation /></StorefrontLayout>} />
          <Route path="/shop/track-order" element={<StorefrontLayout><TrackOrder /></StorefrontLayout>} />
          <Route path="/shop/page/:slug" element={<StorefrontLayout><StorePage /></StorefrontLayout>} />
          <Route path="/woodmart-replica" element={<WoodmartReplica />} />

          {/* Root path - redirect based on auth status */}
          <Route path="/" element={
            isLoading ? (
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">جاري التحميل...</p>
                </div>
              </div>
            ) : isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/auth/login" replace />
            )
          } />

          {/* Super Admin Routes */}
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          <Route path="/super-admin/dashboard" element={<SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout>} />
          <Route path="/super-admin/companies" element={<SuperAdminLayout><SuperAdminCompanies /></SuperAdminLayout>} />
          <Route path="/super-admin/reports" element={<SuperAdminLayout><SuperAdminReports /></SuperAdminLayout>} />
          <Route path="/super-admin/plans" element={<SuperAdminLayout><SuperAdminPlans /></SuperAdminLayout>} />
          <Route path="/super-admin/subscriptions" element={<SuperAdminLayout><SuperAdminSubscriptions /></SuperAdminLayout>} />
          <Route path="/super-admin/invoices" element={<SuperAdminLayout><SuperAdminInvoices /></SuperAdminLayout>} />
          <Route path="/super-admin/payments" element={<SuperAdminLayout><SuperAdminPayments /></SuperAdminLayout>} />
          <Route path="/super-admin/system-management" element={<SuperAdminLayout><SuperAdminSystemManagement /></SuperAdminLayout>} />
          <Route path="/super-admin/themes" element={<SuperAdminLayout><SuperAdminThemes /></SuperAdminLayout>} />
          <Route path="/super-admin/prompt-library" element={<SuperAdminLayout><SuperAdminPromptLibrary /></SuperAdminLayout>} />
          <Route path="/super-admin/central-keys" element={<SuperAdminLayout><CentralKeysManagement /></SuperAdminLayout>} />
          <Route path="/super-admin/models" element={<SuperAdminLayout><ModelsManagement /></SuperAdminLayout>} />
          <Route path="/super-admin/model-types" element={<SuperAdminLayout><ModelTypesManagement /></SuperAdminLayout>} />
          <Route path="/super-admin/model-priorities" element={<SuperAdminLayout><ModelPrioritiesManagement /></SuperAdminLayout>} />
          <Route path="/super-admin/homepage-templates" element={<SuperAdminLayout><SuperAdminHomepageTemplates /></SuperAdminLayout>} />
          <Route path="/super-admin/quota-monitoring" element={<SuperAdminLayout><QuotaMonitoringDashboard /></SuperAdminLayout>} />
          <Route path="/super-admin/rate-limits" element={<SuperAdminLayout><RateLimitsMonitoring /></SuperAdminLayout>} />
          <Route path="/super-admin/wallet-management" element={<SuperAdminLayout><WalletManagement /></SuperAdminLayout>} />

          {/* Public Payment Routes */}
          <Route path="/payment/:invoiceId" element={<PaymentPage />} />
          <Route path="/payment/subscription-renewal" element={<SubscriptionRenewalPayment />} />

          {/* Page Builder Routes - Public for testing */}
          <Route path="/page-builder" element={<PageBuilder />} />
          <Route path="/landing-pages" element={<Layout><LandingPageList /></Layout>} />

          {/* Protected Routes with ProtectedRoute component (handles auth internally) */}
          <Route path="/products/reviews" element={<ProtectedRoute><ProductReviewsSimple /></ProtectedRoute>} />

          {/* Protected Routes - Only accessible when authenticated */}
          {isAuthenticated ? (
            <>
              <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
              <Route path="/customers" element={<Layout><CustomerList /></Layout>} />
              {/* <Route path="/conversations" element={<Layout><ConversationsSimple /></Layout>} /> */}
              <Route path="/conversations-improved" element={<Layout><ConversationsImprovedFixed /></Layout>} />
              {/* <Route path="/conversations-dashboard" element={<Layout><ConversationsDashboard /></Layout>} />
            <Route path="/conversations-test" element={<Layout><ConversationsTest /></Layout>} />
            <Route path="/conversations-simple-test" element={<Layout><ConversationsSimpleTest /></Layout>} /> */}
              <Route path="/comments" element={<Layout><CommentsManagement /></Layout>} />
              <Route path="/comments/:id" element={<Layout><CommentDetails /></Layout>} />
              <Route path="/comments/settings" element={<Layout><CommentSettings /></Layout>} />
              {/* Unified Comments Management Routes */}
              <Route path="/unified-comments" element={<Layout><PostsManagement /></Layout>} />
              <Route path="/unified-comments/:postId" element={<Layout><UnifiedCommentsManagement /></Layout>} />
              {/* Posts Management Routes */}
              <Route path="/posts" element={<Layout><PostsManagement /></Layout>} />
              <Route path="/posts/ai-tracking" element={<Layout><PostAITracking /></Layout>} />
              <Route path="/posts/:postId/settings" element={<Layout><PostSettings /></Layout>} />
              <Route path="/posts/:postId/comments" element={<Layout><PostComments /></Layout>} />
              <Route path="/messenger-chat" element={<Layout><MessengerChat /></Layout>} />
              <Route path="/products" element={<Layout><Products /></Layout>} />
              <Route path="/products/new" element={<Layout><ProductNewFinal /></Layout>} />
              <Route path="/products/import-easy-orders" element={<Layout><EasyOrdersImport /></Layout>} />
              <Route path="/products/import-woocommerce" element={<Layout><WooCommerceImport /></Layout>} />
              <Route path="/products/:id/edit" element={<Layout><ProductNewFinal /></Layout>} />
              <Route path="/products/:id" element={<Layout><ProductView /></Layout>} />

              <Route path="/categories" element={<Layout><Categories /></Layout>} />
              <Route path="/orders" element={<Layout><Orders /></Layout>} />
              <Route path="/orders/enhanced" element={<Layout><OrdersEnhanced /></Layout>} />
              <Route path="/orders-enhanced" element={<Layout><OrdersEnhanced /></Layout>} />
              <Route path="/orders/details/:id" element={<Layout><OrderDetails /></Layout>} />
              <Route path="/orders/enhanced/:id" element={<Layout><OrderDetails /></Layout>} />
              <Route path="/orders/woocommerce-sync" element={<Layout><WooCommerceSync /></Layout>} />
              <Route path="/settings/orders" element={<Layout><OrderSettings /></Layout>} />
              <Route path="/settings/facebook-oauth" element={<Layout><FacebookOAuth /></Layout>} />
              <Route path="/orders/stats" element={<Layout><OrderStats /></Layout>} />
              <Route path="/order-demo" element={<Layout><OrderDemo /></Layout>} />
              {/* <Route path="/opportunities" element={<Layout><Opportunities /></Layout>} /> */}
              <Route path="/inventory" element={<Layout><Inventory /></Layout>} />
              <Route path="/coupons" element={<Layout><Coupons /></Layout>} />
              <Route path="/appointments" element={<Layout><Appointments /></Layout>} />
              <Route path="/tasks" element={<Layout><Tasks /></Layout>} />
              <Route path="/tasks/dashboard" element={<Layout><TasksDashboard /></Layout>} />
              <Route path="/tasks/kanban" element={<Layout><KanbanBoard /></Layout>} />
              <Route path="/tasks/notifications" element={<Layout><TaskNotifications /></Layout>} />
              <Route path="/tasks/calendar" element={<Layout><CalendarView /></Layout>} />
              <Route path="/tasks/time-reports" element={<Layout><TimeReports /></Layout>} />
              <Route path="/tasks/templates" element={<Layout><TaskTemplates /></Layout>} />
              <Route path="/tasks/:id" element={<Layout><TaskDetails /></Layout>} />
              <Route path="/reports" element={<Layout><Reports /></Layout>} />
              <Route path="/analytics" element={<Layout><AdvancedReports /></Layout>} />
              <Route path="/pos" element={<Layout><PosPage /></Layout>} />

              {/* AI Management */}
              <Route path="/ai-management" element={<Layout><AIManagement /></Layout>} />

              {/* Test Chat */}
              <Route path="/test-chat" element={<Layout><AITestChat /></Layout>} />

              {/* Customer Billing */}
              <Route path="/invoices" element={<Layout><CustomerInvoices /></Layout>} />
              <Route path="/payments" element={<Layout><CustomerPayments /></Layout>} />
              <Route path="/subscription" element={<Layout><CustomerSubscription /></Layout>} />

              <Route path="/broadcast" element={<Layout><BroadcastDashboard /></Layout>} />

              {/* Advertising Routes */}
              <Route path="/advertising/facebook-pixel" element={<Layout><FacebookPixelSettings /></Layout>} />
              <Route path="/advertising/facebook-ads" element={<Layout><FacebookAdsDashboard /></Layout>} />
              <Route path="/advertising/facebook-ads/campaigns" element={<Layout><FacebookAdsDashboard /></Layout>} />
              <Route path="/advertising/facebook-ads/campaigns/create" element={<Layout><CreateCampaign /></Layout>} />
              <Route path="/advertising/facebook-ads/create-ad" element={<Layout><CreateAdWizard /></Layout>} />
              <Route path="/advertising/facebook-ads/campaigns/:id" element={<Layout><CampaignDetails /></Layout>} />
              <Route path="/advertising/facebook-ads/campaigns/:campaignId/adsets/create" element={<Layout><CreateAdSet /></Layout>} />
              <Route path="/advertising/facebook-ads/adsets/:adSetId/ads/create" element={<Layout><CreateAd /></Layout>} />
              <Route path="/advertising/facebook-ads/catalogs" element={<Layout><CatalogsManagement /></Layout>} />
              <Route path="/advertising/facebook-ads/catalogs/:id" element={<Layout><CatalogDetails /></Layout>} />
              <Route path="/advertising/facebook-ads/adsets/:adSetId/dynamic-ads/create" element={<Layout><CreateDynamicAd /></Layout>} />
              <Route path="/advertising/facebook-ads/tests" element={<Layout><ABTestsManagement /></Layout>} />
              <Route path="/advertising/facebook-ads/tests/create" element={<Layout><CreateABTest /></Layout>} />
              <Route path="/advertising/facebook-ads/tests/:id" element={<Layout><ABTestDetails /></Layout>} />
              <Route path="/advertising/facebook-ads/audiences" element={<Layout><AudiencesManagement /></Layout>} />
              <Route path="/advertising/facebook-ads/audiences/custom/create" element={<Layout><CreateCustomAudience /></Layout>} />
              <Route path="/advertising/facebook-ads/audiences/custom/:id" element={<Layout><CustomAudienceDetails /></Layout>} />
              <Route path="/advertising/facebook-ads/audiences/lookalike/create" element={<Layout><CreateLookalikeAudience /></Layout>} />
              <Route path="/advertising/facebook-ads/automation-rules" element={<Layout><AutomationRules /></Layout>} />
              <Route path="/advertising/facebook-ads/reports" element={<Layout><AsyncReports /></Layout>} />
              <Route path="/advertising/facebook-ads/lead-forms" element={<Layout><LeadFormsManagement /></Layout>} />
              <Route path="/advertising/facebook-ads/dco" element={<Layout><DynamicCreativeOptimization /></Layout>} />
              <Route path="/advertising/facebook-ads/advantage-plus" element={<Layout><AdvantagePlusShopping /></Layout>} />
              <Route path="/advertising/facebook-ads/conversions" element={<Layout><ConversionApiDashboard /></Layout>} />
              <Route path="/advertising/facebook-ads/creative-formats" element={<Layout><CreativeFormats /></Layout>} />
              <Route path="/advertising/facebook-ads/ad-preview" element={<Layout><AdPreview /></Layout>} />
              <Route path="/advertising/facebook-ads/saved-audiences" element={<Layout><SavedAudiences /></Layout>} />
              <Route path="/advertising/facebook-ads/attribution" element={<Layout><AttributionSettings /></Layout>} />

              <Route path="/reminders" element={<Layout><Reminders /></Layout>} />
              <Route path="/notifications" element={<Layout><Notifications /></Layout>} />
              <Route path="/notification-settings" element={<Layout><NotificationSettings /></Layout>} />
              <Route path="/monitoring" element={<Layout><MonitoringDashboard /></Layout>} />
              <Route path="/alert-settings" element={<Layout><AlertSettings /></Layout>} />
              <Route path="/reports" element={<Layout><ReportsPage /></Layout>} />
              <Route path="/quality-test" element={<Layout><QualityTestPage /></Layout>} />
              {/* <Route path="/quality" element={<Layout><QualityDashboard /></Layout>} /> */}
              <Route path="/quality-advanced" element={<Layout><AdvancedQualityDashboard /></Layout>} />
              <Route path="/ai-quality" element={<Layout><AIQualityDashboard /></Layout>} />
              <Route path="/success-analytics" element={<Layout><SuccessAnalytics /></Layout>} />
              <Route path="/pattern-management" element={<Layout><PatternManagement /></Layout>} />
              <Route path="/companies" element={<Layout><CompaniesManagement /></Layout>} />
              <Route path="/users" element={<Layout><UsersManagement /></Layout>} />
              <Route path="/roles" element={<Layout><RolesManagement /></Layout>} />
              <Route path="/company-dashboard" element={<Layout><CompanyDashboard /></Layout>} />
              <Route path="/profile" element={<Layout><Profile /></Layout>} />
              <Route path="/settings" element={<Layout><Settings /></Layout>} />
              <Route path="/settings/company" element={<Layout><CompanySettings /></Layout>} />
              <Route path="/store-settings" element={<Layout><StoreSettings /></Layout>} />
              <Route path="/settings/store" element={<Layout><StoreSettings /></Layout>} />
              <Route path="/settings/store-pages" element={<Layout><StorePages /></Layout>} />
              <Route path="/settings/storefront-features" element={<Layout><StorefrontFeaturesSettings /></Layout>} />
              <Route path="/settings/product-images" element={<Layout><ProductImageSettings /></Layout>} />
              <Route path="/settings/delivery-options" element={<Layout><DeliveryOptions /></Layout>} />
              <Route path="/settings/promotion" element={<Layout><PromotionSettings /></Layout>} />
              <Route path="/settings/recommendations" element={<Layout><RecommendationSettings /></Layout>} />
              <Route path="/settings/homepage" element={<Layout><HomepageSettings /></Layout>} />
              <Route path="/settings/homepage/create" element={<Layout><HomepageEditor /></Layout>} />
              <Route path="/settings/homepage/edit/:id" element={<Layout><HomepageEditor /></Layout>} />
              <Route path="/settings/homepage/:id" element={<Layout><HomepageEditor /></Layout>} />
              <Route path="/preview/homepage/:id" element={<HomepagePreview />} />
              <Route path="/settings/facebook" element={<Layout><FacebookSettings /></Layout>} />
              <Route path="/settings/facebook-oauth" element={<Layout><FacebookOAuth /></Layout>} />
              <Route path="/settings/telegram" element={<Layout><TelegramSettings /></Layout>} />
              <Route path="/telegram/conversations" element={<Layout><TelegramConversations /></Layout>} />
              <Route path="/telegram/pro" element={<Layout><TelegramConversationsPro /></Layout>} />
              <Route path="/telegram-userbot" element={<Layout><TelegramUserbot /></Layout>} /> {/* System 2 */}
              <Route path="/terms" element={<Layout><TermsOfService /></Layout>} />
              <Route path="/privacy" element={<Layout><PrivacyPolicy /></Layout>} />

              {/* WhatsApp Routes */}
              <Route path="/whatsapp" element={<Layout><WhatsAppChat /></Layout>} />
              <Route path="/whatsapp/chat" element={<Layout><WhatsAppChat /></Layout>} />
              <Route path="/whatsapp/settings" element={<Layout><WhatsAppSettings /></Layout>} />

              {/* HR Routes */}
              <Route path="/hr" element={<Layout><HRDashboard /></Layout>} />
              <Route path="/hr/dashboard" element={<Layout><HRDashboard /></Layout>} />
              <Route path="/hr/employees" element={<Layout><Employees /></Layout>} />
              <Route path="/hr/employees/:id" element={<Layout><EmployeeDetails /></Layout>} />
              <Route path="/hr/departments" element={<Layout><Departments /></Layout>} />
              <Route path="/hr/attendance" element={<Layout><Attendance /></Layout>} />
              <Route path="/hr/leaves" element={<Layout><Leaves /></Layout>} />
              <Route path="/hr/payroll" element={<Layout><Payroll /></Layout>} />
              <Route path="/hr/settings" element={<Layout><HRSettings /></Layout>} />
              <Route path="/hr/reports" element={<Layout><HRReports /></Layout>} />
              <Route path="/hr/documents/:employeeId" element={<Layout><Documents /></Layout>} />
              <Route path="/hr/salary-history/:employeeId" element={<Layout><SalaryHistory /></Layout>} />
              <Route path="/hr/performance-reviews" element={<Layout><PerformanceReviews /></Layout>} />
              <Route path="/hr/performance-reviews/:id" element={<Layout><PerformanceReviews /></Layout>} />
              <Route path="/hr/training" element={<Layout><Training /></Layout>} />
              <Route path="/hr/training/:id" element={<Layout><Training /></Layout>} />
              <Route path="/hr/warnings" element={<Layout><Warnings /></Layout>} />
              <Route path="/hr/warnings/:id" element={<Layout><Warnings /></Layout>} />
              <Route path="/hr/shifts" element={<Layout><Shifts /></Layout>} />
              <Route path="/hr/shifts/:id" element={<Layout><Shifts /></Layout>} />
              <Route path="/hr/benefits" element={<Layout><Benefits /></Layout>} />
              <Route path="/hr/benefits/:id" element={<Layout><Benefits /></Layout>} />
              <Route path="/hr/goals" element={<Layout><Goals /></Layout>} />
              <Route path="/hr/goals/:id" element={<Layout><Goals /></Layout>} />
              <Route path="/hr/feedback" element={<Layout><Feedback /></Layout>} />
              <Route path="/hr/feedback/:id" element={<Layout><Feedback /></Layout>} />
              <Route path="/hr/resignations" element={<Layout><Resignations /></Layout>} />
              <Route path="/hr/resignations/:id" element={<Layout><Resignations /></Layout>} />

              {/* Support System Routes */}
              <Route path="/support" element={<Layout><SupportCenter /></Layout>} />
              <Route path="/support/tickets" element={<Layout><MyTickets /></Layout>} />
              <Route path="/support/tickets/new" element={<Layout><CreateTicket /></Layout>} />
              <Route path="/support/tickets/:ticketId" element={<Layout><TicketDetails /></Layout>} />
              <Route path="/support/faq" element={<Layout><FAQ /></Layout>} />

              {/* Activity Log Routes */}
              <Route path="/my-activity" element={<Layout><MyActivity /></Layout>} />
              <Route path="/company/activity" element={<Layout><CompanyActivity /></Layout>} />

              {/* Admin Support Routes */}
              <Route path="/admin/support" element={<Layout><SupportAdmin /></Layout>} />

            </>
          ) : (
            // Redirect unauthenticated users trying to access protected routes
            <>
              <Route path="/store-settings" element={<Navigate to="/auth/login" replace />} />
              <Route path="/settings/storefront-features" element={<Navigate to="/auth/login" replace />} />
              <Route path="/settings/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/dashboard" element={<Navigate to="/auth/login" replace />} />
              <Route path="/products/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/orders/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/customers" element={<Navigate to="/auth/login" replace />} />
              <Route path="/inventory" element={<Navigate to="/auth/login" replace />} />
              <Route path="/coupons" element={<Navigate to="/auth/login" replace />} />
              <Route path="/analytics" element={<Navigate to="/auth/login" replace />} />
              <Route path="/reports" element={<Navigate to="/auth/login" replace />} />
              <Route path="/companies" element={<Navigate to="/auth/login" replace />} />
              <Route path="/users" element={<Navigate to="/auth/login" replace />} />
              <Route path="/roles" element={<Navigate to="/auth/login" replace />} />
              <Route path="/company-dashboard" element={<Navigate to="/auth/login" replace />} />
              <Route path="/profile" element={<Navigate to="/auth/login" replace />} />
              <Route path="/advertising/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/ai-management" element={<Navigate to="/auth/login" replace />} />
              <Route path="/test-chat" element={<Navigate to="/auth/login" replace />} />
              <Route path="/invoices" element={<Navigate to="/auth/login" replace />} />
              <Route path="/payments" element={<Navigate to="/auth/login" replace />} />
              <Route path="/subscription" element={<Navigate to="/auth/login" replace />} />
              <Route path="/broadcast" element={<Navigate to="/auth/login" replace />} />
              <Route path="/reminders" element={<Navigate to="/auth/login" replace />} />
              <Route path="/notifications" element={<Navigate to="/auth/login" replace />} />
              <Route path="/notification-settings" element={<Navigate to="/auth/login" replace />} />
              <Route path="/monitoring" element={<Navigate to="/auth/login" replace />} />
              <Route path="/alert-settings" element={<Navigate to="/auth/login" replace />} />
              <Route path="/quality-test" element={<Navigate to="/auth/login" replace />} />
              <Route path="/quality-advanced" element={<Navigate to="/auth/login" replace />} />
              <Route path="/ai-quality" element={<Navigate to="/auth/login" replace />} />
              <Route path="/success-analytics" element={<Navigate to="/auth/login" replace />} />
              <Route path="/pattern-management" element={<Navigate to="/auth/login" replace />} />
              <Route path="/comments/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/unified-comments/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/posts/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/messenger-chat" element={<Navigate to="/auth/login" replace />} />
              <Route path="/conversations-improved" element={<Navigate to="/auth/login" replace />} />
              <Route path="/categories" element={<Navigate to="/auth/login" replace />} />
              <Route path="/appointments" element={<Navigate to="/auth/login" replace />} />
              <Route path="/tasks" element={<Navigate to="/auth/login" replace />} />
              <Route path="/whatsapp/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/hr/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/support/*" element={<Navigate to="/auth/login" replace />} />
              <Route path="/admin/support" element={<Navigate to="/auth/login" replace />} />
            </>
          )}
        </Routes>
      </div>
    </PerformanceOptimizer>
  );
};

// Main App component with providers
const App = () => {
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
};

export default App;