const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
const prisma = getSharedPrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Email transporter configuration
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, companyName, phone } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'جميع الحقول مطلوبة'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مستخدم بالفعل'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create company first
    const company = await prisma.company.create({
      data: {
        name: companyName,
        email: email,
        phone: phone || null,
        plan: 'BASIC',
        isActive: true
      }
    });

    // Initialize default store pages for the new company
    try {
      const { initializeDefaultStorePages } = require('../utils/initializeCompanyDefaults');
      await initializeDefaultStorePages(company.id);
      console.log('✅ [REGISTER] Default store pages initialized for company:', company.id);
    } catch (error) {
      console.error('⚠️ [REGISTER] Failed to initialize default store pages:', error);
      // Don't fail registration if pages initialization fails
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'COMPANY_ADMIN',
        companyId: company.id,
        isActive: true
      }
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: company.id
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          companyId: user.companyId
        },
        company: {
          id: company.id,
          name: company.name,
          plan: company.plan
        },
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الحساب',
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 [AUTH] Login attempt for:', email);

    if (!email || !password) {
      console.log('❌ [AUTH] Missing email or password');
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
      });
    }

    // Ensure database is initialized
    try {
      await initializeSharedDatabase();
    } catch (initError) {
      console.error('❌ [AUTH] Database initialization error:', initError);
      // If it's a health check error, wait a bit and retry once
      if (initError.message.includes('Health check failed')) {
        console.log('🔄 [AUTH] Health check failed, waiting 2s and retrying initialization...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await initializeSharedDatabase();
          console.log('✅ [AUTH] Database initialization succeeded on retry');
        } catch (retryError) {
          console.error('❌ [AUTH] Database initialization failed on retry:', retryError);
          return res.status(503).json({
            success: false,
            message: 'فشل الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.',
            error: 'Database connection error'
          });
        }
      }
      // For other errors, continue anyway - might already be initialized
    }
    
    // Find user with company - wrap in retry logic for connection issues
    const user = await executeWithRetry(async () => {
      return await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              currency: true,
              isActive: true
            }
          }
        }
      });
    }, 3);

    if (!user) {
      console.log('❌ [AUTH] User not found:', email.toLowerCase());
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    console.log('✅ [AUTH] User found:', {
      email: user.email,
      isActive: user.isActive,
      hasCompany: !!user.company,
      companyActive: user.company?.isActive
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ [AUTH] User account is inactive');
      return res.status(401).json({
        success: false,
        message: 'الحساب غير مفعل'
      });
    }

    // Check if user has a company (required for non-super-admin users)
    if (!user.company) {
      console.log('❌ [AUTH] User has no company associated');
      // Only allow login without company if user is SUPER_ADMIN
      if (user.role !== 'SUPER_ADMIN') {
        return res.status(401).json({
          success: false,
          message: 'الحساب غير مرتبط بشركة'
        });
      }
    } else {
      // Check if company is active (only if company exists)
      if (!user.company.isActive) {
        console.log('❌ [AUTH] Company account is inactive');
        return res.status(401).json({
          success: false,
          message: 'حساب الشركة غير مفعل'
        });
      }
    }

    // Verify password
    console.log('🔑 [AUTH] Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('❌ [AUTH] Invalid password for user:', email);
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    console.log('✅ [AUTH] Password verified successfully');

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: userWithoutPassword,
        token,
        expiresIn: '24h'
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    
    // Provide more user-friendly error messages
    let errorMessage = 'فشل في تسجيل الدخول';
    let statusCode = 500;
    
    if (error.message.includes('Health check failed')) {
      errorMessage = 'فشل الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى بعد لحظات.';
      statusCode = 503;
    } else if (error.message.includes('Connection') || error.message.includes('timeout')) {
      errorMessage = 'فشل الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.';
      statusCode = 503;
    } else if (error.message.includes('max_connections_per_hour')) {
      errorMessage = 'تم تجاوز حد الاتصالات. يرجى المحاولة مرة أخرى لاحقاً.';
      statusCode = 503;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  }
};

const me = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'رمز المصادقة مطلوب'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // Get user with company
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true, // ✅ FIX: إضافة slug لبناء subdomain URL
            plan: true,
            currency: true,
            isActive: true
          }
        }
      }
    });

    if (!user || !user.isActive || !user.company.isActive) {
      return res.status(401).json({
        success: false,
        message: 'المستخدم غير موجود أو غير مفعل'
      });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(401).json({
      success: false,
      message: 'رمز المصادقة غير صحيح',
      error: error.message
    });
  }
};

const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح'
  });
}

// Forgot Password - Send reset token via email
const forgotPassword = async (req, res) => {
  try {
    console.log('🔐 [FORGOT-PASSWORD] Request received');
    const { email } = req.body;
    console.log('📧 [FORGOT-PASSWORD] Email:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'البريد الإلكتروني مطلوب'
      });
    }

    // Find user
    console.log('🔍 [FORGOT-PASSWORD] Searching for user...');
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        company: {
          select: {
            name: true
          }
        }
      }
    });

    // If user not found, check if they have a pending invitation
    if (!user) {
      console.log('⚠️ [FORGOT-PASSWORD] User not found in users table');
      console.log('🔍 [FORGOT-PASSWORD] Checking for pending invitation...');
      
      const invitation = await prisma.userInvitation.findFirst({
        where: {
          email: email.toLowerCase(),
          status: 'PENDING'
        }
      });

      if (invitation) {
        console.log('📨 [FORGOT-PASSWORD] Found pending invitation');
        return res.status(400).json({
          success: false,
          message: 'هذا البريد الإلكتروني لديه دعوة معلقة. يرجى قبول الدعوة أولاً لإنشاء حسابك، ثم يمكنك إعادة تعيين كلمة المرور.',
          code: 'PENDING_INVITATION'
        });
      }

      // No user and no invitation - return generic success for security
      console.log('⚠️ [FORGOT-PASSWORD] No user or invitation found');
      return res.json({
        success: true,
        message: 'إذا كان البريد الإلكتروني موجوداً، سيتم إرسال رابط إعادة تعيين كلمة المرور'
      });
    }

    console.log('✅ [FORGOT-PASSWORD] User found:', user.id);

    // Generate reset token
    console.log('🔑 [FORGOT-PASSWORD] Generating reset token...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to database
    console.log('💾 [FORGOT-PASSWORD] Saving token to database...');
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: resetTokenExpiry
      }
    });
    console.log('✅ [FORGOT-PASSWORD] Token saved to database');

    // Create reset link
    const resetLink = `https://mokhtarelhenawy.online/auth/reset-password?token=${resetToken}`;

    // Send email if SMTP is configured
    let emailSent = false;
    let emailError = null;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        console.log('📧 Attempting to send password reset email to:', email);
        await emailTransporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: email,
          subject: '🔐 إعادة تعيين كلمة المرور',
          html: `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px;">🔐 إعادة تعيين كلمة المرور</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="color: #333; margin-top: 0; font-size: 24px;">مرحباً ${user.firstName} ${user.lastName}،</h2>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك في <strong style="color: #667eea;">${user.company.name}</strong>.
                            </p>
                            
                            <div style="background-color: #fff3cd; border-right: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <p style="margin: 0; color: #856404;">
                                    ⚠️ <strong>هذا الرابط صالح لمدة ساعة واحدة فقط</strong>
                                </p>
                            </div>
                            
                            <p style="color: #555; font-size: 16px; line-height: 1.6;">
                                لإعادة تعيين كلمة المرور، انقر على الزر أدناه:
                            </p>
                            
                            <!-- Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${resetLink}" 
                                           style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                                  color: white; 
                                                  padding: 15px 40px; 
                                                  text-decoration: none; 
                                                  border-radius: 50px; 
                                                  display: inline-block; 
                                                  font-weight: bold; 
                                                  font-size: 16px;
                                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                            🔓 إعادة تعيين كلمة المرور
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="color: #999; font-size: 14px; line-height: 1.6; margin-top: 30px;">
                                أو انسخ الرابط التالي والصقه في المتصفح:
                            </p>
                            <p style="background-color: #f8f9fa; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; color: #667eea;">
                                ${resetLink}
                            </p>
                            
                            <div style="background-color: #f8d7da; border-right: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px;">
                                <p style="margin: 0; color: #721c24;">
                                    🔒 <strong>لم تطلب إعادة تعيين كلمة المرور؟</strong><br>
                                    يمكنك تجاهل هذا البريد بأمان. كلمة المرور الخاصة بك لن تتغير.
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8f9fa; padding: 20px 30px; border-radius: 0 0 10px 10px;">
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                ⏰ هذا الرابط صالح لمدة <strong>ساعة واحدة</strong> من وقت الإرسال
                            </p>
                            <p style="color: #999; font-size: 13px; margin: 5px 0; text-align: center;">
                                🔒 لأسباب أمنية، لا تشارك هذا الرابط مع أي شخص
                            </p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                            <p style="color: #999; font-size: 12px; margin: 0; text-align: center;">
                                © ${new Date().getFullYear()} ${user.company.name}. جميع الحقوق محفوظة.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
          `
        });
        emailSent = true;
        console.log('✅ Password reset email sent successfully to:', email);
      } catch (error) {
        emailError = error;
        console.error('❌ Error sending password reset email:', error);
        console.error('Error details:', {
          code: error.code,
          command: error.command,
          response: error.response,
          responseCode: error.responseCode
        });
      }
    } else {
      console.log('⚠️ SMTP not configured - email will not be sent');
    }

    res.json({
      success: true,
      message: emailSent 
        ? 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني'
        : 'تم إنشاء رابط إعادة التعيين (لم يتم إرسال البريد الإلكتروني)',
      emailSent,
      resetLink,
      emailError: emailError ? emailError.message : (emailSent ? null : 'SMTP not configured')
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في معالجة طلب إعادة تعيين كلمة المرور',
      error: error.message
    });
  }
};

// Reset Password - Verify token and update password
const resetPassword = async (req, res) => {
  try {
    console.log('🔐 [RESET-PASSWORD] Request received');
    console.log('📦 [RESET-PASSWORD] Body:', req.body);
    
    // Accept both 'password' and 'newPassword' for compatibility
    const { token, password, newPassword } = req.body;
    const passwordToUse = password || newPassword;

    if (!token || !passwordToUse) {
      return res.status(400).json({
        success: false,
        message: 'الرمز وكلمة المرور الجديدة مطلوبان'
      });
    }

    if (passwordToUse.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      });
    }

    // Hash the token to compare with database
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('🔑 [RESET-PASSWORD] Token hash:', resetTokenHash);

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: resetTokenHash,
        resetPasswordExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      console.log('⚠️ [RESET-PASSWORD] Invalid or expired token');
      
      // Check if token exists but expired
      const expiredUser = await prisma.user.findFirst({
        where: {
          resetPasswordToken: resetTokenHash
        }
      });
      
      if (expiredUser) {
        console.log('⏰ [RESET-PASSWORD] Token expired at:', expiredUser.resetPasswordExpires);
        return res.status(400).json({
          success: false,
          message: 'انتهت صلاحية رمز إعادة التعيين. يرجى طلب رابط جديد.'
        });
      }
      
      console.log('❌ [RESET-PASSWORD] Token not found in database');
      return res.status(400).json({
        success: false,
        message: 'رمز إعادة التعيين غير صحيح'
      });
    }

    console.log('✅ [RESET-PASSWORD] User found:', user.id);

    // Hash new password
    const hashedPassword = await bcrypt.hash(passwordToUse, 10);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        passwordChangedAt: new Date()
      }
    });

    console.log('✅ [RESET-PASSWORD] Password updated successfully');

    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إعادة تعيين كلمة المرور',
      error: error.message
    });
  }
};

module.exports = { register, login, me, logout, forgotPassword, resetPassword };