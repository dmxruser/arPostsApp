# arPosts API

The deployed API uses Vercel file-based routes. Clients must call the `/api`
paths below; do not call the unprefixed paths such as `/signup`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/signup` | Create an account |
| `POST` | `/api/login` | Sign in |
| `POST` | `/api/logout` | Sign out |
| `GET` | `/api/posts?lat=&lng=&radius=` | Load nearby posts |
| `POST` | `/api/posts` | Create a post |
| `DELETE` | `/api/posts/:postId` | Delete a post |
| `POST` | `/api/posts/:postId/like` | Like a post |

`vercel.json` intentionally has no catch-all rewrite. That preserves Vercel's
file-based `/api/*` routing and prevents API handling from swallowing site
pages.
