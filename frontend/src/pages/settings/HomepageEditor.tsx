import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  HomeIcon,
  ArrowLeftIcon,
  EyeIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { homepageService, HomepageContent, HomepageSection } from '../../services/homepageService';

const HomepageEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState<HomepageContent>({
    sections: [],
    settings: {
      containerWidth: 'full',
      spacing: 'normal',
      animation: true,
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode && id) {
      loadTemplate();
    }
  }, [id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await homepageService.getTemplates();
      const templates = response.data.data || [];
      const template = templates.find((t: any) => t.id === id);
      
      if (template) {
        setName(template.name);
        setDescription(template.description || '');
        setContent(typeof template.content === 'string' ? JSON.parse(template.content) : template.content);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast.error('فشل تحميل القالب');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم الصفحة');
      return;
    }

    try {
      setSaving(true);
      const data = {
        name,
        description,
        content,
      };

      if (isEditMode && id) {
        await homepageService.updateTemplate(id, data);
        toast.success('تم تحديث الصفحة بنجاح');
      } else {
        await homepageService.createTemplate(data);
        toast.success('تم إنشاء الصفحة بنجاح');
      }
      
      navigate('/settings/homepage');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('فشل حفظ الصفحة');
    } finally {
      setSaving(false);
    }
  };

  const addSection = (type: HomepageSection['type']) => {
    const newSection: HomepageSection = {
      id: `section-${Date.now()}`,
      type,
      title: getSectionDefaultTitle(type),
    };

    setContent({
      ...content,
      sections: [...content.sections, newSection],
    });
  };

  const getSectionDefaultTitle = (type: HomepageSection['type']): string => {
    const titles: Record<HomepageSection['type'], string> = {
      hero: 'قسم البطل',
      features: 'المميزات',
      products: 'المنتجات',
      banner: 'بانر إعلاني',
      categories: 'الفئات',
      testimonials: 'آراء العملاء',
      custom: 'قسم مخصص',
    };
    return titles[type];
  };

  const removeSection = (sectionId: string) => {
    setContent({
      ...content,
      sections: content.sections.filter((s) => s.id !== sectionId),
    });
    if (selectedSection === sectionId) {
      setSelectedSection(null);
    }
  };

  const moveSectionUp = (index: number) => {
    if (index === 0) return;
    const newSections = [...content.sections];
    const temp = newSections[index - 1]!;
    newSections[index - 1] = newSections[index]!;
    newSections[index] = temp;
    setContent({ ...content, sections: newSections });
  };

  const moveSectionDown = (index: number) => {
    if (index === content.sections.length - 1) return;
    const newSections = [...content.sections];
    const temp = newSections[index]!;
    newSections[index] = newSections[index + 1]!;
    newSections[index + 1] = temp;
    setContent({ ...content, sections: newSections });
  };

  const updateSection = (sectionId: string, updates: Partial<HomepageSection>) => {
    setContent({
      ...content,
      sections: content.sections.map((s) =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  };

  const sectionTypes = [
    { type: 'hero' as const, label: 'قسم البطل', icon: '🎯', description: 'صورة كبيرة مع عنوان وزر' },
    { type: 'features' as const, label: 'المميزات', icon: '⭐', description: 'عرض مميزات المتجر' },
    { type: 'products' as const, label: 'المنتجات', icon: '🛍️', description: 'عرض المنتجات المميزة' },
    { type: 'banner' as const, label: 'بانر', icon: '📢', description: 'بانر إعلاني' },
    { type: 'categories' as const, label: 'الفئات', icon: '📁', description: 'عرض فئات المنتجات' },
    { type: 'testimonials' as const, label: 'التقييمات', icon: '💬', description: 'آراء العملاء' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/settings/homepage')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center">
                  <HomeIcon className="h-6 w-6 text-indigo-600 ml-2" />
                  {isEditMode ? 'تعديل الصفحة الرئيسية' : 'إنشاء صفحة رئيسية جديدة'}
                </h1>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.open(`/preview/homepage/${id || 'new'}`, '_blank')}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <EyeIcon className="h-5 w-5 ml-2" />
                معاينة
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                <CheckIcon className="h-5 w-5 ml-2" />
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">معلومات الصفحة</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    اسم الصفحة *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="مثال: الصفحة الرئيسية الجديدة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الوصف
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="وصف مختصر للصفحة..."
                  />
                </div>
              </div>
            </div>

            {/* Add Sections */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <PlusIcon className="h-5 w-5 ml-2 text-indigo-600" />
                إضافة أقسام
              </h3>
              <div className="space-y-2">
                {sectionTypes.map((section) => (
                  <button
                    key={section.type}
                    onClick={() => addSection(section.type)}
                    className="w-full text-right px-4 py-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center">
                      <span className="text-2xl ml-3">{section.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 group-hover:text-indigo-600">
                          {section.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {section.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Page Settings */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Cog6ToothIcon className="h-5 w-5 ml-2 text-indigo-600" />
                إعدادات الصفحة
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    عرض الحاوية
                  </label>
                  <select
                    value={content.settings.containerWidth}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        settings: {
                          ...content.settings,
                          containerWidth: e.target.value as 'full' | 'contained',
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="full">عرض كامل</option>
                    <option value="contained">محدود</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المسافات
                  </label>
                  <select
                    value={content.settings.spacing}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        settings: {
                          ...content.settings,
                          spacing: e.target.value as 'compact' | 'normal' | 'relaxed',
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="compact">مضغوط</option>
                    <option value="normal">عادي</option>
                    <option value="relaxed">واسع</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    تفعيل الحركات
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={content.settings.animation}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          settings: {
                            ...content.settings,
                            animation: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Sections */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                أقسام الصفحة ({content.sections.length})
              </h3>
              
              {content.sections.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <HomeIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">لا توجد أقسام بعد</p>
                  <p className="text-sm text-gray-500">
                    ابدأ بإضافة أقسام من القائمة الجانبية
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {content.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className={`border rounded-lg p-4 transition-all ${
                        selectedSection === section.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {sectionTypes.find((t) => t.type === section.type)?.icon}
                          </span>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {section['title'] || getSectionDefaultTitle(section.type)}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {sectionTypes.find((t) => t.type === section.type)?.label}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => moveSectionUp(index)}
                            disabled={index === 0}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30"
                            title="تحريك لأعلى"
                          >
                            <ArrowUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveSectionDown(index)}
                            disabled={index === content.sections.length - 1}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30"
                            title="تحريك لأسفل"
                          >
                            <ArrowDownIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setSelectedSection(
                                selectedSection === section.id ? null : section.id
                              )
                            }
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-100 rounded"
                            title="تعديل"
                          >
                            <Cog6ToothIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeSection(section.id)}
                            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-100 rounded"
                            title="حذف"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Section Settings */}
                      {selectedSection === section.id && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                عنوان القسم
                              </label>
                              <input
                                type="text"
                                value={section['title'] || ''}
                                onChange={(e) =>
                                  updateSection(section.id, { title: e.target.value })
                                }
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <p className="text-xs text-gray-500">
                              💡 يمكنك تخصيص إعدادات إضافية لكل قسم بعد الحفظ
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomepageEditor;
