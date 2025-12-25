import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';
import { DiagnosisAssistanceService } from './diagnosisAssistance';
import { PatientInsightsService } from './patientInsights';
import { ResourceOptimizationService } from './resourceOptimization';
import { InventoryPredictionService } from './inventoryPrediction';
import { RiskPredictionService } from './riskPrediction';
import { AppointmentOptimizationService } from './appointmentOptimization';

interface ServiceStatus {
  name: string;
  status: 'initializing' | 'ready' | 'error';
  error?: string;
  lastUpdated: Date;
}

class InitializationService {
  private services: Map<string, any> = new Map();
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private isInitialized = false;

  async initializeServices(): Promise<void> {
    logger.info('Starting AI services initialization...');

    try {
      // Initialize Redis connection
      await this.initializeRedis();

      // Initialize all AI services
      await this.initializeAIServices();

      // Verify all services are ready
      await this.verifyServices();

      this.isInitialized = true;
      logger.info('All AI services initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize AI services:', error);
      throw error;
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      logger.info('Initializing Redis connection...');
      await redisClient.connect();
      
      // Test Redis connection
      await redisClient.set('health_check', 'ok', 60);
      const result = await redisClient.get('health_check');
      
      if (result !== 'ok') {
        throw new Error('Redis health check failed');
      }

      logger.info('Redis connection established successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  private async initializeAIServices(): Promise<void> {
    const serviceInitializers = [
      {
        name: 'diagnosisAssistance',
        initializer: () => new DiagnosisAssistanceService()
      },
      {
        name: 'patientInsights',
        initializer: () => new PatientInsightsService()
      },
      {
        name: 'resourceOptimization',
        initializer: () => new ResourceOptimizationService()
      },
      {
        name: 'inventoryPrediction',
        initializer: () => new InventoryPredictionService()
      },
      {
        name: 'riskPrediction',
        initializer: () => new RiskPredictionService()
      },
      {
        name: 'appointmentOptimization',
        initializer: () => new AppointmentOptimizationService()
      }
    ];

    // Initialize services in parallel with error handling
    const initPromises = serviceInitializers.map(async ({ name, initializer }) => {
      try {
        this.updateServiceStatus(name, 'initializing');
        logger.info(`Initializing ${name} service...`);

        const service = initializer();
        this.services.set(name, service);

        // Wait for service to be ready (if it has an initialization method)
        if (service.initialize && typeof service.initialize === 'function') {
          await service.initialize();
        }

        this.updateServiceStatus(name, 'ready');
        logger.info(`${name} service initialized successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.updateServiceStatus(name, 'error', errorMessage);
        logger.error(`Failed to initialize ${name} service:`, error);
        
        // Don't throw here - we want to continue initializing other services
        // The verification step will catch any failed services
      }
    });

    await Promise.allSettled(initPromises);
  }

  private async verifyServices(): Promise<void> {
    logger.info('Verifying service initialization...');

    const failedServices: string[] = [];
    const serviceNames = Array.from(this.serviceStatuses.keys());

    for (const serviceName of serviceNames) {
      const status = this.serviceStatuses.get(serviceName);
      if (status?.status === 'error') {
        failedServices.push(`${serviceName}: ${status.error}`);
      }
    }

    if (failedServices.length > 0) {
      const errorMessage = `Failed to initialize services: ${failedServices.join(', ')}`;
      logger.error(errorMessage);
      
      // In development, we might want to continue with partial services
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Continuing with partial service initialization in development mode');
      } else {
        throw new Error(errorMessage);
      }
    }

    // Test service health
    await this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    logger.info('Performing service health checks...');

    const healthCheckPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
      try {
        if (service.healthCheck && typeof service.healthCheck === 'function') {
          const isHealthy = await service.healthCheck();
          if (!isHealthy) {
            logger.warn(`Health check failed for ${name} service`);
          }
        }
      } catch (error) {
        logger.error(`Health check error for ${name} service:`, error);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  private updateServiceStatus(name: string, status: ServiceStatus['status'], error?: string): void {
    this.serviceStatuses.set(name, {
      name,
      status,
      error,
      lastUpdated: new Date()
    });
  }

  public getService<T>(name: string): T | null {
    return this.services.get(name) || null;
  }

  public getServiceStatus(name?: string): ServiceStatus | Map<string, ServiceStatus> {
    if (name) {
      return this.serviceStatuses.get(name) || {
        name,
        status: 'error',
        error: 'Service not found',
        lastUpdated: new Date()
      };
    }
    return this.serviceStatuses;
  }

  public isServiceReady(name: string): boolean {
    const status = this.serviceStatuses.get(name);
    return status?.status === 'ready';
  }

  public areAllServicesReady(): boolean {
    return this.isInitialized && Array.from(this.serviceStatuses.values())
      .every(status => status.status === 'ready');
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down AI services...');

    try {
      // Shutdown all services
      const shutdownPromises = Array.from(this.services.entries()).map(async ([name, service]) => {
        try {
          if (service.shutdown && typeof service.shutdown === 'function') {
            await service.shutdown();
            logger.info(`${name} service shut down successfully`);
          }
        } catch (error) {
          logger.error(`Error shutting down ${name} service:`, error);
        }
      });

      await Promise.allSettled(shutdownPromises);

      // Disconnect Redis
      await redisClient.disconnect();

      this.services.clear();
      this.serviceStatuses.clear();
      this.isInitialized = false;

      logger.info('All AI services shut down successfully');

    } catch (error) {
      logger.error('Error during service shutdown:', error);
      throw error;
    }
  }

  public getHealthStatus(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, ServiceStatus>;
    redis: boolean;
    timestamp: string;
  } {
    const services: Record<string, ServiceStatus> = {};
    let healthyCount = 0;
    let totalCount = 0;

    this.serviceStatuses.forEach((status, name) => {
      services[name] = status;
      totalCount++;
      if (status.status === 'ready') {
        healthyCount++;
      }
    });

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services,
      redis: redisClient.isHealthy(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const initializationService = new InitializationService();

export async function initializeServices(): Promise<void> {
  await initializationService.initializeServices();
}

export default initializationService;