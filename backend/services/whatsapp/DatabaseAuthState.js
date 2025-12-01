/**
 * 📱 Database Auth State Adapter for Baileys
 * تخزين بيانات المصادقة في قاعدة البيانات بدلاً من ملفات JSON
 * 
 * هذا يحل مشكلة كثرة الملفات ويحسن الأداء
 */

const { getSharedPrismaClient } = require('../sharedDatabase');
const prisma = getSharedPrismaClient();

// Cache للحالة لتقليل استعلامات قاعدة البيانات
const authStateCache = new Map();

// Debounce timer للحفظ لتقليل استعلامات قاعدة البيانات
const saveTimers = new Map();
const SAVE_DEBOUNCE_MS = 1000; // حفظ بعد ثانية واحدة من آخر تحديث

/**
 * استخدام قاعدة البيانات لتخزين حالة المصادقة
 * @param {string} sessionId - معرف الجلسة
 * @returns {Promise<{state: object, saveCreds: function}>}
 */
async function useDatabaseAuthState(sessionId) {
    // تحميل البيانات من قاعدة البيانات
    let authData = await loadAuthState(sessionId);

    // تهيئة الحالة
    let state = {
        creds: authData.creds || null,
        keys: {}
    };

    // دالة تحميل الحالة من قاعدة البيانات
    async function loadAuthState(sessionId) {
        // التحقق من الـ cache أولاً
        if (authStateCache.has(sessionId)) {
            return authStateCache.get(sessionId);
        }

        const session = await prisma.whatsAppSession.findUnique({
            where: { id: sessionId },
            select: { authState: true }
        });

        let authData = { creds: null, keys: {} };

        if (session?.authState) {
            try {
                authData = JSON.parse(session.authState);
            } catch (error) {
                console.error(`❌ Error parsing auth state for session ${sessionId}:`, error);
            }
        }

        // حفظ في الـ cache
        authStateCache.set(sessionId, authData);
        return authData;
    }

    // دالة حفظ الحالة في قاعدة البيانات (مع debouncing)
    async function saveAuthState(immediate = false) {
        // إلغاء الـ timer السابق إن وجد
        if (saveTimers.has(sessionId)) {
            clearTimeout(saveTimers.get(sessionId));
            saveTimers.delete(sessionId);
        }

        // إذا كان فوري (مثل عند حفظ creds) أو debounce
        const saveFunction = async () => {
            try {
                const dataToSave = {
                    creds: state.creds,
                    keys: state.keys
                };

                await prisma.whatsAppSession.update({
                    where: { id: sessionId },
                    data: {
                        authState: JSON.stringify(dataToSave),
                        updatedAt: new Date()
                    }
                });

                // تحديث الـ cache
                authStateCache.set(sessionId, dataToSave);

                console.log(`✅ Auth state saved to database for session ${sessionId}`);
            } catch (error) {
                console.error(`❌ Error saving auth state for session ${sessionId}:`, error);
            } finally {
                saveTimers.delete(sessionId);
            }
        };

        if (immediate) {
            await saveFunction();
        } else {
            // Debounce: انتظر قبل الحفظ
            const timer = setTimeout(saveFunction, SAVE_DEBOUNCE_MS);
            saveTimers.set(sessionId, timer);
        }
    }

    // إنشاء key management object متوافق مع Baileys
    // Baileys يتوقع keys object بهذا الشكل:
    // keys.get(type, ids) -> returns object of {id: data}
    // keys.set(data) -> data is {type: {id: data}}
    const keys = {
        get: async (type, ids) => {
            // إعادة تحميل من قاعدة البيانات للتأكد من أحدث البيانات
            authData = await loadAuthState(sessionId);
            
            if (!authData.keys || !authData.keys[type]) {
                return {};
            }

            const result = {};
            for (const id of ids) {
                const keyId = String(id);
                if (authData.keys[type][keyId]) {
                    result[keyId] = authData.keys[type][keyId];
                }
            }
            return result;
        },
        set: async (data) => {
            // تحديث المفاتيح في الذاكرة أولاً
            if (!state.keys) {
                state.keys = {};
            }

            // data format: { 'session': { 'id1': {...}, 'id2': {...} }, 'pre-key': {...} }
            for (const category in data) {
                if (!state.keys[category]) {
                    state.keys[category] = {};
                }
                
                // دمج البيانات الجديدة
                for (const keyId in data[category]) {
                    state.keys[category][String(keyId)] = data[category][keyId];
                }
            }

            // حفظ في قاعدة البيانات (debounced لتقليل الاستعلامات)
            await saveAuthState();
        }
    };

    // ربط keys object بالحالة
    state.keys = keys;

    // دالة حفظ بيانات المصادقة (فوري - بدون debounce)
    const saveCreds = async () => {
        await saveAuthState(true); // immediate = true
    };

    return {
        state,
        saveCreds
    };
}

module.exports = {
    useDatabaseAuthState
};

