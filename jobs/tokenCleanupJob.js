const cron = require('node-cron');
const { cleanupExpiredTokens } = require('../controllers/authController');
const logger = require('../utils/logger');

/**
 * Set up a scheduled job to clean up expired tokens
 * Runs every day at midnight
 */
const setupTokenCleanupJob = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Starting token cleanup job');
      const deletedCount = await cleanupExpiredTokens();
      logger.info(`Token cleanup completed. Removed ${deletedCount} expired tokens`);
    } catch (error) {
      logger.error('Token cleanup job failed:', error);
    }
  });
  
  logger.info('Token cleanup job scheduled');
};

module.exports = setupTokenCleanupJob;