/**
 * 📱 WhatsApp Chat Page
 * صفحة دردشة WhatsApp
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, IconButton, Avatar, Badge, List, ListItem,
  ListItemAvatar, ListItemText, Divider, CircularProgress, Chip, Menu, MenuItem,
  InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Select, FormControl, InputLabel, Alert, Drawer, Tabs, Tab
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
  Forward as ForwardIcon, Refresh as RefreshIcon, Close as CloseIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { format, isToday, isYesterday } from 'date-fns';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { apiClient as api } from '../../services/apiClient';
import useSocket from '../../hooks/useSocket';
import AudioRecorder from './components/AudioRecorder';

interface Contact {
  id: string;
  jid: string;
  phoneNumber: string;
  name: string | null;
  pushName: string | null;
  profilePicUrl: string | null;
  isGroup: boolean;
  category: string | null;
  unreadCount: number;
  lastMessageAt: string | null;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
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
  const [isRecording, setIsRecording] = useState(false);

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

  // Load initial data
  useEffect(() => {
    loadSessions();
    loadQuickReplies();
  }, []);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // Helper to normalize JID for comparison
    const normalizeJid = (jid: string) => {
      if (!jid) return '';
      const bareJid = jid.split('@')[0].split(':')[0];
      return bareJid.replace(/\D/g, '');
    };

    const handleNewMessage = (data: any) => {
      const { sessionId, message } = data;

      // Normalize JIDs for comparison
      const msgJid = normalizeJid(message.remoteJid);
      const currentJid = selectedContact ? normalizeJid(selectedContact.jid) : '';

      if (selectedContact && msgJid === currentJid && sessionId === selectedSession) {
        setMessages(prev => [...prev, message]);
        markAsRead();
        // Play sound if chat is open
        try {
          const audio = new Audio('/assets/sounds/notification.mp3'); // Ensure this path exists or use a default
          audio.play().catch(e => console.log('Audio play failed', e));
        } catch (e) {
          // Ignore audio errors
        }
      } else {
        // Show notification if chat is not open or different contact
        if (sessionId === selectedSession) { // Only for current session
          // You might want to use a toast library here if available, e.g. notistack
          // enqueueSnackbar(`New message from ${message.pushName || message.remoteJid}`, { variant: 'info' });
          try {
            const audio = new Audio('/assets/sounds/notification.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
          } catch (e) { }
        }
      }
      // Update contact list logic (simplified)
      loadContacts();
    };

    const handleMessageStatus = (data: any) => {
      const { messageId, status } = data;
      setMessages(prev => prev.map(m => m.messageId === messageId ? { ...m, status } : m));
    };

    const handleMessageSent = (data: any) => {
      const { sessionId, message } = data;

      const msgJid = normalizeJid(message.remoteJid);
      const currentJid = selectedContact ? normalizeJid(selectedContact.jid) : '';

      if (selectedContact && msgJid === currentJid && sessionId === selectedSession) {
        // Only add if not already present (to avoid duplicates if API response adds it too)
        setMessages(prev => {
          if (prev.some(m => m.messageId === message.messageId)) return prev;
          return [...prev, message];
        });
      }
      // Update contact list to show new last message/timestamp
      loadContacts();
    };

    socket.on('whatsapp:message:new', handleNewMessage);
    socket.on('whatsapp:message:status', handleMessageStatus);
    socket.on('whatsapp:message:sent', handleMessageSent);

    return () => {
      socket.off('whatsapp:message:new', handleNewMessage);
      socket.off('whatsapp:message:status', handleMessageStatus);
      socket.off('whatsapp:message:sent', handleMessageSent);
    };
  }, [socket, selectedContact, selectedSession]);

  // Load contacts when session changes
  useEffect(() => {
    if (selectedSession) {
      loadContacts();
    }
  }, [selectedSession]);

  // Load messages when contact changes
  useEffect(() => {
    if (selectedContact && selectedSession) {
      loadMessages();
      markAsRead();
    }
  }, [selectedContact]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadSessions = async () => {
    try {
      const res = await api.get('/whatsapp/sessions');
      const activeSessions = res.data.sessions || [];
      setSessions(activeSessions);
      const connectedSession = activeSessions.find((s: Session) => s.liveStatus === 'connected' || s.status === 'CONNECTED');
      if (connectedSession) setSelectedSession(connectedSession.id);
      else if (activeSessions.length > 0) setSelectedSession(activeSessions[0].id);
    } catch (error) {
      enqueueSnackbar('حدث خطأ أثناء تحميل الجلسات', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await api.get('/whatsapp/conversations', { params: { sessionId: selectedSession } });
      setContacts(res.data.conversations || []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadMessages = async () => {
    if (!selectedContact || !selectedSession) return;
    setLoadingMessages(true);
    try {
      const res = await api.get(`/whatsapp/conversations/${encodeURIComponent(selectedContact.jid)}/messages`, {
        params: { sessionId: selectedSession }
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
    try {
      await api.post('/whatsapp/messages/read', { sessionId: selectedSession, remoteJid: selectedContact.jid });
    } catch (error) { console.error(error); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedContact || !selectedSession || sending) return;
    setSending(true);
    try {
      const res = await api.post('/whatsapp/messages/send', {
        sessionId: selectedSession,
        to: selectedContact.jid,
        text: newMessage,
        quotedMessageId: replyingTo?.messageId,
      });
      setMessages(prev => [...prev, res.data.message]);
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
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sessionId', selectedSession);
    formData.append('to', selectedContact.jid);
    try {
      await api.post('/whatsapp/messages/upload-send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadMessages();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.error || 'حدث خطأ أثناء رفع الملف', { variant: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearChat = async (contact: Contact) => {
    if (!selectedSession) return;
    if (!window.confirm('هل أنت متأكد من مسح محتوى هذه المحادثة؟')) return;
    try {
      await api.post('/whatsapp/chats/clear', { sessionId: selectedSession, jid: contact.jid });
      if (selectedContact?.id === contact.id) setMessages([]);
      loadContacts();
      enqueueSnackbar('تم مسح محتوى المحادثة', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar('حدث خطأ', { variant: 'error' });
    }
  };

  const handleDeleteChat = async (contact: Contact) => {
    if (!selectedSession) {
      enqueueSnackbar('يجب اختيار جلسة أولاً', { variant: 'warning' });
      return;
    }
    if (!window.confirm('هل أنت متأكد من حذف هذه المحادثة؟')) return;
    
    try {
      const response = await api.post('/whatsapp/chats/delete', { 
        sessionId: selectedSession, 
        jid: contact.jid 
      });
      
      if (response.data.success) {
        // Remove from contacts list immediately
        setContacts(prev => prev.filter(c => c.id !== contact.id));
        
        // Clear selected contact if it's the deleted one
        if (selectedContact?.id === contact.id) {
          setSelectedContact(null);
          setMessages([]);
        }
        
        enqueueSnackbar('تم حذف المحادثة بنجاح', { variant: 'success' });
      }
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      const errorMessage = error.response?.data?.error || error.message || 'حدث خطأ أثناء حذف المحادثة';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'READ': return <DoneAllIcon sx={{ fontSize: 16, color: '#53bdeb' }} />;
      case 'DELIVERED': return <DoneAllIcon sx={{ fontSize: 16, color: 'grey.500' }} />;
      case 'SENT': return <CheckIcon sx={{ fontSize: 16, color: 'grey.500' }} />;
      default: return <PendingIcon sx={{ fontSize: 16, color: 'grey.500' }} />;
    }
  };

  const loadQuickReplies = async () => {
    try {
      const res = await api.get('/whatsapp/quick-replies');
      setQuickReplies(res.data.quickReplies || []);
    } catch (e) { }
  };

  const sendQuickReply = async (qr: QuickReply) => {
    // Implementation...
    setShowQuickReplies(false);
  };

  const filteredContacts = contacts.filter(c => {
    if (searchQuery === 'individual:') return !c.jid.endsWith('@g.us');
    if (searchQuery === 'group:') return c.jid.endsWith('@g.us');
    if (!searchQuery) return true;
    return (c.name || c.pushName || c.phoneNumber).toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (loading) return <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh"><CircularProgress /></Box>;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', bgcolor: 'background.default' }}>
      {/* Sidebar */}
      <Paper sx={{ width: 350, display: 'flex', flexDirection: 'column', borderRadius: 0 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <FormControl fullWidth size="small">
            <InputLabel>الجلسة</InputLabel>
            <Select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)} label="الجلسة">
              {sessions.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ p: 2 }}>
          <TextField fullWidth size="small" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
        </Box>
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {filteredContacts.map(contact => (
            <ListItem key={contact.id} button selected={selectedContact?.id === contact.id} onClick={() => setSelectedContact(contact)} onContextMenu={(e) => { e.preventDefault(); setChatMenuAnchor(e.currentTarget); setSelectedChatForMenu(contact); }}>
              <ListItemAvatar>
                <Badge badgeContent={contact.unreadCount} color="primary">
                  <Avatar src={contact.profilePicUrl || ''}>{(contact.name || contact.phoneNumber)[0]}</Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText primary={contact.name || contact.pushName || contact.phoneNumber} secondary={contact.lastMessage?.content || '...'} />
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
                <Typography variant="subtitle1">{selectedContact.name || selectedContact.phoneNumber}</Typography>
              </Box>
              <Box>
                <IconButton onClick={() => setShowContactInfo(true)}><InfoIcon /></IconButton>
              </Box>
            </Paper>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#e5ddd5', backgroundImage: 'url(/whatsapp-bg.png)' }}>
              {messages.map((message, index) => (
                <Box key={message.id} sx={{ display: 'flex', justifyContent: message.fromMe ? 'flex-end' : 'flex-start', mb: 1 }}>
                  <Paper sx={{ p: 1, maxWidth: '70%', bgcolor: message.fromMe ? '#d9fdd3' : '#fff' }}>
                    {message.mediaUrl && (
                      message.messageType === 'AUDIO' ? <audio src={message.mediaUrl} controls /> :
                        message.messageType === 'IMAGE' ? <img src={message.mediaUrl} style={{ maxWidth: '100%' }} /> :
                          <Typography>Media: {message.messageType}</Typography>
                    )}
                    <Typography>{message.content}</Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{format(new Date(message.timestamp), 'HH:mm')}</Typography>
                      {message.fromMe && getStatusIcon(message.status)}
                    </Box>
                  </Paper>
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Box>

            <Paper sx={{ p: 2, borderRadius: 0 }}>
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
        <MenuItem onClick={() => { if (selectedChatForMenu) handleDeleteChat(selectedChatForMenu); setChatMenuAnchor(null); }} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> حذف المحادثة
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default WhatsAppChat;
