"""
Real username/password auth for the prototype -- no public sign-up. Accounts
are created exclusively by an Admin (enforced in main.py's /api/users POST
route). Passwords are salted + hashed with PBKDF2-SHA256 (stdlib `hashlib`,
no extra dependency). Sessions are opaque tokens stored in the DB with an
expiry, sent back by the client as `Authorization: Bearer <token>`.

This is intentionally simple (no JWT, no refresh tokens) -- enough to
demonstrate real login-gated, admin-provisioned access for the datathon
prototype. Swapping in Zoho Catalyst Authentication later means replacing
`login()` and `get_current_user()` with calls to Catalyst's auth API; every
other endpoint already just depends on `get_current_user` and doesn't care
how the token was issued.
"""
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session

from . import models
from .database import get_db

TOKEN_TTL_HOURS = 12
PURPOSES = [
    "Active Investigation", "Case Review / Analysis", "Court / Legal Proceedings",
    "Inter-station Coordination", "Public Liaison / RTI Response", "System Administration",
]


def _hash_password(password: str, salt: Optional[str] = None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()
    return digest, salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    digest, _ = _hash_password(password, salt)
    return secrets.compare_digest(digest, expected_hash)


def create_user(db: Session, *, username, password, full_name, role, purpose, station_id, created_by):
    existing = db.query(models.User).filter(models.User.username == username).first()
    if existing:
        raise ValueError("Username already exists")
    digest, salt = _hash_password(password)
    user = models.User(
        username=username, password_hash=digest, salt=salt, full_name=full_name,
        role=role, purpose=purpose, station_id=station_id, active=True,
        created_at=datetime.utcnow(), created_by=created_by,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, username: str, password: str):
    user = db.query(models.User).filter(models.User.username == username, models.User.active == True).first()  # noqa: E712
    if not user or not verify_password(password, user.salt, user.password_hash):
        return None
    token = secrets.token_urlsafe(32)
    session = models.SessionToken(
        token=token, user_id=user.id,
        created_at=datetime.utcnow(), expires_at=datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS),
    )
    db.add(session)
    db.commit()
    return token, user


def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> models.User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    session = db.query(models.SessionToken).filter(models.SessionToken.token == token).first()
    if not session or session.expires_at < datetime.utcnow():
        raise HTTPException(401, "Session expired or invalid — please log in again")
    user = db.query(models.User).filter(models.User.id == session.user_id, models.User.active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(401, "Account is inactive")
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "Admin":
        raise HTTPException(403, "Admin access required")
    return user


def seed_default_admin(db: Session):
    if db.query(models.User).count() > 0:
        return
    create_user(
        db, username="admin", password="ChangeMe@2026", full_name="System Administrator",
        role="Admin", purpose="System Administration", station_id=None, created_by="system",
    )
