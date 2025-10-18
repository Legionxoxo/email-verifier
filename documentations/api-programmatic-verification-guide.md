# API Programmatic Email Verification Guide

## Quick Start

Verify emails programmatically using your API key in just 3 steps:

1. **Get your API key** from the dashboard
2. **Send verification request** with your emails
3. **Get results** via webhook or polling

---

## Authentication

All API requests require an API key in the Authorization header:

```
Authorization: Bearer brndnv_sk_your_api_key_here
```

**How to get an API key:**
1. Log in to your dashboard
2. Go to Settings → API Keys
3. Click "Create Token"
4. Copy and save your API key (shown only once!)

---

## Endpoint

### Submit Email Verification

**Endpoint:** `POST /api/verifier/v1/verify`

**Headers:**
- `Authorization: Bearer brndnv_sk_your_api_key_here`
- `Content-Type: application/json`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `emails` | `string[]` | Yes | Array of email addresses to verify (1-10,000) |
| `responseUrl` | `string` | No | Webhook URL to receive results when complete |

**Example Request:**

```bash
curl -X POST https://your-domain.com/api/verifier/v1/verify \
  -H "Authorization: Bearer brndnv_sk_GyJUyjWFiF0tBti7aHWdIdEnJvMPxsBy" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      "user@example.com",
      "contact@company.com",
      "test@gmail.com"
    ],
    "responseUrl": "https://your-app.com/api/webhooks/email-results"
  }'
```

**Response (202 Accepted):**

```json
{
  "success": true,
  "message": "Verification request accepted",
  "data": {
    "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
    "total_emails": 3,
    "status": "processing",
    "response_url": "https://your-app.com/api/webhooks/email-results"
  }
}
```

**Save the `verification_request_id`** - you'll need it to check status or get results!

---

## Getting Results

You can get results in two ways:

### Option 1: Webhook (Recommended)

Provide a `responseUrl` in your request and we'll POST results to it when verification completes.

**Webhook Payload:**

```json
{
  "request_id": "api-550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "total_emails": 3,
  "completed_emails": 3,
  "results": [
    {
      "email": "user@example.com",
      "reachable": "yes",
      "syntax": {
        "username": "user",
        "domain": "example.com",
        "valid": true
      },
      "smtp": {
        "host_exists": true,
        "full_inbox": false,
        "catch_all": false,
        "deliverable": true,
        "disabled": false
      },
      "disposable": false,
      "role_account": false,
      "free": false,
      "has_mx_records": true
    }
  ],
  "timestamp": "2025-10-18T10:30:00.000Z"
}
```

**Webhook Features:**
- Automatic retries: 5 attempts with exponential backoff (2s, 4s, 6s, 8s, 10s)
- If all retries fail, results are still saved in our database
- You can poll for results as a fallback

### Option 2: Poll for Results

If you don't provide a `responseUrl`, or as a fallback if webhook fails, poll the results endpoint:

**Endpoint:** `GET /api/verifier/verification/{verification_request_id}/results`

**Headers:**
- `Authorization: Bearer brndnv_sk_your_api_key_here`

**Example Request:**

```bash
curl -X GET https://your-domain.com/api/verifier/verification/api-550e8400-e29b-41d4-a716-446655440000/results \
  -H "Authorization: Bearer brndnv_sk_GyJUyjWFiF0tBti7aHWdIdEnJvMPxsBy"
```

**While Processing (200 OK):**

```json
{
  "success": true,
  "data": {
    "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
    "request_type": "api",
    "status": "processing",
    "progress_step": "processing",
    "message": "Verification in progress. Poll this endpoint to get results when complete.",
    "created_at": 1729260000000,
    "updated_at": 1729260030000
  }
}
```

**When Complete (200 OK):**

```json
{
  "success": true,
  "data": {
    "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
    "request_type": "api",
    "status": "completed",
    "results": [
      {
        "email": "user@example.com",
        "status": "valid",
        "message": "Email verified successfully"
      },
      {
        "email": "contact@company.com",
        "status": "invalid",
        "message": "Email not deliverable"
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 3,
      "total_pages": 1,
      "has_more": false
    },
    "statistics": {
      "valid": 1,
      "invalid": 2,
      "catch_all": 0,
      "unknown": 0
    },
    "created_at": 1729260000000,
    "completed_at": 1729260120000
  }
}
```

**Key Points:**
- Same endpoint returns status while processing, results when complete
- Always returns 200 OK (not an error if still processing)
- Check `status` field: `"processing"` or `"completed"`
- Poll every 5-10 seconds until `status === "completed"`

---

## Pagination

For large result sets (>20 emails), results are paginated.

**Query Parameters:**
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 20, max: 100)

**Example:**

```bash
curl -X GET "https://your-domain.com/api/verifier/verification/api-550e8400-e29b-41d4-a716-446655440000/results?page=2&per_page=50" \
  -H "Authorization: Bearer brndnv_sk_GyJUyjWFiF0tBti7aHWdIdEnJvMPxsBy"
```

**Pagination Response:**

```json
{
  "pagination": {
    "page": 2,
    "per_page": 50,
    "total": 1000,
    "total_pages": 20,
    "has_more": true
  }
}
```

---

## Check Status Only

If you only want to check progress without fetching full results, use the status endpoint:

**Endpoint:** `GET /api/verifier/verification/{verification_request_id}/status`

**Headers:**
- `Authorization: Bearer brndnv_sk_your_api_key_here`

**Response:**

```json
{
  "success": true,
  "data": {
    "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
    "request_type": "api",
    "status": "processing",
    "progress_step": "antiGreyListing",
    "created_at": 1729260000000,
    "updated_at": 1729260030000
  }
}
```

**Progress Steps:**
- `received` - Request received and queued
- `processing` - Currently verifying emails
- `antiGreyListing` - Handling greylisting checks
- `complete` - Verification finished
- `failed` - Verification failed

---

## Result Fields Explained

### Email Status

| Status | Meaning |
|--------|---------|
| `valid` | Email exists and can receive mail |
| `invalid` | Email doesn't exist or can't receive mail |
| `catch-all` | Domain accepts all emails (can't verify specific address) |
| `unknown` | Verification couldn't be completed |

### Full Result Object

Each result contains detailed information:

```json
{
  "email": "user@example.com",
  "reachable": "yes",
  "syntax": {
    "username": "user",
    "domain": "example.com",
    "valid": true
  },
  "smtp": {
    "host_exists": true,
    "full_inbox": false,
    "catch_all": false,
    "deliverable": true,
    "disabled": false
  },
  "gravatar": null,
  "suggestion": "",
  "disposable": false,
  "role_account": false,
  "free": true,
  "has_mx_records": true,
  "mx": [
    {"Host": "mail.example.com", "Pref": 10}
  ]
}
```

**Field Descriptions:**

- `reachable` - Can the email receive messages? (`"yes"`, `"no"`, `"unknown"`)
- `syntax.valid` - Is the email format valid?
- `smtp.deliverable` - Can mail be delivered to this address?
- `smtp.catch_all` - Does the domain accept all emails?
- `smtp.full_inbox` - Is the mailbox full?
- `smtp.disabled` - Is the mailbox disabled?
- `disposable` - Is this a temporary/disposable email?
- `role_account` - Is this a role-based email (e.g., admin@, info@)?
- `free` - Is this a free email provider (Gmail, Yahoo, etc.)?
- `has_mx_records` - Does the domain have mail servers?
- `mx` - List of mail exchange servers

---

## Validation Rules

### Email Array

- **Required:** Yes
- **Type:** Array of strings
- **Min Length:** 1 email
- **Max Length:** 10,000 emails per request
- **Format:** Each email must be valid format (`user@domain.com`)

### Response URL

- **Required:** No (optional)
- **Type:** String
- **Format:** Valid HTTP or HTTPS URL
- **Example:** `https://your-app.com/webhooks/email-results`

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `202` | Request accepted and processing |
| `200` | Success (polling responses) |
| `400` | Bad request (validation failed) |
| `401` | Unauthorized (invalid API key) |
| `500` | Server error |

### Error Response Format

```json
{
  "success": false,
  "message": "Request validation failed",
  "errors": [
    "emails array cannot be empty",
    "Invalid email format at index 2: invalid-email"
  ]
}
```

### Common Errors

**Empty Emails Array:**
```json
{
  "success": false,
  "message": "Request validation failed",
  "errors": ["emails array cannot be empty"]
}
```

**Invalid Email Format:**
```json
{
  "success": false,
  "message": "Request validation failed",
  "errors": [
    "Invalid email format at index 0: not-an-email"
  ]
}
```

**Invalid API Key:**
```json
{
  "success": false,
  "message": "Invalid API key format"
}
```

**Missing API Key:**
```json
{
  "success": false,
  "message": "API key is required"
}
```

**Too Many Emails:**
```json
{
  "success": false,
  "message": "Request validation failed",
  "errors": ["Maximum 10,000 emails per request"]
}
```

---

## Best Practices

### 1. Always Save the Verification Request ID

```javascript
const response = await fetch('/api/verifier/v1/verify', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ emails, responseUrl })
});

const data = await response.json();

// Save this!
const verificationId = data.data.verification_request_id;
```

### 2. Implement Webhook Endpoint

```javascript
// Express.js example
app.post('/api/webhooks/email-results', (req, res) => {
  const { request_id, status, results } = req.body;

  if (status === 'completed') {
    // Process results
    results.forEach(result => {
      console.log(`${result.email}: ${result.status}`);
    });
  }

  // Respond quickly
  res.status(200).json({ received: true });
});
```

### 3. Implement Polling Fallback

```javascript
async function pollResults(verificationId, apiKey) {
  while (true) {
    const response = await fetch(
      `/api/verifier/verification/${verificationId}/results`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    const data = await response.json();

    if (data.data.status === 'completed') {
      return data.data.results;
    }

    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```

### 4. Handle Webhook Failures Gracefully

```javascript
// On webhook timeout or failure, poll for results
async function getResults(verificationId, apiKey) {
  // Wait for webhook (e.g., 2 minutes)
  const webhookReceived = await waitForWebhook(verificationId, 120000);

  if (!webhookReceived) {
    // Fallback to polling
    console.log('Webhook not received, polling for results...');
    return await pollResults(verificationId, apiKey);
  }
}
```

### 5. Batch Large Lists

For very large email lists, split into batches:

```javascript
const BATCH_SIZE = 1000;

async function verifyLargeList(emails, apiKey, responseUrl) {
  const batches = [];

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    batches.push(batch);
  }

  const requests = [];

  for (const batch of batches) {
    const response = await fetch('/api/verifier/v1/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emails: batch,
        responseUrl
      })
    });

    const data = await response.json();
    requests.push(data.data.verification_request_id);
  }

  return requests;
}
```

### 6. Secure Your API Key

**DO:**
- ✅ Store API keys in environment variables
- ✅ Use server-side code only (never expose in frontend)
- ✅ Rotate keys periodically
- ✅ Revoke compromised keys immediately

**DON'T:**
- ❌ Commit API keys to version control
- ❌ Share API keys in public channels
- ❌ Use API keys in client-side JavaScript
- ❌ Store API keys in plain text

```javascript
// Good - server-side with environment variable
const apiKey = process.env.EMAIL_VERIFIER_API_KEY;

// Bad - exposed in client-side code
const apiKey = 'brndnv_sk_GyJUyjWFiF0tBti7aHWdIdEnJvMPxsBy';
```

---

## Code Examples

### Node.js (Axios)

```javascript
const axios = require('axios');

async function verifyEmails(emails, responseUrl) {
  try {
    const response = await axios.post(
      'https://your-domain.com/api/verifier/v1/verify',
      {
        emails,
        responseUrl
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Verification started:', response.data);
    return response.data.data.verification_request_id;

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
const emails = ['user@example.com', 'test@gmail.com'];
const webhookUrl = 'https://myapp.com/webhooks/results';
const verificationId = await verifyEmails(emails, webhookUrl);
```

### Python (Requests)

```python
import requests
import os

def verify_emails(emails, response_url=None):
    url = 'https://your-domain.com/api/verifier/v1/verify'

    headers = {
        'Authorization': f"Bearer {os.getenv('API_KEY')}",
        'Content-Type': 'application/json'
    }

    payload = {'emails': emails}
    if response_url:
        payload['responseUrl'] = response_url

    response = requests.post(url, json=payload, headers=headers)

    if response.status_code == 202:
        data = response.json()
        print(f"Verification started: {data}")
        return data['data']['verification_request_id']
    else:
        print(f"Error: {response.json()}")
        raise Exception('Verification failed')

# Usage
emails = ['user@example.com', 'test@gmail.com']
webhook_url = 'https://myapp.com/webhooks/results'
verification_id = verify_emails(emails, webhook_url)
```

### PHP (cURL)

```php
<?php

function verifyEmails($emails, $responseUrl = null) {
    $url = 'https://your-domain.com/api/verifier/v1/verify';

    $payload = ['emails' => $emails];
    if ($responseUrl) {
        $payload['responseUrl'] = $responseUrl;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . getenv('API_KEY'),
        'Content-Type: application/json'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 202) {
        $data = json_decode($response, true);
        echo "Verification started: " . print_r($data, true);
        return $data['data']['verification_request_id'];
    } else {
        echo "Error: " . $response;
        throw new Exception('Verification failed');
    }
}

// Usage
$emails = ['user@example.com', 'test@gmail.com'];
$webhookUrl = 'https://myapp.com/webhooks/results';
$verificationId = verifyEmails($emails, $webhookUrl);
?>
```

### cURL (Command Line)

```bash
# Submit verification request
curl -X POST https://your-domain.com/api/verifier/v1/verify \
  -H "Authorization: Bearer brndnv_sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": ["user@example.com", "test@gmail.com"],
    "responseUrl": "https://myapp.com/webhooks/results"
  }'

# Poll for results
curl -X GET https://your-domain.com/api/verifier/verification/api-123456/results \
  -H "Authorization: Bearer brndnv_sk_your_api_key_here"
```

---

## FAQ

### How long does verification take?

- **Single email:** 1-5 seconds
- **Small batch (1-100):** 10-30 seconds
- **Large batch (1,000+):** 1-5 minutes
- **Maximum batch (10,000):** 5-10 minutes

Processing time varies based on server load and email provider response times.

### Can I verify more than 10,000 emails?

Yes! Submit multiple requests with different batches:

```javascript
// Split 50,000 emails into 5 batches of 10,000
const batches = chunkArray(emails, 10000);
const verificationIds = [];

for (const batch of batches) {
  const response = await submitVerification(batch, responseUrl);
  verificationIds.push(response.verification_request_id);
}
```

### What happens if my webhook endpoint is down?

- We retry 5 times with exponential backoff
- Results are always saved in our database
- You can poll the results endpoint as a fallback
- Results are stored permanently (never deleted)

### Can I use the same API key for multiple applications?

Yes, but we recommend creating separate API keys for each application:
- Easier to track usage
- Revoke access per application
- Better security

### How do I know if an email is safe to send to?

Check these fields in the result:
```javascript
if (result.smtp.deliverable &&
    !result.disposable &&
    !result.smtp.full_inbox &&
    !result.smtp.disabled) {
  // Safe to send
} else {
  // Don't send
}
```

### Are results cached?

No. Each verification performs real-time checks against the email server.

### What's the difference between 'catch-all' and 'valid'?

- **Valid:** Email definitely exists and can receive mail
- **Catch-all:** Domain accepts all emails, so we can't verify if this specific address exists

For catch-all domains, you may want to send with caution or use additional verification.

---

## Support

Need help? Contact us:
- **Email:** support@your-domain.com
- **Documentation:** https://docs.your-domain.com
- **Status Page:** https://status.your-domain.com

---

## Changelog

### Version 1.0.0 (2025-10-18)
- Initial release
- API key authentication
- Webhook delivery with retries
- Polling support
- Batch verification up to 10,000 emails
- Pagination support
