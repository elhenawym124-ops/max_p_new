/**
 * 📊 Performance Review Service
 * خدمة تقييم الأداء
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class PerformanceService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء تقييم أداء جديد
   */
  async createPerformanceReview(companyId, employeeId, data) {
    try {
      // التحقق من وجود الموظف
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      const review = await this.prisma.performanceReview.create({
        data: {
          companyId,
          employeeId,
          reviewerId: data.reviewerId,
          reviewPeriod: data.reviewPeriod,
          periodStart: new Date(data.periodStart),
          periodEnd: new Date(data.periodEnd),
          overallRating: data.overallRating,
          ratings: data.ratings ? JSON.stringify(data.ratings) : null,
          goals: data.goals ? JSON.stringify(data.goals) : null,
          goalsAchievement: data.goalsAchievement,
          strengths: data.strengths,
          improvements: data.improvements,
          reviewerComments: data.reviewerComments,
          employeeComments: data.employeeComments,
          recommendations: data.recommendations ? JSON.stringify(data.recommendations) : null,
          status: data.status || 'DRAFT'
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              position: { select: { title: true } },
              department: { select: { name: true } }
            }
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Parse JSON fields
      return {
        ...review,
        ratings: review.ratings ? JSON.parse(review.ratings) : null,
        goals: review.goals ? JSON.parse(review.goals) : null,
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : null
      };
    } catch (error) {
      console.error('❌ Error creating performance review:', error);
      throw error;
    }
  }

  /**
   * جلب تقييمات أداء موظف
   */
  async getEmployeeReviews(companyId, employeeId, options = {}) {
    try {
      const { status, limit = 50 } = options;

      const where = {
        companyId,
        employeeId
      };

      if (status && status !== 'all') {
        where.status = status;
      }

      const reviews = await this.prisma.performanceReview.findMany({
        where,
        orderBy: { periodEnd: 'desc' },
        take: parseInt(limit),
        include: {
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Parse JSON fields
      return reviews.map(review => ({
        ...review,
        ratings: review.ratings ? JSON.parse(review.ratings) : null,
        goals: review.goals ? JSON.parse(review.goals) : null,
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : null
      }));
    } catch (error) {
      console.error('❌ Error getting performance reviews:', error);
      throw error;
    }
  }

  /**
   * جلب تقييم أداء بالـ ID
   */
  async getReviewById(companyId, reviewId) {
    try {
      const review = await this.prisma.performanceReview.findFirst({
        where: { id: reviewId, companyId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true,
              position: { select: { title: true } },
              department: { select: { name: true } }
            }
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!review) {
        throw new Error('التقييم غير موجود');
      }

      // Parse JSON fields
      return {
        ...review,
        ratings: review.ratings ? JSON.parse(review.ratings) : null,
        goals: review.goals ? JSON.parse(review.goals) : null,
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : null
      };
    } catch (error) {
      console.error('❌ Error getting performance review:', error);
      throw error;
    }
  }

  /**
   * تحديث تقييم أداء
   */
  async updateReview(companyId, reviewId, data) {
    try {
      const existing = await this.prisma.performanceReview.findFirst({
        where: { id: reviewId, companyId }
      });

      if (!existing) {
        throw new Error('التقييم غير موجود');
      }

      const updateData = {};
      if (data.overallRating !== undefined) updateData.overallRating = data.overallRating;
      if (data.ratings) updateData.ratings = JSON.stringify(data.ratings);
      if (data.goals) updateData.goals = JSON.stringify(data.goals);
      if (data.goalsAchievement !== undefined) updateData.goalsAchievement = data.goalsAchievement;
      if (data.strengths !== undefined) updateData.strengths = data.strengths;
      if (data.improvements !== undefined) updateData.improvements = data.improvements;
      if (data.reviewerComments !== undefined) updateData.reviewerComments = data.reviewerComments;
      if (data.employeeComments !== undefined) updateData.employeeComments = data.employeeComments;
      if (data.recommendations) updateData.recommendations = JSON.stringify(data.recommendations);
      if (data.status) updateData.status = data.status;
      if (data.status === 'SUBMITTED') updateData.submittedAt = new Date();
      if (data.status === 'ACKNOWLEDGED') updateData.acknowledgedAt = new Date();

      const review = await this.prisma.performanceReview.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          },
          reviewer: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Parse JSON fields
      return {
        ...review,
        ratings: review.ratings ? JSON.parse(review.ratings) : null,
        goals: review.goals ? JSON.parse(review.goals) : null,
        recommendations: review.recommendations ? JSON.parse(review.recommendations) : null
      };
    } catch (error) {
      console.error('❌ Error updating performance review:', error);
      throw error;
    }
  }

  /**
   * حذف تقييم أداء
   */
  async deleteReview(companyId, reviewId) {
    try {
      const existing = await this.prisma.performanceReview.findFirst({
        where: { id: reviewId, companyId }
      });

      if (!existing) {
        throw new Error('التقييم غير موجود');
      }

      await this.prisma.performanceReview.delete({
        where: { id: reviewId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting performance review:', error);
      throw error;
    }
  }

  /**
   * إحصائيات التقييمات
   */
  async getPerformanceStats(companyId, options = {}) {
    try {
      const { employeeId, year } = options;

      const where = { companyId };
      if (employeeId) where.employeeId = employeeId;
      if (year) {
        where.periodStart = { gte: new Date(`${year}-01-01`) };
        where.periodEnd = { lte: new Date(`${year}-12-31`) };
      }

      const [total, byStatus, averageRating, byPeriod] = await Promise.all([
        this.prisma.performanceReview.count({ where }),
        this.prisma.performanceReview.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.prisma.performanceReview.aggregate({
          where,
          _avg: { overallRating: true }
        }),
        this.prisma.performanceReview.groupBy({
          by: ['reviewPeriod'],
          where,
          _count: true,
          _avg: { overallRating: true }
        })
      ]);

      return {
        total,
        byStatus,
        averageRating: averageRating._avg.overallRating || 0,
        byPeriod
      };
    } catch (error) {
      console.error('❌ Error getting performance stats:', error);
      throw error;
    }
  }
}

module.exports = new PerformanceService();












