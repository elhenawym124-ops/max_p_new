import { buildApiUrl } from '../utils/urlHelper';

export interface TestConversation {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  isOnline?: boolean;
  platform: 'test';
  messages: TestMessage[];
  aiEnabled?: boolean;
  pageName?: string;
  pageId?: string | null;
}

export interface TestMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  isFromCustomer: boolean;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  conversationId: string;
  isAiGenerated?: boolean;
}

export interface AITestResponse {
  content: string | null;
  intent?: string;
  sentiment?: string;
  confidence?: number;
  processingTime?: number;
  model?: string;
  keyId?: string;
  silent?: boolean;
  error?: string;
}

export interface SendMessageResponse {
  userMessage: TestMessage;
  aiMessage: TestMessage | null;
  aiResponse: AITestResponse | null;
}

class TestChatService {
  private getAuthToken(): string | null {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
  }

  private getHeaders(): HeadersInit {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * جلب قائمة محادثات الاختبار
   */
  async getConversations(): Promise<{ data: TestConversation[]; pagination: any }> {
    const response = await fetch(buildApiUrl('test-chat/conversations'), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch conversations');
    }

    const result = await response.json();
    return result;
  }

  /**
   * إنشاء محادثة اختبار جديدة
   */
  async createConversation(): Promise<TestConversation> {
    const response = await fetch(buildApiUrl('test-chat/conversations'), {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create conversation');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * جلب رسائل محادثة
   */
  async getMessages(conversationId: string): Promise<TestMessage[]> {
    const response = await fetch(
      buildApiUrl(`test-chat/conversations/${conversationId}/messages`),
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch messages');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * إرسال رسالة
   */
  async sendMessage(
    conversationId: string,
    message: string
  ): Promise<SendMessageResponse> {
    const response = await fetch(
      buildApiUrl(`test-chat/conversations/${conversationId}/messages`),
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ message }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * حذف محادثة
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(
      buildApiUrl(`test-chat/conversations/${conversationId}`),
      {
        method: 'DELETE',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete conversation');
    }
  }

  /**
   * جلب معلومات شركة التسويق
   */
  async getMarketingCompanyInfo(): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/marketing-company/info'), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch company info');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * جلب منتجات شركة التسويق
   */
  async getMarketingCompanyProducts(options?: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    isActive?: boolean;
  }): Promise<{
    data: any[];
    pagination: any;
    stats: any;
  }> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.categoryId) params.append('categoryId', options.categoryId);
    if (options?.search) params.append('search', options.search);
    if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString());

    const url = buildApiUrl(`test-chat/marketing-company/products${params.toString() ? `?${params.toString()}` : ''}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch products');
    }

    const result = await response.json();
    return result;
  }

  /**
   * جلب أسئلة الاختبار
   */
  async getTestQuestions(includeProducts: boolean = false): Promise<any> {
    const url = buildApiUrl(`test-chat/test-questions${includeProducts ? '?includeProducts=true' : ''}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch test questions');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * إرسال رسائل اختبار
   */
  async sendTestMessages(
    conversationId: string,
    options?: {
      questions?: any[];
      intent?: string;
      difficulty?: string;
      delayBetweenMessages?: number;
      stopOnError?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/send-test-messages'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        conversationId,
        questions: options?.questions,
        intent: options?.intent,
        difficulty: options?.difficulty,
        options: {
          delayBetweenMessages: options?.delayBetweenMessages,
          stopOnError: options?.stopOnError,
          maxConcurrent: options?.maxConcurrent
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send test messages');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * جلب نتائج الاختبار
   */
  async getTestResults(conversationId: string): Promise<any> {
    const response = await fetch(
      buildApiUrl(`test-chat/test-results/${conversationId}`),
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch test results');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * تشغيل اختبار سريع
   */
  async runQuickTest(options?: {
    intent?: string;
    difficulty?: string;
    questionCount?: number;
  }): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/run-quick-test'), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        intent: options?.intent,
        difficulty: options?.difficulty,
        questionCount: options?.questionCount || 8
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to run quick test');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * تشغيل تحليل شامل مع إصلاح المشاكل
   */
  async analyzeAndFix(): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/analyze-and-fix'), {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to run analysis');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * تحليل نتائج الاختبارات السابقة
   */
  async analyzeResults(): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/analyze-results'), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze results');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * تشغيل الاختبار وتحليل النتائج مباشرة
   */
  async runTestAndAnalyze(): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/run-test-and-analyze'), {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to run test and analyze');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * جلب المشاكل والحلول
   */
  async getProblems(): Promise<any> {
    const response = await fetch(buildApiUrl('test-chat/get-problems'), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get problems');
    }

    const result = await response.json();
    return result.data;
  }
}

export const testChatService = new TestChatService();

