import React, { useState, useEffect } from 'react';
import {
    SparklesIcon,
    PlusIcon,
    DocumentDuplicateIcon,
    GlobeAltIcon,
    BuildingStorefrontIcon,
    ArrowPathIcon,
    TrashIcon,
    PencilIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { homepageService, HomepageTemplate } from '../services/homepageService';
import { Chip, CircularProgress } from '@mui/material';

// Mock Company Templates Data (Since we don't have an endpoint for ALL company templates yet)
const MOCK_COMPANY_TEMPLATES: HomepageTemplate[] = [
    {
        id: 'comp_1',
        companyId: 'comp_x',
        name: 'تصميم شركة "الزهور"',
        description: 'تصميم رائع لمحل ورود.',
        content: { sections: [], settings: { containerWidth: 'full', spacing: 'normal', animation: true } },
        thumbnail: 'https://placehold.co/600x400/pink/ffffff?text=Flowers',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'comp_2',
        companyId: 'comp_y',
        name: 'سوبر ماركت البركة',
        description: 'عرض منتجات كثيرة وبنرات عروض.',
        content: { sections: [], settings: { containerWidth: 'full', spacing: 'compact', animation: false } },
        thumbnail: 'https://placehold.co/600x400/orange/ffffff?text=Supermarket',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'comp_3',
        companyId: 'marketing_co',
        name: 'قالب التسويق الرقمي',
        description: 'قالب احترافي من شركة التسويق، يركز على الخدمات والعملاء.',
        content: { sections: [], settings: { containerWidth: 'full', spacing: 'relaxed', animation: true } },
        thumbnail: 'https://placehold.co/600x400/2563eb/ffffff?text=Marketing+Agency',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: 'comp_4',
        companyId: 'marketing_co',
        name: 'صفحة هبوط للمنتجات',
        description: 'تصميم صفحة هبوط (Landing Page) عالي التحويل.',
        content: { sections: [], settings: { containerWidth: 'contained', spacing: 'normal', animation: true } },
        thumbnail: 'https://placehold.co/600x400/4f46e5/ffffff?text=Landing+Page',
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
];

const SuperAdminHomepageTemplates: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'system' | 'harvest'>('system');
    const [systemTemplates, setSystemTemplates] = useState<HomepageTemplate[]>([]);
    const [companyTemplates, setCompanyTemplates] = useState<HomepageTemplate[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'system') {
                const response = await homepageService.getSystemTemplates();
                setSystemTemplates(response.data);
            } else {
                // Mock fetch for company templates
                setTimeout(() => {
                    setCompanyTemplates(MOCK_COMPANY_TEMPLATES);
                }, 500);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            toast.error('فشل تحميل القوالب');
        } finally {
            setLoading(false);
        }
    };

    const handlePromoteToSystem = async (template: HomepageTemplate) => {
        if (!confirm(`هل أنت متأكد من نسخ قالب "${template.name}" إلى مكتبة النظام العامة؟`)) return;

        try {
            setLoading(true);
            await homepageService.promoteToSystem(template.id);
            toast.success(`تم إضافة "${template.name}" إلى مكتبة النظام بنجاح!`);
            // Switch to system tab to see it (in a real app, we'd reload system templates)
            setActiveTab('system');
        } catch (error) {
            toast.error('حدث خطأ أثناء نسخ القالب');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSystemTemplate = (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا القالب من النظام؟ سيختفي من مكتبة القوالب لجميع المتاجر.')) return;
        toast.success('تم الحذف (محاكاة)');
        setSystemTemplates(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="p-6">
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <GlobeAltIcon className="h-8 w-8 text-blue-600" />
                        إدارة قوالب الصفحة الرئيسية
                    </h1>
                    <p className="mt-1 text-gray-500">
                        إدارة المكتبة العامة لقوالب التصميم، وسحب القوالب المميزة من المتاجر.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('system')}
                    className={`pb-4 px-6 text-sm font-medium transition-colors relative ${activeTab === 'system'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="h-5 w-5" />
                        مكتبة النظام (System Templates)
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('harvest')}
                    className={`pb-4 px-6 text-sm font-medium transition-colors relative ${activeTab === 'harvest'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <BuildingStorefrontIcon className="h-5 w-5" />
                        قوالب المتاجر (Harvesting)
                    </div>
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <CircularProgress />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeTab === 'system' && systemTemplates.map(template => (
                        <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="relative h-48 bg-gray-100">
                                <img
                                    src={template.thumbnail || 'https://via.placeholder.com/400x200'}
                                    className="w-full h-full object-cover"
                                    alt={template.name}
                                />
                                <div className="absolute top-2 right-2">
                                    <Chip label="نظام" color="primary" size="small" />
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-lg mb-1">{template.name}</h3>
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>
                                <div className="flex gap-2">
                                    <button
                                        className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center justify-center gap-1"
                                        onClick={() => toast('سيتم فتح المحرر للتعديل على قالب النظام', { icon: '🚧' })}
                                    >
                                        <PencilIcon className="h-4 w-4" />
                                        تعديل
                                    </button>
                                    <button
                                        className="px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100"
                                        onClick={() => handleDeleteSystemTemplate(template.id)}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'harvest' && companyTemplates.map(template => (
                        <div key={template.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="relative h-48 bg-gray-100">
                                <img
                                    src={template.thumbnail || 'https://via.placeholder.com/400x200'}
                                    className="w-full h-full object-cover"
                                    alt={template.name}
                                />
                                <div className="absolute top-2 right-2">
                                    <Chip
                                        label={template.companyId === 'marketing_co' ? 'شركة التسويق' : template.companyId === 'comp_x' ? 'الزهور' : template.companyId === 'comp_y' ? 'البركة' : template.companyId}
                                        variant="outlined"
                                        size="small"
                                        className="bg-white"
                                    />
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-lg mb-1">{template.name}</h3>
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{template.description}</p>
                                <button
                                    onClick={() => handlePromoteToSystem(template)}
                                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center justify-center gap-2"
                                >
                                    <ArrowPathIcon className="h-4 w-4" />
                                    نسخ إلى النظام (Promote)
                                </button>
                            </div>
                        </div>
                    ))}

                    {activeTab === 'system' && systemTemplates.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            لا توجد قوالب نظام حالياً.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SuperAdminHomepageTemplates;
