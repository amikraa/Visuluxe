# Visuluxe AI Image Generation Platform

A comprehensive, enterprise-ready AI image generation platform built with modern technologies and advanced features.

## 🚀 Features

### Core Functionality
- **Multi-Provider Support**: Flux, OpenAI DALL-E 3, Stability AI
- **Priority-Based Job Processing**: Enterprise > Pro > Free account tiers
- **Real-time Job Management**: Admin dashboard with live monitoring
- **Cloudflare R2 Storage**: Scalable, cost-effective image storage
- **API Key Management**: Secure API access with IP restrictions

### Advanced Features
- **Telegram Integration**: Real-time monitoring and notifications
- **Provider Health Monitoring**: Automatic health checks and failover
- **Security Monitoring**: Suspicious activity detection and IP blocking
- **User Storage Management**: Configurable image expiration and lifecycle
- **Model Catalog**: Comprehensive model information and API examples
- **Enhanced Logging**: Complete audit trail and debugging support

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Supabase DB   │
│   (React/Vite)  │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Cloudflare R2   │    │ Provider APIs   │    │ Analytics &     │
│ (Image Storage) │    │ (Flux, OpenAI)  │    │ Monitoring      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Telegram Bot Integration                     │
│                    (Real-time Notifications)                    │
└─────────────────────────────────────────────────────────────────┘
```

### System Flow

1. **User Request**: User submits image generation request
2. **Job Queue**: Request enters priority-based job queue
3. **Provider Selection**: System selects optimal provider
4. **Image Generation**: Provider processes the request
5. **Storage**: Generated images stored in Cloudflare R2
6. **Delivery**: Images delivered to user with signed URLs
7. **Monitoring**: All steps monitored and logged

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and build
- **Tailwind CSS** for styling
- **TanStack Query** for state management
- **Lucide React** for icons

### Backend
- **FastAPI** with Python 3.10+
- **Supabase** for database and authentication
- **Cloudflare R2** for image storage
- **Cloudflare Workers** for edge functions
- **PostgreSQL** for data persistence

### Infrastructure
- **Docker** for containerization
- **Cloudflare** for CDN and storage
- **Supabase** for backend services
- **Telegram Bot API** for notifications

## 📦 Installation

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker
- Supabase project
- Cloudflare account

### Backend Setup

1. **Clone and install dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

2. **Environment configuration:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Required Environment Variables:**
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_ENDPOINT=your_r2_endpoint
R2_PUBLIC_BASE_URL=your_r2_public_url

# Provider Configuration
FLUX_API_URL=https://api.flux.ai/v1/generate

# Telegram Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id

# Internal Security
INTERNAL_SECRET=your_internal_secret
```

4. **Run migrations:**
```bash
# Apply database migrations
supabase db push
```

5. **Start the server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. **Install dependencies:**
```bash
cd src
npm install
```

2. **Environment configuration:**
```bash
cp .env.example .env
# Edit .env with your Supabase project details
```

3. **Start development server:**
```bash
npm run dev
```

## 🔧 Configuration

### Account Types and Priorities

| Account Type | Priority | Concurrent Jobs | Storage Tier | Max Images/Request |
|--------------|----------|----------------|--------------|-------------------|
| Enterprise   | 10       | 5              | Enterprise   | 4                 |
| Pro          | 5        | 3              | Premium      | 4                 |
| Free         | 1        | 1              | Basic        | 1                 |

### Provider Configuration

Each provider can be configured with:
- **Cost per generation**: Credits charged per image
- **Max concurrent jobs**: Provider capacity limits
- **Health check interval**: How often to check provider status
- **Auto-disable threshold**: Failures before disabling provider

### Storage Management

Users can configure:
- **Auto-delete after**: Days until images expire (7-2555 days)
- **Storage tier**: Basic/Premium/Enterprise
- **Long-term storage**: Enable extended storage options

## 📊 Monitoring and Analytics

### Telegram Integration

The system provides real-time notifications via Telegram:

**Image Generation Events:**
- ✅ **SUCCESS**: Successful image generation
- ❌ **FAILED**: Generation failures with error details

**Security Events:**
- 🆕 **New Account**: User registration
- 🔐 **Password Change**: Security updates
- 💰 **Credit Added**: Account top-ups
- 🚨 **Mass Requests**: Suspicious activity
- 🚫 **Unauthorized Access**: Security violations

**System Alerts:**
- ✅ **Provider Healthy**: Provider status updates
- ⚠️ **Provider Unhealthy**: Health check failures
- 🔧 **Maintenance**: System maintenance notifications

### Provider Health Monitoring

Automatic health checks include:
- **API Availability**: HTTP status checks
- **Response Time**: Latency monitoring
- **Response Validation**: Data format verification
- **Auto-Disable**: Automatic provider disabling on failures

### Security Monitoring

The system detects and responds to:
- **Rate Limiting**: RPM/RPD violations
- **Mass Generation**: Suspicious bulk requests
- **Unauthorized Access**: Failed authentication attempts
- **Bot Attacks**: Automated attack patterns

## 🔐 Security Features

### API Key IP Restrictions

Each API key can be configured with:
- **Allowed IPs**: List of permitted IP addresses
- **Any IP Access**: `0.0.0.0` allows access from any IP
- **Automatic Blocking**: Failed attempts trigger IP blocking

### Rate Limiting

- **Per User**: Requests per minute/day limits
- **Per IP**: Additional IP-based rate limiting
- **Dynamic Limits**: Account type-based limits

### Audit Logging

All security events are logged with:
- **User Information**: Who performed the action
- **IP Address**: Source of the request
- **Timestamp**: When the event occurred
- **Details**: Full context of the event

## 🎨 Model Catalog

The platform includes a comprehensive model catalog with:

### Model Information
- **Capabilities**: Text-to-image, image-to-image, inpainting
- **Supported Sizes**: Available resolution options
- **Max Images**: Maximum images per request
- **Provider Support**: Which providers offer the model

### API Documentation
- **Endpoint Examples**: Ready-to-use API calls
- **Parameter Details**: Complete parameter documentation
- **Pricing Information**: Cost per provider
- **Usage Examples**: Common use cases

## 🔄 Job Management

### Priority Queue System

Jobs are processed based on:
1. **Account Priority**: Enterprise > Pro > Free
2. **Queue Time**: FIFO within priority levels
3. **Provider Availability**: Real-time provider status

### Job Lifecycle

1. **Created**: Job enters the queue
2. **Processing**: Provider is working on the job
3. **Completed**: Images generated successfully
4. **Failed**: Generation failed (retryable)
5. **Cancelled**: User/admin cancelled the job

### Admin Features

- **Real-time Monitoring**: Live job status updates
- **Job Control**: Cancel, retry, and prioritize jobs
- **Statistics**: Queue length, completion rates, failure rates
- **Detailed Logs**: Complete job execution history

## 📁 Project Structure

```
Visuluxe/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration management
│   │   ├── security.py          # Authentication and security
│   │   ├── services/
│   │   │   ├── database.py      # Database operations
│   │   │   ├── processor.py     # Image processing
│   │   │   ├── storage.py       # R2 storage management
│   │   │   ├── telegram_logger.py    # Telegram integration
│   │   │   ├── provider_health.py    # Provider monitoring
│   │   │   ├── storage_management.py # Storage lifecycle
│   │   │   └── security_monitoring.py # Security features
│   │   ├── routers/
│   │   │   ├── admin.py         # Admin endpoints
│   │   │   ├── auth.py          # Authentication
│   │   │   ├── images.py        # Image endpoints
│   │   │   └── models.py        # Model catalog
│   │   └── models/
│   │       ├── schemas.py       # Pydantic models
│   │       └── openai_schemas.py # OpenAI compatibility
│   ├── requirements.txt         # Python dependencies
│   └── Dockerfile              # Container configuration
├── src/
│   ├── pages/
│   │   ├── ModelCatalog.tsx     # Model catalog UI
│   │   ├── admin/
│   │   │   └── JobsManagement.tsx # Admin job management
│   │   └── ...                  # Other pages
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   └── ...                  # Feature components
│   ├── services/                # Frontend services
│   ├── lib/                     # Utility functions
│   └── integrations/            # External integrations
├── supabase/
│   ├── migrations/              # Database migrations
│   │   ├── 20260311_enhanced_job_management.sql
│   │   └── 20260311_jobs_management_functions.sql
│   └── functions/               # Edge functions
├── docs/
│   ├── architecture.md          # System architecture
│   ├── CODEBASE_DEEP_DIVE.md    # Codebase documentation
│   ├── ENCRYPTION_SETUP.md      # Security setup
│   ├── MIGRATION_GUIDELINES.md  # Migration instructions
│   ├── PROFILE_RELIABILITY.md   # Performance optimization
│   └── TECHNICAL_AUDIT.md       # Technical review
└── public/                      # Static assets
```

## 🚀 Deployment

### Docker Deployment

1. **Build images:**
```bash
docker-compose build
```

2. **Run services:**
```bash
docker-compose up -d
```

### Cloudflare Deployment

1. **Deploy backend to Cloudflare Workers**
2. **Configure R2 bucket for image storage**
3. **Set up Pages for frontend hosting**
4. **Configure environment variables**

### Supabase Setup

1. **Create new project**
2. **Run database migrations**
3. **Configure authentication**
4. **Set up storage buckets**

## 📈 Performance Optimization

### Caching Strategy
- **Redis**: Job status caching
- **CDN**: Image delivery optimization
- **Database**: Query result caching

### Scaling Considerations
- **Horizontal Scaling**: Multiple backend instances
- **Database Optimization**: Indexing and query optimization
- **Storage Scaling**: R2 automatic scaling
- **Load Balancing**: Traffic distribution

## 🔧 Development

### Code Style
- **Python**: Black formatter, Pylint for linting
- **TypeScript**: ESLint with TypeScript rules
- **Git**: Conventional commits

### Testing
- **Backend**: Pytest for API testing
- **Frontend**: Vitest for component testing
- **Integration**: End-to-end testing with Playwright

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## 📞 Support

### Documentation
- [Architecture Guide](docs/architecture.md)
- [API Documentation](docs/CODEBASE_DEEP_DIVE.md)
- [Security Setup](docs/ENCRYPTION_SETUP.md)

### Community
- GitHub Issues for bug reports
- Discussions for feature requests
- Wiki for user guides

### Enterprise Support
- Priority support for enterprise accounts
- Custom deployment assistance
- SLA-backed uptime guarantees

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📊 Metrics

- **Response Time**: < 2 seconds for API calls
- **Uptime**: 99.9% availability target
- **Concurrent Users**: Support for 1000+ concurrent users
- **Image Generation**: Sub-minute generation times

## 🔮 Future Roadmap

- [ ] Multi-language support
- [ ] Advanced image editing tools
- [ ] Team collaboration features
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] Plugin ecosystem

---

**Visuluxe** - Enterprise AI Image Generation Platform