from pydantic import BaseModel, ConfigDict


from pydantic import EmailStr


class TenantCreate(BaseModel):
    name: str
    region: str | None = None
    currency: str | None = None
    # Optional: create the tenant's admin login in the same step.
    admin_full_name: str | None = None
    admin_email: EmailStr | None = None
    admin_password: str | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    region: str | None
    currency: str | None
    is_active: bool
