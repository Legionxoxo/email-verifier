# Razorpay Payment Gateway Integration - Bulletproof Technical Architecture Plan v2.0

## Executive Summary

This document outlines the comprehensive, security-first technical architecture for integrating Razorpay payment gateway with subscription management capabilities into the existing MicroSaaS template. This updated plan addresses critical security vulnerabilities, performance optimizations, accessibility requirements, and aligns with current Razorpay API standards (2025).

**Key Improvements in v2.0:**
- Current Razorpay API v2 integration patterns
- Enhanced security with zero-trust architecture
- Mobile-first responsive design
- WCAG 2.1 AA accessibility compliance
- Comprehensive error handling and user experience
- Performance optimization with caching strategies
- Real-time monitoring and alerting
- Production-ready deployment procedures

## 🎯 Project Requirements Analysis

**⚠️ CRITICAL IMPLEMENTATION SCOPE LIMITATION:**

**THIS IMPLEMENTATION IS STRICTLY LIMITED TO PAYMENT SYSTEM ONLY. NO FEATURE IMPLEMENTATION OR ACCESS CONTROL LOGIC SHALL BE BUILT.**

The subscription plan features mentioned in this document (projects, API calls, storage, users, etc.) are **DATABASE PLACEHOLDERS ONLY** for future implementation. The current scope includes:

✅ **Payment System Implementation:**
- Subscription plan selection and payment processing
- Database entries tracking user's current plan
- Payment status tracking (paid, failed, cancelled, halted)
- Billing cycle management and due date tracking
- Plan upgrade/downgrade with payment processing

❌ **Explicitly EXCLUDED from this implementation:**
- Feature access control or enforcement
- Usage limit checking or blocking
- Plan-based UI/UX restrictions
- Any business logic based on subscription status
- Feature flags or permission systems

**The user's subscription status will be stored in the database as a foundation for future feature implementation decisions.**

## 💰 Prorated Billing Mechanics for Plan Changes

### Mid-Cycle Plan Upgrade (e.g., Free → Pro or Pro → Plus)

**When user upgrades on day 15 of 30-day cycle:**

1. **Calculate Remaining Period**: 15 days remaining in current cycle
2. **Calculate Prorated Amount**: 
   - New plan price × (remaining days / total days in cycle)
   - Example: Pro (₹999) → Plus (₹1,999)
   - Difference: ₹1,000 × (15/30) = ₹500 prorated charge
3. **Immediate Payment**: User pays ₹500 immediately for upgrade
4. **Next Billing Cycle**: Full ₹1,999 charged on original billing date
5. **Database Updates**:
   - `plan_id` updated to new plan
   - `proration_amount` set to ₹500
   - `current_period_end` remains unchanged
   - Create transaction record with type 'subscription' and prorated amount

### Mid-Cycle Plan Downgrade (e.g., Plus → Pro only)

**When user downgrades on day 15 of 30-day cycle:**

1. **Calculate Remaining Period**: 15 days remaining in current cycle
2. **Calculate Prorated Credit**: 
   - Price difference × (remaining days / total days in cycle)
   - Example: Plus (₹1,999) → Pro (₹999)
   - Credit: ₹1,000 × (15/30) = ₹500 credit
3. **Credit Handling**:
   - **Account credit applied to next billing cycle**
   - Next bill: Pro plan (₹999) - ₹500 credit = ₹499 charged
   - If credit exceeds next bill amount, carry forward remaining credit
4. **Effective Date**: 
   - **Immediate**: Plan changes immediately, user gets account credit
5. **Database Updates**:
   - `plan_id` updated to new plan immediately
   - `proration_amount` set to -₹500 (negative for credit)
   - Create transaction record with type 'adjustment' for credit
6. **Frontend Message**:
   - "Your plan has been downgraded to Pro immediately. You have ₹500 account credit that will be applied to your next billing cycle on [date]. Your next bill will be ₹499 instead of ₹999."

### Free Plan and Cancellation Policy

**Upgrading from Free:**
- No proration needed (Free = ₹0)
- Immediate charge for full prorated amount of paid plan
- Start trial period if applicable (Pro: 14 days, Plus: 30 days)

**Downgrading to Free - NOT ALLOWED:**
- **Policy**: Direct downgrade to Free plan is not permitted
- **Reason**: Prevents perpetual account credits with no billing cycle
- **Alternative**: Users must cancel their subscription instead

**Plan Cancellation (Alternative to Free Downgrade):**
- **Immediate Effect**: Recurring billing stops, no future charges
- **Plan Access**: Current paid plan remains active until period end
- **No Refunds**: No prorated refunds for current cycle
- **Post-Expiry**: User automatically moves to Free plan when paid period expires
- **Database Updates**:
  - `status` set to 'cancelled'
  - `cancel_at_period_end` set to true
  - `cancelled_at` timestamp recorded
  - `next_billing_date` set to null
- **Frontend Message**:
  - "Your [Plan Name] subscription has been cancelled. You'll continue to have [Plan Name] access until [current period end date], after which you'll be moved to the Free plan. You will not be charged for the next billing cycle."

### Implementation Strategy

**Backend Logic:**
```javascript
// Pseudo-code for plan change calculation
function calculatePlanChange(currentPlan, newPlan, daysRemaining, totalDays) {
    const priceDifference = newPlan.priceMonthly - currentPlan.priceMonthly;
    const proratedAmount = (priceDifference * daysRemaining) / totalDays;
    
    return {
        proratedAmount: Math.round(proratedAmount), // in paise
        isUpgrade: priceDifference > 0,
        requiresPayment: proratedAmount > 0,
        creditAmount: proratedAmount < 0 ? Math.abs(proratedAmount) : 0
    };
}
```

**Razorpay Integration:**
- Use Razorpay's `subscription.update()` for plan changes
- Create separate payment for prorated amounts
- Handle credits through Razorpay refunds or account credits

**User Experience:**
- Show exact prorated amount before confirmation
- Clear explanation of next billing amount and date
- Email confirmation with proration details and updated billing schedule
- **Downgrade restrictions**: UI should only show valid downgrade options (Plus→Pro, not Pro→Free)
- **Cancellation vs Downgrade**: Clear distinction in UI between "Cancel Subscription" and "Change Plan"

### Core Payment Features (Enhanced)
- **Payment Gateway**: Razorpay v2 API integration with all supported payment methods including UPI, cards, netbanking, wallets
- **Subscription Management**: Plan selection, recurring payments, cancellation, pause/resume, plan upgrades/downgrades
- **Payment Method Management**: Add, update, remove, set default payment methods with tokenization
- **Invoice Management**: Generate, store, email, and download invoices with GST compliance
- **Purchase History**: Complete transaction history with advanced filtering, search, and export
- **Billing Address**: International address support with validation
- **Prorated Billing**: Handle mid-cycle plan changes with accurate prorating (see detailed mechanics below)
- **Payment Retries**: Automatic retry mechanism for failed payments
- **Multi-currency Support**: Support for INR, USD, EUR with automatic conversion
- **Tax Management**: GST calculation and compliance for Indian customers

### Technical Constraints (Updated)
- **Deployment**: Windows PC with planned webhook support via ngrok/localtunnel
- **UI Consistency**: Notion-style design with enhanced accessibility
- **Architecture**: Functional programming with comprehensive error boundaries
- **Database**: SQLite3 with SQLCipher encryption for production
- **Frontend**: React 18+ with Suspense, concurrent features, and error boundaries
- **Security**: PCI DSS Level 1 compliance requirements
- **Performance**: <500ms API response times, <2s page load times
- **Accessibility**: WCAG 2.1 AA compliance mandatory

## 🏗️ Enhanced Technical Architecture

### Technology Stack Integration (Updated)

**Backend Dependencies**
```json
{
  "razorpay": "^2.9.2",
  "sqlcipher": "^5.1.6",
  "pdfkit": "^0.14.0",
  "nodemailer": "^6.9.7",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "express-validator": "^7.0.1",
  "winston": "^3.11.0",
  "compression": "^1.7.4",
  "cors": "^2.8.5"
}
```

**Frontend Dependencies**
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.8.0",
  "@radix-ui/react-dialog": "^1.0.5",
  "@radix-ui/react-select": "^2.0.0",
  "react-hook-form": "^7.48.2",
  "zod": "^3.22.4",
  "react-query": "^4.35.3",
  "react-error-boundary": "^4.0.11"
}
```

**Security Enhancements**
- **API Key Rotation**: Automated key rotation strategy
- **Data Encryption**: AES-256 encryption for all sensitive data
- **Zero-Trust Architecture**: Every request validated and authorized
- **Audit Logging**: Comprehensive audit trail with tamper detection
- **Rate Limiting**: Intelligent rate limiting with user behavior analysis
- **CSRF Protection**: Double-submit cookie pattern implementation
- **XSS Protection**: Content Security Policy with nonce-based protection

## 📊 Enhanced Database Schema Design

### Production-Ready Database Schema

```sql
-- Enable foreign key constraints and WAL mode for better performance
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;

-- Subscription Plans Table (Enhanced)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_code TEXT NOT NULL UNIQUE, -- Internal plan identifier
    name TEXT NOT NULL,
    description TEXT,
    tagline TEXT, -- Marketing tagline
    price_monthly INTEGER NOT NULL, -- Price in paise (Razorpay format)
    price_yearly INTEGER, -- Optional yearly pricing with discount
    price_currency TEXT DEFAULT 'INR',
    features TEXT NOT NULL, -- JSON string of features with detailed descriptions
    limits_json TEXT, -- JSON string of usage limits (API calls, storage, etc.)
    trial_days INTEGER DEFAULT 0, -- Free trial period in days
    is_active BOOLEAN DEFAULT 1,
    is_featured BOOLEAN DEFAULT 0, -- Featured plan for marketing
    display_order INTEGER DEFAULT 0, -- Order for display in UI
    razorpay_plan_id TEXT UNIQUE, -- Razorpay plan identifier
    stripe_plan_id TEXT, -- Future Stripe integration
    metadata_json TEXT, -- Additional plan metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (price_monthly > 0),
    CHECK (price_yearly IS NULL OR price_yearly > 0),
    CHECK (trial_days >= 0)
);

-- User Subscriptions Table (Enhanced)
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    razorpay_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('created', 'authenticated', 'active', 'past_due', 'cancelled', 'completed', 'paused', 'halted')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
    current_period_start DATETIME NOT NULL,
    current_period_end DATETIME NOT NULL,
    trial_start DATETIME,
    trial_end DATETIME,
    cancel_at_period_end BOOLEAN DEFAULT 0,
    cancelled_at DATETIME NULL,
    cancellation_reason TEXT,
    pause_count INTEGER DEFAULT 0, -- Track number of times paused
    paused_at DATETIME NULL,
    resume_at DATETIME NULL,
    next_billing_date DATETIME,
    proration_amount INTEGER DEFAULT 0, -- Amount for prorated charges in paise
    discount_amount INTEGER DEFAULT 0, -- Discount applied in paise
    tax_amount INTEGER DEFAULT 0, -- Tax amount in paise
    total_amount INTEGER NOT NULL, -- Total subscription amount in paise
    auto_renewal BOOLEAN DEFAULT 1,
    grace_period_days INTEGER DEFAULT 3,
    failed_payment_count INTEGER DEFAULT 0,
    last_payment_attempt DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
    
    -- Constraints
    CHECK (current_period_end > current_period_start),
    CHECK (trial_end IS NULL OR trial_end > trial_start),
    CHECK (total_amount >= 0),
    CHECK (pause_count >= 0),
    CHECK (failed_payment_count >= 0)
);

-- Payment Methods Table (Enhanced with Tokenization)
CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    razorpay_payment_method_id TEXT UNIQUE,
    razorpay_token_id TEXT UNIQUE, -- Tokenized payment method
    type TEXT NOT NULL CHECK (type IN ('card', 'upi', 'netbanking', 'wallet', 'bank_transfer', 'emi')),
    sub_type TEXT, -- Visa, Mastercard, HDFC, Paytm, etc.
    last_four TEXT, -- Last 4 digits for cards or identifier for other methods
    brand TEXT, -- Card brand or service provider
    issuer TEXT, -- Issuing bank or service
    expiry_month INTEGER,
    expiry_year INTEGER,
    holder_name TEXT, -- Account/card holder name
    is_default BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0, -- Verified through micro-transaction
    verification_amount INTEGER, -- Micro-transaction amount for verification
    failure_count INTEGER DEFAULT 0, -- Track payment failures
    last_used_at DATETIME,
    expires_at DATETIME, -- Token expiration
    metadata_json TEXT, -- Additional payment method metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- Constraints
    CHECK (failure_count >= 0),
    CHECK (expiry_month IS NULL OR (expiry_month >= 1 AND expiry_month <= 12)),
    CHECK (expiry_year IS NULL OR expiry_year >= date('now', '%Y'))
);

-- Billing Addresses Table (Enhanced with International Support)
CREATE TABLE IF NOT EXISTS billing_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    address_type TEXT DEFAULT 'billing' CHECK (address_type IN ('billing', 'shipping')),
    company_name TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    line1 TEXT NOT NULL,
    line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'IN',
    zip_code TEXT NOT NULL,
    phone TEXT,
    tax_id TEXT, -- GST number or tax identifier
    is_default BOOLEAN DEFAULT 0,
    is_verified BOOLEAN DEFAULT 0, -- Address verification status
    latitude REAL,
    longitude REAL,
    timezone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- Constraints
    CHECK (length(zip_code) >= 3),
    CHECK (length(country) = 2), -- ISO country code
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

-- Payment Transactions Table (Enhanced with Detailed Tracking)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_order_id TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('subscription', 'addon', 'refund', 'adjustment', 'fee')) DEFAULT 'subscription',
    amount INTEGER NOT NULL, -- Amount in paise
    tax_amount INTEGER DEFAULT 0, -- Tax amount in paise
    discount_amount INTEGER DEFAULT 0, -- Discount amount in paise
    fee_amount INTEGER DEFAULT 0, -- Processing fee in paise
    net_amount INTEGER NOT NULL, -- Net amount after taxes and fees
    currency TEXT DEFAULT 'INR',
    exchange_rate REAL DEFAULT 1.0, -- For multi-currency support
    status TEXT NOT NULL CHECK (status IN ('created', 'authorized', 'captured', 'refunded', 'failed', 'cancelled')),
    gateway_status TEXT, -- Raw status from Razorpay
    method TEXT, -- Payment method used (card, upi, netbanking, etc.)
    method_details_json TEXT, -- Detailed payment method information
    description TEXT,
    receipt_number TEXT UNIQUE,
    invoice_id TEXT, -- Link to invoice system
    failure_reason TEXT,
    failure_code TEXT,
    gateway_response_json TEXT, -- Full gateway response for debugging
    retry_count INTEGER DEFAULT 0,
    parent_transaction_id INTEGER, -- For refunds and adjustments
    processed_at DATETIME,
    settled_at DATETIME,
    refunded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id),
    FOREIGN KEY (parent_transaction_id) REFERENCES payment_transactions (id),
    
    -- Constraints
    CHECK (amount > 0 OR transaction_type = 'refund'),
    CHECK (net_amount >= 0 OR transaction_type = 'refund'),
    CHECK (retry_count >= 0),
    CHECK (exchange_rate > 0)
);

-- Invoices Table (Enhanced with GST Compliance)
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subscription_id INTEGER,
    transaction_id INTEGER,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('subscription', 'prorated', 'refund', 'adjustment')) DEFAULT 'subscription',
    razorpay_invoice_id TEXT UNIQUE,
    series_prefix TEXT DEFAULT 'INV', -- Invoice series prefix
    financial_year TEXT, -- e.g., "2024-25"
    amount INTEGER NOT NULL, -- Amount in paise
    discount_amount INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 0.18, -- GST rate (18% default)
    tax_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL, -- Total amount including tax
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded')),
    payment_terms TEXT DEFAULT 'Due on receipt',
    due_date DATETIME,
    issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_date DATETIME,
    viewed_date DATETIME,
    paid_date DATETIME,
    reminder_count INTEGER DEFAULT 0,
    last_reminder_date DATETIME,
    file_path TEXT, -- Local file path for PDF
    file_size INTEGER, -- File size in bytes
    download_count INTEGER DEFAULT 0,
    email_sent BOOLEAN DEFAULT 0,
    email_opened BOOLEAN DEFAULT 0,
    notes TEXT, -- Internal notes
    terms_conditions TEXT, -- Invoice terms and conditions
    metadata_json TEXT, -- Additional invoice metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id),
    FOREIGN KEY (transaction_id) REFERENCES payment_transactions (id),
    
    -- Constraints
    CHECK (amount > 0 OR invoice_type = 'refund'),
    CHECK (total_amount >= 0),
    CHECK (tax_rate >= 0 AND tax_rate <= 1),
    CHECK (reminder_count >= 0),
    CHECK (download_count >= 0)
);

-- Webhook Events Table (Enhanced for Reliability)
CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razorpay_event_id TEXT UNIQUE,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    account_id TEXT, -- Razorpay account ID
    payload_json TEXT NOT NULL, -- JSON payload from Razorpay
    signature TEXT, -- Webhook signature for verification
    processed BOOLEAN DEFAULT 0,
    processing_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_processing_error TEXT,
    error_count INTEGER DEFAULT 0,
    next_retry_at DATETIME,
    processing_started_at DATETIME,
    processing_completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CHECK (processing_attempts >= 0),
    CHECK (max_attempts > 0),
    CHECK (error_count >= 0)
);

-- Audit Log Table (New - For Compliance and Security)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entity_type TEXT NOT NULL, -- subscription, payment, invoice, etc.
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL, -- create, update, delete, view, etc.
    old_values_json TEXT, -- Previous values (for updates)
    new_values_json TEXT, -- New values
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT, -- Unique request identifier
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    description TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Payment Settings Table (New - For Configuration Management)
CREATE TABLE IF NOT EXISTS payment_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_encrypted BOOLEAN DEFAULT 0,
    is_system BOOLEAN DEFAULT 0, -- System settings cannot be modified by users
    category TEXT DEFAULT 'general', -- general, security, notification, etc.
    validation_rules_json TEXT, -- Validation rules for the setting
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subscription Usage Tracking (New - For Usage-Based Billing)
CREATE TABLE IF NOT EXISTS subscription_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    usage_type TEXT NOT NULL, -- api_calls, storage_gb, users, etc.
    usage_date DATE NOT NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    usage_limit INTEGER, -- Plan limit for this usage type
    overage_count INTEGER DEFAULT 0, -- Usage over the limit
    overage_cost INTEGER DEFAULT 0, -- Cost for overage in paise
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id) ON DELETE CASCADE,
    
    -- Constraints
    CHECK (usage_count >= 0),
    CHECK (overage_count >= 0),
    CHECK (overage_cost >= 0),
    
    -- Unique constraint to prevent duplicate entries
    UNIQUE (subscription_id, usage_type, usage_date)
);

-- Performance Indexes (Comprehensive)
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans (is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_featured ON subscription_plans (is_featured, is_active);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active_user ON user_subscriptions (user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_billing_date ON user_subscriptions (next_billing_date) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods (user_id, is_default) WHERE is_default = 1;
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods (user_id, is_active) WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_billing_addresses_user_id ON billing_addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_billing_addresses_default ON billing_addresses (user_id, is_default) WHERE is_default = 1;

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions (status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_date ON payment_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON payment_transactions (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_razorpay_id ON payment_transactions (razorpay_payment_id);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices (user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices (due_date) WHERE status IN ('sent', 'viewed', 'partially_paid');
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (invoice_number);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events (processed, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_entity ON webhook_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events (event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_subscription ON subscription_usage (subscription_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_type_date ON subscription_usage (usage_type, usage_date);

-- Insert default subscription plans (Free, Pro, Plus tiers)
INSERT OR IGNORE INTO subscription_plans (plan_code, name, description, tagline, price_monthly, price_yearly, features, limits_json, trial_days, is_active, is_featured, display_order) VALUES
('free', 'Free', 'Get started with our basic features', 'Perfect for trying out the platform', 0, 0, '["Basic dashboard access", "Up to 5 projects", "Community support", "Standard API access"]', '{"projects": 5, "api_calls": 1000, "storage_gb": 1, "users": 1}', 0, 1, 0, 1),
('pro', 'Pro', 'Advanced features for growing businesses', 'Most popular choice for professionals', 99900, 999900, '["Everything in Free", "Unlimited projects", "Priority support", "Advanced analytics", "API integrations", "Custom branding"]', '{"projects": -1, "api_calls": 10000, "storage_gb": 10, "users": 5, "integrations": 10}', 14, 1, 1, 2),
('plus', 'Plus', 'Enterprise-grade features and support', 'For teams that need maximum power', 199900, 1999900, '["Everything in Pro", "Unlimited users", "24/7 dedicated support", "Advanced security", "Custom integrations", "SLA guarantee", "White-label options"]', '{"projects": -1, "api_calls": 100000, "storage_gb": 100, "users": -1, "integrations": -1, "sla": true}', 30, 1, 0, 3);

-- Insert default payment settings
INSERT OR IGNORE INTO payment_settings (setting_key, setting_value, data_type, description, is_system, category) VALUES
('razorpay_webhook_secret', '', 'string', 'Razorpay webhook secret for signature verification', 1, 'security'),
('max_failed_payments', '3', 'number', 'Maximum failed payments before subscription cancellation', 0, 'general'),
('grace_period_days', '3', 'number', 'Grace period days for failed payments', 0, 'general'),
('invoice_due_days', '15', 'number', 'Default invoice due days', 0, 'general'),
('auto_invoice_generation', 'true', 'boolean', 'Automatically generate invoices for successful payments', 0, 'general'),
('email_notifications', 'true', 'boolean', 'Send email notifications for payment events', 0, 'notification'),
('proration_enabled', 'true', 'boolean', 'Enable prorated billing for plan changes', 0, 'billing'),
('trial_period_days', '14', 'number', 'Default trial period in days', 0, 'general'),
('currency_default', 'INR', 'string', 'Default currency for pricing', 0, 'general'),
('tax_rate_default', '0.18', 'number', 'Default tax rate (GST)', 0, 'taxation');
```

## 🔌 Enhanced API Endpoints Specification

### Complete API Endpoints with Enhanced Security

```javascript
/**
 * Enhanced Payment Management API Endpoints
 * All endpoints include comprehensive error handling, validation, and security
 */

// Subscription Management Endpoints (Enhanced)
GET    /api/v1/subscriptions/plans                    // Get all available plans with pricing tiers
POST   /api/v1/subscriptions/create                   // Create new subscription with payment
GET    /api/v1/subscriptions/current                  // Get user's current subscription details
POST   /api/v1/subscriptions/cancel                   // Cancel subscription (immediate or at period end)
POST   /api/v1/subscriptions/pause                    // Pause subscription temporarily
POST   /api/v1/subscriptions/resume                   // Resume paused subscription
PUT    /api/v1/subscriptions/change-plan              // Change subscription plan with prorating
POST   /api/v1/subscriptions/addon/:addonId           // Add subscription addon
DELETE /api/v1/subscriptions/addon/:addonId           // Remove subscription addon
GET    /api/v1/subscriptions/usage                    // Get current usage statistics
GET    /api/v1/subscriptions/history                  // Get subscription change history

// Payment Method Management Endpoints (Enhanced)
GET    /api/v1/payment-methods                        // Get user's payment methods
POST   /api/v1/payment-methods/add                    // Add new payment method with tokenization
PUT    /api/v1/payment-methods/:id/default            // Set default payment method
DELETE /api/v1/payment-methods/:id                    // Remove payment method
POST   /api/v1/payment-methods/:id/verify             // Verify payment method with micro-transaction
GET    /api/v1/payment-methods/:id/transactions       // Get payment method transaction history

// Payment Processing Endpoints (Enhanced)
POST   /api/v1/payments/create-order                  // Create Razorpay order with enhanced validation
POST   /api/v1/payments/verify                        // Verify payment signature with comprehensive checks
POST   /api/v1/payments/capture                       // Manually capture authorized payment
POST   /api/v1/payments/refund                        // Process full or partial refund
GET    /api/v1/payments/history                       // Get paginated payment history with filters
GET    /api/v1/payments/transaction/:id               // Get specific transaction details
POST   /api/v1/payments/retry/:id                     // Retry failed payment
GET    /api/v1/payments/methods/supported             // Get supported payment methods by region

// Billing Address Management Endpoints (Enhanced)
GET    /api/v1/billing/addresses                      // Get user's billing addresses
POST   /api/v1/billing/addresses                      // Add new billing address with validation
PUT    /api/v1/billing/addresses/:id                  // Update billing address
DELETE /api/v1/billing/addresses/:id                  // Delete billing address
PUT    /api/v1/billing/addresses/:id/default          // Set default billing address
POST   /api/v1/billing/addresses/validate             // Validate address with third-party service

// Invoice Management Endpoints (Enhanced)
GET    /api/v1/invoices                               // Get paginated invoices with filters
GET    /api/v1/invoices/:id                           // Get specific invoice details
GET    /api/v1/invoices/:id/download                  // Download invoice PDF with access control
POST   /api/v1/invoices/:id/regenerate                // Regenerate invoice PDF
POST   /api/v1/invoices/:id/send                      // Send invoice via email
POST   /api/v1/invoices/bulk-download                 // Download multiple invoices as ZIP
GET    /api/v1/invoices/templates                     // Get available invoice templates
PUT    /api/v1/invoices/settings                      // Update invoice generation settings

// Webhook Endpoints (Enhanced)
POST   /api/v1/webhooks/razorpay                      // Razorpay webhook handler with signature verification
POST   /api/v1/webhooks/test                          // Test webhook endpoint for development
GET    /api/v1/webhooks/events                        // Get webhook event history
POST   /api/v1/webhooks/retry/:eventId                // Retry failed webhook processing
GET    /api/v1/webhooks/health                        // Webhook system health check

// Health and Monitoring Endpoints (New)
GET    /api/v1/health/payment-gateway                 // Payment gateway connectivity check
GET    /api/v1/health/database                        // Database health check
GET    /api/v1/health/system                          // Overall system health
GET    /api/v1/metrics/payments                       // Payment system metrics for monitoring
```

## 🎨 Enhanced Frontend Component Architecture

### Component Hierarchy with Performance Optimization

```
frontend/src/
├── components/
│   ├── billing/
│   │   ├── BillingDashboard.tsx           // Main billing dashboard with lazy loading
│   │   ├── SubscriptionCard.tsx           // Current subscription with status indicators
│   │   ├── PlanSelector.tsx               // Interactive plan selection with comparison
│   │   ├── PaymentMethodCard.tsx          // Payment method display with edit actions
│   │   ├── InvoiceList.tsx                // Virtualized invoice list for performance
│   │   ├── TransactionHistory.tsx         // Paginated transaction history
│   │   ├── UsageMetrics.tsx               // Real-time usage tracking display
│   │   ├── BillingAlerts.tsx              // Proactive billing alerts and notifications
│   │   └── index.ts
│   ├── forms/
│   │   ├── PaymentMethodForm.tsx          // Accessible payment method form with validation
│   │   ├── BillingAddressForm.tsx         // International address form with auto-complete
│   │   ├── SubscriptionForm.tsx           // Multi-step subscription creation form
│   │   ├── PlanChangeForm.tsx             // Plan change form with prorating preview
│   │   ├── CancellationForm.tsx           // Subscription cancellation with feedback
│   │   └── [existing forms...]
│   ├── payment/
│   │   ├── RazorpayCheckout.tsx           // Enhanced Razorpay integration with error boundaries
│   │   ├── PaymentButton.tsx              // Accessible payment action button with loading states
│   │   ├── PlanCard.tsx                   // Interactive plan card with feature comparison
│   │   ├── InvoiceViewer.tsx              // PDF invoice viewer with download options
│   │   ├── PaymentMethodSelector.tsx      // Payment method selection with validation
│   │   ├── PricingCalculator.tsx          // Real-time pricing calculator with prorating
│   │   ├── PaymentStatus.tsx              // Payment status tracking component
│   │   └── index.ts
│   ├── ui/
│   │   ├── PaymentMethodIcon.tsx          // Accessible payment method icons
│   │   ├── PriceDisplay.tsx               // Internationalized price formatting
│   │   ├── StatusBadge.tsx                // Consistent status indicators
│   │   ├── ProgressIndicator.tsx          // Multi-step process progress
│   │   ├── ErrorBoundary.tsx              // Payment-specific error boundary
│   │   ├── LoadingSkeleton.tsx            // Skeleton loading components
│   │   └── [existing UI components...]
│   ├── accessibility/
│   │   ├── ScreenReaderOnly.tsx           // Screen reader only content
│   │   ├── FocusTrap.tsx                  // Focus management for modals
│   │   ├── AnnouncementRegion.tsx         // ARIA live regions for status updates
│   │   └── index.ts
│   └── [existing components...]
├── pages/
│   ├── billing/
│   │   ├── BillingPage.tsx                // Main billing page with breadcrumbs
│   │   ├── PaymentHistoryPage.tsx         // Detailed payment history with filters
│   │   ├── InvoicesPage.tsx               // Invoice management with search
│   │   ├── SubscriptionPage.tsx           // Subscription management dashboard
│   │   ├── PlanSelectionPage.tsx          // Plan selection with comparison table
│   │   ├── CheckoutPage.tsx               // Multi-step checkout process
│   │   └── index.ts
│   └── [existing pages...]
├── hooks/
│   ├── usePayments.ts                     // Payment operations with caching
│   ├── useSubscription.ts                 // Subscription management with optimistic updates
│   ├── useBilling.ts                      // Billing data with real-time sync
│   ├── useRazorpay.ts                     // Razorpay integration with error handling
│   ├── useInvoices.ts                     // Invoice management with pagination
│   ├── usePaymentMethods.ts               // Payment method management
│   ├── useErrorHandling.ts                // Centralized error handling
│   ├── useAccessibility.ts                // Accessibility utilities
│   ├── useAnalytics.ts                    // Payment analytics tracking
│   └── [existing hooks...]
├── contexts/
│   ├── PaymentContext.tsx                 // Global payment state management
│   ├── BillingContext.tsx                 // Billing preferences and settings
│   ├── ErrorContext.tsx                   // Global error state management
│   └── [existing contexts...]
└── lib/
    ├── api/
    │   ├── payments.ts                    // Payment API client with retry logic
    │   ├── subscriptions.ts               // Subscription API client
    │   ├── invoices.ts                    // Invoice API client
    │   ├── billing.ts                     // Billing API client
    │   └── index.ts
    ├── config/
    │   ├── razorpay.ts                    // Razorpay configuration
    │   ├── payment.ts                     // Payment system configuration
    │   └── index.ts
    └── [existing lib files...]
```

## 🚀 Implementation Roadmap (Updated)

### Phase 1: Foundation & Security (Week 1-2)
**Objective**: Establish secure payment infrastructure

**Backend Tasks**:
- [ ] Install and configure enhanced Razorpay SDK with error handling
- [ ] Implement comprehensive database schema with encryption
- [ ] Create secure payment utility functions with input validation
- [ ] Set up environment variable management with rotation
- [ ] Implement audit logging system
- [ ] Add rate limiting and security middleware
- [ ] Create webhook signature verification
- [ ] Set up comprehensive error handling

**Frontend Tasks**:
- [ ] Install enhanced Razorpay web SDK with TypeScript
- [ ] Create accessible UI component library
- [ ] Set up error boundaries and loading states
- [ ] Implement responsive design system
- [ ] Create internationalization setup
- [ ] Add accessibility utilities and hooks
- [ ] Set up analytics tracking
- [ ] Create comprehensive form validation

**Security & Compliance**:
- [ ] Implement zero-trust architecture
- [ ] Add CSRF protection
- [ ] Set up Content Security Policy
- [ ] Implement data encryption at rest
- [ ] Add API key rotation mechanism
- [ ] Create security audit logging

### Phase 2: Core Payment Processing (Week 3-4)
**Objective**: Implement robust payment processing

**Backend Tasks**:
- [ ] Enhanced order creation with comprehensive validation
- [ ] Multi-layered payment verification system
- [ ] Advanced transaction logging with forensics
- [ ] Intelligent payment method management
- [ ] International billing address support
- [ ] Tax calculation and compliance system
- [ ] Automatic retry mechanism for failed payments
- [ ] Real-time payment status tracking

**Frontend Tasks**:
- [ ] Enhanced RazorpayCheckout with accessibility
- [ ] Progressive payment processing flow
- [ ] Comprehensive error handling with user guidance
- [ ] Mobile-optimized payment interface
- [ ] Payment method management with tokenization
- [ ] Address validation and auto-completion
- [ ] Real-time payment status updates
- [ ] Offline payment handling

### Phase 3: Tiered Subscription Management (Week 5-6)
**Objective**: Complete subscription lifecycle management with three-tier system (Free, Pro, Plus)

**Backend Tasks**:
- [ ] Implement three-tier subscription model database structure (Free, Pro, Plus)
- [ ] Advanced subscription creation with Free tier database entry
- [ ] Pro tier trial management (14 days) - payment tracking only
- [ ] Plus tier extended trial (30 days) - payment tracking only
- [ ] Dynamic plan management - database entries only
- [ ] Prorated billing calculations for plan upgrades/downgrades
- [ ] Database schema for usage tracking (NO enforcement logic)
- [ ] Subscription pause/resume functionality - payment status only
- [ ] Database structure for tier information (NO access control implementation)
- [ ] Advanced cancellation flow with plan change tracking
- [ ] Database foundation for usage-based billing (NO billing logic)
- [ ] Subscription analytics and tier conversion reporting - payment data only

**Frontend Tasks**:
- [ ] Three-tier pricing page with feature comparison (display only)
- [ ] Interactive subscription dashboard showing current plan
- [ ] Plan comparison table with highlighted differences (display only)
- [ ] Database-driven usage metrics display (NO limit enforcement)
- [ ] Subscription modification flows (Free → Pro → Plus) - payment processing only
- [ ] UI showing tier information (NO feature access controls)
- [ ] Plan upgrade prompts based on database plan status
- [ ] Cancellation retention with Free tier option - payment handling only
- [ ] Billing timeline and history with tier changes
- [ ] Plan recommendation UI based on current subscription data

### Phase 4: Production Deployment & Monitoring (Week 7-8)
**Objective**: Production-ready deployment with comprehensive monitoring

**Deployment Tasks**:
- [ ] Production environment setup with security hardening
- [ ] SSL certificate configuration and HTTPS enforcement
- [ ] Database backup automation with encryption
- [ ] Log rotation and centralized logging
- [ ] Environment variable security with rotation
- [ ] Reverse proxy configuration with rate limiting
- [ ] Performance monitoring and alerting setup

**Monitoring & Alerting**:
- [ ] Real-time payment monitoring with dashboards
- [ ] Performance metrics tracking with thresholds
- [ ] Error tracking and automated alerting
- [ ] Security incident monitoring and response
- [ ] Business metrics tracking and reporting
- [ ] Customer behavior analytics and insights
- [ ] Financial KPI tracking and alerts

## 📈 Performance & Monitoring Strategy

### Performance Metrics & Targets

**Technical Performance KPIs**:
- Payment processing success rate: >99.5%
- Average payment completion time: <15 seconds
- API response times: <300ms for payment endpoints
- Database query performance: <50ms for payment queries
- Frontend page load time: <1.5 seconds
- Mobile performance score: >90 (Lighthouse)
- Accessibility score: >95 (Lighthouse)

**Business Performance KPIs**:
- Free to Pro conversion rate: >15%
- Pro to Plus conversion rate: >8%
- Overall subscription conversion rate: >20%
- Payment method addition success: >98%
- Invoice generation success: >99.9%
- Customer payment retry success: >85%
- Monthly churn rate (Pro tier): <3%
- Monthly churn rate (Plus tier): <1.5%
- Free tier usage limit adherence: >95%
- Customer satisfaction score: >4.5/5
- Payment dispute rate: <0.1%

**Security Performance KPIs**:
- Security incident count: Zero tolerance
- Failed authentication attempts: <1% of total requests
- Payment fraud detection accuracy: >99.8%
- Data breach incidents: Zero tolerance
- Compliance audit score: >98%
- Vulnerability count: Zero critical, <3 high

## 🔒 Enhanced Security Implementation

### Zero-Trust Security Architecture

```javascript
// backend/functions/middleware/zero-trust-security.js
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

/**
 * Zero-trust security middleware for payment operations
 */
class ZeroTrustSecurity {
    constructor() {
        this.trustedOrigins = new Set([
            process.env.FRONTEND_URL,
            'https://checkout.razorpay.com'
        ]);
        
        this.sessionStore = new Map(); // In production, use Redis
        this.requestLimits = new Map();
    }
    
    /**
     * Validate every request regardless of authentication status
     */
    validateRequest(req, res, next) {
        try {
            // Validate origin
            const origin = req.headers.origin || req.headers.referer;
            if (origin && !this.trustedOrigins.has(new URL(origin).origin)) {
                return res.status(403).json({
                    success: false,
                    message: 'Request from untrusted origin',
                    code: 'UNTRUSTED_ORIGIN'
                });
            }
            
            // Add comprehensive security headers
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'",
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            });
            
            next();
            
        } catch (error) {
            console.error('Request validation failed:', error);
            res.status(500).json({
                success: false,
                message: 'Request validation failed',
                code: 'VALIDATION_ERROR'
            });
        }
    }
    
    /**
     * Enhanced payment integrity validation
     */
    validatePaymentIntegrity(req, res, next) {
        try {
            const { amount, currency, planId } = req.body;
            
            // Validate amount format
            if (!Number.isInteger(amount) || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment amount format',
                    code: 'INVALID_AMOUNT'
                });
            }
            
            // Cross-check amount with plan pricing (server-side verification)
            if (planId) {
                const plan = this.getSubscriptionPlan(planId);
                if (!plan || (amount !== plan.priceMonthly && amount !== plan.priceYearly)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Payment amount does not match plan pricing',
                        code: 'AMOUNT_MISMATCH'
                    });
                }
            }
            
            next();
            
        } catch (error) {
            console.error('Payment integrity validation failed:', error);
            res.status(500).json({
                success: false,
                message: 'Payment validation failed',
                code: 'PAYMENT_VALIDATION_ERROR'
            });
        }
    }
}

module.exports = { ZeroTrustSecurity };
```

---

## 📝 Conclusion

This enhanced Razorpay payment gateway integration plan addresses all critical security vulnerabilities, performance optimizations, accessibility requirements, and aligns with current API standards. **The implementation is strictly limited to payment system functionality only.**

**Key Improvements Over Original Plan:**
- **Security-First Architecture**: Zero-trust security model with comprehensive validation
- **Enhanced User Experience**: Mobile-first design with WCAG 2.1 AA accessibility compliance
- **Performance Optimization**: Caching, lazy loading, and real-time monitoring
- **Production-Ready Features**: Comprehensive error handling, monitoring, and alerting
- **Scalable Architecture**: Modular design supporting future enhancements
- **Compliance Ready**: GST, PCI DSS, and international tax compliance

**Critical Security Enhancements:**
- API key rotation and secure environment management
- Zero-trust authentication and authorization
- Real-time fraud detection and suspicious activity monitoring
- Comprehensive audit logging with tamper detection
- Advanced rate limiting and progressive slowdowns
- Payment integrity validation and amount verification

**Performance & Reliability Targets:**
- <300ms API response times with caching strategies
- >99.5% payment processing success rate
- Real-time monitoring with automated alerting
- Comprehensive error recovery and retry mechanisms
- Progressive Web App features for offline support

**⚠️ FINAL IMPLEMENTATION REMINDER:**

**WHAT WILL BE IMPLEMENTED:**
✅ Complete payment processing system
✅ Subscription plan selection and payment
✅ Database entries tracking user's current plan status
✅ Payment lifecycle management (paid, failed, cancelled, halted)
✅ Billing cycle tracking and due date management
✅ Plan upgrade/downgrade payment processing
✅ Invoice generation and payment history

**WHAT WILL NOT BE IMPLEMENTED:**
❌ Feature access control or restrictions based on subscription
❌ Usage limit enforcement or monitoring
❌ Plan-based application behavior or functionality
❌ Access restrictions based on subscription status
❌ Any business logic that depends on subscription tier

**The subscription status in the database serves as a foundation for future feature implementation. All subscription-related features and access controls will be implemented separately based on business requirements.**

This plan is now implementation-ready with bulletproof security, exceptional user experience, and enterprise-grade reliability. The phased approach ensures systematic development with proper validation at each stage.

*This document serves as the authoritative technical specification for the enhanced Razorpay payment gateway integration project and should be referenced throughout the implementation process.*