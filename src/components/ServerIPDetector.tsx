'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Server, Globe, TestTube } from 'lucide-react'
import { toast } from 'sonner'
import type { ProxyConfig } from '@/store/analysis-store'

interface ServerIPDetectorProps {
  onServerIPDetected?: (serverIP: string) => void
}

export default function ServerIPDetector({ onServerIPDetected }: ServerIPDetectorProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [serverIP, setServerIP] = useState<string>('')
  const [proxyIP, setProxyIP] = useState<string>('')
  const [isTestingProxy, setIsTestingProxy] = useState(false)
  
  // 代理配置状态
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    host: '',
    port: 1080,
    type: 'socks5',
    username: '',
    password: '',
    status: 'unknown'
  })

  // 检查服务器端IP
  const checkServerIP = async () => {
    setIsChecking(true)
    try {
      const response = await fetch('/api/check-server-ip', {
        method: 'GET',
        cache: 'no-store'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setServerIP(data.serverIp)
        onServerIPDetected?.(data.serverIp)
        toast.success('服务器IP检测成功')
      } else {
        toast.error('服务器IP检测失败')
      }
    } catch (error) {
      console.error('检测服务器IP失败:', error)
      toast.error('检测服务器IP失败')
    } finally {
      setIsChecking(false)
    }
  }

  // 测试代理IP
  const testProxyIP = async () => {
    if (!proxyConfig.host || !proxyConfig.port) {
      toast.error('请填写代理地址和端口')
      return
    }

    setIsTestingProxy(true)
    try {
      const response = await fetch('/api/check-server-ip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ proxyConfig }),
        cache: 'no-store'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProxyIP(data.proxyIp)
        toast.success(`代理测试成功，IP: ${data.proxyIp}`)
      } else {
        toast.error(`代理测试失败: ${data.error}`)
        setProxyIP('')
      }
    } catch (error) {
      console.error('测试代理失败:', error)
      toast.error('测试代理失败')
      setProxyIP('')
    } finally {
      setIsTestingProxy(false)
    }
  }

  // 页面加载时自动检测服务器IP
  useEffect(() => {
    checkServerIP()
  }, [])

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Server className="w-5 h-5" />
          服务器端IP检测与代理配置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 服务器IP显示 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">当前服务器IP地址</Label>
            <Button
              onClick={checkServerIP}
              disabled={isChecking}
              variant="outline"
              size="sm"
            >
              {isChecking ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  检测中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重新检测
                </>
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="font-mono text-sm bg-white px-2 py-1 rounded border">
              {serverIP || '未检测'}
            </span>
            {serverIP && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                已检测
              </Badge>
            )}
          </div>
        </div>

        {/* 代理配置 */}
        <div className="space-y-4 border-t pt-4">
          <Label className="text-sm font-medium">SOCKS5 代理配置</Label>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proxy-host">代理地址</Label>
              <Input
                id="proxy-host"
                placeholder="例如: 127.0.0.1"
                value={proxyConfig.host}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, host: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proxy-port">端口</Label>
              <Input
                id="proxy-port"
                type="number"
                placeholder="例如: 1080"
                value={proxyConfig.port}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, port: Number(e.target.value) || 1080 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proxy-type">代理类型</Label>
              <Select
                value={proxyConfig.type}
                onValueChange={(value: 'socks5' | 'http' | 'https') => 
                  setProxyConfig(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socks5">SOCKS5</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proxy-username">用户名（可选）</Label>
              <Input
                id="proxy-username"
                placeholder="代理用户名"
                value={proxyConfig.username || ''}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="proxy-password">密码（可选）</Label>
              <Input
                id="proxy-password"
                type="password"
                placeholder="代理密码"
                value={proxyConfig.password || ''}
                onChange={(e) => setProxyConfig(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
          </div>

          {/* 代理测试 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={testProxyIP}
                disabled={isTestingProxy || !proxyConfig.host || !proxyConfig.port}
                variant="outline"
                size="sm"
              >
                {isTestingProxy ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    测试中...
                  </>
                ) : (
                  <>
                    <TestTube className="w-3 h-3 mr-1" />
                    测试代理
                  </>
                )}
              </Button>
              
              {proxyIP && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">代理IP:</span>
                  <span className="font-mono text-sm bg-white px-2 py-1 rounded border">
                    {proxyIP}
                  </span>
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    可用
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 说明信息 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <span className="text-xl">💡</span>
            使用说明
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-100 rounded-full text-blue-600 text-sm font-bold flex-shrink-0 mt-0.5">
                  🌐
                </div>
                <div>
                  <p className="font-medium text-blue-800 text-sm">服务器IP检测</p>
                  <p className="text-blue-700 text-xs">显示运行此应用的服务器的公网IP地址</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-purple-100 rounded-full text-purple-600 text-sm font-bold flex-shrink-0 mt-0.5">
                  🔧
                </div>
                <div>
                  <p className="font-medium text-blue-800 text-sm">代理配置</p>
                  <p className="text-blue-700 text-xs">配置SOCKS5代理，让服务器通过代理访问网站</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full text-green-600 text-sm font-bold flex-shrink-0 mt-0.5">
                  🧪
                </div>
                <div>
                  <p className="font-medium text-blue-800 text-sm">代理测试</p>
                  <p className="text-blue-700 text-xs">测试代理是否可用，并显示通过代理访问的IP地址</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 bg-orange-100 rounded-full text-orange-600 text-sm font-bold flex-shrink-0 mt-0.5">
                  🛡️
                </div>
                <div>
                  <p className="font-medium text-blue-800 text-sm">绕过限制</p>
                  <p className="text-blue-700 text-xs">配置代理后，网站爬取将通过代理服务器进行，可以绕过IP限制</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 