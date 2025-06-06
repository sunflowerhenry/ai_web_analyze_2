import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import axios from 'axios'

interface TestRequest {
  config: {
    modelName: string
    apiUrl: string
    apiKey: string
  }
}

interface TestResult {
  status: 'success' | 'error'
  message: string
  responseTime?: number
  model?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const { config }: TestRequest = await request.json()
    
    // 验证必要参数
    if (!config.apiKey) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'API密钥未配置',
        error: 'MISSING_API_KEY'
      }, { status: 400 })
    }
    
    if (!config.apiUrl) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'API地址未配置',
        error: 'MISSING_API_URL'
      }, { status: 400 })
    }

    if (!config.modelName) {
      return NextResponse.json({ 
        status: 'error', 
        message: '模型名称未配置',
        error: 'MISSING_MODEL_NAME'
      }, { status: 400 })
    }

    const startTime = Date.now()
    
    try {
      // 发送测试请求
      const response = await axios.post(
        config.apiUrl,
        {
          model: config.modelName,
          messages: [
            {
              role: 'user',
              content: '测试连接，请回复"连接成功"'
            }
          ],
          max_tokens: 50,
          temperature: 0
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      )
      
      const responseTime = Date.now() - startTime
      
      // 检查响应格式
      const aiResponse = response.data.choices?.[0]?.message?.content || 
                        response.data.output?.text ||
                        response.data.result ||
                        response.data.content

      if (!aiResponse) {
        return NextResponse.json({
          status: 'error',
          message: 'API响应格式不正确',
          error: 'INVALID_RESPONSE_FORMAT',
          responseTime
        })
      }

      return NextResponse.json({
        status: 'success',
        message: 'API连接成功',
        responseTime,
        model: config.modelName,
        response: aiResponse.substring(0, 100) // 只返回前100个字符作为示例
      })

    } catch (error) {
      const responseTime = Date.now() - startTime
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return NextResponse.json({
            status: 'error',
            message: 'API密钥无效或已过期',
            error: 'INVALID_API_KEY',
            responseTime
          })
        } else if (error.response?.status === 429) {
          return NextResponse.json({
            status: 'error',
            message: 'API调用频率超限，请稍后重试',
            error: 'RATE_LIMIT_EXCEEDED',
            responseTime
          })
        } else if (error.response?.status === 400) {
          return NextResponse.json({
            status: 'error',
            message: '请求参数错误，请检查模型名称和API配置',
            error: 'BAD_REQUEST',
            responseTime
          })
        } else if (error.response?.status === 404) {
          return NextResponse.json({
            status: 'error',
            message: 'API地址不存在，请检查API URL配置',
            error: 'API_NOT_FOUND',
            responseTime
          })
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return NextResponse.json({
            status: 'error',
            message: '无法连接到API服务器，请检查网络和API地址',
            error: 'CONNECTION_FAILED',
            responseTime
          })
        } else if (error.code === 'ECONNABORTED') {
          return NextResponse.json({
            status: 'error',
            message: 'API请求超时，服务器响应过慢',
            error: 'TIMEOUT',
            responseTime
          })
        }
      }
      
      return NextResponse.json({
        status: 'error',
        message: `API测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error: 'UNKNOWN_ERROR',
        responseTime
      })
    }
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: `请求处理失败: ${error instanceof Error ? error.message : '未知错误'}`,
      error: 'REQUEST_PROCESSING_ERROR'
    }, { status: 500 })
  }
} 