# API Documentation

## Overview

The Gmail Summarizer API provides endpoints for Gmail integration, AI-powered email classification, adaptive summarization, and user management. All endpoints require authentication except for the OAuth callback.

## Authentication

All API routes (except `/api/auth/callback`) require a valid Supabase session with Google OAuth provider token.

**Headers Required:**
```
Authorization: Bearer <supabase-session-token>
```

## Endpoints

### 1. Gmail Integration

#### `GET /api/gmail`
Fetches and processes emails from the user's Gmail inbox with advanced content parsing.

#### `GET /api/gmail/count`
Gets email count and pagination data for the authenticated user.

**Query Parameters:**
- `limit` (optional) - Number of emails to return (if > 0, returns paginated emails)
- `offset` (optional) - Offset for pagination

**Response (count mode):**
```json
{
  "totalEmails": 42,
  "lastSyncTime": "2024-01-15T10:30:00Z"
}
```

**Response (pagination mode):**
```json
{
  "emails": [...]
}
```

#### `GET /api/gmail/sync-status`
Gets the current synchronization status.

#### `POST /api/gmail/sync-status`
Updates the synchronization status.

#### `POST /api/gmail/full-sync`
Initiates a full synchronization of all Gmail messages.

**Features:**
- Fetches up to 20 recent inbox emails
- Advanced HTML parsing with Cheerio for clean text extraction
- Removes reply chains, signatures, and malformed content
- Stores emails in database with deduplication

**Response:**
```json
{
  "emails": [
    {
      "id": "uuid",
      "gmail_id": "string",
      "sender": "string",
      "subject": "string", 
      "body_preview": "string",
      "created_at": "timestamp",
      "user_id": "uuid",
      "read": false,
      "summary": null,
      "email_type": null,
      "urgency_level": null,
      "action_required": null,
      "classification_confidence": null,
      "estimated_read_time": null
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized (no session)
- `400` - No Google access token found
- `500` - Gmail API error

---

### 2. AI Summarization

#### `POST /api/summarize`
Generates adaptive AI summary with email classification using Groq API.

**Request Body:**
```json
{
  "emailId": "uuid"
}
```

**AI Processing Pipeline:**
1. **Classification**: Categorizes email into 5 types with confidence scoring
2. **Template Selection**: Chooses specialized AI prompt based on classification  
3. **AI Generation**: Uses Groq API with OpenAI GPT-OSS-120B model
4. **Post-processing**: Formats summary for optimal readability

**Email Classification Types:**
- `critical_action` - Security alerts, urgent requests (High priority, 30s read time)
- `quick_action` - Meeting requests, approvals (Medium priority, 15s read time)  
- `fyi_update` - Notifications, status updates (Low priority, 20s read time)
- `commercial` - Marketing, promotions (Low priority, 10s read time)
- `complex_content` - Long-form content (Medium priority, 60s read time)

**Response:**
```json
{
  "summary": "string",
  "classification": {
    "type": "critical_action",
    "confidence": 0.9,
    "urgencyLevel": "high",
    "actionRequired": true,
    "estimatedReadTime": 30
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `400` - Missing emailId
- `404` - Email not found
- `500` - AI service error

---

### 3. Data Management

#### `POST /api/clear-summaries`
Clears all AI-generated summaries for the authenticated user while preserving emails.

**Use Case:** Regenerate summaries with updated AI models or templates

**Response:**
```json
{
  "message": "All summaries cleared successfully"
}
```

#### `POST /api/clear-emails`
Removes all cached emails for the authenticated user.

**Use Case:** Fresh email processing with improved parsing algorithms

**Response:**
```json
{
  "success": true,
  "message": "All emails cleared successfully"
}
```

---

### 4. Sender Management

#### `GET /api/senders`
Gets sender statistics with email counts and percentages.

**Response:**
```json
{
  "senders": [
    {
      "sender": "example@domain.com",
      "count": 15,
      "percentage": 35.7
    }
  ]
}
```

#### `GET /api/senders/[sender]/emails`
Gets paginated emails from a specific sender.

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)

**Response:**
```json
{
  "emails": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 5. Authentication

#### `GET /api/auth/callback`
Handles Google OAuth callback after user authentication.

**Query Parameters:**
- `code` - Authorization code from Google
- `state` - CSRF protection state parameter

**Process:**
1. Exchanges authorization code for access/refresh tokens
2. Creates/updates user session in Supabase
3. Redirects to dashboard

#### `POST /api/auth/signout`
Signs out the authenticated user and clears session.

**Response:**
```json
{
  "message": "Signed out successfully"
}
```

---

## Error Handling

All endpoints return consistent error formats:

```json
{
  "error": "string",
  "details": "object|string" // Optional additional context
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing parameters, invalid data)
- `401` - Unauthorized (no session or invalid token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (database, AI service, or Gmail API errors)

## Rate Limiting

- **Gmail API**: Subject to Google's rate limits (250 quota units per user per 100 seconds)
- **Groq API**: Subject to Groq's rate limits (varies by plan)
- **Database**: No explicit limits (Supabase handles scaling)

## Security

- **Row Level Security (RLS)**: All database operations are scoped to the authenticated user
- **Token Validation**: Every request validates Supabase session
- **Provider Tokens**: Google tokens are encrypted and stored securely
- **CORS**: Configured for same-origin requests only

## Usage Examples

### Fetch and Summarize Workflow
```javascript
// 1. Fetch emails
const emailsResponse = await fetch('/api/gmail');
const { emails } = await emailsResponse.json();

// 2. Summarize first email
const summarizeResponse = await fetch('/api/summarize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ emailId: emails[0].id })
});
const { summary } = await summarizeResponse.json();
```

### Clear and Refresh Data
```javascript
// Clear all summaries for regeneration
await fetch('/api/clear-summaries', { method: 'POST' });

// Clear all emails for fresh processing  
await fetch('/api/clear-emails', { method: 'POST' });

// Fetch fresh emails
await fetch('/api/gmail');
```
