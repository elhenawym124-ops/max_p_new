import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Calendar,
  Tag
} from 'lucide-react';
import supportService, { Ticket } from '../../services/supportService';

const MyTickets: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const statusOptions = [
    { value: '', label: 'جميع الحالات' },
    { value: 'open', label: 'مفتوح' },
    { value: 'in_progress', label: 'قيد المعالجة' },
    { value: 'closed', label: 'مغلق' }
  ];

  const categoryOptions = [
    { value: '', label: 'جميع الأنواع' },
    { value: 'technical', label: 'تقني' },
    { value: 'billing', label: 'فواتير' },
    { value: 'inquiry', label: 'استفسار' },
    { value: 'suggestion', label: 'اقتراح' },
    { value: 'complaint', label: 'شكوى' }
  ];

  useEffect(() => {
    fetchTickets();
  }, [currentPage, statusFilter, categoryFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const data = await supportService.getUserTickets(params);

      if (data.success) {
        setTickets(data.tickets);
        setTotalPages(data.pagination.pages);
        setTotal(data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // Reset to first page when searching
    setCurrentPage(1);
    fetchTickets();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="w-4 h-4 text-orange-500" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
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

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-orange-100 text-orange-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'technical':
        return 'bg-red-100 text-red-800';
      case 'billing':
        return 'bg-yellow-100 text-yellow-800';
      case 'inquiry':
        return 'bg-blue-100 text-blue-800';
      case 'suggestion':
        return 'bg-green-100 text-green-800';
      case 'complaint':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/support')}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة إلى مركز الدعم
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                تذاكر الدعم الخاصة بي
              </h1>
              <p className="text-gray-600 mt-2">
                إجمالي {total} تذكرة
              </p>
            </div>
            <Link
              to="/support/tickets/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 ml-2" />
              تذكرة جديدة
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="البحث في التذاكر..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tickets List */}
        {tickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              لا توجد تذاكر دعم
            </h2>
            <p className="text-gray-600 mb-6">
              لم تقم بإنشاء أي تذاكر دعم بعد
            </p>
            <Link
              to="/support/tickets/new"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 ml-2" />
              إنشاء تذكرة جديدة
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <Link to={`/support/tickets/${ticket.ticketId}`} className="block p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 ml-3">
                          {ticket.subject}
                        </h3>
                        <span className="text-sm text-gray-500">
                          #{ticket.ticketId}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 space-x-reverse">
                        <div className="flex items-center">
                          {getStatusIcon(ticket.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium mr-2 ${getStatusBadgeColor(ticket.status)}`}>
                            {getStatusText(ticket.status)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Tag className="w-4 h-4 text-gray-400 ml-1" />
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryBadgeColor(ticket.category)}`}>
                            {getCategoryText(ticket.category)}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-500">
                          <MessageSquare className="w-4 h-4 ml-1" />
                          <span className="text-sm">
                            {ticket.messages.length} رسالة
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 ml-1" />
                      <span>
                        تم الإنشاء: {new Date(ticket.createdAt).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div>
                      آخر تحديث: {new Date(ticket.updatedAt).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 space-x-reverse mt-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              السابق
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg ${currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50'
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              التالي
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;
