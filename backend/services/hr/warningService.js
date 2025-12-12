/**
 * ⚠️ Employee Warning Service
 * خدمة الإنذارات
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class WarningService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء إنذار جديد
   */
  async createWarning(companyId, employeeId, data) {
    try {
      // التحقق من وجود الموظف
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      const warning = await this.prisma.employeeWarning.create({
        data: {
          companyId,
          employeeId,
          type: data.type,
          severity: data.severity || 'minor',
          title: data.title,
          description: data.description,
          incidentDate: new Date(data.incidentDate),
          actionTaken: data.actionTaken,
          issuedBy: data.issuedBy,
          attachments: data.attachments ? JSON.stringify(data.attachments) : null
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

      // Parse JSON fields
      return {
        ...warning,
        attachments: warning.attachments ? JSON.parse(warning.attachments) : null
      };
    } catch (error) {
      console.error('❌ Error creating warning:', error);
      throw error;
    }
  }

  /**
   * جلب إنذارات موظف
   */
  async getEmployeeWarnings(companyId, employeeId, options = {}) {
    try {
      const { type, severity, limit = 50 } = options;

      const where = {
        companyId,
        employeeId
      };

      if (type && type !== 'all') {
        where.type = type;
      }

      if (severity && severity !== 'all') {
        where.severity = severity;
      }

      const warnings = await this.prisma.employeeWarning.findMany({
        where,
        orderBy: { incidentDate: 'desc' },
        take: parseInt(limit)
      });

      // Parse JSON fields
      return warnings.map(warning => ({
        ...warning,
        attachments: warning.attachments ? JSON.parse(warning.attachments) : null
      }));
    } catch (error) {
      console.error('❌ Error getting warnings:', error);
      throw error;
    }
  }

  /**
   * جلب إنذار بالـ ID
   */
  async getWarningById(companyId, warningId) {
    try {
      const warning = await this.prisma.employeeWarning.findFirst({
        where: { id: warningId, companyId },
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

      if (!warning) {
        throw new Error('الإنذار غير موجود');
      }

      // Parse JSON fields
      return {
        ...warning,
        attachments: warning.attachments ? JSON.parse(warning.attachments) : null
      };
    } catch (error) {
      console.error('❌ Error getting warning:', error);
      throw error;
    }
  }

  /**
   * تحديث إنذار
   */
  async updateWarning(companyId, warningId, data) {
    try {
      const existing = await this.prisma.employeeWarning.findFirst({
        where: { id: warningId, companyId }
      });

      if (!existing) {
        throw new Error('الإنذار غير موجود');
      }

      const updateData = {};
      if (data.title) updateData.title = data.title;
      if (data.description) updateData.description = data.description;
      if (data.actionTaken !== undefined) updateData.actionTaken = data.actionTaken;
      if (data.employeeResponse !== undefined) updateData.employeeResponse = data.employeeResponse;
      if (data.attachments) updateData.attachments = JSON.stringify(data.attachments);
      if (data.acknowledgedAt) updateData.acknowledgedAt = new Date(data.acknowledgedAt);

      const warning = await this.prisma.employeeWarning.update({
        where: { id: warningId },
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

      // Parse JSON fields
      return {
        ...warning,
        attachments: warning.attachments ? JSON.parse(warning.attachments) : null
      };
    } catch (error) {
      console.error('❌ Error updating warning:', error);
      throw error;
    }
  }

  /**
   * تسجيل اعتراف الموظف بالإنذار
   */
  async acknowledgeWarning(companyId, warningId, employeeResponse) {
    try {
      const warning = await this.prisma.employeeWarning.findFirst({
        where: { id: warningId, companyId }
      });

      if (!warning) {
        throw new Error('الإنذار غير موجود');
      }

      const updated = await this.prisma.employeeWarning.update({
        where: { id: warningId },
        data: {
          acknowledgedAt: new Date(),
          employeeResponse: employeeResponse
        }
      });

      return updated;
    } catch (error) {
      console.error('❌ Error acknowledging warning:', error);
      throw error;
    }
  }

  /**
   * حذف إنذار
   */
  async deleteWarning(companyId, warningId) {
    try {
      const existing = await this.prisma.employeeWarning.findFirst({
        where: { id: warningId, companyId }
      });

      if (!existing) {
        throw new Error('الإنذار غير موجود');
      }

      await this.prisma.employeeWarning.delete({
        where: { id: warningId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting warning:', error);
      throw error;
    }
  }

  /**
   * إحصائيات الإنذارات
   */
  async getWarningStats(companyId, options = {}) {
    try {
      const { employeeId, year } = options;

      const where = { companyId };
      if (employeeId) where.employeeId = employeeId;
      if (year) {
        where.incidentDate = { gte: new Date(`${year}-01-01`) };
      }

      const [total, byType, bySeverity, acknowledged] = await Promise.all([
        this.prisma.employeeWarning.count({ where }),
        this.prisma.employeeWarning.groupBy({
          by: ['type'],
          where,
          _count: true
        }),
        this.prisma.employeeWarning.groupBy({
          by: ['severity'],
          where,
          _count: true
        }),
        this.prisma.employeeWarning.count({
          where: { ...where, acknowledgedAt: { not: null } }
        })
      ]);

      return {
        total,
        byType,
        bySeverity,
        acknowledged,
        acknowledgmentRate: total > 0 ? (acknowledged / total * 100) : 0
      };
    } catch (error) {
      console.error('❌ Error getting warning stats:', error);
      throw error;
    }
  }
}

module.exports = new WarningService();




















