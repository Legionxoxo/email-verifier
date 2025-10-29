# System Architecture Documentation

## Overview

Email Verifier is a full-stack web application that provides email verification services through a web interface and programmatic API access. The system uses a single-port architecture where the Node.js backend serves both API endpoints and the built React frontend.

---

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      DOCKER CONTAINER                           │
│                    (Port 5000, localhost only)                  │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              FRONTEND (React + TypeScript)                 │ │
│  │  - Built with Vite and served as static files              │ │
│  │  - Location: backend/public/                               │ │
│  │  - Tailwind CSS, Framer Motion, React Router               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ↓ HTTP Requests                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           BACKEND (Node.js + Express.js)                   │ │
│  │  - REST API Endpoints                                      │ │
│  │  - Authentication (Admin + API Key)                        │ │
│  │  - Request validation and routing                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ↓                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              VERIFICATION CONTROLLER                       │ │
│  │  - 4 Worker Threads (parallel processing)                  │ │
│  │  - Job queue management                                    │ │
│  │  - Worker health monitoring                                │ │
│  │  - Anti-greylisting retry system                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ↓                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            WORKER THREADS (4 instances)                    │ │
│  │  - Quick verification (syntax, DNS, checks)                │ │
│  │  - SMTP verification (port 25)                             │ │
│  │  - MX organization classification                          │ │
│  │  - Catch-all detection with caching                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ↓                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                DATABASE (SQLite + WAL)                     │ │
│  │  - Verification requests and results                       │ │
│  │  - API keys (bcrypt hashed)                                │ │
│  │  - CSV uploads metadata                                    │ │
│  │  - Catch-all cache (24-hour TTL)                           │ │
│  │  - Anti-greylisting queue                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               PERSISTENT VOLUMES                           │ │
│  │  - email-verifier-db   → .sql/                             │ │
│  │  - email-verifier-csv  → csv/                              │ │
│  │  - email-verifier-logs → .logs/                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ Port 25 (SMTP)
                    ┌──────────────────────┐
                    │  EXTERNAL SMTP       │
                    │  MAIL SERVERS        │
                    │  (gmail.com, etc.)   │
                    └──────────────────────┘
```

---

## Technology Stack

### Frontend Technologies
- React 19.1.0 with TypeScript
- Vite 7.0.4 (build tool and bundler)
- Tailwind CSS 4.1.11 (styling)
- React Router DOM 6.22.3 (routing)
- React Hook Form 7.51.0 + Zod validation
- Axios 1.11.0 (HTTP client)
- Framer Motion 11.0.8 (animations)
- Lucide React 0.461.0 (icons)
- React Toastify 11.0.5 (notifications)
- PapaParse 5.5.3 (CSV parsing)

### Backend Technologies
- Node.js 20 on Alpine Linux
- Express.js 5.1.0 (web framework)
- SQLite with better-sqlite3 11.3.0 (database)
- Bcrypt (password and API key hashing)
- Express Validator 7.2.0 + Zod 4.1.12 (validation)
- Helmet 8.0.0 (security headers)
- CORS 2.8.5 (cross-origin resource sharing)
- express-rate-limit 7.4.1 (rate limiting)
- Multer 2.0.2 (file upload handling)
- Winston 3.18.3 (logging)
- Worker Threads (native Node.js)

### Deployment
- Docker with single-stage build
- Docker Compose for orchestration
- Named volumes for data persistence
- Health checks via HTTP endpoint

---

## Application Pages and Routes

### Frontend Routes
- `/login` - Admin login page
- `/dashboard` - Single email verification
- `/dashboard/csv` - Bulk CSV verification
- `/verify/:verificationRequestId` - Real-time progress tracking
- `/results/:verificationRequestId` - Detailed results display
- `/history` - Verification history with time filters
- `/api-tokens` - API key management (create, list, revoke)

### Backend API Routes

**Authentication** (`/api/auth`)
- POST `/login` - Admin login
- GET `/health` - Health check

**Verifier** (`/api/verifier`)
- POST `/verify-single` - Single email verification
- POST `/v1/verify` - API programmatic verification
- GET `/verification/:id/status` - Get verification status
- GET `/verification/:id/results` - Get results (paginated)
- POST `/csv/upload` - Upload CSV with auto-detection
- POST `/csv/verify` - Submit CSV for verification
- GET `/csv/:id/download` - Download results CSV
- GET `/history` - Get verification history
- GET `/health` - Health check

**API Keys** (`/api/api-keys`)
- POST `/create` - Create new API key
- GET `/` - List all API keys
- DELETE `/:id/revoke` - Revoke API key

---

## System Flow Diagrams

### Single Email Verification Flow

```
User enters email in dashboard
          ↓
Frontend: POST /api/verifier/verify-single
          ↓
Backend: Create verification_request
         - Generate unique ID
         - Status: pending
         - Save to database
          ↓
Backend: Add to Queue table
         - Request ID
         - Email list
          ↓
Controller: Assign to free Worker Thread
          ↓
Worker Thread: Quick Verification
         - Parse email syntax
         - Check role account (admin@, info@)
         - Check free domain (gmail.com, yahoo.com)
         - Check disposable email
         - DNS MX record lookup
          ↓
Worker Thread: SMTP Verification
         - Group by MX organization
         - Apply rate limits per organization
         - Microsoft → Login API verification
         - Yahoo → Mark as catch-all
         - Others → Full SMTP test
          ↓
SMTP Process:
         - Test catch-all (random email)
         - Test actual email
         - Parse SMTP response codes
         - Detect greylisting/blacklisting
          ↓
IF greylisted:
    → Store partial results in controller0Archive
    → Add to antigreylisting table
    → Retry with progressive intervals (1m, 2m, 2m, 3m, 3m, 4m)
ELSE:
    → Calculate final status (valid/invalid/catch-all/unknown)
    → Update verification_requests with results
    → Mark status: completed
          ↓
Frontend: Poll /api/verifier/verification/:id/status
         - Check every few seconds
         - Display progress
          ↓
When completed:
    → Frontend: GET /api/verifier/verification/:id/results
    → Display verification results
```

### Bulk CSV Verification Flow

```
User uploads CSV file
          ↓
Frontend: POST /api/verifier/csv/upload
         (Multipart form with csvFile)
          ↓
Backend: Multer saves to /backend/csv/
          ↓
Backend: Parse CSV with PapaParse
         - Read all rows
         - Detect headers
         - Count rows and columns
          ↓
Backend: Auto-detect email column
         - Score each column for email patterns
         - Calculate confidence (0-100)
         - Select best match (minimum 70% confidence)
          ↓
Backend: Save to csv_uploads table
         - File metadata
         - Preview data (first 5 rows)
         - Column detection results
         - Status: ready
          ↓
Frontend: Display preview
         - Show detected column
         - Allow user to select different column
         - Optional: name the list
          ↓
User confirms and submits
          ↓
Frontend: POST /api/verifier/csv/verify
          ↓
Backend: Extract emails from selected column
         - Parse all rows
         - Get email from selected index
         - Create emails array
          ↓
Backend: Create verification_request
         - Type: csv
         - Store emails as JSON array
         - Link to csv_upload record
          ↓
[Same worker verification flow as single email]
          ↓
Frontend: Poll progress
         - Display completed/total count
         - Show percentage
         - Real-time status updates
          ↓
When completed:
    → Frontend: GET /api/verifier/csv/:id/download
    → Backend: Generate CSV with results
    → Append verification columns to original CSV
    → Return file for download
```

### API Programmatic Verification Flow

```
Client Application
          ↓
POST /api/verifier/v1/verify
     Headers: Authorization Bearer apikey
     Body: {emails: [...], responseUrl: "..."}
          ↓
Backend: Authenticate API Key
         - Extract from Bearer token
         - Check bcrypt hash in database
         - Verify not expired or revoked
         - Update last_used timestamp
          ↓
Backend: Validate Request
         - Check emails array (1-10,000)
         - Validate email formats
         - Validate responseUrl (if provided)
          ↓
Backend: Create verification_request
         - Type: api
         - Status: pending
         - Store emails as JSON
          ↓
Backend: Return 202 Accepted
         {
           verification_request_id: "api-...",
           total_emails: N,
           status: "processing"
         }
          ↓
Backend: Add to Queue
          ↓
[Same worker verification flow]
          ↓
When completed:
    IF responseUrl provided:
        → Send POST request to webhook
        → Payload: {request_id, status, results, ...}
        → Retry up to 5 times on failure
        → Exponential backoff (2s, 4s, 6s, 8s, 10s)
        → Track webhook_sent and webhook_attempts

    Client can always poll:
        → GET /api/verifier/verification/:id/results
        → Returns paginated results
        → Statistics and completion info
```

---

## Worker Thread Architecture

### Controller System

The Controller manages 4 worker threads and coordinates all verification work:

**Controller Responsibilities:**
1. Create and manage 4 worker threads
2. Assign jobs from queue to free workers
3. Monitor worker health (ping every 10 seconds)
4. Auto-restart workers every 10 minutes or on crash
5. Handle anti-greylisting retries (check every 1 second)
6. Collect and merge results from workers
7. Send webhook notifications
8. Manage result archives for crash recovery
9. Cleanup old completed requests

**Worker Thread Lifecycle:**
```
Worker Created
    ↓
Listen for messages from Controller
    ↓
Send ping to parent every 10 seconds
    ↓
Receive verification request
    ↓
Process emails (quick + SMTP verification)
    ↓
Send 'complete' message with results back to Controller
    ↓
Wait for next request
    ↓
Auto-restart after 10 minutes of activity
```

### Verification Process Inside Worker

**Step 1: Quick Verification** (Parallel, 20 concurrent)
```
For each email:
    - Parse syntax (username@domain)
    - Check if role account (admin@, info@, support@)
    - Check if free domain (gmail.com, yahoo.com, etc.)
    - Check if disposable email
    - Perform DNS MX record lookup
```

**Step 2: SMTP Verification** (Grouped by MX organization)
```
Group emails by MX organization:
    - Google Workspace
    - Microsoft 365
    - Yahoo
    - ProtonMail
    - Unknown providers

For each organization group:
    - Apply organization-specific rate limits
    - Microsoft emails → Use Login API (no SMTP)
    - Yahoo emails → Mark catch-all (Yahoo blocks SMTP)
    - Others → Full SMTP verification:

    SMTP Connection:
        1. Connect to MX server on port 25
        2. Send EHLO with configured domain
        3. STARTTLS if supported
        4. MAIL FROM with configured email
        5. RCPT TO with random email (catch-all test)
        6. RCPT TO with actual email
        7. Parse SMTP response codes
        8. Detect greylisting (4XX codes)
        9. Detect blacklisting (relay denied)
        10. Close connection

    Rate limiting between emails:
        - Google: 10 emails/batch, 2s delay
        - Microsoft: 20 emails/batch, 1s delay
        - Unknown: 5 emails/batch, 3s delay
```

**Step 3: Result Classification**
```
For each email, determine status:
    - valid: deliverable, not catch-all, not greylisted
    - invalid: rejected, no MX, disposable, syntax error
    - catch-all: domain accepts all emails
    - unknown: timeout, greylisting max retries, ambiguous
```

---

## Anti-Greylisting System

### What is Greylisting?
Some mail servers temporarily reject emails on first contact (SMTP 4XX codes) and require retry after a delay. This is a spam prevention technique.

### How We Handle It

**Detection:**
- SMTP response codes 421, 450, 451, 452, etc.
- Temporary failure messages

**Storage:**
- Greylisted emails stored in `antigreylisting` table
- Partial results stored in `controller0Archive`

**Retry Schedule:**
```
1st retry: 1 minute after greylist
2nd retry: 2 minutes after previous
3rd retry: 2 minutes after previous
4th retry: 3 minutes after previous
5th retry: 3 minutes after previous
6th retry: 4 minutes after previous

Max total time: ~15 minutes
```

**Process:**
1. Worker detects greylisting during SMTP verification
2. Controller stores partial results in archive
3. Controller adds email to antigreylisting queue with retry schedule
4. Controller checks antigreylisting queue every 1 second
5. When retry time reached, re-verify email with same worker process
6. Merge results with archived partial results
7. Update verification_request with complete results

**Cleanup:**
- Entries older than 24 hours automatically deleted
- Archive entries cleaned after 24 hours (completed) or 7 days (orphaned)

---

## Catch-All Detection and Caching

### Catch-All Detection Method

**What is Catch-All?**
A domain configured to accept all email addresses regardless of whether specific mailboxes exist.

**How We Test:**
1. Send RCPT TO with random non-existent email (e.g., random-xyz123@domain.com)
2. If accepted → domain is catch-all
3. If rejected → test actual email address

### Catch-All Cache System

**Purpose:** Avoid repeated catch-all tests for the same domain

**Cache Entry:**
```javascript
{
  domain: "example.com",
  catch_all: true/false,
  confidence: 90,      // 0-100 score
  test_count: 5,       // Number of tests performed
  expires_at: timestamp,  // 24 hours from creation
  created_at: timestamp
}
```

**Cache Logic:**
- TTL: 24 hours per domain
- Minimum confidence: 70% to use cached result
- Multiple tests increase confidence score
- Cache validation: Entry must be at least 5 minutes old
- Auto-cleanup: Runs every 15 minutes to remove expired entries

**Storage:** SQLite table `catch_all_cache`

**Benefits:**
- Reduces SMTP connections
- Faster bulk verification for same domains
- Reduces load on target mail servers

---

## Database Schema

### Core Tables

**verification_requests** - Unified table for all request types
```
- verification_request_id (TEXT PRIMARY KEY)
- user_id (INTEGER)
- request_type (TEXT: single, csv, api)
- emails (TEXT: JSON array)
- statistics (TEXT: JSON object)
- status (TEXT: pending, processing, completed, failed)
- created_at, updated_at, completed_at (INTEGER timestamps)
```

**csv_uploads** - CSV-specific metadata
```
- csv_upload_id (TEXT PRIMARY KEY)
- verification_request_id (TEXT FK)
- list_name (TEXT, optional)
- original_filename, file_path, file_size
- has_header (BOOLEAN)
- headers, preview_data (TEXT: JSON arrays)
- selected_email_column, selected_email_column_index
- column_scores (TEXT: JSON object)
- detection_confidence (REAL)
- upload_status (TEXT: uploaded, detecting, ready, submitted)
- created_at, updated_at
```

**api_keys** - API key management
```
- id (INTEGER PRIMARY KEY)
- user_id (INTEGER FK)
- name (TEXT)
- key_hash (TEXT: bcrypt hash)
- key_prefix (TEXT: first 8 chars for display)
- expires_at (DATETIME, optional)
- is_revoked (BOOLEAN)
- last_used (DATETIME)
- created_at (DATETIME)
```

### Worker System Tables

**queue** - Job queue
```
- id (INTEGER PRIMARY KEY)
- request_id (TEXT UNIQUE)
- emails (TEXT: semicolon-separated)
- response_url (TEXT, optional)
```

**controller0** - Active worker assignments
```
- id (INTEGER PRIMARY KEY)
- workerIndex (TEXT UNIQUE)
- request (TEXT: JSON object)
- created_at (NUMBER)
```

**controller0Results** - Internal tracking
```
- request_id (TEXT UNIQUE)
- status (TEXT: queued, processing, completed, failed)
- verifying, greylist_found, blacklist_found (BOOLEAN)
- results (TEXT: JSON array)
- total_emails, completed_emails
- webhook_sent, webhook_attempts
- created_at, updated_at, completed_at
```

**controller0Archive** - Partial results for greylisting
```
- request_id (TEXT UNIQUE)
- emails (TEXT: JSON array)
- result (TEXT: JSON Map)
- response_url (TEXT)
- created_at (NUMBER)
```

**antigreylisting** - Greylisting retry queue
```
- request_id (TEXT UNIQUE)
- emails (TEXT: JSON array of greylisted emails)
- response_url (TEXT)
- retrial_index (NUMBER: current retry attempt)
- last_tried_at (NUMBER)
- max_retries_reached (NUMBER: boolean)
- returned (NUMBER: boolean, processed flag)
```

**catch_all_cache** - Domain catch-all cache
```
- domain (TEXT UNIQUE)
- catch_all (INTEGER: boolean)
- confidence (INTEGER: 0-100)
- test_count (INTEGER)
- expires_at (INTEGER)
- created_at (INTEGER)
```

### Database Features
- SQLite with WAL (Write-Ahead Logging) mode for better concurrency
- Foreign keys enabled for referential integrity
- Indexes on frequently queried columns
- Global singleton database instance
- Automatic initialization on first use

---

## Startup Recovery System

### Purpose
Recover orphaned verification requests after application crash or restart.

### Recovery Process

```
Application Starts
    ↓
Initialize Database
    ↓
Load controller0Archive entries into memory
    ↓
Scan verification_requests table for orphaned requests:
    - Status: pending or processing
    - No corresponding controller0Results entry
    ↓
For each orphaned request:

    IF has archive with results:
        ↓
        Check if greylisting in progress
        ↓
        IF greylisting active:
            → Re-add to antigreylisting queue
            → Continue retry schedule
        ELSE:
            → Complete verification
            → Update verification_requests
            → Send webhook if configured

    ELSE (no archive):
        → Re-add to queue
        → Will be processed like new request
    ↓
Mark recovery complete
    ↓
Release queue and antiGreylisting systems
    ↓
Normal operations begin
```

### Coordination
- Blocks queue until recovery complete
- Blocks antiGreylisting until recovery complete
- Prevents race conditions during startup
- Uses promise-based wait mechanism

---

## Docker Deployment

### Dockerfile Structure

Single-stage build process:
```
1. Base: node:20-alpine
2. Install system dependencies: python3, make, g++, sqlite
3. Copy package.json files
4. Install backend dependencies (production only)
5. Install frontend dependencies
6. Copy all application files
7. Build frontend (outputs to backend/public/)
8. Create runtime directories (.sql, csv, .logs)
9. Set NODE_ENV=production
10. Expose port 5000
11. Start: node index.js
```

### Docker Compose Configuration

```yaml
Service: email-verifier-app
    ↓
Port: 127.0.0.1:5000:5000 (localhost only for security)
    ↓
Environment: Loaded from backend/.env
    ↓
Volumes:
    - email-verifier-db → /app/backend/.sql
    - email-verifier-csv → /app/backend/csv
    - email-verifier-logs → /app/backend/.logs
    ↓
Restart: unless-stopped
    ↓
Health Check:
    - HTTP GET /api/health
    - Interval: 30s
    - Timeout: 10s
    - Retries: 3
    - Start period: 40s
```

### Required Environment Variables

```
MX_DOMAIN=yourdomain.com        # Used in SMTP EHLO
EM_DOMAIN=yourdomain.com        # Used in SMTP MAIL FROM
ADMIN_EMAIL=admin@example.com   # Admin login
ADMIN_PASSWORD=changeme          # Admin password
DB_PATH=.sql/user_auth.db       # Database location
PORT=5000                        # Server port
NODE_ENV=production             # Environment
CORS_ORIGIN=http://localhost:5000
MAX_CSV_ROWS=100000             # CSV row limit
MAX_CSV_SIZE_MB=100             # CSV file size limit
```

---

## Security Architecture

### Authentication Systems

**Admin Authentication**
- Environment-based credentials
- No JWT tokens or sessions
- Bcrypt password hashing
- Simple email/password check
- Used for web dashboard access only

**API Key Authentication**
- Bearer token format
- Keys stored as bcrypt hashes
- Key format: brndnv_sk_{random_string}
- Optional expiry dates
- Revocation support
- Last used tracking
- Display prefix only (first 8 chars)

### Security Middleware

**Helmet.js** - HTTP security headers
- XSS protection
- Content Security Policy
- Frame protection
- HSTS

**CORS** - Cross-Origin Resource Sharing
- Configured for same-origin deployment
- Frontend and backend on same port

**Rate Limiting** - Request throttling
- Applied per-route basis
- Prevents abuse on sensitive endpoints

**Input Validation**
- Express Validator for route parameters
- Zod for complex object validation
- Email format validation
- File upload restrictions (CSV only, max 100MB)

### Data Security

**Password and Key Storage**
- Bcrypt hashing (API keys and passwords)
- Hashes stored in database, never plain text
- Keys shown only once at creation

**SQL Injection Prevention**
- Prepared statements
- Parameterized queries
- better-sqlite3 built-in protection

**File Upload Security**
- File type validation (CSV only)
- File size limits
- Secure file naming
- Isolated storage directory

---

## Verification Checks Performed

### Quick Verification Checks

**Syntax Validation**
- Parse email into username and domain
- RFC-compliant format checking
- Extract components for further checks

**Role Account Detection**
- Check against common role usernames
- Examples: admin, info, support, sales, contact, help, noreply

**Free Domain Detection**
- Check if domain is free email provider
- Examples: gmail.com, yahoo.com, hotmail.com, outlook.com

**Disposable Email Detection**
- Check against list of temporary email services
- Prevents verification of throwaway addresses

**DNS MX Lookup**
- Query mail exchange records for domain
- Verify mail servers exist
- Get MX host list with priorities

### SMTP Verification Checks

**Catch-All Test**
- Send random non-existent email to domain
- If accepted, domain is catch-all
- Cache result for 24 hours

**Email Existence Test**
- SMTP RCPT TO command with actual email
- Check if mailbox exists

**Host Exists**
- Verify MX server responds to connection

**Deliverability**
- Check if email is accepted for delivery
- Verify not rejected by server

**Full Inbox Detection**
- Check for quota exceeded errors
- SMTP 552 code detection

**Disabled Account Detection**
- Check for suspended/disabled mailbox
- Account deactivation messages

**Greylisting Detection**
- SMTP 4XX temporary failure codes
- Automatic retry scheduling

**Blacklisting Detection**
- Relay denied errors
- IP/domain blacklist detection

### Additional Checks

**Gravatar Verification**
- Check if email has Gravatar profile
- Additional confirmation of email existence

**Microsoft Login API**
- Special handling for Microsoft emails
- outlook.com, hotmail.com, live.com
- Uses login API instead of SMTP

**Yahoo Handling**
- Yahoo emails always marked catch-all
- Yahoo blocks SMTP verification attempts

### Result Classification

**valid** - All of these are true:
- Syntax is valid
- Domain has MX records
- SMTP host responds
- Email is deliverable
- Not catch-all domain
- Not greylisted or max retries not exceeded

**invalid** - Any of these are true:
- Syntax error
- No MX records for domain
- SMTP server rejects email
- Mailbox full
- Account disabled
- Disposable email service

**catch-all** - Domain configuration:
- Random email accepted by domain
- Cannot verify specific mailbox existence
- Yahoo emails always catch-all

**unknown** - Verification inconclusive:
- SMTP timeout
- Connection failed
- Greylisting max retries exceeded
- Ambiguous SMTP response
- Server error

---

## Performance Optimizations

### Parallel Processing
- 4 worker threads process emails concurrently
- Quick verification: 20 emails in parallel per worker
- SMTP verification: Grouped by MX organization

### Catch-All Caching
- 24-hour TTL per domain
- Eliminates redundant catch-all tests
- Significant speedup for bulk verification of same domains

### MX Organization Classification
- Groups emails by mail provider
- Applies optimal rate limits per provider
- Prevents throttling and blacklisting

### Connection Reuse
- Single SMTP connection per email batch
- Reduces connection overhead
- Faster processing for multiple emails to same domain

### Pagination
- API results paginated (default 20 per page)
- Reduces response size
- Faster client rendering

### Database Optimizations
- SQLite WAL mode for concurrent reads during writes
- Indexes on frequently queried columns
- Prepared statements for faster execution

---

## System Limitations

### Known Constraints

**Single Admin User**
- Only one admin account supported
- Credentials from environment variables
- No user registration or management

**SQLite Limitations**
- Concurrent write limitations
- Suitable for moderate load
- Not designed for massive scale

**SMTP Port 25 Requirement**
- Must have outbound port 25 access
- Many ISPs and cloud providers block this port
- Cannot verify emails without it

**Request Limits**
- Max 10,000 emails per API request
- Max 100MB CSV file upload
- Max 100,000 rows in CSV (configurable)

**Verification Delays**
- Greylisting adds 1-15 minute delays
- Rate limiting slows bulk verification
- SMTP timeouts affect speed
- Network latency impacts processing time

**Catch-All Domains**
- Cannot verify specific email on catch-all domains
- Result always uncertain for these domains

**Provider-Specific Issues**
- Some mail servers block verification attempts
- Yahoo blocks SMTP verification (always catch-all)
- Microsoft requires special Login API handling

---

## Logging and Monitoring

### Winston Logger

**Log Levels:**
- error: Critical errors and exceptions
- warn: Warning messages and potential issues
- info: General information and important events
- debug: Detailed debugging information

**Log Destinations:**
- Console output (development)
- File logging to .logs/ directory
- Separate logs for verifier operations

**Log Information Captured:**
- HTTP request details
- Verification progress
- SMTP connection attempts
- Worker health status
- Error stack traces
- Webhook delivery attempts

### Health Monitoring

**Container Health Check:**
- HTTP GET to /api/health
- Checks every 30 seconds
- 3 retries before marking unhealthy
- Docker automatically restarts unhealthy containers

**Service Health Endpoints:**
- /api/health - Overall system health
- /api/auth/health - Auth service health
- /api/verifier/health - Verifier service health

**Worker Monitoring:**
- Workers ping controller every 10 seconds
- Controller tracks worker responsiveness
- Auto-restart on worker crash or timeout
- Restart workers every 10 minutes for fresh state

### Available Metrics

**Verification History:**
- Total verifications per time period
- Success vs failure rates
- Processing times (via timestamps)
- Status distribution

**API Key Usage:**
- Last used timestamps
- Track active vs dormant keys
- Identify key usage patterns

**Request Statistics:**
- Total emails per request
- Completion percentages
- Average verification times
- Greylisting frequency

---

## Future Considerations

This section describes potential enhancements not currently implemented:

**Horizontal Scaling:**
- Multiple container instances with load balancer
- Distributed worker system across containers
- Redis for shared caching and job queue

**Database Migration:**
- PostgreSQL or MySQL for better concurrency
- Support for high-write workloads
- Replication and failover support

**Multi-User Support:**
- User registration and management
- Team collaboration features
- Per-user usage tracking and quotas

**Advanced Features:**
- Real-time WebSocket updates instead of polling
- Scheduled verifications
- Custom verification rules per user
- More detailed analytics dashboard
- Result caching with configurable TTL

**Integration Options:**
- OAuth authentication
- Zapier/Make.com integration
- Third-party API enrichment
- More webhook customization

**Performance Improvements:**
- Predictive catch-all detection using ML
- Faster DNS resolution with caching
- Parallel SMTP connections per email
- Result caching for frequently checked emails
