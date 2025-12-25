import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';
import { prisma } from '../config/database';
import { AuthService } from './authService';

// Enhanced Security Interfaces
export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export interface SSOProvider {
  id: string;
  name: string;
  type: 'azure' | 'google' | 'okta' | 'saml';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer?: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  isActive: boolean;
}

export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_setup' | 'account_locked' | 'suspicious_activity' | 'sso_login';
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  details: any;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  deviceFingerprint?: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  preventReuse: number; // number of previous passwords to check
  lockoutThreshold: number;
  lockoutDuration: number; // minutes
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  deviceFingerprint?: string;
  location?: string;
}

export interface RiskAssessment {
  score: number; // 0-100
  factors: string[];
  recommendation: 'allow' | 'challenge' | 'block';
  requiresMFA: boolean;
}

export class AdvancedSecurityService extends EventEmitter {
  private passwordPolicy: PasswordPolicy;
  private ssoProviders: Map<string, SSOProvider> = new Map();
  private activeSessions: Map<string, SessionInfo> = new Map();
  private securityEvents: SecurityEvent[] = [];

  constructor() {
    super();
    this.passwordPolicy = {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      maxAge: 90,
      preventReuse: 5,
      lockoutThreshold: 5,
      lockoutDuration: 30,
    };
    this.initializeSSOProviders();
    this.startSecurityMonitoring();
  }

  // Multi-Factor Authentication (MFA)
  async setupMFA(userId: string): Promise<MFASetup> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      const secret = speakeasy.generateSecret({
        name: `Hospital ERP (${user.email})`,
        issuer: 'Hospital ERP System',
        length: 32,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Store MFA secret temporarily in Redis (expires in 10 minutes)
      await redis.setex(`mfa_setup:${userId}`, 600, JSON.stringify({
        secret: secret.base32,
        backupCodes,
      }));

      await this.logSecurityEvent({
        userId,
        eventType: 'mfa_setup',
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        details: { action: 'setup_initiated' },
        riskLevel: 'low',
      });

      return {
        secret: secret.base32!,
        qrCode,
        backupCodes,
      };
    } catch (error) {
      logger.error('MFA setup failed', { userId, error: error.message });
      throw error;
    }
  }

  async verifyAndEnableMFA(userId: string, token: string): Promise<{ success: boolean; backupCodes?: string[] }> {
    try {
      const setupData = await redis.get(`mfa_setup:${userId}`);
      if (!setupData) {
        throw new Error('MFA setup not found or expired');
      }

      const { secret, backupCodes } = JSON.parse(setupData);

      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (verified) {
        // Enable MFA for user
        await prisma.user.update({
          where: { id: userId },
          data: {
            isMFAEnabled: true,
            mfaSecret: secret,
          },
        });

        // Store backup codes
        await redis.setex(`mfa_backup:${userId}`, 365 * 24 * 60 * 60, JSON.stringify(backupCodes));

        // Clean up setup data
        await redis.del(`mfa_setup:${userId}`);

        await this.logSecurityEvent({
          userId,
          eventType: 'mfa_setup',
          timestamp: new Date(),
          ipAddress: 'system',
          userAgent: 'system',
          details: { action: 'enabled' },
          riskLevel: 'low',
        });

        return { success: true, backupCodes };
      }

      return { success: false };
    } catch (error) {
      logger.error('MFA verification failed', { userId, error: error.message });
      throw error;
    }
  }

  async verifyMFAToken(userId: string, token: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isMFAEnabled || !user.mfaSecret) {
        return false;
      }

      // Try TOTP verification
      const totpVerified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (totpVerified) {
        return true;
      }

      // Try backup code verification
      const backupCodes = await redis.get(`mfa_backup:${userId}`);
      if (backupCodes) {
        const codes = JSON.parse(backupCodes);
        const codeIndex = codes.indexOf(token.toUpperCase());
        
        if (codeIndex !== -1) {
          // Remove used backup code
          codes.splice(codeIndex, 1);
          await redis.setex(`mfa_backup:${userId}`, 365 * 24 * 60 * 60, JSON.stringify(codes));
          
          await this.logSecurityEvent({
            userId,
            eventType: 'mfa_setup',
            timestamp: new Date(),
            ipAddress: 'system',
            userAgent: 'system',
            details: { action: 'backup_code_used' },
            riskLevel: 'medium',
          });

          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('MFA token verification failed', { userId, error: error.message });
      return false;
    }
  }

  async disableMFA(userId: string, password: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const passwordValid = await AuthService.comparePassword(password, user.password);
      if (!passwordValid) {
        throw new Error('Invalid password');
      }

      // Disable MFA
      await prisma.user.update({
        where: { id: userId },
        data: {
          isMFAEnabled: false,
          mfaSecret: null,
        },
      });

      // Remove backup codes
      await redis.del(`mfa_backup:${userId}`);

      await this.logSecurityEvent({
        userId,
        eventType: 'mfa_setup',
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        details: { action: 'disabled' },
        riskLevel: 'medium',
      });

      return true;
    } catch (error) {
      logger.error('MFA disable failed', { userId, error: error.message });
      throw error;
    }
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substr(2, 8).toUpperCase());
    }
    return codes;
  }

  // Single Sign-On (SSO)
  async initiateSSOLogin(providerId: string, redirectUri?: string): Promise<{ authUrl: string; state: string }> {
    const provider = this.ssoProviders.get(providerId);
    if (!provider || !provider.isActive) {
      throw new Error('SSO provider not found or inactive');
    }

    const state = this.generateSecureToken();
    
    // Store state in Redis for verification
    await redis.setex(`sso_state:${state}`, 600, JSON.stringify({
      providerId,
      redirectUri: redirectUri || provider.redirectUri,
      timestamp: Date.now(),
    }));

    const authUrl = this.buildAuthUrl(provider, state);

    return { authUrl, state };
  }

  async handleSSOCallback(code: string, state: string, ipAddress: string, userAgent: string): Promise<{ token: string; user: any }> {
    try {
      // Verify state
      const stateData = await redis.get(`sso_state:${state}`);
      if (!stateData) {
        throw new Error('Invalid or expired SSO state');
      }

      const { providerId } = JSON.parse(stateData);
      const provider = this.ssoProviders.get(providerId);
      if (!provider) {
        throw new Error('SSO provider not found');
      }

      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken(provider, code);
      
      // Get user info
      const userInfo = await this.getUserInfoFromProvider(provider, tokenResponse.access_token);

      // Find or create user
      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userInfo.email },
            { ssoId: userInfo.id, ssoProvider: providerId },
          ],
        },
      });

      if (!user) {
        // Auto-provision user
        user = await this.createSSOUser(providerId, userInfo);
      } else if (!user.ssoId) {
        // Link existing user to SSO
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ssoId: userInfo.id,
            ssoProvider: providerId,
          },
        });
      }

      if (!user.isActive) {
        throw new Error('Account is disabled');
      }

      // Generate tokens
      const tokens = await AuthService.generateTokens(user);

      // Create session
      await this.createSession(user.id, ipAddress, userAgent);

      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'sso_login',
        timestamp: new Date(),
        ipAddress,
        userAgent,
        details: { provider: providerId, userEmail: userInfo.email },
        riskLevel: 'low',
      });

      // Clean up state
      await redis.del(`sso_state:${state}`);

      return { token: tokens.accessToken, user };
    } catch (error) {
      logger.error('SSO callback failed', { error: error.message });
      throw error;
    }
  }

  private buildAuthUrl(provider: SSOProvider, state: string): string {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    });

    return `${provider.authUrl}?${params.toString()}`;
  }

  private async exchangeCodeForToken(provider: SSOProvider, code: string): Promise<any> {
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code,
        redirect_uri: provider.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    return response.json();
  }

  private async getUserInfoFromProvider(provider: SSOProvider, accessToken: string): Promise<any> {
    const response = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from provider');
    }

    return response.json();
  }

  private async createSSOUser(providerId: string, userInfo: any): Promise<any> {
    const user = await prisma.user.create({
      data: {
        email: userInfo.email,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || '',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
        role: 'user', // Default role
        department: 'general',
        isActive: true,
        isMFAEnabled: false,
        ssoId: userInfo.id,
        ssoProvider: providerId,
        permissions: AuthService.getUserPermissions('user'),
      },
    });

    return user;
  }

  // Risk Assessment
  async assessLoginRisk(userId: string, ipAddress: string, userAgent: string, deviceFingerprint?: string): Promise<RiskAssessment> {
    const factors: string[] = [];
    let score = 0;

    // Check for new IP address
    const recentLogins = await this.getRecentLogins(userId, 30); // Last 30 days
    const knownIPs = recentLogins.map(login => login.ipAddress);
    
    if (!knownIPs.includes(ipAddress)) {
      factors.push('new_ip_address');
      score += 30;
    }

    // Check for new device
    if (deviceFingerprint) {
      const knownDevices = recentLogins.map(login => login.deviceFingerprint).filter(Boolean);
      if (!knownDevices.includes(deviceFingerprint)) {
        factors.push('new_device');
        score += 25;
      }
    }

    // Check for unusual time
    const hour = new Date().getHours();
    const userLoginHours = recentLogins.map(login => login.timestamp.getHours());
    const averageHour = userLoginHours.reduce((a, b) => a + b, 0) / userLoginHours.length;
    
    if (Math.abs(hour - averageHour) > 6) {
      factors.push('unusual_time');
      score += 15;
    }

    // Check for multiple failed attempts
    const failedAttempts = await this.getFailedLoginAttempts(userId, 60); // Last hour
    if (failedAttempts > 3) {
      factors.push('multiple_failed_attempts');
      score += 40;
    }

    // Check for suspicious patterns
    const suspiciousActivity = await this.detectSuspiciousActivity(userId, ipAddress);
    if (suspiciousActivity) {
      factors.push('suspicious_activity');
      score += 50;
    }

    // Determine recommendation
    let recommendation: 'allow' | 'challenge' | 'block' = 'allow';
    let requiresMFA = false;

    if (score >= 70) {
      recommendation = 'block';
    } else if (score >= 40) {
      recommendation = 'challenge';
      requiresMFA = true;
    } else if (score >= 20) {
      requiresMFA = true;
    }

    return {
      score,
      factors,
      recommendation,
      requiresMFA,
    };
  }

  private async getRecentLogins(userId: string, days: number): Promise<SecurityEvent[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.securityEvents.filter(event => 
      event.userId === userId && 
      event.eventType === 'login' && 
      event.timestamp >= since
    );
  }

  private async getFailedLoginAttempts(userId: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return this.securityEvents.filter(event => 
      event.userId === userId && 
      event.eventType === 'failed_login' && 
      event.timestamp >= since
    ).length;
  }

  private async detectSuspiciousActivity(userId: string, ipAddress: string): Promise<boolean> {
    // Check for rapid login attempts from different IPs
    const recentEvents = this.securityEvents.filter(event => 
      event.userId === userId && 
      event.timestamp >= new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
    );

    const uniqueIPs = new Set(recentEvents.map(event => event.ipAddress));
    return uniqueIPs.size > 3;
  }

  // Session Management
  private async createSession(userId: string, ipAddress: string, userAgent: string, deviceFingerprint?: string): Promise<SessionInfo> {
    const sessionId = this.generateSecureToken();
    
    const session: SessionInfo = {
      sessionId,
      userId,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      deviceFingerprint,
    };

    this.activeSessions.set(sessionId, session);
    
    // Store in Redis with expiration
    await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(session));

    return session;
  }

  async getActiveSessions(userId: string): Promise<SessionInfo[]> {
    return Array.from(this.activeSessions.values()).filter(session => 
      session.userId === userId && session.isActive
    );
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.activeSessions.delete(sessionId);
      await redis.del(`session:${sessionId}`);
    }
  }

  async terminateAllSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values()).filter(s => s.userId === userId);
    
    for (const session of userSessions) {
      session.isActive = false;
      this.activeSessions.delete(session.sessionId);
      await redis.del(`session:${session.sessionId}`);
    }
  }

  // Security Event Logging
  private async logSecurityEvent(event: Omit<SecurityEvent, 'id'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      id: this.generateSecureToken(),
      ...event,
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 10000 events in memory
    if (this.securityEvents.length > 10000) {
      this.securityEvents = this.securityEvents.slice(-10000);
    }

    // Store in Redis for persistence
    await redis.lpush('security_events', JSON.stringify(securityEvent));
    await redis.ltrim('security_events', 0, 9999); // Keep last 10000

    // Emit event for real-time monitoring
    this.emit('securityEvent', securityEvent);

    logger.info('Security event logged', {
      eventId: securityEvent.id,
      eventType: securityEvent.eventType,
      userId: securityEvent.userId,
      riskLevel: securityEvent.riskLevel,
    });
  }

  getSecurityEvents(userId?: string, eventType?: string, limit: number = 100): SecurityEvent[] {
    let events = this.securityEvents;

    if (userId) {
      events = events.filter(e => e.userId === userId);
    }

    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    return events.slice(-limit).reverse();
  }

  // Utility Methods
  private generateSecureToken(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private initializeSSOProviders(): void {
    // Azure AD
    this.ssoProviders.set('azure', {
      id: 'azure',
      name: 'Azure Active Directory',
      type: 'azure',
      clientId: process.env.AZURE_CLIENT_ID || '',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',
      redirectUri: process.env.AZURE_REDIRECT_URI || 'http://localhost:3000/auth/azure/callback',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      isActive: !!process.env.AZURE_CLIENT_ID,
    });

    // Google
    this.ssoProviders.set('google', {
      id: 'google',
      name: 'Google',
      type: 'google',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      isActive: !!process.env.GOOGLE_CLIENT_ID,
    });
  }

  private startSecurityMonitoring(): void {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      const now = new Date();
      const expiredSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) => {
          const sessionAge = now.getTime() - session.lastActivity.getTime();
          return sessionAge > 24 * 60 * 60 * 1000; // 24 hours
        });

      for (const [sessionId, _] of expiredSessions) {
        this.activeSessions.delete(sessionId);
        await redis.del(`session:${sessionId}`);
      }

      if (expiredSessions.length > 0) {
        logger.info('Cleaned up expired sessions', { count: expiredSessions.length });
      }
    }, 5 * 60 * 1000);

    // Monitor for suspicious activity every minute
    setInterval(() => {
      this.monitorSuspiciousActivity();
    }, 60 * 1000);
  }

  private monitorSuspiciousActivity(): void {
    const recentEvents = this.securityEvents.filter(event => 
      event.timestamp >= new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    // Check for brute force attacks
    const failedLogins = recentEvents.filter(event => event.eventType === 'failed_login');
    const ipCounts = new Map<string, number>();
    
    failedLogins.forEach(event => {
      const count = ipCounts.get(event.ipAddress) || 0;
      ipCounts.set(event.ipAddress, count + 1);
    });

    // Alert on suspicious IPs
    ipCounts.forEach((count, ip) => {
      if (count >= 10) {
        this.emit('suspiciousActivity', {
          type: 'brute_force',
          ipAddress: ip,
          count,
          timeframe: '5 minutes',
        });
      }
    });
  }

  // Password Policy Management
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const policy = this.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getPasswordPolicy(): PasswordPolicy {
    return { ...this.passwordPolicy };
  }

  updatePasswordPolicy(policy: Partial<PasswordPolicy>): void {
    this.passwordPolicy = { ...this.passwordPolicy, ...policy };
  }
}

export const advancedSecurityService = new AdvancedSecurityService();