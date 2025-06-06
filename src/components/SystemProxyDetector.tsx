'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'

interface SystemProxyDetectorProps {
  onProxyDetected?: (hasProxy: boolean) => void
}

export default function SystemProxyDetector({ onProxyDetected }: SystemProxyDetectorProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [proxyStatus, setProxyStatus] = useState<'unknown' | 'detected' | 'none' | 'error'>('unknown')
  const [proxyInfo, setProxyInfo] = useState<string>('')

  const checkSystemProxy = async () => {
    setIsChecking(true)
    try {
      // 通过检测IP地址变化来判断是否有系统代理
      const responses = await Promise.allSettled([
        fetch('https://httpbin.org/ip', { cache: 'no-store' }),
        fetch('https://api.ipify.org?format=json', { cache: 'no-store' }),
        fetch('https://icanhazip.com', { cache: 'no-store' })
      ])

      const ips = []
      for (const response of responses) {
        if (response.status === 'fulfilled' && response.value.ok) {
          const data = await response.value.text()
          try {
            const parsed = JSON.parse(data)
            if (parsed.ip) ips.push(parsed.ip)
          } catch {
            // 可能是纯文本IP
            const ip = data.trim()
            if (ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
              ips.push(ip)
            }
          }
        }
      }

      if (ips.length === 0) {
        setProxyStatus('error')
        setProxyInfo('无法检测网络状态')
        onProxyDetected?.(false)
      } else {
        // 检查是否所有IP都相同
        const uniqueIPs = [...new Set(ips)]
        if (uniqueIPs.length === 1) {
          setProxyStatus('none')
          setProxyInfo(`当前IP: ${uniqueIPs[0]}`)
          onProxyDetected?.(false)
        } else {
          setProxyStatus('detected')
          setProxyInfo(`检测到多个IP: ${uniqueIPs.join(', ')}`)
          onProxyDetected?.(true)
        }
      }
    } catch (error) {
      setProxyStatus('error')
      setProxyInfo('网络检测失败')
      onProxyDetected?.(false)
      console.error('系统代理检测失败:', error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkSystemProxy()
  }, [])

  const getStatusDisplay = () => {
    switch (proxyStatus) {
      case 'detected':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          badge: <Badge variant="destructive">检测到系统代理</Badge>,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200'
        }
      case 'none':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          badge: <Badge variant="default" className="bg-green-500">无系统代理</Badge>,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200'
        }
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          badge: <Badge variant="secondary">检测失败</Badge>,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200'
        }
      default:
        return {
          icon: <Wifi className="w-4 h-4" />,
          badge: <Badge variant="secondary">检测中...</Badge>,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200'
        }
    }
  }

  const status = getStatusDisplay()

  return (
    <Card className={`border ${status.bgColor}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {status.icon}
          <span>系统代理检测</span>
          {status.badge}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`text-sm ${status.color}`}>
          {proxyInfo && <p>{proxyInfo}</p>}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={checkSystemProxy}
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

        {proxyStatus === 'detected' && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ 检测到系统代理</h4>
            <div className="text-sm text-yellow-700 space-y-2">
              <p>您的系统可能开启了代理（如科学上网工具），这可能影响应用的正常使用。</p>
              <div className="mt-2">
                <p className="font-medium">建议操作：</p>
                <ol className="list-decimal list-inside space-y-1 mt-1">
                  <li>暂时关闭系统代理软件</li>
                  <li>或在代理软件中设置本应用为直连</li>
                  <li>或使用应用内代理功能替代</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {proxyStatus === 'none' && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">网络环境正常，可以正常使用应用功能</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 