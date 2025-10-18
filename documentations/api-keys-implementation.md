# API Key Management Implementation Documentation

## Overview

This document outlines the complete implementation specification for the API Key Management system. API keys allow users to authenticate programmatically for API-based email verification requests.

---

## Core Concepts

### What are API Keys?

API keys are long-lived authentication tokens that users can create to access the email verification API programmatically. Unlike JWT access tokens (which expire in 2 hours), API keys can be configured with custom expiry dates or set to never expire.

### Key Differences from Auth Tokens

- **Purpose**: API keys are for programmatic API access; auth tokens are for user session management
- **Format**: API keys use custom prefix format (brdnv_sk_*); auth tokens are standard JWTs
- **Lifespan**: API keys can be long-lived or permanent; auth tokens are short-lived
- **Storage**: API keys are hashed with bcrypt; JWTs are stored as-is in auth_tokens table
- **Table**: API keys stored in dedicated api_keys table; auth tokens in auth_tokens table

---

## API Key Format

### Structure

The API key follows this format:

PREFIX + RANDOM_STRING

Where:
- PREFIX: brndnv_sk_
- RANDOM_STRING: 32 alphanumeric characters (a-z, A-Z, 0-9)

### Example

brndnv_sk_a7b3c9d2e5f1g8h4i6j0k2l5m9n3o7p1

### Total Length

Prefix length: 10 characters
Random string length: 32 characters
Total: 42 characters

---

## Database Schema

### New Table: api_keys

This table stores all API keys for users.

#### Columns

**id**
- Type: INTEGER
- Primary Key: Yes
- Auto Increment: Yes
- Description: Unique identifier for each API key

**user_id**
- Type: INTEGER
- Foreign Key: users(id)
- Nullable: No
- On Delete: CASCADE
- Description: References the user who owns this API key

**name**
- Type: TEXT
- Nullable: No
- Description: User-provided descriptive name for the API key (e.g., "Production Server", "Testing Environment")
- Notes: Does NOT need to be unique per user

**key_hash**
- Type: TEXT
- Nullable: No
- Description: Bcrypt hashed version of the full API key (never store plain text)
- Security: Use bcrypt with salt rounds of 10 or higher

**key_prefix**
- Type: TEXT
- Nullable: No
- Description: First 12 characters of the API key for display purposes (e.g., "brdnv_sk_a7b")
- Used for: Showing masked version to users in the list view

**expires_at**
- Type: DATETIME
- Nullable: Yes (NULL means never expires)
- Description: Timestamp when the API key will expire and become invalid

**is_revoked**
- Type: BOOLEAN
- Default: 0
- Description: Flag indicating if the key has been manually revoked by user

**last_used**
- Type: DATETIME
- Nullable: Yes
- Default: NULL
- Description: Timestamp of when this API key was last successfully used for authentication

**created_at**
- Type: DATETIME
- Default: CURRENT_TIMESTAMP
- Description: Timestamp when the API key was created

**revoked_at**
- Type: DATETIME
- Default: CURRENT_TIMESTAMP
- Description: Timestamp when the API key was revoked

#### Indexes

Create the following indexes for query performance:

- idx_api_keys_user_id: ON api_keys(user_id)
- idx_api_keys_key_hash: ON api_keys(key_hash)
- idx_api_keys_revoked: ON api_keys(user_id, is_revoked)

#### Schema Migration

Add this table creation to the database/connection.js file in the createTables function.

---

## API Endpoints

### 1. Create API Key

**Endpoint**: POST /api/api-keys/create

**Authentication**: Required (JWT access token)

**Request Body**:
- name (string, required): Descriptive name for the API key
- expiryDays (number, optional): Number of days until expiry (omit for no expiry)

**Request Example**:

name: "Production API"
expiryDays: 30

**Validation Rules**:
- name must be non-empty string, trimmed, max 100 characters
- expiryDays must be positive integer if provided
- User cannot have more than 10 active (non-revoked) API keys

**Process Flow**:

1. Validate user is authenticated
2. Validate request body (name required, expiryDays optional)
3. Check user's active API key count (must be less than 10)
4. Generate random 32-character string using crypto.randomBytes
5. Create full API key: brdnv_sk_ + random_string
6. Hash the full API key using bcrypt (salt rounds: 10)
7. Extract first 12 characters as key_prefix
8. Calculate expires_at if expiryDays provided (NULL if not provided)
9. Insert record into api_keys table with hashed key
10. Return response with FULL PLAIN-TEXT API key

**Response Success (201)**:

success: true
message: "API key created successfully"
data:
  apiKey: "brdnv_sk_a7b3c9d2e5f1g8h4i6j0k2l5m9n3o7p1" (full plain text)
  keyData:
    id: 123
    name: "Production API"
    key_prefix: "brdnv_sk_a7b"
    expires_at: "2025-11-17T10:30:00.000Z" (or null)
    created_at: "2025-10-18T10:30:00.000Z"

**Response Errors**:

400 Bad Request: Invalid input (missing name, invalid expiryDays)
401 Unauthorized: User not authenticated
403 Forbidden: User has reached maximum API key limit (10 keys)
500 Internal Server Error: Database or server error

**Important Notes**:
- The full plain-text API key is ONLY returned in this response
- User must copy and save it immediately
- After this response, only the hashed version exists in database
- Frontend should display a prominent warning to save the key

---

### 2. List API Keys

**Endpoint**: GET /api/api-keys

**Authentication**: Required (JWT access token)

**Query Parameters**: None

**Process Flow**:

1. Validate user is authenticated
2. Query api_keys table for all keys belonging to user_id
3. Order by created_at DESC (newest first)
4. For each key, construct masked version from key_prefix
5. Return list with masked keys and metadata

**Masked Key Format**:

From key_prefix (first 12 chars) create:
- First 12 characters + "***" + last 3 characters placeholder

Example: "brdnv_sk_a7b***xyz"

Note: We don't know the actual last 3 characters (since we only store hash), so use generic "xyz" or similar placeholder.

**Response Success (200)**:

success: true
data:
  apiKeys: [
    {
      id: 123
      name: "Production API"
      key_masked: "brdnv_sk_a7b***xyz"
      expires_at: "2025-11-17T10:30:00.000Z" (or null)
      is_revoked: false
      last_used: "2025-10-18T08:15:00.000Z" (or null)
      created_at: "2025-10-18T10:30:00.000Z"
    },
    {
      id: 122
      name: "Testing Environment"
      key_masked: "brdnv_sk_x9y***xyz"
      expires_at: null
      is_revoked: false
      last_used: null
      created_at: "2025-10-17T14:20:00.000Z"
    }
  ]

**Response Errors**:

401 Unauthorized: User not authenticated
500 Internal Server Error: Database or server error

---

### 3. Revoke API Key

**Endpoint**: DELETE /api/api-keys/:id/revoke

**Authentication**: Required (JWT access token)

**URL Parameters**:
- id (number): The API key ID to revoke

**Process Flow**:

1. Validate user is authenticated
2. Validate id parameter is valid integer
3. Verify API key exists and belongs to authenticated user
4. Set is_revoked = 1 for the API key
5. Return success response

**Response Success (200)**:

success: true
message: "API key revoked successfully"
data:
  id: 123
  name: "Production API"
  revoked_at: "2025-10-18T11:00:00.000Z"

**Response Errors**:

400 Bad Request: Invalid API key ID
401 Unauthorized: User not authenticated
403 Forbidden: API key does not belong to authenticated user
404 Not Found: API key does not exist
500 Internal Server Error: Database or server error

**Important Notes**:
- Revocation is permanent and cannot be undone
- Revoked keys remain in database for audit purposes
- Frontend should show confirmation dialog before revoking

---

## Security Considerations

### API Key Generation

**Randomness**:
- Use Node.js crypto.randomBytes for cryptographically secure random generation
- Generate at least 32 bytes, convert to alphanumeric string
- Avoid predictable patterns or sequences

**Hashing**:
- Use bcrypt with minimum 10 salt rounds
- Never store plain-text API keys in database
- Hash before any database operation

### API Key Validation

**When validating an API key**:

1. Extract API key from Authorization header (Bearer token)
2. Verify format matches: brdnv_sk_ + 32 characters
3. Query database for ALL active API keys for potential users
4. Use bcrypt.compare to check if provided key matches any hash
5. Verify key is not revoked (is_revoked = 0)
6. Verify key has not expired (expires_at > now OR expires_at IS NULL)
7. Update last_used timestamp
8. Attach user_id to request object for downstream use


### Audit Trail

**Track the following events**:
- API key creation (user_id, name, created_at)
- API key usage (key_id, last_used, endpoint accessed)
- API key revocation (user_id, key_id, revoked_at)

---

## Frontend Integration

### Create API Key Flow

1. User clicks "Create Token" button
2. Form appears with name input and optional expiry input
3. User fills form and clicks "Create"
4. Frontend calls POST /api/api-keys/create
5. Backend returns full plain-text API key
6. Frontend displays API key in copyable format with warning
7. User copies API key
8. User clicks "Close" to dismiss
9. New API key appears in list (masked)

### List API Keys Flow

1. On page load, call GET /api/api-keys
2. Display list of API keys with masked versions
3. Show metadata: name, created date, expiry date, last used
4. Each key has "Revoke" button

### Revoke API Key Flow

1. User clicks "Revoke" button on specific key
2. Show confirmation dialog: "Are you sure? This cannot be undone."
3. If confirmed, call DELETE /api/api-keys/:id/revoke
4. Remove key from list on success
5. Show success toast notification

### Display Formats

**Date Formatting**:
- Absolute: "Oct 18, 2025"
- Relative for last_used: "2h ago", "5m ago", "3d ago", "Never"

**Expiry Badge**:
- If expires_at exists: Show blue badge "Expires Oct 18, 2025"
- If expires_at is null: No badge or "Never expires"

**Last Used**:
- Show relative time: "Last used 2h ago"
- If null: "Never used"

---

## File Structure

### Backend Files to Create/Modify

**New Files**:

functions/route_fns/api-keys/create.js
- Handles API key creation logic
- Exports: handleCreateApiKey function

functions/route_fns/api-keys/list.js
- Handles listing user's API keys
- Exports: handleListApiKeys function

functions/route_fns/api-keys/revoke.js
- Handles API key revocation logic
- Exports: handleRevokeApiKey function

functions/utils/apikey.js
- API key generation utility
- API key hashing utility
- API key validation utility
- Exports: generateApiKey, hashApiKey, validateApiKeyFormat

routes/api/api-keys.js
- Express router for API key endpoints
- Registers all three endpoints
- Applies authentication middleware

**Modified Files**:

database/connection.js
- Add api_keys table creation in createTables function
- Add indexes for api_keys table

functions/middleware/auth.js (potentially)
- Add API key authentication middleware
- Check Authorization header for API key format
- Validate and authenticate API key

---

## Validation Rules

### API Key Name

- Required: Yes
- Type: String
- Min Length: 1 character (after trim)
- Max Length: 100 characters
- Allowed Characters: Any (letters, numbers, spaces, symbols)
- Trim: Yes (remove leading/trailing whitespace)

### Expiry Days

- Required: No
- Type: Number (integer)
- Min Value: 1 day
- Max Value: 365 days (1 year)
- Default: null (never expires)

### Maximum Active Keys

- Limit: 10 active (non-revoked) keys per user
- Count Query: SELECT COUNT(*) WHERE user_id = ? AND is_revoked = 0

---

## Error Handling

### All Endpoints Use Try-Catch-Finally

Each route function should:
- Wrap logic in try block
- Catch errors and log them
- Return appropriate HTTP status codes
- Use finally for cleanup/logging

### User-Friendly Error Messages

Map technical errors to user-friendly messages:

- Database errors: "Failed to create API key. Please try again."
- Validation errors: "Invalid input. Please check your details."
- Limit exceeded: "You have reached the maximum limit of 10 API keys. Please revoke an existing key before creating a new one."
- Not found: "API key not found or already revoked."
- Unauthorized: "Authentication required. Please log in."

---

## Testing Requirements

### Unit Tests

Test the following functions in isolation:

**generateApiKey**:
- Returns string with correct format
- Returns unique values on multiple calls
- Length is exactly 42 characters
- Prefix is always "brdnv_sk_"

**hashApiKey**:
- Returns bcrypt hash
- Hash is different from plain text
- Same input produces different hashes (due to salt)

**validateApiKeyFormat**:
- Accepts valid format
- Rejects invalid prefixes
- Rejects incorrect lengths
- Rejects non-alphanumeric characters

### Integration Tests

Test the following API flows:

**Create API Key**:
- Success with name only (no expiry)
- Success with name and expiry
- Fail when name is missing
- Fail when user has 10 active keys
- Fail when not authenticated

**List API Keys**:
- Returns empty array when user has no keys
- Returns correct masked keys
- Returns keys in correct order (newest first)
- Fail when not authenticated

**Revoke API Key**:
- Success when revoking own key
- Fail when revoking another user's key
- Fail when key doesn't exist
- Fail when not authenticated

---

## Future Enhancements

### Potential Features for Later

**API Key Scopes/Permissions**:
- Allow users to create keys with limited permissions
- Example: read-only keys, specific endpoint access

**Usage Analytics**:
- Track number of requests per API key
- Show usage graphs and statistics
- Alert users of unusual activity

**Auto-Expiry Warnings**:
- Email users before API key expires
- Option to extend expiry before expiration

**API Key Rotation**:
- Allow users to rotate keys without revocation
- Generate new key, keep old one valid for grace period

**Team/Organization Keys**:
- Share API keys across team members
- Different permission levels per team member

---

## Implementation Checklist

Before marking this feature as complete, ensure:

Database:
- api_keys table created with all columns
- Indexes created for performance
- Foreign key constraint to users table working

Backend:
- All three endpoints implemented and tested
- API key generation using crypto.randomBytes
- API key hashing using bcrypt
- Validation for all inputs
- Error handling with try-catch-finally
- User-friendly error messages
- TypeScript type checking passes (tsc --noEmit)

Frontend:
- Create API key form working
- List API keys displaying correctly
- Masked keys showing properly
- Revoke functionality with confirmation
- Copy to clipboard working
- Warning message for saving new key
- User-friendly error messages

Security:
- Plain-text API keys never stored in database
- Bcrypt hashing implemented correctly
- Maximum key limit enforced (10 keys)
- Authorization middleware on all endpoints
- User can only access/revoke their own keys

Testing:
- Unit tests for utility functions
- Integration tests for all endpoints
- Manual testing of complete user flow
- Error scenarios tested

Documentation:
- This documentation file completed
- Code comments in all new files
- JSDoc annotations for type checking

---

## Notes

This implementation provides a solid foundation for API key management. The system prioritizes security (hashing, revocation, expiry) while maintaining good user experience (naming, masked display, last used tracking).

The 10 key limit prevents abuse while being generous enough for most use cases. This can be adjusted based on user feedback and usage patterns.

The last_used timestamp is valuable for security monitoring and identifying unused keys, with minimal performance impact.
