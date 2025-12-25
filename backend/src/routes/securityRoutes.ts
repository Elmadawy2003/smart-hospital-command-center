import { Router } from 'express';
import { Request, Response } from 'express';
import { advancedSecurityService } from '../services/advancedSecurityService';
import { AuthService } from '../services/authService';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

const router = Router();

// MFA Routes
router.post('/mfa/setup',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const mfaSetup = await advancedSecurityService.setupMFA(userId);
      
      res.json({
        success: true,
        data: mfaSetup,
        message: 'MFA setup initiated. Please verify with your authenticator app.',
      });
    } catch (error) {
      logger.error('MFA setup failed', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/mfa/verify',
  authenticateToken,
  [
    body('token').isString().isLength({ min: 6, max: 8 }).withMessage('Invalid MFA token format'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { token } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await advancedSecurityService.verifyAndEnableMFA(userId, token);
      
      if (result.success) {
        res.json({
          success: true,
          data: { backupCodes: result.backupCodes },
          message: 'MFA enabled successfully. Please save your backup codes.',
        });
      } else {
        res.status(400).json({ error: 'Invalid MFA token' });
      }
    } catch (error) {
      logger.error('MFA verification failed', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/mfa/disable',
  authenticateToken,
  [
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { password } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await advancedSecurityService.disableMFA(userId, password);
      
      if (success) {
        res.json({
          success: true,
          message: 'MFA disabled successfully',
        });
      } else {
        res.status(400).json({ error: 'Failed to disable MFA' });
      }
    } catch (error) {
      logger.error('MFA disable failed', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/mfa/verify-login',
  [
    body('userId').isString().notEmpty().withMessage('User ID is required'),
    body('token').isString().isLength({ min: 6, max: 8 }).withMessage('Invalid MFA token format'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { userId, token } = req.body;

      const isValid = await advancedSecurityService.verifyMFAToken(userId, token);
      
      if (isValid) {
        // Generate final auth tokens
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        const tokens = await AuthService.generateTokens(user);
        
        res.json({
          success: true,
          data: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              permissions: user.permissions,
            },
          },
          message: 'MFA verification successful',
        });
      } else {
        res.status(400).json({ error: 'Invalid MFA token' });
      }
    } catch (error) {
      logger.error('MFA login verification failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// SSO Routes
router.get('/sso/:provider/login',
  [
    param('provider').isIn(['azure', 'google', 'okta']).withMessage('Invalid SSO provider'),
    query('redirect_uri').optional().isURL().withMessage('Invalid redirect URI'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { redirect_uri } = req.query;

      const result = await advancedSecurityService.initiateSSOLogin(
        provider,
        redirect_uri as string
      );

      res.json({
        success: true,
        data: result,
        message: 'SSO login initiated',
      });
    } catch (error) {
      logger.error('SSO login initiation failed', { error: error.message, provider: req.params.provider });
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/sso/:provider/callback',
  [
    param('provider').isIn(['azure', 'google', 'okta']).withMessage('Invalid SSO provider'),
    body('code').isString().notEmpty().withMessage('Authorization code is required'),
    body('state').isString().notEmpty().withMessage('State parameter is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { provider } = req.params;
      const { code, state } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const result = await advancedSecurityService.handleSSOCallback(
        code,
        state,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
        message: 'SSO login successful',
      });
    } catch (error) {
      logger.error('SSO callback failed', { error: error.message, provider: req.params.provider });
      res.status(500).json({ error: error.message });
    }
  }
);

// Risk Assessment Routes
router.post('/risk-assessment',
  [
    body('userId').isString().notEmpty().withMessage('User ID is required'),
    body('deviceFingerprint').optional().isString(),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { userId, deviceFingerprint } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const riskAssessment = await advancedSecurityService.assessLoginRisk(
        userId,
        ipAddress,
        userAgent,
        deviceFingerprint
      );

      res.json({
        success: true,
        data: riskAssessment,
        message: 'Risk assessment completed',
      });
    } catch (error) {
      logger.error('Risk assessment failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// Session Management Routes
router.get('/sessions',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const sessions = await advancedSecurityService.getActiveSessions(userId);
      
      res.json({
        success: true,
        data: sessions,
        message: 'Active sessions retrieved',
      });
    } catch (error) {
      logger.error('Failed to get sessions', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete('/sessions/:sessionId',
  authenticateToken,
  [
    param('sessionId').isString().notEmpty().withMessage('Session ID is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      await advancedSecurityService.terminateSession(sessionId);
      
      res.json({
        success: true,
        message: 'Session terminated successfully',
      });
    } catch (error) {
      logger.error('Failed to terminate session', { error: error.message, sessionId: req.params.sessionId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete('/sessions',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await advancedSecurityService.terminateAllSessions(userId);
      
      res.json({
        success: true,
        message: 'All sessions terminated successfully',
      });
    } catch (error) {
      logger.error('Failed to terminate all sessions', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

// Security Events Routes
router.get('/events',
  authenticateToken,
  [
    query('eventType').optional().isIn(['login', 'logout', 'failed_login', 'password_change', 'mfa_setup', 'account_locked', 'suspicious_activity', 'sso_login']),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId;
      const { eventType, limit } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const events = advancedSecurityService.getSecurityEvents(
        userId,
        eventType as string,
        parseInt(limit as string) || 100
      );
      
      res.json({
        success: true,
        data: events,
        message: 'Security events retrieved',
      });
    } catch (error) {
      logger.error('Failed to get security events', { error: error.message, userId: req.user?.userId });
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/events/all',
  authenticateToken,
  [
    query('eventType').optional().isIn(['login', 'logout', 'failed_login', 'password_change', 'mfa_setup', 'account_locked', 'suspicious_activity', 'sso_login']),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      // Only admin users can view all security events
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { eventType, limit } = req.query;

      const events = advancedSecurityService.getSecurityEvents(
        undefined, // All users
        eventType as string,
        parseInt(limit as string) || 100
      );
      
      res.json({
        success: true,
        data: events,
        message: 'All security events retrieved',
      });
    } catch (error) {
      logger.error('Failed to get all security events', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// Password Policy Routes
router.get('/password-policy',
  async (req: Request, res: Response) => {
    try {
      const policy = advancedSecurityService.getPasswordPolicy();
      
      res.json({
        success: true,
        data: policy,
        message: 'Password policy retrieved',
      });
    } catch (error) {
      logger.error('Failed to get password policy', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

router.put('/password-policy',
  authenticateToken,
  [
    body('minLength').optional().isInt({ min: 8, max: 128 }).withMessage('Minimum length must be between 8 and 128'),
    body('requireUppercase').optional().isBoolean(),
    body('requireLowercase').optional().isBoolean(),
    body('requireNumbers').optional().isBoolean(),
    body('requireSpecialChars').optional().isBoolean(),
    body('maxAge').optional().isInt({ min: 1, max: 365 }).withMessage('Max age must be between 1 and 365 days'),
    body('preventReuse').optional().isInt({ min: 0, max: 24 }).withMessage('Prevent reuse must be between 0 and 24'),
    body('lockoutThreshold').optional().isInt({ min: 3, max: 10 }).withMessage('Lockout threshold must be between 3 and 10'),
    body('lockoutDuration').optional().isInt({ min: 5, max: 1440 }).withMessage('Lockout duration must be between 5 and 1440 minutes'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      // Only admin users can update password policy
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      advancedSecurityService.updatePasswordPolicy(req.body);
      
      res.json({
        success: true,
        message: 'Password policy updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update password policy', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

router.post('/password/validate',
  [
    body('password').isString().notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      const validation = advancedSecurityService.validatePassword(password);
      
      res.json({
        success: true,
        data: validation,
        message: 'Password validation completed',
      });
    } catch (error) {
      logger.error('Password validation failed', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// Security Dashboard Routes
router.get('/dashboard/stats',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Only admin users can view security dashboard
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const allEvents = advancedSecurityService.getSecurityEvents(undefined, undefined, 10000);

      const stats = {
        totalEvents: allEvents.length,
        last24Hours: {
          logins: allEvents.filter(e => e.eventType === 'login' && e.timestamp >= last24Hours).length,
          failedLogins: allEvents.filter(e => e.eventType === 'failed_login' && e.timestamp >= last24Hours).length,
          suspiciousActivity: allEvents.filter(e => e.eventType === 'suspicious_activity' && e.timestamp >= last24Hours).length,
        },
        last7Days: {
          logins: allEvents.filter(e => e.eventType === 'login' && e.timestamp >= last7Days).length,
          failedLogins: allEvents.filter(e => e.eventType === 'failed_login' && e.timestamp >= last7Days).length,
          suspiciousActivity: allEvents.filter(e => e.eventType === 'suspicious_activity' && e.timestamp >= last7Days).length,
        },
        riskLevels: {
          low: allEvents.filter(e => e.riskLevel === 'low').length,
          medium: allEvents.filter(e => e.riskLevel === 'medium').length,
          high: allEvents.filter(e => e.riskLevel === 'high').length,
          critical: allEvents.filter(e => e.riskLevel === 'critical').length,
        },
        topIPs: this.getTopIPs(allEvents, 10),
        eventTypes: this.getEventTypeCounts(allEvents),
      };
      
      res.json({
        success: true,
        data: stats,
        message: 'Security dashboard stats retrieved',
      });
    } catch (error) {
      logger.error('Failed to get security dashboard stats', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  }
);

// Helper methods for dashboard stats
function getTopIPs(events: any[], limit: number) {
  const ipCounts = new Map<string, number>();
  
  events.forEach(event => {
    const count = ipCounts.get(event.ipAddress) || 0;
    ipCounts.set(event.ipAddress, count + 1);
  });

  return Array.from(ipCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([ip, count]) => ({ ip, count }));
}

function getEventTypeCounts(events: any[]) {
  const typeCounts = new Map<string, number>();
  
  events.forEach(event => {
    const count = typeCounts.get(event.eventType) || 0;
    typeCounts.set(event.eventType, count + 1);
  });

  return Object.fromEntries(typeCounts);
}

export default router;