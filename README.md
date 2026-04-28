# Secure Banking API

## Overview

Secure Banking API is a production-style REST API built with Node.js and Express that simulates core banking operations such as user authentication, account management, and ledger-based money transfers.

Unlike naive implementations, this system follows a **ledger-based architecture**, where balances are dynamically derived from immutable transaction records instead of being directly stored.

---

## Key Highlights

* Ledger-based balance system (no direct balance mutation)
* Idempotent transaction handling (prevents duplicate transfers)
* JWT-based authentication with blacklist logout mechanism
* MongoDB transaction support with fallback handling
* Email notifications using Gmail OAuth2
* Opening balance automation using ledger entries

---

## Features

### Authentication

* Secure user registration with validation and hashing
* JWT-based login system
* Token stored in cookie + Authorization header support
* Logout using token blacklisting with TTL

### Account Management

* Create account (authenticated)
* Auto-credit opening balance (500)
* Fetch all user accounts
* Get real-time balance (ledger aggregation)

### Transactions

* Secure account-to-account transfers
* Ownership and account validation
* Idempotency key protection
* Duplicate & retry-safe transactions
* Insufficient balance protection
* MongoDB transaction + fallback mechanism

### System Features

* System-user controlled initial funding
* Email notifications (success/failure)
* Script for backfilling balances

---

## Tech Stack

### Backend

* Node.js
* Express
* MongoDB + Mongoose
* JWT (jsonwebtoken)
* bcryptjs
* cookie-parser
* dotenv
* nodemailer (Gmail OAuth2)

---

## Project Structure

```bash
secure-banking-api/
├── server.js
├── src/
│   ├── app.js
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── scripts/
```

---

## Installation

```bash
npm install
```

Create `.env` file:

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
EMAIL_USER=your_email
CLIENT_ID=your_client_id
CLIENT_SECRET=your_secret
REFRESH_TOKEN=your_token
```

Run server:

```bash
npm run dev
```

---

## API Base URL

```
http://localhost:3000
```

---

## API Endpoints

### Auth

| Method | Route              |
| ------ | ------------------ |
| POST   | /api/auth/register |
| POST   | /api/auth/login    |
| POST   | /api/auth/logout   |

### Accounts

| Method | Route                     |
| ------ | ------------------------- |
| POST   | /api/accounts             |
| GET    | /api/accounts             |
| GET    | /api/accounts/balance/:id |

### Transactions

| Method | Route             |
| ------ | ----------------- |
| POST   | /api/transactions |

---

## Example Request

```json
POST /api/transactions
{
  "fromAccount": "accountId",
  "toAccount": "accountId",
  "amount": 100,
  "idempotencyKey": "txn-001"
}
```

---

## Data Flow

1. User logs in → receives JWT
2. JWT used for protected routes
3. Transactions create:

   * DEBIT entry (sender)
   * CREDIT entry (receiver)
4. Balance calculated dynamically from ledger

---

## Scripts

```bash
npm run dev
npm start
npm run credit:opening-balance
```

---

## Known Issues

* Port is hardcoded (3000)
* No centralized error handler
* No automated tests
* Password logging present (security issue)
* Mixed validation in system routes
* No `.env.example`

---

## Future Improvements

* Add test suite (Jest)
* Implement global error handling
* Add Swagger API docs
* Use environment-based config
* Improve validation consistency
* Hash token blacklist entries

---
## API Testing
Postman collection available in:
```
docs/postman_collection.json
```
---

## Author
Atharav Sawant
