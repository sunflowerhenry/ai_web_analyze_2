'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Server, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2,
  Download,
  StopCircle,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

interface BackgroundTask {
  id: string
  type: 'analyze' | 'crawl'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: { current: number; total: number }
  urlCount: number
  resultsCount: number
  errorsCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

interface TaskSummary {
  total: number
  running: number
  pending: number
  completed: number
  failed: number
}

export function BackgroundTaskMonitor() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([])
  const [summary, setSummary] = useState<TaskSummary>({
    total: 0,
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0
  })
  const [isLoading, setIsLoading] = useState(false)

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/background-task')
      const data = await response.json()
      
      if (response.ok) {
        setTasks(data.tasks || [])
        setSummary(data.summary || {
          total: 0,
          running: 0,
          pending: 0,
          completed: 0,
          failed: 0
        })
      } else {
        toast.error(`获取任务列表失败: ${data.error}`)
      }
    } catch (error) {
      toast.error(`获取任务列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // 取消任务
  const cancelTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          taskId
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('任务已取消')
        fetchTasks()
      } else {
        toast.error(`取消任务失败: ${result.error}`)
      }
    } catch (error) {
      toast.error(`取消任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 获取任务结果
  const getTaskResults = async (taskId: string) => {
    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'results',
          taskId
        })
      })

      const result = await response.json()

      if (response.ok) {
        // 创建下载链接
        const dataStr = JSON.stringify(result, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `background-task-${taskId}.json`
        link.click()
        URL.revokeObjectURL(url)
        
        toast.success('任务结果已下载')
      } else {
        toast.error(`获取任务结果失败: ${result.error}`)
      }
    } catch (error) {
      toast.error(`获取任务结果失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 检查任务配置状态
  const checkTaskConfig = async (taskId: string) => {
    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'config-check',
          taskId
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success('配置检查完成', {
          description: `API密钥: ${result.configStatus.hasApiKey ? '已缓存' : '未缓存'}, 模型: ${result.configStatus.modelName || '未设置'}`,
          duration: 5000
        })
      } else {
        toast.error(`检查配置失败: ${result.error}`)
      }
    } catch (error) {
      toast.error(`检查配置失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 清理已完成的任务
  const cleanupTasks = async () => {
    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cleanup'
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message)
        fetchTasks()
      } else {
        toast.error(`清理任务失败: ${result.error}`)
      }
    } catch (error) {
      toast.error(`清理任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-gray-500" />
      case 'running': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  // 获取状态徽章
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">等待中</Badge>
      case 'running': return <Badge variant="default" className="bg-blue-500">运行中</Badge>
      case 'completed': return <Badge variant="default" className="bg-green-500">已完成</Badge>
      case 'failed': return <Badge variant="destructive">失败</Badge>
      default: return <Badge variant="outline">未知</Badge>
    }
  }

  // 格式化时间
  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-'
    return new Date(timeStr).toLocaleString('zh-CN')
  }

  // 计算进度百分比
  const getProgressPercentage = (progress: { current: number; total: number }) => {
    if (progress.total === 0) return 0
    return Math.round((progress.current / progress.total) * 100)
  }

  // 页面加载时获取任务列表
  useEffect(() => {
    fetchTasks()
    
    // 定期刷新正在运行的任务
    const interval = setInterval(() => {
      if (summary.running > 0 || summary.pending > 0) {
        fetchTasks()
      }
    }, 3000) // 每3秒检查一次

    return () => clearInterval(interval)
  }, [summary.running, summary.pending])

  // 页面可见性变化时刷新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchTasks()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            后台任务监控
            <Badge variant="outline">
              {summary.total} 个任务
            </Badge>
            {/* 快速状态概览 */}
            {summary.total > 0 && (
              <div className="flex items-center gap-1 ml-3">
                {summary.running > 0 && (
                  <Badge variant="default" className="bg-blue-500 text-xs px-2 py-0">
                    {summary.running} 运行中
                  </Badge>
                )}
                {summary.pending > 0 && (
                  <Badge variant="secondary" className="text-xs px-2 py-0">
                    {summary.pending} 等待
                  </Badge>
                )}
                {summary.failed > 0 && (
                  <Badge variant="destructive" className="text-xs px-2 py-0">
                    {summary.failed} 失败
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTasks}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={cleanupTasks}
              disabled={summary.completed === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清理
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            暂无后台任务
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="border rounded-lg p-3">
                {/* 任务基本信息 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <span className="font-medium text-sm">
                      {task.type === 'analyze' ? '分析任务' : '爬取任务'}
                    </span>
                    {getStatusBadge(task.status)}
                    <span className="text-xs text-muted-foreground font-mono">
                      ID: {task.id.substring(0, 8)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {task.status === 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => getTaskResults(task.id)}
                        className="h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        下载
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkTaskConfig(task.id)}
                      title="检查任务配置"
                      className="h-7 text-xs"
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    
                    {(task.status === 'pending' || task.status === 'running') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelTask(task.id)}
                        className="h-7 text-xs"
                      >
                        <StopCircle className="h-3 w-3 mr-1" />
                        取消
                      </Button>
                    )}
                  </div>
                </div>

                {/* 进度条和统计信息 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        进度: {task.progress.current}/{task.progress.total}
                      </span>
                      <span className="text-green-600">成功: {task.resultsCount}</span>
                      <span className="text-red-600">失败: {task.errorsCount}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {getProgressPercentage(task.progress)}%
                    </span>
                  </div>
                  
                  <Progress 
                    value={getProgressPercentage(task.progress)} 
                    className="h-1.5"
                  />
                </div>

                {/* 时间信息 - 仅显示重要时间 */}
                <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                  <span>创建: {formatTime(task.createdAt)}</span>
                  {task.completedAt && (
                    <span>完成: {formatTime(task.completedAt)}</span>
                  )}
                  {task.status === 'running' && task.startedAt && (
                    <span>开始: {formatTime(task.startedAt)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 