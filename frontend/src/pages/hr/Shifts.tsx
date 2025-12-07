import React, { useState, useEffect } from 'react';
import { Clock, Plus, Calendar, Users, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { toast } from 'sonner';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  color: string;
  isActive: boolean;
}

const Shifts: React.FC = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    breakDuration: 60,
    color: '#3B82F6'
  });

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/shifts');
      setShifts(response.data.shifts || []);
    } catch (error) {
      console.error('Error fetching shifts:', error);
      toast.error('فشل في جلب المناوبات');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/hr/shifts', formData);
      toast.success('تم إنشاء المناوبة بنجاح');
      setDialogOpen(false);
      setFormData({ name: '', startTime: '09:00', endTime: '17:00', breakDuration: 60, color: '#3B82F6' });
      fetchShifts();
    } catch (error: any) {
      console.error('Error creating shift:', error);
      toast.error(error.response?.data?.error || 'فشل في إنشاء المناوبة');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المناوبة؟')) return;

    try {
      await api.delete(`/hr/shifts/${id}`);
      toast.success('تم حذف المناوبة بنجاح');
      fetchShifts();
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('فشل في حذف المناوبة');
    }
  };

  const calculateHours = (start: string, end: string, breakDuration: number) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const totalMinutes = endTotal - startTotal - breakDuration;
    return (totalMinutes / 60).toFixed(1);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">المناوبات</h1>
          <p className="text-gray-500 mt-1">إدارة مناوبات العمل</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          مناوبة جديدة
        </Button>
      </div>

      {shifts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">لا توجد مناوبات</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة مناوبة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shifts.map((shift) => (
            <Card key={shift.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: shift.color }}
                    />
                    <CardTitle>{shift.name}</CardTitle>
                  </div>
                  {shift.isActive ? (
                    <Badge>نشط</Badge>
                  ) : (
                    <Badge variant="outline">غير نشط</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">من:</span>
                    <span className="font-medium">{shift.startTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">إلى:</span>
                    <span className="font-medium">{shift.endTime}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">مدة الراحة:</span>
                    <span>{shift.breakDuration} دقيقة</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span className="text-gray-500">ساعات العمل:</span>
                    <span className="font-bold">
                      {calculateHours(shift.startTime, shift.endTime, shift.breakDuration)} ساعة
                    </span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/hr/shifts/${shift.id}/assign`)}
                      className="flex-1"
                    >
                      <Users className="h-4 w-4 ml-2" />
                      تعيين
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(shift.id)}
                      className="text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>مناوبة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم المناوبة</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: صباحي، مسائي، ليل"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>وقت البدء</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>وقت الانتهاء</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>مدة الراحة (بالدقائق)</Label>
              <Input
                type="number"
                value={formData.breakDuration}
                onChange={(e) => setFormData({ ...formData, breakDuration: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>اللون</Label>
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate}>إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shifts;

