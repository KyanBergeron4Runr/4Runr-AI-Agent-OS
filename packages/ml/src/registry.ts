export interface ModelVersion {
  id: string
  agentId: string
  version: string
  modelType: 'base' | 'fine_tuned' | 'retrained' | 'optimized'
  status: 'training' | 'ready' | 'deployed' | 'deprecated'
  createdAt: Date
  updatedAt: Date
  metadata: {
    accuracy: number
    loss: number
    trainingTime: number
    hyperparameters: Record<string, any>
    datasetSize: number
    safetyScore: number
  }
  artifacts: {
    modelPath: string
    configPath: string
    metricsPath: string
    checksum: string
  }
}

export interface ModelRegistry {
  id: string
  name: string
  description: string
  agentId: string
  currentVersion: string
  versions: ModelVersion[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface RegistryMetrics {
  totalModels: number
  totalVersions: number
  deployedModels: number
  trainingModels: number
  averageAccuracy: number
  averageSafetyScore: number
}

export class RegistryService {
  private static instance: RegistryService
  private models: Map<string, ModelRegistry> = new Map()
  private versions: Map<string, ModelVersion> = new Map()

  private constructor() {}

  public static getInstance(): RegistryService {
    if (!RegistryService.instance) {
      RegistryService.instance = new RegistryService()
    }
    return RegistryService.instance
  }

  /**
   * Register a new model
   */
  public registerModel(
    name: string,
    description: string,
    agentId: string,
    tags: string[] = []
  ): string {
    const id = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const model: ModelRegistry = {
      id,
      name,
      description,
      agentId,
      currentVersion: '',
      versions: [],
      tags,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.models.set(id, model)
    console.log(`📝 Model registered: ${id} (${name})`)
    return id
  }

  /**
   * Add a new model version
   */
  public addModelVersion(
    modelId: string,
    version: string,
    modelType: 'base' | 'fine_tuned' | 'retrained' | 'optimized',
    metadata: Partial<ModelVersion['metadata']> = {},
    artifacts: Partial<ModelVersion['artifacts']> = {}
  ): string {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    const versionId = `version_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const modelVersion: ModelVersion = {
      id: versionId,
      agentId: model.agentId,
      version,
      modelType,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        accuracy: metadata.accuracy || 0.85,
        loss: metadata.loss || 0.1,
        trainingTime: metadata.trainingTime || 0,
        hyperparameters: metadata.hyperparameters || {},
        datasetSize: metadata.datasetSize || 0,
        safetyScore: metadata.safetyScore || 0.9
      },
      artifacts: {
        modelPath: artifacts.modelPath || `/models/${modelId}/${version}/model.bin`,
        configPath: artifacts.configPath || `/models/${modelId}/${version}/config.json`,
        metricsPath: artifacts.metricsPath || `/models/${modelId}/${version}/metrics.json`,
        checksum: artifacts.checksum || `checksum_${Date.now()}`
      }
    }

    this.versions.set(versionId, modelVersion)
    model.versions.push(modelVersion)
    model.currentVersion = version
    model.updatedAt = new Date()

    console.log(`🚀 Model version added: ${versionId} (${version})`)
    return versionId
  }

  /**
   * Get a model by ID
   */
  public getModel(modelId: string): ModelRegistry | undefined {
    return this.models.get(modelId)
  }

  /**
   * Get a model version by ID
   */
  public getModelVersion(versionId: string): ModelVersion | undefined {
    return this.versions.get(versionId)
  }

  /**
   * Get all models for an agent
   */
  public getAgentModels(agentId: string): ModelRegistry[] {
    return Array.from(this.models.values())
      .filter(model => model.agentId === agentId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  /**
   * Get all versions of a model
   */
  public getModelVersions(modelId: string): ModelVersion[] {
    const model = this.models.get(modelId)
    if (!model) return []
    
    return model.versions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Deploy a model version
   */
  public deployModelVersion(versionId: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    // Update version status
    version.status = 'deployed'
    version.updatedAt = new Date()

    // Update model current version
    const model = this.models.get(version.agentId)
    if (model) {
      model.currentVersion = version.version
      model.updatedAt = new Date()
    }

    console.log(`🚀 Model version deployed: ${versionId} (${version.version})`)
    return true
  }

  /**
   * Deprecate a model version
   */
  public deprecateModelVersion(versionId: string): boolean {
    const version = this.versions.get(versionId)
    if (!version) return false

    version.status = 'deprecated'
    version.updatedAt = new Date()

    console.log(`⚠️ Model version deprecated: ${versionId} (${version.version})`)
    return true
  }

  /**
   * Search models by tags
   */
  public searchModelsByTags(tags: string[]): ModelRegistry[] {
    return Array.from(this.models.values())
      .filter(model => tags.some(tag => model.tags.includes(tag)))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  /**
   * Get registry metrics
   */
  public getRegistryMetrics(): RegistryMetrics {
    const allVersions = Array.from(this.versions.values())
    const deployedVersions = allVersions.filter(v => v.status === 'deployed')
    const trainingVersions = allVersions.filter(v => v.status === 'training')

    const totalAccuracy = allVersions.reduce((sum, v) => sum + v.metadata.accuracy, 0)
    const totalSafetyScore = allVersions.reduce((sum, v) => sum + v.metadata.safetyScore, 0)

    return {
      totalModels: this.models.size,
      totalVersions: allVersions.length,
      deployedModels: deployedVersions.length,
      trainingModels: trainingVersions.length,
      averageAccuracy: allVersions.length > 0 ? totalAccuracy / allVersions.length : 0,
      averageSafetyScore: allVersions.length > 0 ? totalSafetyScore / allVersions.length : 0
    }
  }

  /**
   * Export model registry
   */
  public exportRegistry(format: 'json' | 'csv' = 'json'): string {
    const data = {
      models: Array.from(this.models.values()),
      versions: Array.from(this.versions.values()),
      metrics: this.getRegistryMetrics()
    }

    if (format === 'json') {
      return JSON.stringify(data, null, 2)
    } else {
      // Simple CSV export for models
      const headers = ['id', 'name', 'description', 'agentId', 'currentVersion', 'tags', 'createdAt', 'updatedAt']
      const csv = [
        headers.join(','),
        ...Array.from(this.models.values()).map(model => [
          model.id,
          model.name,
          model.description,
          model.agentId,
          model.currentVersion,
          model.tags.join(';'),
          model.createdAt.toISOString(),
          model.updatedAt.toISOString()
        ].join(','))
      ].join('\n')
      return csv
    }
  }

  /**
   * Cleanup deprecated models
   */
  public cleanup(): void {
    const now = new Date()
    const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

    for (const [modelId, model] of this.models.entries()) {
      const hasActiveVersions = model.versions.some(v => 
        v.status !== 'deprecated' || 
        (v.updatedAt && (now.getTime() - v.updatedAt.getTime()) <= maxAge)
      )

      if (!hasActiveVersions) {
        // Remove model and all its versions
        model.versions.forEach(v => this.versions.delete(v.id))
        this.models.delete(modelId)
        console.log(`🗑️ Cleaned up deprecated model: ${modelId}`)
      }
    }
  }
}

// Export singleton instance
export const registryService = RegistryService.getInstance()
