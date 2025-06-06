'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Settings, TestTube, Save, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, Bookmark, BookmarkCheck, Trash2, RefreshCw, Wifi, Zap, Shield, UserCheck, Clock } from 'lucide-react'
import { useAnalysisStore, type AIConfig } from '@/store/analysis-store'
import { toast } from 'sonner'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import ProxyConfigComponent from '@/components/ProxyConfig'
import ConcurrencyConfig from '@/components/ConcurrencyConfig'
import AntiDetectionConfig from '@/components/AntiDetectionConfig'
import ServerIPDetector from '@/components/ServerIPDetector'

interface SavedConfig {
  name: string
  config: {
    modelName: string
    apiUrl: string
    apiKey: string
  }
  createdAt: string
}

interface SavedPrompt {
  name: string
  template: string
  createdAt: string
}

export default function ConfigPage() {
  const router = useRouter()
  const { config, updateConfig } = useAnalysisStore()
  const [formData, setFormData] = useState<AIConfig>(() => {
    // 使用函数式初始化，确保有完整的默认配置
    return {
      modelName: 'gpt-3.5-turbo',
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: '',
      promptTemplate: '',
      companyNamePrompt: '',
      emailCrawlPrompt: '',
      proxySettings: {
        enabled: false,
        proxies: [],
        strategy: 'round-robin',
        maxConcurrentProxies: 3,
        testUrl: 'https://httpbin.org/ip'
      },
      concurrencySettings: {
        enabled: false,
        maxConcurrent: 3,
        delayBetweenRequests: 2000,
        retryAttempts: 2
      },
      antiDetectionSettings: {
        enabled: true,
        useHeadlessBrowser: false,
        randomUserAgent: true,
        randomDelay: true,
        minDelay: 1000,
        maxDelay: 3000
      }
    }
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  
  // 保存的配置和提示词
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([])
  const [configName, setConfigName] = useState('')
  const [promptName, setPromptName] = useState('')

  // 确保配置正确初始化
  useEffect(() => {
    if (!isInitialized) {
      // 直接从 localStorage 读取配置
      try {
        const storedData = localStorage.getItem('analysis-store')
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          if (parsedData.state?.config) {
            setFormData(parsedData.state.config)
            console.log('Loaded config from localStorage:', parsedData.state.config)
          }
        }
      } catch (error) {
        console.error('Failed to load config from localStorage:', error)
      }
      setIsInitialized(true)
    }
  }, [isInitialized])

  // 当 Zustand 配置更新时，同步更新 formData
  useEffect(() => {
    if (isInitialized && config) {
      setFormData(config)
    }
  }, [config, isInitialized])

  const handleSave = () => {
    console.log('handleSave called with formData:', formData)
    
    if (!formData.apiKey.trim()) {
      toast.error('请输入API密钥')
      return
    }
    
    if (!formData.apiUrl.trim()) {
      toast.error('请输入API地址')
      return
    }

    try {
      console.log('Calling updateConfig with:', formData)
      updateConfig(formData)
      setHasUnsavedChanges(false)
      
      // 立即显示成功提醒
      toast.success('配置已保存')
      
      // 验证保存是否成功
      setTimeout(() => {
        try {
          const storedData = localStorage.getItem('analysis-store')
          if (storedData) {
            const parsedData = JSON.parse(storedData)
            console.log('Verification - stored config:', parsedData.state?.config)
            
            // 如果验证失败，显示警告
            if (!parsedData.state?.config?.apiKey) {
              toast.warning('配置保存可能未完全成功，请检查')
            }
          }
        } catch (error) {
          console.error('Verification failed:', error)
          toast.error('配置验证失败')
        }
      }, 100)
    } catch (error) {
      console.error('Save config failed:', error)
      toast.error('配置保存失败')
    }
  }

  // 保存代理配置
  const handleSaveProxy = () => {
    try {
      updateConfig({ proxySettings: formData.proxySettings })
      toast.success('代理配置已保存')
    } catch (error) {
      console.error('Save proxy config failed:', error)
      toast.error('代理配置保存失败')
    }
  }

  // 保存并发配置
  const handleSaveConcurrency = () => {
    try {
      updateConfig({ concurrencySettings: formData.concurrencySettings })
      toast.success('并发配置已保存')
    } catch (error) {
      console.error('Save concurrency config failed:', error)
      toast.error('并发配置保存失败')
    }
  }

  // 保存反人机配置
  const handleSaveAntiDetection = () => {
    try {
      updateConfig({ antiDetectionSettings: formData.antiDetectionSettings })
      toast.success('反人机配置已保存')
    } catch (error) {
      console.error('Save anti-detection config failed:', error)
      toast.error('反人机配置保存失败')
    }
  }

  // 保存提示词配置
  const handleSavePromptTemplate = () => {
    try {
      updateConfig({ 
        promptTemplate: formData.promptTemplate,
        companyNamePrompt: formData.companyNamePrompt,
        emailCrawlPrompt: formData.emailCrawlPrompt
      })
      toast.success('提示词配置已保存')
    } catch (error) {
      console.error('Save prompt template failed:', error)
      toast.error('提示词配置保存失败')
    }
  }

  // 全部保存
  const handleSaveAll = () => {
    console.log('handleSaveAll called with formData:', formData)
    
    if (!formData.apiKey.trim()) {
      toast.error('请输入API密钥')
      return
    }
    
    if (!formData.apiUrl.trim()) {
      toast.error('请输入API地址')
      return
    }

    try {
      console.log('Calling updateConfig (saveAll) with:', formData)
      updateConfig(formData)
      setHasUnsavedChanges(false)
      
      // 立即显示成功提醒
      toast.success('所有配置已保存')
      
      // 验证保存是否成功
      setTimeout(() => {
        try {
          const storedData = localStorage.getItem('analysis-store')
          if (storedData) {
            const parsedData = JSON.parse(storedData)
            console.log('Verification (saveAll) - stored config:', parsedData.state?.config)
            
            // 如果验证失败，显示警告
            if (!parsedData.state?.config?.apiKey) {
              toast.warning('配置保存可能未完全成功，请检查')
            }
          }
        } catch (error) {
          console.error('Verification (saveAll) failed:', error)
          toast.error('配置验证失败')
        }
      }, 100)
    } catch (error) {
      console.error('Save all config failed:', error)
      toast.error('配置保存失败')
    }
  }

  const handleTest = async () => {
    if (!formData.apiKey.trim() || !formData.apiUrl.trim()) {
      toast.error('请先填写API密钥和地址')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const testPrompt = '请回复"测试成功"'
      
      const response = await axios.post('/api/analyze', {
        config: formData,
        crawledContent: {
          title: '测试网站',
          description: '这是一个测试',
          content: '测试内容'
        }
      }, {
        timeout: 15000
      })

      if (response.data.result) {
        setTestResult('success')
        toast.success('API连接测试成功')
      } else {
        setTestResult('error')
        toast.error('API测试失败')
      }
    } catch (error) {
      setTestResult('error')
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error('API密钥无效')
        } else if (error.response?.status === 429) {
          toast.error('API调用频率超限')
        } else {
          toast.error(`API测试失败: ${error.response?.data?.error || error.message}`)
        }
      } else {
        toast.error('API测试失败')
      }
    } finally {
      setIsTesting(false)
    }
  }

  // 检测配置变化
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(config)
    setHasUnsavedChanges(hasChanges)
  }, [formData, config])

  // 加载保存的配置和提示词
  useEffect(() => {
    const configs = localStorage.getItem('saved-ai-configs')
    const prompts = localStorage.getItem('saved-prompts')
    
    if (configs) {
      try {
        setSavedConfigs(JSON.parse(configs))
      } catch (error) {
        console.error('Failed to load saved configs:', error)
      }
    }
    
    if (prompts) {
      try {
        setSavedPrompts(JSON.parse(prompts))
      } catch (error) {
        console.error('Failed to load saved prompts:', error)
      }
    }
  }, [])

  const presetConfigs = [
    {
      name: 'OpenAI GPT-3.5',
      modelName: 'gpt-3.5-turbo',
      apiUrl: 'https://api.openai.com/v1/chat/completions'
    },
    {
      name: 'OpenAI GPT-4',
      modelName: 'gpt-4',
      apiUrl: 'https://api.openai.com/v1/chat/completions'
    },
    {
      name: 'OpenAI GPT-4o',
      modelName: 'gpt-4o',
      apiUrl: 'https://api.openai.com/v1/chat/completions'
    },
    {
      name: 'DeepSeek Chat',
      modelName: 'deepseek-chat',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions'
    },
    {
      name: 'DeepSeek Coder',
      modelName: 'deepseek-coder',
      apiUrl: 'https://api.deepseek.com/v1/chat/completions'
    },
    {
      name: 'OpenRouter GPT-4',
      modelName: 'openai/gpt-4',
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions'
    },
    {
      name: 'OpenRouter Claude',
      modelName: 'anthropic/claude-3-sonnet',
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions'
    }
  ]

  const handlePresetSelect = (preset: typeof presetConfigs[0]) => {
    setFormData((prev: AIConfig) => ({
      ...prev,
      modelName: preset.modelName,
      apiUrl: preset.apiUrl
    }))
    toast.success(`已应用 ${preset.name} 配置`)
  }

  // 处理返回按钮
  const handleGoBack = () => {
    if (hasUnsavedChanges) {
      if (confirm('您有未保存的配置更改，确定要离开吗？')) {
        router.push('/')
      }
    } else {
      router.push('/')
    }
  }

  // 保存API配置
  const handleSaveConfig = () => {
    if (!configName.trim()) {
      toast.error('请输入配置名称')
      return
    }
    
    if (!formData.modelName || !formData.apiUrl || !formData.apiKey) {
      toast.error('请完整填写配置信息')
      return
    }

    const newConfig: SavedConfig = {
      name: configName.trim(),
      config: {
        modelName: formData.modelName,
        apiUrl: formData.apiUrl,
        apiKey: formData.apiKey
      },
      createdAt: new Date().toISOString()
    }

    const updatedConfigs = [...savedConfigs.filter(c => c.name !== configName.trim()), newConfig]
    setSavedConfigs(updatedConfigs)
    localStorage.setItem('saved-ai-configs', JSON.stringify(updatedConfigs))
    setConfigName('')
    toast.success('配置已保存')
  }

  // 加载API配置
  const handleLoadConfig = (config: SavedConfig) => {
    setFormData((prev: AIConfig) => ({
      ...prev,
      ...config.config
    }))
    toast.success(`已加载配置: ${config.name}`)
  }

  // 删除API配置
  const handleDeleteConfig = (configName: string) => {
    const updatedConfigs = savedConfigs.filter(c => c.name !== configName)
    setSavedConfigs(updatedConfigs)
    localStorage.setItem('saved-ai-configs', JSON.stringify(updatedConfigs))
    toast.success('配置已删除')
  }

  // 保存提示词
  const handleSavePrompt = () => {
    if (!promptName.trim()) {
      toast.error('请输入提示词名称')
      return
    }
    
    if (!formData.promptTemplate.trim()) {
      toast.error('请输入提示词内容')
      return
    }

    const newPrompt: SavedPrompt = {
      name: promptName.trim(),
      template: formData.promptTemplate,
      createdAt: new Date().toISOString()
    }

    const updatedPrompts = [...savedPrompts.filter(p => p.name !== promptName.trim()), newPrompt]
    setSavedPrompts(updatedPrompts)
    localStorage.setItem('saved-prompts', JSON.stringify(updatedPrompts))
    setPromptName('')
    toast.success('提示词已保存')
  }

  // 加载提示词
  const handleLoadPrompt = (prompt: SavedPrompt) => {
    setFormData((prev: AIConfig) => ({
      ...prev,
      promptTemplate: prompt.template
    }))
    toast.success(`已加载提示词: ${prompt.name}`)
  }

  // 删除提示词
  const handleDeletePrompt = (promptName: string) => {
    const updatedPrompts = savedPrompts.filter(p => p.name !== promptName)
    setSavedPrompts(updatedPrompts)
    localStorage.setItem('saved-prompts', JSON.stringify(updatedPrompts))
    toast.success('提示词已删除')
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              AI 配置管理
            </h1>
            <p className="text-muted-foreground mt-2">
              配置AI模型参数和分析提示词，支持OpenAI及兼容API
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleSaveAll}
              disabled={!formData.apiKey.trim() || !formData.apiUrl.trim()}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              全部保存
            </Button>
            
            <Button 
              onClick={handleGoBack}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              返回主页
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* 系统代理检测 */}
        <ServerIPDetector />

        {/* 快速配置 */}
        <Card>
          <CardHeader>
            <CardTitle>快速配置模板</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {presetConfigs.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  onClick={() => handlePresetSelect(preset)}
                  className="h-auto p-4 flex flex-col items-start"
                >
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-muted-foreground">{preset.modelName}</div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API 配置 */}
        <Card>
          <CardHeader>
            <CardTitle>API 配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">模型名称</Label>
                <Input
                  id="modelName"
                  value={formData.modelName}
                  onChange={(e) => setFormData((prev: AIConfig) => ({ ...prev, modelName: e.target.value }))}
                  placeholder="例如: gpt-3.5-turbo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiUrl">API 地址</Label>
                <Input
                  id="apiUrl"
                  value={formData.apiUrl}
                  onChange={(e) => setFormData((prev: AIConfig) => ({ ...prev, apiUrl: e.target.value }))}
                  placeholder="例如: https://api.openai.com/v1/chat/completions"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API 密钥</Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  value={formData.apiKey}
                  onChange={(e) => setFormData((prev: AIConfig) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="请输入您的API密钥"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                密钥将安全保存在本地浏览器中，不会上传到服务器
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  保存配置
                </Button>
              </div>

              {/* 保存配置 */}
              <div className="border-t pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="输入配置名称"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={handleSaveConfig}
                    disabled={!configName.trim()}
                  >
                    <Bookmark className="h-4 w-4 mr-2" />
                    保存配置
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 已保存的配置 */}
        {savedConfigs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>已保存的配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedConfigs.map((config) => (
                  <div key={config.name} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{config.name}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteConfig(config.name)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{config.config.modelName}</p>
                      <p className="truncate">{config.config.apiUrl}</p>
                      <p className="text-xs">
                        {new Date(config.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadConfig(config)}
                      className="w-full"
                    >
                      <BookmarkCheck className="h-3 w-3 mr-1" />
                      加载配置
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 代理配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>代理配置</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSaveProxy}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存代理配置
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProxyConfigComponent
              proxySettings={formData.proxySettings || {
                enabled: false,
                proxies: [],
                strategy: 'round-robin',
                maxConcurrentProxies: 3,
                testUrl: 'https://httpbin.org/ip'
              }}
              onUpdate={(proxySettings) => setFormData((prev: AIConfig) => ({ ...prev, proxySettings }))}
            />
          </CardContent>
        </Card>

        {/* 并发配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>并发配置</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSaveConcurrency}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存并发配置
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ConcurrencyConfig
              concurrencySettings={formData.concurrencySettings || {
                enabled: false,
                maxConcurrent: 3,
                delayBetweenRequests: 1500,
                retryAttempts: 1
              }}
              onUpdate={(concurrencySettings) => setFormData((prev: AIConfig) => ({ ...prev, concurrencySettings }))}
            />
          </CardContent>
        </Card>

        {/* 反人机验证配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>反人机验证配置</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSaveAntiDetection}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存反人机配置
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AntiDetectionConfig
              antiDetectionSettings={formData.antiDetectionSettings || {
                enabled: false,
                useHeadlessBrowser: false,
                randomUserAgent: true,
                randomDelay: true,
                minDelay: 1000,
                maxDelay: 3000
              }}
              onUpdate={(antiDetectionSettings) => setFormData((prev: AIConfig) => ({ ...prev, antiDetectionSettings }))}
            />
          </CardContent>
        </Card>

        {/* 分析提示词 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>分析提示词</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSavePromptTemplate}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                保存提示词配置
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="promptTemplate">提示词模板</Label>
              <Textarea
                id="promptTemplate"
                value={formData.promptTemplate}
                onChange={(e) => setFormData((prev: AIConfig) => ({ ...prev, promptTemplate: e.target.value }))}
                rows={12}
                className="font-mono text-sm"
              />
              <div className="text-sm text-muted-foreground">
                <p className="mb-2">可用变量：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><code>{'{title}'}</code> - 网站标题</li>
                  <li><code>{'{description}'}</code> - 网站描述</li>
                  <li><code>{'{content}'}</code> - 网站内容（包含所有爬取的页面）</li>
                </ul>
              </div>
            </div>

            {/* 保存提示词 */}
            <div className="border-t pt-4">
              <div className="flex gap-2">
                <Input
                  placeholder="输入提示词名称"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  onClick={handleSavePrompt}
                  disabled={!promptName.trim()}
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  保存提示词
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 已保存的提示词 */}
        {savedPrompts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>已保存的提示词</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedPrompts.map((prompt) => (
                  <div key={prompt.name} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{prompt.name}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePrompt(prompt.name)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p className="line-clamp-3 font-mono text-xs bg-muted p-2 rounded">
                        {prompt.template}
                      </p>
                      <p className="text-xs mt-2">
                        {new Date(prompt.createdAt).toLocaleDateString('zh-CN')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadPrompt(prompt)}
                      className="w-full"
                    >
                      <BookmarkCheck className="h-3 w-3 mr-1" />
                      加载提示词
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 使用说明 */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                📖
              </div>
              使用说明与支持的AI模型
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI模型支持 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-blue-200 pb-2">
                🤖 支持的AI模型
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                      🟢
                    </div>
                    <h4 className="font-semibold text-green-700">OpenAI API</h4>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>需要有效的OpenAI API密钥</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>支持GPT-3.5、GPT-4、GPT-4o等模型</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span className="font-mono text-xs bg-gray-100 px-1 rounded">api.openai.com/v1/chat/completions</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      🔵
                    </div>
                    <h4 className="font-semibold text-blue-700">DeepSeek API</h4>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>国产AI模型，性价比高</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>支持deepseek-chat、deepseek-coder</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span className="font-mono text-xs bg-gray-100 px-1 rounded">api.deepseek.com/v1/chat/completions</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                      🟣
                    </div>
                    <h4 className="font-semibold text-purple-700">OpenRouter API</h4>
                  </div>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>统一多种AI模型接口</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span>支持GPT、Claude、Llama等</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-500 mt-1">•</span>
                      <span className="font-mono text-xs bg-gray-100 px-1 rounded">openrouter.ai/api/v1/chat/completions</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 功能特性 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b border-blue-200 pb-2">
                ⚙️ 主要功能特性
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-blue-500">💾</span>
                    配置管理
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span><strong>保存配置</strong>：将API配置保存到本地，方便快速切换</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span><strong>保存提示词</strong>：保存常用的分析提示词模板</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">▸</span>
                      <span><strong>快速加载</strong>：一键加载已保存的配置和提示词</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm">
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <span className="text-green-500">🔒</span>
                    安全与隐私
                  </h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">▸</span>
                      <span><strong>本地存储</strong>：所有数据保存在浏览器本地</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">▸</span>
                      <span><strong>密钥安全</strong>：API密钥不会上传到服务器</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-1">▸</span>
                      <span><strong>代理支持</strong>：支持SOCKS5代理保护隐私</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 快速开始 */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 text-white">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                🚀 快速开始
              </h3>
              <ol className="text-sm space-y-2">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-xs font-bold">1</span>
                  <span>选择AI模型配置模板，或手动填写API信息</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-xs font-bold">2</span>
                  <span>输入您的API密钥并保存配置</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-xs font-bold">3</span>
                  <span>根据需要配置代理、并发和反检测设置</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-xs font-bold">4</span>
                  <span>返回主页开始分析网站内容</span>
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 