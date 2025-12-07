/**
 * 👤 Employee Service
 * خدمة إدارة الموظفين
 */

const { getSharedPrismaClient } = require('../sharedDatabase');

class EmployeeService {
  constructor() {
    this.prisma = getSharedPrismaClient();
  }

  /**
   * إنشاء موظف جديد
   */
  async createEmployee(companyId, data) {
    try {
      // توليد رقم موظف تلقائي إذا لم يتم توفيره
      if (!data.employeeNumber) {
        const count = await this.prisma.employee.count({ where: { companyId } });
        data.employeeNumber = `EMP${String(count + 1).padStart(5, '0')}`;
      }

      const employee = await this.prisma.employee.create({
        data: {
          companyId,
          ...data,
          hireDate: new Date(data.hireDate),
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        },
        include: {
          department: true,
          position: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, avatar: true }
          },
          user: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      });

      return employee;
    } catch (error) {
      console.error('❌ Error creating employee:', error);
      throw error;
    }
  }

  /**
   * جلب جميع الموظفين (المستخدمين مع بيانات HR)
   * المستخدم = الموظف - لا حاجة لمزامنة
   */
  async getEmployees(companyId, options = {}) {
    try {
      const {
        page: pageStr = 1,
        limit: limitStr = 20,
        search,
        departmentId,
        positionId,
        status,
        contractType,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // تحويل page و limit إلى أرقام
      const page = parseInt(pageStr, 10) || 1;
      const limit = parseInt(limitStr, 10) || 20;

      // جلب المستخدمين مباشرة مع بيانات الموظف إن وجدت
      const userWhere = { 
        companyId,
        isActive: true
      };

      if (search) {
        userWhere.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } }
        ];
      }

      // فلترة حسب بيانات الموظف إن وجدت
      const employeeFilter = {};
      if (departmentId && departmentId !== 'all') employeeFilter.departmentId = departmentId;
      if (positionId && positionId !== 'all') employeeFilter.positionId = positionId;
      if (status && status !== 'all') employeeFilter.status = status;
      if (contractType && contractType !== 'all') employeeFilter.contractType = contractType;

      // إذا كان هناك فلاتر HR، نجلب فقط المستخدمين الذين لديهم employee record
      if (Object.keys(employeeFilter).length > 0) {
        userWhere.employee = employeeFilter;
      }

      console.log('🔍 [HR] Fetching users with where:', JSON.stringify(userWhere, null, 2));
      
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where: userWhere,
          include: {
            employee: {
              include: {
                department: { select: { id: true, name: true, color: true } },
                position: { select: { id: true, title: true, level: true } },
                manager: { select: { id: true, firstName: true, lastName: true, avatar: true } }
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.user.count({ where: userWhere })
      ]);
      
      console.log('✅ [HR] Found users:', total, 'Returned:', users.length);

      // تحويل البيانات لتتوافق مع الـ frontend
      const employees = users.map(user => ({
        id: user.employee?.id || user.id,
        userId: user.id,
        employeeNumber: user.employee?.employeeNumber || `USR-${user.id.slice(-6).toUpperCase()}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || user.employee?.phone,
        avatar: user.avatar || user.employee?.avatar,
        status: user.employee?.status || 'ACTIVE',
        contractType: user.employee?.contractType || 'FULL_TIME',
        hireDate: user.employee?.hireDate || user.createdAt,
        department: user.employee?.department || null,
        position: user.employee?.position || null,
        manager: user.employee?.manager || null,
        hasEmployeeRecord: !!user.employee
      }));

      return {
        employees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('❌ Error getting employees:', error);
      throw error;
    }
  }

  /**
   * جلب موظف بالـ ID
   */
  async getEmployeeById(companyId, employeeId) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId },
        include: {
          department: true,
          position: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, avatar: true, email: true }
          },
          subordinates: {
            select: { id: true, firstName: true, lastName: true, avatar: true, position: true }
          },
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, role: true }
          },
          documents_rel: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          leaveRequests: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          attendances: {
            orderBy: { date: 'desc' },
            take: 30
          }
        }
      });

      return employee;
    } catch (error) {
      console.error('❌ Error getting employee:', error);
      throw error;
    }
  }

  /**
   * تحديث موظف
   */
  async updateEmployee(companyId, employeeId, data) {
    try {
      // التحقق من وجود الموظف
      const existing = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });

      if (!existing) {
        throw new Error('الموظف غير موجود');
      }

      // تحويل التواريخ
      if (data.hireDate) data.hireDate = new Date(data.hireDate);
      if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
      if (data.probationEndDate) data.probationEndDate = new Date(data.probationEndDate);
      if (data.contractEndDate) data.contractEndDate = new Date(data.contractEndDate);
      if (data.terminationDate) data.terminationDate = new Date(data.terminationDate);

      // تسجيل تغيير الراتب إذا تغير
      if (data.baseSalary && existing.baseSalary && 
          parseFloat(data.baseSalary) !== parseFloat(existing.baseSalary)) {
        await this.prisma.salaryHistory.create({
          data: {
            companyId,
            employeeId,
            previousSalary: existing.baseSalary,
            newSalary: data.baseSalary,
            changeType: 'adjustment',
            changePercentage: ((data.baseSalary - existing.baseSalary) / existing.baseSalary * 100),
            effectiveDate: new Date()
          }
        });
      }

      const employee = await this.prisma.employee.update({
        where: { id: employeeId },
        data,
        include: {
          department: true,
          position: true,
          manager: {
            select: { id: true, firstName: true, lastName: true, avatar: true }
          }
        }
      });

      return employee;
    } catch (error) {
      console.error('❌ Error updating employee:', error);
      throw error;
    }
  }

  /**
   * حذف موظف
   */
  async deleteEmployee(companyId, employeeId) {
    try {
      const existing = await this.prisma.employee.findFirst({
        where: { id: employeeId, companyId }
      });

      if (!existing) {
        throw new Error('الموظف غير موجود');
      }

      await this.prisma.employee.delete({
        where: { id: employeeId }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting employee:', error);
      throw error;
    }
  }

  /**
   * إنهاء خدمة موظف
   */
  async terminateEmployee(companyId, employeeId, data) {
    try {
      const employee = await this.prisma.employee.update({
        where: { id: employeeId },
        data: {
          status: data.status || 'TERMINATED',
          terminationDate: new Date(data.terminationDate),
          terminationReason: data.reason
        }
      });

      return employee;
    } catch (error) {
      console.error('❌ Error terminating employee:', error);
      throw error;
    }
  }

  /**
   * ربط موظف بحساب مستخدم
   */
  async linkToUser(companyId, employeeId, userId) {
    try {
      const employee = await this.prisma.employee.update({
        where: { id: employeeId },
        data: { userId },
        include: { user: true }
      });

      return employee;
    } catch (error) {
      console.error('❌ Error linking employee to user:', error);
      throw error;
    }
  }

  /**
   * جلب الهيكل التنظيمي
   */
  async getOrganizationChart(companyId) {
    try {
      const employees = await this.prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          managerId: true,
          departmentId: true,
          positionId: true,
          department: { select: { id: true, name: true, color: true } },
          position: { select: { id: true, title: true, level: true } }
        }
      });

      // بناء الشجرة
      const buildTree = (managerId = null) => {
        return employees
          .filter(emp => emp.managerId === managerId)
          .map(emp => ({
            ...emp,
            subordinates: buildTree(emp.id)
          }));
      };

      return buildTree(null);
    } catch (error) {
      console.error('❌ Error getting organization chart:', error);
      throw error;
    }
  }

  /**
   * إحصائيات الموظفين
   */
  async getEmployeeStats(companyId) {
    try {
      const [
        totalEmployees,
        activeEmployees,
        byDepartment,
        byContractType,
        byStatus,
        recentHires,
        upcomingBirthdays
      ] = await Promise.all([
        this.prisma.employee.count({ where: { companyId } }),
        this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
        this.prisma.employee.groupBy({
          by: ['departmentId'],
          where: { companyId, status: 'ACTIVE' },
          _count: true
        }),
        this.prisma.employee.groupBy({
          by: ['contractType'],
          where: { companyId, status: 'ACTIVE' },
          _count: true
        }),
        this.prisma.employee.groupBy({
          by: ['status'],
          where: { companyId },
          _count: true
        }),
        this.prisma.employee.findMany({
          where: { companyId },
          orderBy: { hireDate: 'desc' },
          take: 5,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            hireDate: true,
            position: { select: { title: true } }
          }
        }),
        this.prisma.employee.findMany({
          where: {
            companyId,
            status: 'ACTIVE',
            dateOfBirth: { not: null }
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            dateOfBirth: true,
            department: { select: { name: true } }
          }
        })
      ]);

      // حساب أعياد الميلاد القادمة
      const today = new Date();
      const upcoming = upcomingBirthdays
        .map(emp => {
          const bday = new Date(emp.dateOfBirth);
          const nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
          if (nextBday < today) {
            nextBday.setFullYear(today.getFullYear() + 1);
          }
          return { ...emp, nextBirthday: nextBday };
        })
        .sort((a, b) => a.nextBirthday - b.nextBirthday)
        .slice(0, 5);

      return {
        totalEmployees,
        activeEmployees,
        byDepartment,
        byContractType,
        byStatus,
        recentHires,
        upcomingBirthdays: upcoming
      };
    } catch (error) {
      console.error('❌ Error getting employee stats:', error);
      throw error;
    }
  }
}

module.exports = new EmployeeService();
