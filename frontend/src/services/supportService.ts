import axios from 'axios';

const API_BASE_URL = '/api/v1/support';

// Get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export interface AttachmentFile {
    file: File;
    preview?: string;
}

export interface Ticket {
    _id: string;
    ticketId: string;
    subject: string;
    category: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    rating?: number;
    feedback?: string;
    messages: Message[];
    userId: {
        _id: string;
        name: string;
        email: string;
    };
}

export interface Message {
    _id: string;
    sender: {
        _id: string;
        name: string;
        email: string;
    };
    senderType: 'user' | 'admin';
    content: string;
    attachments: Array<{
        filename: string;
        originalName: string;
        mimetype: string;
        size: number;
        url: string;
    }>;
    createdAt: string;
}

export interface FAQ {
    _id: string;
    question: string;
    answer: string;
    category: string;
    helpful: number;
    notHelpful: number;
    isActive: boolean;
    tags?: string[];
    createdAt: string;
}

export interface TicketStats {
    _id: string;
    count: number;
}

const supportService = {
    // Tickets
    createTicket: async (formData: FormData) => {
        const response = await axios.post(`${API_BASE_URL}/tickets`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...getAuthHeaders()
            }
        });
        return response.data;
    },

    getUserTickets: async (params?: URLSearchParams) => {
        const queryString = params ? `?${params.toString()}` : '';
        const response = await axios.get(`${API_BASE_URL}/tickets${queryString}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    getTicketDetails: async (ticketId: string) => {
        const response = await axios.get(`${API_BASE_URL}/tickets/${ticketId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    addMessage: async (ticketId: string, formData: FormData) => {
        const response = await axios.post(`${API_BASE_URL}/tickets/${ticketId}/messages`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                ...getAuthHeaders()
            }
        });
        return response.data;
    },

    rateTicket: async (ticketId: string, data: { rating: number; feedback?: string }) => {
        const response = await axios.post(`${API_BASE_URL}/tickets/${ticketId}/rate`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Admin Tickets
    getAllTickets: async (params?: URLSearchParams) => {
        const queryString = params ? `?${params.toString()}` : '';
        const response = await axios.get(`${API_BASE_URL}/admin/tickets${queryString}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    updateTicketStatus: async (ticketId: string, status: string) => {
        const response = await axios.patch(`${API_BASE_URL}/tickets/${ticketId}/status`, { status }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // FAQs
    getFAQs: async (params?: URLSearchParams) => {
        const queryString = params ? `?${params.toString()}` : '';
        const response = await axios.get(`${API_BASE_URL}/faq${queryString}`, {
            headers: getAuthHeaders() // Auth optional but good to pass if available
        });
        return response.data;
    },

    getFAQCategories: async () => {
        const response = await axios.get(`${API_BASE_URL}/faq/categories`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    rateFAQ: async (faqId: string, helpful: boolean) => {
        const response = await axios.post(`${API_BASE_URL}/faq/${faqId}/rate`, { helpful }, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    // Admin FAQs
    createFAQ: async (data: any) => {
        const response = await axios.post(`${API_BASE_URL}/admin/faq`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    updateFAQ: async (faqId: string, data: any) => {
        const response = await axios.put(`${API_BASE_URL}/admin/faq/${faqId}`, data, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    deleteFAQ: async (faqId: string) => {
        const response = await axios.delete(`${API_BASE_URL}/admin/faq/${faqId}`, {
            headers: getAuthHeaders()
        });
        return response.data;
    },

    getAdminFAQs: async () => {
        const response = await axios.get(`${API_BASE_URL}/admin/faq`, {
            headers: getAuthHeaders()
        });
        return response.data;
    }
};

export default supportService;
