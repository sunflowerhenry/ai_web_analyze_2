'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ProxyConfig, ProxySettings } from '@/store/analysis-store'

interface ProxyConfigProps {
  proxySettings: ProxySettings
  onUpdate: (settings: ProxySettings) => void
}

export default function ProxyConfigComponent({ proxySettings, onUpdate }: ProxyConfigProps) {
  const [testingProxies, setTestingProxies] = useState<Set<string>>(new Set())

  const addProxy = () => {
    const newProxy: ProxyConfig = {
      host: '',
      port: 1080,
      type: 'socks5',
      status: 'unknown'
    }
    
    onUpdate({
      ...proxySettings,
      proxies: [...proxySettings.proxies, newProxy]
    })
  }

  const updateProxy = (index: number, updates: Partial<ProxyConfig>) => {
    const updatedProxies = proxySettings.proxies.map((proxy, i) => 
      i === index ? { ...proxy, ...updates } : proxy
    )
    
    onUpdate({
      ...proxySettings,
      proxies: updatedProxies
    })
  }

  const removeProxy = (index: number) => {
    const updatedProxies = proxySettings.proxies.filter((_, i) => i !== index)
    onUpdate({
      ...proxySettings,
      proxies: updatedProxies
    })
  }

  const testProxy = async (proxy: ProxyConfig, index: number) => {
    const proxyKey = `${proxy.host}:${proxy.port}`
    setTestingProxies(prev => new Set(prev).add(proxyKey))

    try {
      const response = await fetch('/api/test-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proxy,
          testUrl: proxySettings.testUrl 
        })
      })

      const result = await response.json()
      
      if (result.success) {
        updateProxy(index, { 
          status: result.result.status,
          lastChecked: new Date(result.result.lastChecked)
        })
        toast.success(`代理 ${proxy.host}:${proxy.port} 测试成功`)
      } else {
        updateProxy(index, { status: 'failed', lastChecked: new Date() })
        toast.error(`代理 ${proxy.host}:${proxy.port} 测试失败`)
      }
    } catch (error) {
      updateProxy(index, { status: 'failed', lastChecked: new Date() })
      toast.error(`代理 ${proxy.host}:${proxy.port} 测试失败`)
    } finally {
      setTestingProxies(prev => {
        const newSet = new Set(prev)
        newSet.delete(proxyKey)
        return newSet
      })
    }
  }

  const testAllProxies = async () => {
    if (proxySettings.proxies.length === 0) {
      toast.error('请先添加代理')
      return
    }

    toast.info('开始批量测试代理...')
    
    try {
      const response = await fetch('/api/test-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          proxies: proxySettings.proxies,
          testUrl: proxySettings.testUrl 
        })
      })

      const result = await response.json()
      
      if (result.success) {
        onUpdate({
          ...proxySettings,
          proxies: result.results
        })
        
        const workingCount = result.results.filter((p: ProxyConfig) => p.status === 'working').length
        toast.success(`批量测试完成，${workingCount}/${result.results.length} 个代理可用`)
      } else {
        toast.error('批量测试失败')
      }
    } catch (error) {
      toast.error('批量测试失败')
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'working':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />可用</Badge>
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />失败</Badge>
      default:
        return <Badge variant="secondary">未测试</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>代理配置</span>
          <Switch
            checked={proxySettings.enabled}
            onCheckedChange={(enabled) => onUpdate({ ...proxySettings, enabled })}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {proxySettings.enabled && (
          <>
            {/* 基础设置 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="strategy">代理策略</Label>
                <Select
                  value={proxySettings.strategy}
                  onValueChange={(strategy: 'round-robin' | 'concurrent' | 'random') => 
                    onUpdate({ ...proxySettings, strategy })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round-robin">轮询使用</SelectItem>
                    <SelectItem value="random">随机选择</SelectItem>
                    <SelectItem value="concurrent">并发使用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="maxConcurrentProxies">最大并发代理数</Label>
                <Input
                  id="maxConcurrentProxies"
                  type="number"
                  min="1"
                  max="10"
                  value={proxySettings.maxConcurrentProxies}
                  onChange={(e) => onUpdate({ 
                    ...proxySettings, 
                    maxConcurrentProxies: Number.parseInt(e.target.value) || 1 
                  })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="testUrl">测试URL</Label>
              <Input
                id="testUrl"
                value={proxySettings.testUrl}
                onChange={(e) => onUpdate({ ...proxySettings, testUrl: e.target.value })}
                placeholder="https://httpbin.org/ip"
              />
            </div>

            {/* 代理列表 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>代理列表</Label>
                <div className="space-x-2">
                  <Button onClick={testAllProxies} variant="outline" size="sm">
                    <TestTube className="w-4 h-4 mr-1" />
                    批量测试
                  </Button>
                  <Button onClick={addProxy} size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    添加代理
                  </Button>
                </div>
              </div>

              {proxySettings.proxies.map((proxy, index) => {
                const proxyKey = `${proxy.host}:${proxy.port}`
                const isTesting = testingProxies.has(proxyKey)
                
                return (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2">
                        <Select
                          value={proxy.type}
                          onValueChange={(type: 'socks5' | 'http' | 'https') => 
                            updateProxy(index, { type })
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="socks5">SOCKS5</SelectItem>
                            <SelectItem value="http">HTTP</SelectItem>
                            <SelectItem value="https">HTTPS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-3">
                        <Input
                          placeholder="主机地址"
                          value={proxy.host}
                          onChange={(e) => updateProxy(index, { host: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          type="number"
                          placeholder="端口"
                          value={proxy.port}
                          onChange={(e) => updateProxy(index, { port: Number.parseInt(e.target.value) || 1080 })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          placeholder="用户名(可选)"
                          value={proxy.username || ''}
                          onChange={(e) => updateProxy(index, { username: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Input
                          type="password"
                          placeholder="密码(可选)"
                          value={proxy.password || ''}
                          onChange={(e) => updateProxy(index, { password: e.target.value })}
                          className="h-8"
                        />
                      </div>
                      
                      <div className="col-span-1 flex gap-1">
                        <Button
                          onClick={() => testProxy(proxy, index)}
                          disabled={isTesting || !proxy.host}
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                        >
                          {isTesting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <TestTube className="w-3 h-3" />
                          )}
                        </Button>
                        
                        <Button
                          onClick={() => removeProxy(index)}
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(proxy.status)}
                        {proxy.lastChecked && (
                          <span className="text-xs text-gray-500">
                            最后测试: {new Date(proxy.lastChecked).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}

              {proxySettings.proxies.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无代理配置，点击"添加代理"开始配置
                </div>
              )}
            </div>

            {/* 使用说明 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">使用说明：</h4>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>轮询使用</strong>：按顺序轮流使用代理</li>
                <li>• <strong>随机选择</strong>：每次随机选择一个可用代理</li>
                <li>• <strong>并发使用</strong>：同时使用多个代理进行并发爬取</li>
                <li>• 建议并发数设置为 3-5 个，避免过多并发导致被封</li>
                <li>• 定期测试代理可用性，及时更换失效代理</li>
              </ul>
            </div>

            {/* 系统代理冲突提醒 */}
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <h4 className="font-medium mb-2 text-yellow-800">⚠️ 系统代理冲突提醒</h4>
              <div className="text-sm text-yellow-700 space-y-2">
                <p>如果您的电脑开启了系统代理（如科学上网工具），可能会与应用代理产生冲突，导致：</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>代理测试失败（ConnectionRefused 错误）</li>
                  <li>网站爬取超时或失败</li>
                  <li>网络请求路由混乱</li>
                </ul>
                <div className="mt-3 p-3 bg-yellow-100 rounded border-l-4 border-yellow-400">
                  <p className="font-medium">解决方案：</p>
                  <ol className="list-decimal list-inside space-y-1 mt-1">
                    <li>暂时关闭系统代理（推荐）</li>
                    <li>或在系统代理中添加本应用为例外</li>
                    <li>或使用"直连模式"（不配置应用代理）</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
} 