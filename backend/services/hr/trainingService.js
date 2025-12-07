/**
 * 📚 Employee Training Service
 * خدمة التدريب والتطوير
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class TrainingService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء سجل تدريب جديد
   */
  async createTraining(companyId, employeeId, data) {
    try {
      // التحقق من وجود الموظف
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      const training = await this.prisma.employeeTraining.create({
        data: {
          companyId,
          employeeId,
          trainingName: data.trainingName,
          provider: data.provider,
          type: data.type || 'internal',
          description: data.description,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          duration: data.duration,
          cost: data.cost,
          currency: data.currency || 'EGP',
          status: data.status || 'PLANNED'
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
          }
        }
      });

      return training;
    } catch (error) {
      console.error('❌ Error creating training:', error);
      throw error;
    }
  }

  /**
   * جلب سجلات التدريب لموظف
   */
  async getEmployeeTrainings(companyId, employeeId, options = {}) {
    try {
      const { status, limit = 50 } = options;

      const where = {
        companyId,
        employeeId
      };

      if (status && status !== 'all') {
        where.status = status;
      }

      const trainings = await this.prisma.employeeTraining.findMany({
        where,
        orderBy: { startDate: 'desc' },
        take: parseInt(limit)
      });

      return trainings;
    } catch (error) {
      console.error('❌ Error getting trainings:', error);
      throw error;
    }
  }

  /**
   * جلب سجل تدريب بالـ ID
   */
  async getTrainingById(companyId, trainingId) {
    try {
      const training = await this.prisma.employeeTraining.findFirst({
        where: { id: trainingId, companyId },
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
          }
        }
      });

      if (!training) {
        throw new Error('سجل التدريب غير موجود');
      }

      return training;
    } catch (error) {
      console.error('❌ Error getting training:', error);
      throw error;
    }
  }

  /**
   * تحديث سجل تدريب
   */
  async updateTraining(companyId, trainingId, data) {
    try {
      const existing = await this.prisma.employeeTraining.findFirst({
        where: { id: trainingId, companyId }
      });

      if (!existing) {
        throw new Error('سجل التدريب غير موجود');
      }

      const updateData = {};
      if (data.trainingName) updateData.trainingName = data.trainingName;
      if (data.provider) updateData.provider = data.provider;
      if (data.type) updateData.type = data.type;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
      if (data.duration !== undefined) updateData.duration = data.duration;
      if (data.cost !== undefined) updateData.cost = data.cost;
      if (data.status) updateData.status = data.status;
      if (data.completionDate) updateData.completionDate = new Date(data.completionDate);
      if (data.certificateUrl) updateData.certificateUrl = data.certificateUrl;
      if (data.score !== undefined) updateData.score = data.score;
      if (data.feedback !== undefined) updateData.feedback = data.feedback;

      // إذا تم تحديث الحالة إلى COMPLETED، قم بتحديث تاريخ الإكمال
      if (data.status === 'COMPLETED' && !updateData.completionDate) {
        updateData.completionDate = new Date();
      }

      const training = await this.prisma.employeeTraining.update({
        where: { id: trainingId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          }
        }
      });

      return training;
    } catch (error) {
      console.error('❌ Error updating training:', error);
      throw error;
    }
  }

  /**
   * حذف سجل تدريب
   */
  async deleteTraining(companyId, trainingId) {
    try {
      const existing = await this.prisma.employeeTraining.findFirst({
        where: { id: trainingId, companyId }
      });

      if (!existing) {
        throw new Error('سجل التدريب غير موجود');
      }

      await this.prisma.employeeTraining.delete({
        where: { id: trainingId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting training:', error);
      throw error;
    }
  }

  /**
   * إحصائيات التدريب
   */
  async getTrainingStats(companyId, options = {}) {
    try {
      const { employeeId, year } = options;

      const where = { companyId };
      if (employeeId) where.employeeId = employeeId;
      if (year) {
        where.startDate = { gte: new Date(`${year}-01-01`) };
      }

      const [total, byStatus, byType, totalCost, completed] = await Promise.all([
        this.prisma.employeeTraining.count({ where }),
        this.prisma.employeeTraining.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.prisma.employeeTraining.groupBy({
          by: ['type'],
          where,
          _count: true
        }),
        this.prisma.employeeTraining.aggregate({
          where,
          _sum: { cost: true }
        }),
        this.prisma.employeeTraining.count({
          where: { ...where, status: 'COMPLETED' }
        })
      ]);

      return {
        total,
        byStatus,
        byType,
        totalCost: totalCost._sum.cost || 0,
        completed,
        completionRate: total > 0 ? (completed / total * 100) : 0
      };
    } catch (error) {
      console.error('❌ Error getting training stats:', error);
      throw error;
    }
  }
}

module.exports = new TrainingService();


