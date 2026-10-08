# API Overview & Developer Guide

## 1. Base URL & Environments

All API routes are prefixed under `/api/v1`:

| Environment | Base URL | Note |
| --- | --- | --- |
| **Local Development** | `http://localhost:5000/api/v1` | Configurable via `PORT` in `.env` |
| **Swagger UI** | `http://localhost:5000/docs` | Interactive OpenAPI documentation browser |
| **OpenAPI Spec** | `docs/openapi.json` | Importable into Postman, Insomnia, or Swagger Editor |

---

## 2. Authentication Standard

Include the JWT token in the `Authorization` HTTP header for all secured endpoints:
```http
Authorization: Bearer <your_jwt_token_here>
```

---

## 3. Standard HTTP Status Codes

| Code | Meaning | Typical Usage |
| --- | --- | --- |
| `200 OK` | Success | Entity retrieval, listings, and updates |
| `201 Created` | Created | Successfully provisioned entity (User, Customer, Sale, Warehouse) |
| `400 Bad Request` | Validation Failure | Zod schema validation errors, missing body parameters |
| `401 Unauthorized` | Unauthenticated | Missing, expired, invalid JWT, or bad login credentials |
| `403 Forbidden` | Access Denied | User lacks required role, permission, or scope |
| `404 Not Found` | Resource Absent | Entity ID missing or outside assigned territory scope |
| `409 Conflict` | Business Conflict | Duplicate email/phone, insufficient stock balance, already decided sale |
| `500 Server Error` | Internal Failure | Unhandled exceptions intercepted by global error handler |
| `503 Service Unavailable` | Service Degraded | Database unavailable or auth service disabled |

---

## 4. Postman Collections

Two pre-configured Postman artifacts are included in the repository:
1. `docs/postman-manual-testing.postman_collection.json`: Comprehensive test collection with sequential role flows.
2. `docs/POSTMAN_MANUAL_TESTING.md`: Step-by-step execution guide.
