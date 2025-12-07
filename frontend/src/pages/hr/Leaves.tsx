import React, { useState, useEffect } from 'react';
import { 
  Calendar, Plus, Check, X,
  Clock, ChevronLeft, ChevronRight, Download, Eye,
  Palmtree, Stethoscope, Baby, Heart, GraduationCap, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';
import { toast } from 'sonner';

interface LeaveRequest {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string;
  reason: string;
  createdAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string;
    department: { name: string } | null;
  };
  approver: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

const leaveTypeConfig: Record<string, { label: string; icon: any; color: string }> = {
  ANNUAL: { label: 'سنوية', icon: Palmtree, color: 'bg-green-100 text-green-800' },
  SICK: { label: 'مرضية', icon: Stethoscope, color: 'bg-red-100 text-red-800' },
  UNPAID: { label: 'بدون راتب', icon: Calendar, color: 'bg-gray-100 text-gray-800' },
  MATERNITY: { label: 'أمومة', icon: Baby, color: 'bg-pink-100 text-pink-800' },
  PATERNITY: { label: 'أبوة', icon: Baby, color: 'bg-blue-100 text-blue-800' },
  BEREAVEMENT: { label: 'عزاء', icon: Heart, color: 'bg-purple-100 text-purple-800' },
  MARRIAGE: { label: 'زواج', icon: Heart, color: 'bg-rose-100 text-rose-800' },
  HAJJ: { label: 'حج', icon: Calendar, color: 'bg-amber-100 text-amber-800' },
  STUDY: { label: 'دراسية', icon: GraduationCap, color: 'bg-indigo-100 text-indigo-800' },
  EMERGENCY: { label: 'طارئة', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  OTHER: { label: 'أخرى', icon: Calendar, color: 'bg-slate-100 text-slate-800' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'موافق عليه', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'مرفوض', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'ملغي', color: 'bg-gray-100 text-gray-800' },
};

const Leaves: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'ANNUAL',
    startDate: '',
    endDate: '',
    reason: '',
    isHalfDay: false,
    halfDayPeriod: ''
  });

  useEffect(() => {
    fetchLeaveRequests();
  }, [pagination.page, statusFilter, typeFilter, activeTab]);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (activeTab === 'pending') {
        params.append('status', 'PENDING');
      } else if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);

      const response = await api.get(`/hr/leaves?${params}`);
      setRequests(response.data.requests);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      toast.error('حدث خطأ أثناء جلب طلبات الإجازات');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await api.post(`/hr/leaves/${requestId}/approve`);
      toast.success('تمت الموافقة على الطلب');
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    try {
      await api.post(`/hr/leaves/${selectedRequest.id}/reject`, {
        reason: rejectionReason
      });
      toast.success('تم رفض الطلب');
      setShowRejectDialog(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const handleAddRequest = async () => {
    try {
      await api.post('/hr/leaves', formData);
      toast.success('تم إنشاء طلب الإجازة بنجاح');
      setShowAddDialog(false);
      resetForm();
      fetchLeaveRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      type: 'ANNUAL',
      startDate: '',
      endDate: '',
      reason: '',
      isHalfDay: false,
      halfDayPeriod: ''
    });
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            إدارة الإجازات
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {pagination.total} طلب إجازة
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="h-4 w-4 ml-2" />
            تصدير
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 ml-2" />
            طلب إجازة جديد
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">قيد الانتظار</p>
                <h3 className="text-3xl font-bold mt-1">{pendingCount}</h3>
              </div>
              <Clock className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">موافق عليها</p>
                <h3 className="text-3xl font-bold mt-1 text-green-600">
                  {requests.filter(r => r.status === 'APPROVED').length}
                </h3>
              </div>
              <Check className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">مرفوضة</p>
                <h3 className="text-3xl font-bold mt-1 text-red-600">
                  {requests.filter(r => r.status === 'REJECTED').length}
                </h3>
              </div>
              <X className="h-10 w-10 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي الأيام</p>
                <h3 className="text-3xl font-bold mt-1 text-blue-600">
                  {requests.filter(r => r.status === 'APPROVED').reduce((sum, r) => sum + r.totalDays, 0)}
                </h3>
              </div>
              <Calendar className="h-10 w-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <Card>
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <TabsList>
                <TabsTrigger value="all">الكل</TabsTrigger>
                <TabsTrigger value="pending" className="relative">
                  قيد الانتظار
                  {pendingCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500">
                      {pendingCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex gap-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="نوع الإجازة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(leaveTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeTab === 'all' && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {Object.entries(statusConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Leave Requests Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Calendar className="h-12 w-12 mb-4 opacity-50" />
              <p>لا توجد طلبات إجازات</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">نوع الإجازة</TableHead>
                  <TableHead className="text-right">من</TableHead>
                  <TableHead className="text-right">إلى</TableHead>
                  <TableHead className="text-right">المدة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const typeConfig = leaveTypeConfig[request.type] || leaveTypeConfig.OTHER;
                  const TypeIcon = typeConfig.icon;
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={request.employee?.avatar} />
                            <AvatarFallback>
                              {request.employee?.firstName?.[0]}{request.employee?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {request.employee?.firstName} {request.employee?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {request.employee?.department?.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeConfig.color}>
                          <TypeIcon className="h-3 w-3 ml-1" />
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(request.startDate).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell>
                        {new Date(request.endDate).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{request.totalDays}</span> يوم
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[request.status]?.color || ''}>
                          {statusConfig[request.status]?.label || request.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {request.status === 'PENDING' && (
                            <>
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => handleApprove(request.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setShowRejectDialog(true);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              عرض {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Leave Request Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلب إجازة جديد</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>نوع الإجازة</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(leaveTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>من تاريخ</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>إلى تاريخ</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>السبب</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="سبب طلب الإجازة..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddRequest}>
              إرسال الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تفاصيل طلب الإجازة</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedRequest.employee?.avatar} />
                  <AvatarFallback>
                    {selectedRequest.employee?.firstName?.[0]}{selectedRequest.employee?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedRequest.employee?.firstName} {selectedRequest.employee?.lastName}
                  </h3>
                  <p className="text-gray-500">{selectedRequest.employee?.department?.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">نوع الإجازة</Label>
                  <p className="font-medium">{leaveTypeConfig[selectedRequest.type]?.label}</p>
                </div>
                <div>
                  <Label className="text-gray-500">الحالة</Label>
                  <Badge className={statusConfig[selectedRequest.status]?.color || ''}>
                    {statusConfig[selectedRequest.status]?.label || selectedRequest.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-gray-500">من</Label>
                  <p className="font-medium">{new Date(selectedRequest.startDate).toLocaleDateString('ar-EG')}</p>
                </div>
                <div>
                  <Label className="text-gray-500">إلى</Label>
                  <p className="font-medium">{new Date(selectedRequest.endDate).toLocaleDateString('ar-EG')}</p>
                </div>
                <div>
                  <Label className="text-gray-500">المدة</Label>
                  <p className="font-medium">{selectedRequest.totalDays} يوم</p>
                </div>
                <div>
                  <Label className="text-gray-500">تاريخ الطلب</Label>
                  <p className="font-medium">{new Date(selectedRequest.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <Label className="text-gray-500">السبب</Label>
                  <p className="mt-1">{selectedRequest.reason}</p>
                </div>
              )}

              {selectedRequest.rejectionReason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <Label className="text-red-600">سبب الرفض</Label>
                  <p className="mt-1 text-red-700">{selectedRequest.rejectionReason}</p>
                </div>
              )}

              {selectedRequest.approver && (
                <div>
                  <Label className="text-gray-500">تمت المراجعة بواسطة</Label>
                  <p className="font-medium">
                    {selectedRequest.approver.firstName} {selectedRequest.approver.lastName}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض طلب الإجازة</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p>هل أنت متأكد من رفض طلب الإجازة؟</p>
            <div className="space-y-2">
              <Label>سبب الرفض</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="أدخل سبب الرفض..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              رفض الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leaves;
