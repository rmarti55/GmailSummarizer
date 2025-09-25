# Architecture Documentation

## System Overview

Gmail Summarizer is a sophisticated AI-powered email management system that combines advanced machine learning classification with context-aware summarization to provide intelligent email processing.

## Core Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   Supabase DB    │    │   Gmail API     │
│  (Frontend/API)  │◄──►│  (PostgreSQL)    │    │   (Google)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Groq AI API   │    │   Row Level      │    │   OAuth 2.0     │
│ (GPT-OSS-120B)  │    │   Security       │    │  Authentication │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Email Processing Pipeline

### 1. Authentication & Authorization
- **Google OAuth 2.0**: Secure user authentication with Gmail API access
- **Supabase Auth**: Session management with encrypted provider tokens
- **Row Level Security**: Database-level user isolation

### 2. Email Fetching & Parsing
```
Gmail API → Raw Email Data → Content Parser → Clean Text → Database
```

**Advanced Content Processing:**
- **Cheerio HTML Parser**: Handles malformed HTML, Microsoft Office markup
- **Reply Chain Removal**: Strips previous conversations and signatures  
- **Text Normalization**: Cleans whitespace, removes URLs, preserves structure
- **Fallback Extraction**: Graceful degradation for parsing failures

### 3. AI Classification System

#### Classification Engine (`src/lib/email-classifier.ts`)

**5-Tier Classification System:**

1. **Critical Action** (`critical_action`)
   - **Triggers**: Security alerts, account issues, urgent deadlines
   - **Confidence**: 0.9 (High reliability)
   - **Priority**: High urgency, 30s estimated read time
   - **Action Required**: Yes

2. **Quick Action** (`quick_action`)
   - **Triggers**: Meeting requests, approvals, confirmations
   - **Confidence**: 0.8
   - **Priority**: Medium urgency, 15s estimated read time
   - **Action Required**: Yes

3. **FYI Updates** (`fyi_update`)
   - **Triggers**: Notifications, status updates, newsletters
   - **Confidence**: 0.8
   - **Priority**: Low urgency, 20s estimated read time
   - **Action Required**: No

4. **Commercial** (`commercial`)
   - **Triggers**: Marketing emails, promotions, sales content
   - **Confidence**: 0.7
   - **Priority**: Low urgency, 10s estimated read time
   - **Action Required**: No

5. **Complex Content** (`complex_content`)
   - **Triggers**: Long-form emails, detailed reports, comprehensive communications
   - **Confidence**: 0.6
   - **Priority**: Medium urgency, 60s estimated read time
   - **Action Required**: No

#### Classification Algorithm
```typescript
classify(email: EmailData): EmailClassification {
  // 1. Keyword Pattern Matching
  // 2. Sender Domain Analysis
  // 3. Content Length Assessment
  // 4. Security Context Detection
  // 5. Commercial Indicator Analysis
}
```

### 4. Adaptive Summarization Engine

#### Template System (`src/lib/summary-templates.ts`)

Each email type receives specialized AI treatment:

**Critical Action Template:**
- **Focus**: Immediate action items, deadlines, security implications
- **Tone**: Urgent, direct, actionable
- **Length**: Concise (max 150 tokens)
- **Temperature**: 0.3 (Low variability)

**Quick Action Template:**
- **Focus**: Required response, meeting details, approval items
- **Tone**: Professional, clear instructions
- **Length**: Brief (max 100 tokens)
- **Temperature**: 0.4

**FYI Update Template:**
- **Focus**: Key information, status changes, relevant updates
- **Tone**: Informational, summary-focused
- **Length**: Medium (max 200 tokens)
- **Temperature**: 0.5

**Commercial Template:**
- **Focus**: Offers, discounts, product highlights
- **Tone**: Neutral, value-focused
- **Length**: Minimal (max 75 tokens)
- **Temperature**: 0.4

**Complex Content Template:**
- **Focus**: Main themes, key decisions, action items
- **Tone**: Analytical, comprehensive
- **Length**: Extended (max 300 tokens)
- **Temperature**: 0.6 (Higher creativity)

#### AI Generation Process
```
Classification → Template Selection → Groq API Call → Post-processing → Formatted Summary
```

## Database Schema Design

### Core Table: `emails`

```sql
CREATE TABLE emails (
  -- Primary identifiers
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_id text NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  
  -- Email metadata
  sender text NOT NULL,
  subject text NOT NULL,
  body_preview text,
  created_at timestamptz DEFAULT now(),
  read boolean DEFAULT false,
  
  -- AI classification results
  email_type text,                    -- Classification category
  urgency_level text,                 -- high/medium/low
  action_required boolean DEFAULT false,
  classification_confidence decimal(3,2),  -- 0.00-1.00
  estimated_read_time integer,        -- Seconds
  
  -- AI-generated content
  summary text,
  
  -- Constraints
  CONSTRAINT emails_gmail_id_user_unique UNIQUE(gmail_id, user_id)
);
```

### Performance Optimizations
```sql
-- User-scoped queries with timestamp ordering
CREATE INDEX emails_user_id_created_at_idx ON emails(user_id, created_at DESC);

-- Gmail ID lookups for deduplication  
CREATE INDEX emails_gmail_id_idx ON emails(gmail_id);

-- Classification-based filtering
CREATE INDEX emails_type_urgency_idx ON emails(email_type, urgency_level);
```

### Security Policies
```sql
-- Row Level Security ensures complete user isolation
CREATE POLICY "Users can only access their own emails" ON emails
  FOR ALL USING (auth.uid() = user_id);
```

## User Interface Architecture

### Component Hierarchy
```
Dashboard (page.tsx)
├── Header (navigation, user controls)
├── Email List Container
│   ├── Loading Skeletons
│   ├── Empty State
│   └── Email Cards
│       ├── Email Metadata
│       ├── Body Preview
│       └── AdaptiveSummary Component
└── Action Controls (refresh, clear)
```

### Adaptive UI System (`src/components/AdaptiveSummary.tsx`)

**Visual Classification System:**
- **Critical Action**: Red theme, AlertTriangle icon, "Urgent Action Required"
- **Quick Action**: Amber theme, Clock icon, "Quick Action Needed"  
- **FYI Update**: Green theme, Info icon, "Update"
- **Commercial**: Purple theme, ShoppingBag icon, "Promotion"
- **Complex Content**: Indigo theme, Sparkles icon, "Key Points"

**Dynamic Features:**
- Priority badges for high-urgency emails
- Estimated read time display
- Confidence scoring (development mode)
- Responsive formatting for mobile/desktop

## API Design Patterns

### RESTful Endpoints
- `GET /api/gmail` - Resource fetching with processing
- `POST /api/summarize` - AI service integration
- `POST /api/clear-*` - Data management operations
- `POST /api/auth/signout` - Session management

### Error Handling Strategy
```typescript
// Consistent error response format
{
  error: string,
  details?: object | string,
  debug?: object  // Development only
}
```

### Authentication Middleware
All API routes implement consistent auth checking:
```typescript
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

## Security Architecture

### Multi-Layer Security Model

1. **Application Layer**
   - Next.js API route protection
   - Session validation on every request
   - CORS configuration for same-origin only

2. **Database Layer**
   - Row Level Security (RLS) policies
   - User-scoped data access
   - Encrypted sensitive data storage

3. **Authentication Layer**
   - Google OAuth 2.0 with PKCE
   - Secure token storage in Supabase
   - Automatic token refresh handling

4. **Network Layer**
   - HTTPS everywhere
   - Secure cookie configuration
   - Environment variable protection

## Scalability Considerations

### Performance Optimizations
- **Database Indexing**: Optimized for user-scoped queries
- **API Rate Limiting**: Respects Gmail and Groq API limits
- **Caching Strategy**: Email deduplication prevents reprocessing
- **Batch Processing**: Parallel email fetching with Promise.all

### Monitoring & Observability
- Comprehensive console logging with emojis for easy debugging
- Error tracking with detailed context
- Performance metrics for AI processing times
- User action tracking for UX optimization

## Development Workflow

### Local Development Setup
1. **Environment Configuration**: `.env.local` with all required keys
2. **Database Migration**: Automatic schema application
3. **API Testing**: Integrated development server with hot reload
4. **Debugging**: Rich console output with request/response logging

### Production Deployment
1. **Vercel Optimization**: Edge functions for API routes
2. **Environment Variables**: Secure key management
3. **Database Connection**: Automatic Supabase integration
4. **Monitoring**: Production error tracking and performance metrics

This architecture enables a sophisticated, scalable, and secure email management system with advanced AI capabilities while maintaining excellent user experience and developer productivity.
