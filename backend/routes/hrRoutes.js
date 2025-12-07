/**
 * 👥 HR Routes
 * مسارات API للموارد البشرية
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const hrController = require('../controller/hrController');
const { requireAuth } = require('../middleware/auth');

// تطبيق المصادقة على جميع المسارات
router.use(requireAuth);

// إعداد multer لرفع مستندات HR
const documentsDir = path.join(__dirname, '../public/uploads/hr/documents');
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${extension}`);
  }
});

const documentUpload = multer({
  storage: documentStorage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});

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
// 📊 تقييم الأداء - Performance Reviews
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/performance-reviews/stats', hrController.getPerformanceStats);
router.get('/performance-reviews/employee/:employeeId', hrController.getEmployeeReviews);
router.get('/performance-reviews/:id', hrController.getReviewById);
router.post('/performance-reviews', hrController.createPerformanceReview);
router.put('/performance-reviews/:id', hrController.updateReview);
router.delete('/performance-reviews/:id', hrController.deleteReview);

// ═══════════════════════════════════════════════════════════════════════════════
// 📚 التدريب - Training
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/trainings/stats', hrController.getTrainingStats);
router.get('/trainings/employee/:employeeId', hrController.getEmployeeTrainings);
router.get('/trainings/:id', hrController.getTrainingById);
router.post('/trainings', hrController.createTraining);
router.put('/trainings/:id', hrController.updateTraining);
router.delete('/trainings/:id', hrController.deleteTraining);

// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ الإنذارات - Warnings
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/warnings/stats', hrController.getWarningStats);
router.get('/warnings/employee/:employeeId', hrController.getEmployeeWarnings);
router.get('/warnings/:id', hrController.getWarningById);
router.post('/warnings', hrController.createWarning);
router.put('/warnings/:id', hrController.updateWarning);
router.post('/warnings/:id/acknowledge', hrController.acknowledgeWarning);
router.delete('/warnings/:id', hrController.deleteWarning);

// ═══════════════════════════════════════════════════════════════════════════════
// 💵 سجل الرواتب - Salary History
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/salary-history/stats', hrController.getSalaryHistoryStats);
router.get('/salary-history/promotions-report', hrController.getPromotionsReport);
router.get('/salary-history/employee/:employeeId', hrController.getEmployeeSalaryHistory);
router.get('/salary-history/:id', hrController.getSalaryHistoryById);
router.post('/salary-history', hrController.createSalaryHistory);

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 المستندات - Documents
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/documents/stats', hrController.getDocumentStats);
router.get('/documents/expired', hrController.getExpiredDocuments);
router.get('/documents/employee/:employeeId', hrController.getEmployeeDocuments);
router.get('/documents/:id', hrController.getDocumentById);
router.post('/documents', documentUpload.single('file'), hrController.createDocument);
router.put('/documents/:id', hrController.updateDocument);
router.post('/documents/:id/verify', hrController.verifyDocument);
router.delete('/documents/:id', hrController.deleteDocument);

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

// ═══════════════════════════════════════════════════════════════════════════════
// 🕐 المناوبات - Shifts
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/shifts/stats', hrController.getShiftStats);
router.get('/shifts', hrController.getShifts);
router.get('/shifts/:id', hrController.getShiftById);
router.post('/shifts', hrController.createShift);
router.put('/shifts/:id', hrController.updateShift);
router.delete('/shifts/:id', hrController.deleteShift);
router.post('/shifts/assign', hrController.assignShift);
router.get('/shifts/employee/:employeeId', hrController.getEmployeeAssignments);
router.delete('/shifts/assignments/:id', hrController.removeAssignment);

// ═══════════════════════════════════════════════════════════════════════════════
// 💎 المزايا - Benefits
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/benefits/stats', hrController.getBenefitStats);
router.get('/benefits', hrController.getBenefits);
router.get('/benefits/:id', hrController.getBenefitById);
router.post('/benefits', hrController.createBenefit);
router.put('/benefits/:id', hrController.updateBenefit);
router.delete('/benefits/:id', hrController.deleteBenefit);
router.post('/benefits/enroll', hrController.enrollEmployee);
router.get('/benefits/employee/:employeeId', hrController.getEmployeeEnrollments);
router.put('/benefits/enrollments/:id', hrController.updateEnrollment);

// ═══════════════════════════════════════════════════════════════════════════════
// 📈 الأهداف - Goals
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/goals/stats', hrController.getGoalStats);
router.get('/goals', hrController.getGoals);
router.get('/goals/:id', hrController.getGoalById);
router.post('/goals', hrController.createGoal);
router.put('/goals/:id', hrController.updateGoal);
router.delete('/goals/:id', hrController.deleteGoal);

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 التغذية الراجعة - Feedback
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/feedback/stats', hrController.getFeedbackStats);
router.get('/feedback', hrController.getFeedback);
router.get('/feedback/:id', hrController.getFeedbackById);
router.post('/feedback', hrController.createFeedback);
router.put('/feedback/:id', hrController.updateFeedback);
router.delete('/feedback/:id', hrController.deleteFeedback);

// ═══════════════════════════════════════════════════════════════════════════════
// 📝 الاستقالات - Resignations
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/resignations/stats', hrController.getResignationStats);
router.get('/resignations', hrController.getResignations);
router.get('/resignations/:id', hrController.getResignationById);
router.post('/resignations', hrController.createResignation);
router.put('/resignations/:id', hrController.updateResignation);

// ═══════════════════════════════════════════════════════════════════════════════
// 📅 العطلات الرسمية - Public Holidays
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/public-holidays', hrController.getPublicHolidays);
router.put('/public-holidays', hrController.updatePublicHolidays);

module.exports = router;
