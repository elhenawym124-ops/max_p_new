/**
 * 🕐 Shift Service
 * خدمة إدارة المناوبات
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class ShiftService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء مناوبة جديدة
   */
  async createShift(companyId, data) {
    try {
      const shift = await this.prisma.shift.create({
        data: {
          companyId,
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          breakDuration: data.breakDuration || 60,
          color: data.color || '#3B82F6',
          isActive: data.isActive !== undefined ? data.isActive : true
        }
      });

      return shift;
    } catch (error) {
      console.error('❌ Error creating shift:', error);
      throw error;
    }
  }

  /**
   * جلب جميع المناوبات
   */
  async getShifts(companyId, options = {}) {
    try {
      const { includeInactive } = options;

      const where = { companyId };
      if (!includeInactive) {
        where.isActive = true;
      }

      const shifts = await this.prisma.shift.findMany({
        where,
        orderBy: { startTime: 'asc' }
      });

      return shifts;
    } catch (error) {
      console.error('❌ Error getting shifts:', error);
      throw error;
    }
  }

  /**
   * جلب مناوبة بالـ ID
   */
  async getShiftById(companyId, shiftId) {
    try {
      const shift = await this.prisma.shift.findFirst({
        where: { id: shiftId, companyId },
        include: {
          assignments: {
            take: 10,
            orderBy: { date: 'desc' },
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
          }
        }
      });

      if (!shift) {
        throw new Error('المناوبة غير موجودة');
      }

      return shift;
    } catch (error) {
      console.error('❌ Error getting shift:', error);
      throw error;
    }
  }

  /**
   * تحديث مناوبة
   */
  async updateShift(companyId, shiftId, data) {
    try {
      const existing = await this.prisma.shift.findFirst({
        where: { id: shiftId, companyId }
      });

      if (!existing) {
        throw new Error('المناوبة غير موجودة');
      }

      const shift = await this.prisma.shift.update({
        where: { id: shiftId },
        data
      });

      return shift;
    } catch (error) {
      console.error('❌ Error updating shift:', error);
      throw error;
    }
  }

  /**
   * حذف مناوبة
   */
  async deleteShift(companyId, shiftId) {
    try {
      const existing = await this.prisma.shift.findFirst({
        where: { id: shiftId, companyId }
      });

      if (!existing) {
        throw new Error('المناوبة غير موجودة');
      }

      await this.prisma.shift.delete({
        where: { id: shiftId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting shift:', error);
      throw error;
    }
  }

  /**
   * تعيين موظف لمناوبة
   */
  async assignShift(companyId, employeeId, shiftId, date) {
    try {
      // التحقق من وجود الموظف والمناوبة
      const [employee, shift] = await Promise.all([
        this.prisma.employee.findFirst({ where: { id: employeeId, companyId } }),
        this.prisma.shift.findFirst({ where: { id: shiftId, companyId } })
      ]);

      if (!employee) throw new Error('الموظف غير موجود');
      if (!shift) throw new Error('المناوبة غير موجودة');

      const assignment = await this.prisma.shiftAssignment.create({
        data: {
          companyId,
          employeeId,
          shiftId,
          date: new Date(date)
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeNumber: true
            }
          },
          shift: true
        }
      });

      return assignment;
    } catch (error) {
      console.error('❌ Error assigning shift:', error);
      throw error;
    }
  }

  /**
   * جلب تعيينات موظف
   */
  async getEmployeeAssignments(companyId, employeeId, options = {}) {
    try {
      const { startDate, endDate } = options;

      const where = {
        companyId,
        employeeId
      };

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const assignments = await this.prisma.shiftAssignment.findMany({
        where,
        include: {
          shift: true
        },
        orderBy: { date: 'desc' }
      });

      return assignments;
    } catch (error) {
      console.error('❌ Error getting assignments:', error);
      throw error;
    }
  }

  /**
   * حذف تعيين مناوبة
   */
  async removeAssignment(companyId, assignmentId) {
    try {
      const existing = await this.prisma.shiftAssignment.findFirst({
        where: { id: assignmentId, companyId }
      });

      if (!existing) {
        throw new Error('التعيين غير موجود');
      }

      await this.prisma.shiftAssignment.delete({
        where: { id: assignmentId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error removing assignment:', error);
      throw error;
    }
  }

  /**
   * إحصائيات المناوبات
   */
  async getShiftStats(companyId, options = {}) {
    try {
      const { startDate, endDate } = options;

      const where = { companyId };
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const [totalShifts, activeShifts, totalAssignments, byShift] = await Promise.all([
        this.prisma.shift.count({ where: { companyId } }),
        this.prisma.shift.count({ where: { companyId, isActive: true } }),
        this.prisma.shiftAssignment.count({ where }),
        this.prisma.shiftAssignment.groupBy({
          by: ['shiftId'],
          where,
          _count: true
        })
      ]);

      return {
        totalShifts,
        activeShifts,
        totalAssignments,
        byShift
      };
    } catch (error) {
      console.error('❌ Error getting shift stats:', error);
      throw error;
    }
  }
}

module.exports = new ShiftService();











