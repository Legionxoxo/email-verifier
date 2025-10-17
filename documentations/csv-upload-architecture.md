# CSV Upload Architecture

## Overview

This document outlines the complete architecture for CSV file upload, validation, email detection, verification, and results management in the email verifier application.

**Architecture:** Hybrid approach - unified `verification_requests` table for all verification types (single, CSV, API) with `csv_uploads` table for CSV-specific metadata.

**Key Benefits:**
- ✅ Unified request history across all verification types
- ✅ Clean separation of verification results vs CSV metadata
- ✅ Reuses existing verification infrastructure
- ✅ Scalable for future verification types

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Validation Strategy](#validation-strategy)
3. [Email Detection Algorithm](#email-detection-algorithm)
4. [CSV Edge Cases](#csv-edge-cases)
5. [Storage Strategy](#storage-strategy)
6. [Database Schema - Hybrid Approach](#database-schema---hybrid-approach)
7. [Request History Architecture](#request-history-architecture)
8. [Complete Workflow](#complete-workflow)
9. [Queue Integration](#queue-integration)
10. [API Endpoints](#api-endpoints)

---

## Technology Stack

### File Upload: Multer (Disk Storage)
- ✅ Industry standard (10M+ weekly downloads)
- ✅ Built-in file size/count limits
- ✅ Disk storage for original CSV files
- ✅ Excellent Express integration
- ✅ Easy cleanup and file management

### CSV Parsing: PapaParse
- ✅ **Fastest** parser (5.5s for 1M rows)
- ✅ **Frontend compatible** (code reusability)
- ✅ Streaming support via `fs.createReadStream()`
- ✅ Excellent malformed CSV handling
- ✅ RFC 4180 compliant (handles commas, newlines in values)

### Storage: File System + Optimized SQLite
- **Original CSV**: Stored on disk in `/uploads/raw/`
- **Metadata only in DB**: Headers, preview, scores, column indices
- **Emails & Results in DB**: JSON arrays for simple storage
- **Result CSV**: Generated on-demand by streaming original + appending status

---

## Validation Strategy

### Frontend Validation (Immediate Feedback)

**Purpose**: Better UX with instant feedback

```typescript
// Quick checks before upload
- File type: .csv only
- File size: <= 100MB
- Basic CSV structure: Has headers, has rows
```

**Benefits**:
- ✅ Immediate user feedback
- ✅ Reduces unnecessary server requests
- ✅ Better user experience

### Backend Validation (Authoritative)

**Purpose**: Security and actual enforcement

```javascript
// Must validate again (never trust client!)
- File type: MIME + extension check
- File size: 100MB hard limit
- Row count: <= 100k (streaming validation)
- Column count: <= 100 columns
```

**Benefits**:
- ✅ Security (client validation can be bypassed)
- ✅ Authoritative enforcement
- ✅ Protection against malicious uploads

---

## Email Detection Algorithm

### RFC 5322 Compliant Email Regex

```javascript
// Updated regex to support:
// ✅ Plus addressing: user+tag@domain.com
// ✅ Dots in local part: first.last@domain.com
// ✅ Subdomains: user@mail.subdomain.domain.com
// ✅ Special characters: ! # $ % & ' * + / = ? ^ _ ` { | } ~ -

const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
```

### Scoring Approach

```javascript
async function detectEmailColumn(csvFilePath) {
    const columnScores = new Map();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    let totalRows = 0;

    // Stream CSV from disk and score each column
    const stream = fs.createReadStream(csvFilePath);

    await new Promise((resolve, reject) => {
        Papa.parse(stream, {
            header: true,
            step: (results) => {
                totalRows++;
                const row = results.data;

                // Score each column
                Object.entries(row).forEach(([columnName, value]) => {
                    if (!columnScores.has(columnName)) {
                        columnScores.set(columnName, 0);
                    }

                    if (value && emailRegex.test(value.trim())) {
                        columnScores.set(columnName, columnScores.get(columnName) + 1);
                    }
                });
            },
            complete: resolve,
            error: reject
        });
    });

    // Find column with highest score
    let bestColumn = null;
    let bestScore = 0;
    let bestColumnIndex = -1;

    const headers = Array.from(columnScores.keys());
    for (let i = 0; i < headers.length; i++) {
        const column = headers[i];
        const score = columnScores.get(column);
        if (score > bestScore) {
            bestScore = score;
            bestColumn = column;
            bestColumnIndex = i;
        }
    }

    // Calculate confidence percentage
    const confidence = totalRows > 0 ? (bestScore / totalRows) * 100 : 0;

    return {
        detectedColumn: bestColumn,
        detectedColumnIndex: bestColumnIndex,
        score: bestScore,
        totalRows: totalRows,
        confidence: confidence.toFixed(2),
        allScores: Object.fromEntries(columnScores),
        warning: confidence < 50 ? 'Low confidence email detection' : null
    };
}
```

### Edge Cases Handling

| Scenario | Confidence | Action |
|----------|------------|--------|
| No column has emails | 0% | ❌ Show error, ask user to select manually |
| Multiple columns with high scores | Varies | ⚠️ Show top 3 for user to choose |
| Low confidence (<50%) | <50% | ⚠️ Warn user, allow manual selection |
| High confidence (>80%) | >80% | ✅ Auto-select, show in Step 2 |

---

## CSV Edge Cases

### 1. Dots in Header Names (CRITICAL)

**Problem:**
PapaParse with `header: true` converts dots in header names, causing issues:
```csv
user.name,user.email,company
John,john@test.com,Acme
```
PapaParse may interpret this incorrectly or fail.

**Solution**: ✅ **Parse with `header: false` and manually extract first row as headers**
```javascript
Papa.parse(stream, {
    header: false,  // Don't let PapaParse handle headers
    step: (results, parser) => {
        if (rowIndex === 0) {
            headers = results.data;  // First row = headers
        } else {
            // Process data rows
        }
    }
});
```

### 2. Files Without Headers

**Problem:** User uploads CSV without header row - all rows are data.

**Solution**: ✅ **Frontend provides `hasHeader` flag**
- User can toggle checkbox: "First row is header"
- If `hasHeader: false`, generate column names: `Column 1`, `Column 2`, etc.
- Backend uses this flag to skip or include first row in processing

### 3. Commas Inside Values

**Example CSV:**
```csv
name,email,company
"John, Jr.",john@test.com,"Acme, Inc."
```

**Solution**: ✅ **PapaParse handles this automatically** with proper quote detection!

### 4. Newlines Inside Values

**Example CSV:**
```csv
name,email,address
"John Doe",john@test.com,"123 Main St
Apt 4B
New York"
```

**Solution**: ✅ **PapaParse handles this** when values are quoted!

### 5. Special Characters in Emails

**Example CSV:**
```csv
name,email,company
John Doe,john.doe+work@example.com,Acme Inc
Jane Smith,jane_smith@mail.co.uk,Corp Ltd
```

**Solution**: ✅ **Updated regex supports all RFC 5322 compliant characters**

---

## Storage Strategy

### File System + Optimized Database

#### File System Structure

```
/uploads/
  ├── raw/
  │   └── {request_id}_original.csv      # Original uploaded CSV
  └── results/
      └── {request_id}_results.csv        # Final CSV with status columns (generated on-demand)
```

#### Filename Handling

- **Upload**: User uploads `customer_emails.csv`
- **Storage**: Saved as `{uuid}_original.csv` (e.g., `abc123_original.csv`)
- **Database**: Store original filename as `customer_emails.csv`
- **Download**: Return as `customer_emails.csv` (original name preserved)

```javascript
// On upload
const originalFilename = req.file.originalname; // "customer_emails.csv"
const requestId = uuidv4();
const storedFilename = `${requestId}_original.csv`;

// On download
res.setHeader('Content-Disposition', `attachment; filename="${upload.original_filename}"`);
```

#### Why File System + Minimal DB?

**Original CSV on Disk**:
- ✅ No database bloat - 100MB file = 100MB disk space
- ✅ Easy cleanup - delete files after 30 days
- ✅ Can re-process anytime by streaming from disk
- ✅ Generate result CSV by streaming + appending status

**Metadata in Database**:
- ✅ Small footprint - ~2KB per request (preview + headers + scores)
- ✅ Fast queries - no JSON parsing needed for metadata
- ✅ Efficient storage - only essential data

**Emails & Results as JSON**:
- ✅ Simple storage - single column per dataset
- ✅ Easy to update - replace entire array
- ✅ ~10-13MB for 100k emails with results

#### Storage Capacity Analysis

```
Per CSV upload:
- File system: 100MB (original CSV) + ~10MB (result CSV)
- Database: ~10-13MB (emails + results as JSON)
- Total: ~120MB per upload

Benefits:
- Simple schema (1 or 2 tables max)
- All related data together
- Easy cleanup and maintenance
```

---

## Database Schema - Hybrid Approach

**Unified Verification + CSV Metadata** - Best of both worlds

### Table 1: verification_requests (Unified History & Results)

All verification requests (single, CSV, API) stored here for unified history and results.

```sql
CREATE TABLE verification_requests (
    verification_request_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    request_type TEXT CHECK(request_type IN ('single', 'csv', 'api')) NOT NULL,

    -- Core verification data (works for all types)
    emails TEXT NOT NULL,  -- JSON: ["email1@test.com", ...] or ["single@test.com"]
    results TEXT,          -- JSON: verification results [{email, status, message}, ...]

    -- Status tracking
    status TEXT CHECK(status IN (
        'pending',       -- Queued for verification
        'processing',    -- Currently verifying
        'completed',     -- Verification complete
        'failed'         -- Verification failed
    )) DEFAULT 'pending',

    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    completed_at INTEGER,

    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for fast history queries
CREATE INDEX idx_verification_user_date ON verification_requests(user_id, created_at DESC);
CREATE INDEX idx_verification_user_type ON verification_requests(user_id, request_type);
CREATE INDEX idx_verification_status ON verification_requests(user_id, status);
```

### Table 2: csv_uploads (CSV-Specific Metadata)

CSV-specific metadata and upload tracking. Only queried when viewing CSV details.

```sql
CREATE TABLE csv_uploads (
    csv_upload_id TEXT PRIMARY KEY,        -- Unique ID for CSV upload
    verification_request_id TEXT,          -- Links to verification_requests (NULL until verified)
    user_id TEXT NOT NULL,

    -- File metadata
    original_filename TEXT NOT NULL,       -- User's filename: "customer_emails.csv"
    file_path TEXT NOT NULL,               -- Stored as: /uploads/raw/{csv_upload_id}_original.csv
    file_size INTEGER NOT NULL,            -- bytes

    -- CSV structure
    has_header INTEGER NOT NULL DEFAULT 1, -- Boolean: 1 = has header row, 0 = no header
    headers TEXT NOT NULL,                 -- JSON: ["name", "email", "company"] or ["Column 1", "Column 2"]
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL,

    -- Preview (first 5 rows for UI display)
    preview_data TEXT NOT NULL,            -- JSON: [{name: "John", email: "john@test.com"}, ...]

    -- Email detection results
    selected_email_column TEXT,            -- Column name: "email" or "Column 2"
    selected_email_column_index INTEGER,   -- Column index: 1 (0-based)
    column_scores TEXT,                    -- JSON: {"email": 9500, "cc": 150, "name": 0}
    detection_confidence REAL,             -- Percentage: 95.0

    -- Upload-specific status (before verification)
    upload_status TEXT CHECK(upload_status IN (
        'uploaded',      -- File uploaded, metadata saved
        'detecting',     -- Running email column detection
        'ready',         -- Email column detected, awaiting user confirmation
        'submitted'      -- Submitted for verification
    )) DEFAULT 'uploaded',

    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (verification_request_id) REFERENCES verification_requests(verification_request_id)
);

CREATE INDEX idx_csv_user ON csv_uploads(user_id);
CREATE INDEX idx_csv_verification ON csv_uploads(verification_request_id);
CREATE INDEX idx_csv_upload_status ON csv_uploads(upload_status);
```

### Why Hybrid Approach?

**Benefits:**
- ✅ **Unified history** - All verifications in one table, easy queries
- ✅ **No NULL fields** - Each table contains only relevant data
- ✅ **Fast history queries** - No JOINs needed for history list
- ✅ **Efficient details** - JOIN only when viewing CSV-specific details
- ✅ **Scalable** - Easy to add API bulk verification, webhooks, etc.
- ✅ **Clean separation** - Verification results vs CSV metadata

**How they relate:**
```
csv_uploads (upload metadata)
      ↓
   User confirms column
      ↓
verification_requests (emails + results)
      ↓
   Queue processes
      ↓
Results stored in verification_requests
      ↓
CSV download combines both tables
```

---

## Request History Architecture

### Overview

The hybrid schema enables **unified request history** across all verification types. Users can view all their verification requests (single emails, CSV uploads, API calls) in one chronological list.

### History List Query (Fast - No JOIN)

```javascript
async function getUserHistory(userId, page = 1, perPage = 50) {
    const offset = (page - 1) * perPage;

    const requests = await db.all(`
        SELECT
            verification_request_id,
            request_type,
            status,
            JSON_LENGTH(emails) as email_count,
            created_at,
            updated_at,
            completed_at
        FROM verification_requests
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `, [userId, perPage, offset]);

    return requests;
}
```

**Example Response:**
```json
{
  "requests": [
    {
      "verification_request_id": "csv-abc-123",
      "request_type": "csv",
      "email_count": 10000,
      "status": "completed",
      "created_at": 1697654400000,
      "completed_at": 1697655000000
    },
    {
      "verification_request_id": "single-def-456",
      "request_type": "single",
      "email_count": 1,
      "status": "completed",
      "created_at": 1697654300000,
      "completed_at": 1697654305000
    }
  ],
  "total": 156,
  "page": 1,
  "per_page": 50
}
```

### Filter by Type

```javascript
async function getCSVHistory(userId) {
    return await db.all(`
        SELECT
            v.verification_request_id,
            v.status,
            JSON_LENGTH(v.emails) as email_count,
            v.created_at,
            v.completed_at,
            c.original_filename,
            c.row_count
        FROM verification_requests v
        LEFT JOIN csv_uploads c ON v.verification_request_id = c.verification_request_id
        WHERE v.user_id = ? AND v.request_type = 'csv'
        ORDER BY v.created_at DESC
    `, [userId]);
}
```

### Get Detailed View (With JOIN)

When user clicks on a request, fetch full details:

```javascript
async function getVerificationDetails(verificationRequestId) {
    const verification = await db.get(`
        SELECT * FROM verification_requests
        WHERE verification_request_id = ?
    `, [verificationRequestId]);

    // If CSV request, get CSV-specific metadata
    if (verification.request_type === 'csv') {
        verification.csv_details = await db.get(`
            SELECT
                original_filename,
                file_path,
                has_header,
                headers,
                preview_data,
                row_count,
                column_count,
                selected_email_column,
                detection_confidence,
                upload_status
            FROM csv_uploads
            WHERE verification_request_id = ?
        `, [verificationRequestId]);
    }

    return verification;
}
```

### History UI Example

**List View:**
```
┌────────────────────────────────────────────────────────┐
│ Verification History                    [Filter ▼]     │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 📄 customers.csv                              ✅ Done  │
│    10,000 emails verified                              │
│    2 hours ago • Completed in 10 minutes               │
│    [View Details] [Download Results]                   │
│                                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 📧 test@example.com                           ✅ Valid │
│    Single email verification                           │
│    3 hours ago • Completed in 2 seconds                │
│    [View Details]                                      │
│                                                         │
├────────────────────────────────────────────────────────┤
│                                                         │
│ 📄 leads.csv                            ⏳ Processing  │
│    5,000 emails • 2,341 verified (46%)                 │
│    5 hours ago • Est. 3 minutes remaining              │
│    [View Progress]                                     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

**Detail View (CSV):**
```
┌────────────────────────────────────────────────────────┐
│ ← Back to History                                      │
├────────────────────────────────────────────────────────┤
│ CSV Verification Details                               │
│                                                         │
│ File: customers.csv                                    │
│ Uploaded: Oct 17, 2024 10:30 AM                       │
│ Status: ✅ Completed                                   │
│                                                         │
│ Statistics:                                            │
│ • Total Emails: 10,000                                 │
│ • Valid: 7,500 (75%)                                   │
│ • Invalid: 1,800 (18%)                                 │
│ • Catch-all: 500 (5%)                                  │
│ • Unknown: 200 (2%)                                    │
│                                                         │
│ Detection:                                             │
│ • Column: "email" (95% confidence)                     │
│ • Headers: name, email, company                        │
│                                                         │
│ [Download Results CSV] [View Preview]                  │
└────────────────────────────────────────────────────────┘
```

### Key Benefits

1. **Fast Loading** - History list doesn't query CSV metadata
2. **Unified View** - All verification types in one chronological feed
3. **Easy Filtering** - By type, status, date without complex queries
4. **Efficient Details** - Only JOIN when viewing specific request
5. **Scalable** - Easy to add new request types (API, webhooks, etc.)

---

## Complete Workflow

### STEP 1: Upload & Store to Disk

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND                                                │
├─────────────────────────────────────────────────────────┤
│ ✓ Check file type (.csv)                               │
│ ✓ Check file size (≤100MB)                             │
│ ✓ User toggles "Has Header" checkbox (default: true)   │
│ → POST /api/csv/upload                                  │
│   FormData:                                             │
│     - csvFile = "customer_emails.csv"                  │
│     - hasHeader = true/false                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ BACKEND                                                 │
├─────────────────────────────────────────────────────────┤
│ 1. Generate UUID: request_id = "abc-123-def"           │
│ 2. Multer saves to disk:                                │
│    → /uploads/raw/abc-123-def_original.csv             │
│ 3. Store original filename: "customer_emails.csv"      │
│ 4. Validate MIME type + extension                       │
│ 5. Stream parse with header: false (avoid dot issues)   │
│ 6. If hasHeader === true:                               │
│      - Extract first row as headers                     │
│      - Start preview from row 2 (next 5 rows)          │
│    Else (hasHeader === false):                          │
│      - Generate headers: ["Column 1", "Column 2", ...] │
│      - Start preview from row 1 (first 5 rows)         │
│ 7. Count rows & columns (continue streaming)            │
│ 8. Insert metadata into csv_uploads:                    │
│    - request_id, original_filename, file_path          │
│    - has_header, headers, preview_data                  │
│    - row_count, column_count                            │
│    - status: 'uploaded'                                 │
│ 9. Return: { request_id, preview, headers, hasHeader } │
└─────────────────────────────────────────────────────────┘
```

### STEP 2: Email Detection & User Confirmation

```
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Auto-triggered after upload)                  │
├─────────────────────────────────────────────────────────┤
│ 1. Get file path and has_header from csv_uploads       │
│ 2. Stream CSV file from disk with header: false        │
│ 3. Skip first row if has_header === true               │
│ 4. Score each column with email regex:                 │
│    - For each row, test each column value              │
│    - Increment score if matches email pattern          │
│ 5. Find column with highest score                       │
│ 6. Get column index from headers array                  │
│ 7. Calculate confidence = (score / totalRows) * 100     │
│ 8. Update csv_uploads:                                  │
│    - selected_email_column = "email"                    │
│    - selected_email_column_index = 1                    │
│    - column_scores = {"email": 9500, "cc": 150}        │
│    - detection_confidence = 95.0                        │
│    - status: 'ready'                                    │
│ 9. Return detection results to frontend                 │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ FRONTEND - User Confirmation                            │
├─────────────────────────────────────────────────────────┤
│ 1. Display detected email column highlighted            │
│ 2. Show confidence percentage                           │
│ 3. Show all column scores                               │
│ 4. Provide dropdown to select different column         │
│ 5. User can:                                            │
│    ✅ Confirm detected column → Proceed to Step 3      │
│    ✅ Select different column → Proceed to Step 3      │
│    ❌ Cancel → Stop process                            │
└─────────────────────────────────────────────────────────┘
```

### STEP 3: Email Extraction & Queue Submission

```
┌─────────────────────────────────────────────────────────┐
│ BACKEND (User confirmed/selected column)               │
├─────────────────────────────────────────────────────────┤
│ 1. Get file path, has_header & email column index      │
│ 2. Stream CSV from disk with header: false             │
│ 3. Extract emails from selected column:                 │
│    const emails = []                                    │
│    let rowIndex = 0                                     │
│    Papa.parse(stream, {                                 │
│      header: false,  // Manual parsing, no dot issues  │
│      step: (results) => {                               │
│        // Skip header row if has_header === true       │
│        if (has_header && rowIndex === 0) {             │
│          rowIndex++                                     │
│          return                                         │
│        }                                                 │
│        const email = results.data[columnIndex]         │
│        if (email && email.trim()) {                     │
│          emails.push(email.trim())                     │
│        }                                                 │
│        rowIndex++                                       │
│      }                                                   │
│    })                                                    │
│                                                         │
│ 4. Generate verification_request_id (UUID)              │
│                                                         │
│ 5. Create verification request:                         │
│    INSERT INTO verification_requests                    │
│      (verification_request_id, user_id, request_type,  │
│       emails, status, created_at, updated_at)          │
│    VALUES (?, ?, 'csv', ?, 'pending', ?, ?)            │
│                                                         │
│ 6. Link CSV upload to verification:                     │
│    UPDATE csv_uploads                                   │
│    SET verification_request_id = ?,                     │
│        upload_status = 'submitted',                     │
│        updated_at = ?                                   │
│    WHERE csv_upload_id = ?                              │
│                                                         │
│ 7. Add to verification queue:                           │
│    queue.add({                                          │
│      request_id: verification_request_id,              │
│      emails: emails,                                    │
│      response_url: ''                                   │
│    })                                                    │
│                                                         │
│ 8. Update verification status:                          │
│    UPDATE verification_requests                         │
│    SET status = 'processing', updated_at = ?            │
│    WHERE verification_request_id = ?                    │
│                                                         │
│ 9. Return verification_request_id to frontend           │
└─────────────────────────────────────────────────────────┘
```

### STEP 4: Monitor Verification & Store Results

```
┌─────────────────────────────────────────────────────────┐
│ BACKEND (Polling)                                       │
├─────────────────────────────────────────────────────────┤
│ 1. Poll controller status periodically:                 │
│    status = controller.getRequestStatus(               │
│      verification_request_id                           │
│    )                                                     │
│                                                         │
│ 2. When status === 'completed':                         │
│    results = controller.getRequestResults(             │
│      verification_request_id                           │
│    )                                                     │
│    // results = VerificationObj[]                       │
│                                                         │
│ 3. Map to simplified format:                            │
│    const resultsArray = results.map(r => ({            │
│      email: r.email,                                    │
│      status: r.smtp.deliverable ? 'valid' : 'invalid', │
│      message: r.error_msg || 'Verified successfully'   │
│    }))                                                   │
│                                                         │
│ 4. Store results in verification_requests:              │
│    UPDATE verification_requests                         │
│    SET results = JSON.stringify(resultsArray),         │
│        status = 'completed',                            │
│        completed_at = ?,                                │
│        updated_at = ?                                   │
│    WHERE verification_request_id = ?                    │
│                                                         │
│ 5. Results now available in unified history             │
│    Frontend can query:                                  │
│    - GET /api/history (list all requests)              │
│    - GET /api/verification/:id (get details)           │
│    - GET /api/csv/download/:id (download CSV)          │
└─────────────────────────────────────────────────────────┘
```

### STEP 5: Generate & Download Result CSV

```
┌─────────────────────────────────────────────────────────┐
│ BACKEND (User requests download)                       │
├─────────────────────────────────────────────────────────┤
│ 1. Get CSV metadata and verification results (JOIN):    │
│    SELECT c.file_path, c.original_filename,            │
│           c.has_header, c.selected_email_column_index, │
│           v.results                                     │
│    FROM csv_uploads c                                   │
│    INNER JOIN verification_requests v                   │
│      ON c.verification_request_id = v.verification_request_id │
│    WHERE c.csv_upload_id = ?                            │
│                                                         │
│ 2. Parse results JSON from verification_requests:       │
│    const resultsArray = JSON.parse(verification.results) │
│    // [{email: "john@test.com", status: "valid", ...}] │
│                                                         │
│ 3. Create email → result Map for O(1) lookup:          │
│    const resultsMap = new Map(                         │
│      resultsArray.map(r => [r.email, r])              │
│    )                                                     │
│                                                         │
│ 4. Stream original CSV from disk:                       │
│    const readStream = fs.createReadStream(file_path)   │
│                                                         │
│ 5. Transform and write to result file:                  │
│    let rowIndex = 0                                     │
│    Papa.parse(readStream, {                             │
│      header: false,  // Manual parsing                 │
│      step: (results) => {                               │
│        const row = results.data                         │
│        if (rowIndex === 0 && has_header) {             │
│          // First row is header - append result columns│
│          row.push('email_status', 'status_message')    │
│        } else {                                          │
│          // Data row - lookup result and append        │
│          const email = row[emailColumnIndex]           │
│          const result = resultsMap.get(email) || {     │
│            status: '', message: ''                     │
│          }                                              │
│          row.push(result.status, result.message)       │
│        }                                                 │
│        writeStream.write(Papa.unparse([row]) + '\n')   │
│        rowIndex++                                       │
│      }                                                   │
│    })                                                    │
│                                                         │
│ 6. Save to: /uploads/results/{csv_upload_id}_results.csv │
│                                                         │
│ 7. Download response:                                   │
│    Content-Type: text/csv                               │
│    Content-Disposition: attachment;                     │
│      filename="customer_emails.csv"                     │
│    (Uses original_filename from csv_uploads)            │
└─────────────────────────────────────────────────────────┘
```

---

## Queue Integration

### Adding to Queue (Hybrid Approach)

```javascript
const queue = require('../staging/queue');
const controller = require('../verifier/controller');
const { v4: uuidv4 } = require('uuid');

// After extracting emails from CSV
const emails = []; // Extracted from CSV using streaming

// Generate verification request ID
const verificationRequestId = uuidv4();

// 1. Create verification request (unified table)
await db.run(`
    INSERT INTO verification_requests
    (verification_request_id, user_id, request_type, emails, status, created_at, updated_at)
    VALUES (?, ?, 'csv', ?, 'pending', ?, ?)
`, [verificationRequestId, userId, JSON.stringify(emails), Date.now(), Date.now()]);

// 2. Link CSV upload to verification request
await db.run(`
    UPDATE csv_uploads
    SET verification_request_id = ?, upload_status = 'submitted', updated_at = ?
    WHERE csv_upload_id = ?
`, [verificationRequestId, Date.now(), csvUploadId]);

// 3. Add to verification queue
await queue.add({
    request_id: verificationRequestId,
    emails: emails,
    response_url: ''  // Empty - we'll poll for results instead
});

// 4. Update verification status
await db.run(`
    UPDATE verification_requests
    SET status = 'processing', updated_at = ?
    WHERE verification_request_id = ?
`, [Date.now(), verificationRequestId]);
```

### Monitoring Verification

Poll the controller to check verification status:

```javascript
// Check status
const status = await controller.getRequestStatus(verificationRequestId);

if (status.status === 'completed') {
    // Get verification results
    const results = await controller.getRequestResults(verificationRequestId);

    // Results is an array of VerificationObj:
    // [{
    //   email: "john@test.com",
    //   reachable: "yes",
    //   smtp: { deliverable: true, catch_all: false, ... },
    //   error: false,
    //   error_msg: ""
    // }, ...]

    // Update database with results
    await storeVerificationResults(verificationRequestId, results);
}
```

### Mapping VerificationObj to Unified Format

```javascript
async function storeVerificationResults(verificationRequestId, verificationResults) {
    // Map to simplified format
    const resultsArray = verificationResults.map(result => {
        let status, message;

        if (result.error) {
            status = 'unknown';
            message = result.error_msg || 'Verification error';
        } else if (result.smtp.deliverable) {
            status = 'valid';
            message = 'Email verified successfully';
        } else if (result.smtp.catch_all) {
            status = 'catch-all';
            message = 'Domain accepts all emails (catch-all)';
        } else if (result.smtp.full_inbox) {
            status = 'invalid';
            message = 'Mailbox is full';
        } else if (result.smtp.disabled) {
            status = 'invalid';
            message = 'Mailbox is disabled';
        } else if (!result.has_mx_records) {
            status = 'invalid';
            message = 'No MX records found for domain';
        } else {
            status = 'invalid';
            message = result.error_msg || 'Email not deliverable';
        }

        return { email: result.email, status, message };
    });

    // Store results in verification_requests (unified table)
    await db.run(`
        UPDATE verification_requests
        SET results = ?, status = 'completed', completed_at = ?, updated_at = ?
        WHERE verification_request_id = ?
    `, [JSON.stringify(resultsArray), Date.now(), Date.now(), verificationRequestId]);
}
```

**Note:** Results are stored in `verification_requests` table, making them available for:
- Unified request history
- Single email verifications (same format)
- CSV downloads (JOIN with csv_uploads for file metadata)
- API bulk verifications (future)

---

## API Endpoints

### Request History Endpoints

#### GET /api/history

Get paginated list of all verification requests for the authenticated user.

**Query Parameters:**
```
page: number (default: 1)
per_page: number (default: 50)
type: 'single' | 'csv' | 'api' (optional filter)
status: 'pending' | 'processing' | 'completed' | 'failed' (optional filter)
```

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "verification_request_id": "csv-abc-123",
      "request_type": "csv",
      "email_count": 10000,
      "status": "completed",
      "created_at": 1697654400000,
      "updated_at": 1697655000000,
      "completed_at": 1697655000000
    },
    {
      "verification_request_id": "single-def-456",
      "request_type": "single",
      "email_count": 1,
      "status": "completed",
      "created_at": 1697654300000,
      "completed_at": 1697654305000
    }
  ],
  "total": 156,
  "page": 1,
  "per_page": 50
}
```

#### GET /api/verification/:verification_request_id

Get detailed information about a specific verification request.

**Response (Single Email):**
```json
{
  "success": true,
  "verification_request_id": "single-def-456",
  "request_type": "single",
  "status": "completed",
  "emails": ["test@example.com"],
  "results": [
    {
      "email": "test@example.com",
      "status": "valid",
      "message": "Email verified successfully"
    }
  ],
  "created_at": 1697654300000,
  "completed_at": 1697654305000
}
```

**Response (CSV):**
```json
{
  "success": true,
  "verification_request_id": "csv-abc-123",
  "request_type": "csv",
  "status": "completed",
  "email_count": 10000,
  "results": [...],
  "created_at": 1697654400000,
  "completed_at": 1697655000000,
  "csv_details": {
    "csv_upload_id": "upload-xyz-789",
    "original_filename": "customers.csv",
    "row_count": 10000,
    "column_count": 3,
    "has_header": true,
    "headers": ["name", "email", "company"],
    "selected_email_column": "email",
    "detection_confidence": 95.5,
    "download_url": "/api/csv/upload-xyz-789/download"
  }
}
```

---

### CSV Upload Endpoints

### 1. Upload CSV

**Endpoint**: `POST /api/csv/upload`

**Request**:
```
Content-Type: multipart/form-data

csvFile: <file> (e.g., "customer_emails.csv")
hasHeader: true/false (default: true)
```

**Response**:
```json
{
  "success": true,
  "csv_upload_id": "upload-abc-123",
  "original_filename": "customer_emails.csv",
  "has_header": true,
  "preview": [
    { "name": "John", "email": "john@test.com", "company": "Acme" },
    { "name": "Jane", "email": "jane@test.com", "company": "Corp" }
  ],
  "headers": ["name", "email", "company"],
  "row_count": 50000,
  "column_count": 3,
  "file_size": 5242880,
  "upload_status": "uploaded"
}
```

### 2. Detect Email Column

**Endpoint**: `POST /api/csv/detect-email`

**Request**:
```json
{
  "csv_upload_id": "upload-abc-123"
}
```

**Response**:
```json
{
  "success": true,
  "csv_upload_id": "upload-abc-123",
  "detected_column": "email",
  "detected_column_index": 1,
  "confidence": 95.5,
  "column_scores": {
    "name": 0,
    "email": 9550,
    "company": 0
  },
  "upload_status": "ready"
}
```

### 3. Start Verification

**Endpoint**: `POST /api/csv/verify`

**Request**:
```json
{
  "csv_upload_id": "upload-abc-123",
  "email_column_index": 1
}
```

**Response**:
```json
{
  "success": true,
  "message": "Verification started",
  "csv_upload_id": "upload-abc-123",
  "verification_request_id": "verify-456-ghi",
  "upload_status": "submitted",
  "verification_status": "processing",
  "total_emails": 10000
}
```

### 4. Get Verification Status

**Endpoint**: `GET /api/verification/:verification_request_id/status`

**Response**:
```json
{
  "success": true,
  "verification_request_id": "verify-456-ghi",
  "request_type": "csv",
  "status": "processing",
  "progress": {
    "total_emails": 10000,
    "completed_emails": 5000,
    "percentage": 50
  },
  "created_at": 1697654400000,
  "updated_at": 1697654700000
}
```

### 5. Get Statistics

**Endpoint**: `GET /api/verification/:verification_request_id/stats`

**Response**:
```json
{
  "success": true,
  "verification_request_id": "verify-456-ghi",
  "statistics": {
    "total_emails": 10000,
    "valid": 7500,
    "invalid": 1800,
    "catch_all": 500,
    "unknown": 200,
    "percentages": {
      "valid": 75.0,
      "invalid": 18.0,
      "catch_all": 5.0,
      "unknown": 2.0
    }
  }
}
```

### 6. Download Result CSV

**Endpoint**: `GET /api/csv/:csv_upload_id/download`

**Response**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="customer_emails.csv"

name,email,company,email_status,status_message
John Doe,john@test.com,Acme Inc,valid,Email verified successfully
Jane Smith,jane@invalid.com,Corp Ltd,invalid,No MX records found for domain
```

---

## Implementation Code Examples

### 1. Upload and Save to Disk

```javascript
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for disk storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/raw');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const requestId = uuidv4();
        req.requestId = requestId;
        req.originalFilename = file.originalname;  // Store original filename
        cb(null, `${requestId}_original.csv`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' && file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files allowed'), false);
        }
    }
});

app.post('/api/csv/upload', upload.single('csvFile'), async (req, res) => {
    try {
        const requestId = req.requestId;
        const filePath = req.file.path;
        const originalFilename = req.originalFilename;
        const hasHeader = req.body.hasHeader === 'true' || req.body.hasHeader === true; // Parse from form data

        let rowIndex = 0;
        let totalRows = 0;
        let columnCount = 0;
        let headers = [];
        const preview = [];

        // Stream parse to get preview and count
        const stream = fs.createReadStream(filePath);

        await new Promise((resolve, reject) => {
            Papa.parse(stream, {
                header: false,  // Manual parsing to avoid dot issues
                step: (results) => {
                    const row = results.data;

                    // First row handling
                    if (rowIndex === 0) {
                        columnCount = row.length;

                        if (columnCount > 100) {
                            reject(new Error('Too many columns (max 100)'));
                            return;
                        }

                        if (hasHeader) {
                            // First row is header
                            headers = row;
                        } else {
                            // No header - generate column names
                            headers = row.map((_, i) => `Column ${i + 1}`);
                            // First row is data - add to preview
                            if (preview.length < 5) {
                                const previewObj = {};
                                headers.forEach((h, i) => previewObj[h] = row[i]);
                                preview.push(previewObj);
                            }
                        }
                    } else {
                        // Data rows
                        totalRows++;

                        if (totalRows >= 100000) {
                            reject(new Error('Too many rows (max 100,000)'));
                            return;
                        }

                        // Collect preview rows (skip first if it's header)
                        if (preview.length < 5) {
                            const previewObj = {};
                            headers.forEach((h, i) => previewObj[h] = row[i]);
                            preview.push(previewObj);
                        }
                    }

                    rowIndex++;
                },
                complete: resolve,
                error: reject
            });
        });

        // Adjust row count based on hasHeader
        const dataRowCount = hasHeader ? totalRows : totalRows + 1;

        // Insert metadata into database
        await db.run(`
            INSERT INTO csv_uploads
            (request_id, user_id, original_filename, file_path, file_size,
             has_header, headers, preview_data, row_count, column_count, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            requestId,
            req.user.id,
            originalFilename,
            filePath,
            req.file.size,
            hasHeader ? 1 : 0,
            JSON.stringify(headers),
            JSON.stringify(preview),
            dataRowCount,
            columnCount,
            'uploaded',
            Date.now(),
            Date.now()
        ]);

        res.json({
            success: true,
            request_id: requestId,
            original_filename: originalFilename,
            has_header: hasHeader,
            preview: preview,
            headers: headers,
            row_count: dataRowCount,
            column_count: columnCount,
            file_size: req.file.size
        });

    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});
```

### 2. Email Detection from Disk

```javascript
async function detectEmailColumn(request_id) {
    try {
        const upload = await db.get(
            'SELECT file_path, has_header, headers FROM csv_uploads WHERE request_id = ?',
            [request_id]
        );

        const filePath = upload.file_path;
        const hasHeader = upload.has_header === 1;
        const headers = JSON.parse(upload.headers);
        const columnScores = new Map();
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        let totalRows = 0;
        let rowIndex = 0;

        const stream = fs.createReadStream(filePath);

        await new Promise((resolve, reject) => {
            Papa.parse(stream, {
                header: false,  // Manual parsing to avoid dot issues
                step: (results) => {
                    const row = results.data;

                    // Skip header row if hasHeader is true
                    if (rowIndex === 0 && hasHeader) {
                        rowIndex++;
                        return;
                    }

                    totalRows++;

                    // Score each column
                    row.forEach((value, columnIndex) => {
                        const columnName = headers[columnIndex];

                        if (!columnScores.has(columnName)) {
                            columnScores.set(columnName, 0);
                        }

                        if (value && emailRegex.test(value.trim())) {
                            columnScores.set(columnName, columnScores.get(columnName) + 1);
                        }
                    });

                    rowIndex++;
                },
                complete: resolve,
                error: reject
            });
        });

        // Find best column
        let bestColumn = null;
        let bestScore = 0;
        let bestColumnIndex = -1;

        for (let i = 0; i < headers.length; i++) {
            const column = headers[i];
            const score = columnScores.get(column) || 0;
            if (score > bestScore) {
                bestScore = score;
                bestColumn = column;
                bestColumnIndex = i;
            }
        }

        const confidence = totalRows > 0 ? (bestScore / totalRows) * 100 : 0;

        // Update database
        await db.run(`
            UPDATE csv_uploads
            SET selected_email_column = ?,
                selected_email_column_index = ?,
                column_scores = ?,
                detection_confidence = ?,
                status = ?,
                updated_at = ?
            WHERE request_id = ?
        `, [
            bestColumn,
            bestColumnIndex,
            JSON.stringify(Object.fromEntries(columnScores)),
            confidence,
            'ready',
            Date.now(),
            request_id
        ]);

        return {
            detected_column: bestColumn,
            detected_column_index: bestColumnIndex,
            confidence: confidence.toFixed(2),
            column_scores: Object.fromEntries(columnScores)
        };

    } catch (error) {
        throw error;
    }
}
```

### 3. Extract Emails & Add to Queue

```javascript
async function extractAndVerifyEmails(request_id, email_column_index) {
    try {
        // Get file path and has_header
        const upload = await db.get(
            'SELECT file_path, has_header FROM csv_uploads WHERE request_id = ?',
            [request_id]
        );

        const filePath = upload.file_path;
        const hasHeader = upload.has_header === 1;
        const stream = fs.createReadStream(filePath);

        let rowIndex = 0;
        const emails = [];

        // Stream parse and extract emails
        await new Promise((resolve, reject) => {
            Papa.parse(stream, {
                header: false,  // Manual parsing to avoid dot issues
                step: (results) => {
                    const row = results.data;

                    // Skip header row if hasHeader is true
                    if (rowIndex === 0 && hasHeader) {
                        rowIndex++;
                        return;
                    }

                    // Extract email from selected column
                    const email = row[email_column_index];

                    if (email && email.trim()) {
                        emails.push(email.trim());
                    }

                    rowIndex++;
                },
                complete: resolve,
                error: reject
            });
        });

        // Store emails in csv_uploads
        await db.run(
            'UPDATE csv_uploads SET emails = ?, updated_at = ? WHERE request_id = ?',
            [JSON.stringify(emails), Date.now(), request_id]
        );

        // Generate verification request ID
        const verification_request_id = uuidv4();

        // Add to queue
        await queue.add({
            request_id: verification_request_id,
            emails: emails,
            response_url: ''
        });

        // Update csv_uploads
        await db.run(`
            UPDATE csv_uploads
            SET verification_request_id = ?,
                status = ?,
                updated_at = ?
            WHERE request_id = ?
        `, [verification_request_id, 'verifying', Date.now(), request_id]);

        return {
            success: true,
            verification_request_id: verification_request_id,
            total_emails: emails.length
        };

    } catch (error) {
        throw error;
    }
}
```

### 4. Generate Result CSV by Streaming

```javascript
async function generateResultCSV(request_id) {
    try {
        // Get upload data
        const upload = await db.get(`
            SELECT file_path, original_filename, has_header, selected_email_column_index, results
            FROM csv_uploads
            WHERE request_id = ?
        `, [request_id]);

        const hasHeader = upload.has_header === 1;
        const emailColumnIndex = upload.selected_email_column_index;
        const resultsArray = JSON.parse(upload.results);

        // Create Map for O(1) email lookup
        const resultsMap = new Map(
            resultsArray.map(r => [r.email, { status: r.status, message: r.message }])
        );

        // Setup output stream
        const outputPath = path.join(__dirname, '../../uploads/results', `${request_id}_results.csv`);

        // Ensure results directory exists
        const resultsDir = path.dirname(outputPath);
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        const writeStream = fs.createWriteStream(outputPath);
        const readStream = fs.createReadStream(upload.file_path);

        let rowIndex = 0;

        // Stream original CSV and append status columns
        await new Promise((resolve, reject) => {
            Papa.parse(readStream, {
                header: false,  // Manual parsing to avoid dot issues
                step: (results) => {
                    const row = results.data;

                    if (rowIndex === 0 && hasHeader) {
                        // First row is header - append status column headers
                        row.push('email_status', 'status_message');
                    } else {
                        // Data row - get email from selected column
                        const email = row[emailColumnIndex];

                        // Lookup result for this email
                        const result = resultsMap.get(email) || {
                            status: '',
                            message: ''
                        };

                        // Append status columns
                        row.push(result.status, result.message);
                    }

                    // Write row to output CSV
                    writeStream.write(Papa.unparse([row]) + '\n');
                    rowIndex++;
                },
                complete: () => {
                    writeStream.end();
                    resolve();
                },
                error: reject
            });
        });

        return {
            filePath: outputPath,
            originalFilename: upload.original_filename
        };

    } catch (error) {
        throw error;
    }
}

// Download endpoint
app.get('/api/csv/download/:request_id', async (req, res) => {
    try {
        const { filePath, originalFilename } = await generateResultCSV(req.params.request_id);

        // Use original filename for download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## File Cleanup Strategy

```javascript
const cron = require('node-cron');

// Run daily cleanup for files older than 30 days
cron.schedule('0 0 * * *', async () => {
    try {
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        const oldUploads = await db.all(`
            SELECT request_id, file_path FROM csv_uploads
            WHERE created_at < ?
        `, [thirtyDaysAgo]);

        for (const upload of oldUploads) {
            // Delete original CSV file
            if (fs.existsSync(upload.file_path)) {
                fs.unlinkSync(upload.file_path);
            }

            // Delete result CSV file if exists
            const resultPath = path.join(
                __dirname,
                '../../uploads/results',
                `${upload.request_id}_results.csv`
            );
            if (fs.existsSync(resultPath)) {
                fs.unlinkSync(resultPath);
            }

            // Delete from database
            await db.run('DELETE FROM csv_uploads WHERE request_id = ?', [upload.request_id]);
        }

        console.log(`Cleaned up ${oldUploads.length} old CSV uploads`);
    } catch (error) {
        console.error('Cleanup error:', error);
    }
});
```

---

## Single Email Verification Integration

### How Single Email Requests Use the Same Architecture

The hybrid architecture seamlessly supports single email verification alongside CSV bulk verification:

```javascript
// Single email verification (same unified flow)
async function verifySingleEmail(email, userId) {
    try {
        // Generate verification request ID
        const verificationRequestId = uuidv4();

        // 1. Create verification request (same table as CSV)
        await db.run(`
            INSERT INTO verification_requests
            (verification_request_id, user_id, request_type, emails, status, created_at, updated_at)
            VALUES (?, ?, 'single', ?, 'pending', ?, ?)
        `, [verificationRequestId, userId, JSON.stringify([email]), Date.now(), Date.now()]);

        // 2. Add to queue (same queue as CSV)
        await queue.add({
            request_id: verificationRequestId,
            emails: [email],
            response_url: ''
        });

        // 3. Update status
        await db.run(`
            UPDATE verification_requests
            SET status = 'processing', updated_at = ?
            WHERE verification_request_id = ?
        `, [Date.now(), verificationRequestId]);

        return { success: true, verification_request_id: verificationRequestId };

    } catch (error) {
        throw error;
    }
}
```

### Unified Flow Comparison

```
Single Email:                    CSV Bulk:
     ↓                               ↓
Enter email                     Upload CSV
     ↓                               ↓
     |                          Detect column
     |                               ↓
     |                          User confirms
     |                               ↓
     └───────────────────────────────┘
                 ↓
       verification_requests table
         (unified storage)
                 ↓
           Queue processing
                 ↓
       Results stored in same table
                 ↓
         ┌──────┴──────┐
         ↓             ↓
   Show result    Download CSV
  (single page)   (with results)
```

### Benefits of Unified Approach

1. **Shared Code** - Same verification logic for single and CSV
2. **Unified History** - Both appear in same history list
3. **Consistent Results** - Same format for all verifications
4. **Easy Expansion** - Can add API bulk verification with minimal changes
5. **Simple Frontend** - Same status polling, same result display

---

## Summary of Decisions

| Aspect | Decision | Reason |
|--------|----------|--------|
| **Architecture** | Hybrid (2 tables) | Unified history + CSV metadata separation |
| **Verification table** | verification_requests | All request types (single, CSV, API) |
| **CSV metadata table** | csv_uploads | CSV-specific data only |
| **Request history** | Unified in verification_requests | Fast queries, no JOINs for history list |
| **Storage approach** | File system + DB | No database bloat, easy cleanup |
| **CSV parsing** | header: false (manual) | Avoids PapaParse issues with dots in headers |
| **Header handling** | hasHeader flag from frontend | Supports CSVs with/without headers |
| **Filename handling** | Store original, use UUID | Preserve user's filename for download |
| **Email regex** | RFC 5322 compliant | Supports +, ., and special chars |
| **Email detection** | Score-based with confidence | User confirms/selects before processing |
| **Email extraction** | Stream from disk | Memory efficient |
| **Queue integration** | Existing controller/queue | Reuse verified system |
| **Result storage** | verification_requests.results | Unified format for all request types |
| **Result generation** | JOIN + Stream + append | Combines metadata with results |
| **File cleanup** | 30-day retention | Automatic via cron job |
| **Limits** | 100MB, 100k rows, 100 cols | Performance constraints |

---

**Last Updated**: 2025-10-17
**Revision**: 6.0 - Hybrid architecture with unified verification_requests + csv_uploads for metadata, request history support
