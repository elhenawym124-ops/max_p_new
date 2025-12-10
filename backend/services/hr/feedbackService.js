/**
 * 💬 Feedback Service
 * خدمة التغذية الراجعة
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class FeedbackService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  async createFeedback(companyId, fromEmployeeId, data) {
    try {
      const feedback = await this.prisma.feedback.create({
        data: {
          companyId,
          fromEmployeeId,
          toEmployeeId: data.toEmployeeId || null,
          type: data.type || 'PEER',
          category: data.category,
          content: data.content,
          rating: data.rating,
          isAnonymous: data.isAnonymous || false,
          status: data.status || 'ACTIVE'
        },
        include: {
          fromEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          toEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          }
        }
      });
      return feedback;
    } catch (error) {
      console.error('❌ Error creating feedback:', error);
      throw error;
    }
  }

  async getFeedback(companyId, options = {}) {
    try {
      const { toEmployeeId, fromEmployeeId, type, limit = 50 } = options;
      const where = { companyId };
      if (toEmployeeId) where.toEmployeeId = toEmployeeId;
      if (fromEmployeeId) where.fromEmployeeId = fromEmployeeId;
      if (type) where.type = type;

      const feedback = await this.prisma.feedback.findMany({
        where,
        include: {
          fromEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          toEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });
      return feedback;
    } catch (error) {
      console.error('❌ Error getting feedback:', error);
      throw error;
    }
  }

  async getFeedbackById(companyId, feedbackId) {
    try {
      const feedback = await this.prisma.feedback.findFirst({
        where: { id: feedbackId, companyId },
        include: {
          fromEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          toEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          }
        }
      });

      if (!feedback) throw new Error('التغذية الراجعة غير موجودة');
      return feedback;
    } catch (error) {
      console.error('❌ Error getting feedback:', error);
      throw error;
    }
  }

  async updateFeedback(companyId, feedbackId, data) {
    try {
      const existing = await this.prisma.feedback.findFirst({
        where: { id: feedbackId, companyId }
      });
      if (!existing) throw new Error('التغذية الراجعة غير موجودة');

      const feedback = await this.prisma.feedback.update({
        where: { id: feedbackId },
        data,
        include: {
          fromEmployee: {
            select: { id: true, firstName: true, lastName: true }
          },
          toEmployee: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });
      return feedback;
    } catch (error) {
      console.error('❌ Error updating feedback:', error);
      throw error;
    }
  }

  async deleteFeedback(companyId, feedbackId) {
    try {
      const existing = await this.prisma.feedback.findFirst({
        where: { id: feedbackId, companyId }
      });
      if (!existing) throw new Error('التغذية الراجعة غير موجودة');

      await this.prisma.feedback.delete({ where: { id: feedbackId } });
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting feedback:', error);
      throw error;
    }
  }

  async getFeedbackStats(companyId, options = {}) {
    try {
      const { employeeId } = options;
      const where = { companyId };
      if (employeeId) where.toEmployeeId = employeeId;

      const [total, byType, averageRating] = await Promise.all([
        this.prisma.feedback.count({ where }),
        this.prisma.feedback.groupBy({
          by: ['type'],
          where,
          _count: true
        }),
        this.prisma.feedback.aggregate({
          where: { ...where, rating: { not: null } },
          _avg: { rating: true }
        })
      ]);

      return {
        total,
        byType,
        averageRating: averageRating._avg.rating || 0
      };
    } catch (error) {
      console.error('❌ Error getting feedback stats:', error);
      throw error;
    }
  }
}

module.exports = new FeedbackService();








