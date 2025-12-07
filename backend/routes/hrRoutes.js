/**
 * 👥 HR Routes
 * مسارات API للموارد البشرية
 */

const express = require('express');
const router = express.Router();
const hrController = require('../controller/hrController');
const { requireAuth } = require('../middleware/auth');

// تطبيق المصادقة على جميع المسارات
router.use(requireAuth);

// ═══════════════════════════════════════════════════════════════════════════════
// ⚙️ الإعدادات - Settings
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/settings', hrController.getHRSettings);
router.put('/settings', hrController.updateHRSettings);

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 لوحة التحكم - Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/dashboard', hrController.getHRDashboard);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 المزامنة - Sync
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/sync-users', hrController.syncUsersToEmployees);

// ═══════════════════════════════════════════════════════════════════════════════
// 🏢 الأقسام - Departments
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/departments/stats', hrController.getDepartmentStats);
router.get('/departments', hrController.getDepartments);
router.get('/departments/:id', hrController.getDepartmentById);
router.post('/departments', hrController.createDepartment);
router.put('/departments/:id', hrController.updateDepartment);
router.delete('/departments/:id', hrController.deleteDepartment);

// ═══════════════════════════════════════════════════════════════════════════════
// 👤 الموظفين - Employees
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/employees/stats', hrController.getEmployeeStats);
router.get('/employees/organization-chart', hrController.getOrganizationChart);
router.get('/employees', hrController.getEmployees);
router.get('/employees/:id', hrController.getEmployeeById);
router.post('/employees', hrController.createEmployee);
router.put('/employees/:id', hrController.updateEmployee);
router.delete('/employees/:id', hrController.deleteEmployee);
router.post('/employees/:id/terminate', hrController.terminateEmployee);
router.post('/employees/:id/link-user', hrController.linkEmployeeToUser);

// ═══════════════════════════════════════════════════════════════════════════════
// ⏰ الحضور والانصراف - Attendance
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/attendance/today', hrController.getTodayAttendance);
router.get('/attendance/stats', hrController.getAttendanceStats);
router.get('/attendance/monthly-report', hrController.getMonthlyAttendanceReport);
router.get('/attendance', hrController.getAttendance);
router.post('/attendance/check-in', hrController.checkIn);
router.post('/attendance/check-out', hrController.checkOut);
router.post('/attendance/manual', hrController.createManualAttendance);
router.put('/attendance/:id', hrController.updateAttendance);

// ═══════════════════════════════════════════════════════════════════════════════
// 🏖️ الإجازات - Leaves
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/leaves/stats', hrController.getLeaveStats);
router.get('/leaves/calendar', hrController.getLeaveCalendar);
router.get('/leaves/balance/:employeeId', hrController.getLeaveBalance);
router.get('/leaves', hrController.getLeaveRequests);
router.get('/leaves/:id', hrController.getLeaveRequestById);
router.post('/leaves', hrController.createLeaveRequest);
router.post('/leaves/:id/approve', hrController.approveLeaveRequest);
router.post('/leaves/:id/reject', hrController.rejectLeaveRequest);
router.post('/leaves/:id/cancel', hrController.cancelLeaveRequest);

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 الرواتب - Payroll
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/payroll/summary', hrController.getPayrollSummary);
router.get('/payroll/annual-report', hrController.getAnnualPayrollReport);
router.get('/payroll', hrController.getPayrolls);
router.get('/payroll/:id', hrController.getPayrollById);
router.post('/payroll', hrController.createPayroll);
router.post('/payroll/generate', hrController.generateMonthlyPayroll);
router.post('/payroll/bulk-pay', hrController.bulkMarkPayrollAsPaid);
router.put('/payroll/:id', hrController.updatePayroll);
router.post('/payroll/:id/approve', hrController.approvePayroll);
router.post('/payroll/:id/pay', hrController.markPayrollAsPaid);
router.delete('/payroll/:id', hrController.deletePayroll);

module.exports = router;
