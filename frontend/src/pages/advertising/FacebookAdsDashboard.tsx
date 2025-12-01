/**
 * Facebook Ads Dashboard
 * 
 * لوحة تحكم لإدارة إعلانات Facebook
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  PlusIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingCartIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { 
  facebookAdsService,
  FacebookCampaign,
  CAMPAIGN_OBJECTIVES 
} from '../../services/facebookAdsService';

const FacebookAdsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<FacebookCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load campaigns on mount
  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await facebookAdsService.getCampaigns();
      setCampaigns(data);
    } catch (error: any) {
      console.error('Error loading campaigns:', error);
      toast.error(error?.response?.data?.error || 'فشل في تحميل الحملات');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCampaigns();
    setRefreshing(false);
    toast.success('تم تحديث البيانات');
  };

  const handleCreateCampaign = () => {
    navigate('/advertising/facebook-ads/campaigns/create');
  };

  const handleCreateFullAd = () => {
    navigate('/advertising/facebook-ads/create-ad');
  };

  const handleViewCampaign = (id: string) => {
    navigate(`/advertising/facebook-ads/campaigns/${id}`);
  };

  const handlePauseCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await facebookAdsService.pauseCampaign(id);
      toast.success('تم إيقاف الحملة');
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'فشل في إيقاف الحملة');
    }
  };

  const handleResumeCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await facebookAdsService.resumeCampaign(id);
      toast.success('تم استئناف الحملة');
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'فشل في استئناف الحملة');
    }
  };

  const handleDeleteCampaign = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذه الحملة؟')) {
      return;
    }
    
    try {
      await facebookAdsService.deleteCampaign(id);
      toast.success('تم حذف الحملة');
      await loadCampaigns();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'فشل في حذف الحملة');
    }
  };

  // Calculate statistics
  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'ACTIVE').length,
    paused: campaigns.filter(c => c.status === 'PAUSED').length,
    totalBudget: campaigns.reduce((sum, c) => sum + c.budgetAmount, 0),
  };

  const getObjectiveLabel = (objective: string) => {
    const obj = CAMPAIGN_OBJECTIVES.find(o => o.value === objective);
    return obj?.label || objective;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      ACTIVE: 'bg-green-100 text-green-800',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      ARCHIVED: 'bg-gray-100 text-gray-800',
      DELETED: 'bg-red-100 text-red-800',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      ACTIVE: 'نشط',
      PAUSED: 'متوقف',
      ARCHIVED: 'مؤرشف',
      DELETED: 'محذوف',
    };
    return labels[status as keyof typeof labels] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">إدارة إعلانات Facebook</h1>
          <p className="mt-2 text-sm text-gray-600">
            أنشئ وأدر حملاتك الإعلانية على Facebook مباشرة من هنا
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={handleCreateCampaign}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <PlusIcon className="w-5 h-5" />
            حملة فقط
          </button>
          <button
            onClick={handleCreateFullAd}
            className="flex items-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-lg"
          >
            <PlusIcon className="w-5 h-5" />
            🚀 إنشاء إعلان كامل
          </button>
        </div>
      </div>

      {/* Quick Actions - Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/advertising/facebook-ads/audiences')}
          className="p-4 bg-white rounded-xl shadow hover:shadow-md transition-all text-right"
        >
          <UserGroupIcon className="w-8 h-8 text-purple-500 mb-2" />
          <h3 className="font-medium text-gray-900">الجماهير</h3>
          <p className="text-sm text-gray-500">إدارة الجماهير المستهدفة</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/automation-rules')}
          className="p-4 bg-white rounded-xl shadow hover:shadow-md transition-all text-right"
        >
          <ChartBarIcon className="w-8 h-8 text-yellow-500 mb-2" />
          <h3 className="font-medium text-gray-900">قواعد الأتمتة</h3>
          <p className="text-sm text-gray-500">أتمتة إدارة الحملات</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/reports')}
          className="p-4 bg-white rounded-xl shadow hover:shadow-md transition-all text-right"
        >
          <EyeIcon className="w-8 h-8 text-blue-500 mb-2" />
          <h3 className="font-medium text-gray-900">التقارير</h3>
          <p className="text-sm text-gray-500">تقارير الأداء المتقدمة</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/catalogs')}
          className="p-4 bg-white rounded-xl shadow hover:shadow-md transition-all text-right"
        >
          <ShoppingCartIcon className="w-8 h-8 text-green-500 mb-2" />
          <h3 className="font-medium text-gray-900">الكتالوجات</h3>
          <p className="text-sm text-gray-500">إدارة كتالوجات المنتجات</p>
        </button>
      </div>

      {/* Quick Actions - Row 2 (v22.0 Features) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <button
          onClick={() => navigate('/advertising/facebook-ads/lead-forms')}
          className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow hover:shadow-md transition-all text-right border border-blue-100"
        >
          <span className="text-2xl mb-2 block">📋</span>
          <h3 className="font-medium text-gray-900">نماذج Lead</h3>
          <p className="text-xs text-gray-500">جمع بيانات العملاء</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/dco')}
          className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow hover:shadow-md transition-all text-right border border-purple-100"
        >
          <span className="text-2xl mb-2 block">✨</span>
          <h3 className="font-medium text-gray-900">DCO</h3>
          <p className="text-xs text-gray-500">تحسين ديناميكي</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/advantage-plus')}
          className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow hover:shadow-md transition-all text-right border border-green-100"
        >
          <span className="text-2xl mb-2 block">🛒</span>
          <h3 className="font-medium text-gray-900">Advantage+</h3>
          <p className="text-xs text-gray-500">حملات تسوق ذكية</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/conversions')}
          className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl shadow hover:shadow-md transition-all text-right border border-orange-100"
        >
          <span className="text-2xl mb-2 block">📊</span>
          <h3 className="font-medium text-gray-900">CAPI</h3>
          <p className="text-xs text-gray-500">تتبع التحويلات</p>
        </button>
        <button
          onClick={() => navigate('/advertising/facebook-ads/creative-formats')}
          className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl shadow hover:shadow-md transition-all text-right border border-pink-100"
        >
          <span className="text-2xl mb-2 block">🎬</span>
          <h3 className="font-medium text-gray-900">تنسيقات</h3>
          <p className="text-xs text-gray-500">Stories & Reels</p>
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي الحملات</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">حملات نشطة</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <PlayIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">حملات متوقفة</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.paused}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <PauseIcon className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">إجمالي الميزانية</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.totalBudget.toLocaleString()} {campaigns[0]?.adAccountId ? 'EGP' : ''}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">الحملات الإعلانية</h2>
        </div>

        {campaigns.length === 0 ? (
          <div className="p-12 text-center">
            <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد حملات إعلانية</h3>
            <p className="text-gray-600 mb-6">ابدأ بإنشاء حملة إعلانية جديدة</p>
            <button
              onClick={handleCreateCampaign}
              className="inline-flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <PlusIcon className="w-5 h-5" />
              إنشاء حملة جديدة
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => handleViewCampaign(campaign.id)}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(campaign.status)}`}>
                        {getStatusLabel(campaign.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <span>
                        <span className="font-medium">الهدف:</span> {getObjectiveLabel(campaign.objective)}
                      </span>
                      <span>
                        <span className="font-medium">الميزانية:</span> {campaign.budgetAmount.toLocaleString()} {campaign.budgetType === 'DAILY' ? 'EGP/يوم' : 'EGP'}
                      </span>
                      {campaign.startDate && (
                        <span>
                          <span className="font-medium">تاريخ البدء:</span> {new Date(campaign.startDate).toLocaleDateString('ar-EG')}
                        </span>
                      )}
                    </div>
                    {campaign.adSets && campaign.adSets.length > 0 && (
                      <div className="mt-2 text-sm text-gray-500">
                        {campaign.adSets.length} مجموعة إعلانات
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'ACTIVE' ? (
                      <button
                        onClick={(e) => handlePauseCampaign(campaign.id, e)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                        title="إيقاف"
                      >
                        <PauseIcon className="w-5 h-5" />
                      </button>
                    ) : campaign.status === 'PAUSED' ? (
                      <button
                        onClick={(e) => handleResumeCampaign(campaign.id, e)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="استئناف"
                      >
                        <PlayIcon className="w-5 h-5" />
                      </button>
                    ) : null}
                    <button
                      onClick={(e) => handleDeleteCampaign(campaign.id, e)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="حذف"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FacebookAdsDashboard;

