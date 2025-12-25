import * as tf from '@tensorflow/tfjs-node';
import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';
import { initializationService } from './initialization';

interface TrainingConfig {
  batchSize: number;
  epochs: number;
  learningRate: number;
  validationSplit: number;
  earlyStoppingPatience: number;
  modelSaveFrequency: number;
}

interface TrainingMetrics {
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
  epoch: number;
  timestamp: Date;
}

interface ModelTrainingStatus {
  modelName: string;
  status: 'idle' | 'training' | 'completed' | 'failed';
  progress: number;
  currentEpoch: number;
  totalEpochs: number;
  metrics?: TrainingMetrics;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

class ModelTrainingService {
  private trainingStatuses: Map<string, ModelTrainingStatus> = new Map();
  private trainingQueue: string[] = [];
  private isTraining = false;
  private defaultConfig: TrainingConfig = {
    batchSize: 32,
    epochs: 100,
    learningRate: 0.001,
    validationSplit: 0.2,
    earlyStoppingPatience: 10,
    modelSaveFrequency: 5
  };

  constructor() {
    this.initializeTrainingStatuses();
  }

  private initializeTrainingStatuses(): void {
    const modelNames = [
      'diagnosisAssistance',
      'patientInsights',
      'resourceOptimization',
      'inventoryPrediction',
      'riskPrediction',
      'appointmentOptimization'
    ];

    modelNames.forEach(name => {
      this.trainingStatuses.set(name, {
        modelName: name,
        status: 'idle',
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0
      });
    });
  }

  public async startModelTraining(): Promise<void> {
    if (this.isTraining) {
      logger.warn('Model training is already in progress');
      return;
    }

    logger.info('Starting model training process...');

    try {
      // Check if services are ready
      if (!initializationService.areAllServicesReady()) {
        throw new Error('Not all services are ready for training');
      }

      // Queue all models for training
      this.queueAllModelsForTraining();

      // Start training process
      await this.processTrainingQueue();

    } catch (error) {
      logger.error('Failed to start model training:', error);
      throw error;
    }
  }

  private queueAllModelsForTraining(): void {
    const modelNames = Array.from(this.trainingStatuses.keys());
    
    // Add models to training queue based on priority
    const trainingOrder = [
      'riskPrediction',        // High priority - patient safety
      'diagnosisAssistance',   // High priority - clinical decision support
      'patientInsights',       // Medium priority - patient care
      'inventoryPrediction',   // Medium priority - resource management
      'resourceOptimization',  // Low priority - efficiency
      'appointmentOptimization' // Low priority - scheduling
    ];

    this.trainingQueue = trainingOrder.filter(name => modelNames.includes(name));
    logger.info(`Queued ${this.trainingQueue.length} models for training`);
  }

  private async processTrainingQueue(): Promise<void> {
    this.isTraining = true;

    try {
      while (this.trainingQueue.length > 0) {
        const modelName = this.trainingQueue.shift()!;
        await this.trainModel(modelName);
        
        // Small delay between model training
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('All model training completed successfully');

    } catch (error) {
      logger.error('Error during model training queue processing:', error);
      throw error;

    } finally {
      this.isTraining = false;
    }
  }

  private async trainModel(modelName: string): Promise<void> {
    logger.info(`Starting training for model: ${modelName}`);

    const status = this.trainingStatuses.get(modelName);
    if (!status) {
      throw new Error(`Model ${modelName} not found in training statuses`);
    }

    try {
      // Update status
      this.updateTrainingStatus(modelName, {
        status: 'training',
        progress: 0,
        currentEpoch: 0,
        totalEpochs: this.defaultConfig.epochs,
        startTime: new Date()
      });

      // Get the service instance
      const service = initializationService.getService(modelName);
      if (!service) {
        throw new Error(`Service ${modelName} not available`);
      }

      // Check if service has training capability
      if (!service.trainModel || typeof service.trainModel !== 'function') {
        logger.warn(`Service ${modelName} does not support training, skipping...`);
        this.updateTrainingStatus(modelName, {
          status: 'completed',
          progress: 100,
          endTime: new Date()
        });
        return;
      }

      // Prepare training data
      const trainingData = await this.prepareTrainingData(modelName);
      if (!trainingData || trainingData.length === 0) {
        logger.warn(`No training data available for ${modelName}, skipping...`);
        this.updateTrainingStatus(modelName, {
          status: 'completed',
          progress: 100,
          endTime: new Date()
        });
        return;
      }

      // Create training callbacks
      const callbacks = this.createTrainingCallbacks(modelName);

      // Start training
      await service.trainModel(trainingData, this.defaultConfig, callbacks);

      // Update final status
      this.updateTrainingStatus(modelName, {
        status: 'completed',
        progress: 100,
        endTime: new Date()
      });

      logger.info(`Training completed successfully for model: ${modelName}`);

    } catch (error) {
      logger.error(`Training failed for model ${modelName}:`, error);
      
      this.updateTrainingStatus(modelName, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: new Date()
      });

      // Continue with next model instead of stopping entire process
    }
  }

  private async prepareTrainingData(modelName: string): Promise<any[]> {
    try {
      // This would typically fetch data from the main database
      // For now, return mock data or empty array
      logger.info(`Preparing training data for ${modelName}...`);

      // In a real implementation, this would:
      // 1. Connect to the main hospital database
      // 2. Fetch relevant historical data
      // 3. Preprocess and clean the data
      // 4. Split into training/validation sets
      // 5. Return formatted data for the specific model

      // Mock implementation
      switch (modelName) {
        case 'diagnosisAssistance':
          return await this.prepareDiagnosisData();
        case 'patientInsights':
          return await this.preparePatientData();
        case 'riskPrediction':
          return await this.prepareRiskData();
        case 'inventoryPrediction':
          return await this.prepareInventoryData();
        case 'resourceOptimization':
          return await this.prepareResourceData();
        case 'appointmentOptimization':
          return await this.prepareAppointmentData();
        default:
          return [];
      }

    } catch (error) {
      logger.error(`Failed to prepare training data for ${modelName}:`, error);
      return [];
    }
  }

  private async prepareDiagnosisData(): Promise<any[]> {
    // Mock diagnosis training data
    return [];
  }

  private async preparePatientData(): Promise<any[]> {
    // Mock patient insights training data
    return [];
  }

  private async prepareRiskData(): Promise<any[]> {
    // Mock risk prediction training data
    return [];
  }

  private async prepareInventoryData(): Promise<any[]> {
    // Mock inventory prediction training data
    return [];
  }

  private async prepareResourceData(): Promise<any[]> {
    // Mock resource optimization training data
    return [];
  }

  private async prepareAppointmentData(): Promise<any[]> {
    // Mock appointment optimization training data
    return [];
  }

  private createTrainingCallbacks(modelName: string): any {
    return {
      onEpochEnd: async (epoch: number, logs: any) => {
        const metrics: TrainingMetrics = {
          loss: logs.loss || 0,
          accuracy: logs.accuracy || 0,
          valLoss: logs.val_loss || 0,
          valAccuracy: logs.val_accuracy || 0,
          epoch,
          timestamp: new Date()
        };

        const progress = Math.round((epoch / this.defaultConfig.epochs) * 100);

        this.updateTrainingStatus(modelName, {
          progress,
          currentEpoch: epoch,
          metrics
        });

        // Cache metrics for monitoring
        await this.cacheTrainingMetrics(modelName, metrics);

        logger.info(`${modelName} - Epoch ${epoch}: Loss=${metrics.loss.toFixed(4)}, Accuracy=${metrics.accuracy.toFixed(4)}`);
      },

      onTrainEnd: async () => {
        logger.info(`Training completed for ${modelName}`);
      }
    };
  }

  private async cacheTrainingMetrics(modelName: string, metrics: TrainingMetrics): Promise<void> {
    try {
      const key = `training_metrics:${modelName}:${metrics.epoch}`;
      await redisClient.setJson(key, metrics, 86400); // Cache for 24 hours
    } catch (error) {
      logger.error('Failed to cache training metrics:', error);
    }
  }

  private updateTrainingStatus(modelName: string, updates: Partial<ModelTrainingStatus>): void {
    const currentStatus = this.trainingStatuses.get(modelName);
    if (currentStatus) {
      this.trainingStatuses.set(modelName, {
        ...currentStatus,
        ...updates
      });
    }
  }

  public getTrainingStatus(modelName?: string): ModelTrainingStatus | Map<string, ModelTrainingStatus> {
    if (modelName) {
      return this.trainingStatuses.get(modelName) || {
        modelName,
        status: 'idle',
        progress: 0,
        currentEpoch: 0,
        totalEpochs: 0
      };
    }
    return this.trainingStatuses;
  }

  public isModelTraining(modelName?: string): boolean {
    if (modelName) {
      const status = this.trainingStatuses.get(modelName);
      return status?.status === 'training';
    }
    return this.isTraining;
  }

  public async stopTraining(modelName?: string): Promise<void> {
    if (modelName) {
      logger.info(`Stopping training for model: ${modelName}`);
      this.updateTrainingStatus(modelName, {
        status: 'idle',
        progress: 0,
        currentEpoch: 0,
        endTime: new Date()
      });
    } else {
      logger.info('Stopping all model training...');
      this.trainingQueue = [];
      this.isTraining = false;
      
      this.trainingStatuses.forEach((_, name) => {
        this.updateTrainingStatus(name, {
          status: 'idle',
          progress: 0,
          currentEpoch: 0,
          endTime: new Date()
        });
      });
    }
  }

  public getTrainingProgress(): {
    overall: number;
    modelsInProgress: number;
    modelsCompleted: number;
    modelsFailed: number;
    queueLength: number;
  } {
    let totalProgress = 0;
    let modelsInProgress = 0;
    let modelsCompleted = 0;
    let modelsFailed = 0;

    this.trainingStatuses.forEach(status => {
      totalProgress += status.progress;
      
      switch (status.status) {
        case 'training':
          modelsInProgress++;
          break;
        case 'completed':
          modelsCompleted++;
          break;
        case 'failed':
          modelsFailed++;
          break;
      }
    });

    const overall = Math.round(totalProgress / this.trainingStatuses.size);

    return {
      overall,
      modelsInProgress,
      modelsCompleted,
      modelsFailed,
      queueLength: this.trainingQueue.length
    };
  }
}

// Export singleton instance
export const modelTrainingService = new ModelTrainingService();

export async function startModelTraining(): Promise<void> {
  await modelTrainingService.startModelTraining();
}

export default modelTrainingService;