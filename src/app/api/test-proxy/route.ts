import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { testProxy, testProxies } from '@/lib/proxy-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { proxy, proxies, testUrl } = body

    if (proxy) {
      // 测试单个代理
      const isWorking = await testProxy(proxy, testUrl)
      return NextResponse.json({
        success: true,
        result: {
          ...proxy,
          status: isWorking ? 'working' : 'failed',
          lastChecked: new Date()
        }
      })
    }

    if (proxies && Array.isArray(proxies)) {
      // 批量测试代理
      const results = await testProxies(proxies, testUrl)
      return NextResponse.json({
        success: true,
        results
      })
    }

    return NextResponse.json(
      { success: false, error: '请提供代理配置' },
      { status: 400 }
    )
  } catch (error) {
    console.error('代理测试失败:', error)
    return NextResponse.json(
      { success: false, error: '代理测试失败' },
      { status: 500 }
    )
  }
} 