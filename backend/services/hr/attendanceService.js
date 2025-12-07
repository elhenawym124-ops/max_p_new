/**
 * ⏰ Attendance Service
 * خدمة إدارة الحضور والانصراف
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class AttendanceService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * تسجيل حضور
   */
  async checkIn(companyId, employeeId, data = {}) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // التحقق من عدم وجود تسجيل حضور لنفس اليوم
      const existing = await this.prisma.attendance.findFirst({
        where: {
          employeeId,
          date: today
        }
      });

      if (existing && existing.checkIn) {
        throw new Error('تم تسجيل الحضور مسبقاً لهذا اليوم');
      }

      // جلب إعدادات HR
      const settings = await this.prisma.hRSettings.findUnique({
        where: { companyId }
      });

      const now = new Date();
      const workStartTime = settings?.workStartTime || '09:00';
      const [startHour, startMinute] = workStartTime.split(':').map(Number);
      const workStart = new Date(today);
      workStart.setHours(startHour, startMinute, 0, 0);

      // حساب دقائق التأخير
      let lateMinutes = 0;
      const gracePeriod = settings?.lateGracePeriod || 15;
      const graceTime = new Date(workStart.getTime() + gracePeriod * 60000);

      if (now > graceTime) {
        lateMinutes = Math.floor((now - workStart) / 60000);
      }

      const attendance = existing
        ? await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            checkIn: now,
            checkInLocation: data.location,
            checkInMethod: data.method || 'manual',
            lateMinutes,
            status: lateMinutes > 0 ? 'LATE' : 'PRESENT'
          }
        })
        : await this.prisma.attendance.create({
          data: {
            companyId,
            employeeId,
            date: today,
            checkIn: now,
            checkInLocation: data.location,
            checkInMethod: data.method || 'manual',
            lateMinutes,
            status: lateMinutes > 0 ? 'LATE' : 'PRESENT'
          }
        });

      return attendance;
    } catch (error) {
      console.error('❌ Error checking in:', error);
      throw error;
    }
  }

  /**
   * تسجيل انصراف
   */
  async checkOut(companyId, employeeId, data = {}) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const attendance = await this.prisma.attendance.findFirst({
        where: {
          employeeId,
          date: today
        }
      });

      if (!attendance) {
        throw new Error('لم يتم تسجيل الحضور لهذا اليوم');
      }

      if (attendance.checkOut) {
        throw new Error('تم تسجيل الانصراف مسبقاً');
      }

      // جلب إعدادات HR
      const settings = await this.prisma.hRSettings.findUnique({
        where: { companyId }
      });

      const now = new Date();
      const workEndTime = settings?.workEndTime || '17:00';
      const [endHour, endMinute] = workEndTime.split(':').map(Number);
      const workEnd = new Date(today);
      workEnd.setHours(endHour, endMinute, 0, 0);

      // حساب دقائق الخروج المبكر
      let earlyLeaveMinutes = 0;
      const gracePeriod = settings?.earlyLeaveGracePeriod || 15;
      const graceTime = new Date(workEnd.getTime() - gracePeriod * 60000);

      if (now < graceTime) {
        earlyLeaveMinutes = Math.floor((workEnd - now) / 60000);
      }

      // حساب ساعات العمل
      const workHours = (now - new Date(attendance.checkIn)) / 3600000;

      // حساب ساعات إضافية
      let overtimeHours = 0;
      const minOvertimeHours = parseFloat(settings?.overtimeMinHours) || 1;
      if (now > workEnd) {
        const overtime = (now - workEnd) / 3600000;
        if (overtime >= minOvertimeHours) {
          overtimeHours = overtime;
        }
      }

      const updated = await this.prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOut: now,
          checkOutLocation: data.location,
          checkOutMethod: data.method || 'manual',
          earlyLeaveMinutes,
          workHours: Math.round(workHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100
        }
      });

      return updated;
    } catch (error) {
      console.error('❌ Error checking out:', error);
      throw error;
    }
  }

  /**
   * جلب سجل الحضور
   */
  async getAttendance(companyId, options = {}) {
    try {
      const {
        employeeId,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 50
      } = options;

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);

      const where = { companyId };

      if (employeeId) where.employeeId = employeeId;
      if (status) where.status = status;

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const [records, total] = await Promise.all([
        this.prisma.attendance.findMany({
          where,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                employeeNumber: true,
                department: { select: { name: true } }
              }
            }
          },
          orderBy: { date: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum
        }),
        this.prisma.attendance.count({ where })
      ]);

      return {
        records,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };
    } catch (error) {
      console.error('❌ Error getting attendance:', error);
      throw error;
    }
  }

  /**
   * جلب حضور اليوم
   */
  async getTodayAttendance(companyId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [attendance, totalEmployees] = await Promise.all([
        this.prisma.attendance.findMany({
          where: {
            companyId,
            date: today
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
        }),
        this.prisma.employee.count({
          where: { companyId, status: 'ACTIVE' }
        })
      ]);

      const present = attendance.filter(a => a.checkIn).length;
      const late = attendance.filter(a => a.status === 'LATE').length;
      const absent = totalEmployees - present;

      return {
        date: today,
        totalEmployees,
        present,
        late,
        absent,
        records: attendance
      };
    } catch (error) {
      console.error('❌ Error getting today attendance:', error);
      throw error;
    }
  }

  /**
   * تحديث سجل حضور يدوياً
   */
  async updateAttendance(companyId, attendanceId, data) {
    try {
      const existing = await this.prisma.attendance.findFirst({
        where: { id: attendanceId, companyId }
      });

      if (!existing) {
        throw new Error('السجل غير موجود');
      }

      const updated = await this.prisma.attendance.update({
        where: { id: attendanceId },
        data: {
          ...data,
          checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
          checkOut: data.checkOut ? new Date(data.checkOut) : undefined
        }
      });

      return updated;
    } catch (error) {
      console.error('❌ Error updating attendance:', error);
      throw error;
    }
  }

  /**
   * إنشاء سجل حضور يدوي
   */
  async createManualAttendance(companyId, data) {
    try {
      const attendance = await this.prisma.attendance.create({
        data: {
          companyId,
          employeeId: data.employeeId,
          date: new Date(data.date),
          checkIn: data.checkIn ? new Date(data.checkIn) : null,
          checkOut: data.checkOut ? new Date(data.checkOut) : null,
          status: data.status || 'PRESENT',
          notes: data.notes,
          checkInMethod: 'manual',
          checkOutMethod: 'manual'
        }
      });

      return attendance;
    } catch (error) {
      console.error('❌ Error creating manual attendance:', error);
      throw error;
    }
  }

  /**
   * تقرير الحضور الشهري
   */
  async getMonthlyReport(companyId, year, month, employeeId = null) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const where = {
        companyId,
        date: {
          gte: startDate,
          lte: endDate
        }
      };

      if (employeeId) where.employeeId = employeeId;

      const attendance = await this.prisma.attendance.findMany({
        where,
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

      // تجميع البيانات حسب الموظف
      const employeeStats = {};
      attendance.forEach(record => {
        const empId = record.employeeId;
        if (!employeeStats[empId]) {
          employeeStats[empId] = {
            employee: record.employee,
            presentDays: 0,
            lateDays: 0,
            absentDays: 0,
            totalWorkHours: 0,
            totalOvertimeHours: 0,
            totalLateMinutes: 0
          };
        }

        if (record.status === 'PRESENT' || record.status === 'LATE') {
          employeeStats[empId].presentDays++;
        }
        if (record.status === 'LATE') {
          employeeStats[empId].lateDays++;
        }
        if (record.status === 'ABSENT') {
          employeeStats[empId].absentDays++;
        }

        employeeStats[empId].totalWorkHours += parseFloat(record.workHours) || 0;
        employeeStats[empId].totalOvertimeHours += parseFloat(record.overtimeHours) || 0;
        employeeStats[empId].totalLateMinutes += record.lateMinutes || 0;
      });

      return {
        year,
        month,
        startDate,
        endDate,
        employees: Object.values(employeeStats)
      };
    } catch (error) {
      console.error('❌ Error getting monthly report:', error);
      throw error;
    }
  }

  /**
   * إحصائيات الحضور
   */
  async getAttendanceStats(companyId, startDate, endDate) {
    try {
      const where = {
        companyId,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };

      const [
        totalRecords,
        byStatus,
        avgWorkHours,
        totalOvertime
      ] = await Promise.all([
        this.prisma.attendance.count({ where }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where,
          _count: true
        }),
        this.prisma.attendance.aggregate({
          where,
          _avg: { workHours: true }
        }),
        this.prisma.attendance.aggregate({
          where,
          _sum: { overtimeHours: true }
        })
      ]);

      return {
        totalRecords,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        avgWorkHours: avgWorkHours._avg.workHours || 0,
        totalOvertimeHours: totalOvertime._sum.overtimeHours || 0
      };
    } catch (error) {
      console.error('❌ Error getting attendance stats:', error);
      throw error;
    }
  }
}

module.exports = new AttendanceService();
