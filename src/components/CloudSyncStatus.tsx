'use client'

import { useAnalysisStore } from '@/store/analysis-store'
import { Button } from '@/components/ui/button'
import { 
  Cloud, 
  CloudOff, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  HardDrive
} from 'lucide-react'
import { toast } from 'sonner'

export function CloudSyncStatus() {
  const { 
    isSyncingToCloud,
    lastCloudSyncTime,
    cloudSyncError,
    syncToCloud,
    loadFromCloud,
    analysisData
  } = useAnalysisStore()

  const handleManualSync = async () => {
    try {
      toast.info('开始手动同步到云端...')
      await syncToCloud()
      toast.success('数据已成功同步到云端!')
    } catch (error) {
      toast.error('同步失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const handleLoadFromCloud = async () => {
    try {
      toast.info('开始从云端加载数据...')
      await loadFromCloud()
      toast.success('数据已从云端恢复!')
    } catch (error) {
      toast.error('加载失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const getSyncStatusIcon = () => {
    if (isSyncingToCloud) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
    }
    
    if (cloudSyncError) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }
    
    if (lastCloudSyncTime) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }
    
    return <CloudOff className="w-4 h-4 text-gray-400" />
  }

  const getSyncStatusText = () => {
    if (isSyncingToCloud) {
      return '正在同步...'
    }
    
    if (cloudSyncError) {
      return `同步失败: ${cloudSyncError}`
    }
    
    if (lastCloudSyncTime) {
      const timeAgo = new Date().getTime() - new Date(lastCloudSyncTime).getTime()
      const minutes = Math.floor(timeAgo / (1000 * 60))
      
      if (minutes < 1) {
        return '刚刚同步'
      } else if (minutes < 60) {
        return `${minutes}分钟前同步`
      } else {
        return new Date(lastCloudSyncTime).toLocaleString()
      }
    }
    
    return '未同步'
  }

  const getStorageInfo = () => {
    const dataCount = analysisData.length
    const dataSize = JSON.stringify(analysisData).length
    const sizeInKB = Math.round(dataSize / 1024)
    
    return {
      count: dataCount,
      size: sizeInKB
    }
  }

  const storageInfo = getStorageInfo()

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium text-gray-900">云端同步状态</h3>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {getSyncStatusIcon()}
          <span>{getSyncStatusText()}</span>
        </div>
      </div>

      {/* 存储信息 */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">数据统计</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">分析记录:</span>
            <span className="ml-2 font-medium">{storageInfo.count} 条</span>
          </div>
          <div>
            <span className="text-gray-500">数据大小:</span>
            <span className="ml-2 font-medium">{storageInfo.size} KB</span>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {cloudSyncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">同步错误</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{cloudSyncError}</p>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          onClick={handleManualSync}
          disabled={isSyncingToCloud}
          size="sm"
          className="flex-1"
        >
          {isSyncingToCloud ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          同步到云端
        </Button>
        
        <Button
          onClick={handleLoadFromCloud}
          disabled={isSyncingToCloud}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <Download className="w-4 h-4 mr-2" />
          从云端恢复
        </Button>
        
        <Button
          onClick={() => {
            // 强制刷新同步状态
            window.location.reload()
          }}
          variant="ghost"
          size="sm"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* 环境信息 */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>存储环境: {process.env.NODE_ENV === 'production' ? '☁️ 云端' : '💻 本地'}</span>
          <span>自动同步: 每5分钟</span>
        </div>
      </div>
    </div>
  )
} 