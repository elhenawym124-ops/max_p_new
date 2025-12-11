import { useState, useCallback } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { apiClient } from '../../services/apiClient';

interface OrderItem {
    name: string;
    quantity: number;
    price: number;
    image: string | null;
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    items: OrderItem[];
}

interface Activity {
    id: string;
    action: string;
    description: string;
    createdAt: string;
    metadata?: string;
}

export const useCustomerProfile = () => {
    const { companyId } = useCompany();
    const [orders, setOrders] = useState<Order[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadCustomerData = useCallback(async (customerId: string) => {
        if (!customerId || !companyId) return;

        setLoading(true);
        setError(null);

        try {
            // Concurrent fetching
            const [ordersRes, activityRes] = await Promise.all([
                apiClient.get(`/customers/${customerId}/orders?companyId=${companyId}`),
                apiClient.get(`/customers/${customerId}/activity?companyId=${companyId}`)
            ]);

            setOrders(ordersRes.data.data || []);
            setActivities(activityRes.data.data || []);
        } catch (err: any) {
            console.error('Error fetching customer profile:', err);
            setError('فشل جلب بيانات العميل');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const calculateLTV = useCallback(() => {
        return orders
            .filter(o => o.status === 'completed' || o.status === 'delivered' || o.status === 'paid')
            .reduce((sum, order) => sum + order.total, 0);
    }, [orders]);

    return {
        orders,
        activities,
        loading,
        error,
        loadCustomerData,
        calculateLTV
    };
};
