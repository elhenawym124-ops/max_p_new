import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Paperclip,
  X,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  MessageSquare,
  User,
  Shield
} from 'lucide-react';
import supportService, { Ticket, AttachmentFile } from '../../services/supportService';

const TicketDetails: React.FC = () => {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageContent, setMessageContent] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetails();
    }
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      const data = await supportService.getTicketDetails(ticketId!);

      if (data.success) {
        setTicket(data.ticket);
        // Show rating form if ticket is closed and not rated yet
        if (data.ticket.status === 'closed' && !data.ticket.rating) {
          setShowRating(true);
        }
      } else {
        setError('التذكرة غير موجودة');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'حدث خطأ في جلب تفاصيل التذكرة');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFiles = 5;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (attachments.length + files.length > maxFiles) {
      setError(`يمكنك رفع ${maxFiles} ملفات كحد أقصى`);
      return;
    }

    const validFiles: AttachmentFile[] = [];

    files.forEach(file => {
      if (file.size > maxSize) {
        setError(`حجم الملف ${file.name} كبير جداً (الحد الأقصى 10 ميجابايت)`);
        return;
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

      if (!allowedTypes.includes(file.type)) {
        setError(`نوع الملف ${file.name} غير مسموح`);
        return;
      }

      const attachmentFile: AttachmentFile = { file };

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          attachmentFile.preview = e.target?.result as string;
          setAttachments(prev => [...prev, attachmentFile]);
        };
        reader.readAsDataURL(file);
      } else {
        validFiles.push(attachmentFile);
      }
    });

    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }

    // Clear the input
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageContent.trim() && attachments.length === 0) {
      setError('يجب كتابة رسالة أو إرفاق ملف');
      return;
    }

    setSendingMessage(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('content', messageContent);

      // Add attachments
      attachments.forEach(attachment => {
        formData.append('attachments', attachment.file);
      });

      const data = await supportService.addMessage(ticketId!, formData);

      if (data.success) {
        setTicket(data.ticket);
        setMessageContent('');
        setAttachments([]);
      } else {
        setError(data.message || 'حدث خطأ في إرسال الرسالة');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'حدث خطأ في إرسال الرسالة');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleRatingSubmit = async () => {
    if (rating === 0) {
      setError('يرجى اختيار تقييم');
      return;
    }

    setSubmittingRating(true);
    setError('');

    try {
      const data = await supportService.rateTicket(ticketId!, {
        rating,
        feedback
      });

      if (data.success) {
        setTicket(data.ticket);
        setShowRating(false);
      } else {
        setError(data.message || 'حدث خطأ في تقييم الخدمة');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'حدث خطأ في تقييم الخدمة');
    } finally {
      setSubmittingRating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="w-5 h-5 text-orange-500" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'closed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'مفتوح';
      case 'in_progress':
        return 'قيد المعالجة';
      case 'closed':
        return 'مغلق';
      default:
        return status;
    }
  };

  const getCategoryText = (category: string) => {
    const categories: { [key: string]: string } = {
      'technical': 'تقني',
      'billing': 'فواتير',
      'inquiry': 'استفسار',
      'suggestion': 'اقتراح',
      'complaint': 'شكوى'
    };
    return categories[category] || category;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">خطأ</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/support/tickets')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            العودة إلى التذاكر
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/support/tickets')}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة إلى التذاكر
          </button>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {ticket.subject}
                </h1>
                <div className="flex items-center space-x-4 space-x-reverse text-sm text-gray-600">
                  <span>#{ticket.ticketId}</span>
                  <span>•</span>
                  <span>{getCategoryText(ticket.category)}</span>
                  <span>•</span>
                  <span>{new Date(ticket.createdAt).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>
              <div className="flex items-center">
                {getStatusIcon(ticket.status)}
                <span className="mr-2 font-medium">
                  {getStatusText(ticket.status)}
                </span>
              </div>
            </div>

            {ticket.status === 'closed' && ticket.resolvedAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-500 ml-2" />
                  <span className="text-green-800">
                    تم حل التذكرة في {new Date(ticket.resolvedAt).toLocaleDateString('ar-EG')}
                  </span>
                </div>
                {ticket.rating && (
                  <div className="mt-2 flex items-center">
                    <span className="text-green-700 ml-2">التقييم:</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= ticket.rating!
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <MessageSquare className="w-5 h-5 ml-2" />
              المحادثة ({ticket.messages.length})
            </h2>
          </div>

          <div className="max-h-96 overflow-y-auto p-6 space-y-6">
            {ticket.messages.map((message, index) => (
              <div
                key={message._id}
                className={`flex ${message.senderType === 'user' ? 'justify-end' : 'justify-start'
                  }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${message.senderType === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                    }`}
                >
                  <div className="flex items-center mb-2">
                    {message.senderType === 'admin' ? (
                      <Shield className="w-4 h-4 ml-1 text-blue-600" />
                    ) : (
                      <User className="w-4 h-4 ml-1" />
                    )}
                    <span className="text-xs font-medium">
                      {message.senderType === 'admin' ? 'فريق الدعم' : message.sender.name}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed mb-2">
                    {message.content}
                  </p>

                  {message.attachments.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {message.attachments.map((attachment, attachIndex) => (
                        <div key={attachIndex} className="flex items-center">
                          {attachment.mimetype.startsWith('image/') ? (
                            <img
                              src={attachment.url}
                              alt={attachment.originalName}
                              className="max-w-full h-32 object-cover rounded cursor-pointer"
                              onClick={() => window.open(attachment.url, '_blank')}
                            />
                          ) : (
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-xs hover:underline"
                            >
                              <Download className="w-3 h-3 ml-1" />
                              {attachment.originalName} ({formatFileSize(attachment.size)})
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-xs opacity-75">
                    {new Date(message.createdAt).toLocaleString('ar-EG')}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply Form */}
        {ticket.status !== 'closed' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              إضافة رد
            </h3>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 ml-3" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="space-y-4">
              <textarea
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                placeholder="اكتب ردك هنا..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />

              {/* File Upload */}
              <div>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="message-file-upload"
                />
                <label
                  htmlFor="message-file-upload"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <Paperclip className="w-4 h-4 ml-2" />
                  إرفاق ملفات
                </label>
              </div>

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center">
                        {attachment.preview ? (
                          <img
                            src={attachment.preview}
                            alt="Preview"
                            className="w-8 h-8 object-cover rounded mr-3"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center mr-3">
                            <Paperclip className="w-3 h-3 text-gray-500" />
                          </div>
                        )}
                        <span className="text-sm text-gray-900">
                          {attachment.file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingMessage || (!messageContent.trim() && attachments.length === 0)}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendingMessage ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 ml-2" />
                      إرسال
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rating Form */}
        {showRating && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              تقييم الخدمة
            </h3>
            <p className="text-gray-600 mb-4">
              نرجو منك تقييم جودة الدعم المقدم لك
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  التقييم *
                </label>
                <div className="flex space-x-1 space-x-reverse">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-1 ${star <= rating
                          ? 'text-yellow-400'
                          : 'text-gray-300 hover:text-yellow-400'
                        }`}
                    >
                      <Star className="w-6 h-6 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات إضافية (اختياري)
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="شاركنا رأيك حول الخدمة المقدمة..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end space-x-4 space-x-reverse">
                <button
                  onClick={() => setShowRating(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  تخطي
                </button>
                <button
                  onClick={handleRatingSubmit}
                  disabled={submittingRating || rating === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingRating ? 'جاري الحفظ...' : 'إرسال التقييم'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetails;
