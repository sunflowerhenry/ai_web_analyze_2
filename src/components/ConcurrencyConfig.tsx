'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Zap, Clock } from 'lucide-react'
import type { ConcurrencySettings } from '@/store/analysis-store'

interface ConcurrencyConfigProps {
  concurrencySettings: ConcurrencySettings
  onUpdate: (settings: ConcurrencySettings) => void
}

export default function ConcurrencyConfig({ concurrencySettings, onUpdate }: ConcurrencyConfigProps) {
  const getConcurrencyRecommendation = (concurrent: number) => {
    if (concurrent <= 2) {
      return { level: '保守', color: 'bg-green-500', description: '安全稳定，适合大多数网站' }
    } else if (concurrent <= 5) {
      return { level: '适中', color: 'bg-yellow-500', description: '平衡速度和稳定性' }
    } else if (concurrent <= 8) {
      return { level: '激进', color: 'bg-orange-500', description: '高速但可能触发反爬机制' }
    } else {
      return { level: '极限', color: 'bg-red-500', description: '极高风险，容易被封禁' }
    }
  }

  const getDelayRecommendation = (delay: number) => {
    if (delay >= 3000) {
      return { level: '保守', color: 'bg-green-500', description: '模拟人工访问，最安全' }
    } else if (delay >= 1500) {
      return { level: '适中', color: 'bg-yellow-500', description: '平衡速度和安全性' }
    } else if (delay >= 500) {
      return { level: '激进', color: 'bg-orange-500', description: '较快但有风险' }
    } else {
      return { level: '极限', color: 'bg-red-500', description: '极快但容易被检测' }
    }
  }

  const recommendation = getConcurrencyRecommendation(concurrencySettings.maxConcurrent)
  const delayRecommendation = getDelayRecommendation(concurrencySettings.delayBetweenRequests)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          <span>并发配置</span>
          <Switch
            checked={concurrencySettings.enabled}
            onCheckedChange={(enabled) => onUpdate({ ...concurrencySettings, enabled })}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {concurrencySettings.enabled && (
          <>
            {/* 最大并发数 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxConcurrent">最大并发数</Label>
                <div className="flex items-center gap-2">
                  <Badge className={recommendation.color}>
                    {recommendation.level}
                  </Badge>
                  <span className="text-sm font-medium">{concurrencySettings.maxConcurrent}</span>
                </div>
              </div>
              
                                            <Slider
                 value={[concurrencySettings.maxConcurrent]}
                 onValueChange={(values: number[]) => onUpdate({ 
                   ...concurrencySettings, 
                   maxConcurrent: values[0] || 1
                 })}
                 max={10}
                 min={1}
                 step={1}
                 className="w-full"
               />
               
               <p className="text-xs text-gray-600">{recommendation.description}</p>
             </div>

             {/* 请求间延迟 */}
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <Label htmlFor="delayBetweenRequests">请求间延迟 (毫秒)</Label>
                 <div className="flex items-center gap-2">
                   <Badge className={delayRecommendation.color}>
                     {delayRecommendation.level}
                   </Badge>
                   <span className="text-sm font-medium">{concurrencySettings.delayBetweenRequests}ms</span>
                 </div>
               </div>
               
               <Slider
                 value={[concurrencySettings.delayBetweenRequests]}
                 onValueChange={(values: number[]) => onUpdate({ 
                   ...concurrencySettings, 
                   delayBetweenRequests: values[0] || 1000
                 })}
                 max={5000}
                 min={100}
                 step={100}
                 className="w-full"
               />
              
              <p className="text-xs text-gray-600">{delayRecommendation.description}</p>
            </div>

            {/* 重试次数 */}
            <div className="space-y-2">
              <Label htmlFor="retryAttempts">失败重试次数</Label>
              <Input
                id="retryAttempts"
                type="number"
                min="0"
                max="5"
                value={concurrencySettings.retryAttempts}
                                 onChange={(e) => onUpdate({ 
                   ...concurrencySettings, 
                   retryAttempts: Number.parseInt(e.target.value) || 0 
                 })}
              />
              <p className="text-xs text-gray-600">
                当请求失败时的重试次数，建议设置为 1-3 次
              </p>
            </div>

            {/* 性能预估 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                性能预估
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">理论速度提升:</span>
                  <span className="ml-2 font-medium">
                    {concurrencySettings.maxConcurrent}x
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">单页面耗时:</span>
                  <span className="ml-2 font-medium">
                    ~{Math.round((concurrencySettings.delayBetweenRequests + 2000) / 1000)}秒
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">100个URL预估:</span>
                  <span className="ml-2 font-medium">
                    ~{Math.round((100 / concurrencySettings.maxConcurrent) * (concurrencySettings.delayBetweenRequests + 2000) / 1000 / 60)}分钟
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">风险等级:</span>
                  <span className={`ml-2 font-medium ${
                    recommendation.level === '保守' ? 'text-green-600' :
                    recommendation.level === '适中' ? 'text-yellow-600' :
                    recommendation.level === '激进' ? 'text-orange-600' : 'text-red-600'
                  }`}>
                    {recommendation.level}
                  </span>
                </div>
              </div>
            </div>

            {/* 建议配置 */}
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                推荐配置
              </h4>
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <strong>保守模式:</strong>
                    <br />并发: 2, 延迟: 3000ms
                    <br />适合: 企业网站、政府网站
                  </div>
                  <div>
                    <strong>平衡模式:</strong>
                    <br />并发: 3-5, 延迟: 1500ms
                    <br />适合: 一般商业网站
                  </div>
                  <div>
                    <strong>高速模式:</strong>
                    <br />并发: 6-8, 延迟: 500ms
                    <br />适合: 简单静态网站
                  </div>
                </div>
                <p className="text-gray-600 mt-2">
                  <strong>注意:</strong> 过高的并发可能导致IP被封禁，建议配合代理使用
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 