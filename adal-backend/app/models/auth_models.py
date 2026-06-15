from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False


class RefreshRequest(BaseModel):
    refreshToken: str | None = None


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None


class UpdateProfileRequest(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    current_password: str = Field(
        validation_alias=AliasChoices("currentPassword", "current_password")
    )
    new_password: str = Field(
        validation_alias=AliasChoices("newPassword", "new_password")
    )


class RequestPasswordResetRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
