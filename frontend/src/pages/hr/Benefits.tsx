import React, { useState, useEffect } from 'react';
import { Gift, Plus, Users, DollarSign, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { toast } from 'sonner';

interface Benefit {
  id: string;
  name: string;
  description?: string;
  type: string;
  cost?: number;
  currency: string;
  isActive: boolean;
  activeEnrollments?: number;
}

const Benefits: React.FC = () => {
  const navigate = useNavigate();
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/benefits');
      setBenefits(response.data.benefits || []);
    } catch (error) {
      console.error('Error fetching benefits:', error);
      toast.error('فشل في جلب المزايا');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      health_insurance: 'تأمين صحي',
      life_insurance: 'تأمين على الحياة',
      retirement: 'تقاعد',
      other: 'أخرى'
    };
    return typeMap[type] || type;
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
          <h1 className="text-3xl font-bold">المزايا</h1>
          <p className="text-gray-500 mt-1">إدارة مزايا الموظفين</p>
        </div>
        <Button onClick={() => navigate('/hr/benefits/new')}>
          <Plus className="h-4 w-4 ml-2" />
          ميزة جديدة
        </Button>
      </div>

      {benefits.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">لا توجد مزايا</p>
            <Button onClick={() => navigate('/hr/benefits/new')}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة ميزة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((benefit) => (
            <Card 
              key={benefit.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/hr/benefits/${benefit.id}`)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Gift className="h-8 w-8 text-purple-500" />
                  {benefit.isActive ? (
                    <Badge>نشط</Badge>
                  ) : (
                    <Badge variant="outline">غير نشط</Badge>
                  )}
                </div>
                <CardTitle className="text-lg mt-2">{benefit.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Badge variant="secondary">{getTypeLabel(benefit.type)}</Badge>
                  {benefit.description && (
                    <p className="text-sm text-gray-600">{benefit.description}</p>
                  )}
                  {benefit.cost && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">
                        {benefit.cost.toLocaleString()} {benefit.currency}
                      </span>
                      <span className="text-gray-500">/شهر</span>
                    </div>
                  )}
                  {benefit.activeEnrollments !== undefined && (
                    <div className="flex items-center gap-2 text-sm pt-2 border-t">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span>{benefit.activeEnrollments} موظف مشترك</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Benefits;












