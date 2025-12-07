import React, { useState, useEffect } from 'react';
import { 
  Settings, Clock, Calendar, DollarSign, Save, RefreshCw,
  Building2, Users, Bell, Shield, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import api from '@/services/api';
import { toast } from 'sonner';

interface HRSettingsData {
  // Working Hours
  workStartTime: string;
  workEndTime: string;
  breakDuration: number;
  workingDays: string[];
  
  // Leave Settings
  annualLeaveDefault: number;
  sickLeaveDefault: number;
  carryOverLimit: number;
  requireApproval: boolean;
  minAdvanceNotice: number;
  
  // Payroll Settings
  payrollDay: number;
  currency: string;
  taxRate: number;
  socialInsuranceRate: number;
  overtimeRate: number;
  
  // Attendance Settings
  allowRemoteCheckIn: boolean;
  requireLocation: boolean;
  lateThreshold: number;
  earlyLeaveThreshold: number;
  autoAbsentMarking: boolean;
  
  // Notifications
  notifyOnLeaveRequest: boolean;
  notifyOnAttendanceIssue: boolean;
  notifyOnPayrollGeneration: boolean;
  notifyManagers: boolean;
}

const defaultSettings: HRSettingsData = {
  workStartTime: '09:00',
  workEndTime: '17:00',
  breakDuration: 60,
  workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
  
  annualLeaveDefault: 21,
  sickLeaveDefault: 15,
  carryOverLimit: 5,
  requireApproval: true,
  minAdvanceNotice: 3,
  
  payrollDay: 25,
  currency: 'EGP',
  taxRate: 10,
  socialInsuranceRate: 14,
  overtimeRate: 1.5,
  
  allowRemoteCheckIn: true,
  requireLocation: false,
  lateThreshold: 15,
  earlyLeaveThreshold: 15,
  autoAbsentMarking: true,
  
  notifyOnLeaveRequest: true,
  notifyOnAttendanceIssue: true,
  notifyOnPayrollGeneration: true,
  notifyManagers: true,
};

const weekDays = [
  { value: 'saturday', label: 'السبت' },
  { value: 'sunday', label: 'الأحد' },
  { value: 'monday', label: 'الإثنين' },
  { value: 'tuesday', label: 'الثلاثاء' },
  { value: 'wednesday', label: 'الأربعاء' },
  { value: 'thursday', label: 'الخميس' },
  { value: 'friday', label: 'الجمعة' },
];

const HRSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<HRSettingsData>(defaultSettings);
  const [activeTab, setActiveTab] = useState('working-hours');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/settings');
      if (response.data.settings) {
        setSettings({ ...defaultSettings, ...response.data.settings });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Use defaults if no settings exist
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/hr/settings', settings);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (day: string) => {
    if (settings.workingDays.includes(day)) {
      setSettings({
        ...settings,
        workingDays: settings.workingDays.filter(d => d !== day)
      });
    } else {
      setSettings({
        ...settings,
        workingDays: [...settings.workingDays, day]
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            إعدادات الموارد البشرية
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            تكوين إعدادات نظام HR
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchSettings}>
            <RefreshCw className="h-4 w-4 ml-2" />
            إعادة تحميل
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 ml-2" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="working-hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            ساعات العمل
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            الإجازات
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            الرواتب
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            الحضور
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            الإشعارات
          </TabsTrigger>
        </TabsList>

        {/* Working Hours Tab */}
        <TabsContent value="working-hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ساعات العمل الرسمية</CardTitle>
              <CardDescription>تحديد أوقات بداية ونهاية العمل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>وقت بداية العمل</Label>
                  <Input
                    type="time"
                    value={settings.workStartTime}
                    onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>وقت نهاية العمل</Label>
                  <Input
                    type="time"
                    value={settings.workEndTime}
                    onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>مدة الاستراحة (بالدقائق)</Label>
                  <Input
                    type="number"
                    value={settings.breakDuration}
                    onChange={(e) => setSettings({ ...settings, breakDuration: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>أيام العمل</Label>
                <div className="flex flex-wrap gap-3">
                  {weekDays.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={settings.workingDays.includes(day.value) ? 'default' : 'outline'}
                      onClick={() => toggleWorkingDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الإجازات</CardTitle>
              <CardDescription>تكوين سياسات الإجازات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>رصيد الإجازة السنوية الافتراضي</Label>
                  <Input
                    type="number"
                    value={settings.annualLeaveDefault}
                    onChange={(e) => setSettings({ ...settings, annualLeaveDefault: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">يوم</p>
                </div>
                <div className="space-y-2">
                  <Label>رصيد الإجازة المرضية الافتراضي</Label>
                  <Input
                    type="number"
                    value={settings.sickLeaveDefault}
                    onChange={(e) => setSettings({ ...settings, sickLeaveDefault: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">يوم</p>
                </div>
                <div className="space-y-2">
                  <Label>حد الترحيل السنوي</Label>
                  <Input
                    type="number"
                    value={settings.carryOverLimit}
                    onChange={(e) => setSettings({ ...settings, carryOverLimit: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">يوم</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>الحد الأدنى للإشعار المسبق</Label>
                  <Input
                    type="number"
                    value={settings.minAdvanceNotice}
                    onChange={(e) => setSettings({ ...settings, minAdvanceNotice: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">يوم قبل الإجازة</p>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>طلب موافقة المدير</Label>
                    <p className="text-sm text-gray-500">يتطلب موافقة المدير على طلبات الإجازة</p>
                  </div>
                  <Switch
                    checked={settings.requireApproval}
                    onCheckedChange={(checked) => setSettings({ ...settings, requireApproval: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الرواتب</CardTitle>
              <CardDescription>تكوين حسابات الرواتب</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>يوم صرف الراتب</Label>
                  <Select
                    value={settings.payrollDay.toString()}
                    onValueChange={(value) => setSettings({ ...settings, payrollDay: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          يوم {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => setSettings({ ...settings, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                      <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                      <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>معدل العمل الإضافي</Label>
                  <Select
                    value={settings.overtimeRate.toString()}
                    onValueChange={(value) => setSettings({ ...settings, overtimeRate: parseFloat(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.25">1.25x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>نسبة الضريبة (%)</Label>
                  <Input
                    type="number"
                    value={settings.taxRate}
                    onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>نسبة التأمينات الاجتماعية (%)</Label>
                  <Input
                    type="number"
                    value={settings.socialInsuranceRate}
                    onChange={(e) => setSettings({ ...settings, socialInsuranceRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الحضور</CardTitle>
              <CardDescription>تكوين سياسات الحضور والانصراف</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>حد التأخير المسموح (بالدقائق)</Label>
                  <Input
                    type="number"
                    value={settings.lateThreshold}
                    onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">بعد هذا الوقت يُعتبر الموظف متأخراً</p>
                </div>
                <div className="space-y-2">
                  <Label>حد الانصراف المبكر (بالدقائق)</Label>
                  <Input
                    type="number"
                    value={settings.earlyLeaveThreshold}
                    onChange={(e) => setSettings({ ...settings, earlyLeaveThreshold: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-sm text-gray-500">قبل هذا الوقت يُعتبر انصراف مبكر</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>السماح بتسجيل الحضور عن بُعد</Label>
                    <p className="text-sm text-gray-500">يمكن للموظفين تسجيل الحضور من خارج المكتب</p>
                  </div>
                  <Switch
                    checked={settings.allowRemoteCheckIn}
                    onCheckedChange={(checked) => setSettings({ ...settings, allowRemoteCheckIn: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>طلب الموقع الجغرافي</Label>
                    <p className="text-sm text-gray-500">يتطلب تحديد الموقع عند تسجيل الحضور</p>
                  </div>
                  <Switch
                    checked={settings.requireLocation}
                    onCheckedChange={(checked) => setSettings({ ...settings, requireLocation: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label>تسجيل الغياب التلقائي</Label>
                    <p className="text-sm text-gray-500">تسجيل الموظفين كغائبين تلقائياً إذا لم يسجلوا حضورهم</p>
                  </div>
                  <Switch
                    checked={settings.autoAbsentMarking}
                    onCheckedChange={(checked) => setSettings({ ...settings, autoAbsentMarking: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الإشعارات</CardTitle>
              <CardDescription>تكوين إشعارات نظام HR</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>إشعار عند طلب إجازة جديد</Label>
                  <p className="text-sm text-gray-500">إرسال إشعار للمدير عند تقديم طلب إجازة</p>
                </div>
                <Switch
                  checked={settings.notifyOnLeaveRequest}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifyOnLeaveRequest: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>إشعار عند مشاكل الحضور</Label>
                  <p className="text-sm text-gray-500">إشعار عند التأخير أو الغياب</p>
                </div>
                <Switch
                  checked={settings.notifyOnAttendanceIssue}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifyOnAttendanceIssue: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>إشعار عند توليد الرواتب</Label>
                  <p className="text-sm text-gray-500">إشعار عند إنشاء كشوف الرواتب الشهرية</p>
                </div>
                <Switch
                  checked={settings.notifyOnPayrollGeneration}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifyOnPayrollGeneration: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>إشعار المدراء</Label>
                  <p className="text-sm text-gray-500">إرسال نسخة من الإشعارات لمدراء الأقسام</p>
                </div>
                <Switch
                  checked={settings.notifyManagers}
                  onCheckedChange={(checked) => setSettings({ ...settings, notifyManagers: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRSettings;
