import React, { useState, useEffect } from 'react';
import {
  Clock, UserCheck, Calendar, Download,
  ChevronLeft, ChevronRight, Monitor,
  AlertCircle, CheckCircle, XCircle, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import api from '@/services/api';
import { toast } from 'sonner';

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  workHours: number | null;
  overtimeHours: number | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string;
    employeeNumber: string;
    department: { name: string } | null;
  };
}

interface TodayStats {
  date: string;
  totalEmployees: number;
  present: number;
  late: number;
  absent: number;
  records: AttendanceRecord[];
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  PRESENT: { label: 'حاضر', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  ABSENT: { label: 'غائب', color: 'bg-red-100 text-red-800', icon: XCircle },
  LATE: { label: 'متأخر', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  HALF_DAY: { label: 'نصف يوم', color: 'bg-blue-100 text-blue-800', icon: Timer },
  ON_LEAVE: { label: 'إجازة', color: 'bg-purple-100 text-purple-800', icon: Calendar },
  HOLIDAY: { label: 'عطلة', color: 'bg-gray-100 text-gray-800', icon: Calendar },
  WEEKEND: { label: 'عطلة أسبوعية', color: 'bg-gray-100 text-gray-800', icon: Calendar },
  REMOTE: { label: 'عن بُعد', color: 'bg-indigo-100 text-indigo-800', icon: Monitor },
};

const Attendance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeId] = useState('');

  // Dialog states
  const [showManualDialog, setShowManualDialog] = useState(false);

  // Manual attendance form
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    checkIn: '09:00',
    checkOut: '17:00',
    status: 'PRESENT',
    notes: ''
  });

  useEffect(() => {
    fetchTodayStats();
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [pagination.page, selectedDate, statusFilter, employeeId]);

  const fetchTodayStats = async () => {
    try {
      const response = await api.get('/hr/attendance/today');
      setTodayStats(response.data);
    } catch (error) {
      console.error('Error fetching today stats:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        startDate: selectedDate,
        endDate: selectedDate,
      });

      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (employeeId) params.append('employeeId', employeeId);

      const response = await api.get(`/hr/attendance?${params}`);
      setRecords(response.data.records);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('حدث خطأ أثناء جلب سجل الحضور');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (empId: string) => {
    try {
      await api.post('/hr/attendance/check-in', {
        employeeId: empId,
        method: 'manual'
      });
      toast.success('تم تسجيل الحضور بنجاح');
      fetchTodayStats();
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء تسجيل الحضور');
    }
  };

  const handleCheckOut = async (empId: string) => {
    try {
      await api.post('/hr/attendance/check-out', {
        employeeId: empId,
        method: 'manual'
      });
      toast.success('تم تسجيل الانصراف بنجاح');
      fetchTodayStats();
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء تسجيل الانصراف');
    }
  };

  const handleManualAttendance = async () => {
    try {
      await api.post('/hr/attendance/manual', manualForm);
      toast.success('تم إنشاء سجل الحضور بنجاح');
      setShowManualDialog(false);
      fetchAttendance();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ');
    }
  };

  const attendanceRate = todayStats
    ? Math.round((todayStats.present / todayStats.totalEmployees) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            الحضور والانصراف
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {new Date(selectedDate).toLocaleDateString('ar-EG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowManualDialog(true)}>
            <Clock className="h-4 w-4 ml-2" />
            تسجيل يدوي
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 ml-2" />
            تصدير
          </Button>
        </div>
      </div>

      {/* Today Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">إجمالي الموظفين</p>
                <h3 className="text-3xl font-bold mt-1">{todayStats?.totalEmployees || 0}</h3>
              </div>
              <UserCheck className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">حاضر</p>
                <h3 className="text-3xl font-bold mt-1">{todayStats?.present || 0}</h3>
              </div>
              <CheckCircle className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">متأخر</p>
                <h3 className="text-3xl font-bold mt-1">{todayStats?.late || 0}</h3>
              </div>
              <AlertCircle className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm">غائب</p>
                <h3 className="text-3xl font-bold mt-1">{todayStats?.absent || 0}</h3>
              </div>
              <XCircle className="h-10 w-10 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Rate */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">نسبة الحضور اليوم</h3>
            <span className="text-2xl font-bold text-primary">{attendanceRate}%</span>
          </div>
          <Progress value={attendanceRate} className="h-3" />
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">الكل</SelectItem>
                <SelectItem value="PRESENT">حاضر</SelectItem>
                <SelectItem value="LATE">متأخر</SelectItem>
                <SelectItem value="ABSENT">غائب</SelectItem>
                <SelectItem value="ON_LEAVE">إجازة</SelectItem>
                <SelectItem value="REMOTE">عن بُعد</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSelectedDate(new Date().toISOString().split('T')[0]);
                setStatusFilter('');
              }}
            >
              إعادة تعيين
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>سجل الحضور</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Clock className="h-12 w-12 mb-4 opacity-50" />
              <p>لا توجد سجلات حضور</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الموظف</TableHead>
                  <TableHead className="text-right">القسم</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">الانصراف</TableHead>
                  <TableHead className="text-right">ساعات العمل</TableHead>
                  <TableHead className="text-right">التأخير</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const StatusIcon = statusConfig[record.status]?.icon || Clock;
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={record.employee?.avatar} />
                            <AvatarFallback>
                              {record.employee?.firstName?.[0]}{record.employee?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {record.employee?.firstName} {record.employee?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {record.employee?.employeeNumber}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.employee?.department?.name || '-'}
                      </TableCell>
                      <TableCell>
                        {record.checkIn ? (
                          <span className="text-green-600 font-medium">
                            {new Date(record.checkIn).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.checkOut ? (
                          <span className="text-blue-600 font-medium">
                            {new Date(record.checkOut).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.workHours ? (
                          <span>{record.workHours.toFixed(1)} ساعة</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.lateMinutes && record.lateMinutes > 0 ? (
                          <span className="text-red-600">{record.lateMinutes} دقيقة</span>
                        ) : (
                          <span className="text-green-600">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[record.status]?.color || ''}>
                          <StatusIcon className="h-3 w-3 ml-1" />
                          {statusConfig[record.status]?.label || record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!record.checkIn && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckIn(record.employee.id)}
                            >
                              تسجيل حضور
                            </Button>
                          )}
                          {record.checkIn && !record.checkOut && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCheckOut(record.employee.id)}
                            >
                              تسجيل انصراف
                            </Button>
                          )}
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

      {/* Manual Attendance Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل حضور يدوي</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={manualForm.date}
                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>وقت الحضور</Label>
                <Input
                  type="time"
                  value={manualForm.checkIn}
                  onChange={(e) => setManualForm({ ...manualForm, checkIn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>وقت الانصراف</Label>
                <Input
                  type="time"
                  value={manualForm.checkOut}
                  onChange={(e) => setManualForm({ ...manualForm, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select
                value={manualForm.status}
                onValueChange={(value) => setManualForm({ ...manualForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENT">حاضر</SelectItem>
                  <SelectItem value="LATE">متأخر</SelectItem>
                  <SelectItem value="ABSENT">غائب</SelectItem>
                  <SelectItem value="REMOTE">عن بُعد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleManualAttendance}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendance;
