const pino = require('pino');
const transport =
  process.env.NODE_ENV === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      }
    : undefined;

const logger = pino({ level: process.env.LOG_LEVEL || 'info', transport });

// stream for morgan
logger.stream = {
  write: msg => logger.info(msg.trim()),
};

module.exports = { logger };
