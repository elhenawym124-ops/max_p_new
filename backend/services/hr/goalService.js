/**
 * 📈 Goal Service
 * خدمة إدارة الأهداف
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class GoalService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  async createGoal(companyId, data) {
    try {
      const goal = await this.prisma.goal.create({
        data: {
          companyId,
          employeeId: data.employeeId || null,
          departmentId: data.departmentId || null,
          title: data.title,
          description: data.description,
          targetValue: data.targetValue,
          currentValue: data.currentValue || 0,
          unit: data.unit,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status: data.status || 'PENDING',
          progress: data.progress || 0
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          department: {
            select: { id: true, name: true }
          }
        }
      });
      return goal;
    } catch (error) {
      console.error('❌ Error creating goal:', error);
      throw error;
    }
  }

  async getGoals(companyId, options = {}) {
    try {
      const { employeeId, departmentId, status } = options;
      const where = { companyId };
      if (employeeId) where.employeeId = employeeId;
      if (departmentId) where.departmentId = departmentId;
      if (status && status !== 'all') where.status = status;

      const goals = await this.prisma.goal.findMany({
        where,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          department: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return goals;
    } catch (error) {
      console.error('❌ Error getting goals:', error);
      throw error;
    }
  }

  async getGoalById(companyId, goalId) {
    try {
      const goal = await this.prisma.goal.findFirst({
        where: { id: goalId, companyId },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeNumber: true }
          },
          department: {
            select: { id: true, name: true }
          }
        }
      });

      if (!goal) throw new Error('الهدف غير موجود');
      return goal;
    } catch (error) {
      console.error('❌ Error getting goal:', error);
      throw error;
    }
  }

  async updateGoal(companyId, goalId, data) {
    try {
      const existing = await this.prisma.goal.findFirst({
        where: { id: goalId, companyId }
      });
      if (!existing) throw new Error('الهدف غير موجود');

      const updateData = {};
      if (data.title) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.targetValue !== undefined) updateData.targetValue = data.targetValue;
      if (data.currentValue !== undefined) {
        updateData.currentValue = data.currentValue;
        // حساب التقدم تلقائياً
        if (data.targetValue !== undefined) {
          updateData.progress = Math.min(100, Math.max(0, (data.currentValue / data.targetValue) * 100));
        } else {
          updateData.progress = Math.min(100, Math.max(0, (data.currentValue / existing.targetValue) * 100));
        }
      }
      if (data.status) {
        updateData.status = data.status;
        if (data.status === 'COMPLETED' && updateData.progress !== 100) {
          updateData.progress = 100;
        }
      }

      const goal = await this.prisma.goal.update({
        where: { id: goalId },
        data: updateData,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true }
          },
          department: {
            select: { id: true, name: true }
          }
        }
      });

      return goal;
    } catch (error) {
      console.error('❌ Error updating goal:', error);
      throw error;
    }
  }

  async deleteGoal(companyId, goalId) {
    try {
      const existing = await this.prisma.goal.findFirst({
        where: { id: goalId, companyId }
      });
      if (!existing) throw new Error('الهدف غير موجود');

      await this.prisma.goal.delete({ where: { id: goalId } });
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting goal:', error);
      throw error;
    }
  }

  async getGoalStats(companyId, options = {}) {
    try {
      const { employeeId, departmentId } = options;
      const where = { companyId };
      if (employeeId) where.employeeId = employeeId;
      if (departmentId) where.departmentId = departmentId;

      const [total, byStatus, completed, averageProgress] = await Promise.all([
        this.prisma.goal.count({ where }),
        this.prisma.goal.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.prisma.goal.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.goal.aggregate({
          where,
          _avg: { progress: true }
        })
      ]);

      return {
        total,
        byStatus,
        completed,
        completionRate: total > 0 ? (completed / total * 100) : 0,
        averageProgress: averageProgress._avg.progress || 0
      };
    } catch (error) {
      console.error('❌ Error getting goal stats:', error);
      throw error;
    }
  }
}

module.exports = new GoalService();






