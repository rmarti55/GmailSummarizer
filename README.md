# Gmail Summarizer

An AI-powered Gmail client that automatically generates intelligent summaries of your emails using advanced language models.

## Features

- 🔐 **Secure Gmail Integration** - OAuth authentication via Google
- 🤖 **AI-Powered Summaries** - Groq API for intelligent email analysis
- 📊 **Modern Dashboard** - Clean, responsive UI built with Next.js and Tailwind CSS
- 🔒 **Privacy First** - Row-level security with Supabase
- ⚡ **Real-time Updates** - Live email fetching and summarization
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **AI**: Groq API for email summarization
- **APIs**: Gmail API for email fetching
- **Authentication**: Google OAuth via Supabase Auth

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
   - Run the database schema from `lib/supabase/database.sql`

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

1. **Authentication**: Users sign in with their Google account
2. **Email Fetching**: App securely fetches recent emails from Gmail
3. **AI Analysis**: Groq processes email content to generate summaries
4. **Storage**: Emails and summaries are stored in Supabase with RLS
5. **Dashboard**: Users view emails with AI-generated summaries

## API Endpoints

- `GET /api/gmail` - Fetch emails from Gmail API
- `POST /api/summarize` - Generate AI summary for specific email
- `POST /api/auth/signout` - Sign out user
- `GET /api/auth/callback` - Handle OAuth callback

## Database Schema

The app uses a single `emails` table with:
- Email metadata (sender, subject, date)
- Full email content for AI processing
- Generated summaries
- User association with RLS policies

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

- **Row Level Security (RLS)** - Users can only access their own emails
- **OAuth Authentication** - Secure Google sign-in
- **Environment Variables** - Sensitive keys stored securely
- **API Route Protection** - All endpoints require authentication

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

---

For detailed setup instructions, see `SUPABASE_SETUP.md`.