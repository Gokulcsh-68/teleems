# TeleEMS Backend - Unified API

Production-grade emergency medical services platform backend. Consolidates multiple services into a high-performance Unified API for simplified deployment and management.

## 🚀 Environment Overview

| Service Name | Environment | Public URL |
|--------------|-------------|------------|
| **Unified API** | Production | `https://teleems-api-gateway.onrender.com` |
| **Telelink Service** | Production | `https://telelink-service.onrender.com` |

---

## 📖 API Reference (Quick Start)

Base URL: `https://teleems-api-gateway.onrender.com`

### 🔐 Authentication (`/v1/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/auth/login` | Authenticate with username/password |
| `POST` | `/v1/auth/otp/request` | Request OTP for mobile authentication |
| `POST` | `/v1/auth/otp/verify` | Verify OTP and receive JWT |
| `GET`  | `/v1/auth/me` | Get current user profile (Requires JWT) |
| `POST` | `/v1/auth/password/change` | Change password for logged-in user |
| `POST` | `/v1/auth/token/refresh` | Refresh access token using HTTP-only cookie |
| `POST` | `/v1/auth/token/revoke` | Logout (Revoke current session) |


### 🚨 Incident Management (`/v1/incidents`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/v1/incidents` | List incidents (Filters: `status`) |
| `POST` | `/v1/incidents` | Report a new emergency incident |
| `GET`  | `/v1/incidents/:id` | Get full details of a specific incident |
| **`PATCH`** | **`/v1/incidents/:id/status`** | **Update incident status (CCE/Admin)** |
| `PATCH` | `/v1/incidents/:id/assign` | Assign a vehicle to an incident |

### 👥 User Management (`/v1/auth/users`)

*Note: Most user management endpoints require `CURESELECT_ADMIN` role.*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/v1/auth/users` | List all users (Admin only) |
| `POST` | `/v1/auth/users` | Create a new user (Admin only) |
| `GET`  | `/v1/auth/users/:id` | Get user profile details |
| **`PATCH`** | **`/v1/auth/users/:id`** | **Update user details (Partial)** |
| `PUT`  | `/v1/auth/users/:id` | Update user details (Full) |
| `DELETE` | `/v1/auth/users/:id` | Deactivate/Delete user |
| `GET`  | `/v1/auth/users/:id/sessions` | List active sessions for user |
| `DELETE`| `/v1/auth/users/:id/sessions/:sid` | Revoke specific user session |

### 🛠️ Other Services

- **Admin:** `/v1/admin`
- **Fleet:** `/v1/fleet`
- **Hospital:** `/v1/hospital`
- **Notifications:** `/v1/notifications`

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v20+)
- PostgreSQL
- Redis

### Setup
```bash
# Install dependencies
npm install

# Build all services
npm run build

# Start Unified API in dev mode
npm run start:dev teleems-backend

# Start Telelink Service in dev mode
npm run start:dev telelink-service
```

### Build Commands
```bash
# Unified API
npm run build:api

# Telelink Service
npm run build:telelink
```

## 📦 Deployment (Render)

Deployment is managed via `render.yaml`. Pushing to `main` branch triggers an automatic build/deploy cycle.

> [!IMPORTANT]
> **Secret Management:** Ensure `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are manually configured in the Render Dashboard for the `teleems-api-gateway` service.
