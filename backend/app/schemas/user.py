from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models.user import ROLES


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str
    role: str
    tenant_id: str | None
    is_active: bool
    last_login_at: datetime | None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    tenant_id: str | None = None
    # Template sets to assign to this user (empty = access all of their tenant's).
    template_ids: list[str] = []

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, value: str) -> str:
        if value not in ROLES:
            raise ValueError(f"role must be one of {ROLES}")
        return value

    @field_validator("password")
    @classmethod
    def password_min_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("password must be at least 8 characters")
        return value


class UserUpdate(BaseModel):
    # All optional — only provided fields are changed.
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None
    template_ids: list[str] | None = None  # None = leave as-is; list = replace assignments

    @field_validator("password")
    @classmethod
    def password_min_length_optional(cls, value: str | None) -> str | None:
        if value is not None and len(value) < 8:
            raise ValueError("password must be at least 8 characters")
        return value
