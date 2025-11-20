import { io, Socket } from 'socket.io-client';
import { buildWsUrl } from '../utils/urlHelper';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file' | 'voice';
  isFromCustomer: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  conversationId: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  voiceDuration?: number;
  repliedBy?: string;
}

interface Conversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  customerEmail?: string;
  customerPhone?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline?: boolean;
  platform: 'facebook' | 'whatsapp' | 'telegram' | 'unknown';
  status: 'new' | 'active' | 'archived' | 'important';
  messages: Message[];
  customerOrders?: any[];
  lastRepliedBy?: string;
}

interface SocketEvents {
  'connect': () => void;
  'disconnect': (reason: string) => void;
  'message:new': (message: Message) => void;
  'message:delivered': (data: { messageId: string; conversationId: string }) => void;
  'message:read': (data: { messageId: string; conversationId: string }) => void;
  'typing:start': (data: { conversationId: string; userId: string; userName: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  'user:online': (data: { userId: string }) => void;
  'user:offline': (data: { userId: string }) => void;
  'conversation:updated': (conversation: Conversation) => void;
  'conversation:new': (conversation: Conversation) => void;
  'notification:new': (data: { message: Message; conversation: Conversation }) => void;
  'ai_typing': (data: { conversationId: string; isTyping: boolean; source?: string }) => void;
}

interface SocketEmitEvents {
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
  'message:send': (message: any) => void;
  'typing:start': (data: { conversationId: string; userId: string; userName: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  'message:read': (data: { messageId: string; conversationId: string }) => void;
  'message:delivered': (data: { messageId: string; conversationId: string }) => void;
  'user_join': (data: any) => void;
}

class SocketService {
  private socket: Socket<SocketEvents, SocketEmitEvents> | null = null;
  private baseURL = buildWsUrl();
  private audioContext: AudioContext | null = null;
  private isAudioInitialized: boolean = false;

  constructor() {
    // تهيئة Audio Context (سيتم تفعيله بعد أول user interaction)
    this.initAudioContext();
  }

  // تهيئة Audio Context
  private initAudioContext() {
    try {
      // @ts-ignore - للتوافق مع جميع المتصفحات
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        console.log('🔊 [SOUND] Audio context initialized');
      }
    } catch (error) {
      console.error('❌ [SOUND] Failed to initialize audio context:', error);
    }
  }

  // تشغيل صوت التنبيه باستخدام Web Audio API
  playNotificationSound() {
    try {
      if (!this.audioContext) {
        console.warn('⚠️ [SOUND] Audio context not available');
        return;
      }

      // تفعيل Audio Context إذا كان suspended (بسبب autoplay policy)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('🔊 [SOUND] Audio context resumed');
          this.playSoundInternal();
        }).catch((error) => {
          console.warn('⚠️ [SOUND] Could not resume audio context:', error);
        });
      } else {
        this.playSoundInternal();
      }
      
      this.isAudioInitialized = true;
    } catch (error) {
      console.error('❌ [SOUND] Error playing notification sound:', error);
    }
  }

  // تشغيل الصوت الداخلي
  private playSoundInternal() {
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // صوت تنبيه لطيف (نغمتين متتاليتين)
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);

      // مستوى الصوت
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);

      console.log('🔔 [SOUND] Notification sound played successfully');
    } catch (error) {
      console.error('❌ [SOUND] Error in playSoundInternal:', error);
    }
  }

  // تفعيل الصوت (يُستدعى بعد أول user interaction)
  enableSound() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('🔊 [SOUND] Audio context enabled by user interaction');
      }).catch((error) => {
        console.warn('⚠️ [SOUND] Failed to enable audio context:', error);
      });
    }
  }

  connect() {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(this.baseURL, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      
      // 🔐 إرسال معلومات المستخدم مع دعم عزل الشركات
      this.sendUserJoinEvent();
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  private sendUserJoinEvent() {
    const userId = localStorage.getItem('userId');
    const userDataStr = localStorage.getItem('user');
    
    if (userId && userDataStr && this.socket) {
      try {
        const userData = JSON.parse(userDataStr);
        const userJoinData = {
          userId: userId,
          userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || 'مستخدم',
          companyId: userData.companyId
        };
        
        console.log('🔌 [SOCKET-SERVICE] Sending user_join with company isolation:', userJoinData);
        this.socket.emit('user_join', userJoinData);
      } catch (error) {
        console.error('❌ [SOCKET-SERVICE] Error parsing user data:', error);
        // Fallback to basic user_join
        this.socket.emit('user_join', { userId });
      }
    } else {
      console.warn('⚠️ [SOCKET-SERVICE] No user data found for Socket.IO connection');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('join:conversation', conversationId);
    }
  }

  leaveConversation(conversationId: string) {
    if (this.socket) {
      this.socket.emit('leave:conversation', conversationId);
    }
  }

  sendMessage(message: Omit<Message, 'id' | 'timestamp' | 'status'>) {
    if (this.socket) {
      this.socket.emit('message:send', message);
    }
  }

  sendTyping(conversationId: string, userId: string, userName: string) {
    if (this.socket) {
      this.socket.emit('typing:start', { conversationId, userId, userName });
    }
  }

  stopTyping(conversationId: string, userId: string) {
    if (this.socket) {
      this.socket.emit('typing:stop', { conversationId, userId });
    }
  }

  markAsRead(messageId: string, conversationId: string) {
    if (this.socket) {
      this.socket.emit('message:read', { messageId, conversationId });
    }
  }

  markAsDelivered(messageId: string, conversationId: string) {
    if (this.socket) {
      this.socket.emit('message:delivered', { messageId, conversationId });
    }
  }

  onMessage(callback: (message: Message) => void) {
    if (this.socket) {
      this.socket.on('message:new', callback);
    }
  }

  onMessageDelivered(callback: (data: { messageId: string; conversationId: string }) => void) {
    if (this.socket) {
      this.socket.on('message:delivered', callback);
    }
  }

  onMessageRead(callback: (data: { messageId: string; conversationId: string }) => void) {
    if (this.socket) {
      this.socket.on('message:read', callback);
    }
  }

  onTypingStart(callback: (data: { conversationId: string; userId: string; userName: string }) => void) {
    if (this.socket) {
      this.socket.on('typing:start', callback);
    }
  }

  onTypingStop(callback: (data: { conversationId: string; userId: string }) => void) {
    if (this.socket) {
      this.socket.on('typing:stop', callback);
    }
  }

  onUserOnline(callback: (data: { userId: string }) => void) {
    if (this.socket) {
      this.socket.on('user:online', callback);
    }
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    if (this.socket) {
      this.socket.on('user:offline', callback);
    }
  }

  onConversationUpdated(callback: (conversation: Conversation) => void) {
    if (this.socket) {
      this.socket.on('conversation:updated', callback);
    }
  }

  onNewConversation(callback: (conversation: Conversation) => void) {
    if (this.socket) {
      this.socket.on('conversation:new', callback);
    }
  }

  onNotification(callback: (data: { message: Message; conversation: Conversation }) => void) {
    if (this.socket) {
      this.socket.on('notification:new', callback);
    }
  }

  // Listen to AI typing indicator events
  onAiTyping(callback: (data: { conversationId: string; isTyping: boolean; source?: string }) => void) {
    if (this.socket) {
      this.socket.on('ai_typing', callback);
    }
  }

  onCampaignProgress(callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on('campaign:progress', callback);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
export type { Message, Conversation };
