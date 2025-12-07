import React, { useState, useEffect } from 'react';
import { 
  Users, Building2, Clock, Calendar, DollarSign, 
  TrendingUp, UserCheck, UserX, AlertCircle, 
  ChevronRight, BarChart3, PieChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

interface DashboardData {
  employees: {
    totalEmployees: number;
    activeEmployees: number;
    byDepartment: any[];
    byContractType: any[];
    byStatus: any[];
    recentHires: any[];
    upcomingBirthdays: any[];
  };
  attendance: {
    date: string;
    totalEmployees: number;
    present: number;
    late: number;
    absent: number;
    records: any[];
  };
  pendingLeaves: any[];
  departments: {
    totalDepartments: number;
    departments: any[];
  };
}

const HRDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/dashboard');
      setData(response.data.dashboard);
    } catch (error) {
      console.error('Error fetching HR dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const attendanceRate = data?.attendance 
    ? Math.round((data.attendance.present / data.attendance.totalEmployees) * 100) 
    : 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            الموارد البشرية
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            لوحة تحكم شاملة لإدارة الموظفين
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/hr/employees/new')}>
            <Users className="h-4 w-4 ml-2" />
            إضافة موظف
          </Button>
          <Button onClick={() => navigate('/hr/attendance')}>
            <Clock className="h-4 w-4 ml-2" />
            تسجيل الحضور
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">إجمالي الموظفين</p>
                <h3 className="text-3xl font-bold mt-1">
                  {data?.employees.totalEmployees || 0}
                </h3>
                <p className="text-blue-100 text-xs mt-2">
                  {data?.employees.activeEmployees || 0} نشط
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Users className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">الحضور اليوم</p>
                <h3 className="text-3xl font-bold mt-1">
                  {data?.attendance.present || 0}
                </h3>
                <p className="text-green-100 text-xs mt-2">
                  {attendanceRate}% نسبة الحضور
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <UserCheck className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">طلبات الإجازات</p>
                <h3 className="text-3xl font-bold mt-1">
                  {data?.pendingLeaves?.length || 0}
                </h3>
                <p className="text-orange-100 text-xs mt-2">
                  بانتظار الموافقة
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Calendar className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">الأقسام</p>
                <h3 className="text-3xl font-bold mt-1">
                  {data?.departments.totalDepartments || 0}
                </h3>
                <p className="text-purple-100 text-xs mt-2">
                  قسم نشط
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-full">
                <Building2 className="h-8 w-8" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              حضور اليوم
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/attendance')}>
              عرض الكل
              <ChevronRight className="h-4 w-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <UserCheck className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{data?.attendance.present || 0}</p>
                <p className="text-sm text-gray-500">حاضر</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{data?.attendance.late || 0}</p>
                <p className="text-sm text-gray-500">متأخر</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <UserX className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{data?.attendance.absent || 0}</p>
                <p className="text-sm text-gray-500">غائب</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>نسبة الحضور</span>
                <span className="font-medium">{attendanceRate}%</span>
              </div>
              <Progress value={attendanceRate} className="h-2" />
            </div>

            {/* Recent Check-ins */}
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-500 mb-3">آخر تسجيلات الحضور</h4>
              <div className="space-y-2">
                {data?.attendance.records?.slice(0, 5).map((record: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={record.employee?.avatar} />
                        <AvatarFallback>
                          {record.employee?.firstName?.[0]}{record.employee?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {record.employee?.firstName} {record.employee?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {record.employee?.department?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge variant={record.status === 'PRESENT' ? 'default' : 'destructive'}>
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Leaves */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              طلبات الإجازات
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/leaves')}>
              عرض الكل
              <ChevronRight className="h-4 w-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data?.pendingLeaves?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا توجد طلبات معلقة</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.pendingLeaves?.map((leave: any) => (
                  <div key={leave.id} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={leave.employee?.avatar} />
                        <AvatarFallback>
                          {leave.employee?.firstName?.[0]}{leave.employee?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {leave.employee?.firstName} {leave.employee?.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {leave.employee?.department?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline">{leave.type}</Badge>
                      <span className="text-gray-500">{leave.totalDays} يوم</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1" variant="default">
                        موافقة
                      </Button>
                      <Button size="sm" className="flex-1" variant="outline">
                        رفض
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Hires */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              أحدث التعيينات
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/employees')}>
              عرض الكل
              <ChevronRight className="h-4 w-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.employees.recentHires?.map((employee: any) => (
                <div key={employee.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={employee.avatar} />
                      <AvatarFallback>
                        {employee.firstName?.[0]}{employee.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                      <p className="text-sm text-gray-500">{employee.position?.title}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-gray-500">
                      {new Date(employee.hireDate).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Departments Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              الأقسام
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/hr/departments')}>
              عرض الكل
              <ChevronRight className="h-4 w-4 mr-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.departments.departments?.map((dept: any) => (
                <div key={dept.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: dept.color || '#3B82F6' }}
                    />
                    <span className="font-medium">{dept.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-lg font-bold">{dept.employeeCount}</p>
                      <p className="text-xs text-gray-500">موظف</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/employees')}
            >
              <Users className="h-6 w-6" />
              <span>الموظفين</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/departments')}
            >
              <Building2 className="h-6 w-6" />
              <span>الأقسام</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/attendance')}
            >
              <Clock className="h-6 w-6" />
              <span>الحضور</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/leaves')}
            >
              <Calendar className="h-6 w-6" />
              <span>الإجازات</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/payroll')}
            >
              <DollarSign className="h-6 w-6" />
              <span>الرواتب</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2"
              onClick={() => navigate('/hr/reports')}
            >
              <BarChart3 className="h-6 w-6" />
              <span>التقارير</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HRDashboard;
