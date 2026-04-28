# Secure Banking API

## Overview

Secure Banking API is a Node.js/Express REST API for basic banking workflows. It supports user registration and login, JWT-based authentication, account creation, balance lookup, ledger-backed money transfers, token logout/blacklisting, and email notifications for registration and successful transfers.

Balances are not stored directly on accounts. They are derived from immutable ledger entries, where credits increase an account balance and debits decrease it. New accounts automatically receive an opening balance of `500` through an initial self-referenced transaction and a credit ledger entry.

## Features

- User registration with email normalization, email format validation, password hashing, and duplicate email checks.
- User login with bcrypt password comparison and JWT issuance.
- JWT authentication through either a `token` cookie or an `Authorization: Bearer <token>` header.
- Logout by storing tokens in a blacklist collection with a 3-day TTL.
- Protected account creation for authenticated users.
- Automatic opening balance credit of `500` for newly created accounts.
- Account listing scoped to the authenticated user.
- Account balance calculation from ledger aggregation.
- Protected account-to-account transfers with:
  - sender ownership validation,
  - receiver account validation,
  - active account status checks,
  - positive amount validation with up to 2 decimal places,
  - insufficient balance checks,
  - idempotency key validation,
  - duplicate idempotency conflict handling,
  - pending transaction recovery,
  - MongoDB session transaction support,
  - fallback processing for MongoDB deployments that do not support transactions.
- System-user-only initial funds endpoint.
- Gmail OAuth2 email delivery for registration and transaction notifications.
- Script for backfilling opening balance ledger entries for existing accounts.

## Tech Stack

### Backend

- Node.js
- Express `5.2.1`
- MongoDB with Mongoose `9.5.0`
- JSON Web Tokens via `jsonwebtoken`
- Password hashing via `bcryptjs`
- Cookie parsing via `cookie-parser`
- Environment loading via `dotenv`
- Email delivery via `nodemailer`

### Database

- MongoDB collections managed through Mongoose models:
  - `user`
  - `account`
  - `transaction`
  - `ledger`
  - `tokenBlackList`

### Tools

- `nodemon` through `npx nodemon server.js` for development.
- npm scripts for running the API and the opening-balance backfill script.

## Project Structure

```text
secure-banking-api/
+-- README.md
+-- package.json
+-- package-lock.json
+-- server.js
+-- src/
    +-- app.js
    +-- config/
    |   +-- db.js
    +-- controllers/
    |   +-- account.controller.js
    |   +-- auth.controller.js
    |   +-- transaction.controller.js
    +-- middleware/
    |   +-- auth.middleware.js
    +-- models/
    |   +-- account.model.js
    |   +-- blackList.model.js
    |   +-- ledger.model.js
    |   +-- transaction.model.js
    |   +-- user.model.js
    +-- routes/
    |   +-- account.routes.js
    |   +-- auth.routes.js
    |   +-- transaction.routes.js
    +-- scripts/
    |   +-- credit-opening-balance.js
    +-- services/
        +-- email.services.js
```

### Key Files

- `server.js`: Loads environment variables, connects to MongoDB, imports the Express app, and starts the server on port `3000`.
- `src/app.js`: Configures JSON parsing, cookie parsing, the health route, and route mounts.
- `src/config/db.js`: Connects Mongoose to `process.env.MONGO_URI`.
- `src/routes/auth.routes.js`: Defines registration, login, and logout routes.
- `src/routes/account.routes.js`: Defines protected account creation, account listing, and balance lookup routes.
- `src/routes/transaction.routes.js`: Defines authenticated transfer routes and system-user initial funding routes.
- `src/controllers/auth.controller.js`: Handles user registration, login, JWT creation, cookie assignment, logout, and token blacklist insertion.
- `src/controllers/account.controller.js`: Creates accounts, credits opening balances, lists user accounts, and returns ledger-derived balances.
- `src/controllers/transaction.controller.js`: Validates and processes transfers, creates ledger entries, handles idempotency, and sends transfer emails.
- `src/middleware/auth.middleware.js`: Validates JWTs, checks token blacklist state, loads the authenticated user, and enforces system-user access for system routes.
- `src/models/user.model.js`: Defines users, email validation, password hashing, and password comparison.
- `src/models/account.model.js`: Defines accounts and the `getBalance()` ledger aggregation method.
- `src/models/transaction.model.js`: Defines transfer records with unique idempotency keys.
- `src/models/ledger.model.js`: Defines immutable debit and credit entries.
- `src/models/blackList.model.js`: Stores invalidated JWTs and expires them after 3 days.
- `src/services/email.services.js`: Configures Gmail OAuth2 transport and sends registration, transaction success, and transaction failure emails.
- `src/scripts/credit-opening-balance.js`: Credits missing opening-balance ledger entries to existing accounts.

## Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root with the required variables listed below.

3. Ensure MongoDB is reachable through `MONGO_URI`.

4. Start the API:

```bash
npm run dev
```

The service listens on:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string used by Mongoose. |
| `JWT_SECRET` | Secret used to sign and verify JWT access tokens. |
| `EMAIL_USER` | Gmail address used as the OAuth2 sender account. |
| `CLIENT_ID` | OAuth2 client ID used by Nodemailer Gmail transport. |
| `CLIENT_SECRET` | OAuth2 client secret used by Nodemailer Gmail transport. |
| `REFRESH_TOKEN` | OAuth2 refresh token used by Nodemailer Gmail transport. |

## Usage

### Development

```bash
npm run dev
```

This runs:

```bash
npx nodemon server.js
```

### Production

```bash
npm start
```

This runs:

```bash
node server.js
```

### Opening Balance Backfill

```bash
npm run credit:opening-balance
```

This connects to MongoDB, finds all accounts, creates an `initial-balance-<accountId>` transaction when needed, and creates a `CREDIT` ledger entry of `500` for accounts missing that entry.

## API Endpoints

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Health check route that returns `Banking Service is up and running`. |
| `POST` | `/api/auth/register` | No | Creates a user, hashes the password, issues a JWT, sets a `token` cookie, returns user data, and sends a registration email. |
| `POST` | `/api/auth/login` | No | Validates email and password, issues a JWT, sets a `token` cookie, and returns user data. |
| `POST` | `/api/auth/logout` | Optional token | Adds the current token to the blacklist when present and clears the `token` cookie. |
| `POST` | `/api/accounts` | User JWT | Creates an account for the authenticated user and credits the opening balance. |
| `GET` | `/api/accounts` | User JWT | Returns all accounts owned by the authenticated user. |
| `GET` | `/api/accounts/balance/:accountId` | User JWT | Returns the ledger-derived balance for an account owned by the authenticated user. |
| `POST` | `/api/transactions` | User JWT | Transfers funds from one account owned by the authenticated user to another active account. |
| `POST` | `/api/transactions/system/initial-funds` | System-user JWT | Transfers initial funds from a system user's account to a target account. |

## Request Details

### `POST /api/auth/register`

Required body:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

### `POST /api/auth/login`

Required body:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### `POST /api/transactions`

Required body:

```json
{
  "fromAccount": "accountObjectId",
  "toAccount": "accountObjectId",
  "amount": 100,
  "idempotencyKey": "unique-key-at-least-8-chars"
}
```

Validation performed by the controller:

- `fromAccount`, `toAccount`, `amount`, and `idempotencyKey` are required.
- `fromAccount` and `toAccount` must be valid MongoDB ObjectIds.
- `fromAccount` and `toAccount` cannot be the same.
- `amount` must be positive and may contain up to 2 decimal places.
- `idempotencyKey` must be a string between 8 and 128 characters.
- `fromAccount` must belong to the authenticated user.
- Both accounts must have status `ACTIVE`.
- Sender balance must be greater than or equal to the requested amount.

### `POST /api/transactions/system/initial-funds`

Required body:

```json
{
  "toAccount": "accountObjectId",
  "amount": 500,
  "idempotencyKey": "unique-system-funding-key"
}
```

This route requires an authenticated user whose hidden `systemUser` field is `true`.

## Data Flow

### Authentication Flow

1. A user registers or logs in through `/api/auth/register` or `/api/auth/login`.
2. The API signs a JWT containing `{ userId: user._id }` with `JWT_SECRET`.
3. The JWT is returned in the JSON response and also written to the `token` cookie.
4. Protected routes read the token from `req.cookies.token` or the `Authorization` bearer header.
5. The auth middleware rejects missing, blacklisted, or invalid tokens.
6. On successful verification, the middleware loads the user from MongoDB and assigns it to `req.user`.

### Account Flow

1. An authenticated user calls `POST /api/accounts`.
2. The API creates an account document linked to `req.user._id`.
3. The API creates a completed transaction with `fromAccount` and `toAccount` both set to the new account ID.
4. The API creates a `CREDIT` ledger entry of `500`.
5. Balance checks later call `account.getBalance()`, which aggregates ledger credits and debits.

### Transfer Flow

1. An authenticated user submits `fromAccount`, `toAccount`, `amount`, and `idempotencyKey`.
2. The controller validates required fields, ObjectIds, amount format, account ownership, account existence, account status, and idempotency key format.
3. The sender balance is calculated from ledger entries.
4. If the idempotency key already exists:
   - the same completed request returns the existing transaction,
   - the same pending request attempts recovery by creating missing ledger entries,
   - a conflicting request returns `409`.
5. For a new transfer, the API creates a pending transaction.
6. The API creates a `DEBIT` ledger entry for the sender account.
7. The API creates a `CREDIT` ledger entry for the receiver account.
8. The transaction is marked `COMPLETED`.
9. The controller first attempts the operation inside a MongoDB session transaction.
10. If MongoDB transactions are unsupported, the regular transfer route falls back to non-session processing.
11. A transaction success email is sent asynchronously to the authenticated user.

## Scripts

| Script | Command | Description |
| --- | --- | --- |
| `npm run dev` | `npx nodemon server.js` | Starts the API in development mode with automatic restarts. |
| `npm start` | `node server.js` | Starts the API with Node. |
| `npm run credit:opening-balance` | `node src/scripts/credit-opening-balance.js` | Backfills missing opening-balance credits for existing accounts. |
| `npm test` | `echo "Error: no test specified" && exit 1` | Placeholder test script that always exits with an error. |

## Limitations / Issues

- The server port is hard-coded to `3000`; there is no `PORT` environment variable support.
- There is no custom centralized error handler for API error responses.
- The test script is a placeholder and no automated tests are present in the repository.
- `user.model.js` logs both the submitted password and stored password hash inside `comparePassword`; this should be removed before production use.
- The repository does not include an `.env.example` file documenting required configuration without secrets.
- The regular transfer route has a fallback for MongoDB deployments without transaction support, but the system initial-funds route always uses a MongoDB session transaction.
- The system initial-funds route does not apply the same amount, idempotency key, account status, or duplicate key validation used by the regular transfer route.
- Email transport verification runs when the email service module is loaded, so missing or invalid Gmail OAuth2 variables can produce startup-time email errors.
- Token logout stores full JWT strings in MongoDB until the 3-day TTL expires.

## Future Improvements

- Add a `.env.example` file with all required variable names and safe placeholder values.
- Replace the hard-coded server port with `process.env.PORT || 3000`.
- Remove password logging from `comparePassword`.
- Add centralized request validation and error handling.
- Add automated tests for authentication, account creation, balance aggregation, idempotency behavior, and transfer failure cases.
- Add a unique ledger-level constraint or stronger safeguards to prevent duplicate ledger entries for the same transaction/account/type combination.
- Align the system initial-funds route with the regular transfer route validation and idempotency behavior.
- Add API documentation examples for common success and error responses.
- Consider storing token hashes in the blacklist instead of raw JWT values.
