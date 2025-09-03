export interface FeedbackData {
  id: string
  runId: string
  agentId: string
  timestamp: Date
  type: 'success' | 'failure' | 'improvement' | 'bug_report'
  category: 'accuracy' | 'performance' | 'safety' | 'usability' | 'other'
  rating: number // 1-5 scale
  comment?: string
  metadata: Record<string, any>
}

export interface FeedbackMetrics {
  totalFeedback: number
  averageRating: number
  categoryBreakdown: Record<string, number>
  recentTrend: 'improving' | 'declining' | 'stable'
}

export class FeedbackService {
  private static instance: FeedbackService
  private feedbackStore: Map<string, FeedbackData> = new Map()
  private agentFeedback: Map<string, FeedbackData[]> = new Map()

  private constructor() {}

  public static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService()
    }
    return FeedbackService.instance
  }

  /**
   * Submit feedback for a run
   */
  public submitFeedback(feedback: Omit<FeedbackData, 'id' | 'timestamp'>): string {
    const id = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const feedbackData: FeedbackData = {
      ...feedback,
      id,
      timestamp: new Date()
    }

    // Store feedback
    this.feedbackStore.set(id, feedbackData)

    // Index by agent
    if (!this.agentFeedback.has(feedback.agentId)) {
      this.agentFeedback.set(feedback.agentId, [])
    }
    this.agentFeedback.get(feedback.agentId)!.push(feedbackData)

    console.log(`📝 Feedback submitted: ${id} for agent ${feedback.agentId}`)
    return id
  }

  /**
   * Get feedback for a specific agent
   */
  public getAgentFeedback(agentId: string, limit: number = 100): FeedbackData[] {
    const feedback = this.agentFeedback.get(agentId) || []
    return feedback
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
  }

  /**
   * Get feedback metrics for an agent
   */
  public getAgentMetrics(agentId: string): FeedbackMetrics {
    const feedback = this.getAgentFeedback(agentId)
    
    if (feedback.length === 0) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        categoryBreakdown: {},
        recentTrend: 'stable'
      }
    }

    // Calculate metrics
    const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0)
    const averageRating = totalRating / feedback.length

    const categoryBreakdown: Record<string, number> = {}
    feedback.forEach(f => {
      categoryBreakdown[f.category] = (categoryBreakdown[f.category] || 0) + 1
    })

    // Determine trend (simplified - compare recent vs older feedback)
    const recentFeedback = feedback.slice(0, Math.floor(feedback.length / 2))
    const olderFeedback = feedback.slice(Math.floor(feedback.length / 2))
    
    const recentAvg = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length
    const olderAvg = olderFeedback.reduce((sum, f) => sum + f.rating, 0) / olderFeedback.length
    
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable'
    if (recentAvg > olderAvg + 0.5) recentTrend = 'improving'
    else if (recentAvg < olderAvg - 0.5) recentTrend = 'declining'

    return {
      totalFeedback: feedback.length,
      averageRating: Math.round(averageRating * 100) / 100,
      categoryBreakdown,
      recentTrend
    }
  }

  /**
   * Get all feedback (for analysis)
   */
  public getAllFeedback(): FeedbackData[] {
    return Array.from(this.feedbackStore.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Delete feedback by ID
   */
  public deleteFeedback(feedbackId: string): boolean {
    const feedback = this.feedbackStore.get(feedbackId)
    if (!feedback) return false

    // Remove from main store
    this.feedbackStore.delete(feedbackId)

    // Remove from agent index
    const agentFeedback = this.agentFeedback.get(feedback.agentId)
    if (agentFeedback) {
      const index = agentFeedback.findIndex(f => f.id === feedbackId)
      if (index !== -1) {
        agentFeedback.splice(index, 1)
      }
    }

    console.log(`🗑️ Feedback deleted: ${feedbackId}`)
    return true
  }

  /**
   * Export feedback data
   */
  public exportFeedback(format: 'json' | 'csv' = 'json'): string {
    const feedback = this.getAllFeedback()
    
    if (format === 'json') {
      return JSON.stringify(feedback, null, 2)
    } else {
      // Simple CSV export
      const headers = ['id', 'runId', 'agentId', 'timestamp', 'type', 'category', 'rating', 'comment']
      const csv = [
        headers.join(','),
        ...feedback.map(f => [
          f.id,
          f.runId,
          f.agentId,
          f.timestamp.toISOString(),
          f.type,
          f.category,
          f.rating,
          f.comment || ''
        ].join(','))
      ].join('\n')
      return csv
    }
  }
}

// Export singleton instance
export const feedbackService = FeedbackService.getInstance()
