# API Programmatic Email Verification Guide

## Quick Start with Postman

The fastest way to get started is using our Postman collection:

1. Import the **email-verifier-postman-collection.json** file from the documentations folder into Postman
2. Update the collection variables with your base_url and api_key
3. Start testing immediately with pre-configured requests and examples

The Postman collection includes all endpoints with examples, automatic ID capture, and detailed descriptions.

---

## Getting Your API Key

1. Log in to your dashboard at localhost:5000 or your deployed URL
2. Navigate to Settings then API Keys
3. Click Create Token and give it a name
4. Copy your API key immediately (shown only once)

Your API key format: brndnv_sk_ followed by random characters

---

## Authentication

All API requests use Bearer token authentication. Include your API key in the Authorization header:

**Format:** Authorization: Bearer your_api_key_here

---

## API Endpoints

### Submit Email Verification

**Endpoint:** POST /api/verifier/v1/verify

**Headers:**
- Authorization: Bearer your_api_key
- Content-Type: application/json

**Request Body:**
- **emails** (required): Array of 1 to 10,000 email addresses
- **responseUrl** (optional): Your webhook URL to receive results automatically

**Example Request:**
```
{
  "emails": ["user@example.com", "test@gmail.com", "contact@company.com"],
  "responseUrl": "https://your-app.com/api/webhooks/email-results"
}
```

**Example Response (202 Accepted):**
```
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

**Important:** Save the verification_request_id from the response!

---

### Get Verification Status

**Endpoint:** GET /api/verifier/verification/{verification_request_id}/status

**Headers:**
- Authorization: Bearer your_api_key

**Example Response:**
```
{
  "success": true,
  "data": {
    "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
    "request_type": "api",
    "status": "processing",
    "progress_step": "processing",
    "created_at": 1729260000000,
    "updated_at": 1729260030000
  }
}
```

**Progress Steps:**
- received: queued for processing
- processing: currently verifying emails
- antiGreyListing: handling greylisting retries
- complete: verification finished
- failed: encountered error

---

### Get Verification Results

**Endpoint:** GET /api/verifier/verification/{verification_request_id}/results

**Headers:**
- Authorization: Bearer your_api_key

**Query Parameters:**
- page (optional): page number, default 1
- per_page (optional): results per page, default 20, max 100

**Example Response (While Processing):**
```
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

**Example Response (When Complete):**
```
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
        "message": "This is a valid email address!",
        "reachable": "yes",
        "smtp": {
          "host_exists": true,
          "full_inbox": false,
          "catch_all": false,
          "deliverable": true,
          "disabled": false
        },
        "disposable": false,
        "free": false,
        "has_mx_records": true
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
      "invalid": 0,
      "catch_all": 0,
      "unknown": 0
    },
    "created_at": 1729260000000,
    "completed_at": 1729260120000
  }
}
```

**Poll every 5-10 seconds** until status is completed

---

### Get Verification History

**Endpoint:** GET /api/verifier/history

**Headers:**
- Authorization: Bearer your_api_key

**Query Parameters:**
- page (optional): page number, default 1
- per_page (optional): results per page, default 50
- period (optional): this_month, last_month, or last_6_months

**Example Response:**
```
{
  "success": true,
  "data": {
    "history": [
      {
        "verification_request_id": "api-550e8400-e29b-41d4-a716-446655440000",
        "request_type": "api",
        "status": "completed",
        "total_emails": 100,
        "completed_emails": 100,
        "created_at": 1729260000000,
        "completed_at": 1729260120000,
        "list_name": null
      },
      {
        "verification_request_id": "api-123e4567-e89b-12d3-a456-426614174000",
        "request_type": "api",
        "status": "processing",
        "total_emails": 1000,
        "completed_emails": 450,
        "created_at": 1729259400000,
        "completed_at": null,
        "list_name": null
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 50,
      "total": 2,
      "total_pages": 1,
      "has_more": false
    }
  }
}
```

---

## Getting Results: Two Options

### Option 1: Webhook

Provide a responseUrl when submitting verification. Results will be automatically POST to your webhook when complete.

**Webhook Features:**
- Automatic retry: 5 attempts with exponential backoff
- Results saved even if webhook fails
- Can still poll as backup

### Option 2: Polling

If no webhook provided, poll the results endpoint every 5-10 seconds until status is completed.

---

## Email Status Types

**valid** - Email exists and can receive mail

**invalid** - Email doesn't exist or can't receive mail

**catch-all** - Domain accepts all emails, can't verify specific address

**unknown** - Verification couldn't be completed

---

## Result Fields

Each verified email includes:
- **email**: the address verified
- **status**: valid, invalid, catch-all, or unknown
- **message**: detailed reason for the status
- **reachable**: yes, no, or unknown
- **smtp**: mail server information (host_exists, full_inbox, catch_all, deliverable, disabled)
- **disposable**: temporary email service
- **role_account**: admin, info, support type addresses
- **free**: Gmail, Yahoo, Outlook, etc.
- **has_mx_records**: domain has mail servers configured

---

## Error Handling

**HTTP Status Codes:**
- 202 Accepted: verification request accepted
- 200 OK: success response
- 400 Bad Request: validation failed
- 401 Unauthorized: invalid or missing API key
- 500 Internal Server Error: server error

**Common Errors:**
- Empty emails array
- Invalid email format
- Too many emails (over 10,000)
- Invalid or missing API key
- Expired or revoked key
- Invalid webhook URL

---

## Best Practices

**Save the verification_request_id** from every submit request

**Use webhooks** for automatic result delivery instead of constant polling

**Implement polling fallback** in case webhook endpoint is down

**Batch large lists** into chunks of 1,000-5,000 emails for better tracking

**Secure API keys** in environment variables, never in code or frontend

**Handle errors gracefully** with user-friendly messages and retry logic

**Monitor usage** through the history endpoint

---

## Limits and Timing

**Request Limits:**
- Minimum: 1 email per request
- Maximum: 10,000 emails per request

**Verification Time:**
- Single email: 1-5 seconds
- Small batch (1-100): 10-30 seconds
- Large batch (1,000+): 1-5 minutes
- Maximum batch (10,000): 5-10 minutes

**For lists over 10,000:** Split into multiple requests

---

## FAQ

**Q: What if my webhook is down?**
Results are always saved. Retrieve via polling anytime.

**Q: Can I check old verifications?**
Yes, results stored permanently. Use history endpoint to find IDs.

**Q: Do results get cached?**
No, real-time checks every time for accurate results.

**Q: What's the difference between catch-all and valid?**
Valid means confirmed mailbox exists. Catch-all means domain accepts everything, so specific address can't be verified.

**Q: Why do some take longer?**
Greylisting, slow mail servers, or network issues can add delays.

---

## Quick Testing with Postman

Import our Postman collection for instant testing:
- Pre-configured endpoints with examples
- Automatic verification_request_id capture
- Variable management for easy testing
- Response examples for all scenarios

**Location:** documentations/email-verifier-postman-collection.json

---

## Support

Use the Postman collection for quick testing and debugging. Check error messages in responses for troubleshooting. Review verification history for patterns. All endpoints require Bearer token authentication with your API key.
