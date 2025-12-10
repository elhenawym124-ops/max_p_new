import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calendar, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'react-router-dom';
import api from '@/services/api';
import { toast } from 'sonner';

interface SalaryHistory {
  id: string;
  previousSalary: number;
  newSalary: number;
  changeType: string;
  changePercentage?: number;
  effectiveDate: string;
  reason?: string;
}

const SalaryHistory: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [history, setHistory] = useState<SalaryHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (employeeId) {
      fetchHistory();
    }
  }, [employeeId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/hr/salary-history/employee/${employeeId}`);
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching salary history:', error);
      toast.error('فشل في جلب سجل الرواتب');
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      promotion: 'ترقية',
      annual_increase: 'زيادة سنوية',
      adjustment: 'تعديل',
      demotion: 'إنزال'
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
      <div>
        <h1 className="text-3xl font-bold">سجل الرواتب</h1>
        <p className="text-gray-500 mt-1">تاريخ التغييرات في الراتب</p>
      </div>

      {history.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">لا يوجد سجل للرواتب</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.changePercentage && item.changePercentage > 0 ? (
                      <ArrowUp className="h-6 w-6 text-green-500" />
                    ) : item.changePercentage && item.changePercentage < 0 ? (
                      <ArrowDown className="h-6 w-6 text-red-500" />
                    ) : (
                      <DollarSign className="h-6 w-6 text-gray-500" />
                    )}
                    <div>
                      <CardTitle className="text-lg">
                        {getChangeTypeLabel(item.changeType)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {new Date(item.effectiveDate).toLocaleDateString('ar-EG')}
                        </Badge>
                        {item.changePercentage && (
                          <Badge 
                            variant={item.changePercentage > 0 ? 'default' : 'destructive'}
                          >
                            {item.changePercentage > 0 ? '+' : ''}{item.changePercentage.toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">الراتب السابق</p>
                      <p className="text-lg font-bold">{item.previousSalary.toLocaleString()} EGP</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">الراتب الجديد</p>
                      <p className="text-lg font-bold text-green-600">
                        {item.newSalary.toLocaleString()} EGP
                      </p>
                    </div>
                  </div>
                  {item.reason && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">السبب: </span>
                        {item.reason}
                      </p>
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

export default SalaryHistory;






