import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'
import { createProxyAgent } from '@/lib/proxy-utils'
import type { ProxyConfig } from '@/store/analysis-store'

export async function GET(request: NextRequest) {
  try {
    // 检查服务器端的IP地址（无代理）
    const response = await axios.get('https://httpbin.org/ip', {
      timeout: 10000,
      proxy: false // 强制不使用系统代理
    })
    
    const serverIp = response.data?.origin || 'Unknown'
    
    return NextResponse.json({
      success: true,
      serverIp,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('获取服务器IP失败:', error)
    return NextResponse.json(
      { success: false, error: '获取服务器IP失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proxyConfig } = body as { proxyConfig?: ProxyConfig }
    
    if (!proxyConfig) {
      return NextResponse.json(
        { success: false, error: '请提供代理配置' },
        { status: 400 }
      )
    }
    
    // 使用代理检查IP地址
    const agent = createProxyAgent(proxyConfig)
    
    const response = await axios.get('https://httpbin.org/ip', {
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 15000,
      proxy: false // 强制不使用系统代理
    })
    
    const proxyIp = response.data?.origin || 'Unknown'
    
    return NextResponse.json({
      success: true,
      proxyIp,
      proxyConfig: {
        host: proxyConfig.host,
        port: proxyConfig.port,
        type: proxyConfig.type
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('通过代理获取IP失败:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: `代理连接失败: ${error instanceof Error ? error.message : '未知错误'}` 
      },
      { status: 500 }
    )
  }
}
