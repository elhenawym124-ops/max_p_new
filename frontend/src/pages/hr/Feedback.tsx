import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Star, User, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { toast } from 'sonner';

interface Feedback {
  id: string;
  type: string;
  category?: string;
  content: string;
  rating?: number;
  isAnonymous: boolean;
  fromEmployee: {
    firstName: string;
    lastName: string;
  };
  toEmployee?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

const Feedback: React.FC = () => {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const response = await api.get('/hr/feedback');
      setFeedback(response.data.feedback || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
      toast.error('فشل في جلب التغذية الراجعة');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      PEER: 'من زميل',
      MANAGER: 'من مدير',
      SUBORDINATE: 'من مرؤوس',
      SELF: 'ذاتي',
      GENERAL: 'عام'
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
          <h1 className="text-3xl font-bold">التغذية الراجعة</h1>
          <p className="text-gray-500 mt-1">نظام التغذية الراجعة 360 درجة</p>
        </div>
        <Button onClick={() => navigate('/hr/feedback/new')}>
          <Plus className="h-4 w-4 ml-2" />
          تغذية راجعة جديدة
        </Button>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500 mb-4">لا توجد تغذية راجعة</p>
            <Button onClick={() => navigate('/hr/feedback/new')}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة تغذية راجعة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedback.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-blue-500" />
                    <div>
                      <CardTitle className="text-lg">
                        {item.toEmployee 
                          ? `${item.toEmployee.firstName} ${item.toEmployee.lastName}`
                          : 'تغذية راجعة عامة'}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{getTypeLabel(item.type)}</Badge>
                        {item.category && <Badge variant="outline">{item.category}</Badge>}
                        {item.isAnonymous && <Badge variant="outline">مجهول</Badge>}
                      </div>
                    </div>
                  </div>
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold">{item.rating}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-gray-700">{item.content}</p>
                  <div className="flex items-center justify-between pt-3 border-t text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      {!item.isAnonymous && (
                        <>
                          <User className="h-4 w-4" />
                          <span>
                            من: {item.fromEmployee.firstName} {item.fromEmployee.lastName}
                          </span>
                        </>
                      )}
                      {item.isAnonymous && (
                        <span>مجهول المصدر</span>
                      )}
                    </div>
                    <span>{new Date(item.createdAt).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Feedback;

