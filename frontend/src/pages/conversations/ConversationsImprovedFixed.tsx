import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PaperAirplaneIcon,
  FaceSmileIcon,
  PaperClipIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  VideoCameraIcon,
  InformationCircleIcon,
  ChatBubbleLeftRightIcon,
  ShoppingCartIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  UserIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

import useSocket from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuthSimple';
import { useCompany } from '../../contexts/CompanyContext';
import { companyAwareApi } from '../../services/companyAwareApi';
import { apiClient } from '../../services/apiClient';
import { uploadService } from '../../services/uploadService';
import { socketService } from '../../services/socketService';
import { apiService } from '../../services/apiService';
import CompanyProtectedRoute from '../../components/protection/CompanyProtectedRoute';
import OrderModal from '../../components/orders/OrderModal';
import CustomerProfile from '../../components/conversations/CustomerProfile';
import { getImageUrl } from '../../utils/urlConverter';
import { buildApiUrl } from '../../utils/urlHelper';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  isFromCustomer: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  conversationId: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  attachments?: any;
  isAiGenerated?: boolean; // للتمييز بين الرسائل اليدوية ورسائل الذكاء الصناعي
  replyToResolvedMessageId?: string;
  replyToContentSnippet?: string;
  replyToSenderIsCustomer?: boolean;
  replyToType?: string;
  replyToFacebookMessageId?: string;
}

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline?: boolean;
  platform: 'facebook' | 'whatsapp' | 'telegram' | 'unknown';
  channel?: string; // For backend compatibility
  messages: Message[];
  aiEnabled?: boolean; // حالة الذكاء الاصطناعي
  pageName?: string; // اسم صفحة الفيسبوك
  pageId?: string; // معرف صفحة الفيسبوك
  lastMessageIsFromCustomer?: boolean; // هل آخر رسالة من العميل
  hasUnreadMessages?: boolean; // هل فيه رسائل غير مقروءة من العميل
  lastCustomerMessageIsUnread?: boolean; // هل آخر رسالة عميل غير مقروءة
  adSource?: { // ✅ معلومات الإعلان
    type?: string;
    source?: string;
    adId?: string;
    ref?: string;
    adRef?: string;
  } | null;
  postId?: string; // 🆕 معرف المنشور
  postDetails?: { // 🆕 تفاصيل المنشور
    postId?: string;
    message?: string;
    permalinkUrl?: string;
    fullPicture?: string;
    hasImages?: boolean;
    imageUrls?: string[];
  } | null;
}



const ConversationsImprovedFixedContent: React.FC = () => {
  const { t } = useTranslation();

  // Authentication & Company
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { company, companyId, getCompanyFilter } = useCompany();

  // الحالات الأساسية
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // حالات البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('');
  // tabs: all | unread (أي محادثة بها رسائل غير مقروءة) | unreplied (آخر رسالة من العميل ولم يتم الرد عليها)
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'unreplied' | 'telegram'>('all');

  // حالة الرسالة الجديدة
  const [newMessage, setNewMessage] = useState('');

  // Socket.IO للرسائل الفورية
  const { socket, isConnected, isReconnecting, emit, on, off } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  // التحكم في التمرير التلقائي: مفعّل فقط عندما يكون المستخدم قريب من الأسفل
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [loadingOldMessages, setLoadingOldMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [messagesPage, setMessagesPage] = useState(1);

  // حالات pagination للمحادثات
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [conversationsPage, setConversationsPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [totalConversations, setTotalConversations] = useState(0);
  // ⬆️ زيادة عدد المحادثات في كل صفحة إلى 200 بدلاً من 50
  const conversationsLimit = 200; // عدد المحادثات في كل صفحة

  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);

  // حالة تحميل الرسائل للبحث
  const [loadingMessagesForSearch, setLoadingMessagesForSearch] = useState<Set<string>>(new Set());

  // حالات الطلبات
  const [showOrderModal, setShowOrderModal] = useState(false);

  // حالات ملف العميل
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);

  // حالات الحظر
  const [isBlocked, setIsBlocked] = useState(false);
  const [checkingBlockStatus, setCheckingBlockStatus] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // حالات الحذف
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // حالات التحكم في الذكاء الاصطناعي
  const [togglingAI, setTogglingAI] = useState<string | null>(null);

  // حالات وضع علامة غير مقروءة
  const [markingAsUnread, setMarkingAsUnread] = useState<string | null>(null);

  // حالات الـ Emoji Picker
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // حالة السحب والإفلات (Drag & Drop)
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // حالات حافظة الصور
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [savedImages, setSavedImages] = useState<Array<{
    id: string;
    url: string;
    filename: string;
    uploadedAt: Date;
  }>>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // تخزين معلومات الصور المرفوعة (للحفظ في الحافظة لاحقاً)
  const [uploadedFilesInfo, setUploadedFilesInfo] = useState<Array<{
    file: File;
    preview: string;
    uploadedUrl?: string;
    filename?: string;
  }>>([]);

  // حالة رفع صور للحافظة مباشرة
  const [uploadingToGallery, setUploadingToGallery] = useState(false);

  // حالة حذف صورة من الحافظة
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  // حالة الصور المختارة للإرسال المتعدد
  const [selectedImagesForSend, setSelectedImagesForSend] = useState<Set<string>>(new Set());
  const [sendingMultipleImages, setSendingMultipleImages] = useState(false);

  // حالة إرسال الرسالة
  const [sending, setSending] = useState(false);

  // حالات حافظة النصوص
  const [showTextGallery, setShowTextGallery] = useState(false);
  const [savedTexts, setSavedTexts] = useState<Array<{
    id: string;
    title: string;
    content: string;
    imageUrls?: string[];
    isPinned?: boolean;
    createdAt: Date;
  }>>([]);
  const [pinningTextId, setPinningTextId] = useState<string | null>(null);
  const [loadingTextGallery, setLoadingTextGallery] = useState(false);
  const [deletingTextId, setDeletingTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [newTextTitle, setNewTextTitle] = useState('');
  const [newTextContent, setNewTextContent] = useState('');
  const [newTextImages, setNewTextImages] = useState<File[]>([]);
  const [newTextImagePreviews, setNewTextImagePreviews] = useState<string[]>([]);
  const [editingTextImages, setEditingTextImages] = useState<File[]>([]);
  const [editingTextImagePreviews, setEditingTextImagePreviews] = useState<string[]>([]);
  const [editingTextExistingImages, setEditingTextExistingImages] = useState<string[]>([]);
  const [savingText, setSavingText] = useState(false);
  const [updatingText, setUpdatingText] = useState(false);

  // المراجع
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const conversationsListRef = useRef<HTMLDivElement>(null);
  const aiTypingTimeoutRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const currentConversationIdRef = useRef<string | null>(null); // لتتبع المحادثة الحالية ومنع race conditions
  const hasAutoSelectedRef = useRef<boolean>(false); // لتتبع ما إذا تم اختيار محادثة تلقائياً في التحميل الأولي

  // تحميل المحادثات من API مع العزل
  const loadConversations = async (page = 1, append = false, silent = false) => {
    try {
      if (!silent) {
        if (!append) {
          setLoading(true);
        } else {
          setLoadingMoreConversations(true);
        }
      }
      setError(null);

      // التحقق من المصادقة
      if (!isAuthenticated) {
        throw new Error(t('conversations.mustLogin', 'You must login first'));
      }

      // التحقق من وجود الشركة
      if (!companyId) {
        throw new Error('Company ID not found');
      }

      if (!silent) {
        console.log('🔄 Loading conversations from API...');
        console.log('🏢 Company ID:', companyId);
        console.log('📄 Page:', page, 'Limit:', conversationsLimit);
      }

      // استخدام Company-Aware API مع pagination
      const response = await companyAwareApi.getConversations({
        page: page,
        limit: conversationsLimit,
        platform: 'facebook' // ✅ FIX: Enforce Facebook only
      });

      if (!response.data) {
        throw new Error('No data in response');
      }

      const result = response.data;
      if (!silent) {
        console.log('✅ Conversations loaded successfully:', result);
      }

      // استخراج البيانات من الاستجابة
      const data = result.data || result || [];
      const pagination = result.pagination || {};

      if (!silent) {
        console.log('📊 Conversations data:', data.length);
        console.log('📋 Pagination info:', pagination);
        console.log('📋 First conversation sample:', data[0]);
      }

      // تحديث معلومات الـ pagination
      if (pagination.total !== undefined) {
        setTotalConversations(pagination.total);
      }
      if (pagination.hasNextPage !== undefined) {
        setHasMoreConversations(pagination.hasNextPage);
      }

      // تحويل البيانات للتنسيق المطلوب
      const formattedConversations = data.map((conv: any) => {
        if (!silent) {
          console.log('🔍 [CONVERSATION-DEBUG] Processing conversation:', conv.id, 'lastMessageIsFromCustomer:', conv.lastMessageIsFromCustomer, 'lastCustomerMessageIsUnread:', conv.lastCustomerMessageIsUnread);
        }
        return {
          id: conv.id,
          customerId: conv.customerId || conv.id,
          customerName: conv.customerName || conv.customerId || 'عميل غير معروف',
          lastMessage: conv.lastMessage || 'لا توجد رسائل',
          lastMessageTime: new Date(conv.lastMessageTime || conv.lastMessageAt || Date.now()),
          unreadCount: conv.unreadCount || 0,
          lastMessageIsFromCustomer: conv.lastMessageIsFromCustomer || false, // 🆕 هل آخر رسالة من العميل
          hasUnreadMessages: (conv.unreadCount || 0) > 0,
          // ✅ FIX: نعتمد على lastCustomerMessageIsUnread من الـ API مباشرة
          // لكن إذا كان lastMessageIsFromCustomer = true، نعتبر lastCustomerMessageIsUnread = true
          // (بغض النظر عن unreadCount - لأن المحادثة قد تكون مفتوحة وقرأناها لكن لم نرد عليها)
          // هذا يضمن أن المحادثات غير المرد عليها تبقى في القائمة حتى بعد فتحها وقراءتها
          lastCustomerMessageIsUnread: (conv.lastMessageIsFromCustomer === true)
            ? true  // إذا كان آخر رسالة من العميل، فهي غير م replied عليها حتى لو كان الـ API يقول غير ذلك
            : (conv.lastCustomerMessageIsUnread === true), // إذا كان آخر رسالة من الموظف، نعتمد على الـ API
          platform: (conv.platform || conv.channel || 'unknown') as Conversation['platform'],
          isOnline: false, // سنحدثها لاحقاً مع Socket.IO
          messages: [],
          aiEnabled: conv.aiEnabled !== undefined ? conv.aiEnabled : true, // إضافة حالة AI
          pageName: conv.pageName || null, // إضافة اسم الصفحة
          pageId: conv.pageId || null, // إضافة معرف الصفحة
          adSource: conv.adSource || null, // ✅ إضافة معلومات الإعلان
          // 🆕 Extract postId from metadata
          postId: (() => {
            try {
              if (conv.metadata) {
                const metadata = typeof conv.metadata === 'string' ? JSON.parse(conv.metadata) : conv.metadata;
                const extractedPostId = metadata?.postId || null;
                if (extractedPostId && !silent) {
                  console.log(`✅ [POST-REF] Extracted postId from conversation ${conv.id}: ${extractedPostId}`);
                } else if (!silent) {
                  // Log metadata structure for debugging (occasionally)
                  if (conv.id === 'cmi0lxvdh009zjutenav64krl' || Math.random() < 0.1) {
                    console.log(`🔍 [POST-REF] Conversation ${conv.id} metadata:`, metadata);
                    console.log(`🔍 [POST-REF] Metadata keys:`, Object.keys(metadata));
                  }
                }
                return extractedPostId;
              } else if (!silent) {
                console.log(`ℹ️ [POST-REF] Conversation ${conv.id} has no metadata`);
              }
            } catch (e) {
              console.warn('⚠️ [POST-REF] Failed to parse metadata for postId:', e);
              console.warn('⚠️ [POST-REF] Raw metadata:', conv.metadata);
            }
            return null;
          })(),
          postDetails: null // Will be fetched when conversation is selected
        };
      });

      // ✅ FIX: إضافة أو استبدال المحادثات مع دمج ذكي للمحادثات الجديدة
      if (append) {
        setConversations(prev => {
          // دمج المحادثات مع تجنب التكرار
          const existingIds = new Set(prev.map(c => c.id));
          const newConversations = formattedConversations.filter(c => !existingIds.has(c.id));
          return [...prev, ...newConversations];
        });
        setConversationsPage(page);
      } else {
        // ✅ FIX: عند refresh، ندمج المحادثات الجديدة مع الموجودة لتجنب فقدان المحادثات المفتوحة
        // ✅ FIX: أيضاً نزيل أي محادثات من شركات أخرى قد تكون موجودة
        setConversations(prev => {
          // إنشاء map للمحادثات الجديدة من السيرفر (هذه محادثات الشركة الحالية فقط)
          const newConversationsMap = new Set(formattedConversations.map(c => c.id));

          // ✅ FIX: إزالة أي محادثات من القائمة القديمة التي لا توجد في القائمة الجديدة
          // (هذا يزيل المحادثات من شركات أخرى التي قد تكون أضيفت من Socket.IO)
          const validPrevConversations = prev.filter(oldConv => {
            // نحتفظ فقط بالمحادثات الموجودة في القائمة الجديدة أو المحادثة المختارة حالياً
            return newConversationsMap.has(oldConv.id) || oldConv.id === selectedConversation?.id;
          });

          // دمج المحادثات: نستخدم الجديدة من السيرفر، ونحتفظ بالقديمة التي لم تأت في الاستجابة
          // لكن فقط إذا كانت المحادثة المختارة حالياً (للمحافظة على الرسائل المحملة)
          const merged = formattedConversations.map(newConv => {
            const existing = validPrevConversations.find(c => c.id === newConv.id);

            if (existing) {
              // ✅ FIX: مقارنة الوقت - إذا كانت البيانات الموجودة أحدث من السيرفر، نحتفظ بها
              const existingTime = existing.lastMessageTime ? new Date(existing.lastMessageTime).getTime() : 0;
              const newTime = new Date(newConv.lastMessageTime).getTime();
              const existingIsNewer = existingTime > newTime;

              if (!silent && existingIsNewer) {
                console.log(`🔄 [REFRESH-MERGE] Conv ${newConv.id}: Keeping newer data from Socket.IO`, {
                  existingTime: new Date(existingTime).toISOString(),
                  newTime: new Date(newTime).toISOString(),
                  existingIsFromCustomer: existing.lastMessageIsFromCustomer,
                  newIsFromCustomer: newConv.lastMessageIsFromCustomer
                });
              }

              return {
                ...newConv,
                messages: existing.messages && existing.messages.length > 0 ? existing.messages : newConv.messages,
                // ✅ FIX: الحفاظ على البيانات الأحدث من Socket.IO
                lastMessage: existingIsNewer ? existing.lastMessage : newConv.lastMessage,
                lastMessageTime: existingIsNewer ? existing.lastMessageTime : newConv.lastMessageTime,
                lastMessageIsFromCustomer: existingIsNewer ? existing.lastMessageIsFromCustomer : newConv.lastMessageIsFromCustomer,
                lastCustomerMessageIsUnread: existingIsNewer ? existing.lastCustomerMessageIsUnread : newConv.lastCustomerMessageIsUnread,
                // ✅ FIX: الحفاظ على unreadCount من Socket.IO إذا كانت البيانات أحدث
                unreadCount: existingIsNewer ? existing.unreadCount : newConv.unreadCount
              };
            }
            return newConv;
          });

          // إضافة محادثة قديمة لم تأت في الاستجابة الجديدة (فقط إذا كانت مفتوحة)
          const selectedId = selectedConversation?.id;
          validPrevConversations.forEach(oldConv => {
            if (!newConversationsMap.has(oldConv.id) && oldConv.id === selectedId) {
              // إذا كانت المحادثة المختارة لم تأت في الاستجابة، نضيفها
              merged.push(oldConv);
            }
          });

          // ترتيب المحادثات حسب lastMessageTime
          return merged.sort((a, b) => {
            const timeA = new Date(a.lastMessageTime).getTime();
            const timeB = new Date(b.lastMessageTime).getTime();
            return timeB - timeA; // الأحدث أولاً
          });
        });
        setConversationsPage(1);
      }

      if (!silent) {
        console.log('✅ Conversations loaded:', formattedConversations.length);
        console.log('📊 Total conversations:', pagination.total || formattedConversations.length);
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      if (!silent) {
        setError(t('conversations.loadingError', 'Failed to load conversations'));
      }
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMoreConversations(false);
      }
    }
  };

  // تحميل محادثة محددة من الخادم
  const loadSpecificConversation = async (conversationId: string, autoSelect: boolean = true) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('رمز المصادقة غير موجود');
      }

      // ✅ FIX: التحقق من وجود companyId قبل التحميل
      if (!companyId) {
        console.warn('⚠️ [LOAD-SPECIFIC] Company ID not found, skipping conversation load');
        return;
      }

      console.log('🔄 Loading specific conversation:', conversationId);

      // ✅ FIX: جلب المحادثة والرسائل معاً في parallel
      const [conversationResponse, messagesResponse] = await Promise.all([
        fetch(buildApiUrl(`conversations/${conversationId}`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(buildApiUrl(`conversations/${conversationId}/messages?page=1&limit=50`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (!conversationResponse.ok) {
        if (conversationResponse.status === 403 || conversationResponse.status === 404) {
          console.warn(`⚠️ [LOAD-SPECIFIC] Conversation ${conversationId} not accessible (403/404) - likely different company`);
          return; // تجاهل المحادثة إذا كانت من شركة أخرى
        }
        throw new Error(`HTTP error! status: ${conversationResponse.status}`);
      }

      const conversationResult = await conversationResponse.json();
      console.log('✅ Specific conversation loaded:', conversationResult);

      if (conversationResult.success && conversationResult.data) {
        const conv = conversationResult.data;

        // ✅ FIX: التحقق من أن المحادثة تخص نفس الشركة
        const convCompanyId = conv.companyId;
        if (convCompanyId && companyId && String(convCompanyId) !== String(companyId)) {
          console.warn(`🔕 [LOAD-SPECIFIC] Ignoring conversation from different company:`, {
            conversationId: conversationId,
            convCompanyId: convCompanyId,
            currentCompanyId: companyId
          });
          return; // تجاهل المحادثة إذا كانت من شركة أخرى
        }

        // ✅ جلب الرسائل إذا كان الـ request نجح
        let messages: Message[] = [];
        if (messagesResponse.ok) {
          const messagesResult = await messagesResponse.json();
          const messagesData = messagesResult.data || messagesResult || [];

          messages = messagesData.map((msg: any) => {
            let isAiGenerated = false;
            if (msg.metadata) {
              try {
                const md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
                isAiGenerated = md.isAIGenerated || md.isAutoGenerated || md.source === 'ai_agent' || false;
              } catch (e) {
                console.warn('⚠️ Failed to parse metadata for message:', msg.id);
              }
            }

            let senderName = 'العميل';
            if (!msg.isFromCustomer) {
              if (isAiGenerated) {
                senderName = 'الذكاء الاصطناعي';
              } else if (msg.sender?.name) {
                senderName = msg.sender.name;
              } else {
                senderName = 'موظف';
              }
            }

            return {
              id: msg.id,
              content: msg.content || '',
              senderId: msg.senderId || msg.sender?.id || '',
              senderName: senderName,
              timestamp: new Date(msg.createdAt || msg.timestamp || Date.now()),
              type: (msg.type || 'text') as Message['type'],
              isFromCustomer: msg.isFromCustomer || false,
              status: (msg.status || 'sent') as Message['status'],
              conversationId: conversationId,
              fileUrl: msg.fileUrl,
              fileName: msg.fileName,
              fileSize: msg.fileSize,
              attachments: msg.attachments,
              isAiGenerated: isAiGenerated,
              replyToResolvedMessageId: msg.replyToResolvedMessageId,
              replyToContentSnippet: msg.replyToContentSnippet,
              replyToSenderIsCustomer: msg.replyToSenderIsCustomer,
              replyToType: msg.replyToType,
              replyToFacebookMessageId: msg.replyToFacebookMessageId
            };
          });

          console.log(`✅ Loaded ${messages.length} messages for conversation ${conversationId}`);
        } else {
          console.warn('⚠️ Failed to load messages, conversation will be added without messages');
        }

        // ✅ FIX: استخدام آخر رسالة من الرسائل المحملة إذا كان lastMessage فارغ
        const lastLoadedMessage = messages.length > 0 ? messages[messages.length - 1] : null;
        const actualLastMessage = conv.lastMessage ||
          (lastLoadedMessage ? lastLoadedMessage.content : 'لا توجد رسائل');

        // ✅ FIX: استخدام isFromCustomer من آخر رسالة محملة بدلاً من السيرفر
        // لأن السيرفر أحياناً يرجع قيمة قديمة أو خاطئة
        const actualLastMessageIsFromCustomer = lastLoadedMessage
          ? lastLoadedMessage.isFromCustomer
          : (conv.lastMessageIsFromCustomer || false);

        // ✅ FIX: حساب lastCustomerMessageIsUnread بناءً على الرسائل المحملة
        // إذا كان آخر رسالة من العميل، فهذا يعني أنه لم يتم الرد عليها بعد
        // إذا كان آخر رسالة من الموظف، فهذا يعني أنه تم الرد
        let calculatedLastCustomerMessageIsUnread = false;
        if (messages.length > 0) {
          // إذا كان آخر رسالة من العميل، فهي غير م replied عليها
          calculatedLastCustomerMessageIsUnread = actualLastMessageIsFromCustomer === true;
        } else {
          // إذا لم تكن هناك رسائل محملة، نعتمد على القيمة من الـ API أو lastMessageIsFromCustomer
          calculatedLastCustomerMessageIsUnread = actualLastMessageIsFromCustomer === true;
        }

        // ✅ FIX: نعتمد على lastCustomerMessageIsUnread من الـ API إذا كان محدداً
        // لكن إذا كان actualLastMessageIsFromCustomer = true، نعتبر lastCustomerMessageIsUnread = true
        // (بغض النظر عن unreadCount - لأن المحادثة قد تكون مفتوحة وقرأناها لكن لم نرد عليها)
        // هذا يضمن أن المحادثات غير المرد عليها تبقى في القائمة حتى بعد فتحها وقراءتها
        const finalLastCustomerMessageIsUnread = (actualLastMessageIsFromCustomer === true)
          ? true  // إذا كان آخر رسالة من العميل، فهي غير م replied عليها حتى لو كان الـ API يقول غير ذلك
          : (conv.lastCustomerMessageIsUnread === true); // إذا كان آخر رسالة من الموظف، نعتمد على الـ API

        console.log(`🔍 [LOAD-SPECIFIC] Conv ${conversationId}:`, {
          serverIsFromCustomer: conv.lastMessageIsFromCustomer,
          lastLoadedMsgIsFromCustomer: lastLoadedMessage?.isFromCustomer,
          actualIsFromCustomer: actualLastMessageIsFromCustomer,
          lastMessage: actualLastMessage.substring(0, 50),
          serverLastCustomerMessageIsUnread: conv.lastCustomerMessageIsUnread,
          calculatedLastCustomerMessageIsUnread: calculatedLastCustomerMessageIsUnread,
          finalLastCustomerMessageIsUnread: finalLastCustomerMessageIsUnread
        });

        const formattedConversation: Conversation = {
          id: conv.id,
          customerId: conv.customerId || conv.id,
          customerName: conv.customerName || conv.customerId || 'عميل غير معروف',
          lastMessage: actualLastMessage,
          lastMessageTime: new Date(conv.lastMessageTime || conv.lastMessageAt || Date.now()),
          unreadCount: conv.unreadCount || 0,
          platform: (conv.platform || conv.channel || 'unknown') as Conversation['platform'],
          isOnline: false,
          messages: messages, // ✅ إضافة الرسائل المحملة
          lastMessageIsFromCustomer: actualLastMessageIsFromCustomer,
          // ✅ FIX: نعتمد على lastCustomerMessageIsUnread من الـ API أو نحسبه من الرسائل
          lastCustomerMessageIsUnread: finalLastCustomerMessageIsUnread,
          aiEnabled: conv.aiEnabled !== undefined ? conv.aiEnabled : true,
          pageName: conv.pageName || null,
          pageId: conv.pageId || null,
          adSource: conv.adSource || null,
          postId: (() => {
            try {
              if (conv.metadata) {
                const metadata = typeof conv.metadata === 'string' ? JSON.parse(conv.metadata) : conv.metadata;
                return metadata?.postId || null;
              }
            } catch (e) {
              console.warn('⚠️ Failed to parse metadata for postId:', e);
            }
            return null;
          })(),
          postDetails: null
        };

        // إضافة المحادثة للقائمة إذا لم تكن موجودة
        setConversations(prev => {
          const exists = prev.find(c => c.id === conversationId);
          if (!exists) {
            console.log(`✅ Adding conversation ${conversationId} to list with ${messages.length} messages`);
            return [formattedConversation, ...prev];
          } else {
            // ✅ تحديث المحادثة الموجودة بالرسائل الجديدة
            console.log(`✅ Updating existing conversation ${conversationId} with ${messages.length} messages`);
            return prev.map(c => {
              if (c.id === conversationId) {
                // ✅ FIX: الحفاظ على lastMessage الموجود إذا كان السيرفر يرجع "لا توجد رسائل"
                const shouldKeepExistingLastMessage =
                  formattedConversation.lastMessage === 'لا توجد رسائل' &&
                  c.lastMessage &&
                  c.lastMessage !== 'لا توجد رسائل';

                // ✅ FIX: الحفاظ على lastMessageIsFromCustomer من Socket.IO إذا كانت أحدث أو متساوية
                const existingTime = c.lastMessageTime ? new Date(c.lastMessageTime).getTime() : 0;
                const newTime = new Date(formattedConversation.lastMessageTime).getTime();
                const shouldKeepExistingIsFromCustomer =
                  c.lastMessage &&
                  c.lastMessage !== 'لا توجد رسائل' &&
                  existingTime >= newTime;  // ✅ FIX: >= بدلاً من > للحفاظ على البيانات حتى لو الوقت متساوي

                // ✅ FIX: الحفاظ على unreadCount من Socket.IO دائماً إذا كان موجود
                // لأن السيرفر دائماً بيرجع 0 (قديمة)
                const shouldKeepUnreadCount = (c.unreadCount !== undefined && c.unreadCount > 0);

                console.log(`🔄 [LOAD-SPECIFIC-UPDATE] Conv ${conversationId}:`, {
                  existingMsg: c.lastMessage?.substring(0, 30),
                  existingIsFromCustomer: c.lastMessageIsFromCustomer,
                  existingUnreadCount: c.unreadCount,
                  existingTime: new Date(existingTime).toISOString(),
                  existingPageName: c.pageName,
                  newIsFromCustomer: formattedConversation.lastMessageIsFromCustomer,
                  newUnreadCount: formattedConversation.unreadCount,
                  newTime: new Date(newTime).toISOString(),
                  newPageName: formattedConversation.pageName,
                  shouldKeepIsFromCustomer: shouldKeepExistingIsFromCustomer,
                  shouldKeepUnreadCount: shouldKeepUnreadCount
                });

                return {
                  ...formattedConversation,
                  lastMessage: shouldKeepExistingLastMessage ? c.lastMessage : formattedConversation.lastMessage,
                  lastMessageIsFromCustomer: shouldKeepExistingIsFromCustomer ? c.lastMessageIsFromCustomer : formattedConversation.lastMessageIsFromCustomer,
                  lastMessageTime: shouldKeepExistingIsFromCustomer ? c.lastMessageTime : formattedConversation.lastMessageTime,
                  // ✅ FIX: الحفاظ على unreadCount من Socket.IO دائماً إذا كان موجود
                  unreadCount: shouldKeepUnreadCount ? c.unreadCount : formattedConversation.unreadCount,
                  lastCustomerMessageIsUnread: shouldKeepUnreadCount ? c.lastCustomerMessageIsUnread : formattedConversation.lastCustomerMessageIsUnread,
                  // ✅ FIX: الحفاظ على pageName و pageId من Socket.IO إذا كانت موجودة
                  pageName: c.pageName || formattedConversation.pageName,
                  pageId: c.pageId || formattedConversation.pageId
                };
              }
              return c;
            });
          }
        });

        // اختيار المحادثة فقط إذا كان autoSelect = true
        if (autoSelect) {
          console.log('✅ Selecting loaded conversation:', conversationId);
          selectConversation(conversationId);
        } else {
          console.log('✅ Conversation loaded but not auto-selected (autoSelect=false)');
        }
      } else {
        console.error('❌ Failed to load specific conversation:', conversationResult);
        console.log('⚠️ Conversation load failed, not auto-selecting');
      }
    } catch (error) {
      console.error('❌ Error loading specific conversation:', error);
      console.log('⚠️ Conversation load error, not auto-selecting');
    }
  };

  // تحميل الرسائل لمحادثة محددة
  const loadMessages = async (conversationId: string, page: number = 1, append: boolean = false) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('رمز المصادقة غير موجود');
      }

      console.log('🔄 Loading messages for conversation:', conversationId, 'page:', page);

      // ✅ FIX: تحقق من أن المحادثة الحالية لم تتغير قبل البدء
      if (currentConversationIdRef.current !== conversationId) {
        console.log('⚠️ [LOAD-MESSAGES] Conversation changed before loading, aborting');
        return;
      }

      const response = await fetch(buildApiUrl(`conversations/${conversationId}/messages?page=${page}&limit=50`), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // ✅ FIX: تحقق مرة أخرى قبل معالجة الاستجابة
      if (currentConversationIdRef.current !== conversationId) {
        console.log('⚠️ [LOAD-MESSAGES] Conversation changed after fetch, aborting');
        return;
      }

      const result = await response.json();
      const data = result.data || result || [];
      const messages: Message[] = data.map((msg: any) => {
        let isAiGenerated = false;
        let md: any = null;
        if (msg.metadata) {
          try {
            md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
            isAiGenerated = md.isAIGenerated || md.isAutoGenerated || md.source === 'ai_agent' || false;
          } catch (e) {
            console.warn('⚠️ Failed to parse metadata for message:', msg.id);
          }
        }

        // تشخيص مؤقت - معطل لتقليل console logs
        if (false && !msg.isFromCustomer && process.env.NODE_ENV === 'development') {
          console.log(`🔍 [MESSAGE-DEBUG] Message ${msg.id}:`, {
            content: msg.content.substring(0, 50) + '...',
            type: msg.type,
            isAiGenerated: isAiGenerated,
            hasMetadata: !!msg.metadata,
            senderName: msg.sender?.name || 'غير معروف',
            fileUrl: msg.fileUrl,
            fileName: msg.fileName,
            hasAttachments: !!(msg.attachments && msg.attachments.length > 0),
            metadata: msg.metadata ? (typeof msg.metadata === 'string' ? msg.metadata.substring(0, 100) + '...' : JSON.stringify(msg.metadata).substring(0, 100) + '...') : null
          });
        }

        // تحديد اسم المرسل بشكل صحيح
        let senderName = 'العميل';
        if (!msg.isFromCustomer) {
          if (isAiGenerated) {
            senderName = 'الذكاء الاصطناعي';
          } else if (msg.sender?.name) {
            senderName = msg.sender.name; // اسم الموظف من الخادم
          } else {
            senderName = 'موظف'; // افتراضي إذا لم يكن هناك اسم
          }
        }

        // تطبيع رابط الملف/الصورة للرسائل القديمة
        const msgType = (msg.type || 'text').toString().toLowerCase();
        let normalizedFileUrl = msg.fileUrl;
        if (!normalizedFileUrl && typeof msg.content === 'string') {
          if (msg.content.startsWith('/uploads') || msg.content.startsWith('uploads/')) {
            normalizedFileUrl = buildApiUrl(msg.content.replace(/^\//, ''));
          } else if (/^https?:\/\//i.test(msg.content)) {
            normalizedFileUrl = msg.content;
          }
        } else if (normalizedFileUrl && !/^https?:\/\//i.test(normalizedFileUrl)) {
          // لو الرابط نسبي من الـ API
          if (normalizedFileUrl.startsWith('/uploads') || normalizedFileUrl.startsWith('uploads/')) {
            normalizedFileUrl = buildApiUrl(normalizedFileUrl.replace(/^\//, ''));
          }
        }

        return {
          id: msg.id,
          content: msg.content,
          senderId: msg.sender?.id || 'unknown',
          senderName: senderName,
          timestamp: new Date(msg.timestamp),
          type: msg.type || 'text',
          isFromCustomer: msg.isFromCustomer,
          status: 'delivered',
          conversationId: conversationId,
          isAiGenerated: isAiGenerated, // تحديد نوع الرسالة
          fileUrl: normalizedFileUrl, // إضافة رابط الملف بعد التطبيع
          fileName: msg.fileName, // إضافة اسم الملف
          fileSize: msg.fileSize, // إضافة حجم الملف
          attachments: msg.attachments || [], // إضافة المرفقات
          replyToResolvedMessageId: md?.replyToResolvedMessageId,
          replyToContentSnippet: md?.replyToContentSnippet,
          replyToSenderIsCustomer: md?.replyToSenderIsCustomer,
          replyToType: md?.replyToType,
          replyToFacebookMessageId: md?.replyToFacebookMessageId
        };
      });

      // إحصائيات مؤقتة للتشخيص
      const customerMessages = messages.filter(m => m.isFromCustomer).length;
      const aiMessages = messages.filter(m => !m.isFromCustomer && m.isAiGenerated).length;
      const manualMessages = messages.filter(m => !m.isFromCustomer && !m.isAiGenerated).length;

      console.log('✅ Messages loaded:', messages.length);
      console.log('📊 [FRONTEND-STATS] إحصائيات الرسائل:');
      console.log(`   👤 ${customerMessages} من العملاء`);
      console.log(`   🤖 ${aiMessages} من الذكاء الصناعي`);
      console.log(`   👨‍💼 ${manualMessages} يدوية`);

      // تسجيل الرسائل التي تحتوي على reply
      const messagesWithReply = messages.filter(m => m.replyToContentSnippet || m.replyToFacebookMessageId);
      if (messagesWithReply.length > 0) {
        console.log(`💬 [REPLY-DEBUG] Found ${messagesWithReply.length} messages with reply:`,
          messagesWithReply.map(m => ({
            id: m.id,
            content: m.content?.substring(0, 30),
            replyToSnippet: m.replyToContentSnippet,
            replyToMid: m.replyToFacebookMessageId
          }))
        );
      }

      // تحديث المحادثة المختارة بالرسائل
      setSelectedConversation(prev => {
        if (!prev) return null;

        if (append) {
          // إضافة رسائل قديمة في البداية
          return {
            ...prev,
            messages: [...messages, ...(prev.messages || [])]
          };
        } else {
          // تحميل رسائل جديدة - نحتاج للحفاظ على الرسائل الجديدة التي لم تُحفظ بعد
          const existingMessages = prev.messages || [];
          const newMessages = messages || [];

          // البحث عن الرسائل الجديدة التي لا توجد في الرسائل المحملة
          const latestMessageFromServer = newMessages.length > 0 ? new Date(newMessages[newMessages.length - 1].timestamp) : new Date(0);
          const recentMessages = existingMessages.filter(msg =>
            new Date(msg.timestamp) > latestMessageFromServer
          );

          console.log('🔄 [LOAD-MESSAGES] Merging messages:', {
            fromServer: newMessages.length,
            existing: existingMessages.length,
            recent: recentMessages.length,
            latestFromServer: latestMessageFromServer
          });

          return {
            ...prev,
            messages: [...newMessages, ...recentMessages]
          };
        }
      });

      // تحديث حالة وجود رسائل أقدم
      setHasMoreMessages(messages.length === 50); // إذا كان عدد الرسائل أقل من 50، فلا توجد رسائل أقدم

      if (!append) {
        // التمرير للأسفل بعد تحميل الرسائل الجديدة فقط إذا كان المستخدم في الأسفل
        setTimeout(() => {
          const container = messagesContainerRef.current;
          if (container) {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
            // فقط إذا كان المستخدم في الأسفل، نمرر تلقائياً
            if (isAtBottom) {
              scrollToBottom();
            }
          }
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  // تحميل الرسائل القديمة
  const loadOldMessages = async () => {
    if (!selectedConversation || loadingOldMessages || !hasMoreMessages) return;

    setLoadingOldMessages(true);
    const nextPage = messagesPage + 1;

    try {
      console.log('🔄 Loading old messages, page:', nextPage);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers: HeadersInit = token
        ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
      const response = await fetch(buildApiUrl(`conversations/${selectedConversation.id}/messages?page=${nextPage}&limit=50`), {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const data = result.data || result || [];

      if (data.length > 0) {
        const oldMessages: Message[] = data.map((msg: any) => {
          let isAiGenerated = msg.isAiGenerated || msg.isAutoGenerated || false;
          let md: any = null;
          if (msg.metadata) {
            try {
              md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
            } catch { }
          }

          // تحديد اسم المرسل بشكل صحيح
          let senderName = 'العميل';
          if (!msg.isFromCustomer) {
            if (isAiGenerated) {
              senderName = 'الذكاء الاصطناعي';
            } else if (msg.sender?.name) {
              senderName = msg.sender.name; // اسم الموظف من الخادم
            } else {
              senderName = 'موظف'; // افتراضي إذا لم يكن هناك اسم
            }
          }

          // تطبيع رابط الملف/الصورة للرسائل القديمة (صفحات قديمة)
          const msgType = (msg.type || 'text').toString().toLowerCase();
          let normalizedFileUrl = msg.fileUrl;
          if (!normalizedFileUrl && typeof msg.content === 'string') {
            if (msg.content.startsWith('/uploads') || msg.content.startsWith('uploads/')) {
              normalizedFileUrl = buildApiUrl(msg.content.replace(/^\//, ''));
            } else if (/^https?:\/\//i.test(msg.content)) {
              normalizedFileUrl = msg.content;
            }
          } else if (normalizedFileUrl && !/^https?:\/\//i.test(normalizedFileUrl)) {
            if (normalizedFileUrl.startsWith('/uploads') || normalizedFileUrl.startsWith('uploads/')) {
              normalizedFileUrl = buildApiUrl(normalizedFileUrl.replace(/^\//, ''));
            }
          }

          return {
            id: msg.id,
            content: msg.content,
            senderId: msg.sender?.id || 'unknown',
            senderName: senderName,
            timestamp: new Date(msg.timestamp),
            type: msg.type || 'text',
            isFromCustomer: msg.isFromCustomer,
            status: 'delivered',
            conversationId: selectedConversation.id,
            isAiGenerated: isAiGenerated,
            replyToResolvedMessageId: md?.replyToResolvedMessageId,
            replyToContentSnippet: md?.replyToContentSnippet,
            replyToSenderIsCustomer: md?.replyToSenderIsCustomer,
            replyToType: md?.replyToType,
            replyToFacebookMessageId: md?.replyToFacebookMessageId,
            fileUrl: normalizedFileUrl,
            fileName: msg.fileName,
            fileSize: msg.fileSize
          };
        });

        console.log('✅ Old messages loaded:', oldMessages.length);

        // إضافة الرسائل القديمة في بداية القائمة مع الحفاظ على موضع التمرير
        let prevScrollHeight = 0;
        let prevScrollTop = 0;
        if (messagesContainerRef.current) {
          prevScrollHeight = messagesContainerRef.current.scrollHeight;
          prevScrollTop = messagesContainerRef.current.scrollTop;
        }

        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: [...oldMessages, ...(prev.messages || [])]
        } : null);

        setMessagesPage(nextPage);
        setHasMoreMessages(oldMessages.length === 50);

        // بعد تحديث الرسائل، اضبط scrollTop للحفاظ على الموضع الحالي
        setTimeout(() => {
          const container = messagesContainerRef.current;
          if (container) {
            const newScrollHeight = container.scrollHeight;
            const addedHeight = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + addedHeight;
          }
        }, 0);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('❌ Error loading old messages:', error);
    } finally {
      setLoadingOldMessages(false);
    }
  };

  // تحميل جميع الرسائل لمحادثة معينة (للبحث)
  const loadAllMessagesForConversation = async (conversationId: string) => {
    // تجنب التحميل المكرر
    if (loadingMessagesForSearch.has(conversationId)) {
      return;
    }

    // التحقق من وجود رسائل محملة بالفعل
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation && conversation.messages && conversation.messages.length > 0) {
      // إذا كانت الرسائل محملة بالفعل، لا نحتاج لإعادة التحميل
      return;
    }

    setLoadingMessagesForSearch(prev => new Set(prev).add(conversationId));

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('رمز المصادقة غير موجود');
      }

      console.log('🔍 [SEARCH] Loading all messages for conversation:', conversationId);

      let allMessages: Message[] = [];
      let page = 1;
      let hasMore = true;

      // تحميل جميع الرسائل باستخدام pagination
      while (hasMore) {
        const response = await fetch(buildApiUrl(`conversations/${conversationId}/messages?page=${page}&limit=50`), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const data = result.data || result || [];

        if (data.length === 0) {
          hasMore = false;
          break;
        }

        const messages: Message[] = data.map((msg: any) => {
          let isAiGenerated = false;
          let md: any = null;
          if (msg.metadata) {
            try {
              md = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
              isAiGenerated = md.isAIGenerated || md.isAutoGenerated || md.source === 'ai_agent' || false;
            } catch (e) {
              console.warn('⚠️ Failed to parse metadata for message:', msg.id);
            }
          }

          let senderName = 'العميل';
          if (!msg.isFromCustomer) {
            if (isAiGenerated) {
              senderName = 'الذكاء الاصطناعي';
            } else if (msg.sender?.name) {
              senderName = msg.sender.name;
            } else {
              senderName = 'موظف';
            }
          }

          let normalizedFileUrl = msg.fileUrl;
          if (!normalizedFileUrl && typeof msg.content === 'string') {
            if (msg.content.startsWith('/uploads') || msg.content.startsWith('uploads/')) {
              normalizedFileUrl = buildApiUrl(msg.content.replace(/^\//, ''));
            } else if (/^https?:\/\//i.test(msg.content)) {
              normalizedFileUrl = msg.content;
            }
          } else if (normalizedFileUrl && !/^https?:\/\//i.test(normalizedFileUrl)) {
            if (normalizedFileUrl.startsWith('/uploads') || normalizedFileUrl.startsWith('uploads/')) {
              normalizedFileUrl = buildApiUrl(normalizedFileUrl.replace(/^\//, ''));
            }
          }

          return {
            id: msg.id,
            content: msg.content,
            senderId: msg.sender?.id || 'unknown',
            senderName: senderName,
            timestamp: new Date(msg.timestamp),
            type: msg.type || 'text',
            isFromCustomer: msg.isFromCustomer,
            status: 'delivered',
            conversationId: conversationId,
            isAiGenerated: isAiGenerated,
            fileUrl: normalizedFileUrl,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            attachments: msg.attachments || [],
            replyToResolvedMessageId: md?.replyToResolvedMessageId,
            replyToContentSnippet: md?.replyToContentSnippet,
            replyToSenderIsCustomer: md?.replyToSenderIsCustomer,
            replyToType: md?.replyToType,
            replyToFacebookMessageId: md?.replyToFacebookMessageId
          };
        });

        allMessages = [...allMessages, ...messages];

        // إذا كان عدد الرسائل أقل من 50، لا توجد رسائل أكثر
        if (messages.length < 50) {
          hasMore = false;
        } else {
          page++;
        }
      }

      console.log(`✅ [SEARCH] Loaded ${allMessages.length} messages for conversation ${conversationId}`);

      // تحديث المحادثة في القائمة بالرسائل المحملة
      setConversations(prev => prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: allMessages
          };
        }
        return conv;
      }));

    } catch (error) {
      console.error('❌ [SEARCH] Error loading all messages for conversation:', error);
    } finally {
      setLoadingMessagesForSearch(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }
  };

  // اختيار محادثة
  // 🆕 Fetch post details for a conversation (lazy loading)
  const fetchPostDetails = async (conversationId: string) => {
    try {
      console.log('📌 [POST-REF] Fetching post details for conversation:', conversationId);
      const response = await companyAwareApi.get(`conversations/${conversationId}/post-details`);

      if (response.status !== 200) {
        // Not an error if post details don't exist
        if (response.status === 404) {
          console.log('ℹ️ [POST-REF] Post details not found (404) - conversation may not have postId');
          return;
        }
        console.error('❌ [POST-REF] Error fetching post details:', response.status);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = response.data;
      console.log('✅ [POST-REF] Post details received:', result);
      if (result.success && result.data) {
        // Update the selected conversation with post details
        setSelectedConversation(prev => prev ? {
          ...prev,
          postDetails: result.data
        } : null);

        // Also update in conversations list
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, postDetails: result.data }
            : conv
        ));
        console.log('✅ [POST-REF] Post details updated in UI');
      } else {
        console.warn('⚠️ [POST-REF] Response not successful:', result);
      }
    } catch (error) {
      console.error('❌ [POST-REF] Error fetching post details:', error);
      // Silently fail - post details are optional
    }
  };

  const selectConversation = async (conversationId: string) => {
    console.log('🎯 selectConversation called with ID:', conversationId);
    console.log('🔍 Available conversations count:', conversations.length);

    // ✅ FIX: تحديث ref للمحادثة الحالية لمنع race conditions
    currentConversationIdRef.current = conversationId;
    // ✅ FIX: تعيين hasAutoSelectedRef لمنع اختيار محادثة جديدة تلقائياً
    hasAutoSelectedRef.current = true;

    const conversation = conversations.find(conv => conv.id === conversationId);
    console.log('🔍 Found conversation:', conversation ? conversation.customerName : 'NOT FOUND');

    if (conversation) {
      console.log('✅ Setting selected conversation:', conversation.customerName);

      // إذا كانت المحادثة محملة بالفعل، احتفظ بالرسائل الموجودة
      if (selectedConversation?.id === conversationId) {
        console.log('🔄 Conversation already selected, keeping existing messages');
        // لا نمرر تلقائياً إذا كان المستخدم يقرأ رسائل قديمة
        // التمرير للأسفل فقط إذا كان المستخدم في الأسفل
        setTimeout(() => {
          const container = messagesContainerRef.current;
          if (container) {
            const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
            // فقط إذا كان المستخدم في الأسفل، نمرر تلقائياً
            if (isAtBottom) {
              scrollToBottom();
            }
          }
        }, 100);
        return; // ✅ FIX: إنهاء الدالة مبكراً إذا كانت نفس المحادثة
      }

      // ✅ FIX: مسح الرسائل فوراً عند التبديل لمنع ظهور المحادثة القديمة
      console.log('🆕 Selecting new conversation');
      setSelectedConversation({
        ...conversation,
        messages: [] // مسح الرسائل القديمة فوراً
      });

      // 🆕 Fetch post details if postId exists (lazy loading)
      console.log('🔍 [POST-REF] Checking for postId in conversation:', {
        conversationId: conversationId,
        hasPostId: !!conversation.postId,
        postId: conversation.postId
      });
      if (conversation.postId) {
        console.log('✅ [POST-REF] postId found, fetching post details...');
        fetchPostDetails(conversationId);
      } else {
        console.log('ℹ️ [POST-REF] No postId in conversation, skipping post details fetch');
      }

      // Reset pagination state for the newly selected conversation
      setMessagesPage(1);
      setHasMoreMessages(true);
      setIsAiTyping(false);
      if (aiTypingTimeoutRef.current) {
        clearTimeout(aiTypingTimeoutRef.current);
        aiTypingTimeoutRef.current = null;
      }

      // تحميل الرسائل إذا لم تكن محملة
      const hasMessages = (conversation.messages || []).length > 0;

      // ✅ FIX: تحميل الرسائل بشكل async مع التحقق من المحادثة الحالية
      if (!hasMessages) {
        console.log('📥 Loading messages for new conversation');
        await loadMessages(conversationId);

        // ✅ التمرير للأسفل فقط عند فتح المحادثة لأول مرة
        if (currentConversationIdRef.current === conversationId) {
          console.log('📜 Auto-scrolling to bottom on initial load');
          setTimeout(() => {
            scrollToBottom();
            // تعطيل auto-scroll بعد السكرول الأولي
            setAutoScrollEnabled(false);
          }, 200);
        }
      } else {
        // نسخ الرسائل الموجودة
        setSelectedConversation({
          ...conversation,
          messages: conversation.messages
        });
        console.log('✅ Messages already available, copying from cache');
        // التمرير للأسفل عند فتح المحادثة
        console.log('📜 Auto-scrolling to bottom on initial load');
        setTimeout(() => {
          scrollToBottom();
          // تعطيل auto-scroll بعد السكرول الأولي
          setAutoScrollEnabled(false);
        }, 200);
      }

      // تحديث URL لتضمين معرف المحادثة
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('conversationId', conversationId);
      window.history.replaceState({}, '', newUrl.toString());

      // ✅ عند فتح المحادثة نضعها كمقروءة (إزالة من تبويب "غير مقروءة")
      if (selectedConversation?.id === conversationId || conversation.unreadCount > 0) {
        // تحديث الـ frontend فوراً
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, unreadCount: 0 }
            : conv
        ));
        setSelectedConversation(prev =>
          prev && prev.id === conversationId ? { ...prev, unreadCount: 0 } : prev
        );
        // استدعاء الـ API لتحديث حالة القراءة في الـ backend
        markConversationAsRead(conversationId);
      }
    } else {
      console.warn('❌ Conversation not found in selectConversation:', conversationId);
      console.log('📝 Available conversation IDs:', conversations.map(c => c.id));
    }
  };

  // 🔧 FIX: تحديد المحادثة كمقروءة في Backend
  const markConversationAsRead = async (conversationId: string) => {
    try {
      const response = await companyAwareApi.post(`conversations/${conversationId}/read`, {});

      if (response.status === 200) {
        const data = response.data;
        console.log(`✅ [MARK-READ] Marked conversation ${conversationId} as read - ${data.markedCount || 0} messages`);
      } else {
        console.warn(`⚠️ [MARK-READ] Failed to mark conversation as read:`, response.status);
      }
    } catch (error) {
      console.error('❌ [MARK-READ] Error marking conversation as read:', error);
    }
  };

  const refreshLastMessageFromServer = async (conversationId: string) => {
    try {
      // use companyAwareApi
      const resp = await companyAwareApi.get(`conversations/${conversationId}/messages`);
      if (resp.status !== 200) return;
      const result = resp.data;
      const arr = result.data || result || [];
      if (!Array.isArray(arr) || arr.length === 0) return;

      let preview: string | null = null;
      let time: any = null;
      for (let i = arr.length - 1; i >= 0; i--) {
        const m = arr[i];
        const t = (m.type || '').toString().toLowerCase();
        if (t === 'image') {
          preview = '📷 صورة';
          time = m.timestamp;
          break;
        } else if (t === 'file') {
          preview = '📎 ملف';
          time = m.timestamp;
          break;
        } else {
          const content = (m.content || '').trim();
          if (content.length >= 1 && !/^[✓✗×\s]+$/.test(content)) {
            preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
            time = m.timestamp;
            break;
          }
        }
      }

      if (preview) {
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, lastMessage: preview as string, lastMessageTime: new Date(time || Date.now()) }
            : conv
        ));
      }
    } catch (e) {
      // ignore
    }
  };

  // إرسال رسالة مع Socket.IO
  const sendMessage = async (customMessage?: string) => {
    const messageContent = customMessage || newMessage.trim();
    if (!messageContent || !selectedConversation || sending) return;

    if (!customMessage) {
      setNewMessage('');
    }
    setSending(true);

    // إنشاء رسالة مؤقتة
    const tempMessage: Message = {
      id: `temp_${Date.now()}`,
      content: messageContent,
      senderId: 'current_user',
      senderName: 'أنت',
      timestamp: new Date(),
      type: 'text',
      isFromCustomer: false,
      status: 'sending',
      conversationId: selectedConversation.id,
      isAiGenerated: false // رسالة يدوية
    };

    // إضافة الرسالة مؤقتاً للواجهة
    setSelectedConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, tempMessage]
    } : null);

    // التمرير للأسفل فقط إذا كان المستخدم في الأسفل بالفعل
    if (autoScrollEnabled) {
      setTimeout(() => scrollToBottom(), 100);
    }

    // ✅ FIX: دعم إرسال الصور مع النص
    const hasSelectedFiles = selectedFiles.length > 0;
    let imageUrls: string[] = [];

    try {

      // إذا كانت هناك ملفات محددة، نرفعها أولاً
      if (hasSelectedFiles) {
        const uploadResult = await uploadService.uploadConversationFiles(selectedConversation.id, selectedFiles);
        if (uploadResult.success && uploadResult.data) {
          imageUrls = Array.isArray(uploadResult.data)
            ? uploadResult.data.map((file: any) => file.fullUrl || file.url)
            : [uploadResult.data.fullUrl || uploadResult.data.url];
          console.log(`📸 Uploaded ${imageUrls.length} image(s) for message`);

          // ✅ FIX: تنظيف الملفات المحددة فوراً بعد رفعها بنجاح
          // لأنها ستُرسل مع الرسالة ولا نحتاجها بعد ذلك
          console.log('🧹 Cleaning selected files after successful upload');
          // تنظيف فوري لضمان إزالة المعاينة
          setSelectedFiles([]);
          setFilePreviews([]);
          // إجبار React على إعادة الرسم
          setTimeout(() => {
            setSelectedFiles([]);
            setFilePreviews([]);
          }, 0);
        } else {
          alert('فشل رفع الصور. يرجى المحاولة مرة أخرى.');
          return;
        }
      }

      // إرسال عبر API فقط (لتجنب التضارب)
      const payload: any = { message: messageContent };
      if (imageUrls.length > 0) {
        payload.imageUrls = imageUrls;
      }
      console.log('🚀 Sending message via companyAwareApi');
      const response = await companyAwareApi.post(`conversations/${selectedConversation.id}/messages`, payload);

      console.log('📡 Response status:', response.status);

      const data = response.data;
      console.log('📤 API Response:', data);

      if (data.success) {
        // ✅ FIX: وضع علامة مقروءة عند إرسال رد
        if (selectedConversation && selectedConversation.unreadCount > 0) {
          markConversationAsRead(selectedConversation.id);
        }

        // ⚡ OPTIMIZATION: نشيل الرسالة المؤقتة ونستنى الـ echo من Facebook
        // الرسالة هتظهر تلقائياً لما الـ echo يجي
        console.log('⏳ Waiting for Facebook echo to save message...');

        // شيل الرسالة المؤقتة
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: (prev.messages || []).filter(msg => msg.id !== tempMessage.id)
        } : null);

        // تحديث قائمة المحادثات بدون إعادة ترتيب (المحادثة تبقى في مكانها)
        setConversations((prev: Conversation[]) => {
          console.log('📤 [SEND-MESSAGE] Updating conversation list WITHOUT reordering');
          console.log('📤 [SEND-MESSAGE] Message from staff, keeping position');
          console.log('📤 [SEND-MESSAGE] NOT updating lastMessageTime to prevent reordering');
          return prev.map((conv: Conversation) =>
            conv.id === selectedConversation.id
              ? {
                ...conv,
                lastMessage: messageContent,
                // 🔧 FIX: لا نحدث lastMessageTime عشان المحادثة متطلعش فوق
                // lastMessageTime: new Date(), // ❌ ده كان السبب!
                lastMessageTime: conv.lastMessageTime, // ✅ نخلي الوقت زي ما هو
                lastMessagePreview: messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent,
                lastMessageIsFromCustomer: false,
                lastCustomerMessageIsUnread: false
              }
              : conv
          );
        });

        // إظهار رسالة نجاح مع معلومات التشخيص
        if (data.facebookSent) {
          console.log('✅ Message sent successfully to Facebook');
        } else {
          console.warn('⚠️ Message saved but not sent to Facebook');
          console.log('Debug info:', data.debug);

          // إظهار تنبيه للمستخدم
          if (data.debug && !data.debug.hasFacebookId) {
            alert(`⚠️ قيد من Facebook:\n\nلا يمكن إرسال رسائل للعملاء إلا إذا قاموا بمراسلتك خلال آخر 24 ساعة.\n\nهذا قيد من سياسات Facebook Messenger وليس من النظام.\n\nالحلول المتاحة:\n• انتظر حتى يراسلك العميل مرة أخرى\n• استخدم قوالب الرسائل المعتمدة من Facebook\n• تواصل مع العميل عبر قناة أخرى`);
          } else if (data.debug && !data.debug.facebookSent) {
            alert(`⚠️ قيد من Facebook:\n\nلا يمكن إرسال رسائل للعملاء إلا إذا قاموا بمراسلتك خلال آخر 24 ساعة.\n\nهذا قيد من سياسات Facebook Messenger وليس من النظام.\n\nالحلول المتاحة:\n• انتظر حتى يراسلك العميل مرة أخرى\n• استخدم قوالب الرسائل المعتمدة من Facebook\n• تواصل مع العميل عبر قناة أخرى`);
          }
        }

        console.log('✅ Message sent successfully!', data);

        // ✅ FIX: تنظيف الملفات المحددة بعد الإرسال الناجح (تأكيد إضافي)
        // (تم التنظيف بالفعل بعد الرفع، لكن نؤكد مرة أخرى)
        if (hasSelectedFiles || selectedFiles.length > 0) {
          console.log('🧹 Final cleanup of selected files after successful send');
          setSelectedFiles([]);
          setFilePreviews([]);
        }

        // إعادة تحميل الرسائل لضمان التزامن
        setTimeout(() => {
          loadMessages(selectedConversation.id);
        }, 500);
      } else {
        // ✅ FIX: تنظيف الملفات حتى في حالة الفشل إذا كانت قد رُفعت
        if (hasSelectedFiles && imageUrls.length > 0) {
          console.log('🧹 Cleaning selected files after failed send (but files were uploaded)');
          setSelectedFiles([]);
          setFilePreviews([]);
        }
        throw new Error(data.message || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);

      // ✅ FIX: تنظيف الملفات في حالة الخطأ أيضاً إذا كانت قد رُفعت
      if (hasSelectedFiles && imageUrls.length > 0) {
        console.log('🧹 Cleaning selected files after error (but files were uploaded)');
        setSelectedFiles([]);
        setFilePreviews([]);
      }

      // تحديث حالة الرسالة إلى خطأ
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: (prev.messages || []).map(msg =>
          msg.id === tempMessage.id
            ? { ...msg, status: 'error' }
            : msg
        )
      } : null);

      // معالجة أخطاء Facebook بشكل خاص
      const errorMessage = error.message || error.toString();

      // التحقق من أخطاء 24 ساعة من Facebook
      if (errorMessage.includes('24') ||
        errorMessage.includes('hour') ||
        errorMessage.includes('ساعة') ||
        errorMessage.includes('window') ||
        errorMessage.includes('messaging window')) {
        alert(`⚠️ قيد من Facebook:\n\nلا يمكن إرسال رسائل للعملاء إلا إذا قاموا بمراسلتك خلال آخر 24 ساعة.\n\nهذا قيد من سياسات Facebook Messenger وليس من النظام.\n\nالحلول المتاحة:\n• انتظر حتى يراسلك العميل مرة أخرى\n• استخدم قوالب الرسائل المعتمدة من Facebook\n• تواصل مع العميل عبر قناة أخرى`);
      } else {
        // أخطاء أخرى
        alert(`❌ فشل في إرسال الرسالة:\n\n${errorMessage}\n\nيرجى المحاولة مرة أخرى أو التواصل مع الدعم الفني.`);
      }

      setNewMessage(messageContent); // إعادة النص في حالة الخطأ
    } finally {
      // تفعيل الـ input مباشرة للسماح بإرسال رسائل متتالية
      setSending(false);
      // التركيز على الـ input مرة أخرى
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  // إرسال مؤشر الكتابة
  const handleTyping = (value: string) => {
    setNewMessage(value);

    if (socket && isConnected && selectedConversation) {
      emit('start_typing', {
        conversationId: selectedConversation.id,
        userId: 'current_user'
      });

      // إيقاف مؤشر الكتابة بعد ثانيتين من التوقف
      setTimeout(() => {
        emit('stop_typing', {
          conversationId: selectedConversation.id,
          userId: 'current_user'
        });
      }, 2000);
    }
  };

  // التمرير إلى أسفل
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
    setUnreadMessagesCount(0);
  };

  // وظائف الإشعارات
  const playNotificationSound = () => {
    if (!soundEnabled) return;

    // 🔔 استخدام صوت التنبيه من ملف notification.mp3
    socketService.playNotificationSound();
  };

  const showBrowserNotification = (title: string, body: string, icon?: string) => {
    if (!notificationsEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'new-message',
        requireInteraction: false,
        silent: false
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: icon || '/favicon.ico',
            tag: 'new-message'
          });
        }
      });
    }
  };

  // دالة حذف المحادثة
  const deleteConversation = async (conversationId: string) => {
    try {
      setDeleting(true);
      console.log('🗑️ Deleting conversation:', conversationId);

      // الحصول على الـ Token
      const token = localStorage.getItem('accessToken');
      console.log('🔑 Token found:', !!token);

      const response = await apiClient.delete(`/conversations/${conversationId}`);
      const data = response.data;

      if (data.success) {
        console.log('✅ Conversation deleted successfully');

        // إزالة المحادثة من القائمة
        setConversations(prev => prev.filter(conv => conv.id !== conversationId));

        // إذا كانت المحادثة المحذوفة هي المحددة، قم بإلغاء التحديد
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
        }

        // إغلاق النافذة المنبثقة
        setShowDeleteModal(false);
        setConversationToDelete(null);

        // إشعار نجاح
        alert('تم حذف المحادثة بنجاح');
      } else {
        throw new Error(data.message || 'فشل في حذف المحادثة');
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      alert('حدث خطأ أثناء حذف المحادثة');
    } finally {
      setDeleting(false);
    }
  };

  // دالة فتح نافذة تأكيد الحذف
  const openDeleteModal = (conversation: Conversation) => {
    setConversationToDelete(conversation);
    setShowDeleteModal(true);
  };

  // دالة إغلاق نافذة تأكيد الحذف
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConversationToDelete(null);
  };

  // وظائف رفع الملفات
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const previews: string[] = [];

    // فحص نوع الملفات والحجم
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`حجم الملف ${file.name} كبير جداً. الحد الأقصى 10 ميجابايت.`);
        continue;
      }

      validFiles.push(file);

      // إنشاء معاينة للصور
      if (file.type.startsWith('image/')) {
        try {
          const preview = await uploadService.getFilePreview(file);
          previews.push(preview);
        } catch (error) {
          console.error('Error creating preview:', error);
          previews.push('');
        }
      } else {
        previews.push('');
      }
    }

    setSelectedFiles(validFiles);
    setFilePreviews(previews);

    // إعادة تعيين قيمة الـ input للسماح بتحديد نفس الملفات مرة أخرى
    event.target.value = '';
  };

  // دالة تشغيل/إيقاف الذكاء الاصطناعي للمحادثة
  // 🚫 دوال الحظر
  const checkBlockStatus = async () => {
    if (!selectedConversation?.pageId || !selectedConversation?.customerId) return;

    try {
      setCheckingBlockStatus(true);
      const status = await apiService.checkCustomerBlockStatus(
        selectedConversation.customerId,
        selectedConversation.pageId
      );
      setIsBlocked(status.isBlocked);
    } catch (error) {
      console.error('Error checking block status:', error);
    } finally {
      setCheckingBlockStatus(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!selectedConversation?.pageId || !selectedConversation?.customerId) {
      alert('معرف الصفحة أو العميل غير متوفر');
      return;
    }

    try {
      setBlocking(true);
      await apiService.blockCustomerOnPage(
        selectedConversation.customerId,
        selectedConversation.pageId,
        blockReason || undefined
      );
      setIsBlocked(true);
      setShowBlockModal(false);
      setBlockReason('');
      alert('تم حظر العميل على الصفحة بنجاح');
    } catch (error: any) {
      alert(error.message || 'فشل حظر العميل');
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblockCustomer = async () => {
    if (!selectedConversation?.pageId || !selectedConversation?.customerId) {
      alert('معرف الصفحة أو العميل غير متوفر');
      return;
    }

    if (!confirm('هل أنت متأكد من إلغاء حظر هذا العميل على الصفحة؟')) {
      return;
    }

    try {
      setBlocking(true);
      await apiService.unblockCustomerOnPage(
        selectedConversation.customerId,
        selectedConversation.pageId
      );
      setIsBlocked(false);
      alert('تم إلغاء حظر العميل بنجاح');
    } catch (error: any) {
      alert(error.message || 'فشل إلغاء حظر العميل');
    } finally {
      setBlocking(false);
    }
  };

  // التحقق من حالة الحظر عند تغيير المحادثة
  useEffect(() => {
    if (selectedConversation?.pageId && selectedConversation?.customerId) {
      checkBlockStatus();
    } else {
      setIsBlocked(false);
    }
  }, [selectedConversation?.id, selectedConversation?.pageId, selectedConversation?.customerId]);

  const handleToggleAI = async (conversationId: string, currentAIStatus: boolean) => {
    console.log('🤖 [HANDLE-TOGGLE-AI] Function called with:', { conversationId, currentAIStatus, togglingAI });

    if (togglingAI) {
      console.log('🤖 [HANDLE-TOGGLE-AI] Already toggling, returning');
      return; // منع التشغيل المتعدد
    }

    setTogglingAI(conversationId);
    try {
      const newAIStatus = !currentAIStatus;
      console.log(`🤖 [HANDLE-TOGGLE-AI] Toggling AI for conversation ${conversationId} from ${currentAIStatus} to ${newAIStatus}`);

      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('لم يتم العثور على رمز المصادقة');
      }

      const response = await fetch(buildApiUrl(`conversations/${conversationId}/ai-toggle`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ aiEnabled: newAIStatus })
      });

      const result = await response.json();
      console.log('🤖 [HANDLE-TOGGLE-AI] API result:', result);

      if (result.success) {
        // تحديث المحادثة محلياً
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, aiEnabled: newAIStatus }
            : conv
        ));

        // تحديث المحادثة المختارة إذا كانت نفس المحادثة
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(prev => prev ? { ...prev, aiEnabled: newAIStatus } : null);
        }

        // إظهار رسالة نجاح
        const statusText = newAIStatus ? 'تم تفعيل' : 'تم إيقاف';
        console.log(`✅ ${statusText} الذكاء الاصطناعي للمحادثة`);

        // يمكن إضافة toast notification هنا
        if (soundEnabled) {
          playNotificationSound();
        }
      } else {
        throw new Error(result.message || 'فشل في تحديث حالة الذكاء الاصطناعي');
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة الذكاء الاصطناعي:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ غير متوقع');
    } finally {
      setTogglingAI(null);
    }
  };

  // دالة وضع/إزالة علامة غير مقروءة
  const handleMarkAsUnread = async (conversationId: string, currentUnreadStatus: boolean) => {
    if (markingAsUnread) return;

    setMarkingAsUnread(conversationId);
    try {
      const newUnreadCount = currentUnreadStatus ? 0 : 1; // إذا كانت غير مقروءة نخليها مقروءة، والعكس
      console.log(`📧 Marking conversation ${conversationId} as ${newUnreadCount > 0 ? 'unread' : 'read'}`);

      // استخدام companyAwareApi للـ API call
      const response = await companyAwareApi.put(`/conversations/${conversationId}/mark-unread`, {
        unreadCount: newUnreadCount
      });

      if (response.data.success) {
        // تحديث المحادثة محلياً
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, unreadCount: newUnreadCount }
            : conv
        ));

        // تحديث المحادثة المختارة إذا كانت نفس المحادثة
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(prev => prev ? { ...prev, unreadCount: newUnreadCount } : null);
        }

        // إظهار رسالة نجاح
        const statusText = newUnreadCount > 0 ? t('conversations.markAsUnread', 'Marked as unread') : t('conversations.markAsRead', 'Marked as read');
        console.log(`✅ ${statusText}`);

        if (soundEnabled) {
          playNotificationSound();
        }
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث حالة القراءة:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ غير متوقع');
    } finally {
      setMarkingAsUnread(null);
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0 || !selectedConversation || uploadingFile) return;

    setUploadingFile(true);

    try {
      // رفع كل الملفات دفعة واحدة
      const uploadResult = await uploadService.uploadConversationFiles(selectedConversation.id, selectedFiles);

      if (!uploadResult.success) {
        alert(uploadResult.error || 'حدث خطأ أثناء رفع الملفات');
        return;
      }

      const data = uploadResult;

      // ⚡ OPTIMIZATION: مش هنضيف الملفات هنا - هنستنى الـ echo من Facebook
      console.log(`⏳ Waiting for Facebook echo to save ${data.data?.length || 0} file(s)...`);

      // 💾 تخزين معلومات الملفات المرفوعة (عشان المستخدم يقدر يحفظها في الحافظة لاحقاً)
      if (Array.isArray(data.data)) {
        const filesInfo = selectedFiles.map((file, index) => {
          const uploadedFile = data.data[index];
          return {
            file,
            preview: filePreviews[index] || '',
            uploadedUrl: uploadedFile?.fullUrl || uploadedFile?.url,
            filename: uploadedFile?.originalName || file.name,
            type: uploadedFile?.type
          };
        });
        setUploadedFilesInfo(filesInfo);
        console.log('📦 Uploaded files info stored:', filesInfo.length);

        // 🔔 إظهار notification للمستخدم يسأله لو عايز يحفظ الصور في الحافظة
        const imageFiles = filesInfo.filter(f =>
          f.type?.toUpperCase() === 'IMAGE' ||
          f.file.type.startsWith('image/')
        );

        if (imageFiles.length > 0) {
          const shouldSave = window.confirm(
            `تم رفع ${imageFiles.length} صورة. هل تريد حفظها في الحافظة للاستخدام السريع لاحقاً؟`
          );

          if (shouldSave) {
            // حفظ الصور في الحافظة
            let savedCount = 0;
            for (const fileInfo of imageFiles) {
              if (fileInfo.uploadedUrl && fileInfo.filename) {
                const success = await saveImageToGallery(fileInfo.uploadedUrl, fileInfo.filename);
                if (success) savedCount++;
              }
            }

            if (savedCount > 0) {
              alert(`✅ تم حفظ ${savedCount} صورة في الحافظة!`);
              // تحديث الحافظة
              await loadImageGallery();
            }
          }
        }
      }

      // التمرير للأسفل فقط إذا كان المستخدم في الأسفل بالفعل
      if (autoScrollEnabled) {
        setTimeout(() => scrollToBottom(), 100);
      }

      // تنظيف الحالة
      setSelectedFiles([]);
      setFilePreviews([]);
    } catch (error) {
      console.error('❌ Error uploading files:', error);
      alert('حدث خطأ أثناء رفع الملفات');
    } finally {
      setUploadingFile(false);
    }
  };

  const cancelFileUpload = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  // ✅ دوال معالجة السحب والإفلات (Drag & Drop)
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const previews: string[] = [];

    // فحص نوع الملفات والحجم
    for (const file of files) {
      const maxSize = 10 * 1024 * 1024; // 10MB

      // قبول الصور فقط أو جميع الملفات حسب التفضيل
      if (!file.type.startsWith('image/') && !file.type.startsWith('application/pdf')) {
        alert(`نوع الملف ${file.name} غير مدعوم. يُسمح بالصور و PDF فقط.`);
        continue;
      }

      if (file.size > maxSize) {
        alert(`حجم الملف ${file.name} كبير جداً. الحد الأقصى 10 ميجابايت.`);
        continue;
      }

      validFiles.push(file);

      // إنشاء معاينة للصور
      if (file.type.startsWith('image/')) {
        try {
          const preview = await uploadService.getFilePreview(file);
          previews.push(preview);
        } catch (error) {
          console.error('Error creating preview:', error);
          previews.push('');
        }
      } else {
        previews.push('');
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setFilePreviews(prev => [...prev, ...previews]);
    }
  };

  // ✅ دوال حافظة الصور
  const loadImageGallery = async () => {
    try {
      setLoadingGallery(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(buildApiUrl('user/image-gallery'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedImages(data.images || []);
        console.log('✅ Loaded', data.images?.length || 0, 'images from gallery');
      } else {
        console.error('❌ Failed to load gallery:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading image gallery:', error);
    } finally {
      setLoadingGallery(false);
    }
  };

  const saveImageToGallery = async (fileUrl: string, filename: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        console.error('❌ No auth token found');
        return false;
      }

      console.log(`🔄 Saving to gallery: ${filename} from ${fileUrl}`);

      const response = await fetch(buildApiUrl('user/image-gallery'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileUrl, filename })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Image saved to gallery:', filename, data);
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to save image:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving image to gallery:', error);
      return false;
    }
  };

  // 📤 رفع صور للحافظة مباشرة (بدون محادثة)
  const handleUploadToGallery = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingToGallery(true);

    try {
      console.log(`📤 Uploading ${files.length} image(s) to gallery...`);

      // رفع كل صورة وحفظها في الحافظة
      let successCount = 0;
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        setUploadingToGallery(false);
        return;
      }

      for (const file of Array.from(files)) {
        // التحقق من أنها صورة
        if (!file.type.startsWith('image/')) {
          console.warn(`⚠️ Skipping non-image file: ${file.name}`);
          continue;
        }

        // رفع وحفظ في الحافظة مباشرة (endpoint واحد)
        const formData = new FormData();
        formData.append('image', file);

        const uploadResponse = await fetch(buildApiUrl('user/image-gallery/upload'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (uploadResponse.ok) {
          const result = await uploadResponse.json();
          console.log(`✅ Image uploaded and saved: ${result.image?.filename}`);
          successCount++;
        } else {
          const errorData = await uploadResponse.text();
          console.error(`❌ Failed to upload ${file.name}:`, uploadResponse.status, errorData);
        }
      }

      if (successCount > 0) {
        alert(`✅ تم حفظ ${successCount} صورة في الحافظة!`);
        // تحديث الحافظة
        await loadImageGallery();
      } else {
        alert('⚠️ لم يتم حفظ أي صورة. تأكد من اختيار صور صحيحة.');
      }

      // إعادة تعيين input
      event.target.value = '';
    } catch (error) {
      console.error('❌ Error uploading to gallery:', error);
      alert('حدث خطأ أثناء رفع الصور');
    } finally {
      setUploadingToGallery(false);
    }
  };

  // إرسال صورة واحدة من الحافظة
  const selectImageFromGallery = async (imageUrl: string, filename: string) => {
    if (!selectedConversation) return;

    try {
      console.log(`📤 Sending image from gallery: ${filename}`);
      setShowImageGallery(false);

      // 🚀 إرسال الصورة مباشرة كرسالة (بدون رفع جديد)
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      // إنشاء رسالة صورة مباشرة في المحادثة
      const response = await fetch(buildApiUrl(`conversations/${selectedConversation.id}/send-existing-image`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          filename: filename
        })
      });

      if (response.ok) {
        console.log('✅ Image sent successfully from gallery!');
        // الرسالة هتوصل عن طريق socket
      } else {
        console.error('❌ Failed to send image from gallery');
        alert('فشل إرسال الصورة. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error sending image from gallery:', error);
      alert('حدث خطأ أثناء إرسال الصورة');
    }
  };

  // إرسال عدة صور من الحافظة في مرة واحدة
  const sendMultipleImagesFromGallery = async () => {
    if (!selectedConversation || selectedImagesForSend.size === 0) return;

    try {
      setSendingMultipleImages(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      // تجهيز قائمة الصور المختارة
      const imagesToSend = savedImages.filter(img => selectedImagesForSend.has(img.id));
      console.log(`📤 Sending ${imagesToSend.length} image(s) from gallery`);

      // إرسال كل صورة على حدة (Facebook يتطلب إرسال كل صورة في رسالة منفصلة)
      let successCount = 0;
      let failCount = 0;

      for (const image of imagesToSend) {
        try {
          const response = await fetch(buildApiUrl(`conversations/${selectedConversation.id}/send-existing-image`), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageUrl: image.url,
              filename: image.filename
            })
          });

          if (response.ok) {
            successCount++;
            console.log(`✅ Image ${successCount}/${imagesToSend.length} sent: ${image.filename}`);
            // إضافة تأخير صغير بين الصور لتجنب rate limiting
            if (successCount < imagesToSend.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            failCount++;
            console.error(`❌ Failed to send image: ${image.filename}`);
          }
        } catch (error) {
          failCount++;
          console.error(`❌ Error sending image ${image.filename}:`, error);
        }
      }

      // إغلاق الحافظة ومسح الاختيارات
      setShowImageGallery(false);
      setSelectedImagesForSend(new Set());

      // إظهار رسالة النتيجة
      if (successCount > 0 && failCount === 0) {
        alert(`✅ تم إرسال ${successCount} صورة بنجاح!`);
      } else if (successCount > 0) {
        alert(`⚠️ تم إرسال ${successCount} صورة، وفشل إرسال ${failCount} صورة`);
      } else {
        alert(`❌ فشل إرسال جميع الصور`);
      }
    } catch (error) {
      console.error('❌ Error sending multiple images:', error);
      alert('حدث خطأ أثناء إرسال الصور');
    } finally {
      setSendingMultipleImages(false);
    }
  };

  // تبديل اختيار صورة
  const toggleImageSelection = (imageId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedImagesForSend(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  // 🗑️ حذف صورة من الحافظة
  const deleteImageFromGallery = async (imageId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // منع فتح الصورة عند الضغط على زر الحذف

    if (!confirm('هل أنت متأكد من حذف هذه الصورة من الحافظة؟')) {
      return;
    }

    try {
      setDeletingImageId(imageId);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch(buildApiUrl(`user/image-gallery/${imageId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Image deleted from gallery');
        // تحديث القائمة بإزالة الصورة المحذوفة
        setSavedImages(prev => prev.filter(img => img.id !== imageId));
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to delete image:', errorData);
        alert('فشل حذف الصورة. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error deleting image from gallery:', error);
      alert('حدث خطأ أثناء حذف الصورة');
    } finally {
      setDeletingImageId(null);
    }
  };

  // ✅ دوال حافظة النصوص
  const loadTextGallery = async () => {
    try {
      setLoadingTextGallery(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(buildApiUrl('user/text-gallery'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedTexts(data.texts || []);
        console.log('✅ Loaded', data.texts?.length || 0, 'texts from gallery');
      } else {
        console.error('❌ Failed to load text gallery:', response.status);
      }
    } catch (error) {
      console.error('❌ Error loading text gallery:', error);
    } finally {
      setLoadingTextGallery(false);
    }
  };

  const saveTextToGallery = async () => {
    if (!newTextContent.trim() && newTextImages.length === 0) {
      alert('يرجى إدخال محتوى النص أو إرفاق صورة على الأقل');
      return;
    }

    try {
      setSavingText(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      let imageUrls: string[] = [];

      // رفع الصور إلى حافظة الصور أولاً (بنفس طريقة حافظة الصور)
      if (newTextImages.length > 0) {
        console.log(`📤 Uploading ${newTextImages.length} image(s) to image gallery...`);

        for (const file of newTextImages) {
          // التحقق من أنها صورة
          if (!file.type.startsWith('image/')) {
            console.warn(`⚠️ Skipping non-image file: ${file.name}`);
            continue;
          }

          // رفع وحفظ في حافظة الصور (نفس endpoint المستخدم في handleUploadToGallery)
          const formData = new FormData();
          formData.append('image', file);

          const uploadResponse = await fetch(buildApiUrl('user/image-gallery/upload'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            const imageUrl = result.image?.url || result.image?.fileUrl;
            if (imageUrl) {
              imageUrls.push(imageUrl);
              console.log(`✅ Image uploaded and saved to gallery: ${imageUrl}`);
            }
          } else {
            const errorData = await uploadResponse.text();
            console.error(`❌ Failed to upload ${file.name}:`, uploadResponse.status, errorData);
          }
        }
      }

      // حفظ النص مع روابط الصور
      const response = await fetch(buildApiUrl('user/text-gallery'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTextTitle.trim() || null,
          content: newTextContent.trim() || null,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Text saved to gallery:', data);
        // تحديث القائمة
        await loadTextGallery();
        // مسح الحقول
        setNewTextTitle('');
        setNewTextContent('');
        setNewTextImages([]);
        setNewTextImagePreviews([]);
        alert('✅ تم حفظ النص بنجاح!');
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to save text:', errorData);
        alert('فشل حفظ النص. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error saving text to gallery:', error);
      alert('حدث خطأ أثناء حفظ النص');
    } finally {
      setSavingText(false);
    }
  };

  const updateTextInGallery = async (textId: string, title: string, content: string) => {
    if (!content.trim() && editingTextExistingImages.length === 0 && editingTextImages.length === 0) {
      alert('يرجى إدخال محتوى النص أو إرفاق صورة على الأقل');
      return;
    }

    try {
      setUpdatingText(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      let imageUrls: string[] = [...editingTextExistingImages];

      // رفع الصور الجديدة إلى حافظة الصور
      if (editingTextImages.length > 0) {
        console.log(`📤 Uploading ${editingTextImages.length} new image(s) for text update...`);

        for (const file of editingTextImages) {
          // التحقق من أنها صورة
          if (!file.type.startsWith('image/')) {
            console.warn(`⚠️ Skipping non-image file: ${file.name}`);
            continue;
          }

          // رفع وحفظ في حافظة الصور
          const formData = new FormData();
          formData.append('image', file);

          const uploadResponse = await fetch(buildApiUrl('user/image-gallery/upload'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            const imageUrl = result.image?.url || result.image?.fileUrl;
            if (imageUrl) {
              imageUrls.push(imageUrl);
              console.log(`✅ New image uploaded and saved to gallery: ${imageUrl}`);
            }
          } else {
            const errorData = await uploadResponse.text();
            console.error(`❌ Failed to upload ${file.name}:`, uploadResponse.status, errorData);
          }
        }
      }

      // تحديث النص مع الصور
      const response = await fetch(buildApiUrl(`user/text-gallery/${textId}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim() || null,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Text updated in gallery:', data);
        // تحديث القائمة
        await loadTextGallery();
        // إغلاق وضع التعديل ومسح الحقول
        setEditingTextId(null);
        setEditingTextImages([]);
        setEditingTextImagePreviews([]);
        setEditingTextExistingImages([]);
        alert('✅ تم تحديث النص بنجاح!');
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to update text:', errorData);
        alert('فشل تحديث النص. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error updating text in gallery:', error);
      alert('حدث خطأ أثناء تحديث النص');
    } finally {
      setUpdatingText(false);
    }
  };

  const deleteTextFromGallery = async (textId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    if (!confirm('هل أنت متأكد من حذف هذا النص من الحافظة؟')) {
      return;
    }

    try {
      setDeletingTextId(textId);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch(buildApiUrl(`user/text-gallery/${textId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Text deleted from gallery');
        setSavedTexts(prev => prev.filter(text => text.id !== textId));
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to delete text:', errorData);
        alert('فشل حذف النص. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error deleting text from gallery:', error);
      alert('حدث خطأ أثناء حذف النص');
    } finally {
      setDeletingTextId(null);
    }
  };

  // دالة لاختيار صور لحافظة النصوص
  const handleTextGalleryImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const previews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`حجم الملف ${file.name} كبير جداً. الحد الأقصى 10 ميجابايت.`);
        continue;
      }

      if (!file.type.startsWith('image/')) {
        alert(`الملف ${file.name} ليس صورة. يرجى اختيار صور فقط.`);
        continue;
      }

      validFiles.push(file);

      // إنشاء معاينة للصور
      try {
        const preview = await uploadService.getFilePreview(file);
        previews.push(preview);
      } catch (error) {
        console.error('Error creating preview:', error);
        previews.push('');
      }
    }

    setNewTextImages(prev => [...prev, ...validFiles]);
    setNewTextImagePreviews(prev => [...prev, ...previews]);

    event.target.value = '';
  };

  // دالة لحذف صورة من المعاينة (للحفظ الجديد)
  const removeTextGalleryImage = (index: number) => {
    setNewTextImages(prev => prev.filter((_, i) => i !== index));
    setNewTextImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // دالة لاختيار صور للتعديل
  const handleEditTextGalleryImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    const previews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`حجم الملف ${file.name} كبير جداً. الحد الأقصى 10 ميجابايت.`);
        continue;
      }

      if (!file.type.startsWith('image/')) {
        alert(`الملف ${file.name} ليس صورة. يرجى اختيار صور فقط.`);
        continue;
      }

      validFiles.push(file);

      // إنشاء معاينة للصور
      try {
        const preview = await uploadService.getFilePreview(file);
        previews.push(preview);
      } catch (error) {
        console.error('Error creating preview:', error);
        previews.push('');
      }
    }

    setEditingTextImages(prev => [...prev, ...validFiles]);
    setEditingTextImagePreviews(prev => [...prev, ...previews]);

    event.target.value = '';
  };

  // دالة لحذف صورة جديدة من المعاينة (في وضع التعديل)
  const removeEditTextGalleryNewImage = (index: number) => {
    setEditingTextImages(prev => prev.filter((_, i) => i !== index));
    setEditingTextImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // دالة لحذف صورة موجودة (في وضع التعديل)
  const removeEditTextGalleryExistingImage = (index: number) => {
    setEditingTextExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  // دالة لتثبيت/إلغاء تثبيت نص
  const togglePinText = async (textId: string, currentPinStatus: boolean, event: React.MouseEvent) => {
    event.stopPropagation();

    try {
      setPinningTextId(textId);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch(buildApiUrl(`user/text-gallery/${textId}/pin`), {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isPinned: !currentPinStatus
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Pin status updated:', data);
        // تحديث القائمة
        await loadTextGallery();
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to toggle pin:', errorData);
        alert('فشل تحديث حالة التثبيت. حاول مرة أخرى.');
      }
    } catch (error) {
      console.error('❌ Error toggling pin:', error);
      alert('حدث خطأ أثناء تحديث حالة التثبيت');
    } finally {
      setPinningTextId(null);
    }
  };

  const selectTextFromGallery = async (text: { content: string; imageUrls?: string[] }) => {
    if (!selectedConversation) return;

    setShowTextGallery(false);

    // إرسال النص والصور مباشرة للعميل (بنفس طريقة حافظة الصور)
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) {
        alert('يرجى تسجيل الدخول أولاً');
        return;
      }

      const messageContent = text.content?.trim() || '';
      const imageUrls = text.imageUrls || [];

      // إذا كان هناك نص فقط بدون صور، استخدم sendMessage العادي
      if (messageContent && imageUrls.length === 0) {
        await sendMessage(messageContent);
        return;
      }

      setSending(true);

      // 1. إرسال النص أولاً (إذا كان موجود)
      if (messageContent) {
        await sendMessage(messageContent);
        // انتظار قليل قبل إرسال الصور
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 2. إرسال كل صورة على حدة (بنفس طريقة حافظة الصور)
      if (imageUrls.length > 0) {
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < imageUrls.length; i++) {
          const imageUrl = imageUrls[i];

          // استخراج اسم الملف من الـ URL
          const urlParts = imageUrl.split('/');
          const filename = urlParts[urlParts.length - 1] || `image_${i + 1}.jpg`;

          try {
            console.log(`📤 Sending image ${i + 1}/${imageUrls.length} from text gallery: ${filename}`);

            // استخدام نفس endpoint المستخدم في حافظة الصور
            const response = await fetch(buildApiUrl(`conversations/${selectedConversation.id}/send-existing-image`), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                imageUrl: imageUrl,
                filename: filename
              })
            });

            if (response.ok) {
              successCount++;
              console.log(`✅ Image ${successCount}/${imageUrls.length} sent successfully: ${filename}`);

              // إضافة تأخير صغير بين الصور لتجنب rate limiting
              if (i < imageUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else {
              failCount++;
              const errorData = await response.text();
              console.error(`❌ Failed to send image ${i + 1}:`, response.status, errorData);
            }
          } catch (error) {
            failCount++;
            console.error(`❌ Error sending image ${i + 1}:`, error);
          }
        }

        // إظهار رسالة النتيجة
        if (successCount > 0 && failCount === 0) {
          console.log(`✅ تم إرسال ${successCount} صورة بنجاح!`);
        } else if (successCount > 0 && failCount > 0) {
          alert(`⚠️ تم إرسال ${successCount} صورة بنجاح، وفشل إرسال ${failCount} صورة`);
        } else if (failCount > 0) {
          alert(`❌ فشل إرسال جميع الصور (${failCount} صورة)`);
        }
      }

      // تحديث قائمة المحادثات
      if (selectedConversation && selectedConversation.unreadCount > 0) {
        markConversationAsRead(selectedConversation.id);
      }

      // إعادة تحميل الرسائل
      setTimeout(() => {
        loadMessages(selectedConversation.id);
      }, 500);

    } catch (error: any) {
      console.error('❌ Error sending text from gallery:', error);
      alert(`❌ فشل في إرسال الرسالة:\n\n${error.message || error.toString()}`);
    } finally {
      setSending(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  // وظائف الطلبات
  const openOrderModal = () => {
    setShowOrderModal(true);
  };

  // معالجة إنشاء الطلب
  const handleOrderCreated = async (orderData: any) => {
    // إرسال رسالة تأكيد للعميل
    const confirmationMessage = `تم إنشاء طلبك بنجاح! 🎉

رقم الطلب: ${orderData.orderNumber}
الإجمالي: ${orderData.total} جنيه

سيتم التواصل معك قريباً لتأكيد التفاصيل.`;
    await sendMessage(confirmationMessage);
  };

  // مراقبة التمرير للرسائل
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
    const isAtTop = container.scrollTop <= 100;

    setShowScrollToBottom(!isAtBottom);
    setAutoScrollEnabled(isAtBottom);

    if (isAtBottom) {
      setUnreadMessagesCount(0);
    }

    // تحميل الرسائل القديمة عند الوصول لأعلى الصفحة
    if (isAtTop && hasMoreMessages && !loadingOldMessages) {
      loadOldMessages();
    }
  };

  // مراقبة التمرير لقائمة المحادثات (infinite scroll)
  const handleConversationsScroll = () => {
    if (!conversationsListRef.current) return;

    const container = conversationsListRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;

    // تحميل المزيد من المحادثات عند الوصول لأسفل القائمة
    if (isAtBottom && hasMoreConversations && !loadingMoreConversations) {
      console.log('📄 Loading more conversations...');
      loadConversations(conversationsPage + 1, true);
    }
  };

  // إعداد مستمعي أحداث Socket.IO (مُفعل للتحديث الفوري)
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('❌ [SOCKET] Socket not available:', { socket: !!socket, isConnected });
      return;
    }

    console.log('🔌 [SOCKET] Setting up Socket.IO event listeners...');
    console.log('🔌 [SOCKET] Socket ID:', socket.id);
    console.log('🔌 [SOCKET] Connection status:', isConnected);

    // استقبال رسالة جديدة
    const handleNewMessage = (data: any) => {
      // ✅ FIX: تجاهل رسائل المنصات الأخرى (مثل Telegram)
      if (data.platform && data.platform.toLowerCase() !== 'facebook') {
        console.log('🔕 [SOCKET] Ignoring message from different platform:', data.platform);
        return;
      }
      // ✅ FIX: تجاهل رسائل Telegram إذا لم يكن platform محدد لكن channel موجود
      if (data.channel && data.channel.toLowerCase() !== 'facebook') {
        console.log('🔕 [SOCKET] Ignoring message from different channel:', data.channel);
        return;
      }

      console.log('📨 [SOCKET] New message received:', data);
      console.log('📨 [SOCKET] Message ID:', data.id);
      console.log('📨 [SOCKET] isFromCustomer:', data.isFromCustomer);
      console.log('📨 [SOCKET] Current conversation:', selectedConversation?.id);
      console.log('📨 [SOCKET] Message conversation:', data.conversationId || data.message?.conversationId);
      console.log('📨 [SOCKET] Reply metadata:', {
        replyToContentSnippet: data.metadata?.replyToContentSnippet,
        replyToFacebookMessageId: data.metadata?.replyToFacebookMessageId,
        replyToResolvedMessageId: data.metadata?.replyToResolvedMessageId,
        fullMetadata: data.metadata
      });

      // ✅ FIX: التحقق من أن الرسالة تخص نفس الشركة قبل معالجتها
      const messageCompanyId = data.companyId || data.metadata?.companyId || data.conversation?.companyId;
      if (messageCompanyId && companyId && String(messageCompanyId) !== String(companyId)) {
        console.log('🔕 [SOCKET] Ignoring message from different company:', {
          messageCompanyId,
          currentCompanyId: companyId,
          conversationId: data.conversationId
        });
        return; // تجاهل الرسالة تماماً إذا كانت من شركة أخرى
      }

      // 🔔 تشغيل صوت التنبيه للرسائل من العملاء (مع عزل الشركات)
      if (data.isFromCustomer) {
        // ✅ التحقق من أن الرسالة تخص نفس الشركة
        if (messageCompanyId && companyId && String(messageCompanyId) === String(companyId)) {
          console.log('🔔 Playing notification sound for new customer message');
          socketService.playNotificationSound();
        } else if (!messageCompanyId) {
          // للتوافق مع الإصدارات القديمة - تشغيل الصوت إذا لم يكن هناك companyId
          console.log('🔔 Playing notification sound (no company isolation)');
          socketService.playNotificationSound();
        } else {
          console.log('🔕 Skipping notification sound - different company:', { messageCompanyId, currentCompanyId: companyId });
        }
      }

      // تحديد نوع الرسالة (ذكاء صناعي أم يدوية)
      const isAiGenerated = (
        data.metadata?.isAIGenerated ||
        data.metadata?.isAutoGenerated ||
        data.senderId === 'ai_agent' ||
        data.senderName === 'الذكاء الاصطناعي' ||
        false
      );

      // تحديد اسم المرسل بشكل صحيح
      let senderName = 'العميل';
      if (!data.isFromCustomer) {
        if (isAiGenerated) {
          senderName = 'الذكاء الاصطناعي';
        } else if (data.senderName) {
          senderName = data.senderName; // اسم الموظف من الخادم
        } else {
          senderName = 'موظف'; // افتراضي إذا لم يكن هناك اسم
        }
      }

      // 🔧 Normalize image/file URLs for immediate rendering
      let normalizedFileUrl = data.fileUrl;
      if (!normalizedFileUrl && typeof data.content === 'string') {
        // If backend sent relative path or stored in content, try to construct absolute URL
        if (data.content.startsWith('/uploads') || data.content.startsWith('uploads/')) {
          normalizedFileUrl = buildApiUrl(data.content.replace(/^\//, ''));
        } else if (/^https?:\/\//i.test(data.content)) {
          normalizedFileUrl = data.content;
        }
      }

      const newMessage: Message = {
        id: data.id,
        content: data.content,
        senderId: data.senderId,
        senderName: senderName,
        timestamp: new Date(data.timestamp),
        type: data.type || 'text',
        isFromCustomer: data.isFromCustomer,
        status: 'delivered',
        conversationId: data.conversationId,
        isAiGenerated: isAiGenerated,
        // إضافة معلومات الملف من Socket
        fileUrl: normalizedFileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        // إضافة معلومات Reply من metadata
        replyToResolvedMessageId: data.metadata?.replyToResolvedMessageId,
        replyToContentSnippet: data.metadata?.replyToContentSnippet,
        replyToSenderIsCustomer: data.metadata?.replyToSenderIsCustomer,
        replyToType: data.metadata?.replyToType,
        replyToFacebookMessageId: data.metadata?.replyToFacebookMessageId
      };

      // تفاؤلياً: لو رسالة عميل وصلت للمحادثة الحالية و AI مفعّل، أظهر مؤشر كتابة
      if (data.isFromCustomer && String(selectedConversation?.id) === String(data.conversationId)) {
        const conv = conversations.find(c => String(c.id) === String(data.conversationId));
        if (!conv || conv.aiEnabled !== false) {
          setIsAiTyping(true);
          if (aiTypingTimeoutRef.current) clearTimeout(aiTypingTimeoutRef.current);
          aiTypingTimeoutRef.current = setTimeout(() => setIsAiTyping(false), 15000);
        }
      }

      // إذا وصلت رسالة AI للمحادثة الحالية، أوقف مؤشر الكتابة
      if (isAiGenerated && selectedConversation?.id === data.conversationId) {
        setIsAiTyping(false);
        if (aiTypingTimeoutRef.current) {
          clearTimeout(aiTypingTimeoutRef.current);
          aiTypingTimeoutRef.current = null;
        }
      }

      // إضافة الرسالة للمحادثة المناسبة في قائمة المحادثات
      setConversations((prev: Conversation[]) => {
        // ✅ FIX: التحقق من وجود المحادثة قبل التحديث
        const conversationExists = prev.some(conv => conv.id === data.conversationId);

        if (!conversationExists) {
          // ✅ FIX: التحقق مرة أخرى من companyId قبل إنشاء المحادثة المؤقتة
          // (تم التحقق في بداية handleNewMessage، لكن نتحقق مرة أخرى للتأكد)
          if (messageCompanyId && companyId && String(messageCompanyId) !== String(companyId)) {
            console.log(`🔕 [SOCKET] Ignoring conversation creation - different company:`, {
              conversationId: data.conversationId,
              messageCompanyId,
              currentCompanyId: companyId
            });
            return prev; // لا نضيف المحادثة إذا كانت من شركة أخرى
          }

          // ✅ FIX: لا ننشئ محادثة مؤقتة لرسائل الموظفين - فقط رسائل العملاء
          // رسائل الموظفين لا يجب أن تنشئ محادثات جديدة
          if (!data.isFromCustomer) {
            console.log(`ℹ️ [SOCKET] Message from staff for unknown conversation ${data.conversationId}, ignoring (won't create new conversation)`);
            // نحاول تحميل المحادثة من API فقط إذا كانت مفتوحة حالياً
            if (selectedConversation?.id === data.conversationId) {
              console.log(`🔄 [SOCKET] Conversation is selected, loading from API...`);
              loadSpecificConversation(data.conversationId, false).catch(err => {
                console.error(`❌ [SOCKET] Failed to load conversation:`, err);
              });
            }
            return prev; // لا نضيف محادثة جديدة لرسائل الموظفين
          }

          console.log(`⚠️ [SOCKET] Conversation ${data.conversationId} not found in list, creating temporary conversation with customer message...`);
          console.log(`📥 [SOCKET] Message data:`, {
            conversationId: data.conversationId,
            content: data.content?.substring(0, 50),
            isFromCustomer: data.isFromCustomer,
            senderName: data.senderName || data.customerName,
            companyId: data.companyId || data.metadata?.companyId
          });

          // ✅ FIX: إنشاء محادثة مؤقتة فقط لرسائل العملاء
          const tempConversation: Conversation = {
            id: data.conversationId,
            customerId: data.customerId || data.senderId || data.conversationId,
            customerName: data.customerName || data.senderName || 'عميل جديد',
            lastMessage: data.content,
            lastMessageTime: new Date(data.timestamp),
            unreadCount: data.isFromCustomer ? 1 : 0,
            platform: (data.platform || 'facebook') as Conversation['platform'],
            isOnline: false,
            messages: [newMessage], // ✅ إضافة الرسالة فوراً
            lastMessageIsFromCustomer: !!data.isFromCustomer,
            lastCustomerMessageIsUnread: !!data.isFromCustomer,
            pageName: data.pageName,
            pageId: data.pageId
          };

          // ✅ إضافة المحادثة المؤقتة للقائمة فوراً
          const updatedWithTemp = [tempConversation, ...prev];

          // ✅ تحميل المحادثة الكاملة من API في الخلفية ودمجها
          // (loadSpecificConversation سيتحقق من companyId مرة أخرى)
          const shouldAutoSelect = !selectedConversation || selectedConversation.id === data.conversationId;
          console.log(`🔄 [SOCKET] Loading full conversation ${data.conversationId}, autoSelect: ${shouldAutoSelect}`);

          loadSpecificConversation(data.conversationId, shouldAutoSelect).then(() => {
            // ✅ بعد تحميل المحادثة الكاملة، ندمج الرسالة الجديدة مع الرسائل المحملة
            // ✅ FIX: نحافظ على البيانات من Socket.IO (pageName, lastMessageIsFromCustomer, etc)
            setConversations((currentPrev: Conversation[]) => {
              return currentPrev.map((conv: Conversation) => {
                if (conv.id === data.conversationId) {
                  // التحقق من عدم وجود الرسالة مسبقاً
                  const existingMessages = conv.messages || [];
                  const messageExists = existingMessages.some(msg => msg.id === newMessage.id);

                  if (!messageExists) {
                    // إضافة الرسالة الجديدة للرسائل المحملة
                    const updatedMessages = [...existingMessages, newMessage].sort((a, b) =>
                      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                    );

                    // ✅ FIX: الحفاظ على unreadCount من Socket.IO (المحادثة المؤقتة)
                    // لأن السيرفر بيرجع unreadCount = 0 (قديمة)
                    const socketUnreadCount = data.isFromCustomer ? 1 : 0;

                    const updatedConv = {
                      ...conv,
                      messages: updatedMessages,
                      lastMessage: data.content,
                      lastMessageTime: new Date(data.timestamp),
                      lastMessageIsFromCustomer: !!data.isFromCustomer,
                      lastCustomerMessageIsUnread: !!data.isFromCustomer,
                      // ✅ FIX: استخدام unreadCount من Socket.IO بدلاً من السيرفر
                      unreadCount: socketUnreadCount,
                      // ✅ FIX: الحفاظ على pageName و pageId من Socket.IO إذا كانت موجودة
                      pageName: data.pageName || conv.pageName,
                      pageId: data.pageId || conv.pageId
                    };

                    console.log(`🔄 [SOCKET-MERGE] Merged new message with loaded conversation:`, {
                      conversationId: data.conversationId,
                      lastMessageIsFromCustomer: updatedConv.lastMessageIsFromCustomer,
                      unreadCount: updatedConv.unreadCount,
                      pageName: updatedConv.pageName,
                      fromSocket: { pageName: data.pageName, isFromCustomer: data.isFromCustomer, unreadCount: socketUnreadCount },
                      fromServer: { pageName: conv.pageName, isFromCustomer: conv.lastMessageIsFromCustomer, unreadCount: conv.unreadCount }
                    });

                    // ✅ تحديث المحادثة المحددة أيضاً إذا كانت نفس المحادثة
                    setSelectedConversation((currentSelected) => {
                      if (currentSelected?.id === data.conversationId) {
                        return updatedConv;
                      }
                      return currentSelected;
                    });

                    return updatedConv;
                  } else {
                    // ✅ FIX: حتى لو كانت الرسالة موجودة، تأكد من تحديث lastMessage
                    // لأن السيرفر قد يكون أرجع قيمة قديمة أو فارغة
                    const shouldUpdateLastMessage =
                      conv.lastMessage === 'لا توجد رسائل' ||
                      !conv.lastMessage ||
                      new Date(data.timestamp).getTime() > new Date(conv.lastMessageTime).getTime();

                    if (shouldUpdateLastMessage) {
                      // ✅ FIX: استخدام unreadCount من Socket.IO
                      const socketUnreadCount = data.isFromCustomer ? 1 : 0;

                      return {
                        ...conv,
                        lastMessage: data.content,
                        lastMessageTime: new Date(data.timestamp),
                        lastMessageIsFromCustomer: !!data.isFromCustomer,
                        lastCustomerMessageIsUnread: !!data.isFromCustomer,
                        // ✅ FIX: استخدام unreadCount من Socket.IO بدلاً من السيرفر
                        unreadCount: socketUnreadCount,
                        // ✅ FIX: الحفاظ على pageName و pageId من Socket.IO
                        pageName: data.pageName || conv.pageName,
                        pageId: data.pageId || conv.pageId
                      };
                    }
                  }
                }
                return conv;
              });
            });
          }).catch(error => {
            console.error(`❌ [SOCKET] Failed to load conversation ${data.conversationId}:`, error);
          });

          // ✅ إرجاع القائمة مع المحادثة المؤقتة
          return updatedWithTemp;
        } else {
          console.log(`✅ [SOCKET] Conversation ${data.conversationId} exists in list`);
        }

        const updatedConversations = prev.map((conv: Conversation) => {
          if (conv.id === data.conversationId) {
            // التحقق من عدم وجود الرسالة مسبقاً لتجنب التكرار
            const existingMessages = conv.messages || [];
            const messageExists = existingMessages.some(msg => msg.id === newMessage.id);

            // 🔧 FIX: لا نحدث lastMessageTime للمحادثة المفتوحة حالياً إذا كانت رسالة من موظف
            // هذا يمنع المحادثة من الصعود للأعلى
            const isCurrentConversation = selectedConversation?.id === data.conversationId;
            const shouldUpdateTime = data.isFromCustomer || !isCurrentConversation;

            console.log('🔧 [UPDATE-CONV] Conversation:', conv.id);
            console.log('🔧 [UPDATE-CONV] Is current conversation:', isCurrentConversation);
            console.log('🔧 [UPDATE-CONV] Is from customer:', data.isFromCustomer);
            console.log('🔧 [UPDATE-CONV] Should update time:', shouldUpdateTime);

            // ✅ FIX: الحفاظ على unreadCount من Socket.IO
            // فقط نصفّر العداد إذا كانت المحادثة مفتوحة فعلاً وكانت رسالة من عميل
            const newUnreadCount = isCurrentConversation && data.isFromCustomer
              ? 0  // المحادثة مفتوحة ورسالة من عميل → نصفّر العداد
              : data.isFromCustomer
                ? (conv.unreadCount || 0) + 1  // رسالة من عميل → نزيد العداد
                : conv.unreadCount;  // رسالة من موظف → نحتفظ بالعداد

            console.log(`🔢 [UNREAD-COUNT] Conv ${conv.id}:`, {
              isCurrentConversation,
              isFromCustomer: data.isFromCustomer,
              oldCount: conv.unreadCount,
              newCount: newUnreadCount
            });

            return {
              ...conv,
              messages: messageExists ? existingMessages : [...existingMessages, newMessage],
              lastMessage: data.content,
              // فقط نحدث الوقت إذا كانت رسالة عميل أو محادثة مش مفتوحة
              lastMessageTime: shouldUpdateTime ? new Date(data.timestamp) : conv.lastMessageTime,
              // ✅ FIX: استخدام العداد المحسوب بناءً على Socket.IO
              unreadCount: newUnreadCount,
              // تحديث أعلام آخر رسالة وحالة عدم القراءة
              lastMessageIsFromCustomer: !!data.isFromCustomer,
              lastCustomerMessageIsUnread: !!data.isFromCustomer && !isCurrentConversation
            };
          }
          return conv;
        });

        // 🔧 FIX: إعادة ترتيب المحادثات فقط إذا كانت الرسالة من العميل
        // رسائل الموظفين لا تغير ترتيب المحادثات
        if (data.isFromCustomer) {
          console.log('📨 [SOCKET-REORDER] Customer message received, REORDERING conversations');
          return updatedConversations.sort((a: Conversation, b: Conversation) => {
            const timeA = new Date(a.lastMessageTime).getTime();
            const timeB = new Date(b.lastMessageTime).getTime();
            return timeB - timeA; // الأحدث أولاً
          });
        }

        // إذا كانت رسالة من موظف، أبقِ الترتيب كما هو
        console.log('💼 [SOCKET-REORDER] Staff/AI message received, KEEPING conversation position');
        console.log('💼 [SOCKET-REORDER] NOT reordering - returning as is');
        return updatedConversations;
      });

      // تحديث المحادثة المختارة إذا كانت نفس المحادثة
      if (selectedConversation?.id === data.conversationId) {
        setSelectedConversation((prev: Conversation | null) => {
          if (!prev) return null;

          // التحقق من عدم وجود الرسالة بالفعل لتجنب التكرار (محسن)
          const existingMessages = prev.messages || [];
          const messageExists = existingMessages.some((msg: Message) => {
            // فحص بالمعرف
            if (msg.id === newMessage.id) {
              console.log('⚠️ [SOCKET] Duplicate message ID detected:', msg.id);
              return true;
            }

            // فحص بالمحتوى والوقت (للرسائل من الذكاء الاصطناعي)
            if (msg.content === newMessage.content &&
              !msg.isFromCustomer &&
              !newMessage.isFromCustomer &&
              Math.abs(new Date(msg.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 2000) {
              console.log('⚠️ [SOCKET] Duplicate AI message content detected:', msg.content.substring(0, 50));
              return true;
            }

            return false;
          });

          if (messageExists) {
            console.log('⚠️ [SOCKET] Message already exists, skipping duplicate');
            return prev;
          }

          console.log('✅ [SOCKET] Adding new message to selected conversation');
          return {
            ...prev,
            messages: [...existingMessages, newMessage],
            lastMessage: data.content,
            lastMessageTime: new Date(data.timestamp),
            lastMessageIsFromCustomer: !!data.isFromCustomer,
            lastCustomerMessageIsUnread: false
          };
        });

        // إذا لم يكن المستخدم في الأسفل، زيادة عداد الرسائل غير المقروءة
        if (showScrollToBottom) {
          setUnreadMessagesCount(prev => prev + 1);

          // ✅ تشغيل صوت الإشعار فقط لرسائل نفس الشركة
          const messageCompanyId = data.companyId || data.metadata?.companyId;
          if (!messageCompanyId || (companyId && String(messageCompanyId) === String(companyId))) {
            playNotificationSound();
            showBrowserNotification(
              `رسالة جديدة من ${data.senderName || 'العميل'}`,
              data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content
            );
          } else {
            console.log('🔕 Skipping notification - different company');
          }
        } else if (autoScrollEnabled) {
          // التمرير للأسفل إذا كان المستخدم في الأسفل
          setTimeout(() => scrollToBottom(), 100);
        }
      }
    };

    // مؤشر الكتابة
    const handleUserTyping = (data: any) => {
      console.log('✍️ User typing:', data);
      setTypingUsers(prev => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });

      // إزالة مؤشر الكتابة بعد 3 ثوان
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== data.userId));
      }, 3000);
    };

    // إيقاف الكتابة
    const handleUserStoppedTyping = (data: any) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId));
    };

    // مؤشر كتابة الذكاء الاصطناعي
    const handleAiTyping = (data: any) => {
      const evId = String(data?.conversationId ?? '');
      const selId = String(selectedConversation?.id ?? '');
      console.log('🤖 [SOCKET] ai_typing:', data, 'selected:', selId);
      if (!selectedConversation || evId !== selId) return;
      setIsAiTyping(!!data.isTyping);
      if (data.isTyping) {
        if (aiTypingTimeoutRef.current) clearTimeout(aiTypingTimeoutRef.current);
        aiTypingTimeoutRef.current = setTimeout(() => setIsAiTyping(false), 8000);
      } else {
        if (aiTypingTimeoutRef.current) {
          clearTimeout(aiTypingTimeoutRef.current);
          aiTypingTimeoutRef.current = null;
        }
      }
    };

    // حالة الاتصال
    const handleUserOnline = (data: any) => {
      console.log('🟢 User online:', data.userId);
      setOnlineUsers(prev => {
        if (!prev.includes(data.userId)) {
          return [...prev, data.userId];
        }
        return prev;
      });

      // تحديث حالة المحادثات
      setConversations(prev => prev.map(conv =>
        conv.id === data.userId ? { ...conv, isOnline: true } : conv
      ));
    };

    const handleUserOffline = (data: any) => {
      console.log('🔴 User offline:', data.userId);
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));

      // تحديث حالة المحادثات
      setConversations(prev => prev.map(conv =>
        conv.id === data.userId ? { ...conv, isOnline: false } : conv
      ));
    };

    // استقبال محادثة جديدة
    const handleConversationCreated = (data: any) => {
      // ✅ FIX: تجاهل محادثات المنصات الأخرى
      if (data.platform && data.platform.toLowerCase() !== 'facebook') {
        console.log('🔕 [SOCKET] Ignoring new conversation from different platform:', data.platform);
        return;
      }
      if (data.channel && data.channel.toLowerCase() !== 'facebook') {
        console.log('🔕 [SOCKET] Ignoring new conversation from different channel:', data.channel);
        return;
      }

      console.log('🆕 [SOCKET] New conversation created:', data);

      // ✅ FIX: التحقق من أن المحادثة تخص نفس الشركة قبل إضافتها
      const conversationCompanyId = data.companyId;
      if (conversationCompanyId && companyId && String(conversationCompanyId) !== String(companyId)) {
        console.log('🔕 [SOCKET] Ignoring conversation from different company:', {
          conversationCompanyId,
          currentCompanyId: companyId,
          conversationId: data.id
        });
        return; // تجاهل المحادثة تماماً إذا كانت من شركة أخرى
      }

      const formattedConversation: Conversation = {
        id: data.id,
        customerId: data.customerId || data.id,
        customerName: data.customerName || 'عميل غير معروف',
        lastMessage: data.lastMessage || 'محادثة جديدة',
        lastMessageTime: new Date(data.lastMessageTime || Date.now()),
        unreadCount: data.unreadCount || 0,
        platform: 'facebook',
        isOnline: false,
        messages: [],
        pageName: data.pageName || 'unknown',
        pageId: data.pageId,
        lastMessageIsFromCustomer: true,
        lastCustomerMessageIsUnread: true
      };

      // إضافة المحادثة لأعلى القائمة
      setConversations(prev => {
        // ✅ FIX: إذا كانت المحادثة موجودة، نحدثها بدلاً من تخطيها
        const existingIndex = prev.findIndex(conv => conv.id === data.id);
        if (existingIndex !== -1) {
          console.log('🔄 [SOCKET] Conversation already exists, updating instead of skipping...');
          const existing = prev[existingIndex];
          const updated = [...prev];

          // ✅ FIX: الحفاظ على unreadCount من المحادثة المؤقتة (Socket.IO)
          // لأن formattedConversation قد يحتوي على unreadCount = 0 من السيرفر
          console.log(`🔢 [CONV-NEW-UPDATE] Conv ${data.id}:`, {
            existingUnreadCount: existing.unreadCount,
            newUnreadCount: formattedConversation.unreadCount,
            keepingExisting: true
          });

          // تحديث المحادثة الموجودة بالبيانات الجديدة
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...formattedConversation,
            // ✅ FIX: الحفاظ على unreadCount من Socket.IO
            unreadCount: existing.unreadCount,
            lastCustomerMessageIsUnread: existing.lastCustomerMessageIsUnread,
            // الحفاظ على الرسائل الموجودة إذا كانت موجودة
            messages: updated[existingIndex].messages && updated[existingIndex].messages.length > 0
              ? updated[existingIndex].messages
              : formattedConversation.messages
          };
          return updated;
        }

        // 🔔 تشغيل صوت التنبيه للمحادثة الجديدة (مع عزل الشركات)
        if (conversationCompanyId && companyId && String(conversationCompanyId) === String(companyId)) {
          console.log('🔔 Playing notification sound for new conversation');
          socketService.playNotificationSound();
        } else if (!conversationCompanyId) {
          // للتوافق مع الإصدارات القديمة
          console.log('🔔 Playing notification sound (no company isolation)');
          socketService.playNotificationSound();
        } else {
          console.log('🔕 Skipping notification - different company:', { conversationCompanyId, currentCompanyId: companyId });
        }

        console.log('✅ [SOCKET] Adding new conversation to frontend list');
        return [formattedConversation, ...prev];
      });

      console.log('✅ [SOCKET] New conversation added to frontend list');
    };

    // تسجيل مستمعي الأحداث
    console.log('🎯 [SOCKET] Registering event listeners...');
    on('new_message', handleNewMessage);
    on('user_typing', handleUserTyping);
    on('user_stopped_typing', handleUserStoppedTyping);
    on('user_online', handleUserOnline);
    on('user_offline', handleUserOffline);
    on('conversation:new', handleConversationCreated);
    on('ai_typing', handleAiTyping);
    console.log('✅ [SOCKET] Event listeners registered successfully');

    // تنظيف المستمعين عند إلغاء التحميل
    return () => {
      console.log('🧹 [SOCKET] Cleaning up event listeners...');
      off('new_message', handleNewMessage);
      off('user_typing', handleUserTyping);
      off('user_stopped_typing', handleUserStoppedTyping);
      off('user_online', handleUserOnline);
      off('user_offline', handleUserOffline);
      off('conversation:new', handleConversationCreated);
      off('ai_typing', handleAiTyping);
      console.log('✅ [SOCKET] Event listeners cleaned up');
    };
  }, [socket, isConnected, selectedConversation, on, off]);

  // ✅ آلية refresh دورية صامتة كل 20 ثانية
  useEffect(() => {
    // لا نبدأ refresh إذا كان socket غير متصل أو أثناء loading
    if (!isConnected || loading || loadingMoreConversations) {
      return;
    }

    // refresh كل 20 ثانية بشكل صامت (silent)
    const refreshInterval = setInterval(() => {
      // التحقق مرة أخرى قبل refresh
      if (!isConnected || loading || loadingMoreConversations) {
        return;
      }

      // refresh قائمة المحادثات بشكل صامت (silent - بدون إظهار loading)
      loadConversations(1, false, true).catch(error => {
        console.error('❌ [SILENT-REFRESH] Error during silent refresh:', error);
      });
    }, 20000); // 20 ثانية

    return () => {
      clearInterval(refreshInterval);
    };
  }, [isConnected, loading, loadingMoreConversations, loadConversations]);

  // تفعيل الصوت عند أول user interaction
  useEffect(() => {
    const enableAudioOnInteraction = () => {
      console.log('🎵 [SOUND] User interaction detected, enabling audio...');
      socketService.enableSound();
      // إزالة الـ listeners بعد أول interaction
      document.removeEventListener('click', enableAudioOnInteraction);
      document.removeEventListener('keydown', enableAudioOnInteraction);
      document.removeEventListener('touchstart', enableAudioOnInteraction);
    };

    // إضافة listeners لأول user interaction
    document.addEventListener('click', enableAudioOnInteraction);
    document.addEventListener('keydown', enableAudioOnInteraction);
    document.addEventListener('touchstart', enableAudioOnInteraction);

    return () => {
      document.removeEventListener('click', enableAudioOnInteraction);
      document.removeEventListener('keydown', enableAudioOnInteraction);
      document.removeEventListener('touchstart', enableAudioOnInteraction);
    };
  }, []);

  // تحميل المحادثات عند بدء التشغيل
  useEffect(() => {
    console.log('🚀 ConversationsImprovedFixed component mounted');
    console.log('🔗 Current URL:', window.location.href);
    console.log('🔗 URL search params:', window.location.search);

    // انتظار انتهاء تحميل المصادقة
    if (authLoading) {
      console.log('⏳ Waiting for auth to load...');
      return;
    }

    // التحقق من المصادقة
    if (!isAuthenticated) {
      console.log('❌ User not authenticated, redirecting to login...');
      window.location.href = '/auth/login';
      return;
    }

    // فحص معامل URL فوراً
    const urlParams = new URLSearchParams(window.location.search);
    const conversationIdFromUrl = urlParams.get('conversationId');
    console.log('🎯 Initial conversation ID from URL:', conversationIdFromUrl);

    loadConversations();
  }, [authLoading, isAuthenticated]);

  // معالجة معامل URL عند تحميل المحادثات
  useEffect(() => {
    // ✅ FIX: فقط معالجة URL param - لا نختار محادثة تلقائياً إلا من URL فقط
    if (conversations.length === 0) {
      return; // لا شيء للقيام به إذا لم تكن هناك محادثات
    }

    // ✅ FIX: إذا كان هناك محادثة محددة بالفعل و hasAutoSelectedRef = true، لا نفعل شيء
    // هذا يمنع اختيار محادثة جديدة تلقائياً عند وصول رسائل جديدة أو محادثات جديدة
    if (selectedConversation && hasAutoSelectedRef.current) {
      const urlParams = new URLSearchParams(window.location.search);
      const conversationIdFromUrl = urlParams.get('conversationId');

      // فقط نتحقق من URL param إذا كان مختلفاً عن المحادثة المحددة
      if (conversationIdFromUrl && conversationIdFromUrl !== selectedConversation.id) {
        console.log('🔄 URL param changed, loading directly from server:', conversationIdFromUrl);
        // ✅ FIX: لا نبحث في القائمة - نروح مباشرة للسيرفر
        loadSpecificConversation(conversationIdFromUrl, true);
      } else {
        console.log('✅ Conversation already selected, skipping auto-selection');
      }
      return; // ✅ FIX: الخروج مبكراً لمنع أي اختيار تلقائي
    }

    const urlParams = new URLSearchParams(window.location.search);
    const conversationIdFromUrl = urlParams.get('conversationId');

    console.log('🔄 Conversations loaded, checking URL param:', conversationIdFromUrl);
    console.log('🔄 Current selected conversation:', selectedConversation?.id);
    console.log('🔄 Has auto-selected:', hasAutoSelectedRef.current);

    // ✅ FIX: فقط نختار محادثة من URL - لا نختار تلقائياً من القائمة
    if (conversationIdFromUrl) {
      // فقط اختر المحادثة إذا كانت مختلفة عن المحددة حالياً
      if (!selectedConversation || selectedConversation.id !== conversationIdFromUrl) {
        // ✅ FIX: لا نبحث في القائمة - نروح مباشرة للسيرفر
        console.log('🔄 Loading conversation from URL directly from server:', conversationIdFromUrl);
        loadSpecificConversation(conversationIdFromUrl, true); // autoSelect = true فقط من URL
        hasAutoSelectedRef.current = true;
      } else {
        console.log('✅ Conversation from URL already selected, skipping');
        hasAutoSelectedRef.current = true;
      }
    } else {
      // ✅ FIX: لا نختار أي محادثة تلقائياً - المستخدم يختار بنفسه
      // هذا يمنع اختيار المحادثات الجديدة التي تأتي من Socket أو تحديثات القائمة
      if (!hasAutoSelectedRef.current) {
        console.log('✅ No auto-selection - user must select manually');
        hasAutoSelectedRef.current = true;
      }
      if (selectedConversation && !hasAutoSelectedRef.current) {
        console.log('✅ Conversation already selected, marking to prevent auto-selection');
        hasAutoSelectedRef.current = true;
      }
    }
  }, [conversations.length]); // ✅ FIX: الاعتماد على conversations.length فقط

  // مزامنة الرسائل بين selectedConversation و conversations
  useEffect(() => {
    if (selectedConversation && selectedConversation.messages && selectedConversation.messages.length > 0) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === selectedConversation.id) {
          return {
            ...conv,
            messages: selectedConversation.messages
          };
        }
        return conv;
      }));
    }
  }, [selectedConversation?.messages?.length]); // فقط عندما يتغير عدد الرسائل

  // الاستماع لتغييرات URL
  useEffect(() => {
    const handleUrlChange = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const conversationIdFromUrl = urlParams.get('conversationId');

      console.log('🔄 [URL-CHANGE] URL changed, conversationId:', conversationIdFromUrl);
      console.log('🔄 [URL-CHANGE] Current selected:', selectedConversation?.id);

      if (conversationIdFromUrl) {
        // ✅ FIX: فقط بدّل إذا كانت المحادثة المطلوبة مختلفة عن المحددة حالياً
        if (selectedConversation?.id !== conversationIdFromUrl) {
          console.log('🔄 [URL-CHANGE] URL changed, loading directly from server:', conversationIdFromUrl);
          // ✅ FIX: لا نبحث في القائمة - نروح مباشرة للسيرفر
          loadSpecificConversation(conversationIdFromUrl, true);
        } else {
          console.log('✅ [URL-CHANGE] Already on requested conversation, no action needed');
        }
      }
    };

    // استمع لتغييرات التاريخ (back/forward buttons)
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [conversations.length, selectedConversation?.id]); // ✅ FIX: الاعتماد على conversations.length و selectedConversation.id فقط

  // تحميل الرسائل عند البحث
  useEffect(() => {
    // إذا لم يكن هناك بحث، لا نحتاج لتحميل الرسائل
    if (!searchQuery || searchQuery.trim() === '') {
      return;
    }

    const searchLower = searchQuery.toLowerCase().trim();

    // البحث في المحادثات التي تطابق البحث (في آخر رسالة أو اسم العميل)
    const matchingConversations = conversations.filter(conv => {
      const matchesLastMessage = (conv.lastMessage || '').toLowerCase().includes(searchLower);
      const matchesCustomerName = (conv.customerName || '').toLowerCase().includes(searchLower);
      return matchesLastMessage || matchesCustomerName;
    });

    // تحميل الرسائل للمحادثات المطابقة التي لا تحتوي على رسائل محملة
    matchingConversations.forEach(conv => {
      if (!conv.messages || conv.messages.length === 0) {
        console.log(`🔍 [SEARCH] Loading all messages for conversation ${conv.id} (matched search)`);
        loadAllMessagesForConversation(conv.id);
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, conversations.length]); // يعمل عند تغيير البحث أو عدد المحادثات

  // تحديث عرض الوقت تلقائياً كل دقيقة
  useEffect(() => {
    const intervalId = setInterval(() => {
      // إجبار React على إعادة الرسم لتحديث عرض الوقت
      setConversations((prev: Conversation[]) => [...prev]);
    }, 60000); // كل دقيقة

    return () => clearInterval(intervalId);
  }, []);

  // ✅ FIX: منع scroll تلقائي عند focus على input في الموبايل
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth > 768) return;

    let savedScrollY = 0;
    let isInputFocused = false;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        isInputFocused = true;
        savedScrollY = window.scrollY;
      }
    };

    const handleBlur = () => {
      isInputFocused = false;
    };

    const preventScroll = () => {
      if (isInputFocused) {
        window.scrollTo(0, savedScrollY);
      }
    };

    // منع scroll التلقائي عند focus
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);

    // منع scroll التلقائي
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      if (isInputFocused) {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          window.scrollTo(0, savedScrollY);
        }, 10);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: false });

    return () => {
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('focusout', handleBlur, true);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  // دالة لإزالة الرسائل المكررة
  const removeDuplicateMessages = (messages: Message[]): Message[] => {
    // تعطيل console logs المفرطة في production
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [DEDUP] Processing', messages.length, 'messages for deduplication');
    }

    const seen = new Set<string>();
    const uniqueMessages: Message[] = [];

    // ترتيب الرسائل حسب الوقت أولاً لضمان الترتيب الصحيح
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });

    for (const message of sortedMessages) {
      // استخدام ID كمفتاح أساسي مع فحص إضافي للمحتوى
      if (seen.has(message.id)) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔄 [DUPLICATE-REMOVED] Removing duplicate message: ${message.id}`);
        }
        continue;
      }

      seen.add(message.id);

      // إضافة علامة isAiGenerated إذا لم تكن موجودة
      const enhancedMessage = {
        ...message,
        isAiGenerated: message.isAiGenerated ||
          (message.senderId === 'ai_agent') ||
          (message.senderName === 'الذكاء الاصطناعي') ||
          (message.metadata?.isAIGenerated) ||
          false
      };

      uniqueMessages.push(enhancedMessage);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [DEDUP] Kept ${uniqueMessages.length}/${messages.length} unique messages (sorted by timestamp)`);
    }
    return uniqueMessages;
  };

  // معالجة الضغط على Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter للنزول لسطر جديد
    if (e.key === 'Enter' && e.shiftKey) {
      // السماح بالسلوك الافتراضي (النزول لسطر جديد)
      return;
    }

    // Enter فقط للإرسال
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // إضافة emoji للرسالة
  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = newMessage;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setNewMessage(newText);

      // إعادة التركيز على textarea وضبط المؤشر بعد الـ emoji
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  // إغلاق emoji picker عند الضغط خارجه
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }

    return undefined;
  }, [showEmojiPicker]);

  // تعديل حجم textarea تلقائياً
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  // تحديث الارتفاع عند تغيير النص
  useEffect(() => {
    adjustTextareaHeight();
  }, [newMessage]);

  // دالة لتنسيق عرض التاريخ والوقت
  const formatMessageTime = (date: Date): string => {
    const now = new Date();
    const messageDate = new Date(date);

    // إزالة الوقت للمقارنة بالتاريخ فقط
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

    // إذا كانت الرسالة اليوم: عرض الوقت
    if (messageDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    // إذا كانت الرسالة أمس: عرض "أمس"
    else if (messageDay.getTime() === yesterday.getTime()) {
      return 'أمس';
    }
    // إذا كانت قبل ذلك: عرض التاريخ الميلادي
    else {
      return messageDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  };

  // فلترة المحادثات حسب البحث والنوع وترتيبها حسب آخر رسالة
  const filteredConversations = useMemo(() => {
    return conversations
      .filter(conv => {
        // 🚫 منع ظهور محادثات التليجرام في هذه الصفحة (مخصصة للفيسبوك فقط)
        if (conv.platform === 'telegram' || conv.channel === 'TELEGRAM') {
          return false;
        }

        // فلترة حسب نوع المحادثة:
        // all        => كل المحادثات
        // unread     => أي محادثة بها رسائل غير مقروءة (unreadCount > 0)
        // unreplied  => آخر رسالة من العميل ولم يتم الرد عليها (lastCustomerMessageIsUnread = true)
        const matchesFilter =
          conversationFilter === 'all' ||
          (conversationFilter === 'unread' &&
            (conv.unreadCount || 0) > 0 &&
            conv.lastMessageIsFromCustomer === true) ||
          (conversationFilter === 'unreplied' &&
            conv.lastMessageIsFromCustomer === true &&
            conv.lastCustomerMessageIsUnread === true) ||
          (conversationFilter === 'telegram' &&
            (conv.platform === 'telegram' || conv.channel === 'TELEGRAM'));

        // إذا لم يكن هناك بحث، نرجع النتيجة حسب الفلتر فقط
        if (!searchQuery || searchQuery.trim() === '') {
          return matchesFilter;
        }

        const searchLower = searchQuery.toLowerCase().trim();

        // البحث في آخر رسالة (متوفرة دائماً)
        const matchesLastMessage = (conv.lastMessage || '').toLowerCase().includes(searchLower);

        // البحث في محتوى الرسائل المحملة في المحادثة
        const matchesMessages = (conv.messages || []).some((message: Message) => {
          // البحث في محتوى الرسالة
          const contentMatch = (message.content || '').toLowerCase().includes(searchLower);

          return contentMatch;
        });

        const matchesSearch = matchesLastMessage || matchesMessages;

        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => {
        // ترتيب حسب آخر رسالة (الأحدث أولاً)
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });
  }, [conversations, conversationFilter, searchQuery]);

  // عرض حالة تحميل المصادقة
  if (authLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex items-center justify-center w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('conversations.verifyingAuth', 'Verifying authentication...')}</p>
          </div>
        </div>
      </div>
    );
  }

  // إعادة توجيه إذا لم يكن مصادق
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex items-center justify-center w-full">
          <div className="text-center">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
              <h3 className="text-yellow-800 font-semibold mb-2">🔐 {t('conversations.loginRequired', 'Login Required')}</h3>
              <p className="text-yellow-700 mb-4">{t('conversations.mustLogin', 'You must login to access conversations')}</p>
              <button
                onClick={() => window.location.href = '/auth/login'}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t('conversations.login', 'Login')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        {/* Sidebar Skeleton */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4 animate-pulse"></div>
            <div className="flex space-x-2 mb-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
            <div className="h-10 bg-gray-200 rounded w-full animate-pulse"></div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center p-3 space-x-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area Skeleton */}
        <div className="flex-1 flex flex-col bg-gray-50">
          <div className="bg-white border-b border-gray-200 p-4 flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-1/6 animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <div className={`w-1/3 h-16 rounded-lg animate-pulse ${i % 2 === 0 ? 'bg-gray-200' : 'bg-blue-100'}`}></div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="h-12 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex items-center justify-center w-full">
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h3 className="text-red-800 font-semibold mb-2">❌ {t('conversations.loadingError', 'Loading Error')}</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={loadConversations}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {t('conversations.retry', 'Retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden" style={{ height: '90vh' }}>
      {/* قائمة المحادثات */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col overflow-hidden" style={{ height: '90vh' }}>
        {/* رأس قائمة المحادثات */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              🚀 {t('conversations.enhancedConversations', 'Enhanced Conversations')}
            </h2>
            {isConnected ? (
              <div className="flex items-center text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm">{t('conversations.connected', 'Connected')}</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm">{isReconnecting ? t('conversations.reconnecting', 'Reconnecting...') : t('conversations.disconnected', 'Disconnected')}</span>
              </div>
            )}
          </div>

          {/* أزرار التحكم */}
          <div className="flex items-center space-x-2 mb-4">
            <button
              onClick={() => {
                console.log('🔄 Manual reload conversations');
                loadConversations();
              }}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
              title={t('conversations.reload', 'Reload')}
            >
              🔄 {t('conversations.reload', 'Reload')}
            </button>

            <button
              onClick={() => {
                const urlParams = new URLSearchParams(window.location.search);
                const conversationIdFromUrl = urlParams.get('conversationId');
                console.log('🧪 Manual URL check:', conversationIdFromUrl);
                if (conversationIdFromUrl) {
                  console.log('🧪 Loading directly from server (not searching in list)');
                  // ✅ FIX: لا نبحث في القائمة - نروح مباشرة للسيرفر
                  loadSpecificConversation(conversationIdFromUrl, true);
                }
              }}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              title={t('conversations.testUrl', 'Test URL')}
            >
              🧪 {t('conversations.testUrl', 'Test URL')}
            </button>
          </div>

          {/* تبويبات الفلترة */}
          <div className="flex items-center space-x-2 mb-4 border-b border-gray-200">
            {/* الكل */}
            <button
              onClick={() => setConversationFilter('all')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative ${conversationFilter === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('conversations.all', 'All')}
              <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {conversations.length}
              </span>
            </button>

            {/* غير مقروءة: أي محادثة فيها unreadCount > 0 */}
            <button
              onClick={() => setConversationFilter('unread')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative ${conversationFilter === 'unread'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('conversations.unread', 'Unread')}
              <span className="ml-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                {conversations.filter(
                  c => (c.unreadCount || 0) > 0 && c.lastMessageIsFromCustomer === true
                ).length}
              </span>
            </button>

            {/* غير مُرَدّ عليها: آخر رسالة من العميل ولم يتم الرد عليها */}
            <button
              onClick={() => setConversationFilter('unreplied')}
              className={`flex-1 py-2 text-sm font-medium transition-colors relative ${conversationFilter === 'unreplied'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('conversations.unreplied', 'Unreplied')}
              <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                {conversations.filter(
                  c => c.lastMessageIsFromCustomer === true && c.lastCustomerMessageIsUnread === true
                ).length}
              </span>
            </button>


          </div>

          {/* شريط البحث */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('conversations.searchConversations', 'Search conversations...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* قائمة المحادثات */}
        <div
          ref={conversationsListRef}
          className="flex-1 overflow-y-auto min-h-0"
          onScroll={handleConversationsScroll}
        >
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery ? t('conversations.noResults', 'No search results') : t('conversations.noConversations', 'No conversations')}
            </div>
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedConversation?.id === conversation.id
                    ? 'bg-blue-50 border-r-4 border-r-blue-500'
                    : conversation.lastMessageIsFromCustomer
                      ? 'bg-green-50 border-r-4 border-r-green-400'
                      : ''
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center space-x-3 flex-1 cursor-pointer"
                      onClick={() => selectConversation(conversation.id)}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold relative">
                          {conversation.customerName.charAt(0)}

                          {/* Platform Icon Badge */}
                          <div className="absolute -bottom-1 -left-1 bg-white rounded-full p-0.5 shadow-sm z-10">
                            {(conversation.platform === 'telegram' || conversation.channel === 'TELEGRAM') ? (
                              <PaperAirplaneIcon className="w-4 h-4 text-sky-500 transform -rotate-45" />
                            ) : (conversation.platform === 'whatsapp' || conversation.channel === 'WHATSAPP') ? (
                              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <PhoneIcon className="w-2.5 h-2.5 text-white" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold">f</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {/* مؤشر حالة الاتصال */}
                        {onlineUsers.includes(conversation.id) && (
                          <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
                            <span>{conversation.customerName}</span>
                            {conversation.pageName && (
                              <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded text-sm">
                                {conversation.pageName}
                              </span>
                            )}
                          </h3>

                          {onlineUsers.includes(conversation.id) && (
                            <span className="text-xs text-green-600 font-medium">متصل</span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          {/* مؤشر مرسل آخر رسالة */}
                          {conversation.lastMessageIsFromCustomer ? (
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded mr-1" title="رسالة من العميل">عميل</span>
                          ) : (
                            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded mr-1" title="رسالة من الموظف">موظف</span>
                          )}
                          <p className={`text-sm flex-1 ${conversation.lastMessageIsFromCustomer
                            ? 'text-gray-900 font-semibold'
                            : 'text-gray-500'
                            }`}>
                            {conversation.lastMessage.length > 40
                              ? conversation.lastMessage.substring(0, 40) + '...'
                              : conversation.lastMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {formatMessageTime(conversation.lastMessageTime)}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <div className="bg-blue-600 text-white text-xs rounded-full px-2 py-1 mt-1 inline-block">
                            {conversation.unreadCount}
                          </div>
                        )}
                      </div>
                      {/* زر وضع علامة غير مقروءة (بالجانب لكل محادثة) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsUnread(conversation.id, conversation.unreadCount > 0);
                        }}
                        disabled={markingAsUnread === conversation.id}
                        className={`p-2 rounded-full transition-all duration-200 ${conversation.unreadCount > 0
                          ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                          : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={conversation.unreadCount > 0 ? t('conversations.markAsRead', 'Mark as read') : t('conversations.markAsUnread', 'Mark as unread')}
                      >
                        {markingAsUnread === conversation.id ? (
                          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5" fill={conversation.unreadCount > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>

                      {/* زر الحذف */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(conversation);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title={t('conversations.deleteConversation', 'Delete conversation')}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
              }

              {/* مؤشر تحميل المزيد */}
              {loadingMoreConversations && (
                <div className="p-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-sm text-gray-500">{t('conversations.loading', 'Loading...')}</p>
                </div>
              )}

              {/* رسالة عدم وجود المزيد */}
              {!hasMoreConversations && conversations.length > 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  {t('conversations.allConversationsDisplayed', 'All conversations displayed')} ({totalConversations})
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* منطقة المحادثة */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '90vh' }} id="conversation-area">
        {selectedConversation ? (
          <>
            {/* شريط علوي مع معلومات المحادثة */}
            <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0">
              {/* عرض اسم الصفحة / البوت */}
              {(selectedConversation.pageName || selectedConversation.platform === 'telegram' || selectedConversation.channel === 'TELEGRAM') && (
                <div className={`mb-2 px-3 py-1 rounded-lg inline-block ${(selectedConversation.platform === 'telegram' || selectedConversation.channel === 'TELEGRAM')
                  ? 'bg-sky-50 border border-sky-200'
                  : 'bg-blue-50 border border-blue-200'
                  }`}>
                  <div className="flex items-center space-x-2 text-sm">
                    {(selectedConversation.platform === 'telegram' || selectedConversation.channel === 'TELEGRAM') ? (
                      <PaperAirplaneIcon className="w-4 h-4 text-sky-600 transform -rotate-45" />
                    ) : (
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">f</span>
                      </div>
                    )}
                    <span className={`${(selectedConversation.platform === 'telegram' || selectedConversation.channel === 'TELEGRAM') ? 'text-sky-700' : 'text-blue-700'} font-medium`}>
                      {(selectedConversation.platform === 'telegram' || selectedConversation.channel === 'TELEGRAM') ? 'Telegram Bot' : t('conversations.page', 'Page')}: {selectedConversation.pageName || 'Bot'}
                    </span>
                  </div>
                </div>
              )}

              {/* 🆕 عرض معلومات المنشور */}
              {/* 🆕 Post Details Section - Show if postId exists */}
              {selectedConversation.postId && (
                <div className="mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start space-x-2 space-x-reverse">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 text-sm mb-1">
                        <span className="text-purple-700 font-semibold">📌 جاء من منشور</span>
                        {!selectedConversation.postDetails && (
                          <span className="text-xs text-purple-500">جاري تحميل التفاصيل...</span>
                        )}
                        {selectedConversation.postDetails?.permalinkUrl && (
                          <a
                            href={selectedConversation.postDetails.permalinkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800 text-xs underline flex items-center space-x-1"
                          >
                            <span>عرض المنشور</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      {selectedConversation.postDetails?.message && (
                        <p className="text-xs text-purple-800 mb-2 line-clamp-2">
                          {selectedConversation.postDetails.message}
                        </p>
                      )}
                      {selectedConversation.postDetails?.hasImages && selectedConversation.postDetails?.imageUrls && selectedConversation.postDetails.imageUrls.length > 0 && (
                        <div className="flex space-x-1 space-x-reverse">
                          {selectedConversation.postDetails.imageUrls.slice(0, 3).map((imageUrl, idx) => (
                            <img
                              key={idx}
                              src={imageUrl}
                              alt={`Post image ${idx + 1}`}
                              className="w-12 h-12 object-cover rounded border border-purple-200"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ))}
                          {selectedConversation.postDetails.imageUrls.length > 3 && (
                            <div className="w-12 h-12 bg-purple-100 border border-purple-200 rounded flex items-center justify-center text-xs text-purple-700 font-medium">
                              +{selectedConversation.postDetails.imageUrls.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-purple-600 mt-1">
                        Post ID: {selectedConversation.postId.substring(0, 20)}...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {selectedConversation.customerName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedConversation.customerName}</h2>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'
                        }`}></span>
                      <span>{isConnected ? 'متصل' : 'غير متصل'}</span>
                      {isReconnecting && <span className="text-yellow-600">يعيد الاتصال...</span>}

                      {/* ✅ عرض معلومات الإعلان */}
                      {selectedConversation.adSource && (
                        <div className="flex items-center space-x-1 space-x-reverse bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-200">
                          <span className="text-xs font-medium">📢</span>
                          <span className="text-xs font-medium">رد على إعلان</span>
                          {selectedConversation.adSource.adId && (
                            <span className="text-xs text-blue-600">(ID: {selectedConversation.adSource.adId.substring(0, 8)}...)</span>
                          )}
                        </div>
                      )}

                      {/* إحصائيات الرسائل */}
                      {selectedConversation.messages && (selectedConversation.messages || []).length > 0 && (
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            👤 {(selectedConversation.messages || []).filter(m => !m.isFromCustomer && !m.isAiGenerated).length} {t('conversations.manual', 'Manual')}
                          </span>
                          <span className="text-green-600 bg-green-50 px-2 py-1 rounded">
                            🤖 {(selectedConversation.messages || []).filter(m => !m.isFromCustomer && m.isAiGenerated).length} {t('conversations.smart', 'Smart')}
                          </span>
                        </div>
                      )}

                      {/* Debug info */}
                      <span className="text-xs text-blue-500 border border-blue-200 px-1 rounded">
                        AI: {selectedConversation.aiEnabled !== undefined ? (selectedConversation.aiEnabled ? 'ON' : 'OFF') : 'UNDEFINED'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {/* أزرار الإشعارات */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-full hover:bg-gray-100 ${soundEnabled ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    title={soundEnabled ? t('conversations.muteSound', 'Mute sound') : t('conversations.enableSound', 'Enable sound')}
                  >
                    {soundEnabled ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4c0-1.1.9-2 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9zm14 11V5h-2v15h2zm-4.5-7h-2v2h2v-2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`p-2 rounded-full hover:bg-gray-100 ${notificationsEnabled ? 'text-blue-600' : 'text-gray-400'
                      }`}
                    title={notificationsEnabled ? t('conversations.muteNotifications', 'Mute notifications') : t('conversations.enableNotifications', 'Enable notifications')}
                  >
                    {notificationsEnabled ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 18.69L7.84 6.14 5.27 3.49 4 4.76l2.8 2.8v.01c-.52.99-.8 2.16-.8 3.42v5l-2 2v1h13.73l2 2L21 19.73l-1-1.04zM12 22c1.11 0 2-.89 2-2h-4c0 1.11.89 2 2 2zm4-7.32V11c0-2.76-1.46-5.02-4-5.42V4.5c0-.83-.67-1.5-1.5-1.5S9 3.67 9 4.5v1.08c-.14.04-.28.08-.42.12L16 13.68z" />
                      </svg>
                    )}
                  </button>

                  {/* زر وضع علامة غير مقروءة */}
                  <button
                    onClick={() => {
                      if (selectedConversation) {
                        handleMarkAsUnread(selectedConversation.id, selectedConversation.unreadCount > 0);
                      }
                    }}
                    disabled={!selectedConversation || markingAsUnread === selectedConversation?.id}
                    className={`p-2 rounded-full transition-all duration-200 ${selectedConversation?.unreadCount > 0
                      ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                      : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={selectedConversation?.unreadCount > 0 ? t('conversations.markAsRead', 'Mark as read') : t('conversations.markAsUnread', 'Mark as unread')}
                  >
                    {markingAsUnread === selectedConversation?.id ? (
                      <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-5 h-5" fill={selectedConversation?.unreadCount > 0 ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>

                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="p-2 text-green-600 hover:text-green-700 rounded-full hover:bg-green-50 border border-green-200"
                    title={t('conversations.createNewOrder', 'Create new order')}
                  >
                    <ShoppingCartIcon className="w-5 h-5" />
                  </button>



                  {/* زر التحكم في الذكاء الاصطناعي مع نص توضيحي */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        console.log('🤖 [AI-BUTTON] Clicked! Conversation:', selectedConversation?.id, 'AI Status:', selectedConversation?.aiEnabled);
                        if (selectedConversation) {
                          handleToggleAI(selectedConversation.id, selectedConversation.aiEnabled ?? true);
                        }
                      }}
                      disabled={!selectedConversation || togglingAI === selectedConversation?.id}
                      className={`p-2 rounded-full transition-all duration-200 ${selectedConversation?.aiEnabled ?? true
                        ? 'text-green-600 bg-green-50 hover:bg-green-100'
                        : 'text-red-600 bg-red-50 hover:bg-red-100'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      title={`${selectedConversation?.aiEnabled ?? true ? t('conversations.disableAI', 'Disable AI') : t('conversations.enableAI', 'Enable AI')}`}
                    >
                      {togglingAI === selectedConversation?.id ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <CpuChipIcon className="w-5 h-5" />
                      )}
                    </button>
                    <span className={`text-xs font-medium ${selectedConversation?.aiEnabled ?? true
                      ? 'text-green-600'
                      : 'text-red-600'
                      }`}>
                      {selectedConversation?.aiEnabled ?? true ? `🤖 ${t('conversations.enabled', 'Enabled')}` : `👤 ${t('conversations.manual', 'Manual')}`}
                    </span>
                  </div>

                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <PhoneIcon className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    <VideoCameraIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowCustomerProfile(true)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    title={t('conversations.customerProfile', 'Customer Profile')}
                  >
                    <InformationCircleIcon className="w-5 h-5" />
                  </button>

                  {/* 🚫 زر حظر/إلغاء حظر العميل */}
                  {selectedConversation?.pageId && (
                    <div className="flex items-center space-x-2">
                      {checkingBlockStatus ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
                      ) : isBlocked ? (
                        <button
                          onClick={handleUnblockCustomer}
                          disabled={blocking}
                          className="p-2 text-green-600 hover:text-green-700 rounded-full hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="إلغاء حظر العميل على الصفحة"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowBlockModal(true)}
                          className="p-2 text-red-600 hover:text-red-700 rounded-full hover:bg-red-50"
                          title="حظر العميل على الصفحة"
                        >
                          <NoSymbolIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* منطقة الرسائل */}
            <div
              ref={messagesContainerRef}
              className={`flex-1 overflow-y-auto p-4 space-y-4 relative transition-all min-h-0 messages-container ${isDraggingOver ? 'bg-blue-50 border-4 border-dashed border-blue-400' : ''
                }`}
              onScroll={handleScroll}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* مؤشر السحب والإفلات */}
              {isDraggingOver && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50 bg-opacity-95 pointer-events-none">
                  <div className="text-center p-8 bg-white rounded-lg shadow-2xl border-4 border-blue-500">
                    <svg className="w-20 h-20 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-2xl font-bold text-blue-600 mb-2">اسحب الصور هنا</p>
                    <p className="text-gray-600">أفلت لرفع الملفات إلى المحادثة</p>
                  </div>
                </div>
              )}
              {/* مؤشر تحميل الرسائل القديمة */}
              {loadingOldMessages && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center space-x-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-sm">{t('conversations.loadingOldMessages', 'Loading old messages...')}</span>
                  </div>
                </div>
              )}

              {(selectedConversation.messages || []).length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>{t('conversations.noMessages', 'No messages in this conversation')}</p>
                </div>
              ) : (
                <div>
                  {removeDuplicateMessages(selectedConversation.messages || []).map((message, index) => {
                    // إنشاء key فريد يجمع بين ID والفهرس لتجنب التكرار
                    const uniqueKey = message.id ? `${message.id}-${index}` : `temp-${index}-${message.timestamp?.getTime() || Date.now()}`;

                    // تسجيل تشخيصي للرسائل (تم إزالة المكررة بالفعل)
                    if (process.env.NODE_ENV === 'development' && index === 0) {
                      const originalCount = (selectedConversation.messages || []).length;
                      const cleanedCount = removeDuplicateMessages(selectedConversation.messages || []).length;
                      if (originalCount !== cleanedCount) {
                        console.warn(`🔄 [DUPLICATE-CLEANUP] Removed ${originalCount - cleanedCount} duplicate messages`);
                      }
                    }

                    return (
                      <div
                        key={uniqueKey}
                        className={`flex ${message.isFromCustomer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border-l-4 ${message.isFromCustomer
                            ? 'bg-gray-200 text-gray-800 border-l-gray-400'
                            : message.status === 'sending'
                              ? 'bg-blue-400 text-white opacity-70 border-l-blue-600'
                              : message.isAiGenerated
                                ? 'bg-green-500 text-white border-l-green-700 shadow-green-200 shadow-sm' // رسائل الذكاء الصناعي - أخضر مع ظل
                                : 'bg-blue-500 text-white border-l-blue-700 shadow-blue-200 shadow-sm'  // رسائل يدوية - أزرق مع ظل
                            }`}
                        >
                          {/* عرض Reply Preview إذا كانت هذه الرسالة رد على رسالة أخرى */}
                          {(message.replyToContentSnippet || message.replyToFacebookMessageId) && (() => {
                            // البحث عن الرسالة الأصلية لعرض الصورة إذا كانت موجودة
                            const originalMessage = message.replyToResolvedMessageId
                              ? selectedConversation?.messages?.find(m => m.id === message.replyToResolvedMessageId)
                              : null;
                            const isImageReply = message.replyToType === 'IMAGE' || originalMessage?.type === 'IMAGE' || originalMessage?.type === 'image';
                            const imageUrl = originalMessage?.fileUrl || originalMessage?.content;

                            return (
                              <div className={`mb-2 px-2 py-1.5 rounded border-l-2 text-xs ${message.isFromCustomer
                                ? 'bg-white/80 border-l-gray-500 text-gray-700'
                                : 'bg-white/20 border-l-white/50 text-white/90'
                                }`}>
                                <div className="font-semibold mb-0.5">↩️ ردًا على:</div>
                                {isImageReply && imageUrl ? (
                                  <div className="mt-1">
                                    <img
                                      src={imageUrl}
                                      alt="الرسالة الأصلية"
                                      className="max-w-full h-16 rounded object-cover cursor-pointer hover:opacity-80"
                                      onClick={() => window.open(imageUrl, '_blank')}
                                    />
                                  </div>
                                ) : (
                                  <div className="opacity-90">{message.replyToContentSnippet || 'رسالة سابقة'}</div>
                                )}
                              </div>
                            );
                          })()}

                          {/* عرض الرسائل حسب النوع */}
                          {/* تسجيل تشخيصي لكل رسالة - معطل لتقليل console logs */}
                          {false && process.env.NODE_ENV === 'development' && console.log('🔍 [MESSAGE-DEBUG] Message data:', {
                            id: message.id,
                            type: message.type,
                            content: message.content,
                            fileUrl: message.fileUrl,
                            fileName: message.fileName,
                            hasFileUrl: !!message.fileUrl,
                            isImageType: message.type === 'image' || message.type === 'IMAGE',
                            willShowAsImage: (message.type === 'image' || message.type === 'IMAGE') && (message.fileUrl || (message.content && message.content.startsWith('http'))),
                            willShowAsFile: (message.type === 'file' || message.type === 'FILE') && message.fileUrl,
                            willShowAsText: !((message.type === 'image' || message.type === 'IMAGE') && (message.fileUrl || (message.content && message.content.startsWith('http')))) && !((message.type === 'file' || message.type === 'FILE') && message.fileUrl)
                          })}

                          {(message.type === 'template' || message.type === 'TEMPLATE') ? (
                            <div className="space-y-2">
                              <img
                                src={message.content}
                                alt="Template"
                                className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(message.content, '_blank')}
                                onError={(e) => {
                                  console.error('❌ Template image load error:', message.content);
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZhaWxlZCB0byBsb2FkIGltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                }}
                              />
                              {message.attachments && (() => {
                                try {
                                  const attachments = JSON.parse(message.attachments);
                                  const template = attachments[0]?.payload;
                                  const element = template?.elements?.[0];
                                  const button = element?.buttons?.[0];
                                  return button ? (
                                    <a
                                      href={button.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`block text-center py-2 px-4 rounded text-sm font-medium transition-colors ${message.isFromCustomer
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-white text-blue-600 hover:bg-gray-100 border border-blue-600'
                                        }`}
                                    >
                                      {button.title}
                                    </a>
                                  ) : null;
                                } catch (e) {
                                  console.error('❌ Error parsing template attachments:', e);
                                  return null;
                                }
                              })()}
                            </div>
                          ) : (message.type === 'image' || message.type === 'IMAGE') && (message.fileUrl || (message.content && message.content.startsWith('http'))) ? (
                            <div>
                              {/* تسجيل تشخيصي للصور */}
                              {process.env.NODE_ENV === 'development' && console.log('🖼️ [IMAGE-DEBUG] Rendering image:', {
                                type: message.type,
                                fileUrl: message.fileUrl,
                                content: message.content,
                                fileName: message.fileName,
                                messageId: message.id,
                                finalImageUrl: message.fileUrl || message.content
                              })}
                              <img
                                src={message.fileUrl || message.content}
                                alt={message.fileName || 'صورة'}
                                className="max-w-full h-auto rounded mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(message.fileUrl || message.content, '_blank')}
                                onLoad={() => {
                                  // مرر للأسفل فقط إذا المستخدم بالفعل في الأسفل
                                  if (autoScrollEnabled) {
                                    setTimeout(() => scrollToBottom(), 50);
                                  }
                                }}
                                onError={(e) => {
                                  console.error('❌ Image load error:', message.fileUrl || message.content);
                                  console.error('❌ Message data:', JSON.stringify(message, null, 2));
                                  console.error('❌ Error event:', e);
                                  // عرض placeholder بدلاً من إخفاء الصورة
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZhaWxlZCB0byBsb2FkIGltYWdlPC90ZXh0Pjwvc3ZnPg==';
                                  (e.target as HTMLImageElement).alt = 'فشل في تحميل الصورة';
                                }}
                              />
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{message.fileName || 'صورة'}</span>
                                {message.fileSize && (
                                  <span>{(message.fileSize / 1024 / 1024).toFixed(2)} ميجابايت</span>
                                )}
                              </div>
                            </div>
                          ) : (message.type === 'file' || message.type === 'FILE') && message.fileUrl ? (
                            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg border">
                              <PaperClipIcon className="w-5 h-5 text-gray-600" />
                              <div className="flex-1">
                                <a
                                  href={message.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 underline hover:no-underline"
                                >
                                  {message.fileName || message.content}
                                </a>
                                {message.fileSize && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {(message.fileSize / 1024 / 1024).toFixed(2)} ميجابايت
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => window.open(message.fileUrl, '_blank')}
                                className="text-gray-400 hover:text-gray-600"
                                title={t('conversations.openFile', 'Open file')}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                          )}

                          <div className="flex items-center justify-between text-xs mt-1 opacity-70">
                            <div className="flex items-center space-x-1">
                              {/* أيقونة نوع الرسالة */}
                              {!message.isFromCustomer && (
                                message.isAiGenerated ? (
                                  <CpuChipIcon className="w-3 h-3" title={t('conversations.aiGenerated', 'AI Generated')} />
                                ) : (
                                  <UserIcon className="w-3 h-3" title={t('conversations.manual', 'Manual')} />
                                )
                              )}
                              <span>
                                {message.senderName}
                                {!message.isFromCustomer && (
                                  message.isAiGenerated ? ` • 🤖 ${t('conversations.aiGenerated', 'AI')}` : ` • 👤 ${t('conversations.manual', 'Manual')}`
                                )}
                                {' • '}
                                {message.timestamp.toLocaleTimeString('ar-SA', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {!message.isFromCustomer && (
                              <span className="ml-2">
                                {message.status === 'sending' && '⏳'}
                                {message.status === 'sent' && '✓'}
                                {message.status === 'delivered' && '✓✓'}
                                {message.status === 'read' && '✓✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* مؤشرات الكتابة */}
                  {typingUsers.length > 0 && (
                    <div className="flex justify-start">
                      <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg max-w-xs">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div key="dot-1" className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                            <div key="dot-2" className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div key="dot-3" className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                          <span className="text-xs">{t('conversations.customer', 'Customer')} {t('conversations.typing', 'typing...')}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAiTyping && (
                    <div className="flex justify-end mt-2">
                      <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg max-w-xs">
                        <div className="flex items-center space-x-2">
                          <CpuChipIcon className="w-4 h-4" />
                          <span className="text-xs">الذكاء الاصطناعي يكتب...</span>
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* زر الانتقال للأسفل */}
            {showScrollToBottom && (
              <div className="absolute bottom-20 right-6 z-10">
                <button
                  onClick={scrollToBottom}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  {unreadMessagesCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* معاينة الملفات المختارة */}
            {selectedFiles.length > 0 && (
              <div className="bg-gray-50 border-t border-gray-200 p-4">
                <div className="space-y-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div className="flex items-center space-x-3">
                        {filePreviews[index] ? (
                          <img src={filePreviews[index]} alt="Preview" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <PaperClipIcon className="w-6 h-6 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} ميجابايت
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={uploadFiles}
                      disabled={uploadingFile}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {uploadingFile ? 'جاري الرفع...' : `رفع ${selectedFiles.length} ملف`}
                    </button>
                    <button
                      onClick={cancelFileUpload}
                      className="text-gray-500 hover:text-gray-700 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* منطقة إدخال الرسالة */}
            <div
              className="bg-white border-t border-gray-200 p-4 flex-shrink-0"
              id="message-input-area"
              style={{
                scrollMarginBottom: '20px',
                scrollPaddingBottom: '20px'
              }}
            >
              {isAiTyping && (
                <div className="mb-2 text-sm text-blue-600 flex items-center gap-2">
                  <CpuChipIcon className="w-4 h-4 animate-pulse" />
                  <span>الذكاء الاصطناعي يكتب...</span>
                  <span className="inline-flex gap-1">
                    <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                    <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.1s]"></span>
                    <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></span>
                  </span>
                </div>
              )}
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  multiple
                />
                <label
                  htmlFor="file-upload"
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer"
                  title="رفع ملفات"
                >
                  <PaperClipIcon className="w-5 h-5" />
                </label>

                {/* زر حافظة الصور */}
                <button
                  onClick={() => {
                    setShowImageGallery(true);
                    loadImageGallery();
                  }}
                  className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 cursor-pointer transition-colors"
                  title="حافظة الصور"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>

                {/* زر حافظة النصوص */}
                <button
                  onClick={() => {
                    setShowTextGallery(true);
                    loadTextGallery();
                  }}
                  className="p-2 text-gray-400 hover:text-green-600 rounded-full hover:bg-green-50 cursor-pointer transition-colors"
                  title="حافظة النصوص"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => {
                      // ✅ FIX: منع zoom و scroll تلقائي في الموبايل
                      if (window.innerWidth <= 768) {
                        // حفظ موضع scroll الحالي قبل أي تغيير
                        const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                        const currentScrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft;

                        // تحديث viewport لمنع zoom
                        const viewport = document.querySelector('meta[name="viewport"]');
                        if (viewport) {
                          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
                        }

                        // ✅ FIX: منع scroll التلقائي فوراً
                        const preventScroll = () => {
                          const newScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                          const newScrollX = window.scrollX || window.pageXOffset || document.documentElement.scrollLeft;

                          if (Math.abs(newScrollY - currentScrollY) > 1 || Math.abs(newScrollX - currentScrollX) > 1) {
                            window.scrollTo({
                              top: currentScrollY,
                              left: currentScrollX,
                              behavior: 'instant'
                            });
                            document.documentElement.scrollTop = currentScrollY;
                            document.documentElement.scrollLeft = currentScrollX;
                            document.body.scrollTop = currentScrollY;
                            document.body.scrollLeft = currentScrollX;
                          }
                        };

                        // منع scroll فوراً وبعد فترات متعددة
                        preventScroll();
                        requestAnimationFrame(preventScroll);
                        setTimeout(preventScroll, 0);
                        setTimeout(preventScroll, 10);
                        setTimeout(preventScroll, 20);
                        setTimeout(preventScroll, 50);
                        setTimeout(preventScroll, 100);
                        setTimeout(preventScroll, 150);
                        setTimeout(preventScroll, 200);
                        setTimeout(preventScroll, 300);
                        setTimeout(preventScroll, 500);
                        setTimeout(preventScroll, 800);
                        setTimeout(preventScroll, 1000);

                        // إضافة event listeners لمنع scroll
                        const scrollHandler = (e: Event) => {
                          e.preventDefault();
                          e.stopPropagation();
                          preventScroll();
                        };

                        window.addEventListener('scroll', scrollHandler, { passive: false, capture: true });
                        document.addEventListener('scroll', scrollHandler, { passive: false, capture: true });
                        window.addEventListener('touchmove', preventScroll, { passive: false });

                        // إزالة event listeners بعد 3 ثواني
                        setTimeout(() => {
                          window.removeEventListener('scroll', scrollHandler, { capture: true });
                          document.removeEventListener('scroll', scrollHandler, { capture: true });
                          window.removeEventListener('touchmove', preventScroll);
                        }, 3000);
                      }
                    }}
                    onBlur={(e) => {
                      // ✅ FIX: إعادة تفعيل zoom بعد فقدان التركيز (اختياري)
                      if (window.innerWidth <= 768) {
                        const viewport = document.querySelector('meta[name="viewport"]');
                        if (viewport) {
                          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
                        }
                      }
                    }}
                    placeholder={t('conversations.typeMessage', 'Type a message...')}
                    rows={1}
                    className="w-full px-5 py-3 text-base border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto"
                    style={{
                      minHeight: '56px',
                      maxHeight: '150px',
                      fontSize: '18px',
                      WebkitTextSizeAdjust: '100%',
                      textSizeAdjust: '100%',
                      touchAction: 'manipulation',
                      transform: 'scale(1)',
                      zoom: 1
                    }}
                  />

                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-full left-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50"
                      style={{ width: '320px', maxHeight: '300px', overflowY: 'auto' }}
                    >
                      <div className="grid grid-cols-8 gap-2">
                        {/* Smileys & Emotion */}
                        {['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨'].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">❤️ القلوب</p>
                        <div className="grid grid-cols-8 gap-2">
                          {['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">👍 الإيماءات</p>
                        <div className="grid grid-cols-8 gap-2">
                          {['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">🎉 أخرى</p>
                        <div className="grid grid-cols-8 gap-2">
                          {['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                              type="button"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  type="button"
                >
                  <FaceSmileIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <PaperAirplaneIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <ChatBubbleLeftRightIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">اختر محادثة للبدء</h3>
              <p>اختر محادثة من القائمة لعرض الرسائل</p>
            </div>
          </div>
        )}
      </div>



      {/* Order Modal */}
      <OrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        customerId={selectedConversation?.customerId || ''}
        customerName={selectedConversation?.customerName || ''}
        conversationId={selectedConversation?.id || ''}
        onOrderCreated={handleOrderCreated}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && conversationToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 ml-2" />
              <h3 className="text-lg font-semibold text-gray-900">تأكيد حذف المحادثة</h3>
            </div>

            <p className="text-gray-600 mb-6">
              هل أنت متأكد من حذف المحادثة مع <strong>{conversationToDelete.customerName}</strong>؟
              <br />
              <span className="text-red-600 text-sm">
                ⚠️ سيتم حذف جميع الرسائل نهائياً ولا يمكن استرجاعها.
              </span>
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => deleteConversation(conversationToDelete.id)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <TrashIcon className="w-4 h-4 ml-2" />
                    حذف نهائياً
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery Modal */}
      {showImageGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900">حافظة الصور المحفوظة</h3>
                <span className="text-sm text-gray-500">({savedImages.length} صورة)</span>
              </div>

              <div className="flex items-center space-x-2">
                {/* زر إضافة صور للحافظة */}
                <input
                  type="file"
                  id="gallery-upload"
                  className="hidden"
                  onChange={handleUploadToGallery}
                  accept="image/*"
                  multiple
                />
                <label
                  htmlFor="gallery-upload"
                  className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${uploadingToGallery ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {uploadingToGallery ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span className="text-sm font-medium">جاري الرفع...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm font-medium">إضافة صور</span>
                    </>
                  )}
                </label>

                {/* زر الإغلاق */}
                <button
                  onClick={() => setShowImageGallery(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingGallery ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">جاري تحميل الصور...</p>
                  </div>
                </div>
              ) : savedImages.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-center">
                  <div>
                    <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 text-lg mb-2">لا توجد صور محفوظة</p>
                    <p className="text-gray-500 text-sm">بعد رفع الصور، يمكنك حفظها هنا للإرسال السريع لاحقاً</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {savedImages.map((image) => {
                    const isSelected = selectedImagesForSend.has(image.id);
                    return (
                      <div
                        key={image.id}
                        className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${isSelected
                          ? 'border-blue-500 ring-2 ring-blue-300'
                          : 'border-gray-200 hover:border-blue-500'
                          }`}
                        onClick={(e) => {
                          // إذا كان هناك صور مختارة، استخدم وضع الاختيار المتعدد
                          if (selectedImagesForSend.size > 0) {
                            toggleImageSelection(image.id, e);
                          } else {
                            // إذا لم يكن هناك صور مختارة، أرسل مباشرة
                            selectImageFromGallery(image.url, image.filename);
                          }
                        }}
                      >
                        <img
                          src={image.url}
                          alt={image.filename}
                          className="w-full h-40 object-cover"
                        />
                        <div className={`absolute inset-0 bg-black transition-all ${isSelected
                          ? 'bg-opacity-30'
                          : 'bg-opacity-0 group-hover:bg-opacity-50'
                          } flex items-center justify-center`}>
                          {!isSelected && (
                            <div className="transform scale-0 group-hover:scale-100 transition-transform">
                              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Checkbox للاختيار المتعدد - يظهر فوق الـ overlay */}
                        <button
                          onClick={(e) => toggleImageSelection(image.id, e)}
                          className={`absolute top-2 left-2 w-8 h-8 rounded border-2 flex items-center justify-center transition-all z-20 ${isSelected
                            ? 'bg-blue-600 border-blue-600 opacity-100'
                            : 'bg-white border-gray-300 opacity-0 group-hover:opacity-100'
                            } hover:bg-blue-500 hover:border-blue-500`}
                          title={isSelected ? "إلغاء التحديد" : "تحديد الصورة"}
                        >
                          {isSelected && (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {!isSelected && (
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                        {/* زر الحذف */}
                        <button
                          onClick={(e) => deleteImageFromGallery(image.id, e)}
                          disabled={deletingImageId === image.id}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                          title="حذف الصورة"
                        >
                          {deletingImageId === image.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <TrashIcon className="w-4 h-4" />
                          )}
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                          <p className="text-white text-xs truncate">{image.filename}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {selectedImagesForSend.size > 0 ? (
                    <>
                      <p className="text-sm text-blue-600 font-medium">
                        ✓ تم اختيار {selectedImagesForSend.size} صورة
                      </p>
                      <button
                        onClick={() => setSelectedImagesForSend(new Set())}
                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        إلغاء الاختيار
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      💡 اضغط على أي صورة لإرسالها مباشرة، أو اختر عدة صور للإرسال المتعدد
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {selectedImagesForSend.size > 0 && (
                    <button
                      onClick={sendMultipleImagesFromGallery}
                      disabled={sendingMultipleImages}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      {sendingMultipleImages ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>جاري الإرسال...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          <span>إرسال {selectedImagesForSend.size} صورة</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowImageGallery(false);
                      setSelectedImagesForSend(new Set());
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Gallery Modal */}
      {showTextGallery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-bold text-gray-900">حافظة النصوص المحفوظة</h3>
                <span className="text-sm text-gray-500">({savedTexts.length} نص)</span>
              </div>

              <button
                onClick={() => setShowTextGallery(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Form لإضافة نص جديد */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">إضافة نص جديد</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="عنوان النص (اختياري)"
                    value={newTextTitle}
                    onChange={(e) => setNewTextTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <textarea
                    placeholder="محتوى النص..."
                    value={newTextContent}
                    onChange={(e) => setNewTextContent(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />

                  {/* رفع الصور */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      إرفاق صور (اختياري)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleTextGalleryImageSelect}
                      className="hidden"
                      id="text-gallery-image-input"
                    />
                    <label
                      htmlFor="text-gallery-image-input"
                      className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="text-sm text-gray-600">اختر صور لإرفاقها مع النص</span>
                    </label>

                    {/* معاينة الصور المرفوعة */}
                    {newTextImagePreviews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {newTextImagePreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <button
                              onClick={() => removeTextGalleryImage(index)}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="حذف الصورة"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={saveTextToGallery}
                    disabled={savingText || (!newTextContent.trim() && newTextImages.length === 0)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingText ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        <span>جاري الحفظ...</span>
                      </div>
                    ) : (
                      'حفظ النص'
                    )}
                  </button>
                </div>
              </div>

              {loadingTextGallery ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">جاري تحميل النصوص...</p>
                  </div>
                </div>
              ) : savedTexts.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-center">
                  <div>
                    <svg className="w-24 h-24 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600 text-lg mb-2">لا توجد نصوص محفوظة</p>
                    <p className="text-gray-500 text-sm">احفظ النصوص الشائعة هنا للإرسال السريع لاحقاً</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedTexts.map((text) => (
                    <div
                      key={text.id}
                      className={`p-4 bg-white border rounded-lg transition-all group ${editingTextId === text.id
                        ? 'border-blue-500 shadow-lg'
                        : 'border-gray-200 hover:border-green-500 hover:shadow-md cursor-pointer'
                        }`}
                      onClick={() => {
                        // إذا كان في وضع التعديل، لا نختار النص للإرسال
                        if (editingTextId !== text.id) {
                          selectTextFromGallery({ content: text.content, imageUrls: text.imageUrls });
                        }
                      }}
                    >
                      {editingTextId === text.id ? (
                        // وضع التعديل
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="عنوان النص (اختياري)"
                            defaultValue={text.title || ''}
                            id={`edit-title-${text.id}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <textarea
                            placeholder="محتوى النص..."
                            defaultValue={text.content}
                            id={`edit-content-${text.id}`}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            onClick={(e) => e.stopPropagation()}
                          />

                          {/* الصور الموجودة */}
                          {editingTextExistingImages.length > 0 && (
                            <div className="space-y-2">
                              <label className="block text-sm font-medium text-gray-700">
                                الصور الحالية
                              </label>
                              <div className="grid grid-cols-4 gap-2">
                                {editingTextExistingImages.map((imageUrl, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`Existing ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeEditTextGalleryExistingImage(index);
                                      }}
                                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="حذف الصورة"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* رفع صور جديدة */}
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              إضافة صور جديدة (اختياري)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleEditTextGalleryImageSelect}
                              className="hidden"
                              id={`edit-text-gallery-image-input-${text.id}`}
                            />
                            <label
                              htmlFor={`edit-text-gallery-image-input-${text.id}`}
                              className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-sm text-gray-600">اختر صور لإضافتها</span>
                            </label>

                            {/* معاينة الصور الجديدة */}
                            {editingTextImagePreviews.length > 0 && (
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {editingTextImagePreviews.map((preview, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={preview}
                                      alt={`New ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                    />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeEditTextGalleryNewImage(index);
                                      }}
                                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="حذف الصورة"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTextId(null);
                                setEditingTextImages([]);
                                setEditingTextImagePreviews([]);
                                setEditingTextExistingImages([]);
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const titleInput = document.getElementById(`edit-title-${text.id}`) as HTMLInputElement;
                                const contentInput = document.getElementById(`edit-content-${text.id}`) as HTMLTextAreaElement;
                                if (titleInput && contentInput) {
                                  updateTextInGallery(text.id, titleInput.value, contentInput.value);
                                }
                              }}
                              disabled={updatingText}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {updatingText ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  <span>جاري التحديث...</span>
                                </div>
                              ) : (
                                'حفظ التعديلات'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        // وضع العرض العادي
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              {text.isPinned && (
                                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                </svg>
                              )}
                              <h5 className="font-semibold text-gray-900">{text.title || 'بدون عنوان'}</h5>
                            </div>
                            {text.content && (
                              <p className="text-sm text-gray-600 whitespace-pre-wrap break-words line-clamp-3 mb-2">
                                {text.content}
                              </p>
                            )}
                            {/* عرض الصور المرفقة */}
                            {text.imageUrls && text.imageUrls.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {text.imageUrls.map((imageUrl, index) => (
                                  <div key={index} className="relative group">
                                    <img
                                      src={imageUrl}
                                      alt={`Image ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg border border-gray-200"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(text.createdAt).toLocaleDateString('ar-EG', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1 ml-3">
                            {/* زر التثبيت */}
                            <button
                              onClick={(e) => togglePinText(text.id, text.isPinned || false, e)}
                              disabled={pinningTextId === text.id}
                              className={`p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${text.isPinned
                                ? 'text-yellow-600 hover:bg-yellow-50'
                                : 'text-gray-400 hover:bg-gray-50 hover:text-yellow-600'
                                }`}
                              title={text.isPinned ? 'إلغاء تثبيت النص' : 'تثبيت النص'}
                            >
                              {pinningTextId === text.id ? (
                                <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                                </svg>
                              )}
                            </button>
                            {/* زر التعديل */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTextId(text.id);
                                // تهيئة الصور الحالية للتعديل
                                setEditingTextExistingImages(text.imageUrls || []);
                                setEditingTextImages([]);
                                setEditingTextImagePreviews([]);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="تعديل النص"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            {/* زر الحذف */}
                            <button
                              onClick={(e) => deleteTextFromGallery(text.id, e)}
                              disabled={deletingTextId === text.id}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                              title="حذف النص"
                            >
                              {deletingTextId === text.id ? (
                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <TrashIcon className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  💡 اضغط على أي نص لإرساله مباشرة للعميل (مع الصور المرفقة إن وجدت)
                </p>
                <button
                  onClick={() => {
                    setShowTextGallery(false);
                    setNewTextImages([]);
                    setNewTextImagePreviews([]);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مكون ملف العميل */}
      {showCustomerProfile && selectedConversation && (
        <CustomerProfile
          customerId={selectedConversation.customerId}
          isOpen={showCustomerProfile}
          onClose={() => setShowCustomerProfile(false)}
          pageId={selectedConversation.pageId}
        />
      )}

      {/* 🚫 Modal حظر العميل */}
      {showBlockModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">حظر العميل على صفحة الفيس بوك</h3>
            <p className="text-sm text-gray-600 mb-4">
              سيتم حظر هذا العميل على صفحة الفيس بوك المحددة ولن يتم استقبال رسائله.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                سبب الحظر (اختياري)
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
                placeholder="أدخل سبب الحظر..."
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowBlockModal(false);
                  setBlockReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleBlockCustomer}
                disabled={blocking}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {blocking ? 'جاري الحظر...' : 'تأكيد الحظر'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* تنبيه إذا كان العميل محظوراً */}
      {isBlocked && selectedConversation && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-50 border border-red-200 rounded-lg p-4 shadow-lg max-w-md">
          <div className="flex items-center space-x-2">
            <NoSymbolIcon className="w-6 h-6 text-red-600" />
            <p className="text-sm text-red-700">
              ⚠️ هذا العميل محظور على صفحة الفيس بوك - لن يتم استقبال رسائله
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// المكون الرئيسي مع الحماية

const ConversationsImprovedFixed: React.FC = () => {
  return (
    <CompanyProtectedRoute>
      <ConversationsImprovedFixedContent />
    </CompanyProtectedRoute>
  );
};

export default ConversationsImprovedFixed;
