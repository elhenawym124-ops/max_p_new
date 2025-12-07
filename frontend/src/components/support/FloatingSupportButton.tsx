import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  MessageCircle, 
  X, 
  HelpCircle, 
  Ticket, 
  Plus,
  BookOpen,
  ChevronUp
} from 'lucide-react';
import axios from 'axios';

// Get token for API calls
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface TicketCount {
  open: number;
  inProgress: number;
}

const FloatingSupportButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketCount, setTicketCount] = useState<TicketCount>({ open: 0, inProgress: 0 });
  const [hasUnread, setHasUnread] = useState(false);
  const location = useLocation();

  // Don't show on support pages
  const isSupportPage = location.pathname.startsWith('/support') || location.pathname.startsWith('/admin/support');

  useEffect(() => {
    fetchTicketCount();
    // Refresh every 5 minutes
    const interval = setInterval(fetchTicketCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTicketCount = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get('/api/v1/support/tickets?limit=1', { headers: getAuthHeaders() });
      
      if (response.data.success) {
        // Check if there are any open or in-progress tickets
        const tickets = response.data.tickets || [];
        const openCount = tickets.filter((t: any) => t.status === 'open').length;
        const inProgressCount = tickets.filter((t: any) => t.status === 'in_progress').length;
        
        setTicketCount({ open: openCount, inProgress: inProgressCount });
        setHasUnread(response.data.pagination?.total > 0);
      }
    } catch (error) {
      // Silently fail - user might not be logged in
    }
  };

  if (isSupportPage) return null;

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 left-6 z-50">
        {/* Menu */}
        {isOpen && (
          <div className="absolute bottom-16 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-72 animate-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  <span className="font-semibold">مركز الدعم</span>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-blue-100 text-sm mt-1">كيف يمكننا مساعدتك؟</p>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <Link
                to="/support"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="bg-blue-100 p-2 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">مركز الدعم</span>
                  <p className="text-xs text-gray-500">تصفح المساعدة والأسئلة الشائعة</p>
                </div>
              </Link>

              <Link
                to="/support/tickets/new"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="bg-green-100 p-2 rounded-lg group-hover:bg-green-200 transition-colors">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">تذكرة جديدة</span>
                  <p className="text-xs text-gray-500">أرسل استفسار أو مشكلة</p>
                </div>
              </Link>

              <Link
                to="/support/tickets"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="bg-orange-100 p-2 rounded-lg group-hover:bg-orange-200 transition-colors relative">
                  <Ticket className="w-5 h-5 text-orange-600" />
                  {hasUnread && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">تذاكري</span>
                    {hasUnread && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                        جديد
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">متابعة التذاكر السابقة</p>
                </div>
              </Link>

              <Link
                to="/support/faq"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <div className="bg-purple-100 p-2 rounded-lg group-hover:bg-purple-200 transition-colors">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <span className="font-medium text-gray-900">الأسئلة الشائعة</span>
                  <p className="text-xs text-gray-500">إجابات سريعة لأسئلتك</p>
                </div>
              </Link>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 p-3 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                نحن هنا لمساعدتك على مدار الساعة
              </p>
            </div>
          </div>
        )}

        {/* Main Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg
            transition-all duration-300 transform hover:scale-110
            ${isOpen 
              ? 'bg-gray-700 hover:bg-gray-800' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
            }
          `}
        >
          {isOpen ? (
            <ChevronUp className="w-6 h-6 text-white" />
          ) : (
            <>
              <MessageCircle className="w-6 h-6 text-white" />
              {hasUnread && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-[10px] text-white font-bold">!</span>
                </span>
              )}
            </>
          )}
        </button>

        {/* Pulse animation when has unread */}
        {hasUnread && !isOpen && (
          <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-30"></span>
        )}
      </div>
    </>
  );
};

export default FloatingSupportButton;
