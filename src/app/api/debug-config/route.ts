import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Debug config endpoint',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({
      status: 'success',
      message: 'Debug config check',
      receivedConfig: {
        hasApiKey: !!body.config?.apiKey,
        hasApiUrl: !!body.config?.apiUrl,
        hasModelName: !!body.config?.modelName,
        apiKeyLength: body.config?.apiKey?.length || 0,
        apiUrl: body.config?.apiUrl || 'missing',
        modelName: body.config?.modelName || 'missing'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Debug failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 