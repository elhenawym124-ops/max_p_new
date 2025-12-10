/**
 * 📝 Resignation Service
 * خدمة إدارة الاستقالات
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class ResignationService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  async createResignation(companyId, employeeId, data) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });
      if (!employee) throw new Error('الموظف غير موجود');

      const resignation = await this.prisma.resignation.create({
        data: {
          companyId,
          employeeId,
          resignationDate: new Date(data.resignationDate),
          lastWorkingDay: new Date(data.lastWorkingDay),
          reason: data.reason,
          status: data.status || 'PENDING'
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
      return resignation;
    } catch (error) {
      console.error('❌ Error creating resignation:', error);
      throw error;
    }
  }

  async getResignations(companyId, options = {}) {
    try {
      const { status, limit = 50 } = options;
      const where = { companyId };
      if (status && status !== 'all') where.status = status;

      const resignations = await this.prisma.resignation.findMany({
        where,
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
        },
        orderBy: { resignationDate: 'desc' },
        take: parseInt(limit)
      });
      return resignations;
    } catch (error) {
      console.error('❌ Error getting resignations:', error);
      throw error;
    }
  }

  async getResignationById(companyId, resignationId) {
    try {
      const resignation = await this.prisma.resignation.findFirst({
        where: { id: resignationId, companyId },
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

      if (!resignation) throw new Error('الاستقالة غير موجودة');
      return resignation;
    } catch (error) {
      console.error('❌ Error getting resignation:', error);
      throw error;
    }
  }

  async updateResignation(companyId, resignationId, data) {
    try {
      const existing = await this.prisma.resignation.findFirst({
        where: { id: resignationId, companyId }
      });
      if (!existing) throw new Error('الاستقالة غير موجودة');

      const updateData = {};
      if (data.status) {
        updateData.status = data.status;
        if (data.status === 'APPROVED') {
          updateData.approvedBy = data.approvedBy;
          updateData.approvedAt = new Date();
        }
      }
      if (data.exitInterview !== undefined) updateData.exitInterview = data.exitInterview;
      if (data.reason !== undefined) updateData.reason = data.reason;

      const resignation = await this.prisma.resignation.update({
        where: { id: resignationId },
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

      // إذا تمت الموافقة، قم بتحديث حالة الموظف
      if (data.status === 'APPROVED' || data.status === 'COMPLETED') {
        await this.prisma.employee.update({
          where: { id: existing.employeeId },
          data: { status: 'RESIGNED' }
        });
      }

      return resignation;
    } catch (error) {
      console.error('❌ Error updating resignation:', error);
      throw error;
    }
  }

  async getResignationStats(companyId, options = {}) {
    try {
      const { year } = options;
      const where = { companyId };
      if (year) {
        where.resignationDate = {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`)
        };
      }

      const [total, byStatus] = await Promise.all([
        this.prisma.resignation.count({ where }),
        this.prisma.resignation.groupBy({
          by: ['status'],
          where,
          _count: true
        })
      ]);

      return { total, byStatus };
    } catch (error) {
      console.error('❌ Error getting resignation stats:', error);
      throw error;
    }
  }
}

module.exports = new ResignationService();








