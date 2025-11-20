import React, { useState, useEffect } from 'react';
import {
  CogIcon,
  ChartBarIcon,
  BoltIcon,
  ClockIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  TrashIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/react/24/outline';
import { companyAwareApi } from '../../services/companyAwareApi';
import { useAuth } from '../../hooks/useAuthSimple';
import { buildApiUrl } from '../../utils/urlHelper';

// Add custom CSS for better styling
const customStyles = `
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

interface AISettings {
  isEnabled: boolean;
  workingHours: {
    start: string;
    end: string;
  };
  workingHoursEnabled: boolean;
  maxRepliesPerCustomer: number;
  escalationKeywords: string[];
  responseDelay: number;
  confidenceThreshold: number;
  memoryRetentionDays: number;
  multimodalEnabled: boolean;
  ragEnabled: boolean;
  qualityEvaluationEnabled: boolean;
  replyMode: 'new_only' | 'all'; // ✅ NEW: Reply mode setting
}

interface QueueSettings {
  batchWaitTime: number;
  enabled: boolean;
  maxBatchSize: number;
  description: string;
}

interface PrioritySettings {
  promptPriority: 'high' | 'medium' | 'low';
  patternsPriority: 'high' | 'medium' | 'low';
  conflictResolution: 'prompt_wins' | 'patterns_win' | 'merge_smart';
  enforcePersonality: boolean;
  enforceLanguageStyle: boolean;
  autoDetectConflicts: boolean;
  conflictReports: boolean;
}

interface AdvancedAISettings {
  // إعدادات التوليد
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  responseStyle: 'formal' | 'casual' | 'balanced';
  
  // إعدادات السلوك الذكي
  enableDiversityCheck: boolean;
  enableToneAdaptation: boolean;
  enableEmotionalResponse: boolean;
  enableSmartSuggestions: boolean;
  enableLongTermMemory: boolean;
  
  // إعدادات متقدمة
  maxMessagesPerConversation: number;
  memoryRetentionDays: number;
  enablePatternApplication: boolean;
  patternPriority: 'prompt' | 'balanced' | 'patterns';
  
  // إعدادات الجودة
  minQualityScore: number;
  enableLowQualityAlerts: boolean;
}

interface GeminiKeyModel {
  id: string;
  model: string;
  usage: {
    used: number;
    limit: number;
    resetDate?: string;
  };
  isEnabled: boolean;
  priority: number;
  lastUsed?: string;
}

interface GeminiKey {
  id: string;
  name: string;
  apiKey: string;
  isActive: boolean;
  priority: number;
  description?: string;
  usage: {
    used: number;
    limit: number;
  };
  model: string; // للتوافق مع النظام القديم
  models: GeminiKeyModel[]; // النماذج الجديدة
  totalModels: number;
  availableModels: number;
  createdAt: string;
}

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  category: string;
  createdAt: string;
}

interface MemorySettings {
  retentionDays: number;
  maxConversationsPerUser: number;
  maxMessagesPerConversation: number;
  autoCleanup: boolean;
  compressionEnabled: boolean;
}

interface MemoryStats {
  totalMemories: number;
  totalMessages: number;
  totalCustomers: number;
  shortTermMemorySize: number;
  retentionDays: number;
}

interface AIStats {
  totalMessages: number;
  aiResponses: number;
  humanHandoffs: number;
  avgResponseTime: number;
  avgConfidence: number;
  topIntents: Array<{ intent: string; count: number }>;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

const AIManagement: React.FC = () => {
  // Authentication
  const { user, isAuthenticated } = useAuth();

  // All useState hooks must be called before any conditional returns
  const [settings, setSettings] = useState<AISettings>({
    isEnabled: true,
    workingHours: { start: '09:00', end: '18:00' },
    workingHoursEnabled: false,
    maxRepliesPerCustomer: 5,
    escalationKeywords: ['شكوى', 'مشكلة', 'غاضب', 'مدير'],
    responseDelay: 2000,
    confidenceThreshold: 0.7,
    memoryRetentionDays: 30,
    multimodalEnabled: true,
    ragEnabled: true,
    qualityEvaluationEnabled: true,
    replyMode: 'all' // ✅ Default: reply to all conversations
  });

  const [geminiKeys, setGeminiKeys] = useState<GeminiKey[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [memorySettings, setMemorySettings] = useState<MemorySettings>({
    retentionDays: 30,
    maxConversationsPerUser: 100,
    maxMessagesPerConversation: 50,
    autoCleanup: true,
    compressionEnabled: false
  });

  const [prioritySettings, setPrioritySettings] = useState<PrioritySettings>({
    promptPriority: 'high',
    patternsPriority: 'medium',
    conflictResolution: 'merge_smart',
    enforcePersonality: true,
    enforceLanguageStyle: true,
    autoDetectConflicts: true,
    conflictReports: true
  });

  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    totalMemories: 0,
    totalMessages: 0,
    totalCustomers: 0,
    shortTermMemorySize: 0,
    retentionDays: 30
  });

  const [newGeminiKey, setNewGeminiKey] = useState({
    name: '',
    apiKey: '',
    description: '',
    model: 'gemini-2.5-flash' // Add default model
  });

  const [newPrompt, setNewPrompt] = useState({
    name: '',
    content: '',
    category: 'general'
  });

  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [editPromptData, setEditPromptData] = useState({
    name: '',
    content: '',
    category: 'general'
  });

  const [availableModels, setAvailableModels] = useState([
    // أحدث نماذج Gemini 2025
    'gemini-2.5-pro',                              // الأقوى - للمهام المعقدة
    'gemini-2.5-flash',                            // الأفضل سعر/أداء
    'gemini-2.5-flash-lite',                       // الأسرع والأوفر
    'gemini-2.5-flash-preview-native-audio-dialog', // صوت تفاعلي
    'gemini-2.5-flash-exp-native-audio-thinking-dialog', // صوت مع تفكير
    'gemini-2.5-flash-preview-tts',                // تحويل نص لصوت
    'gemini-2.5-pro-preview-tts',                  // تحويل نص لصوت متقدم

    // نماذج Gemini 2.0
    'gemini-2.0-flash',                            // الجيل الثاني
    'gemini-2.0-flash-lite',                       // نسخة خفيفة
    'gemini-2.0-flash-preview-image-generation',   // توليد صور
    'gemini-2.0-flash-live-001',                   // تفاعل مباشر

    // نماذج Gemini 1.5 (قديمة لكن مستقرة)
    'gemini-1.5-pro',                              // مستقر للمهام المعقدة
    'gemini-1.5-flash',                            // مستقر سريع
    'gemini-1.5-flash-8b',                         // خفيف للمهام البسيطة

    // نماذج Live API
    'gemini-live-2.5-flash-preview',               // تفاعل مباشر 2.5

    // نماذج التضمين
    'gemini-embedding-001',                        // للبحث والتشابه
    'text-embedding-004'                           // قديم لكن مستقر
  ]);

  const [stats, setStats] = useState<AIStats>({
    totalMessages: 0,
    aiResponses: 0,
    humanHandoffs: 0,
    avgResponseTime: 0,
    avgConfidence: 0,
    topIntents: [],
    sentimentDistribution: { positive: 0, neutral: 0, negative: 0 }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ai-settings');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editModel, setEditModel] = useState('');
  const [geminiEnabled, setGeminiEnabled] = useState(false);
  const [showAddGeminiKeyModal, setShowAddGeminiKeyModal] = useState(false);
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);

  // Add these missing state setters
  const closeAddGeminiKeyModal = () => setShowAddGeminiKeyModal(false);
  const openAddGeminiKeyModal = () => setShowAddGeminiKeyModal(true);

  const handleAddGeminiKey = async () => {
    if (!newGeminiKey.name || !newGeminiKey.apiKey) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      const response = await companyAwareApi.post('/ai/gemini-keys', newGeminiKey);
      const data = response.data;

      if (data.success) {
        alert('تم إضافة مفتاح Gemini بنجاح! ✅');
        setNewGeminiKey({ name: '', apiKey: '', description: '', model: 'gemini-2.5-flash' });
        closeAddGeminiKeyModal();
        loadGeminiKeys();
      } else {
        // Enhanced error handling for duplicate keys
        if (data.errorCode === 'DUPLICATE_API_KEY') {
          // Show detailed Arabic duplicate key message
          const message = data.details?.arabic || data.message || data.error;
          const suggestion = data.details?.suggestion ? `\n\n💡 ${data.details.suggestion}` : '';
          alert(`❌ ${message}${suggestion}`);
        } else {
          alert(`خطأ في إضافة المفتاح: ${data.error || 'خطأ غير معروف'}`);
        }
      }
    } catch (error: any) {
      console.error('Error adding Gemini key:', error);
      
      // Handle network/HTTP errors that might contain our enhanced error response
      if (error.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'DUPLICATE_API_KEY') {
          // Show detailed Arabic duplicate key message from error response
          const message = errorData.details?.arabic || errorData.message || errorData.error;
          const suggestion = errorData.details?.suggestion ? `\n\n💡 ${errorData.details.suggestion}` : '';
          alert(`❌ ${message}${suggestion}`);
        } else {
          alert(`خطأ في إضافة المفتاح: ${errorData.error || errorData.message || 'خطأ في الاتصال بالخادم'}`);
        }
      } else {
        alert('خطأ في إضافة المفتاح - تحقق من الاتصال بالإنترنت');
      }
    }
  };

  // AI Settings Prompts State
  const [aiPrompts, setAiPrompts] = useState({
    personalityPrompt: '',
    responsePrompt: ''
  });
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsSaving, setPromptsSaving] = useState(false);

  // Queue Settings State
  const [queueSettings, setQueueSettings] = useState<QueueSettings>({
    batchWaitTime: 5000,
    enabled: true,
    maxBatchSize: 10,
    description: 'إعدادات تجميع الرسائل المتتالية'
  });
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSaving, setQueueSaving] = useState(false);

  // ✨ Advanced AI Settings State (NEW)
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedAISettings>({
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    maxTokens: 1024,
    responseStyle: 'balanced',
    enableDiversityCheck: true,
    enableToneAdaptation: true,
    enableEmotionalResponse: true,
    enableSmartSuggestions: false,
    enableLongTermMemory: false,
    maxMessagesPerConversation: 50,
    memoryRetentionDays: 30,
    enablePatternApplication: true,
    patternPriority: 'balanced',
    minQualityScore: 70,
    enableLowQualityAlerts: true,
  });
  const [advancedLoading, setAdvancedLoading] = useState(false);
  const [advancedSaving, setAdvancedSaving] = useState(false);

  const loadAISettings = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping AI settings load');
        return;
      }

      const response = await companyAwareApi.get('/settings/ai');
      const data = response.data;

      if (data.success && data.data) {
        const aiSettings = data.data;
        setSettings(prev => ({
          ...prev,
          isEnabled: aiSettings.autoReplyEnabled || false,
          confidenceThreshold: aiSettings.confidenceThreshold || 0.7,
          multimodalEnabled: aiSettings.multimodalEnabled !== false,
          ragEnabled: aiSettings.ragEnabled !== false,
          qualityEvaluationEnabled: aiSettings.qualityEvaluationEnabled !== false,
          replyMode: aiSettings.replyMode || 'all' // ✅ Load reply mode
        }));
        console.log('✅ AI Settings loaded:', aiSettings);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
      // Fallback to default
      setSettings(prev => ({
        ...prev,
        qualityEvaluationEnabled: true
      }));
    }
  };

  // ✨ Load Advanced AI Settings (NEW)
  const loadAdvancedSettings = async () => {
    try {
      setAdvancedLoading(true);
      const response = await companyAwareApi.get('/settings/ai');
      
      if (response.data.success && response.data.data) {
        const settings = response.data.data;
        setAdvancedSettings({
          temperature: settings.aiTemperature ?? 0.7,
          topP: settings.aiTopP ?? 0.9,
          topK: settings.aiTopK ?? 40,
          maxTokens: settings.aiMaxTokens ?? 1024,
          responseStyle: settings.aiResponseStyle || 'balanced',
          enableDiversityCheck: settings.enableDiversityCheck !== false,
          enableToneAdaptation: settings.enableToneAdaptation !== false,
          enableEmotionalResponse: settings.enableEmotionalResponse !== false,
          enableSmartSuggestions: settings.enableSmartSuggestions || false,
          enableLongTermMemory: settings.enableLongTermMemory || false,
          maxMessagesPerConversation: settings.maxMessagesPerConversation || 50,
          memoryRetentionDays: settings.memoryRetentionDays || 30,
          enablePatternApplication: settings.enablePatternApplication !== false,
          patternPriority: settings.patternPriority || 'balanced',
          minQualityScore: settings.minQualityScore ?? 70,
          enableLowQualityAlerts: settings.enableLowQualityAlerts !== false,
        });
      }
    } catch (error) {
      console.error('Error loading advanced settings:', error);
    } finally {
      setAdvancedLoading(false);
    }
  };

  // ✨ Save Advanced AI Settings (NEW)
  const saveAdvancedSettings = async () => {
    try {
      setAdvancedSaving(true);
      const response = await companyAwareApi.put('/settings/ai', {
        aiTemperature: advancedSettings.temperature,
        aiTopP: advancedSettings.topP,
        aiTopK: advancedSettings.topK,
        aiMaxTokens: advancedSettings.maxTokens,
        aiResponseStyle: advancedSettings.responseStyle,
        enableDiversityCheck: advancedSettings.enableDiversityCheck,
        enableToneAdaptation: advancedSettings.enableToneAdaptation,
        enableEmotionalResponse: advancedSettings.enableEmotionalResponse,
        enableSmartSuggestions: advancedSettings.enableSmartSuggestions,
        enableLongTermMemory: advancedSettings.enableLongTermMemory,
        maxMessagesPerConversation: advancedSettings.maxMessagesPerConversation,
        memoryRetentionDays: advancedSettings.memoryRetentionDays,
        enablePatternApplication: advancedSettings.enablePatternApplication,
        patternPriority: advancedSettings.patternPriority,
        minQualityScore: advancedSettings.minQualityScore,
        enableLowQualityAlerts: advancedSettings.enableLowQualityAlerts,
      });

      if (response.data.success) {
        alert('✅ تم حفظ الإعدادات المتقدمة بنجاح');
      }
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      alert('❌ خطأ في حفظ الإعدادات المتقدمة');
    } finally {
      setAdvancedSaving(false);
    }
  };

  useEffect(() => {
    // Only load data if user is authenticated
    if (isAuthenticated && user) {
      loadSettings();
      loadStats();
      loadGeminiKeys();
      loadSystemPrompts();
      loadMemorySettings();
      loadMemoryStats();
      checkAvailableModels();
      loadAISettings();
      loadAIPrompts(); // Load AI Settings Prompts
      loadQueueSettings(); // Load Queue Settings
      loadAdvancedSettings(); // ✨ Load Advanced AI Settings
    }
  }, [isAuthenticated, user]);

  const loadSettings = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping settings load');
        return;
      }

      setLoading(true);
      const response = await companyAwareApi.get('/settings/ai');
      const data = response.data;

      if (data.success) {
        // Map the database fields to component state
        setSettings(prev => ({
          ...prev,
          isEnabled: data.data.autoReplyEnabled || false,
          confidenceThreshold: data.data.confidenceThreshold || 0.7,
          multimodalEnabled: data.data.multimodalEnabled !== false,
          ragEnabled: data.data.ragEnabled !== false,
          qualityEvaluationEnabled: data.data.qualityEvaluationEnabled !== false
        }));
        console.log('✅ Settings loaded from database:', data.data);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping stats load');
        return;
      }

      const response = await companyAwareApi.get('/ai/stats');
      const data = response.data;

      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error loading AI stats:', error);
    }
  };

  const saveSettings = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      setSaving(true);

      // 🔍 DEBUG: Log what we're sending
      const requestData = {
        autoReplyEnabled: settings.isEnabled,
        confidenceThreshold: settings.confidenceThreshold,
        multimodalEnabled: settings.multimodalEnabled,
        ragEnabled: settings.ragEnabled,
        qualityEvaluationEnabled: settings.qualityEvaluationEnabled,
        replyMode: settings.replyMode // ✅ Save reply mode
      };
      console.log('🔍 [FRONTEND] Saving AI settings with replyMode:', settings.replyMode);
      console.log('🔍 [FRONTEND] Full request data:', requestData);

      const response = await companyAwareApi.put('/settings/ai', requestData);

      const data = response.data;

      if (data.success) {
        alert('تم حفظ الإعدادات بنجاح! ✅');
        console.log('✅ AI Settings saved:', data.data);
      } else {
        alert('حدث خطأ في حفظ الإعدادات ❌');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ في حفظ الإعدادات ❌');
    } finally {
      setSaving(false);
    }
  };

  const toggleAI = async () => {
    const newSettings = { ...settings, isEnabled: !settings.isEnabled };
    setSettings(newSettings);

    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        setSettings(settings); // Revert
        return;
      }

      // Use the same endpoint as saveSettings for consistency
      const response = await companyAwareApi.put('/settings/ai', {
        autoReplyEnabled: newSettings.isEnabled,
        confidenceThreshold: settings.confidenceThreshold,
        multimodalEnabled: settings.multimodalEnabled,
        ragEnabled: settings.ragEnabled,
        qualityEvaluationEnabled: settings.qualityEvaluationEnabled
      });

      const data = response.data;
      if (data.success) {
        console.log('✅ AI toggle saved to database:', data.data);
      } else {
        console.error('❌ Failed to save AI toggle:', data);
        // Revert the change if save failed
        setSettings(settings);
      }
    } catch (error) {
      console.error('Error toggling AI:', error);
      // Revert the change if request failed
      setSettings(settings);
    }
  };

  const clearMemory = async () => {
    if (confirm('هل أنت متأكد من مسح جميع ذاكرة المحادثات؟')) {
      try {
        if (!isAuthenticated) {
          alert('يجب تسجيل الدخول أولاً');
          return;
        }

        const response = await companyAwareApi.delete('/ai/memory/clear');

        if (response.data.success) {
          alert('تم مسح الذاكرة بنجاح! 🧹');
          loadStats();
          loadMemoryStats();
        }
      } catch (error) {
        console.error('Error clearing memory:', error);
        alert('حدث خطأ في مسح الذاكرة ❌');
      }
    }
  };

  const updateKnowledgeBase = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      setLoading(true);
      console.log('📚 Updating knowledge base...');

      const response = await companyAwareApi.post('/ai/knowledge-base/update');

      if (response.data.success) {
        alert('تم تحديث قاعدة المعرفة بنجاح! 📚');
      } else {
        alert(`خطأ في تحديث قاعدة المعرفة: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error updating knowledge base:', error);
      alert('حدث خطأ في تحديث قاعدة المعرفة');
    } finally {
      setLoading(false);
    }
  };

  // Priority Settings Functions
  const savePrioritySettings = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      setLoading(true);
      console.log('💾 Saving priority settings:', prioritySettings);

      const response = await companyAwareApi.put('/ai/priority-settings', prioritySettings);

      if (response.data.success) {
        alert('✅ تم حفظ إعدادات الأولوية بنجاح!');
      } else {
        alert(`❌ خطأ في حفظ الإعدادات: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error saving priority settings:', error);
      alert('❌ حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const resetPrioritySettings = () => {
    setPrioritySettings({
      promptPriority: 'high',
      patternsPriority: 'medium',
      conflictResolution: 'merge_smart',
      enforcePersonality: true,
      enforceLanguageStyle: true,
      autoDetectConflicts: true,
      conflictReports: true
    });
    alert('🔄 تم إعادة تعيين الإعدادات للقيم الافتراضية');
  };

  const testConflictDetection = async () => {
    try {
      setLoading(true);

      // الحصول على البرونت النشط
      const activePrompt = systemPrompts.find(p => p.isActive);
      if (!activePrompt) {
        alert('❌ لا يوجد برونت نشط للاختبار');
        return;
      }

      // إنشاء أنماط تجريبية للاختبار
      const testPatterns = [
        {
          type: 'word_usage',
          pattern: {
            successfulWords: ['بالطبع', 'يسعدني', 'أهلاً وسهلاً'],
            failureWords: ['للأسف', 'غير متوفر']
          }
        },
        {
          type: 'response_style',
          pattern: {
            preferredLength: 25,
            style: 'detailed'
          }
        }
      ];

      const response = await companyAwareApi.post('/priority-settings/test-conflict', {
        prompt: activePrompt.content,
        patterns: testPatterns
      });

      const data = response.data;

      if (data.success) {
        let conflictMessage = '';
        if (data.data.hasConflicts) {
          conflictMessage = `⚠️ تم اكتشاف ${data.data.conflictsCount} تعارض بشدة ${data.data.severity}\n\nالتعارضات:\n`;
          data.data.conflicts.forEach((c: any) => {
            conflictMessage += `- ${c.description}\n`;
          });
          conflictMessage += '\nالتوصيات:\n';
          data.data.recommendations.forEach((r: any) => {
            conflictMessage += `- ${r.action}\n`;
          });
        } else {
          conflictMessage = '✅ لا يوجد تعارض بين البرونت والأنماط المختبرة';
        }

        alert(conflictMessage);
      } else {
        alert(`❌ خطأ في اختبار كشف التعارض: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error testing conflict detection:', error);
      alert('❌ حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // Gemini Keys Management
  const loadGeminiKeys = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping Gemini keys load');
        return;
      }

      console.log('🔄 Loading Gemini keys...');
      const response = await companyAwareApi.get('/ai/gemini-keys');
      console.log('📦 Gemini keys response:', response);
      console.log('📦 Response status:', response.status);
      
      const data = response.data;
      if (data.success) {
        setGeminiKeys(data.data);
        console.log('✅ Gemini keys loaded:', data.data?.length || 0);
      } else {
        console.error('❌ Failed to load Gemini keys:', data);
        setGeminiKeys([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading Gemini keys:', error);
      console.error('❌ Error response:', error.response);
      console.error('❌ Error status:', error.response?.status);
      console.error('❌ Error data:', error.response?.data);
      
      // More specific error messages
      let errorMessage = 'فشل في تحميل مفاتيح Gemini';
      
      if (error.response?.status === 401) {
        errorMessage = 'يجب تسجيل الدخول مرة أخرى';
      } else if (error.response?.status === 403) {
        errorMessage = 'ليس لديك صلاحية للوصول لهذه البيانات';
      } else if (error.response?.status === 500) {
        errorMessage = 'خطأ في الخادم - يرجى المحاولة لاحقاً';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      // Don't show error if user is not authenticated
      if (isAuthenticated) {
        console.error('⚠️ Showing error to user:', errorMessage);
      } else {
        console.log('⚠️ User not authenticated, suppressing error message');
      }
    }
  };

  const addGeminiKey = async () => {
    if (!newGeminiKey.name || !newGeminiKey.apiKey) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!isAuthenticated) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      const response = await companyAwareApi.post('/ai/gemini-keys', newGeminiKey);
      const data = response.data;

      if (data.success) {
        alert(`تم إضافة مفتاح Gemini بنجاح! ✅\nتم إنشاء ${data.data.modelsCreated} نموذج تلقائياً`);
        setNewGeminiKey({ name: '', apiKey: '', description: '', model: 'gemini-2.5-flash' }); // Reset with model
        loadGeminiKeys();
      } else {
        // Enhanced error handling for duplicate keys
        if (data.errorCode === 'DUPLICATE_API_KEY') {
          // Show detailed Arabic duplicate key message
          const message = data.details?.arabic || data.message || data.error;
          const suggestion = data.details?.suggestion ? `\n\n💡 ${data.details.suggestion}` : '';
          alert(`❌ ${message}${suggestion}`);
        } else {
          alert(`خطأ في إضافة المفتاح: ${data.error || 'خطأ غير معروف'}`);
        }
      }
    } catch (error: any) {
      console.error('Error adding Gemini key:', error);
      
      // Handle network/HTTP errors that might contain our enhanced error response
      if (error.response?.data) {
        const errorData = error.response.data;
        
        if (errorData.errorCode === 'DUPLICATE_API_KEY') {
          // Show detailed Arabic duplicate key message from error response
          const message = errorData.details?.arabic || errorData.message || errorData.error;
          const suggestion = errorData.details?.suggestion ? `\n\n💡 ${errorData.details.suggestion}` : '';
          alert(`❌ ${message}${suggestion}`);
        } else {
          alert(`خطأ في إضافة المفتاح: ${errorData.error || errorData.message || 'خطأ في الاتصال بالخادم'}`);
        }
      } else {
        alert('خطأ في إضافة المفتاح - تحقق من الاتصال بالإنترنت');
      }
    }
  };

  const deleteGeminiKey = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المفتاح؟')) {
      try {
        const response = await companyAwareApi.delete(`/ai/gemini-keys/${id}`);

        if (response.data.success) {
          alert('تم حذف المفتاح بنجاح! 🗑️');
          loadGeminiKeys();
        }
      } catch (error) {
        console.error('Error deleting Gemini key:', error);
        alert('خطأ في حذف المفتاح');
      }
    }
  };

  const activateGeminiKey = async (id: string) => {
    try {
      const response = await companyAwareApi.post(`/ai/gemini-keys/${id}/activate`);

      if (response.data.success) {
        alert('تم تفعيل المفتاح بنجاح! ✅');
        loadGeminiKeys();
      } else {
        alert('خطأ في تفعيل المفتاح');
      }
    } catch (error) {
      console.error('Error activating Gemini key:', error);
      alert('خطأ في تفعيل المفتاح');
    }
  };

  const deactivateGeminiKey = async (id: string) => {
    try {
      const response = await companyAwareApi.post(`/ai/gemini-keys/${id}/deactivate`);

      if (response.data.success) {
        alert('تم إلغاء تفعيل المفتاح بنجاح! 🚫');
        loadGeminiKeys();
      } else {
        alert('خطأ في إلغاء تفعيل المفتاح');
      }
    } catch (error) {
      console.error('Error deactivating Gemini key:', error);
      alert('خطأ في إلغاء تفعيل المفتاح');
    }
  };

  const editGeminiKey = (id: string) => {
    const key = geminiKeys.find(k => k.id === id);
    if (key) {
      setEditingKey(key.id);
      setNewGeminiKey({
        ...key,
        description: key.description || ''
      });
    }
  };

  const saveGeminiKey = async (id: string) => {
    if (!newGeminiKey.name || !newGeminiKey.apiKey) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!isAuthenticated) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      const response = await companyAwareApi.put(`/ai/gemini-keys/${id}`, newGeminiKey);
      const data = response.data;

      if (data.success) {
        alert('تم تحديث المفتاح بنجاح! ✅');
        setEditingKey(null);
        loadGeminiKeys();
      } else {
        alert(`خطأ في تحديث المفتاح: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error updating Gemini key:', error);
      alert('خطأ في تحديث المفتاح');
    }
  };

  const checkAvailableModels = async () => {
    try {
      const response = await companyAwareApi.get('/ai/available-models');
      const data = response.data;

      if (data.success) {
        setAvailableModels(data.models || []);
      }
    } catch (error) {
      console.error('Error checking available models:', error);
    }
  };

  const loadSystemPrompts = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping system prompts load');
        return;
      }

      const response = await companyAwareApi.get('/ai/prompts');
      const data = response.data;

      if (data.success) {
        setSystemPrompts(data.data);
      }
    } catch (error) {
      console.error('Error loading system prompts:', error);
    }
  };

  const addSystemPrompt = async () => {
    if (!newPrompt.name || !newPrompt.content) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!isAuthenticated) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      const response = await companyAwareApi.post('/ai/prompts', newPrompt);
      const data = response.data;

      if (data.success) {
        alert('تم إضافة البرونت بنجاح! ✅');
        setNewPrompt({ name: '', content: '', category: 'general' });
        loadSystemPrompts();
      } else {
        alert(`خطأ في إضافة البرونت: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error adding system prompt:', error);
      alert('خطأ في إضافة البرونت');
    }
  };

  const deleteSystemPrompt = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا البرونت؟')) {
      try {
        const response = await companyAwareApi.delete(`/ai/prompts/${id}`);

        if (response.data.success) {
          alert('تم حذف البرونت بنجاح! 🗑️');
          loadSystemPrompts();
        }
      } catch (error) {
        console.error('Error deleting system prompt:', error);
        alert('خطأ في حذف البرونت');
      }
    }
  };

  const handleSelectPromptFromLibrary = (prompt: any) => {
    setNewPrompt({
      name: prompt.nameAr || prompt.name,
      content: prompt.promptContent,
      category: prompt.category || 'general'
    });
    setShowPromptLibrary(false);
    alert('تم تحميل البرومبت من المكتبة! يمكنك تعديله والحفظ.');
  };

  const editSystemPrompt = (id: string) => {
    const prompt = systemPrompts.find(p => p.id === id);
    if (prompt) {
      setEditingPrompt(prompt.id);
      setEditPromptData(prompt);
    }
  };

  const saveSystemPrompt = async (id: string) => {
    if (!editPromptData.name || !editPromptData.content) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!isAuthenticated) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      const response = await companyAwareApi.put(`/ai/prompts/${id}`, editPromptData);
      const data = response.data;

      if (data.success) {
        alert('تم تحديث البرونت بنجاح! ✅');
        setEditingPrompt(null);
        loadSystemPrompts();
      } else {
        alert(`خطأ في تحديث البرونت: ${data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error updating system prompt:', error);
      alert('خطأ في تحديث البرونت');
    }
  };

  const loadMemorySettings = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping memory settings load');
        return;
      }

      const response = await companyAwareApi.get('/ai/memory/settings');
      const data = response.data;

      if (data.success) {
        setMemorySettings(data.data);
      }
    } catch (error) {
      console.error('Error loading memory settings:', error);
    }
  };

  const saveMemorySettings = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      setLoading(true);

      const response = await companyAwareApi.put('/ai/memory/settings', memorySettings);

      if (response.data.success) {
        alert('✅ تم حفظ إعدادات الذاكرة بنجاح!');
      } else {
        alert(`❌ خطأ في حفظ الإعدادات: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error saving memory settings:', error);
      alert('❌ حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const loadMemoryStats = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping memory stats load');
        return;
      }

      const response = await companyAwareApi.get('/ai/memory/stats');
      const data = response.data;

      if (data.success) {
        setMemoryStats(data.data);
      }
    } catch (error) {
      console.error('Error loading memory stats:', error);
    }
  };

  const loadAIPrompts = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping AI prompts load');
        return;
      }

      const response = await companyAwareApi.get('/settings/ai');
      const data = response.data;

      if (data.success) {
        setAiPrompts(data.data);
      }
    } catch (error) {
      console.error('Error loading AI prompts:', error);
      // Set default values if API fails
      setAiPrompts({
        personalityPrompt: '',
        responsePrompt: ''
      });
    }
  };

  const loadQueueSettings = async () => {
    try {
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, skipping queue settings load');
        return;
      }

      const response = await companyAwareApi.get('/settings/queue');
      const data = response.data;

      if (data.success) {
        setQueueSettings(data.data);
      }
    } catch (error) {
      console.error('Error loading queue settings:', error);
      // Set default values if API fails
      setQueueSettings({
        batchWaitTime: 5000,
        enabled: true,
        maxBatchSize: 10,
        description: 'إعدادات تجميع الرسائل المتتالية'
      });
    }
  };

  const saveQueueSettings = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      setQueueSaving(true);

      const response = await companyAwareApi.put('/settings/queue', queueSettings);

      if (response.data.success) {
        alert('✅ تم حفظ إعدادات التجميع بنجاح!');
      } else {
        alert(`❌ خطأ في حفظ الإعدادات: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error adding Gemini key:', error);
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  const toggleGeminiKey = async (keyId: string) => {
    try {
      console.log('🔄 Toggling Gemini key:', keyId);

      const response = await companyAwareApi.put(`/ai/gemini-keys/${keyId}/toggle`);

      console.log('✅ Toggle response:', response.data);

      if (response.data.success) {
        loadGeminiKeys();
        alert('تم تبديل حالة المفتاح بنجاح');
      } else {
        alert('فشل في تبديل حالة المفتاح');
      }
    } catch (error) {
      console.error('Error toggling Gemini key:', error);
      alert('حدث خطأ في تبديل حالة المفتاح');
    }
  };

  const startEditingModel = (keyId: string, currentModel: string) => {
    setEditingKey(keyId);
    setEditModel(currentModel);
  };

  const cancelEditingModel = () => {
    setEditingKey(null);
    setEditModel('');
  };

  const updateGeminiKeyModel = async (keyId: string) => {
    if (!editModel.trim()) {
      alert('يرجى اختيار نموذج صالح');
      return;
    }

    try {
      const response = await companyAwareApi.put(`/ai/gemini-keys/${keyId}/model`, {
        model: editModel
      });

      if (response.data.success) {
        alert('تم تحديث النموذج بنجاح! 🎯');
        loadGeminiKeys();
        cancelEditingModel();
      } else {
        alert(`خطأ في تحديث النموذج: ${response.data.error}`);
      }
    } catch (error) {
      console.error('Error updating Gemini key model:', error);
      alert('حدث خطأ في تحديث النموذج');
    }
  };

  const testGeminiKey = async (keyId: string) => {
    try {
      setLoading(true);
      const response = await companyAwareApi.post(`/ai/gemini-keys/${keyId}/test`);

      const data = response.data;
      if (data.success) {
        alert(`${data.message}

تفاصيل الاختبار:
• النموذج المستخدم: ${data.model}
• الحالة: ${data.status}
• عينة من الرد: ${data.response}`);
      } else {
        alert(`${data.message || '❌ المفتاح لا يعمل'}\n\nسبب الخطأ: ${data.error}`);
      }
    } catch (error) {
      console.error('Error testing Gemini key:', error);
      alert('❌ حدث خطأ في اختبار المفتاح');
    } finally {
      setLoading(false);
    }
  };

  // Save AI Settings Prompts
  const saveAIPrompts = async () => {
    try {
      if (!isAuthenticated) {
        alert('يجب تسجيل الدخول أولاً');
        return;
      }

      if (!(aiPrompts.personalityPrompt || '').trim()) {
        alert('يجب كتابة شخصية المساعد الذكي');
        return;
      }

      if (!(aiPrompts.responsePrompt || '').trim()) {
        alert('يجب كتابة قواعد الاستجابة');
        return;
      }

      setPromptsSaving(true);
      const response = await companyAwareApi.put('/settings/ai', aiPrompts);

      if (response.data.success) {
        alert('تم حفظ إعدادات المساعد الذكي بنجاح! ✅');
        console.log('✅ AI Prompts saved:', response.data);
      } else {
        alert(`خطأ في حفظ الإعدادات: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error saving AI prompts:', error);
      alert('حدث خطأ في حفظ إعدادات المساعد الذكي ❌');
    } finally {
      setPromptsSaving(false);
    }
  };

  const activatePrompt = async (promptId: string) => {
    try {
      console.log('🔄 Activating prompt:', promptId);

      const response = await companyAwareApi.put(`/ai/prompts/${promptId}/activate`);

      if (response.data.success) {
        alert('تم تفعيل البرومبت بنجاح! ✅');
        loadSystemPrompts();
      } else {
        alert(`خطأ في تفعيل البرومبت: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error activating prompt:', error);
      alert('حدث خطأ في تفعيل البرومبت');
    }
  };

  const startEditPrompt = (prompt: any) => {
    setEditingPrompt(prompt);
    setEditPromptData({
      name: prompt.name,
      content: prompt.content,
      category: prompt.category
    });
  };

  const cancelEditPrompt = () => {
    setEditingPrompt(null);
    setEditPromptData({
      name: '',
      content: '',
      category: 'general'
    });
  };

  const updatePrompt = async () => {
    if (!editPromptData.name || !editPromptData.content) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      console.log('📝 Updating prompt:', editingPrompt.id, editPromptData);

      const response = await companyAwareApi.put(`/ai/prompts/${editingPrompt.id}`, editPromptData);

      if (response.data.success) {
        alert('تم تحديث البرومبت بنجاح! ✅');
        cancelEditPrompt();
        loadSystemPrompts();
      } else {
        alert(`خطأ في تحديث البرومبت: ${response.data.error || 'خطأ غير معروف'}`);
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      alert('حدث خطأ في تحديث البرومبت');
    }
  };

  const deletePrompt = async (promptId: string) => {
    if (confirm('هل أنت متأكد من حذف هذا البرومبت؟')) {
      try {
        console.log('🗑️ Deleting prompt:', promptId);

        const response = await companyAwareApi.delete(`/ai/prompts/${promptId}`);

        if (response.data.success) {
          alert('تم حذف البرومبت بنجاح! 🗑️');
          loadSystemPrompts();
        } else {
          alert(`خطأ في حذف البرومبت: ${response.data.error || 'خطأ غير معروف'}`);
        }
      } catch (error) {
        console.error('Error deleting prompt:', error);
        alert('حدث خطأ في حذف البرومبت');
      }
    }
  };

  const cleanupMemory = async () => {
    if (confirm('هل أنت متأكد من تنظيف الذاكرة القديمة؟')) {
      try {
        if (!isAuthenticated) {
          alert('يجب تسجيل الدخول أولاً');
          return;
        }

        setLoading(true);
        const response = await companyAwareApi.post('/ai/memory/cleanup');

        const data = response.data;
        if (data.success) {
          alert(`تم تنظيف ${data.deletedCount} سجل من الذاكرة! 🧹`);
          loadMemoryStats();
        }
      } catch (error) {
        console.error('Error cleaning up memory:', error);
        alert('حدث خطأ في تنظيف الذاكرة ❌');
      } finally {
        setLoading(false);
      }
    }
  };

  // Show loading or login message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            يجب تسجيل الدخول أولاً
          </h2>
          <p className="text-gray-600">
            يرجى تسجيل الدخول للوصول إلى إدارة الذكاء الاصطناعي
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <style>{customStyles}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">إدارة الذكاء الصناعي</h1>
            <p className="mt-2 text-gray-600">تحكم في إعدادات وأداء AI Agent</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* AI Status Toggle */}
            <div className="flex items-center">
              <span className="ml-3 text-sm font-medium text-gray-900">
                {settings.isEnabled ? 'مفعل' : 'معطل'}
              </span>
              <button
                onClick={toggleAI}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  settings.isEnabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center">
              {settings.isEnabled ? (
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              ) : (
                <XCircleIcon className="h-6 w-6 text-red-500" />
              )}
              <span className={`ml-2 text-sm font-medium ${
                settings.isEnabled ? 'text-green-600' : 'text-red-600'
              }`}>
                {settings.isEnabled ? 'AI نشط' : 'AI متوقف'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">إجمالي الرسائل</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalMessages}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <BoltIcon className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">ردود AI</p>
              <p className="text-2xl font-bold text-gray-900">{stats.aiResponses}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserGroupIcon className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">تحويل بشري</p>
              <p className="text-2xl font-bold text-gray-900">{stats.humanHandoffs}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">متوسط الرد</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgResponseTime}ث</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'ai-settings', name: '🤖 شخصية المساعد', icon: BoltIcon },
            { id: 'advanced-ai', name: '⚡ إعدادات AI متقدمة', icon: BoltIcon },
            { id: 'gemini', name: '🔑 مفاتيح Gemini', icon: CogIcon },
            { id: 'prompts', name: '💬 البرومبت المتقدم', icon: BoltIcon },
            { id: 'priority', name: '🎯 أولوية النظام', icon: CogIcon },
            { id: 'memory', name: '🧠 إدارة الذاكرة', icon: ChartBarIcon },
            { id: 'queue-settings', name: '⏱️ إعدادات الطوابير', icon: ClockIcon },
            { id: 'settings', name: '⚙️ الإعدادات', icon: CogIcon },
            { id: 'analytics', name: '📊 التحليلات', icon: ChartBarIcon },
            { id: 'knowledge', name: '📚 قاعدة المعرفة', icon: BoltIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center py-2 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'ai-settings' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">🤖 إعدادات شخصية المساعد الذكي</h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium text-blue-600">الإعداد الأساسي المطلوب:</span> قم بكتابة شخصية المساعد الذكي وقواعد الاستجابة الخاصة بشركتك
            </p>
            <div className="bg-blue-50 rounded-lg p-3 mt-2">
              <p className="text-xs text-blue-800">
                💡 <strong>هذا هو الـ prompt الرئيسي</strong> الذي سيستخدمه المساعد الذكي في جميع المحادثات.
                يجب إعداده قبل تشغيل النظام.
              </p>
            </div>
          </div>

          <div className="p-6">
            {promptsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">جاري تحميل الإعدادات...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Personality Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    👤 شخصية المساعد الذكي <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={aiPrompts.personalityPrompt || ''}
                    onChange={(e) => setAiPrompts({...aiPrompts, personalityPrompt: e.target.value})}
                    rows={12}
                    placeholder="مثال:
أنت نور، مساعدة مبيعات متخصصة في شركة الأزياء العصرية.

🎯 شخصيتك:
- تتحدثين بطريقة أنيقة ومواكبة للموضة
- متخصصة في الأزياء والإكسسوارات
- تستخدمين اللغة العربية الواضحة والبسيطة
- تفهمين احتياجات العملاء وتقدمين حلول مناسبة

💼 مهامك:
- مساعدة العملاء في اختيار الأزياء المناسبة
- تقديم نصائح الموضة والتنسيق
- عرض المنتجات بطريقة جذابة
- الإجابة على الاستفسارات بطريقة ودودة ومهنية"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    اكتب شخصية المساعد الذكي بما يناسب طبيعة عمل شركتك ونوع منتجاتك
                  </p>
                </div>

                {/* Response Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 قواعد الاستجابة <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={aiPrompts.responsePrompt || ''}
                    onChange={(e) => setAiPrompts({...aiPrompts, responsePrompt: e.target.value})}
                    rows={10}
                    placeholder="مثال:
🔐 قواعد الاستجابة الصارمة:

1. ⚠️ استخدمي فقط المعلومات الموجودة في قاعدة البيانات المذكورة أدناه
2. 🚫 لا تذكري أي منتجات أو معلومات غير موجودة في قاعدة البيانات
3. ✅ قدمي أسعار ومواصفات دقيقة من قاعدة البيانات فقط
4. 💰 اذكري الأسعار بالجنيه المصري
5. 📸 اعرضي صور المنتجات عند توفرها
6. 🤝 كوني مفيدة وودودة في جميع الردود
7. ❓ اطلبي التوضيح إذا لم تفهمي السؤال
8. 🆘 أحيلي للدعم البشري في الحالات المعقدة"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    حدد القواعد التي يجب على المساعد اتباعها عند الرد على العملاء
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveAIPrompts}
                    disabled={promptsSaving || !(aiPrompts.personalityPrompt || '').trim() || !(aiPrompts.responsePrompt || '').trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {promptsSaving ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
                  </button>

                  <button
                    onClick={loadAIPrompts}
                    disabled={promptsLoading}
                    className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {promptsLoading ? '⏳ جاري التحديث...' : '🔄 إعادة تحميل'}
                  </button>
                </div>

                {/* Help Section */}
                <div className="bg-blue-50 rounded-lg p-4 mt-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">💡 نصائح لكتابة شخصية مساعد فعالة:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• حدد اسم المساعد وطبيعة عمل شركتك</li>
                    <li>• اكتب بأسلوب يناسب عملاءك (رسمي/ودود/عصري)</li>
                    <li>• حدد نوع المنتجات والخدمات التي تقدمها</li>
                    <li>• اذكر العملة المستخدمة في شركتك</li>
                    <li>• ضع قواعد واضحة للتعامل مع الاستفسارات</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'advanced-ai' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">⚡ إعدادات AI المتقدمة</h3>
            <p className="text-sm text-gray-600 mt-1">تحكم دقيق في إعدادات التوليد والسلوك الذكي</p>
          </div>

          <div className="p-6">
            {advancedLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">جاري تحميل الإعدادات المتقدمة...</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Generation Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">🔧 إعدادات التوليد</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Temperature */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature (الإبداع): {advancedSettings.temperature}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={advancedSettings.temperature}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, temperature: parseFloat(e.target.value)})}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">أقل = ردود متوقعة، أعلى = ردود إبداعية</p>
                    </div>

                    {/* TopP */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Top P (التنوع): {advancedSettings.topP}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={advancedSettings.topP}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, topP: parseFloat(e.target.value)})}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">يتحكم في تنوع الكلمات المختارة</p>
                    </div>

                    {/* TopK */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Top K (عدد الخيارات): {advancedSettings.topK}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={advancedSettings.topK}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, topK: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">عدد الكلمات المرشحة في كل خطوة</p>
                    </div>

                    {/* MaxTokens */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Max Tokens (طول الرد): {advancedSettings.maxTokens}
                      </label>
                      <input
                        type="range"
                        min="128"
                        max="2048"
                        step="128"
                        value={advancedSettings.maxTokens}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, maxTokens: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">الحد الأقصى لطول الرد</p>
                    </div>

                    {/* Response Style */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        أسلوب الرد
                      </label>
                      <select
                        value={advancedSettings.responseStyle}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, responseStyle: e.target.value as 'formal' | 'casual' | 'balanced'})}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="formal">رسمي - للمعاملات الاحترافية</option>
                        <option value="balanced">متوازن - يناسب معظم الحالات</option>
                        <option value="casual">عامي - للتواصل الودي</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Smart Behavior Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">🧠 إعدادات السلوك الذكي</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableDiversityCheck}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableDiversityCheck: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">🎨 فحص التنوع</span>
                        <p className="text-xs text-gray-600">منع تكرار نفس الردود</p>
                      </div>
                    </label>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableToneAdaptation}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableToneAdaptation: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">🎭 تكيف الأسلوب</span>
                        <p className="text-xs text-gray-600">يتكيف مع أسلوب العميل</p>
                      </div>
                    </label>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableEmotionalResponse}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableEmotionalResponse: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">❤️ استجابة عاطفية</span>
                        <p className="text-xs text-gray-600">يفهم المشاعر ويستجيب بلطف</p>
                      </div>
                    </label>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableSmartSuggestions}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableSmartSuggestions: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">💡 اقتراحات ذكية</span>
                        <p className="text-xs text-gray-600">يقترح منتجات وحلول</p>
                      </div>
                    </label>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableLongTermMemory}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableLongTermMemory: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">🧠 ذاكرة طويلة المدى</span>
                        <p className="text-xs text-gray-600">يتذكر التفاعلات السابقة</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Advanced Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">⚙️ إعدادات متقدمة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحد الأقصى للرسائل في المحادثة
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={advancedSettings.maxMessagesPerConversation}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, maxMessagesPerConversation: parseInt(e.target.value)})}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">عدد الرسائل التي يتذكرها في المحادثة</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        مدة الاحتفاظ بالذاكرة (بالأيام)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={advancedSettings.memoryRetentionDays}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, memoryRetentionDays: parseInt(e.target.value)})}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">فترة الاحتفاظ بسجل المحادثات</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        أولوية الأنماط
                      </label>
                      <select
                        value={advancedSettings.patternPriority}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, patternPriority: e.target.value as 'prompt' | 'balanced' | 'patterns'})}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="prompt">Prompt أولاً</option>
                        <option value="balanced">متوازن</option>
                        <option value="patterns">Patterns أولاً</option>
                      </select>
                    </div>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enablePatternApplication}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enablePatternApplication: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">📊 تطبيق الأنماط</span>
                        <p className="text-xs text-gray-600">استخدام الأنماط المكتشفة تلقائياً</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Quality Settings */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">✅ إعدادات الجودة</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        الحد الأدنى لدرجة الجودة: {advancedSettings.minQualityScore}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={advancedSettings.minQualityScore}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, minQualityScore: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">الحد الأدنى المقبول لجودة الردود</p>
                    </div>

                    <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={advancedSettings.enableLowQualityAlerts}
                        onChange={(e) => setAdvancedSettings({...advancedSettings, enableLowQualityAlerts: e.target.checked})}
                        className="mr-3 text-blue-600"
                      />
                      <div>
                        <span className="font-medium">🚨 تنبيهات الجودة المنخفضة</span>
                        <p className="text-xs text-gray-600">تنبيه عند انخفاض جودة الردود</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={saveAdvancedSettings}
                    disabled={advancedSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {advancedSaving ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات المتقدمة'}
                  </button>

                  <button
                    onClick={loadAdvancedSettings}
                    disabled={advancedLoading}
                    className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {advancedLoading ? '⏳ جاري التحديث...' : '🔄 إعادة تحميل'}
                  </button>
                </div>

                {/* Help Section */}
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-900 mb-2">⚠️ ملاحظة هامة:</h4>
                  <p className="text-sm text-yellow-800">
                    هذه الإعدادات متقدمة وتؤثر بشكل مباشر على سلوك الـ AI. يُنصح بعدم تغييرها إلا إذا كنت تفهم تأثير كل إعداد.
                    القيم الافتراضية مُحسَّنة لأفضل أداء في معظم الحالات.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'gemini' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">🔑 إدارة مفاتيح Gemini API</h3>
            <p className="text-sm text-gray-600 mt-1">النظام الجديد متعدد النماذج - مفتاح واحد لجميع النماذج مع تبديل ذكي</p>

            {/* Summary Stats */}
            {geminiKeys.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-900">إجمالي المفاتيح</div>
                  <div className="text-2xl font-bold text-blue-600">{geminiKeys.length}</div>
                </div>
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-green-900">المفاتيح النشطة</div>
                  <div className="text-2xl font-bold text-green-600">
                    {geminiKeys.filter(k => k.isActive).length}
                  </div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-purple-900">إجمالي النماذج</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {geminiKeys.reduce((sum, k) => sum + (k.totalModels || 0), 0)}
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-yellow-900">النماذج المتاحة</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {geminiKeys.reduce((sum, k) => sum + (k.availableModels || 0), 0)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            {/* Model Info Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-2xl">🚀</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">أحدث نماذج Gemini 2025</h4>
                  <p className="text-sm text-blue-700 mb-2">
                    تم تحديث النماذج لتشمل أحدث إصدارات Gemini مع مميزات التفكير المتقدم والصوت التفاعلي
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white rounded p-2 border border-blue-100">
                      <span className="font-medium text-green-600">⭐ موصى به:</span>
                      <br />Gemini 2.5 Flash - أفضل توازن
                    </div>
                    <div className="bg-white rounded p-2 border border-blue-100">
                      <span className="font-medium text-purple-600">🧠 الأقوى:</span>
                      <br />Gemini 2.5 Pro - للمهام المعقدة
                    </div>
                    <div className="bg-white rounded p-2 border border-blue-100">
                      <span className="font-medium text-orange-600">⚡ الأسرع:</span>
                      <br />Gemini 2.5 Flash Lite - للسرعة
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Add New Key Form */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">إضافة مفتاح جديد</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المفتاح</label>
                  <input
                    type="text"
                    value={newGeminiKey.name}
                    onChange={(e) => setNewGeminiKey({...newGeminiKey, name: e.target.value})}
                    placeholder="مثال: مفتاح رئيسي"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مفتاح API</label>
                  <input
                    type="password"
                    value={newGeminiKey.apiKey}
                    onChange={(e) => setNewGeminiKey({...newGeminiKey, apiKey: e.target.value})}
                    placeholder="AIzaSy..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف (اختياري)</label>
                <input
                  type="text"
                  value={newGeminiKey.description}
                  onChange={(e) => setNewGeminiKey({...newGeminiKey, description: e.target.value})}
                  placeholder="وصف المفتاح..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">🚀 النظام الجديد متعدد النماذج</h5>
                <p className="text-sm text-blue-800">
                  سيتم إنشاء جميع النماذج المدعومة تلقائياً لهذا المفتاح:
                </p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1">
                  <li>• gemini-2.5-flash (1M طلب) - الأحدث والأفضل</li>
                  <li>• gemini-2.5-pro (500K طلب) - للمهام المعقدة</li>
                  <li>• gemini-2.0-flash (750K طلب) - سريع ومستقر</li>
                  <li>• gemini-2.0-flash-exp (1K طلب) - تجريبي</li>
                  <li>• gemini-1.5-flash (1.5K طلب) - مُهمل لكن يعمل</li>
                  <li>• gemini-1.5-pro (50 طلب) - مُهمل لكن قوي</li>
                </ul>
              </div>

              <div className="flex space-x-4 mt-4">
                <button
                  onClick={addGeminiKey}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  ✨ إضافة المفتاح (مع جميع النماذج)
                </button>

                <button
                  onClick={loadGeminiKeys}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  🔄 تحديث القائمة
                </button>
              </div>
            </div>

            {/* Keys List */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">المفاتيح المحفوظة</h4>

              {geminiKeys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد مفاتيح محفوظة. أضف مفتاح جديد للبدء.
                </div>
              ) : (
                geminiKeys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h5 className="font-medium text-gray-900">{key.name}</h5>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            key.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {key.isActive ? 'نشط' : 'غير نشط'}
                          </span>
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                            أولوية: {key.priority}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          <p>المفتاح: {key.apiKey}</p>
                          <p>النماذج المتاحة: {key.availableModels} / {key.totalModels}</p>
                          {key.description && <p>الوصف: {key.description}</p>}
                          <p>تاريخ الإضافة: {new Date(key.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => testGeminiKey(key.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          اختبار
                        </button>

                        <button
                          onClick={() => toggleGeminiKey(key.id)}
                          className={`px-3 py-1 rounded text-sm ${
                            key.isActive
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {key.isActive ? 'إيقاف' : 'تفعيل'}
                        </button>

                        <button
                          onClick={() => deleteGeminiKey(key.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          حذف
                        </button>
                      </div>
                    </div>

                    {/* Models List */}
                    {key.models && key.models.length > 0 && (
                      <div className="border-t pt-4">
                        <h6 className="font-medium text-gray-900 mb-3">النماذج المدعومة:</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {key.models.map((model) => (
                            <div key={model.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-sm">{model.model}</span>
                                  {model.model.includes('2.5') && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                      🚀 أحدث
                                    </span>
                                  )}
                                  {model.model.includes('flash') && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                      ⚡ سريع
                                    </span>
                                  )}
                                  {model.model.includes('pro') && (
                                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                                      🧠 متقدم
                                    </span>
                                  )}
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  model.isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {model.isEnabled ? 'مُفعل' : 'معطل'}
                                </span>
                              </div>

                              <div className="text-xs text-gray-600 mb-2">
                                <p>الاستخدام: {model.usage.used.toLocaleString()} / {model.usage.limit.toLocaleString()}</p>
                                <p>الأولوية: {model.priority}</p>
                                {model.lastUsed && (
                                  <p>آخر استخدام: {new Date(model.lastUsed).toLocaleDateString('ar-EG')}</p>
                                )}
                              </div>

                              {/* Usage Bar for each model */}
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    (model.usage.used / model.usage.limit) > 0.8 ? 'bg-red-500' :
                                    (model.usage.used / model.usage.limit) > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min((model.usage.used / model.usage.limit) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2">
                        <button
                          onClick={() => testGeminiKey(key.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          اختبار
                        </button>

                        <button
                          onClick={() => toggleGeminiKey(key.id)}
                          className={`px-3 py-1 rounded text-sm ${
                            key.isActive
                              ? 'bg-gray-600 text-white hover:bg-gray-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {key.isActive ? 'إيقاف' : 'تفعيل'}
                        </button>

                        <button
                          onClick={() => deleteGeminiKey(key.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          حذف
                        </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'priority' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">🎯 إعدادات أولوية النظام</h3>
            <p className="text-sm text-gray-600 mt-1">تحكم في أولوية البرونت والأنماط وحل التعارض بينهما</p>
          </div>

          <div className="p-6">
            {/* تنبيه مهم */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-yellow-900 mb-1">إعدادات متقدمة</h4>
                  <p className="text-sm text-yellow-700">
                    هذه الإعدادات تؤثر على كيفية تفاعل البرونت مع الأنماط المكتشفة تلقائياً.
                    تأكد من فهم كل خيار قبل التغيير.
                  </p>
                </div>
              </div>
            </div>

            {/* إعدادات الأولوية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

              {/* أولوية البرونت */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-3 flex items-center">
                  📝 أولوية البرونت الأساسي
                </h4>
                <select
                  value={prioritySettings.promptPriority}
                  onChange={(e) => setPrioritySettings({...prioritySettings, promptPriority: e.target.value as any})}
                  className="w-full p-3 border border-blue-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="high">🔥 عالية - البرونت يتحكم في كل شيء</option>
                  <option value="medium">⚖️ متوسطة - توازن مع الأنماط</option>
                  <option value="low">📉 منخفضة - الأنماط تتحكم أكثر</option>
                </select>
                <p className="text-xs text-blue-700 mt-2">
                  {prioritySettings.promptPriority === 'high' && 'البرونت له الأولوية المطلقة في الشخصية والأسلوب'}
                  {prioritySettings.promptPriority === 'medium' && 'توازن بين البرونت والأنماط المكتشفة'}
                  {prioritySettings.promptPriority === 'low' && 'الأنماط تحسن البرونت بحرية أكبر'}
                </p>
              </div>

              {/* أولوية الأنماط */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center">
                  📊 أولوية الأنماط المكتشفة
                </h4>
                <select
                  value={prioritySettings.patternsPriority}
                  onChange={(e) => setPrioritySettings({...prioritySettings, patternsPriority: e.target.value as any})}
                  className="w-full p-3 border border-green-300 rounded-md bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="high">🔥 عالية - الأنماط تتحكم</option>
                  <option value="medium">⚖️ متوسطة - توازن مع البرونت</option>
                  <option value="low">📉 منخفضة - البرونت يتحكم أكثر</option>
                </select>
                <p className="text-xs text-green-700 mt-2">
                  {prioritySettings.patternsPriority === 'high' && 'الأنماط تحسن الردود بقوة حتى لو تعارضت مع البرونت'}
                  {prioritySettings.patternsPriority === 'medium' && 'الأنماط تحسن الردود مع احترام البرونت'}
                  {prioritySettings.patternsPriority === 'low' && 'الأنماط تحسن الردود فقط إذا لم تتعارض مع البرونت'}
                </p>
              </div>
            </div>

            {/* حل التعارض */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
              <h4 className="font-medium text-yellow-900 mb-3 flex items-center">
                ⚠️ استراتيجية حل التعارض
              </h4>
              <div className="space-y-3">
                <label className="flex items-center p-2 rounded hover:bg-yellow-100 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictResolution"
                    value="prompt_wins"
                    checked={prioritySettings.conflictResolution === 'prompt_wins'}
                    onChange={(e) => setPrioritySettings({...prioritySettings, conflictResolution: e.target.value as any})}
                    className="mr-3 text-yellow-600"
                  />
                  <div>
                    <span className="font-medium">🏆 البرونت يفوز دائماً</span>
                    <p className="text-xs text-yellow-700">عند التعارض، البرونت له الأولوية المطلقة</p>
                  </div>
                </label>
                <label className="flex items-center p-2 rounded hover:bg-yellow-100 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictResolution"
                    value="patterns_win"
                    checked={prioritySettings.conflictResolution === 'patterns_win'}
                    onChange={(e) => setPrioritySettings({...prioritySettings, conflictResolution: e.target.value as any})}
                    className="mr-3 text-yellow-600"
                  />
                  <div>
                    <span className="font-medium">📊 الأنماط تفوز دائماً</span>
                    <p className="text-xs text-yellow-700">عند التعارض، الأنماط المكتشفة لها الأولوية</p>
                  </div>
                </label>
                <label className="flex items-center p-2 rounded hover:bg-yellow-100 cursor-pointer">
                  <input
                    type="radio"
                    name="conflictResolution"
                    value="merge_smart"
                    checked={prioritySettings.conflictResolution === 'merge_smart'}
                    onChange={(e) => setPrioritySettings({...prioritySettings, conflictResolution: e.target.value as any})}
                    className="mr-3 text-yellow-600"
                  />
                  <div>
                    <span className="font-medium">🧠 دمج ذكي (موصى به)</span>
                    <p className="text-xs text-yellow-700">النظام يحلل ويختار الأفضل من كل جانب</p>
                  </div>
                </label>
              </div>
            </div>

            {/* إعدادات إضافية */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prioritySettings.enforcePersonality}
                  onChange={(e) => setPrioritySettings({...prioritySettings, enforcePersonality: e.target.checked})}
                  className="mr-3 text-blue-600"
                />
                <div>
                  <span className="font-medium">🎭 إجبار الشخصية من البرونت</span>
                  <p className="text-xs text-gray-600">منع الأنماط من تغيير شخصية البوت</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prioritySettings.enforceLanguageStyle}
                  onChange={(e) => setPrioritySettings({...prioritySettings, enforceLanguageStyle: e.target.checked})}
                  className="mr-3 text-blue-600"
                />
                <div>
                  <span className="font-medium">🗣️ إجبار أسلوب اللغة من البرونت</span>
                  <p className="text-xs text-gray-600">منع الأنماط من تغيير أسلوب اللغة (عامية/فصحى)</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prioritySettings.autoDetectConflicts}
                  onChange={(e) => setPrioritySettings({...prioritySettings, autoDetectConflicts: e.target.checked})}
                  className="mr-3 text-blue-600"
                />
                <div>
                  <span className="font-medium">🔍 كشف التعارض التلقائي</span>
                  <p className="text-xs text-gray-600">تنبيهات عند اكتشاف تعارض بين البرونت والأنماط</p>
                </div>
              </label>

              <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prioritySettings.conflictReports}
                  onChange={(e) => setPrioritySettings({...prioritySettings, conflictReports: e.target.checked})}
                  className="mr-3 text-blue-600"
                />
                <div>
                  <span className="font-medium">📊 تقارير التعارض</span>
                  <p className="text-xs text-gray-600">حفظ تقارير مفصلة عن التعارضات المكتشفة</p>
                </div>
              </label>
            </div>

            {/* أزرار الحفظ */}
            <div className="flex space-x-4 pt-4 border-t border-gray-200">
              <button
                onClick={savePrioritySettings}
                disabled={loading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
              </button>

              <button
                onClick={resetPrioritySettings}
                disabled={loading}
                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                🔄 إعادة تعيين
              </button>

              <button
                onClick={testConflictDetection}
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? '⏳ جاري الاختبار...' : '🧪 اختبار كشف التعارض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">💬 البرومبت المتقدم</h3>
            <p className="text-sm text-gray-600 mt-1">إنشاء وإدارة prompts إضافية للحالات الخاصة (متقدم - اختياري)</p>
            <div className="bg-amber-50 rounded-lg p-3 mt-2">
              <p className="text-xs text-amber-800">
                ⚠️ <strong>ملاحظة:</strong> هذا القسم للمستخدمين المتقدمين فقط.
                الـ prompt الأساسي يتم إعداده في تبويب "شخصية المساعد".
              </p>
            </div>
          </div>

          <div className="p-6">
            {/* Library Button */}
            <div className="mb-6">
              <button
                onClick={() => setShowPromptLibrary(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 flex items-center justify-center gap-3 shadow-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-lg font-semibold">اختيار برومبت جاهز من المكتبة</span>
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                اختر من مجموعة برومبتات جاهزة ومجربة لتوفير الوقت
              </p>
            </div>

            {/* Add New Prompt Form */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-md font-medium text-gray-900 mb-4">أو أضف برومبت مخصص</h4>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم البرومبت</label>
                    <input
                      type="text"
                      value={newPrompt.name}
                      onChange={(e) => setNewPrompt({...newPrompt, name: e.target.value})}
                      placeholder="مثال: برومبت خدمة العملاء"
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الفئة</label>
                    <select
                      value={newPrompt.category}
                      onChange={(e) => setNewPrompt({...newPrompt, category: e.target.value})}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="general">عام</option>
                      <option value="customer_service">خدمة العملاء</option>
                      <option value="sales">المبيعات</option>
                      <option value="support">الدعم الفني</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">محتوى البرومبت</label>
                  <textarea
                    value={newPrompt.content}
                    onChange={(e) => setNewPrompt({...newPrompt, content: e.target.value})}
                    rows={8}
                    placeholder="أنت مساعد ذكي لخدمة العملاء في متجر للأحذية..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    يمكنك استخدام متغيرات مثل {'{customerName}'} و {'{productName}'}
                  </p>
                </div>
              </div>

              <button
                onClick={addSystemPrompt}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                إضافة البرومبت
              </button>
            </div>

            {/* Prompts List */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">البرومبت المحفوظة</h4>

              {systemPrompts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  لا توجد برومبت محفوظة. أضف برومبت جديد للبدء.
                </div>
              ) : (
                systemPrompts.map((prompt) => (
                  <div key={prompt.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h5 className="font-medium text-gray-900">{prompt.name}</h5>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            prompt.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {prompt.isActive ? 'نشط' : 'غير نشط'}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {prompt.category}
                          </span>
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          <p className="line-clamp-3">{prompt.content}</p>
                          <p className="mt-1 text-xs">تاريخ الإنشاء: {new Date(prompt.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        {!prompt.isActive && (
                          <button
                            onClick={() => activatePrompt(prompt.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            تفعيل
                          </button>
                        )}

                        <button
                          onClick={() => startEditPrompt(prompt)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          تعديل
                        </button>

                        <button
                          onClick={() => deletePrompt(prompt.id)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">🧠 إدارة الذاكرة</h3>
            <p className="text-sm text-gray-600 mt-1">تحكم في إعدادات ذاكرة المحادثات والتخزين</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Memory Settings */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">إعدادات الذاكرة</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    مدة الاحتفاظ بالذاكرة (بالأيام)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={memorySettings.retentionDays}
                    onChange={(e) => setMemorySettings({
                      ...memorySettings,
                      retentionDays: parseInt(e.target.value)
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">سيتم حذف المحادثات الأقدم من هذه المدة تلقائياً</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحد الأقصى للمحادثات لكل مستخدم
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={memorySettings.maxConversationsPerUser}
                    onChange={(e) => setMemorySettings({
                      ...memorySettings,
                      maxConversationsPerUser: parseInt(e.target.value)
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الحد الأقصى للرسائل في المحادثة الواحدة
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={memorySettings.maxMessagesPerConversation}
                    onChange={(e) => setMemorySettings({
                      ...memorySettings,
                      maxMessagesPerConversation: parseInt(e.target.value)
                    })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Memory Features */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">مميزات الذاكرة</h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">التنظيف التلقائي</span>
                    <p className="text-xs text-gray-500">حذف المحادثات القديمة تلقائياً</p>
                  </div>
                  <button
                    onClick={() => setMemorySettings({
                      ...memorySettings,
                      autoCleanup: !memorySettings.autoCleanup
                    })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      memorySettings.autoCleanup ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        memorySettings.autoCleanup ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">ضغط الذاكرة</span>
                    <p className="text-xs text-gray-500">ضغط المحادثات القديمة لتوفير المساحة</p>
                  </div>
                  <button
                    onClick={() => setMemorySettings({
                      ...memorySettings,
                      compressionEnabled: !memorySettings.compressionEnabled
                    })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      memorySettings.compressionEnabled ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        memorySettings.compressionEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Memory Actions */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">إجراءات الذاكرة</h4>

              <div className="flex space-x-4">
                <button
                  onClick={saveMemorySettings}
                  disabled={saving}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>

                <button
                  onClick={cleanupMemory}
                  className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                >
                  تنظيف الذاكرة القديمة
                </button>

                <button
                  onClick={clearMemory}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  مسح جميع الذاكرة
                </button>
              </div>
            </div>

            {/* Memory Statistics */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">إحصائيات الذاكرة</h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{memoryStats.totalMemories.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">إجمالي المحادثات</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{memoryStats.totalMessages.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">إجمالي الرسائل</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{memoryStats.totalCustomers.toLocaleString()}</div>
                  <div className="text-xs text-gray-600">عملاء فريدين</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{memoryStats.shortTermMemorySize}</div>
                  <div className="text-xs text-gray-600">ذاكرة نشطة</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue-settings' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">⏱️ إعدادات تجميع الرسائل المتتالية</h3>
            <p className="text-sm text-gray-600 mt-1">تحكم في كيفية معالجة الرسائل المتتالية من العملاء للحفاظ على السياق الطبيعي للمحادثة</p>
            <div className="bg-blue-50 rounded-lg p-3 mt-2">
              <p className="text-xs text-blue-800">
                💡 <strong>كيف يعمل النظام:</strong> عندما يرسل العميل عدة رسائل متتالية، ينتظر النظام لفترة محددة لتجميعها ومعالجتها كمحادثة واحدة متماسكة.
              </p>
            </div>
          </div>

          <div className="p-6">
            {queueLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">جاري تحميل إعدادات الطوابير...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Enable/Disable Queue System */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-md font-medium text-gray-900">🚀 تفعيل نظام تجميع الرسائل</h4>
                      <p className="text-sm text-gray-600 mt-1">تمكين أو تعطيل معالجة الرسائل المتتالية كمجموعة واحدة</p>
                    </div>
                    <button
                      onClick={() => setQueueSettings({...queueSettings, enabled: !queueSettings.enabled})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${queueSettings.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${queueSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>

                  {queueSettings.enabled ? (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <p className="text-sm text-green-700">
                        النظام مُفعل: سيتم تجميع الرسائل المتتالية ومعالجتها كسياق واحد للحصول على ردود أكثر طبيعية وتماسكاً.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                      <p className="text-sm text-yellow-700">
                        النظام مُعطل: سيتم معالجة كل رسالة على حدة فوراً، مما قد يؤدي إلى فقدان السياق في المحادثات السريعة.
                      </p>
                    </div>
                  )}
                </div>

                {/* Wait Time Configuration */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-md font-medium text-blue-900 mb-4">⏰ وقت الانتظار لتجميع الرسائل</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-2">
                        وقت الانتظار (بالثواني)
                      </label>
                      
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="1"
                          max="30"
                          step="1"
                          value={queueSettings.batchWaitTime / 1000}
                          onChange={(e) => setQueueSettings({
                            ...queueSettings, 
                            batchWaitTime: parseInt(e.target.value) * 1000
                          })}
                          className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                          disabled={!queueSettings.enabled}
                        />
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={queueSettings.batchWaitTime / 1000}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (value >= 1 && value <= 30) {
                                setQueueSettings({...queueSettings, batchWaitTime: value * 1000});
                              }
                            }}
                            className="w-20 px-3 py-1 border border-blue-300 rounded-md text-sm text-center"
                            disabled={!queueSettings.enabled}
                          />
                          <span className="text-sm text-blue-700">ثانية</span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-blue-600 mt-2">
                        النظام ينتظر {queueSettings.batchWaitTime / 1000} ثانية بعد آخر رسالة قبل المعالجة
                      </p>
                    </div>

                    {/* Wait Time Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-green-600">⚡ سريع</span>
                          <button
                            onClick={() => setQueueSettings({...queueSettings, batchWaitTime: 2000})}
                            className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded hover:bg-green-200"
                            disabled={!queueSettings.enabled}
                          >
                            2 ثواني
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">للعملاء السريعين في الكتابة</p>
                      </div>
                      
                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-blue-600">⚖️ متوازن</span>
                          <button
                            onClick={() => setQueueSettings({...queueSettings, batchWaitTime: 5000})}
                            className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200"
                            disabled={!queueSettings.enabled}
                          >
                            5 ثواني
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">الإعداد الموصى به لمعظم الحالات</p>
                      </div>
                      
                      <div className="bg-white rounded p-3 border border-blue-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-orange-600">🐌 صبور</span>
                          <button
                            onClick={() => setQueueSettings({...queueSettings, batchWaitTime: 10000})}
                            className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200"
                            disabled={!queueSettings.enabled}
                          >
                            10 ثواني
                          </button>
                        </div>
                        <p className="text-xs text-gray-600">للعملاء البطيئين في الكتابة</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-6 border-t border-gray-200">
                  <button
                    onClick={saveQueueSettings}
                    disabled={queueSaving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {queueSaving ? '⏳ جاري الحفظ...' : '💾 حفظ الإعدادات'}
                  </button>

                  <button
                    onClick={loadQueueSettings}
                    disabled={queueLoading}
                    className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
                  >
                    {queueLoading ? '⏳ جاري التحديث...' : '🔄 إعادة تحميل'}
                  </button>

                  <button
                    onClick={() => {
                      setQueueSettings({
                        batchWaitTime: 5000,
                        enabled: true,
                        maxBatchSize: 10,
                        description: 'إعدادات تجميع الرسائل المتتالية'
                      });
                    }}
                    className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700"
                  >
                    🔄 استعادة الافتراضي
                  </button>
                </div>

                {/* Help Section */}
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mt-6">
                  <h4 className="text-sm font-medium text-yellow-900 mb-2">💡 نصائح لاختيار الإعدادات المناسبة:</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• <strong>2-3 ثواني:</strong> مناسب للعملاء السريعين والمحادثات العاجلة</li>
                    <li>• <strong>5-7 ثواني:</strong> الخيار الأمثل لمعظم العملاء (موصى به)</li>
                    <li>• <strong>8-15 ثانية:</strong> مناسب للعملاء الذين يكتبون ببطء أو رسائل طويلة</li>
                    <li>• <strong>تذكر:</strong> وقت أطول = سياق أفضل، ولكن استجابة أبطأ</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">إعدادات AI Agent</h3>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Working Hours */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    ساعات العمل
                  </label>
                  <p className="text-sm text-gray-500">
                    تحديد أوقات عمل الذكاء الصناعي للرد على العملاء
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="workingHoursEnabled"
                    checked={settings.workingHoursEnabled}
                    onChange={(e) => setSettings({
                      ...settings,
                      workingHoursEnabled: e.target.checked
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="workingHoursEnabled" className="mr-2 text-sm text-gray-700">
                    تفعيل ساعات العمل
                  </label>
                </div>
              </div>

              {/* Working Hours Inputs - Only show when enabled */}
              {settings.workingHoursEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">من</label>
                    <input
                      type="time"
                      value={settings.workingHours.start}
                      onChange={(e) => setSettings({
                        ...settings,
                        workingHours: { ...settings.workingHours, start: e.target.value }
                      })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">إلى</label>
                    <input
                      type="time"
                      value={settings.workingHours.end}
                      onChange={(e) => setSettings({
                        ...settings,
                        workingHours: { ...settings.workingHours, end: e.target.value }
                      })}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Info message when working hours are disabled */}
              {!settings.workingHoursEnabled && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="mr-3">
                      <p className="text-sm text-blue-700">
                        الذكاء الصناعي سيعمل على مدار 24 ساعة ولن يتم فحص أوقات العمل.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ NEW: Reply Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                وضع الرد التلقائي
              </label>
              <div className="space-y-3">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="replyMode"
                    value="all"
                    checked={settings.replyMode === 'all'}
                    onChange={(e) => setSettings({
                      ...settings,
                      replyMode: e.target.value as 'new_only' | 'all'
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="mr-3">
                    <p className="text-sm font-medium text-gray-900">
                      الرد على كل المحادثات
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      الـ AI سيرد على كل الرسائل في جميع المحادثات (الجديدة والقديمة)
                    </p>
                  </div>
                </label>
                
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="replyMode"
                    value="new_only"
                    checked={settings.replyMode === 'new_only'}
                    onChange={(e) => setSettings({
                      ...settings,
                      replyMode: e.target.value as 'new_only' | 'all'
                    })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <div className="mr-3">
                    <p className="text-sm font-medium text-gray-900">
                      الرد على المحادثات الجديدة فقط
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      الـ AI سيرد فقط على أول رسالة من العميل (محادثة جديدة)
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Max Replies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الحد الأقصى للردود لكل عميل
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.maxRepliesPerCustomer}
                onChange={(e) => setSettings({
                  ...settings,
                  maxRepliesPerCustomer: parseInt(e.target.value)
                })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Response Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تأخير الرد (بالميلي ثانية)
              </label>
              <input
                type="number"
                min="0"
                max="10000"
                step="500"
                value={settings.responseDelay}
                onChange={(e) => setSettings({
                  ...settings,
                  responseDelay: parseInt(e.target.value)
                })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Features Toggle */}
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900">المميزات</h4>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">معالجة الوسائط المتعددة</span>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    multimodalEnabled: !settings.multimodalEnabled
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.multimodalEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.multimodalEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">نظام RAG</span>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    ragEnabled: !settings.ragEnabled
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.ragEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.ragEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700">التقييم الذكي للجودة</span>
                  <span className="text-xs text-gray-500">تقييم جودة الردود تلقائياً (يستهلك API)</span>
                </div>
                <button
                  onClick={() => setSettings({
                    ...settings,
                    qualityEvaluationEnabled: !settings.qualityEvaluationEnabled
                  })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.qualityEvaluationEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.qualityEvaluationEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 pt-6">
              <button
                onClick={saveSettings}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </button>
              
              <button
                onClick={clearMemory}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                مسح الذاكرة
              </button>
              
              <button
                onClick={updateKnowledgeBase}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                تحديث قاعدة المعرفة
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Sentiment Distribution */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">توزيع المشاعر</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.sentimentDistribution.positive}%
                </div>
                <div className="text-sm text-gray-600">إيجابي</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.sentimentDistribution.neutral}%
                </div>
                <div className="text-sm text-gray-600">محايد</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.sentimentDistribution.negative}%
                </div>
                <div className="text-sm text-gray-600">سلبي</div>
              </div>
            </div>
          </div>

          {/* Top Intents */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">أكثر النوايا شيوعاً</h3>
            <div className="space-y-3">
              {stats.topIntents.map((intent, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{intent.intent}</span>
                  <span className="text-sm font-medium text-gray-900">{intent.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">إدارة قاعدة المعرفة</h3>
          <p className="text-gray-600 mb-4">
            قاعدة المعرفة تحتوي على المعلومات التي يستخدمها AI للرد على العملاء.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={updateKnowledgeBase}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              تحديث قاعدة المعرفة
            </button>
            
            <div className="text-sm text-gray-500">
              آخر تحديث: منذ ساعتين
            </div>
          </div>
        </div>
      )}

      {/* Edit Prompt Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">تعديل البرومبت</h3>
              <button
                onClick={cancelEditPrompt}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم البرومبت</label>
                  <input
                    type="text"
                    value={editPromptData.name}
                    onChange={(e) => setEditPromptData({...editPromptData, name: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">محتوى البرومبت</label>
                <textarea
                  value={editPromptData.content}
                  onChange={(e) => setEditPromptData({...editPromptData, content: e.target.value})}
                  rows={8}
                  placeholder="أنت مساعد ذكي لخدمة العملاء في متجر للأحذية..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  يمكنك استخدام متغيرات مثل {'{customerName}'} و {'{productName}'}
                </p>
              </div>
            </div>

            <div className="flex space-x-4 pt-6">
              <button
                onClick={updatePrompt}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                تحديث البرومبت
              </button>

              <button
                onClick={cancelEditPrompt}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Gemini Key Modal */}
      {showAddGeminiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">إضافة مفتاح جيميني جديد</h3>
              <button
                onClick={closeAddGeminiKeyModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم المفتاح</label>
                  <input
                    type="text"
                    value={newGeminiKey.name}
                    onChange={(e) => setNewGeminiKey({...newGeminiKey, name: e.target.value})}
                    placeholder="مثال: مفتاح رئيسي"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">مفتاح API</label>
                  <input
                    type="password"
                    value={newGeminiKey.apiKey}
                    onChange={(e) => setNewGeminiKey({...newGeminiKey, apiKey: e.target.value})}
                    placeholder="AIzaSy..."
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">النموذج الافتراضي</label>
                <select
                  value={newGeminiKey.model}
                  onChange={(e) => setNewGeminiKey({...newGeminiKey, model: e.target.value})}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model} {model.includes('2.5') && '🚀'} {model.includes('flash') && '⚡'} {model.includes('pro') && '🧠'}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  سيتم استخدام هذا النموذج كنموذج افتراضي للمفتاح
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف (اختياري)</label>
                <input
                  type="text"
                  value={newGeminiKey.description}
                  onChange={(e) => setNewGeminiKey({...newGeminiKey, description: e.target.value})}
                  placeholder="وصف المفتاح..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeAddGeminiKeyModal}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddGeminiKey}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  إضافة المفتاح
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Library Modal */}
      {showPromptLibrary && (
        <PromptLibraryModal 
          onSelect={handleSelectPromptFromLibrary}
          onClose={() => setShowPromptLibrary(false)}
        />
      )}
      </div>
    </div>
  );
};

// Simple Prompt Library Modal Component
const PromptLibraryModal = ({ onSelect, onClose }: any) => {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    try {
      const response = await fetch(buildApiUrl('prompt-library'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setPrompts(data.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">مكتبة البرومبتات الجاهزة</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
          </div>

          {loading ? (
            <div className="text-center py-8">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prompts.map(prompt => (
                <div key={prompt.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg mb-1">{prompt.nameAr || prompt.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">{prompt.category}</p>
                      <p className="text-sm text-gray-600 mb-3">{prompt.descriptionAr || prompt.description}</p>
                      
                      {/* عرض محتوى البرومبت */}
                      <div className="bg-gray-50 rounded p-3 mb-3 max-h-32 overflow-y-auto">
                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{prompt.promptContent}</p>
                      </div>
                    </div>
                    <span className="text-3xl mr-3">{prompt.icon || '🤖'}</span>
                  </div>
                  <button
                    onClick={() => onSelect(prompt)}
                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    اختيار هذا البرومبت
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIManagement;
