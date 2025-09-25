# Gmail Summarizer

An advanced AI-powered Gmail client that automatically classifies and generates context-aware intelligent summaries of your emails using sophisticated machine learning and natural language processing.

## Features

- 🧠 **Adaptive AI Summarization** - Context-aware summaries tailored to email type and urgency
- 🎯 **Intelligent Email Classification** - Automatic categorization into 5 distinct types with confidence scoring
- 🚨 **Priority Detection** - Smart urgency assessment with visual indicators and estimated read times
- 🔐 **Secure Gmail Integration** - OAuth authentication with full Gmail API access
- 📊 **Advanced Dashboard** - Modern UI with color-coded email categories and adaptive layouts
- 🛡️ **Privacy First** - Row-level security with encrypted storage and user isolation
- ⚡ **Real-time Processing** - Live email fetching with sophisticated content parsing
- 📱 **Responsive Design** - Optimized for desktop and mobile experiences

## Advanced AI System

### Email Classification Engine
The system automatically classifies emails into 5 categories:

- **🚨 Critical Action** - Security alerts, urgent requests, time-sensitive actions
- **⚡ Quick Action** - Meeting requests, simple approvals, brief responses needed
- **📢 FYI Updates** - Notifications, status updates, informational content
- **🛍️ Commercial** - Marketing emails, promotions, newsletters
- **📖 Complex Content** - Long-form emails, detailed reports, comprehensive communications

### Adaptive Summarization
Each email type receives specialized AI treatment:
- **Dynamic Templates** - Context-specific prompts optimized for email category
- **Confidence Scoring** - ML-based classification reliability metrics
- **Read Time Estimation** - Intelligent time predictions based on content analysis
- **Visual Categorization** - Color-coded UI with category-specific icons and styling

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components, Lucide React icons
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI Engine**: Groq API with OpenAI GPT-OSS-120B model
- **Email Processing**: Gmail API, Cheerio HTML parser, Advanced content extraction
- **Classification**: Custom ML-based email categorization system
- **Authentication**: Google OAuth via Supabase Auth with provider tokens

## Prerequisites

Before setting up the project, you'll need:

1. **Google Cloud Console** account with Gmail API enabled
2. **Supabase** project
3. **Groq** API key for AI summarization
4. **Node.js** 18+ and npm

## Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI Service
GROQ_API_KEY=your-groq-api-key

# App Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Quick Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd gmail-summarizer
   npm install
   ```

2. **Set up Supabase:**
   - Follow the detailed instructions in `SUPABASE_SETUP.md`
   - Database schema will be applied automatically via migrations

3. **Configure Google OAuth:**
   - Enable Gmail API in Google Cloud Console
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

4. **Get Groq API key:**
   - Sign up at [console.groq.com](https://console.groq.com)
   - Create an API key

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## How It Works

1. **Authentication**: Users sign in with Google OAuth, tokens stored securely
2. **Email Fetching**: Advanced Gmail API integration fetches inbox emails (up to 20 recent)
3. **Content Processing**: Sophisticated HTML parsing with Cheerio extracts clean text content
4. **AI Classification**: Machine learning system categorizes emails with confidence scoring
5. **Adaptive Summarization**: Context-aware AI generates tailored summaries using specialized templates
6. **Visual Presentation**: Color-coded dashboard displays emails with category-specific styling
7. **Data Storage**: Encrypted storage in Supabase with row-level security

## API Endpoints

### Core Email Processing
- `GET /api/gmail` - Fetch and process emails from Gmail API with advanced parsing
- `GET /api/gmail/count` - Get email count and pagination data
- `GET /api/gmail/sync-status` - Get current synchronization status
- `POST /api/gmail/full-sync` - Initiate full Gmail synchronization

### AI Summarization
- `POST /api/summarize` - Generate adaptive AI summary with email classification

### Sender Management
- `GET /api/senders` - Get sender statistics with counts and percentages
- `GET /api/senders/[sender]/emails` - Get paginated emails from specific sender

### Data Management
- `POST /api/clear-summaries` - Clear all summaries for regeneration
- `POST /api/clear-emails` - Clear all cached emails for fresh processing

### Authentication
- `GET /api/auth/callback` - Handle Google OAuth callback
- `POST /api/auth/signout` - Secure user sign out

## Database Schema

Advanced `emails` table with classification system:

**Core Fields:**
- `id`, `gmail_id`, `sender`, `subject`, `body_preview`
- `summary`, `created_at`, `user_id`, `read`

**AI Classification Fields:**
- `email_type` - One of 5 classification categories
- `urgency_level` - High/medium/low priority assessment  
- `action_required` - Boolean flag for actionable emails
- `classification_confidence` - ML confidence score (0-1)
- `estimated_read_time` - Intelligent time prediction in seconds

**Security & Performance:**
- Row Level Security (RLS) policies for user isolation
- Optimized indexes for fast queries by user and classification
- Unique constraints preventing duplicate Gmail messages

## Development

```bash
# Development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Security Features

- **Row Level Security (RLS)** - Database-level isolation ensuring users only access their own data
- **Google OAuth 2.0** - Industry-standard authentication with secure token management
- **Provider Token Storage** - Encrypted Google API tokens in Supabase sessions
- **Environment Variables** - All sensitive keys and credentials externalized
- **API Route Protection** - Comprehensive authentication middleware on all endpoints
- **Data Encryption** - End-to-end encryption for email content and summaries
- **User Isolation** - Complete data separation between users at the database level

## Deployment

The app is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Update OAuth redirect URIs to include production URL
4. Deploy!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.

## Documentation

- **[Setup Guide](SUPABASE_SETUP.md)** - Complete Supabase configuration and database setup
- **[API Documentation](API_DOCUMENTATION.md)** - Detailed API endpoints and usage examples
- **[Architecture Guide](ARCHITECTURE.md)** - System design, AI classification, and technical deep-dive

---

*This project represents a sophisticated AI-powered email management system with advanced classification and adaptive summarization capabilities.*