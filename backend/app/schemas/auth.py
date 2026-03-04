from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    confirmPassword: str | None = None
    rememberMe: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    rememberMe: bool = False


class VerifyEmailRequest(BaseModel):
    email: EmailStr


class VerifyEmailConfirmRequest(BaseModel):
    token: str
