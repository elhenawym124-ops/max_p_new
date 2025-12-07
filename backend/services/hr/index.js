/**
 * 👥 HR Services Index
 * تصدير جميع خدمات الموارد البشرية
 */

const employeeService = require('./employeeService');
const departmentService = require('./departmentService');
const attendanceService = require('./attendanceService');
const leaveService = require('./leaveService');
const payrollService = require('./payrollService');
const documentService = require('./documentService');
const salaryHistoryService = require('./salaryHistoryService');
const performanceService = require('./performanceService');
const trainingService = require('./trainingService');
const warningService = require('./warningService');
const shiftService = require('./shiftService');
const benefitService = require('./benefitService');
const goalService = require('./goalService');
const feedbackService = require('./feedbackService');
const resignationService = require('./resignationService');

module.exports = {
  employeeService,
  departmentService,
  attendanceService,
  leaveService,
  payrollService,
  documentService,
  salaryHistoryService,
  performanceService,
  trainingService,
  warningService,
  shiftService,
  benefitService,
  goalService,
  feedbackService,
  resignationService
};
