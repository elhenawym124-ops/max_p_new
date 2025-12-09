
/**
 * Shared Database Service - ULTIMATE FIX for "Engine is not yet connected"
 * SOLUTION: Complete connection management overhaul
 */

const { PrismaClient } = require('@prisma/client');

// Global shared instance
let sharedPrismaInstance = null;
let queryCount = 0;
let connectionCount = 0;
let isInitialized = false;

// ✅ FIX: Advanced connection management
let connectionManager = {
  isConnecting: false,
  lastConnectionAttempt: 0,
  connectionPromise: null,
  healthCheckInterval: null,
  lastSuccessfulQuery: 0,
  connectionRetryCount: 0
};

// Circuit breaker state
let connectionLimitReached = false;
let connectionLimitResetTime = null;
const CONNECTION_LIMIT_COOLDOWN = 60 * 60 * 1000; // 1 hour

// Query queue management
const queryQueue = [];
let isProcessingQueue = false;
const MAX_CONCURRENT_QUERIES = 25; // ⚡ INCREASED: Allow more concurrent queries to prevent queue buildup (was 10)
let activeQueries = 0;

// Health monitoring
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds
const MAX_RETRY_ATTEMPTS = 2; // ✅ Reduced retries

/**
 * Create optimized PrismaClient with connection stability focus
 */
function createStablePrismaClient() {
  console.log('🔧 [SharedDB] Creating stable PrismaClient...');

  const databaseUrl = process.env.DATABASE_URL;
  const urlWithParams = new URL(databaseUrl);

  // ⚡ PERFORMANCE FOCUS: Increased limits to prevent queue buildup
  urlWithParams.searchParams.set('connection_limit', '25');       // ⚡ INCREASED: 25 connections (was 10) to match concurrent queries
  urlWithParams.searchParams.set('pool_timeout', '30');           // ✅ 30 seconds
  urlWithParams.searchParams.set('connect_timeout', '30');        // ✅ 30 seconds (Increased from 10)
  urlWithParams.searchParams.set('socket_timeout', '30');         // ✅ 30 seconds
  urlWithParams.searchParams.set('statement_timeout', '15000');   // ⚡ REDUCED: 15 seconds (was 20) to fail fast on slow queries
  urlWithParams.searchParams.set('pgbouncer', 'true');            // ✅ Enable pooling

  const client = new PrismaClient({
    datasources: {
      db: {
        url: urlWithParams.toString()
      }
    },
    log: ['error'], // ✅ Only errors
    errorFormat: 'minimal'
  });

  // Track queries
  client.$on('query', () => {
    queryCount++;
    connectionCount++;
    connectionManager.lastSuccessfulQuery = Date.now();
    connectionManager.connectionRetryCount = 0; // Reset on successful query
  });

  return client;
}

/**
 * ✅ ULTIMATE FIX: Guaranteed connection with timeout and retry
 */
async function guaranteeConnection() {
  // If already connected and healthy, return immediately
  if (isInitialized && sharedPrismaInstance) {
    try {
      await Promise.race([
        sharedPrismaInstance.$queryRaw`SELECT 1 as quick_check`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Quick check timeout')), 5000)
        )
      ]);
      return true;
    } catch (error) {
      console.log('⚠️ [SharedDB] Quick health check failed, reconnecting...');
      isInitialized = false;
    }
  }

  // Prevent multiple simultaneous connection attempts
  if (connectionManager.isConnecting && connectionManager.connectionPromise) {
    console.log('🔄 [SharedDB] Waiting for existing connection attempt...');
    return await connectionManager.connectionPromise;
  }

  connectionManager.isConnecting = true;
  connectionManager.lastConnectionAttempt = Date.now();
  connectionManager.connectionRetryCount++;

  const connectionPromise = (async () => {
    const maxConnectionRetries = 3;

    for (let attempt = 1; attempt <= maxConnectionRetries; attempt++) {
      try {
        console.log(`🔄 [SharedDB] Connection attempt ${attempt}/${maxConnectionRetries}...`);

        // Clean up any existing instance
        if (sharedPrismaInstance) {
          try {
            await sharedPrismaInstance.$disconnect();
          } catch (disconnectError) {
            // Ignore disconnect errors
          }
          sharedPrismaInstance = null;
        }

        // Create new instance
        sharedPrismaInstance = createStablePrismaClient();

        // Connect with timeout
        await Promise.race([
          sharedPrismaInstance.$connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_TIMEOUT)
          )
        ]);

        // Verify connection with simple query
        await Promise.race([
          sharedPrismaInstance.$queryRaw`SELECT 1 as connection_verify`,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Verification timeout')), 5000)
          )
        ]);

        isInitialized = true;
        connectionManager.lastSuccessfulQuery = Date.now();
        connectionManager.connectionRetryCount = 0;

        console.log('✅ [SharedDB] Database connection established and verified');
        return true;

      } catch (error) {
        console.error(`❌ [SharedDB] Connection attempt ${attempt} failed:`, error.message);

        if (attempt < maxConnectionRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`⏳ [SharedDB] Retrying connection in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }

        // All retries failed
        isInitialized = false;
        sharedPrismaInstance = null;
        throw new Error(`All connection attempts failed: ${error.message}`);
      }
    }
  })();

  connectionManager.connectionPromise = connectionPromise;

  try {
    const result = await connectionPromise;
    return result;
  } finally {
    connectionManager.isConnecting = false;
    connectionManager.connectionPromise = null;
  }
}

/**
 * ✅ ULTIMATE FIX: Smart query execution with connection guarantee and timeout
 */
async function executeQuerySafely(operation, operationName = 'unknown') {
  // Ensure we have a valid connection before executing
  await guaranteeConnection();

  if (!isInitialized || !sharedPrismaInstance) {
    throw new Error('No database connection available');
  }

  let lastError;

  // ⚡ NEW: Add query timeout (10 seconds max per query)
  const QUERY_TIMEOUT = 10000; // 10 seconds

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      // ⚡ NEW: Execute query with timeout
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout after ${QUERY_TIMEOUT}ms`)), QUERY_TIMEOUT)
        )
      ]);

      if (attempt > 1) {
        console.log(`✅ [SharedDB] Query "${operationName}" succeeded on attempt ${attempt}`);
      }

      return result;

    } catch (error) {
      lastError = error;

      // ⚡ NEW: Log slow queries
      if (error.message.includes('timeout')) {
        console.warn(`⏰ [SharedDB] Query "${operationName}" timed out after ${QUERY_TIMEOUT}ms`);
      }

      // Check if this is a connection error
      const isConnectionError =
        error.message.includes('Engine is not yet connected') ||
        error.message.includes('not yet connected') ||
        error.message.includes('Response from the Engine was empty') ||
        error.message.includes('Engine has died') ||
        error.message.includes('Connection') ||
        error.message.includes('timeout') ||
        error.code === 'P1001' ||
        error.code === 'P1008' ||
        error.code === 'P1017';

      if (isConnectionError && attempt < MAX_RETRY_ATTEMPTS) {
        // Reset connection state
        isInitialized = false;

        // Wait before retry with exponential backoff
        const delay = Math.min(500 * Math.pow(2, attempt - 1), 5000);
        console.log(`🔄 [SharedDB] Connection error in "${operationName}", retry ${attempt + 1}/${MAX_RETRY_ATTEMPTS} in ${delay}ms`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // Try to reestablish connection before next attempt
        try {
          await guaranteeConnection();
        } catch (connectionError) {
          console.error(`❌ [SharedDB] Reconnection failed:`, connectionError.message);
        }

        continue;
      }

      // Non-retryable error or max retries reached
      break;
    }
  }

  // If we get here, all retries failed
  console.error(`❌ [SharedDB] All retries failed for "${operationName}":`, lastError.message);
  throw lastError;
}

/**
 * Queue-based execution with connection safety
 */
async function executeWithQueue(operation, priority = 0) {
  // ⚡ OPTIMIZATION: If queue is empty and we have capacity, execute immediately
  if (queryQueue.length === 0 && activeQueries < MAX_CONCURRENT_QUERIES) {
    activeQueries++;
    const operationName = operation.name || 'anonymous';
    try {
      const result = await executeQuerySafely(operation, operationName);
      return result;
    } finally {
      activeQueries--;
      processQueue(); // Process any queued items
    }
  }

  return new Promise((resolve, reject) => {
    // Extract operation name for logging
    const operationName = operation.name || 'anonymous';

    const wrappedOperation = async () => {
      return await executeQuerySafely(operation, operationName);
    };

    const queueItem = {
      operation: wrappedOperation,
      priority,
      resolve,
      reject,
      timestamp: Date.now()
    };

    queryQueue.push(queueItem);

    // Sort by priority (higher first)
    queryQueue.sort((a, b) => b.priority - a.priority);

    // ⚡ WARNING: Log if queue is getting large (reduced threshold)
    if (queryQueue.length > 50) {
      console.warn(`⚠️ [SharedDB] Query queue is large: ${queryQueue.length} queries waiting, ${activeQueries} active`);

      // ⚡ NEW: Log oldest query in queue
      if (queryQueue.length > 0) {
        const oldestQuery = queryQueue[0];
        const queueAge = Date.now() - oldestQuery.timestamp;
        if (queueAge > 5000) {
          console.error(`🚨 [SharedDB] Oldest query in queue is ${queueAge}ms old! Queue may be stuck.`);
        }
      }
    }

    processQueue();
  });
}

/**
 * Process query queue (optimized for high load)
 */
async function processQueue() {
  if (isProcessingQueue) return;
  if (queryQueue.length === 0) return;
  if (activeQueries >= MAX_CONCURRENT_QUERIES) return;

  isProcessingQueue = true;

  // ⚡ OPTIMIZATION: Process multiple items in parallel
  const itemsToProcess = Math.min(
    queryQueue.length,
    MAX_CONCURRENT_QUERIES - activeQueries
  );

  const items = [];
  for (let i = 0; i < itemsToProcess; i++) {
    const item = queryQueue.shift();
    if (!item) break;
    items.push(item);
  }

  // Process all items in parallel
  items.forEach(item => {
    activeQueries++;

    item.operation()
      .then(item.resolve)
      .catch(item.reject)
      .finally(() => {
        activeQueries--;
        // Continue processing queue after each item completes
        setImmediate(() => processQueue());
      });
  });

  isProcessingQueue = false;

  // ⚡ NEW: If queue is still large, schedule another processing round
  if (queryQueue.length > 0 && activeQueries < MAX_CONCURRENT_QUERIES) {
    setImmediate(() => processQueue());
  }
}

/**
 * Start health monitoring
 */
function startHealthMonitoring() {
  if (connectionManager.healthCheckInterval) {
    clearInterval(connectionManager.healthCheckInterval);
  }

  connectionManager.healthCheckInterval = setInterval(async () => {
    if (!sharedPrismaInstance || connectionManager.isConnecting) {
      return;
    }

    // Don't check if there was recent activity
    const timeSinceLastSuccess = Date.now() - connectionManager.lastSuccessfulQuery;
    if (timeSinceLastSuccess < 15000) { // 15 seconds
      return;
    }

    try {
      await Promise.race([
        sharedPrismaInstance.$queryRaw`SELECT 1 as health_check`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);
    } catch (error) {
      console.log('⚠️ [SharedDB] Health monitor detected connection issue');
      isInitialized = false;
    }
  }, HEALTH_CHECK_INTERVAL);
}

/**
 * Get shared PrismaClient instance
 */
function getSharedPrismaClient() {
  if (!sharedPrismaInstance) {
    sharedPrismaInstance = createStablePrismaClient();
    console.log('✅ [SharedDB] Stable PrismaClient created');
    startHealthMonitoring();
  }

  return sharedPrismaInstance;
}

/**
 * Check if we're in cooldown period
 */
function isInConnectionLimitCooldown() {
  if (!connectionLimitReached) return false;

  if (connectionLimitResetTime && Date.now() > connectionLimitResetTime) {
    connectionLimitReached = false;
    connectionLimitResetTime = null;
    console.log('✅ [SharedDB] Cooldown period ended');
    return false;
  }

  return true;
}

/**
 * Set connection limit flag with cooldown
 */
function setConnectionLimitReached() {
  if (!connectionLimitReached) {
    connectionLimitReached = true;
    connectionLimitResetTime = Date.now() + CONNECTION_LIMIT_COOLDOWN;
    console.log('🚨 [SharedDB] Connection limit reached - 1 hour cooldown');
  }
}

/**
 * Enhanced retry logic
 */
async function executeWithRetry(operation, maxRetries = 5, initialDelay = 2000) {
  // Circuit breaker check
  if (isInConnectionLimitCooldown()) {
    const remainingTime = Math.ceil((connectionLimitResetTime - Date.now()) / 1000 / 60);
    throw new Error(`Database in cooldown. Retry after ${remainingTime} minutes.`);
  }

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await operation();

      if (attempt > 1) {
        console.log(`✅ [SharedDB] Query succeeded on attempt ${attempt}`);
      }

      return result;

    } catch (error) {
      lastError = error;

      // Detect connection limit error
      const isConnectionLimitError =
        error.message.includes('max_connections_per_hour') ||
        error.message.includes('ERROR 42000 (1226)') ||
        (error.code === 1226);

      if (isConnectionLimitError) {
        setConnectionLimitReached();
        throw new Error(`Database connection limit exceeded. 1-hour cooldown activated.`);
      }

      // Other retryable errors
      const isRetryable =
        error.message.includes('Connection') ||
        error.message.includes('timeout') ||
        error.message.includes('Engine is not yet connected') ||
        error.message.includes('not yet connected') ||
        error.message.includes('Response from the Engine was empty') ||
        error.message.includes('Engine has died') ||
        error.code === 'P1001' ||
        error.code === 'P1008' ||
        error.message.includes('ECONNREFUSED');

      if (isRetryable && attempt < maxRetries) {
        // Exponential backoff with jitter
        const backoff = Math.min(delay * Math.pow(2, attempt - 1), 30000);
        const jitter = Math.random() * 1000;
        delay = backoff + jitter;

        console.log(`⚠️ [SharedDB] Connection error, retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`);
        continue;
      }

      // Non-retryable error
      if (!isRetryable) {
        throw error;
      }
    }
  }

  throw lastError;
}

/**
 * Initialize database
 */
async function initializeSharedDatabase() {
  try {
    console.log('🔧 [SharedDB] Starting database initialization...');

    // const prisma = getSharedPrismaClient(); // ❌ Removed to prevent early loading issues

    // Use the new guaranteed connection approach
    await guaranteeConnection();

    // Test query
    await executeWithQueue(async () => {
      await getSharedPrismaClient().$queryRaw`SELECT 1 as test`;
      console.log('✅ [SharedDB] Database test successful');
    }, 10);

    return true;

  } catch (error) {
    console.error('❌ [SharedDB] Initialization failed:', error.message);
    throw error;
  }
}

/**
 * Wrapper for safe database queries
 */
async function safeQuery(operation, priority = 0) {
  return executeWithQueue(operation, priority);
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    if (!sharedPrismaInstance) {
      return {
        status: 'disconnected',
        error: 'No instance',
        connectionLimitStatus: connectionLimitReached ? 'cooldown' : 'normal'
      };
    }

    if (isInConnectionLimitCooldown()) {
      return {
        status: 'cooldown',
        connectionLimitStatus: 'active',
        cooldownEndsAt: connectionLimitResetTime,
        remainingMinutes: Math.ceil((connectionLimitResetTime - Date.now()) / 1000 / 60)
      };
    }

    await safeQuery(async () => {
      await sharedPrismaInstance.$queryRaw`SELECT 1 as health`;
    }, -10);

    return {
      status: 'healthy',
      queryCount,
      connectionCount,
      isInitialized,
      queueLength: queryQueue.length,
      activeQueries,
      connectionLimitStatus: 'normal'
    };

  } catch (error) {
    return {
      status: error.message.includes('cooldown') ? 'cooldown' : 'error',
      error: error.message.substring(0, 200),
      queryCount,
      connectionCount,
      queueLength: queryQueue.length,
      connectionLimitStatus: connectionLimitReached ? 'active' : 'normal'
    };
  }
}

/**
 * Get connection statistics
 */
function getConnectionStats() {
  return {
    isInitialized,
    queryCount,
    connectionCount,
    hasInstance: !!sharedPrismaInstance,
    queueLength: queryQueue.length,
    activeQueries,
    inCooldown: connectionLimitReached,
    cooldownEndsAt: connectionLimitResetTime,
    isConnecting: connectionManager.isConnecting,
    connectionRetryCount: connectionManager.connectionRetryCount
  };
}

/**
 * Close database gracefully
 */
async function closeSharedDatabase() {
  // Stop health monitoring
  if (connectionManager.healthCheckInterval) {
    clearInterval(connectionManager.healthCheckInterval);
    connectionManager.healthCheckInterval = null;
  }

  if (sharedPrismaInstance) {
    try {
      // Wait for queue to clear
      const timeout = Date.now() + 10000;
      while (queryQueue.length > 0 && Date.now() < timeout) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await sharedPrismaInstance.$disconnect();
      console.log('✅ [SharedDB] Database closed gracefully');

      sharedPrismaInstance = null;
      isInitialized = false;

    } catch (error) {
      console.error('❌ [SharedDB] Error closing database:', error);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔄 [SharedDB] SIGINT - closing database...');
  await closeSharedDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 [SharedDB] SIGTERM - closing database...');
  await closeSharedDatabase();
  process.exit(0);
});

module.exports = {
  getSharedPrismaClient,
  initializeSharedDatabase,
  closeSharedDatabase,
  getConnectionStats,
  healthCheck,
  executeWithRetry,
  safeQuery,
  isInConnectionLimitCooldown,
  getCooldownInfo: () => {
    if (!connectionLimitReached) {
      return { inCooldown: false, remainingMinutes: 0, endsAt: null };
    }

    const remainingMs = connectionLimitResetTime - Date.now();
    const remainingMinutes = Math.ceil(remainingMs / 1000 / 60);

    return {
      inCooldown: true,
      remainingMinutes: Math.max(0, remainingMinutes),
      endsAt: connectionLimitResetTime
    };
  }
};

