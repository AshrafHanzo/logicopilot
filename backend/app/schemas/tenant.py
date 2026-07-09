from pydantic import BaseModel, ConfigDict


class TenantCreate(BaseModel):
    name: str
    region: str | None = None
    currency: str | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    region: str | None
    currency: str | None
    is_active: bool
