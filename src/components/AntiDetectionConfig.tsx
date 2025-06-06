'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Shield, Eye, Clock, UserCheck } from 'lucide-react'
import type { AntiDetectionSettings } from '@/store/analysis-store'

interface AntiDetectionConfigProps {
  antiDetectionSettings: AntiDetectionSettings
  onUpdate: (settings: AntiDetectionSettings) => void
}

export default function AntiDetectionConfig({ antiDetectionSettings, onUpdate }: AntiDetectionConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span>反人机验证配置</span>
          <Switch
            checked={antiDetectionSettings.enabled}
            onCheckedChange={(enabled) => onUpdate({ ...antiDetectionSettings, enabled })}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {antiDetectionSettings.enabled && (
          <>
            {/* 浏览器模式 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  使用无头浏览器
                </Label>
                <Switch
                  checked={antiDetectionSettings.useHeadlessBrowser}
                  onCheckedChange={(useHeadlessBrowser) => 
                    onUpdate({ ...antiDetectionSettings, useHeadlessBrowser })
                  }
                />
              </div>
              <p className="text-xs text-gray-600">
                启用后将使用 Puppeteer 模拟真实浏览器，可绕过大部分反爬机制，但速度较慢
              </p>
            </div>

            {/* 随机用户代理 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  随机用户代理
                </Label>
                <Switch
                  checked={antiDetectionSettings.randomUserAgent}
                  onCheckedChange={(randomUserAgent) => 
                    onUpdate({ ...antiDetectionSettings, randomUserAgent })
                  }
                />
              </div>
              <p className="text-xs text-gray-600">
                每次请求使用不同的浏览器标识，模拟不同用户访问
              </p>
            </div>

            {/* 随机延迟 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  随机延迟
                </Label>
                <Switch
                  checked={antiDetectionSettings.randomDelay}
                  onCheckedChange={(randomDelay) => 
                    onUpdate({ ...antiDetectionSettings, randomDelay })
                  }
                />
              </div>
              
              {antiDetectionSettings.randomDelay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minDelay">最小延迟 (毫秒)</Label>
                    <Input
                      id="minDelay"
                      type="number"
                      min="100"
                      max="10000"
                      value={antiDetectionSettings.minDelay}
                      onChange={(e) => onUpdate({ 
                        ...antiDetectionSettings, 
                        minDelay: Number.parseInt(e.target.value) || 1000 
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxDelay">最大延迟 (毫秒)</Label>
                    <Input
                      id="maxDelay"
                      type="number"
                      min="100"
                      max="10000"
                      value={antiDetectionSettings.maxDelay}
                      onChange={(e) => onUpdate({ 
                        ...antiDetectionSettings, 
                        maxDelay: Number.parseInt(e.target.value) || 3000 
                      })}
                    />
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-600">
                在指定范围内随机延迟，模拟人工访问行为
              </p>
            </div>

            {/* 配置状态显示 */}
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">当前配置状态</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={antiDetectionSettings.useHeadlessBrowser ? "default" : "secondary"}>
                    {antiDetectionSettings.useHeadlessBrowser ? "已启用" : "已禁用"}
                  </Badge>
                  <span>无头浏览器</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={antiDetectionSettings.randomUserAgent ? "default" : "secondary"}>
                    {antiDetectionSettings.randomUserAgent ? "已启用" : "已禁用"}
                  </Badge>
                  <span>随机用户代理</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={antiDetectionSettings.randomDelay ? "default" : "secondary"}>
                    {antiDetectionSettings.randomDelay ? "已启用" : "已禁用"}
                  </Badge>
                  <span>随机延迟</span>
                </div>
                {antiDetectionSettings.randomDelay && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {antiDetectionSettings.minDelay}-{antiDetectionSettings.maxDelay}ms
                    </Badge>
                    <span>延迟范围</span>
                  </div>
                )}
              </div>
            </div>

            {/* 使用建议 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">使用建议</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div>
                  <strong>轻度保护网站:</strong> 启用随机用户代理和随机延迟即可
                </div>
                <div>
                  <strong>中度保护网站:</strong> 启用所有功能，延迟设置为 2000-5000ms
                </div>
                <div>
                  <strong>重度保护网站:</strong> 启用无头浏览器 + 代理 + 长延迟 (3000-8000ms)
                </div>
                <div className="mt-2 p-2 bg-yellow-100 rounded">
                  <strong>注意:</strong> 无头浏览器模式会显著降低爬取速度，但成功率更高
                </div>
              </div>
            </div>

            {/* 检测风险评估 */}
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">检测风险评估</h4>
              <div className="space-y-2 text-sm">
                {(() => {
                  let riskLevel = 0
                  const riskFactors: string[] = []
                  
                  if (!antiDetectionSettings.randomUserAgent) {
                    riskLevel += 2
                    riskFactors.push("固定用户代理容易被识别")
                  }
                  
                  if (!antiDetectionSettings.randomDelay) {
                    riskLevel += 3
                    riskFactors.push("固定请求间隔容易被检测")
                  } else if (antiDetectionSettings.maxDelay < 2000) {
                    riskLevel += 1
                    riskFactors.push("延迟时间较短，仍有被检测风险")
                  }
                  
                  if (!antiDetectionSettings.useHeadlessBrowser) {
                    riskLevel += 1
                    riskFactors.push("HTTP请求缺少浏览器特征")
                  }
                  
                  const getRiskColor = (level: number) => {
                    if (level <= 2) return "text-green-600"
                    if (level <= 4) return "text-yellow-600"
                    return "text-red-600"
                  }
                  
                  const getRiskText = (level: number) => {
                    if (level <= 2) return "低风险"
                    if (level <= 4) return "中等风险"
                    return "高风险"
                  }
                  
                  return (
                    <div>
                      <div className={`font-medium ${getRiskColor(riskLevel)}`}>
                        当前风险等级: {getRiskText(riskLevel)}
                      </div>
                      {riskFactors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {riskFactors.map((factor, index) => (
                            <li key={index} className="text-gray-600">• {factor}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })()}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 