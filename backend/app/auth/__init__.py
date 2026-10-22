"""Server-side session authentication for the self-hosted deployment profile.

This module deliberately does not implement custom JWTs: sessions are opaque
random tokens stored as SHA-256 hashes, delivered in HttpOnly cookies.
For a hosted multi-user deployment the documented upgrade path is Supabase Auth
(see docs/security.md); the API's ownership checks remain the same either way.
"""
