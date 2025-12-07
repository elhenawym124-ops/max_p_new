/**
 * 🏖️ Leave Service
 * خدمة إدارة الإجازات
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class LeaveService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء طلب إجازة
   */
  async createLeaveRequest(companyId, employeeId, data) {
    try {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);

      // حساب عدد الأيام
      const totalDays = this.calculateWorkingDays(startDate, endDate, data.isHalfDay);

      // التحقق من رصيد الإجازات
      const employee = await this.prisma.employee.findUnique({
        where: { id: employeeId }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      // التحقق من الرصيد حسب نوع الإجازة
      if (data.type === 'ANNUAL' && employee.annualLeaveBalance < totalDays) {
        throw new Error(`رصيد الإجازات السنوية غير كافٍ. الرصيد المتاح: ${employee.annualLeaveBalance} يوم`);
      }

      if (data.type === 'SICK' && employee.sickLeaveBalance < totalDays) {
        throw new Error(`رصيد الإجازات المرضية غير كافٍ. الرصيد المتاح: ${employee.sickLeaveBalance} يوم`);
      }

      // التحقق من عدم وجود تداخل مع إجازات أخرى
      const overlapping = await this.prisma.leaveRequest.findFirst({
        where: {
          employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate }
            }
          ]
        }
      });

      if (overlapping) {
        throw new Error('يوجد تداخل مع طلب إجازة آخر');
      }

      const leaveRequest = await this.prisma.leaveRequest.create({
        data: {
          companyId,
          employeeId,
          type: data.type,
          startDate,
          endDate,
          totalDays,
          isHalfDay: data.isHalfDay || false,
          halfDayPeriod: data.halfDayPeriod,
          reason: data.reason,
          attachments: data.attachments ? JSON.stringify(data.attachments) : null,
          substituteId: data.substituteId,
          status: 'PENDING'
        },
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, avatar: true }
          }
        }
      });

      return leaveRequest;
    } catch (error) {
      console.error('❌ Error creating leave request:', error);
      throw error;
    }
  }

  /**
   * جلب طلبات الإجازات
   */
  async getLeaveRequests(companyId, options = {}) {
    try {
      const {
        employeeId,
        status,
        type,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = options;

      const where = { companyId };

      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;
      if (type) where.type = type;

      if (startDate || endDate) {
        where.startDate = {};
        if (startDate) where.startDate.gte = new Date(startDate);
        if (endDate) where.startDate.lte = new Date(endDate);
      }

      const [requests, total] = await Promise.all([
        this.prisma.leaveRequest.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                department: { select: { name: true } }
              }
            },
            approver: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.leaveRequest.count({ where })
      ]);

      return {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error getting leave requests:', error);
      throw error;
    }
  }

  /**
   * جلب طلب إجازة بالـ ID
   */
  async getLeaveRequestById(companyId, requestId) {
    try {
      const request = await this.prisma.leaveRequest.findFirst({
        where: { id: requestId, companyId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              email: true,
              department: { select: { name: true } },
              position: { select: { title: true } },
              annualLeaveBalance: true,
              sickLeaveBalance: true
            }
          },
          approver: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      return request;
    } catch (error) {
      console.error('❌ Error getting leave request:', error);
      throw error;
    }
  }

  /**
   * الموافقة على طلب إجازة
   */
  async approveLeaveRequest(companyId, requestId, approverId) {
    try {
      const request = await this.prisma.leaveRequest.findFirst({
        where: { id: requestId, companyId }
      });

      if (!request) {
        throw new Error('طلب الإجازة غير موجود');
      }

      if (request.status !== 'PENDING') {
        throw new Error('لا يمكن الموافقة على هذا الطلب');
      }

      // تحديث الطلب
      const updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date()
        }
      });

      // خصم من رصيد الإجازات
      if (request.type === 'ANNUAL') {
        await this.prisma.employee.update({
          where: { id: request.employeeId },
          data: {
            annualLeaveBalance: { decrement: request.totalDays }
          }
        });
      } else if (request.type === 'SICK') {
        await this.prisma.employee.update({
          where: { id: request.employeeId },
          data: {
            sickLeaveBalance: { decrement: request.totalDays }
          }
        });
      }

      // إنشاء سجلات حضور للإجازة
      const dates = this.getDateRange(request.startDate, request.endDate);
      for (const date of dates) {
        await this.prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: request.employeeId,
              date
            }
          },
          create: {
            companyId,
            employeeId: request.employeeId,
            date,
            status: 'ON_LEAVE',
            notes: `إجازة ${this.getLeaveTypeName(request.type)}`
          },
          update: {
            status: 'ON_LEAVE',
            notes: `إجازة ${this.getLeaveTypeName(request.type)}`
          }
        });
      }

      return updated;
    } catch (error) {
      console.error('❌ Error approving leave request:', error);
      throw error;
    }
  }

  /**
   * رفض طلب إجازة
   */
  async rejectLeaveRequest(companyId, requestId, approverId, reason) {
    try {
      const request = await this.prisma.leaveRequest.findFirst({
        where: { id: requestId, companyId }
      });

      if (!request) {
        throw new Error('طلب الإجازة غير موجود');
      }

      if (request.status !== 'PENDING') {
        throw new Error('لا يمكن رفض هذا الطلب');
      }

      const updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          approvedBy: approverId,
          approvedAt: new Date(),
          rejectionReason: reason
        }
      });

      return updated;
    } catch (error) {
      console.error('❌ Error rejecting leave request:', error);
      throw error;
    }
  }

  /**
   * إلغاء طلب إجازة
   */
  async cancelLeaveRequest(companyId, requestId, employeeId) {
    try {
      const request = await this.prisma.leaveRequest.findFirst({
        where: { id: requestId, companyId, employeeId }
      });

      if (!request) {
        throw new Error('طلب الإجازة غير موجود');
      }

      if (request.status === 'CANCELLED') {
        throw new Error('الطلب ملغي مسبقاً');
      }

      // إذا كان معتمداً، نرجع الرصيد
      if (request.status === 'APPROVED') {
        if (request.type === 'ANNUAL') {
          await this.prisma.employee.update({
            where: { id: employeeId },
            data: {
              annualLeaveBalance: { increment: request.totalDays }
            }
          });
        } else if (request.type === 'SICK') {
          await this.prisma.employee.update({
            where: { id: employeeId },
            data: {
              sickLeaveBalance: { increment: request.totalDays }
            }
          });
        }

        // حذف سجلات الحضور
        await this.prisma.attendance.deleteMany({
          where: {
            employeeId,
            date: {
              gte: request.startDate,
              lte: request.endDate
            },
            status: 'ON_LEAVE'
          }
        });
      }

      const updated = await this.prisma.leaveRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' }
      });

      return updated;
    } catch (error) {
      console.error('❌ Error cancelling leave request:', error);
      throw error;
    }
  }

  /**
   * جلب رصيد الإجازات
   */
  async getLeaveBalance(companyId, employeeId) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        select: {
          annualLeaveBalance: true,
          sickLeaveBalance: true
        }
      });

      if (!employee) {
        throw new Error('الموظف غير موجود');
      }

      // حساب الإجازات المستخدمة هذا العام
      const year = new Date().getFullYear();
      const usedLeaves = await this.prisma.leaveRequest.groupBy({
        by: ['type'],
        where: {
          employeeId,
          status: 'APPROVED',
          startDate: {
            gte: new Date(year, 0, 1),
            lte: new Date(year, 11, 31)
          }
        },
        _sum: { totalDays: true }
      });

      const usedAnnual = usedLeaves.find(l => l.type === 'ANNUAL')?._sum.totalDays || 0;
      const usedSick = usedLeaves.find(l => l.type === 'SICK')?._sum.totalDays || 0;

      return {
        annual: {
          balance: employee.annualLeaveBalance,
          used: usedAnnual,
          total: employee.annualLeaveBalance + usedAnnual
        },
        sick: {
          balance: employee.sickLeaveBalance,
          used: usedSick,
          total: employee.sickLeaveBalance + usedSick
        }
      };
    } catch (error) {
      console.error('❌ Error getting leave balance:', error);
      throw error;
    }
  }

  /**
   * تقويم الإجازات
   */
  async getLeaveCalendar(companyId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const leaves = await this.prisma.leaveRequest.findMany({
        where: {
          companyId,
          status: 'APPROVED',
          OR: [
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate }
            }
          ]
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
              department: { select: { name: true, color: true } }
            }
          }
        }
      });

      return leaves;
    } catch (error) {
      console.error('❌ Error getting leave calendar:', error);
      throw error;
    }
  }

  /**
   * إحصائيات الإجازات
   */
  async getLeaveStats(companyId, year) {
    try {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      const [
        byType,
        byStatus,
        byMonth,
        pendingCount
      ] = await Promise.all([
        this.prisma.leaveRequest.groupBy({
          by: ['type'],
          where: {
            companyId,
            status: 'APPROVED',
            startDate: { gte: startDate, lte: endDate }
          },
          _sum: { totalDays: true },
          _count: true
        }),
        this.prisma.leaveRequest.groupBy({
          by: ['status'],
          where: {
            companyId,
            createdAt: { gte: startDate, lte: endDate }
          },
          _count: true
        }),
        this.prisma.$queryRaw`
          SELECT MONTH(startDate) as month, SUM(totalDays) as days
          FROM hr_leave_requests
          WHERE companyId = ${companyId}
            AND status = 'APPROVED'
            AND startDate >= ${startDate}
            AND startDate <= ${endDate}
          GROUP BY MONTH(startDate)
        `,
        this.prisma.leaveRequest.count({
          where: { companyId, status: 'PENDING' }
        })
      ]);

      return {
        year,
        byType,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        byMonth,
        pendingCount
      };
    } catch (error) {
      console.error('❌ Error getting leave stats:', error);
      throw error;
    }
  }

  // ===== Helper Methods =====

  calculateWorkingDays(startDate, endDate, isHalfDay) {
    if (isHalfDay) return 0.5;

    let days = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // استبعاد الجمعة والسبت (يمكن تخصيصها حسب الإعدادات)
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  getLeaveTypeName(type) {
    const types = {
      ANNUAL: 'سنوية',
      SICK: 'مرضية',
      UNPAID: 'بدون راتب',
      MATERNITY: 'أمومة',
      PATERNITY: 'أبوة',
      BEREAVEMENT: 'عزاء',
      MARRIAGE: 'زواج',
      HAJJ: 'حج',
      STUDY: 'دراسية',
      EMERGENCY: 'طارئة',
      OTHER: 'أخرى'
    };
    return types[type] || type;
  }
}

module.exports = new LeaveService();
