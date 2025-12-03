/**
 * 📱 WhatsApp Chat Page
 * صفحة دردشة WhatsApp
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, IconButton, Avatar, Badge, List, ListItem,
  ListItemAvatar, ListItemText, Divider, CircularProgress, Chip, Menu, MenuItem,
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Select, FormControl, InputLabel, Alert, Drawer, Tabs, Tab, Grid, ListItemSecondaryAction
} from '@mui/material';
import {
  Send as SendIcon, AttachFile as AttachIcon, EmojiEmotions as EmojiEmotionsIcon,
  Search as SearchIcon, MoreVert as MoreIcon, Phone as PhoneIcon,
  Videocam as VideoIcon, Info as InfoIcon, Check as CheckIcon,
  DoneAll as DoneAllIcon, AccessTime as PendingIcon, Error as ErrorIcon,
  Image as ImageIcon, Description as DocumentIcon, Mic as MicIcon,
  LocationOn as LocationIcon, SmartToy as AIIcon, Person as PersonIcon,
  Archive as ArchiveIcon, Delete as DeleteIcon, PushPin as PinIcon,
  VolumeOff as MuteIcon, Reply as ReplyIcon, ContentCopy as CopyIcon,
  Forward as ForwardIcon, Refresh as RefreshIcon, Close as CloseIcon,
  GetApp as DownloadIcon, Block as BlockIcon, Report as ReportIcon,
  GroupAdd as GroupAddIcon, PersonSearch as PersonSearchIcon,
  Star as StarIcon, StarBorder as StarBorderIcon,
  AddReaction as AddReactionIcon, Label as LabelIcon,
  Poll as PollIcon, LocalOffer as TagIcon,
  ViewList as ListIcon, SmartButton as ButtonIcon,
  Campaign as BroadcastIcon, Storefront as CatalogIcon,
  ShoppingCart as CartIcon, Inventory as ProductIcon,
  Security as SecurityIcon, Business as StoreIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { format, isToday, isYesterday } from 'date-fns';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { apiClient as api } from '../../services/apiClient';
import useSocket from '../../hooks/useSocket';
import CreateGroupDialog from '../../components/whatsapp/CreateGroupDialog';
import GroupInfoDrawer from '../../components/whatsapp/GroupInfoDrawer';
import ProfileDialog from '../../components/whatsapp/ProfileDialog';
import CheckNumberDialog from '../../components/whatsapp/CheckNumberDialog';
import LabelsDialog from '../../components/whatsapp/LabelsDialog';
import BroadcastDialog from '../../components/whatsapp/BroadcastDialog';
import PrivacySettingsDialog from '../../components/whatsapp/PrivacySettingsDialog';
import BusinessProfileDialog from '../../components/whatsapp/BusinessProfileDialog';
import AudioRecorder from './components/AudioRecorder';
import { useAuth } from '../../hooks/useAuthSimple';
import { config } from '../../config';

interface Contact {
  id: string;
  sessionId: string;
  jid: string;
  phoneNumber: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  category: string | null;
  labels?: string[]; // Add labels support
  unreadCount: number;
  lastMessageAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  isBlocked?: boolean;
  session: {
    name: string;
    phoneNumber: string | null;
  };
  customer: {
    firstName: string;
    lastName: string;
    status: string;
  } | null;
  lastMessage?: {
    content: string | null;
    messageType: string;
    fromMe: boolean;
    timestamp: string;
  };
}

interface Message {
  id: string;
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
  messageType: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaFileName: string | null;
  quotedMessageId: string | null;
  quotedContent: string | null;
  status: string;
  timestamp: string;
  isAIResponse: boolean;
  aiConfidence: number | null;
  senderId?: string;
  senderName?: string; // For display
  participant?: string; // Group participant
}

interface Session {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  liveStatus: string;
}

interface QuickReply {
  id: string;
  title: string;
  shortcut: string | null;
  content: string;
  category: string;
}

const WhatsAppChat: React.FC = () => {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { socket } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [contactMenuAnchor, setContactMenuAnchor] = useState<null | HTMLElement>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMessageForMenu, setSelectedMessageForMenu] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [chatMenuAnchor, setChatMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedChatForMenu, setSelectedChatForMenu] = useState<Contact | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [selectedContactsForForward, setSelectedContactsForForward] = useState<string[]>([]);
  const [messageInfoDialogOpen, setMessageInfoDialogOpen] = useState(false);
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState<Message | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [checkNumberDialogOpen, setCheckNumberDialogOpen] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [businessProfileDialogOpen, setBusinessProfileDialogOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);

  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [selectedContactForLabel, setSelectedContactForLabel] = useState<Contact | null>(null);
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollData, setPollData] = useState({ question: '', options: ['', ''], selectableCount: 1 });

  // Interactive Messages
  const [buttonsDialogOpen, setButtonsDialogOpen] = useState(false);
  const [buttonsData, setButtonsData] = useState({ text: '', footer: '', buttons: [{ id: '1', text: '' }] });
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listData, setListData] = useState({
    text: '',
    buttonText: 'اختر',
    title: '',
    sections: [{ title: 'القسم 1', rows: [{ id: '1', title: '', description: '' }] }]
  });

  // Broadcast
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastData, setBroadcastData] = useState({ message: '', selectedContacts: [] as string[] });

  // Catalog
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Starred Messages
  const [starredMessagesOpen, setStarredMessagesOpen] = useState(false);
  const [starredMessages, setStarredMessages] = useState<Message[]>([]);

  // Location
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationData, setLocationData] = useState({ latitude: '', longitude: '', address: '' });

  // Order/Cart
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orderData, setOrderData] = useState({
    items: [] as { productId: string; quantity: number; price: number }[],
    currency: 'EGP',
    note: ''
  });
  const loadContactsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<{
    notificationSound: boolean;
    browserNotifications: boolean;
  }>({
    notificationSound: true,
    browserNotifications: true
  });
  const [chatFilter, setChatFilter] = useState('all'); // 'all', 'unread', 'groups'
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ name: string; status: string; profilePicUrl: string } | null>(null);

  const fetchUserProfile = async () => {
    if (!selectedSession || selectedSession === 'all') return;
    try {
      const response = await api.get('/whatsapp/profile', { params: { sessionId: selectedSession } });
      if (response.data.success) {
        setCurrentUserProfile(response.data.profile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    if (selectedSession && selectedSession !== 'all') {
      fetchUserProfile();
    }
  }, [selectedSession]);

  // Helper for Date Separators
  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | undefined) => {
    if (!previousMessage) return true;
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    return currentDate !== previousDate;
  };

  const getDateSeparatorText = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return 'اليوم';
    if (isYesterday(date)) return 'أمس';
    return format(date, 'dd/MM/yyyy');
  };

  // Load Sessions
  const loadSessions = async () => {
    try {
      const response = await api.get('/whatsapp/sessions');
      // Add "All Sessions" option if there are sessions
      const fetchedSessions = response.data.sessions || [];
      if (fetchedSessions.length > 0) {
        // Check if "All Sessions" already exists to avoid duplication
        const allSessionsExists = fetchedSessions.some((s: Session) => s.id === 'all');
        if (!allSessionsExists) {
          fetchedSessions.unshift({
            id: 'all',
            name: 'كل الجلسات',
            phoneNumber: null,
            status: 'connected',
            liveStatus: 'connected'
          });
        }
      }
      setSessions(fetchedSessions);

      if (fetchedSessions.length > 0 && !selectedSession) {
        setSelectedSession(fetchedSessions[0].id);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      enqueueSnackbar('فشل في جلب الجلسات', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedContact || !selectedSession) return;
    setLoadingMessages(true);
    try {
      // Use the contact's session ID if available, otherwise fallback to selectedSession (unless it's 'all')
      const targetSessionId = selectedContact.sessionId || (selectedSession === 'all' ? null : selectedSession);

      if (!targetSessionId) {
        console.error('No valid session ID for loading messages');
        return;
      }

      const res = await api.get(`/whatsapp/conversations/${encodeURIComponent(selectedContact.jid)}/messages`, {
        params: { sessionId: targetSessionId }
      });
      setMessages(res.data.messages || []);
    } catch (error) {
      enqueueSnackbar('حدث خطأ أثناء تحميل الرسائل', { variant: 'error' });
    } finally {
      setLoadingMessages(false);
    }
  };

  const markAsRead = async () => {
    if (!selectedContact || !selectedSession) return;
    const targetSessionId = selectedContact.sessionId || (selectedSession === 'all' ? null : selectedSession);
    if (!targetSessionId) return;

    try {
      await api.post('/whatsapp/messages/read', { sessionId: targetSessionId, remoteJid: selectedContact.jid });
    } catch (error) { console.error(error); }
  };

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadQuickReplies();
    loadNotificationSettings();
    requestNotificationPermission();
  }, []);

  const loadContacts = useCallback(async () => {
    if (!selectedSession) return;
    try {
      const res = await api.get('/whatsapp/conversations', { params: { sessionId: selectedSession } });
      setContacts(res.data.conversations || []);
    } catch (error) {
      console.error(error);
    }
  }, [selectedSession]);

  // Debounced version to avoid excessive API calls
  const debouncedLoadContacts = useCallback(() => {
    if (loadContactsTimeoutRef.current) {
      clearTimeout(loadContactsTimeoutRef.current);
    }
    loadContactsTimeoutRef.current = setTimeout(() => {
      loadContacts();
    }, 500);
  }, [loadContacts]);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // Helper to normalize JID for comparison
    const normalizeJid = (jid: string) => {
      if (!jid) return '';
      const parts = jid.split('@')[0];
      const bareJid = parts?.split(':')[0] || '';
      return bareJid.replace(/\D/g, '');
    };

    const handleNewMessage = (data: any) => {
      const { sessionId, message } = data;

      // Normalize JIDs for comparison
      const msgJid = normalizeJid(message.remoteJid);
      const currentJid = selectedContact ? normalizeJid(selectedContact.jid) : '';

      // Only process incoming messages (not sent by us)
      if (message.fromMe) {
        return;
      }

      const isCurrentChat = selectedContact && msgJid === currentJid && (selectedSession === 'all' || sessionId === selectedSession);

      if (isCurrentChat) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.messageId === message.messageId)) return prev;
          return [...prev, message];
        });
        markAsRead();
        // Play sound if enabled and chat is open (quieter notification)
        if (notificationSettings.notificationSound) {
          playNotificationSound();
        }
      } else {
        // Show notification if chat is not open or different contact
        if (selectedSession === 'all' || sessionId === selectedSession) {
          const contactName = contacts.find(c => normalizeJid(c.jid) === msgJid)?.name ||
            contacts.find(c => normalizeJid(c.jid) === msgJid)?.pushName ||
            message.remoteJid.split('@')[0];
          const messageText = message.content
            ? (message.content.length > 50 ? message.content.substring(0, 50) + '...' : message.content)
            : (message.messageType === 'IMAGE' ? '📷 صورة' :
              message.messageType === 'VIDEO' ? '🎥 فيديو' :
                message.messageType === 'AUDIO' ? '🎵 صوت' :
                  message.messageType === 'DOCUMENT' ? '📎 ملف' : 'رسالة جديدة');

          // Show in-app notification (snackbar) - always show this
          enqueueSnackbar(
            messageText,
            {
              variant: 'info',
              anchorOrigin: {
                vertical: 'top',
                horizontal: 'left',
              },
              autoHideDuration: 5000,
              action: (key) => (
                <Button
                  size="small"
                  onClick={() => {
                    // Find and select the contact
                    const contact = contacts.find(c => normalizeJid(c.jid) === msgJid);
                    if (contact) {
                      setSelectedContact(contact);
                    }
                  }}
                >
                  فتح المحادثة
                </Button>
              ),
            }
          );

          // Play sound if enabled
          if (notificationSettings.notificationSound) {
            playNotificationSound();
          }

          // Show browser notification if enabled
          if (notificationSettings.browserNotifications) {
            showBrowserNotification(
              `رسالة جديدة من ${contactName}`,
              messageText
            );
          }
        }
      }
      // Update contact list with debouncing
      debouncedLoadContacts();
    };

    const handleNotification = (data: any) => {
      const { contactName, message, messageType, soundEnabled, notificationsEnabled, sessionId } = data;

      console.log('🔔 [NOTIFICATION] Received notification:', { contactName, messageType, soundEnabled, notificationsEnabled });

      // Prepare message text
      const messageText = message ||
        (messageType === 'IMAGE' ? '📷 صورة' :
          messageType === 'VIDEO' ? '🎥 فيديو' :
            messageType === 'AUDIO' ? '🎵 صوت' :
              messageType === 'DOCUMENT' ? '📎 ملف' : 'رسالة جديدة');

      // Show in-app notification (snackbar) - always show this
      enqueueSnackbar(
        messageText,
        {
          variant: 'info',
          anchorOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          autoHideDuration: 5000,
          action: (key) => (
            <Button
              size="small"
              onClick={() => {
                // Navigate to the chat if not already there
                if (sessionId && sessionId !== selectedSession) {
                  setSelectedSession(sessionId);
                }
                // Find and select the contact
                const contact = contacts.find(c =>
                  c.name === contactName || c.pushName === contactName
                );
                if (contact) {
                  setSelectedContact(contact);
                }
              }}
            >
              فتح المحادثة
            </Button>
          ),
        }
      );

      // Show browser notification if enabled (use data from server or local settings)
      const shouldShowNotification = notificationsEnabled !== undefined ? notificationsEnabled : notificationSettings.browserNotifications;
      if (shouldShowNotification) {
        showBrowserNotification(
          `رسالة جديدة من ${contactName}`,
          messageText
        );
      }

      // Play sound if enabled (use data from server or local settings)
      const shouldPlaySound = soundEnabled !== undefined ? soundEnabled : notificationSettings.notificationSound;
      if (shouldPlaySound) {
        playNotificationSound();
      }
    };

    const handleMessageStatus = (data: any) => {
      const { messageId, status } = data;
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, status } : m));
    };

    const handleMessageSent = (data: any) => {
      const { sessionId, message } = data;

      const msgJid = normalizeJid(message.remoteJid);
      const currentJid = selectedContact ? normalizeJid(selectedContact.jid) : '';

      if (selectedContact && msgJid === currentJid && (selectedSession === 'all' || sessionId === selectedSession)) {
        // Only add if not already present (to avoid duplicates)
        setMessages(prev => {
          if (prev.some(m => m.messageId === message.messageId)) return prev;
          return [...prev, message];
        });
      }
      // Update contact list with debouncing
      debouncedLoadContacts();
    };

    socket.on('whatsapp:message:new', handleNewMessage);
    socket.on('whatsapp:message:status', handleMessageStatus);
    socket.on('whatsapp:message:sent', handleMessageSent);
    socket.on('whatsapp:notification:new', (data) => {
      console.log('🔔 [FRONTEND] Received whatsapp:notification:new event:', data);
      handleNotification(data);
    });
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      socket.off('whatsapp:message:new', handleNewMessage);
      socket.off('whatsapp:message:status', handleMessageStatus);
      socket.off('whatsapp:message:sent', handleMessageSent);
      socket.off('whatsapp:notification:new', handleNotification);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
    };

    function handleUserTyping(data: any) {
      if (selectedContact && data.jid === selectedContact.jid) {
        setTypingUsers(prev => new Set(prev).add(data.jid));
      }
    }

    function handleUserStoppedTyping(data: any) {
      if (data.jid) {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.jid);
          return newSet;
        });
      }
    }
  }, [socket, selectedContact, selectedSession, notificationSettings, contacts, debouncedLoadContacts]);

  // Load contacts when session changes
  useEffect(() => {
    if (selectedSession) {
      loadContacts();
    }
  }, [selectedSession, loadContacts]);

  // Load messages when contact changes
  useEffect(() => {
    if (selectedContact && selectedSession) {
      loadMessages();
      markAsRead();
    }
  }, [selectedContact]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUsers]);

  const getMediaUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://mokhtarelhenawy.online${path}`;
  };
  const renderMessageContent = (message: Message) => {
    const senderName = message.fromMe && message.senderName ? message.senderName : null;

    const content = (
      <Box>
        {senderName && (
          <Typography variant="caption" color="primary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold' }}>
            {senderName}
          </Typography>
        )}
        {(() => {
          if (message.mediaUrl) {
            const fullMediaUrl = getMediaUrl(message.mediaUrl);
            switch (message.messageType) {
              case 'IMAGE':
                return (
                  <Box>
                    <img
                      src={fullMediaUrl}
                      alt="Image"
                      style={{ maxWidth: '100%', borderRadius: 8, cursor: 'pointer', maxHeight: 300, objectFit: 'cover' }}
                      onClick={() => window.open(fullMediaUrl, '_blank')}
                    />
                    {message.content && <Typography variant="body2" sx={{ mt: 1 }}>{message.content}</Typography>}
                  </Box>
                );
              case 'VIDEO':
                return (
                  <Box>
                    <video src={fullMediaUrl} controls style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 300 }} />
                    {message.content && <Typography variant="body2" sx={{ mt: 1 }}>{message.content}</Typography>}
                  </Box>
                );
              case 'AUDIO':
                return <audio src={fullMediaUrl} controls style={{ width: '100%', minWidth: 200 }} />;
              case 'DOCUMENT':
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, minWidth: 200 }}>
                    <DocumentIcon color="error" fontSize="large" />
                    <Box sx={{ flex: 1, overflow: 'hidden' }}>
                      <Typography variant="body2" noWrap>{message.mediaFileName || 'ملف'}</Typography>
                      <Typography variant="caption" color="text.secondary">مستند</Typography>
                    </Box>
                    <IconButton href={message.mediaUrl} target="_blank" size="small">
                      <DownloadIcon />
                    </IconButton>
                  </Box>
                );
              default:
                return (
                  <Box>
                    <Typography variant="body2" color="error">نوع وسائط غير مدعوم: {message.messageType}</Typography>
                    <Button href={fullMediaUrl} target="_blank" size="small" startIcon={<DownloadIcon />}>تحميل</Button>
                  </Box>
                );
            }
          }

          if (message.messageType === 'LOCATION') {
            try {
              const loc = message.content ? JSON.parse(message.content) : {};
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
              return (
                <Box>
                  <a href={mapUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
                      <LocationIcon color="primary" fontSize="large" />
                      <Box>
                        <Typography variant="body2" fontWeight="bold">موقع</Typography>
                        <Typography variant="caption" display="block">{loc.address || loc.name || `${loc.latitude}, ${loc.longitude}`}</Typography>
                      </Box>
                    </Box>
                  </a>
                </Box>
              );
            } catch (e) {
              return <Typography>{message.content}</Typography>;
            }
          }

          return <Typography sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>;
        })()}
      </Box>
    );

    return content;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !selectedSession || sending) return;

    const targetSessionId = selectedContact.sessionId || (selectedSession === 'all' ? null : selectedSession);
    if (!targetSessionId) {
      enqueueSnackbar('خطأ: لا يمكن تحديد الجلسة', { variant: 'error' });
      return;
    }

    setSending(true);
    try {
      await api.post('/whatsapp/messages/send', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        text: newMessage,
        quotedMessageId: replyingTo?.messageId,
        userId: user?.id
      });
      setNewMessage('');
      setReplyingTo(null);
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ أثناء الإرسال', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !selectedContact || !selectedSession) return;

    const targetSessionId = selectedContact.sessionId || (selectedSession === 'all' ? null : selectedSession);
    if (!targetSessionId) {
      enqueueSnackbar('خطأ: لا يمكن تحديد الجلسة', { variant: 'error' });
      return;
    }

    const file = files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', targetSessionId);
    formData.append('to', selectedContact.jid);
    if (user?.id) formData.append('userId', user.id);

    try {
      await api.post('/whatsapp/messages/upload-send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ أثناء رفع الملف', { variant: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };


  const handleClearChat = async (contact: Contact) => {
    if (!selectedSession) return;
    if (!window.confirm('هل أنت متأكد من مسح محتوى المحادثة؟')) return;
    try {
      await api.post(`/whatsapp/conversations/${contact.jid}/clear`, { sessionId: selectedSession });
      enqueueSnackbar('تم مسح المحادثة', { variant: 'success' });
      if (selectedContact?.jid === contact.jid) {
        setMessages([]);
      }
    } catch (error) {
      enqueueSnackbar('فشل مسح المحادثة', { variant: 'error' });
    }
  };

  const handleDeleteChat = async (contact: Contact) => {
    if (!selectedSession) return;
    if (!window.confirm('هل أنت متأكد من حذف المحادثة؟')) return;
    try {
      await api.delete(`/whatsapp/conversations/${contact.jid}`, { data: { sessionId: selectedSession } });
      enqueueSnackbar('تم حذف المحادثة', { variant: 'success' });
      if (selectedContact?.jid === contact.jid) {
        setSelectedContact(null);
        setMessages([]);
      }
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل حذف المحادثة', { variant: 'error' });
    }
  };

  const handleArchiveChat = async (contact: Contact) => {
    if (!selectedSession) return;
    try {
      await api.post(`/whatsapp/conversations/${contact.jid}/archive`, {
        sessionId: selectedSession,
        archive: !contact.isArchived
      });
      enqueueSnackbar(contact.isArchived ? 'تم إلغاء الأرشفة' : 'تمت الأرشفة', { variant: 'success' });
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل تحديث حالة الأرشفة', { variant: 'error' });
    }
  };

  const handlePinChat = async (contact: Contact) => {
    if (!selectedSession) return;
    try {
      await api.post(`/whatsapp/conversations/${contact.jid}/pin`, {
        sessionId: selectedSession,
        pin: !contact.isPinned
      });
      enqueueSnackbar(contact.isPinned ? 'تم إلغاء التثبيت' : 'تم التثبيت', { variant: 'success' });
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل تحديث حالة التثبيت', { variant: 'error' });
    }
  };

  const handleMuteChat = async (contact: Contact) => {
    if (!selectedSession) return;
    try {
      await api.post(`/whatsapp/conversations/${contact.jid}/mute`, {
        sessionId: selectedSession,
        mute: !contact.isMuted
      });
      enqueueSnackbar(contact.isMuted ? 'تم إلغاء الكتم' : 'تم الكتم', { variant: 'success' });
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل تحديث حالة الكتم', { variant: 'error' });
    }
  };

  const handleMarkUnread = async (contact: Contact) => {
    if (!selectedSession) return;
    try {
      await api.post(`/whatsapp/conversations/${contact.jid}/mark-unread`, { sessionId: selectedSession });
      enqueueSnackbar('تم تمييز المحادثة كغير مقروءة', { variant: 'success' });
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل تحديث حالة القراءة', { variant: 'error' });
    }
  };

  const handleForwardMessage = async () => {
    if (!selectedSession || !selectedMessageForMenu || selectedContactsForForward.length === 0) return;

    try {
      await Promise.all(selectedContactsForForward.map(jid =>
        api.post('/whatsapp/messages/forward', {
          sessionId: selectedSession,
          to: jid,
          messageId: selectedMessageForMenu.messageId
        })
      ));
      enqueueSnackbar('تم إعادة توجيه الرسالة', { variant: 'success' });
      setForwardDialogOpen(false);
      setSelectedContactsForForward([]);
      setSelectedMessageForMenu(null);
    } catch (error) {
      enqueueSnackbar('فشل إعادة توجيه الرسالة', { variant: 'error' });
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedSession || !selectedMessageForMenu) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return;

    try {
      await api.delete(`/whatsapp/messages/${selectedMessageForMenu.messageId}`, {
        data: {
          sessionId: selectedSession,
          remoteJid: selectedMessageForMenu.remoteJid,
          fromMe: selectedMessageForMenu.fromMe
        }
      });
      enqueueSnackbar('تم حذف الرسالة', { variant: 'success' });
      setMessages(prev => prev.filter(m => m.messageId !== selectedMessageForMenu?.messageId));
      setMessageMenuAnchor(null);
      setSelectedMessageForMenu(null);
    } catch (error) {
      enqueueSnackbar('فشل حذف الرسالة', { variant: 'error' });
    }
  };

  const handleReply = () => {
    if (selectedMessageForMenu) {
      setReplyingTo(selectedMessageForMenu);
      setMessageMenuAnchor(null);
      setSelectedMessageForMenu(null);
    }
  };

  const handleCopy = () => {
    if (selectedMessageForMenu?.content) {
      navigator.clipboard.writeText(selectedMessageForMenu.content);
      enqueueSnackbar('تم نسخ النص', { variant: 'success' });
      setMessageMenuAnchor(null);
      setSelectedMessageForMenu(null);
    }
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <PendingIcon fontSize="small" color="action" />;
      case 'SENT': return <CheckIcon fontSize="small" color="action" />;
      case 'DELIVERED': return <DoneAllIcon fontSize="small" color="action" />;
      case 'READ': return <DoneAllIcon fontSize="small" color="primary" />;
      case 'ERROR': return <ErrorIcon fontSize="small" color="error" />;
      default: return <PendingIcon fontSize="small" color="action" />;
    }
  };


  const handleMessageContextMenu = (event: React.MouseEvent, message: Message) => {
    event.preventDefault();
    setMessageMenuAnchor(event.currentTarget as HTMLElement);
    setSelectedMessageForMenu(message);
  };

  const loadQuickReplies = async () => {
    try {
      const res = await api.get('/whatsapp/quick-replies');
      setQuickReplies(res.data.quickReplies || []);
    } catch (e) { }
  };

  const loadNotificationSettings = async () => {
    try {
      const res = await api.get('/whatsapp/settings');
      if (res.data.settings) {
        setNotificationSettings({
          notificationSound: res.data.settings.notificationSound !== false,
          browserNotifications: res.data.settings.browserNotifications !== false
        });
      }
    } catch (e) {
      console.error('Error loading notification settings:', e);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.error('Error requesting notification permission:', e);
      }
    }
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio play failed', e));
    } catch (e) {
      console.error('Error playing notification sound:', e);
    }
  };

  const showBrowserNotification = (title: string, body: string, icon?: string) => {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon.ico',
          tag: 'whatsapp-message',
          requireInteraction: false,
          silent: false
        });

        // Close notification after 5 seconds
        setTimeout(() => {
          notification.close();
        }, 5000);
      } catch (e) {
        console.error('Error showing browser notification:', e);
      }
    } else if (Notification.permission !== 'denied') {
      // Request permission if not already denied
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          try {
            const notification = new Notification(title, {
              body,
              icon: icon || '/favicon.ico',
              tag: 'whatsapp-message'
            });
            setTimeout(() => {
              notification.close();
            }, 5000);
          } catch (e) {
            console.error('Error showing browser notification:', e);
          }
        }
      });
    }
  };

  // ==================== Reactions ====================
  const handleSendReaction = async (messageId: string, emoji: string) => {
    if (!selectedSession || !selectedContact) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/send-reaction', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        messageId,
        emoji
      });
      setShowReactionPicker(null);
      enqueueSnackbar('تم إرسال التفاعل', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('فشل إرسال التفاعل', { variant: 'error' });
    }
  };

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // ==================== Star Messages ====================
  const handleStarMessage = async (message: Message) => {
    if (!selectedSession || !selectedContact) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/star', {
        sessionId: targetSessionId,
        key: {
          remoteJid: message.remoteJid,
          id: message.messageId,
          fromMe: message.fromMe
        }
      });
      enqueueSnackbar('تم تمييز الرسالة بنجمة', { variant: 'success' });
      setMessageMenuAnchor(null);
    } catch (error) {
      enqueueSnackbar('فشل تمييز الرسالة', { variant: 'error' });
    }
  };

  const handleUnstarMessage = async (message: Message) => {
    if (!selectedSession || !selectedContact) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/unstar', {
        sessionId: targetSessionId,
        key: {
          remoteJid: message.remoteJid,
          id: message.messageId,
          fromMe: message.fromMe
        }
      });
      enqueueSnackbar('تم إلغاء تمييز الرسالة', { variant: 'success' });
      setMessageMenuAnchor(null);
    } catch (error) {
      enqueueSnackbar('فشل إلغاء تمييز الرسالة', { variant: 'error' });
    }
  };

  // ==================== Labels ====================
  const loadLabels = async () => {
    if (!selectedSession || selectedSession === 'all') return;
    try {
      const res = await api.get('/whatsapp/labels', { params: { sessionId: selectedSession } });
      setLabels(res.data.labels || []);
    } catch (error) {
      console.error('Error loading labels:', error);
    }
  };

  const handleLabelChat = async (labelId: string) => {
    if (!selectedSession || !selectedContactForLabel) return;
    try {
      await api.post('/whatsapp/labels/chat', {
        sessionId: selectedSession,
        jid: selectedContactForLabel.jid,
        labelId
      });
      enqueueSnackbar('تم إضافة العلامة للمحادثة', { variant: 'success' });
      setLabelDialogOpen(false);
      setSelectedContactForLabel(null);
    } catch (error) {
      enqueueSnackbar('فشل إضافة العلامة', { variant: 'error' });
    }
  };

  // ==================== Polls ====================
  const handleSendPoll = async () => {
    if (!selectedSession || !selectedContact || !pollData.question.trim()) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    const validOptions = pollData.options.filter(o => o.trim());
    if (validOptions.length < 2) {
      enqueueSnackbar('يجب إضافة خيارين على الأقل', { variant: 'warning' });
      return;
    }
    try {
      await api.post('/whatsapp/messages/send-poll', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        pollData: {
          name: pollData.question,
          values: validOptions,
          selectableCount: pollData.selectableCount
        }
      });
      enqueueSnackbar('تم إرسال الاستطلاع', { variant: 'success' });
      setPollDialogOpen(false);
      setPollData({ question: '', options: ['', ''], selectableCount: 1 });
    } catch (error) {
      enqueueSnackbar('فشل إرسال الاستطلاع', { variant: 'error' });
    }
  };

  // ==================== Interactive Buttons ====================
  const handleSendButtons = async () => {
    if (!selectedSession || !selectedContact || !buttonsData.text.trim()) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    const validButtons = buttonsData.buttons.filter(b => b.text.trim());
    if (validButtons.length === 0 || validButtons.length > 3) {
      enqueueSnackbar('يجب إضافة 1-3 أزرار', { variant: 'warning' });
      return;
    }
    try {
      await api.post('/whatsapp/messages/send-buttons', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        text: buttonsData.text,
        buttons: validButtons.map((b, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: b.text }, type: 1 })),
        footer: buttonsData.footer || undefined
      });
      enqueueSnackbar('تم إرسال الرسالة بالأزرار', { variant: 'success' });
      setButtonsDialogOpen(false);
      setButtonsData({ text: '', footer: '', buttons: [{ id: '1', text: '' }] });
    } catch (error) {
      enqueueSnackbar('فشل إرسال الرسالة', { variant: 'error' });
    }
  };

  // ==================== Interactive List ====================
  const handleSendList = async () => {
    if (!selectedSession || !selectedContact || !listData.text.trim()) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/send-list', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        text: listData.text,
        buttonText: listData.buttonText,
        title: listData.title,
        sections: listData.sections.map(s => ({
          title: s.title,
          rows: s.rows.filter(r => r.title.trim()).map(r => ({
            rowId: r.id,
            title: r.title,
            description: r.description
          }))
        }))
      });
      enqueueSnackbar('تم إرسال القائمة', { variant: 'success' });
      setListDialogOpen(false);
      setListData({ text: '', buttonText: 'اختر', title: '', sections: [{ title: 'القسم 1', rows: [{ id: '1', title: '', description: '' }] }] });
    } catch (error) {
      enqueueSnackbar('فشل إرسال القائمة', { variant: 'error' });
    }
  };

  // ==================== Broadcast ====================
  const handleSendBroadcast = async () => {
    if (!selectedSession || !broadcastData.message.trim() || broadcastData.selectedContacts.length === 0) return;
    try {
      await api.post('/whatsapp/broadcast/send', {
        sessionId: selectedSession,
        jids: broadcastData.selectedContacts,
        message: { text: broadcastData.message }
      });
      enqueueSnackbar(`تم إرسال البث إلى ${broadcastData.selectedContacts.length} جهة اتصال`, { variant: 'success' });
      setBroadcastDialogOpen(false);
      setBroadcastData({ message: '', selectedContacts: [] });
    } catch (error) {
      enqueueSnackbar('فشل إرسال البث', { variant: 'error' });
    }
  };

  // ==================== Catalog ====================
  const loadProducts = async () => {
    if (!selectedSession || selectedSession === 'all') return;
    try {
      const res = await api.get('/whatsapp/catalog/products', { params: { sessionId: selectedSession } });
      setProducts(res.data.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const handleSendProduct = async (product: any) => {
    if (!selectedSession || !selectedContact) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/send-product', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        product: {
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency || 'EGP',
          imageUrl: product.imageUrl
        }
      });
      enqueueSnackbar('تم إرسال المنتج', { variant: 'success' });
      setCatalogDialogOpen(false);
    } catch (error) {
      enqueueSnackbar('فشل إرسال المنتج', { variant: 'error' });
    }
  };

  // ==================== Starred Messages ====================
  const loadStarredMessages = async () => {
    if (!selectedSession || !selectedContact) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      const res = await api.get('/whatsapp/messages/starred', {
        params: { sessionId: targetSessionId, jid: selectedContact.jid }
      });
      setStarredMessages(res.data.messages || []);
      setStarredMessagesOpen(true);
    } catch (error) {
      enqueueSnackbar('فشل تحميل الرسائل المميزة', { variant: 'error' });
    }
  };

  // ==================== Location Sharing ====================
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationData({
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
            address: ''
          });
          enqueueSnackbar('تم تحديد موقعك الحالي', { variant: 'success' });
        },
        (error) => {
          enqueueSnackbar('فشل تحديد الموقع: ' + error.message, { variant: 'error' });
        }
      );
    } else {
      enqueueSnackbar('المتصفح لا يدعم تحديد الموقع', { variant: 'error' });
    }
  };

  const handleSendLocation = async () => {
    if (!selectedSession || !selectedContact || !locationData.latitude || !locationData.longitude) return;
    const targetSessionId = selectedContact.sessionId || selectedSession;
    try {
      await api.post('/whatsapp/messages/send-location', {
        sessionId: targetSessionId,
        to: selectedContact.jid,
        location: {
          degreesLatitude: parseFloat(locationData.latitude),
          degreesLongitude: parseFloat(locationData.longitude),
          name: locationData.address || 'موقعي',
          address: locationData.address
        }
      });
      enqueueSnackbar('تم إرسال الموقع', { variant: 'success' });
      setLocationDialogOpen(false);
      setLocationData({ latitude: '', longitude: '', address: '' });
    } catch (error) {
      enqueueSnackbar('فشل إرسال الموقع', { variant: 'error' });
    }
  };

  const handleBlockContact = async (contact: Contact) => {
    if (!window.confirm(`هل أنت متأكد من حظر ${getContactName(contact)}؟`)) return;
    try {
      await api.post('/whatsapp/contacts/block', { sessionId: selectedSession, jid: contact.jid });
      enqueueSnackbar('تم حظر جهة الاتصال', { variant: 'success' });
      loadContacts();
      setShowContactInfo(false);
    } catch (error) {
      enqueueSnackbar('فشل حظر جهة الاتصال', { variant: 'error' });
    }
  };

  const handleUnblockContact = async (contact: Contact) => {
    try {
      await api.post('/whatsapp/contacts/unblock', { sessionId: selectedSession, jid: contact.jid });
      enqueueSnackbar('تم إلغاء حظر جهة الاتصال', { variant: 'success' });
      loadContacts();
      setShowContactInfo(false);
    } catch (error) {
      enqueueSnackbar('فشل إلغاء حظر جهة الاتصال', { variant: 'error' });
    }
  };

  // ==================== Group Advanced Features ====================
  const handleToggleEphemeral = async (duration: number) => {
    if (!selectedSession || !selectedContact?.isGroup) return;
    try {
      await api.post('/whatsapp/groups/ephemeral', {
        sessionId: selectedSession,
        groupId: selectedContact.jid,
        duration // 0 = off, 86400 = 24h, 604800 = 7 days, 7776000 = 90 days
      });
      enqueueSnackbar('تم تحديث إعدادات الرسائل المؤقتة', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('فشل تحديث الإعدادات', { variant: 'error' });
    }
  };

  const handleUpdateGroupPicture = async (file: File) => {
    if (!selectedSession || !selectedContact?.isGroup) return;
    try {
      const formData = new FormData();
      formData.append('sessionId', selectedSession);
      formData.append('groupId', selectedContact.jid);
      formData.append('image', file);
      await api.post('/whatsapp/groups/picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      enqueueSnackbar('تم تحديث صورة المجموعة', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('فشل تحديث الصورة', { variant: 'error' });
    }
  };

  const handleAcceptGroupInvite = async (inviteCode: string) => {
    if (!selectedSession) return;
    try {
      await api.post('/whatsapp/groups/invite/accept', {
        sessionId: selectedSession,
        inviteCode
      });
      enqueueSnackbar('تم قبول الدعوة والانضمام للمجموعة', { variant: 'success' });
      loadContacts();
    } catch (error) {
      enqueueSnackbar('فشل قبول الدعوة', { variant: 'error' });
    }
  };

  const handleGetUrlInfo = async (url: string) => {
    if (!selectedSession) return null;
    try {
      const res = await api.get('/whatsapp/url-info', {
        params: { sessionId: selectedSession, url }
      });
      return res.data;
    } catch (error) {
      console.error('Error getting URL info:', error);
      return null;
    }
  };

  // ==================== Order/Cart ====================
  const loadCart = async () => {
    if (!selectedSession || !selectedContact) return;
    try {
      const res = await api.get('/whatsapp/cart', {
        params: { sessionId: selectedSession, jid: selectedContact.jid }
      });
      setCartItems(res.data.cart || []);
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const handleSendOrder = async () => {
    if (!selectedSession || !selectedContact || orderData.items.length === 0) return;
    try {
      await api.post('/whatsapp/messages/send-order', {
        sessionId: selectedSession,
        to: selectedContact.jid,
        order: {
          items: orderData.items,
          currency: orderData.currency,
          note: orderData.note
        }
      });
      enqueueSnackbar('تم إرسال الطلب', { variant: 'success' });
      setOrderDialogOpen(false);
      setOrderData({ items: [], currency: 'EGP', note: '' });
    } catch (error) {
      enqueueSnackbar('فشل إرسال الطلب', { variant: 'error' });
    }
  };

  const addToOrder = (product: any) => {
    const existingItem = orderData.items.find(i => i.productId === product.id);
    if (existingItem) {
      setOrderData({
        ...orderData,
        items: orderData.items.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      });
    } else {
      setOrderData({
        ...orderData,
        items: [...orderData.items, { productId: product.id, quantity: 1, price: product.price || 0 }]
      });
    }
  };

  const removeFromOrder = (productId: string) => {
    setOrderData({
      ...orderData,
      items: orderData.items.filter(i => i.productId !== productId)
    });
  };

  const sendQuickReply = async (qr: QuickReply) => {
    if (!selectedSession || !selectedContact) return;
    try {
      await api.post('/whatsapp/messages/send', {
        sessionId: selectedSession,
        to: selectedContact.jid,
        text: qr.content
      });
      setShowQuickReplies(false);
    } catch (error) {
      console.error(error);
    }
  };

  const getContactName = (contact: Contact) => {
    if (contact.customer && (contact.customer.firstName || contact.customer.lastName)) {
      return `${contact.customer.firstName} ${contact.customer.lastName}`.trim();
    }
    return contact.name || contact.pushName || contact.phoneNumber;
  };

  const getParticipantName = (participantJid: string) => {
    // Normalize JID for lookup
    const normalizedJid = participantJid.includes('@') ? participantJid : `${participantJid}@s.whatsapp.net`;
    const contact = contacts.find(c => c.jid === normalizedJid || c.jid === normalizedJid.split('@')[0] + '@s.whatsapp.net');
    if (contact) {
      return getContactName(contact);
    }
    return participantJid.split('@')[0];
  };

  const filteredContacts = contacts.filter(c => {
    if (chatFilter === 'unread' && c.unreadCount === 0) return false;
    if (chatFilter === 'groups' && !c.isGroup) return false;

    if (searchQuery === 'individual:') return !c.jid.endsWith('@g.us');
    if (searchQuery === 'group:') return c.jid.endsWith('@g.us');
    if (!searchQuery) return true;
    const displayName = getContactName(c);
    return (displayName || c.phoneNumber).toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Paper sx={{ width: 350, display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl fullWidth size="small">
            <InputLabel>الجلسة</InputLabel>
            <Select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} label="الجلسة">
              {sessions.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <IconButton onClick={() => setProfileDialogOpen(true)} title="الملف الشخصي" disabled={!selectedSession}>
            <PersonIcon />
          </IconButton>
          <IconButton onClick={() => setLabelDialogOpen(true)} title="التصنيفات" disabled={!selectedSession}>
            <LabelIcon />
          </IconButton>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField fullWidth size="small" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
            <Chip label="الكل" size="small" onClick={() => setChatFilter('all')} color={chatFilter === 'all' ? 'primary' : 'default'} clickable />
            <Chip label="غير مقروء" size="small" onClick={() => setChatFilter('unread')} color={chatFilter === 'unread' ? 'primary' : 'default'} clickable />
            <Chip label="مجموعات" size="small" onClick={() => setChatFilter('groups')} color={chatFilter === 'groups' ? 'primary' : 'default'} clickable />
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setCreateGroupDialogOpen(true)} title="إنشاء مجموعة جديدة">
              <GroupAddIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setCheckNumberDialogOpen(true)} title="التحقق من رقم">
              <PersonSearchIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setBroadcastDialogOpen(true)} title="إرسال بث">
              <BroadcastIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setPrivacyDialogOpen(true)} title="الخصوصية">
              <SecurityIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setBusinessProfileDialogOpen(true)} title="ملف النشاط التجاري">
              <StoreIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {filteredContacts.map(contact => (
            <ListItem key={contact.id} button selected={selectedContact?.id === contact.id} onClick={() => setSelectedContact(contact)} onContextMenu={(e) => { e.preventDefault(); setChatMenuAnchor(e.currentTarget); setSelectedChatForMenu(contact); }}>
              <ListItemAvatar>
                <Badge badgeContent={contact.unreadCount} color="primary">
                  <Avatar src={contact.profilePicUrl || ''}>{getContactName(contact)[0]}</Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText primary={getContactName(contact)} secondary={contact.lastMessage?.content || '...'} />
            </ListItem>
          ))}
        </List>
      </Paper>

      {/* Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedContact ? (
          <>
            <Paper sx={{ p: 2, borderRadius: 0, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar src={selectedContact.profilePicUrl || ''} />
                <Typography variant="subtitle1">{getContactName(selectedContact)}</Typography>
              </Box>
              <Box>
                <IconButton onClick={() => setShowContactInfo(true)}><InfoIcon /></IconButton>
              </Box>
            </Paper>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#e5ddd5', backgroundImage: 'url(/whatsapp-bg.png)' }}>
              {messages.map((message, index) => (
                <React.Fragment key={message.id}>
                  {/* Date Separator */}
                  {shouldShowDateSeparator(message, messages[index - 1]) && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                      <Chip
                        label={getDateSeparatorText(message.timestamp)}
                        size="small"
                        sx={{ bgcolor: 'rgba(0,0,0,0.1)', color: 'text.secondary' }}
                      />
                    </Box>
                  )}
                  {/* Message */}
                  <Box sx={{ display: 'flex', justifyContent: message.fromMe ? 'flex-start' : 'flex-end', mb: 1 }}>
                    <Paper
                      sx={{ p: 1, maxWidth: '70%', bgcolor: message.fromMe ? '#d9fdd3' : '#fff', cursor: 'context-menu' }}
                      onContextMenu={(e) => handleMessageContextMenu(e, message)}
                    >
                      {selectedContact?.isGroup && !message.fromMe && message.participant && (
                        <Typography variant="caption" sx={{ display: 'block', color: 'secondary.main', fontWeight: 'bold', mb: 0.5 }}>
                          {getParticipantName(message.participant)}
                        </Typography>
                      )}
                      {message.quotedContent && (
                        <Box sx={{ bgcolor: 'rgba(0,0,0,0.05)', borderInlineStart: '4px solid #00a884', p: 0.5, mb: 0.5, borderRadius: 0.5 }}>
                          <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>رد على رسالة</Typography>
                          <Typography variant="caption" noWrap>{message.quotedContent}</Typography>
                        </Box>
                      )}
                      {renderMessageContent(message)}
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{format(new Date(message.timestamp), 'HH:mm')}</Typography>
                        {message.fromMe && getStatusIcon(message.status)}
                      </Box>
                    </Paper>
                  </Box>
                </React.Fragment>
              ))}
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                  <Paper sx={{ p: 1, bgcolor: '#fff' }}>
                    <Typography variant="caption" color="text.secondary">يكتب...</Typography>
                  </Paper>
                </Box>
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Paper sx={{ p: 2, borderRadius: 0 }}>
              {replyingTo && (
                <Box sx={{ p: 1, mb: 1, bgcolor: 'rgba(0,0,0,0.05)', borderLeft: '4px solid #00a884', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="caption" color="primary" fontWeight="bold">
                      {replyingTo.fromMe ? 'أنت' : getContactName(selectedContact)}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                      {replyingTo.content || (replyingTo.mediaType ? `[${replyingTo.mediaType}]` : 'رسالة')}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setReplyingTo(null)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              {isRecording ? (
                <AudioRecorder
                  onCancel={() => setIsRecording(false)}
                  onSend={async (blob) => {
                    setIsRecording(false);
                    if (!selectedSession || !selectedContact) return;
                    const formData = new FormData();
                    formData.append('sessionId', selectedSession);
                    formData.append('to', selectedContact.jid);
                    formData.append('file', blob, 'voice_note.webm');
                    try {
                      await api.post('/whatsapp/messages/upload-send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                      enqueueSnackbar('تم إرسال الرسالة الصوتية', { variant: 'success' });
                      loadMessages();
                    } catch (error) {
                      enqueueSnackbar('فشل إرسال الرسالة الصوتية', { variant: 'error' });
                    }
                  }}
                />
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' }}>
                  {showEmojiPicker && (
                    <Box sx={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 1000 }}>
                      <EmojiPicker onEmojiClick={(data) => setNewMessage(prev => prev + data.emoji)} />
                    </Box>
                  )}
                  <IconButton onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    <EmojiEmotionsIcon color={showEmojiPicker ? 'primary' : 'inherit'} />
                  </IconButton>
                  <IconButton onClick={() => fileInputRef.current?.click()}><AttachIcon /></IconButton>
                  <IconButton onClick={() => setPollDialogOpen(true)} title="إنشاء استطلاع">
                    <PollIcon />
                  </IconButton>
                  <IconButton onClick={() => setButtonsDialogOpen(true)} title="رسالة بأزرار">
                    <ButtonIcon />
                  </IconButton>
                  <IconButton onClick={() => setListDialogOpen(true)} title="رسالة بقائمة">
                    <ListIcon />
                  </IconButton>
                  <IconButton onClick={() => { loadProducts(); setCatalogDialogOpen(true); }} title="إرسال منتج">
                    <CatalogIcon />
                  </IconButton>
                  <IconButton onClick={() => setLocationDialogOpen(true)} title="إرسال موقع">
                    <LocationIcon />
                  </IconButton>
                  <IconButton onClick={() => { loadProducts(); setOrderDialogOpen(true); }} title="إرسال طلب">
                    <CatalogIcon color="secondary" />
                  </IconButton>
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                  <TextField fullWidth size="small" placeholder="اكتب رسالة..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                  {newMessage.trim() ? (
                    <IconButton color="primary" onClick={handleSendMessage} disabled={sending}>{sending ? <CircularProgress size={24} /> : <SendIcon />}</IconButton>
                  ) : (
                    <IconButton color="primary" onClick={() => setIsRecording(true)}><MicIcon /></IconButton>
                  )}
                </Box>
              )}
            </Paper>
          </>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" flex={1}><Typography>اختر محادثة للبدء</Typography></Box>
        )}
      </Box>

      {/* Chat Context Menu */}
      <Menu anchorEl={chatMenuAnchor} open={Boolean(chatMenuAnchor)} onClose={() => setChatMenuAnchor(null)}>
        <MenuItem onClick={() => { if (selectedChatForMenu) handleClearChat(selectedChatForMenu); setChatMenuAnchor(null); }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> مسح المحتوى
        </MenuItem>
        <MenuItem onClick={() => { if (selectedChatForMenu) handleArchiveChat(selectedChatForMenu); setChatMenuAnchor(null); }}>
          <ArchiveIcon fontSize="small" sx={{ mr: 1 }} /> {selectedChatForMenu?.isArchived ? 'إلغاء الأرشفة' : 'أرشفة'}
        </MenuItem>
        <MenuItem onClick={() => { if (selectedChatForMenu) handlePinChat(selectedChatForMenu); setChatMenuAnchor(null); }}>
          <PinIcon fontSize="small" sx={{ mr: 1 }} /> {selectedChatForMenu?.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
        </MenuItem>
        <MenuItem onClick={() => { if (selectedChatForMenu) handleMuteChat(selectedChatForMenu); setChatMenuAnchor(null); }}>
          <MuteIcon fontSize="small" sx={{ mr: 1 }} /> {selectedChatForMenu?.isMuted ? 'إلغاء الكتم' : 'كتم'}
        </MenuItem>
        <MenuItem onClick={() => { if (selectedChatForMenu) handleMarkUnread(selectedChatForMenu); setChatMenuAnchor(null); }}>
          <PendingIcon fontSize="small" sx={{ mr: 1 }} /> تمييز كغير مقروء
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedChatForMenu) {
            setSelectedContactForLabel(selectedChatForMenu);
            setLabelDialogOpen(true);
          }
          setChatMenuAnchor(null);
        }}>
          <LabelIcon fontSize="small" sx={{ mr: 1 }} /> إضافة علامة
        </MenuItem>
        <MenuItem onClick={() => { if (selectedChatForMenu) handleDeleteChat(selectedChatForMenu); setChatMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> حذف المحادثة
        </MenuItem>
      </Menu>

      {/* Message Context Menu */}
      <Menu
        anchorEl={messageMenuAnchor}
        open={Boolean(messageMenuAnchor)}
        onClose={() => setMessageMenuAnchor(null)}
      >
        {/* Quick Reactions */}
        <Box sx={{ display: 'flex', gap: 0.5, p: 1, borderBottom: 1, borderColor: 'divider' }}>
          {commonReactions.map(emoji => (
            <IconButton
              key={emoji}
              size="small"
              onClick={() => {
                if (selectedMessageForMenu) {
                  handleSendReaction(selectedMessageForMenu.messageId, emoji);
                  setMessageMenuAnchor(null);
                }
              }}
              sx={{ fontSize: '1.2rem' }}
            >
              {emoji}
            </IconButton>
          ))}
          <IconButton
            size="small"
            onClick={() => {
              if (selectedMessageForMenu) {
                setShowReactionPicker(selectedMessageForMenu.messageId);
                setMessageMenuAnchor(null);
              }
            }}
          >
            <AddReactionIcon fontSize="small" />
          </IconButton>
        </Box>
        <MenuItem onClick={handleReply}>
          <ReplyIcon fontSize="small" sx={{ mr: 1 }} /> رد
        </MenuItem>
        <MenuItem onClick={handleCopy}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} /> نسخ
        </MenuItem>
        <MenuItem onClick={() => { setForwardDialogOpen(true); setMessageMenuAnchor(null); }}>
          <ForwardIcon fontSize="small" sx={{ mr: 1 }} /> إعادة توجيه
        </MenuItem>
        <MenuItem onClick={() => { if (selectedMessageForMenu) handleStarMessage(selectedMessageForMenu); }}>
          <StarBorderIcon fontSize="small" sx={{ mr: 1 }} /> تمييز بنجمة
        </MenuItem>
        {selectedMessageForMenu?.fromMe && (
          <MenuItem onClick={handleDeleteMessage} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> حذف للجميع
          </MenuItem>
        )}
      </Menu>

      {/* Forward Dialog */}
      <Dialog open={forwardDialogOpen} onClose={() => setForwardDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>إعادة توجيه الرسالة إلى...</DialogTitle>
        <DialogContent dividers>
          <List>
            {contacts.map(contact => (
              <ListItem
                key={contact.id}
                button
                onClick={() => {
                  if (selectedContactsForForward.includes(contact.id)) {
                    setSelectedContactsForForward(prev => prev.filter(id => id !== contact.id));
                  } else {
                    setSelectedContactsForForward(prev => [...prev, contact.id]);
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar src={contact.profilePicUrl || ''} />
                </ListItemAvatar>
                <ListItemText primary={getContactName(contact)} />
                {selectedContactsForForward.includes(contact.id) && <CheckIcon color="primary" />}
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForwardDialogOpen(false)}>إلغاء</Button>
          <Button onClick={handleForwardMessage} variant="contained" disabled={selectedContactsForForward.length === 0}>
            إرسال ({selectedContactsForForward.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Info Drawer (Individual) */}
      <Drawer
        anchor="right"
        open={showContactInfo && !selectedContact?.isGroup}
        onClose={() => setShowContactInfo(false)}
        PaperProps={{ sx: { width: 350 } }}
      >
        {selectedContact && !selectedContact.isGroup && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar src={selectedContact.profilePicUrl || ''} sx={{ width: 120, height: 120, mb: 2 }} />
            <Typography variant="h6">{getContactName(selectedContact)}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{selectedContact.phoneNumber}</Typography>

            <Divider sx={{ width: '100%', mb: 2 }} />

            <List sx={{ width: '100%' }}>
              <ListItem button>
                <ListItemText primary="الوسائط والروابط والمستندات" secondary="0" />
              </ListItem>
              <ListItem button onClick={loadStarredMessages}>
                <ListItemText primary="الرسائل المميزة بنجمة" />
                <StarIcon sx={{ color: 'warning.main' }} />
              </ListItem>
              <ListItem button onClick={() => handleMuteChat(selectedContact)}>
                <ListItemText primary="كتم الإشعارات" />
                <Typography variant="caption">{selectedContact.isMuted ? 'مفعل' : 'غير مفعل'}</Typography>
              </ListItem>
            </List>

            <Divider sx={{ width: '100%', my: 2 }} />

            <Button fullWidth color="error" startIcon={<DeleteIcon />} onClick={() => { handleDeleteChat(selectedContact); setShowContactInfo(false); }}>
              حذف المحادثة
            </Button>
            {selectedContact.isBlocked ? (
              <Button fullWidth color="primary" startIcon={<CheckIcon />} sx={{ mt: 1 }} onClick={() => handleUnblockContact(selectedContact)}>
                إلغاء حظر {getContactName(selectedContact)}
              </Button>
            ) : (
              <Button fullWidth color="error" startIcon={<BlockIcon />} sx={{ mt: 1 }} onClick={() => handleBlockContact(selectedContact)}>
                حظر {getContactName(selectedContact)}
              </Button>
            )}
            <Button fullWidth color="error" startIcon={<ReportIcon />} sx={{ mt: 1 }} onClick={() => enqueueSnackbar('قريباً', { variant: 'info' })}>
              الإبلاغ عن {getContactName(selectedContact)}
            </Button>
          </Box>
        )}
      </Drawer>

      {/* Group Info Drawer */}
      <GroupInfoDrawer
        open={showContactInfo && !!selectedContact?.isGroup}
        onClose={() => setShowContactInfo(false)}
        sessionId={selectedContact?.sessionId || selectedSession}
        groupJid={selectedContact?.jid || ''}
        contacts={contacts}
      />

      <CreateGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        sessionId={selectedSession}
        contacts={contacts}
        onGroupCreated={(group) => {
          loadContacts();
          // Optionally select the new group
          // setSelectedContact(group); 
        }}
      />
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        sessionId={selectedSession}
        currentName={currentUserProfile?.name || ''}
        currentStatus={currentUserProfile?.status || ''}
        currentPicture={currentUserProfile?.profilePicUrl || ''}
      />

      <CheckNumberDialog
        open={checkNumberDialogOpen}
        onClose={() => setCheckNumberDialogOpen(false)}
        sessionId={selectedSession}
        onChatStart={(jid) => {
          const existingContact = contacts.find(c => c.jid === jid);
          if (existingContact) {
            setSelectedContact(existingContact);
          } else {
            const newContact: Contact = {
              id: jid,
              sessionId: selectedSession,
              jid: jid,
              phoneNumber: jid.split('@')[0] || jid,
              name: null,
              pushName: null,
              profilePicUrl: null,
              isGroup: false,
              category: null,
              unreadCount: 0,
              lastMessageAt: new Date().toISOString(),
              isArchived: false,
              isPinned: false,
              isMuted: false,
              isBlocked: false,
              session: { name: '', phoneNumber: '' },
              customer: null
            };
            setContacts(prev => [newContact, ...prev]);
            setSelectedContact(newContact);
          }
        }}
      />



      {/* Poll Dialog */}
      <Dialog open={pollDialogOpen} onClose={() => setPollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PollIcon color="primary" />
            إنشاء استطلاع
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="السؤال"
            value={pollData.question}
            onChange={(e) => setPollData(prev => ({ ...prev, question: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>الخيارات:</Typography>
          {pollData.options.map((option, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`الخيار ${index + 1}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...pollData.options];
                  newOptions[index] = e.target.value;
                  setPollData(prev => ({ ...prev, options: newOptions }));
                }}
              />
              {pollData.options.length > 2 && (
                <IconButton
                  size="small"
                  onClick={() => {
                    const newOptions = pollData.options.filter((_, i) => i !== index);
                    setPollData(prev => ({ ...prev, options: newOptions }));
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {pollData.options.length < 12 && (
            <Button
              size="small"
              onClick={() => setPollData(prev => ({ ...prev, options: [...prev.options, ''] }))}
              sx={{ mb: 2 }}
            >
              + إضافة خيار
            </Button>
          )}
          <FormControl fullWidth size="small">
            <InputLabel>عدد الاختيارات المسموحة</InputLabel>
            <Select
              value={pollData.selectableCount}
              label="عدد الاختيارات المسموحة"
              onChange={(e) => setPollData(prev => ({ ...prev, selectableCount: Number(e.target.value) }))}
            >
              <MenuItem value={1}>اختيار واحد فقط</MenuItem>
              <MenuItem value={0}>اختيارات متعددة</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPollDialogOpen(false)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={handleSendPoll}
            disabled={!pollData.question.trim() || pollData.options.filter(o => o.trim()).length < 2}
          >
            إرسال الاستطلاع
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reaction Picker Dialog */}
      <Dialog
        open={!!showReactionPicker}
        onClose={() => setShowReactionPicker(null)}
        maxWidth="xs"
      >
        <DialogTitle>اختر تفاعل</DialogTitle>
        <DialogContent>
          <EmojiPicker
            onEmojiClick={(data: EmojiClickData) => {
              if (showReactionPicker) {
                handleSendReaction(showReactionPicker, data.emoji);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Buttons Dialog */}
      <Dialog open={buttonsDialogOpen} onClose={() => setButtonsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ButtonIcon color="primary" />
            إرسال رسالة بأزرار
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="نص الرسالة"
            multiline
            rows={3}
            value={buttonsData.text}
            onChange={(e) => setButtonsData(prev => ({ ...prev, text: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="نص التذييل (اختياري)"
            value={buttonsData.footer}
            onChange={(e) => setButtonsData(prev => ({ ...prev, footer: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>الأزرار (حد أقصى 3):</Typography>
          {buttonsData.buttons.map((btn, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder={`الزر ${index + 1}`}
                value={btn.text}
                onChange={(e) => {
                  const newButtons = [...buttonsData.buttons];
                  newButtons[index] = { ...btn, text: e.target.value };
                  setButtonsData(prev => ({ ...prev, buttons: newButtons }));
                }}
              />
              {buttonsData.buttons.length > 1 && (
                <IconButton size="small" onClick={() => {
                  setButtonsData(prev => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }));
                }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {buttonsData.buttons.length < 3 && (
            <Button size="small" onClick={() => setButtonsData(prev => ({
              ...prev,
              buttons: [...prev.buttons, { id: String(prev.buttons.length + 1), text: '' }]
            }))}>
              + إضافة زر
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setButtonsDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSendButtons} disabled={!buttonsData.text.trim()}>
            إرسال
          </Button>
        </DialogActions>
      </Dialog>

      {/* List Dialog */}
      <Dialog open={listDialogOpen} onClose={() => setListDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ListIcon color="primary" />
            إرسال رسالة بقائمة
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            label="نص الرسالة"
            multiline
            rows={2}
            value={listData.text}
            onChange={(e) => setListData(prev => ({ ...prev, text: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="عنوان القائمة"
              value={listData.title}
              onChange={(e) => setListData(prev => ({ ...prev, title: e.target.value }))}
            />
            <TextField
              fullWidth
              label="نص الزر"
              value={listData.buttonText}
              onChange={(e) => setListData(prev => ({ ...prev, buttonText: e.target.value }))}
            />
          </Box>

          {listData.sections.map((section, sIndex) => (
            <Paper key={sIndex} sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <TextField
                  size="small"
                  label="عنوان القسم"
                  value={section.title}
                  onChange={(e) => {
                    const newSections = [...listData.sections];
                    newSections[sIndex] = { ...section, title: e.target.value };
                    setListData(prev => ({ ...prev, sections: newSections }));
                  }}
                />
                {listData.sections.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => {
                    setListData(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== sIndex) }));
                  }}>
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>

              {section.rows.map((row, rIndex) => (
                <Box key={rIndex} sx={{ display: 'flex', gap: 1, mb: 1, ml: 2 }}>
                  <TextField
                    size="small"
                    placeholder="العنوان"
                    value={row.title}
                    onChange={(e) => {
                      const newSections = [...listData.sections];
                      if (newSections[sIndex]?.rows[rIndex]) {
                        newSections[sIndex].rows[rIndex] = { ...row, title: e.target.value };
                        setListData(prev => ({ ...prev, sections: newSections }));
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    placeholder="الوصف (اختياري)"
                    value={row.description}
                    onChange={(e) => {
                      const newSections = [...listData.sections];
                      if (newSections[sIndex]?.rows[rIndex]) {
                        newSections[sIndex].rows[rIndex] = { ...row, description: e.target.value };
                        setListData(prev => ({ ...prev, sections: newSections }));
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                  {section.rows.length > 1 && (
                    <IconButton size="small" onClick={() => {
                      const newSections = [...listData.sections];
                      if (newSections[sIndex]) {
                        newSections[sIndex].rows = section.rows.filter((_, i) => i !== rIndex);
                        setListData(prev => ({ ...prev, sections: newSections }));
                      }
                    }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button size="small" onClick={() => {
                const newSections = [...listData.sections];
                if (newSections[sIndex]) {
                  newSections[sIndex].rows.push({ id: String(section.rows.length + 1), title: '', description: '' });
                  setListData(prev => ({ ...prev, sections: newSections }));
                }
              }}>
                + إضافة عنصر
              </Button>
            </Paper>
          ))}

          {listData.sections.length < 10 && (
            <Button onClick={() => setListData(prev => ({
              ...prev,
              sections: [...prev.sections, { title: `القسم ${prev.sections.length + 1}`, rows: [{ id: '1', title: '', description: '' }] }]
            }))}>
              + إضافة قسم
            </Button>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListDialogOpen(false)}>إلغاء</Button>
          <Button variant="contained" onClick={handleSendList} disabled={!listData.text.trim()}>
            إرسال
          </Button>
        </DialogActions>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialogOpen} onClose={() => setBroadcastDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BroadcastIcon color="primary" />
            إرسال بث جماعي
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            سيتم إرسال الرسالة لجميع جهات الاتصال المحددة بشكل فردي.
          </Alert>
          <TextField
            fullWidth
            label="نص الرسالة"
            multiline
            rows={4}
            value={broadcastData.message}
            onChange={(e) => setBroadcastData(prev => ({ ...prev, message: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            اختر جهات الاتصال ({broadcastData.selectedContacts.length} محدد):
          </Typography>
          <Paper sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense>
              {contacts.filter(c => !c.isGroup).map(contact => (
                <ListItem
                  key={contact.id}
                  button
                  onClick={() => {
                    if (broadcastData.selectedContacts.includes(contact.jid)) {
                      setBroadcastData(prev => ({
                        ...prev,
                        selectedContacts: prev.selectedContacts.filter(j => j !== contact.jid)
                      }));
                    } else {
                      setBroadcastData(prev => ({
                        ...prev,
                        selectedContacts: [...prev.selectedContacts, contact.jid]
                      }));
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={contact.profilePicUrl || ''} sx={{ width: 32, height: 32 }}>
                      {getContactName(contact)[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={getContactName(contact)} secondary={contact.phoneNumber} />
                  {broadcastData.selectedContacts.includes(contact.jid) && (
                    <CheckIcon color="primary" />
                  )}
                </ListItem>
              ))}
            </List>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBroadcastDialogOpen(false)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={handleSendBroadcast}
            disabled={!broadcastData.message.trim() || broadcastData.selectedContacts.length === 0}
          >
            إرسال ({broadcastData.selectedContacts.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Catalog Dialog */}
      <Dialog open={catalogDialogOpen} onClose={() => setCatalogDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CatalogIcon color="primary" />
            إرسال منتج
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {products.length === 0 ? (
            <Alert severity="info">لا توجد منتجات في الكتالوج.</Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
              {products.map((product, index) => (
                <Paper
                  key={index}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: selectedProduct?.id === product.id ? '2px solid' : '1px solid',
                    borderColor: selectedProduct?.id === product.id ? 'primary.main' : 'divider',
                    '&:hover': { borderColor: 'primary.light' }
                  }}
                  onClick={() => setSelectedProduct(product)}
                >
                  {product.imageUrl && (
                    <Box
                      component="img"
                      src={product.imageUrl}
                      sx={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 1, mb: 1 }}
                    />
                  )}
                  <Typography variant="subtitle2" noWrap>{product.name}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {product.description}
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {product.price} {product.currency || 'EGP'}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCatalogDialogOpen(false)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={() => selectedProduct && handleSendProduct(selectedProduct)}
            disabled={!selectedProduct}
          >
            إرسال المنتج
          </Button>
        </DialogActions>
      </Dialog>

      {/* Starred Messages Drawer */}
      <Drawer
        anchor="right"
        open={starredMessagesOpen}
        onClose={() => setStarredMessagesOpen(false)}
        PaperProps={{ sx: { width: 400 } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              <StarIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
              الرسائل المميزة
            </Typography>
            <IconButton onClick={() => setStarredMessagesOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {starredMessages.length === 0 ? (
            <Typography color="text.secondary" textAlign="center">
              لا توجد رسائل مميزة
            </Typography>
          ) : (
            <List>
              {starredMessages.map((msg, index) => (
                <Paper key={index} sx={{ p: 1, mb: 1 }}>
                  <Typography variant="body2">{msg.content}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {format(new Date(msg.timestamp), 'dd/MM/yyyy HH:mm')}
                  </Typography>
                </Paper>
              ))}
            </List>
          )}
        </Box>
      </Drawer>

      {/* Order Dialog */}
      <Dialog open={orderDialogOpen} onClose={() => setOrderDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CatalogIcon color="secondary" />
            إنشاء طلب
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle1" gutterBottom>المنتجات المتاحة</Typography>
              {products.length === 0 ? (
                <Alert severity="info">لا توجد منتجات</Alert>
              ) : (
                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {products.map((product, index) => (
                    <ListItem key={index} secondaryAction={
                      <Button size="small" onClick={() => addToOrder(product)}>إضافة</Button>
                    }>
                      <ListItemText
                        primary={product.name}
                        secondary={`${product.price || 0} ${orderData.currency}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Grid>
            <Grid item xs={12} md={5}>
              <Typography variant="subtitle1" gutterBottom>الطلب الحالي</Typography>
              {orderData.items.length === 0 ? (
                <Typography color="text.secondary">لم تتم إضافة منتجات</Typography>
              ) : (
                <>
                  <List>
                    {orderData.items.map((item, index) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <ListItem key={index} secondaryAction={
                          <IconButton size="small" color="error" onClick={() => removeFromOrder(item.productId)}>
                            <DeleteIcon />
                          </IconButton>
                        }>
                          <ListItemText
                            primary={product?.name || item.productId}
                            secondary={`${item.quantity} × ${item.price} = ${item.quantity * item.price} ${orderData.currency}`}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="h6">
                    الإجمالي: {orderData.items.reduce((sum, i) => sum + (i.quantity * i.price), 0)} {orderData.currency}
                  </Typography>
                </>
              )}

              <TextField
                fullWidth
                label="ملاحظات"
                value={orderData.note}
                onChange={(e) => setOrderData({ ...orderData, note: e.target.value })}
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialogOpen(false)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={handleSendOrder}
            disabled={orderData.items.length === 0}
          >
            إرسال الطلب
          </Button>
        </DialogActions>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onClose={() => setLocationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocationIcon color="primary" />
            إرسال موقع
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<LocationIcon />}
            onClick={getCurrentLocation}
            sx={{ mb: 3 }}
          >
            استخدام موقعي الحالي
          </Button>

          <Typography variant="subtitle2" sx={{ mb: 1 }}>أو أدخل الإحداثيات يدوياً:</Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="خط العرض (Latitude)"
              value={locationData.latitude}
              onChange={(e) => setLocationData(prev => ({ ...prev, latitude: e.target.value }))}
              type="number"
              inputProps={{ step: 'any' }}
            />
            <TextField
              fullWidth
              label="خط الطول (Longitude)"
              value={locationData.longitude}
              onChange={(e) => setLocationData(prev => ({ ...prev, longitude: e.target.value }))}
              type="number"
              inputProps={{ step: 'any' }}
            />
          </Box>

          <TextField
            fullWidth
            label="العنوان (اختياري)"
            value={locationData.address}
            onChange={(e) => setLocationData(prev => ({ ...prev, address: e.target.value }))}
            placeholder="مثال: القاهرة، مصر"
          />

          {locationData.latitude && locationData.longitude && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                📍 الموقع: {locationData.latitude}, {locationData.longitude}
              </Typography>
              <Button
                size="small"
                href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                target="_blank"
                sx={{ mt: 1 }}
              >
                عرض على الخريطة
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialogOpen(false)}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={handleSendLocation}
            disabled={!locationData.latitude || !locationData.longitude}
          >
            إرسال الموقع
          </Button>
        </DialogActions>
      </Dialog>

      {/* Labels Dialog */}
      <LabelsDialog
        open={labelDialogOpen}
        onClose={() => {
          setLabelDialogOpen(false);
          setSelectedContactForLabel(null);
        }}
        sessionId={selectedSession}
        contactJid={selectedContactForLabel?.jid}
        initialLabels={selectedContactForLabel?.labels || []}
        onLabelsUpdated={() => {
          loadContacts(); // Refresh contacts to show new labels
        }}
      />

      {/* Broadcast Dialog */}
      <BroadcastDialog
        open={broadcastDialogOpen}
        onClose={() => setBroadcastDialogOpen(false)}
        sessionId={selectedSession}
        contacts={contacts}
      />

      {/* Privacy Settings Dialog */}
      <PrivacySettingsDialog
        open={privacyDialogOpen}
        onClose={() => setPrivacyDialogOpen(false)}
        sessionId={selectedSession}
        contacts={contacts}
      />

      {/* Business Profile Dialog */}
      <BusinessProfileDialog
        open={businessProfileDialogOpen}
        onClose={() => setBusinessProfileDialogOpen(false)}
        sessionId={selectedSession}
      />
    </Box>
  );
};

export default WhatsAppChat;
