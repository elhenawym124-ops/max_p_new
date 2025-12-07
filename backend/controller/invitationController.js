const { getSharedPrismaClient, initializeSharedDatabase, executeWithRetry } = require('../services/sharedDatabase');
// const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const verifyInvitationToken = async (req, res) => {
    try {
        const { token } = req.params;

        const invitation = await getSharedPrismaClient().userInvitation.findUnique({
            where: { token },
            include: {
                company: {
                    select: {
                        name: true
                    }
                },
                inviter: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'رابط الدعوة غير صحيح'
            });
        }

        if (invitation.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'هذه الدعوة غير صالحة أو تم استخدامها بالفعل'
            });
        }

        if (new Date() > invitation.expiresAt) {
            await getSharedPrismaClient().userInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' }
            });

            return res.status(400).json({
                success: false,
                message: 'انتهت صلاحية هذه الدعوة'
            });
        }

        res.json({
            success: true,
            message: 'الدعوة صالحة',
            data: {
                invitation: {
                    id: invitation.id,
                    email: invitation.email,
                    firstName: invitation.firstName,
                    lastName: invitation.lastName,
                    role: invitation.role,
                    companyName: invitation.company.name,
                    inviterName: `${invitation.inviter.firstName} ${invitation.inviter.lastName}`,
                    expiresAt: invitation.expiresAt
                }
            }
        });

    } catch (error) {
        console.error('❌ Error verifying invitation:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في التحقق من الدعوة',
            error: error.message
        });
    }
};

const acceptInvitation = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'كلمة المرور مطلوبة ويجب أن تكون 6 أحرف على الأقل'
            });
        }

        const invitation = await getSharedPrismaClient().userInvitation.findUnique({
            where: { token }
        });

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'رابط الدعوة غير صحيح'
            });
        }

        if (invitation.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                message: 'هذه الدعوة غير صالحة أو تم استخدامها بالفعل'
            });
        }

        if (new Date() > invitation.expiresAt) {
            await getSharedPrismaClient().userInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' }
            });

            return res.status(400).json({
                success: false,
                message: 'انتهت صلاحية هذه الدعوة'
            });
        }

        // Check if user already exists
        const existingUser = await getSharedPrismaClient().user.findUnique({
            where: { email: invitation.email }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'مستخدم بهذا البريد الإلكتروني موجود بالفعل'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await getSharedPrismaClient().user.create({
            data: {
                email: invitation.email,
                password: hashedPassword,
                firstName: invitation.firstName,
                lastName: invitation.lastName,
                role: invitation.role,
                companyId: invitation.companyId,
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date()
            }
        });

        // Auto-create employee record for the new user
        try {
            const employeeCount = await getSharedPrismaClient().employee.count({ 
                where: { companyId: invitation.companyId } 
            });
            const employeeNumber = `EMP${String(employeeCount + 1).padStart(5, '0')}`;
            
            await getSharedPrismaClient().employee.create({
                data: {
                    companyId: invitation.companyId,
                    userId: user.id,
                    employeeNumber,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    hireDate: new Date(),
                    status: 'ACTIVE',
                    contractType: 'FULL_TIME'
                }
            });
            
            console.log('✅ [INVITATION] Employee record created for user:', user.email);
        } catch (error) {
            console.error('⚠️ [INVITATION] Failed to create employee record:', error);
            // Don't fail invitation acceptance if employee creation fails
        }

        // Update invitation status
        await getSharedPrismaClient().userInvitation.update({
            where: { id: invitation.id },
            data: {
                status: 'ACCEPTED',
                acceptedAt: new Date()
            }
        });

        // Generate JWT token
        const jwtToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                companyId: user.companyId
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'تم قبول الدعوة وإنشاء الحساب بنجاح',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    companyId: user.companyId
                },
                token: jwtToken,
                expiresIn: '24h'
            }
        });

    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        res.status(500).json({
            success: false,
            message: 'فشل في قبول الدعوة',
            error: error.message
        });
    }
};

module.exports ={
    verifyInvitationToken ,
    acceptInvitation
}
