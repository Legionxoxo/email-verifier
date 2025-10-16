# MicroSaaS Login System - Architecture Strategy Document

## Executive Summary

This document outlines the comprehensive architecture strategy for a Notion-inspired login system template that will serve as the foundation for multiple micro-SaaS products. The system prioritizes security, scalability, and user experience while maintaining the design aesthetic and technical standards defined in CLAUDE.md.

## 🎯 Project Requirements

### Core Features
- **Authentication Methods**: Email/password + Email OTP (replacing magic links for security)
- **User Management**: Signup with firstName, lastName, email, password
- **Security Features**: Password reset, email verification, secure logout
- **Database**: SQLite3 with automatic table creation on server start
- **Development Setup**: Frontend (port 3000) + Backend (port 5000)
- **Production Setup**: Combined serving from port 5000

### Design Requirements
- **Visual Style**: Notion-like aesthetic with Manrope font
- **Color Strategy**: No deep blacks, deep black 6px rounded CTAs
- **Responsive**: Mobile and desktop optimized
- **User Experience**: Smooth transitions, micro-interactions, intuitive flow

## 🏗️ Architecture Overview

### Technology Stack

**Backend**
- Node.js + Express.js
- TypeScript support with JSDoc
- SQLite3 (better-sqlite3 for security)
- JWT-based authentication
- bcryptjs for password hashing

**Frontend**
- React 19 + TypeScript
- Vite bundler
- Tailwind CSS 4.1.11
- Framer Motion for animations
- React Hook Form + Zod validation

**Security & Infrastructure**
- Helmet for security headers
- CORS configuration
- Rate limiting
- Input validation
- Comprehensive logging

## 📊 Database Schema Design

### Users Table
```sql
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT, -- NULL for OTP-only accounts
    emailVerified INTEGER DEFAULT 0,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
    lastLoginAt INTEGER,
    isActive INTEGER DEFAULT 1
);
```

### Auth Tokens Table
```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- 'email_otp', 'password_reset', 'email_verification'
    expiresAt INTEGER NOT NULL,
    isUsed INTEGER DEFAULT 0,
    createdAt INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);
```

### Security Considerations
- **Database Security**: Implement better-sqlite3 instead of node-sqlite3
- **Encryption**: Consider SQLCipher for sensitive data
- **Indexes**: Add indexes on email, token, and userId for performance
- **Foreign Keys**: Enforce referential integrity

## 🔐 Security Architecture

### Critical Security Updates (2025 Standards)

**1. Replace Magic Links with Email OTP**
- Magic links deemed insecure by security researchers in 2025
- Email OTP provides better security with 6-digit codes
- 5-minute expiration window
- Rate limiting: 3 attempts per 15 minutes

**2. JWT Security Implementation**
```javascript
const JWT_CONFIG = {
    algorithm: 'RS256', // Not HS256
    accessToken: { expiresIn: '15m' },
    refreshToken: { expiresIn: '7d' },
    keySize: 256 // Minimum bits
};
```

**3. Password Security**
- bcryptjs with 12 salt rounds (updated from 10)
- Minimum 12 character passwords
- Complexity requirements enforced
- Rate limiting: 5 attempts per 15 minutes

**4. Database Security**
- Switch to better-sqlite3 (addresses security vulnerabilities)
- Prepared statements for SQL injection prevention
- Input sanitization and validation

### Security Dependencies
```json
{
  "dependencies": {
    "better-sqlite3": "^9.4.0",
    "bcryptjs": "^2.4.3", 
    "jsonwebtoken": "^9.0.2",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "winston": "^3.11.0"
  }
}
```

## 🎨 Frontend Architecture

### Component Structure (Following CLAUDE.md)
```
frontend/src/
├── components/
│   ├── ui/ (max 8 components)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── Toast.tsx
│   │   ├── Modal.tsx
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── forms/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   ├── PasswordResetForm.tsx
│   │   ├── EmailOTPForm.tsx
│   │   └── index.ts
│   └── layout/
│       ├── AuthLayout.tsx
│       ├── DashboardLayout.tsx
│       └── index.ts
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   └── PasswordResetPage.tsx
│   └── dashboard/
│       └── DashboardPage.tsx
└── hooks/
    ├── useAuth.ts
    ├── useToast.ts
    └── useLocalStorage.ts
```

### Design System Configuration

**Tailwind CSS Configuration**
```javascript
// Notion-inspired color palette
colors: {
  gray: {
    900: '#101828', // No pure blacks
  },
  primary: {
    500: '#0EA5E9',
  },
},
borderRadius: {
  'notion': '6px', // Deep black CTAs
},
fontFamily: {
  sans: ['Manrope', ...defaultTheme.fontFamily.sans],
}
```

### UI Components Strategy
- **React Hook Form + Zod**: Form handling and validation
- **Framer Motion**: Smooth animations and transitions
- **Headless UI**: Accessible UI primitives
- **Lucide React**: Notion-style icons
- **React Hot Toast**: User feedback notifications

## 🔄 Authentication Flow Design

### User Journey Map

**1. Initial Login Screen**
```
Email Input → Continue Button
```

**2. Authentication Method Selection**
```
Email Entered → Choose Method:
├── Password Login
└── Email OTP Login
```

**3. Verification & Access**
```
Credentials/OTP → JWT Token → Dashboard Access
```

### API Endpoints Structure
```
POST /api/auth/signup          # User registration
POST /api/auth/login           # Email/password login  
POST /api/auth/send-otp        # Send email OTP
POST /api/auth/verify-otp      # Verify OTP login
POST /api/auth/forgot-password # Password reset request
POST /api/auth/reset-password  # Reset with token
POST /api/auth/refresh         # Refresh JWT
POST /api/auth/logout          # Secure logout
GET  /api/user/profile         # User profile (protected)
```

## 🚀 Development & Production Strategy

### Development Environment
- **Frontend**: Vite dev server on port 3000
- **Backend**: Express server on port 5000
- **CORS**: Configured for localhost:3000
- **Hot Reload**: Both frontend and backend
- **Database**: Local SQLite file

### Production Environment
- **Unified Server**: Express serves frontend from public folder
- **Port**: Single port 5000 for both frontend and backend
- **Build Process**: Frontend built to dist/, copied to backend/public/
- **Security**: Production-grade headers and CORS configuration

### Build Process
```bash
# Frontend build
cd frontend && npm run build

# Copy to backend public folder
cp -r frontend/dist/* backend/public/

# Start production server
cd backend && npm start
```

## 📋 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Backend API structure setup
- [ ] Database schema implementation
- [ ] JWT authentication system
- [ ] Basic frontend components (Button, Input, Form)
- [ ] Authentication context and hooks

### Phase 2: Core Features (Week 2)
- [ ] Login/Signup forms with validation
- [ ] Email OTP system implementation
- [ ] Password reset functionality
- [ ] Protected routes and middleware
- [ ] Error handling and toast notifications

### Phase 3: UI/UX Polish (Week 3)
- [ ] Notion-inspired design implementation
- [ ] Animations and micro-interactions
- [ ] Responsive design optimization
- [ ] Loading states and skeleton screens
- [ ] Accessibility improvements

### Phase 4: Security & Production (Week 4)
- [ ] Security headers and middleware
- [ ] Rate limiting implementation
- [ ] Input validation and sanitization
- [ ] Production build process
- [ ] Security testing and audit

## 🔍 Quality Assurance Strategy

### Testing Approach
- **Backend**: Unit tests for auth functions, integration tests for APIs
- **Frontend**: Component tests with React Testing Library
- **Security**: Penetration testing checklist
- **Performance**: Load testing for auth endpoints

### Code Quality
- **TypeScript**: Strict type checking
- **ESLint/Prettier**: Code formatting and linting
- **Pre-commit Hooks**: Automated quality checks
- **Documentation**: JSDoc for all functions

### Security Testing Checklist
- [ ] SQL injection prevention
- [ ] XSS protection validation
- [ ] CSRF token effectiveness
- [ ] Rate limiting verification
- [ ] JWT security testing
- [ ] Password hashing validation

## 📈 Scalability Considerations

### Performance Optimization
- **Database**: Connection pooling and query optimization
- **Caching**: JWT token blacklist, user session caching
- **CDN**: Static asset delivery for production
- **Compression**: Gzip compression for API responses

### Horizontal Scaling Preparation
- **Stateless Architecture**: JWT-based authentication
- **Database**: Easy migration path to PostgreSQL
- **Environment Configuration**: Docker-ready setup
- **Load Balancing**: Ready for multiple instances

## 🎯 Success Metrics

### Technical Metrics
- **Performance**: <200ms API response times
- **Security**: Zero critical vulnerabilities
- **Uptime**: 99.9% availability target
- **Code Quality**: >90% test coverage

### User Experience Metrics
- **Login Success Rate**: >99%
- **Form Completion Rate**: >95%
- **Password Reset Success**: >98%
- **Mobile Usability**: Responsive on all devices

## 📝 Environment Variables Template

```bash
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
DATABASE_PATH=./database/app.db

# JWT Security (256-bit keys required)
JWT_SECRET=your-super-secure-256-bit-jwt-secret-key-here
JWT_REFRESH_SECRET=your-super-secure-256-bit-refresh-secret-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# Email OTP Configuration
OTP_EXPIRY_MINUTES=5
MAX_OTP_ATTEMPTS=3

# Password Reset
PASSWORD_RESET_EXPIRY=3600

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

## 🏁 Next Steps

This architecture strategy provides a comprehensive foundation for building a secure, scalable, and user-friendly login system. The next step is implementation following the phased approach outlined above.

**Immediate Actions Required:**
1. Review and approve this architecture strategy
2. Set up development environment
3. Begin Phase 1 implementation
4. Security dependency installation

The modular design ensures this template can be easily adapted for multiple micro-SaaS products while maintaining consistent security and user experience standards.

---

*This document should be reviewed by the development team and updated as implementation progresses. All security recommendations reflect 2025 best practices and should be validated during implementation.*