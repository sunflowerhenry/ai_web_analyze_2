# 存储配置说明

## 📚 存储功能概述

本项目已升级支持智能存储功能：

### 🏠 本地开发环境
- **存储位置**: `./data/` 目录下的JSON文件
- **文件路径**: `./data/analysis_data.json`, `./data/config.json` 等
- **备份机制**: 自动本地备份，页面关闭前最终备份

### ☁️ 生产环境（云端部署）
- **自动选择**: 根据环境变量自动选择最佳云端存储
- **支持的云端存储**:
  1. **Vercel KV Redis** (推荐 - 零配置)
  2. **Supabase** (免费额度大)
  3. **PlanetScale** (MySQL兼容)
  4. **Firebase** (Google生态)

## 🔧 环境变量配置

### 1. Vercel KV Redis (推荐)

```bash
# Vercel KV Redis 配置
KV_REST_API_URL=https://your-project-kv.vercel.app
KV_REST_API_TOKEN=your_kv_token_here
```

**获取方式**:
1. 在 Vercel 项目中添加 KV 存储
2. 在项目设置中找到环境变量
3. 复制 KV_REST_API_URL 和 KV_REST_API_TOKEN

### 2. Supabase 配置

```bash
# Supabase 配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

**设置步骤**:
1. 在 Supabase 创建项目
2. 创建 storage_data 表：
```sql
CREATE TABLE storage_data (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. PlanetScale 配置

```bash
# PlanetScale 配置
DATABASE_URL=mysql://username:password@host/database?ssl={"rejectUnauthorized":true}
```

### 4. Firebase 配置

```bash
# Firebase 配置
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## 🛡️ API密钥安全性

### 重要提醒
- **绝对不要**将API密钥提交到代码仓库
- **务必使用**环境变量存储敏感信息
- **建议启用**密钥轮换机制

### 本地开发
1. 创建 `.env.local` 文件（此文件已在 .gitignore 中）
2. 添加必要的环境变量
3. 重启开发服务器

### 生产部署
1. 在部署平台（Vercel/Netlify等）设置环境变量
2. 不要在构建日志中暴露密钥
3. 定期检查和更新密钥

## 📍 存储位置说明

### 本地开发存储位置
```
项目根目录/
├── data/
│   ├── analysis_data.json    # 分析数据
│   ├── config.json           # 配置信息
│   └── background_tasks.json # 后台任务
├── .env.local               # 环境变量（不提交）
└── ...
```

### 云端存储位置
- **Vercel KV**: Redis键值存储，全球CDN加速
- **Supabase**: PostgreSQL数据库表
- **PlanetScale**: MySQL数据库表
- **Firebase**: Firestore文档存储

## ⚡ 自动同步机制

### 触发条件
- 数据更新后1秒自动同步
- 每5分钟定时同步
- 页面关闭前最终同步
- 手动触发同步

### 同步状态
- `isSyncingToCloud`: 是否正在同步
- `lastCloudSyncTime`: 最后同步时间
- `cloudSyncError`: 同步错误信息

## 🔍 功能测试

### 本地测试
```bash
# 启动开发服务器
npm run dev

# 检查数据目录
ls -la ./data/

# 查看同步状态
console.log(useAnalysisStore.getState().isSyncingToCloud)
```

### 云端测试
```bash
# 构建生产版本
npm run build

# 检查环境变量
echo $KV_REST_API_URL

# 测试API
curl -X POST /api/storage -d '{"action":"save","key":"test","data":{"test":true}}'
```

## 🛠️ 故障排除

### 常见问题

1. **本地文件无法保存**
   - 检查文件系统权限
   - 确保 `data` 目录可写

2. **云端同步失败**
   - 验证环境变量配置
   - 检查网络连接
   - 查看控制台错误日志

3. **数据丢失**
   - 检查本地备份文件
   - 查看浏览器localStorage
   - 验证云端存储状态

### 调试步骤
1. 打开浏览器开发者工具
2. 查看Network选项卡的API请求
3. 检查Console中的同步日志
4. 验证本地存储和云端存储

## 📊 存储限制

### 本地存储
- localStorage: ~5-10MB (浏览器限制)
- 文件系统: 无限制（磁盘空间）

### 云端存储
- **Vercel KV**: 512MB免费，1GB付费
- **Supabase**: 500MB免费，扩展付费
- **PlanetScale**: 5GB免费分支
- **Firebase**: 1GB免费，按使用付费

## 🚀 推荐配置

### 个人项目
```bash
# 简单配置 - 使用Vercel KV
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token
```

### 企业项目
```bash
# 生产级配置 - 使用Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
# 备用配置
KV_REST_API_URL=backup_kv_url
KV_REST_API_TOKEN=backup_kv_token
```

## 💡 最佳实践

1. **多重备份**: 同时配置本地和云端存储
2. **定期备份**: 启用自动同步机制
3. **安全优先**: 妥善保管API密钥
4. **监控同步**: 定期检查同步状态
5. **性能优化**: 合理控制数据量大小

---

**注意**: 首次部署后建议测试完整的存储功能，确保数据能够正常保存和恢复。 