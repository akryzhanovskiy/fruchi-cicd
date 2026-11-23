from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

# Analytics and webmaster-tools ids, pasted from Google / Meta / Bing; empty — disabled.
GaId = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^(G-[A-Z0-9]{4,20})?$")]
PixelId = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^([0-9]{5,20})?$")]
VerificationToken = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9_-]{0,100}$")
]


class ShopSettings(BaseModel):
    # Card details the operator sends to customers who chose "Оплата на картку".
    payment_details: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    # Products with stock at or below this are highlighted in the admin panel.
    low_stock_threshold: int = Field(default=5, ge=0, le=10_000)
    # Telegram chat (group) for order notifications; used by the notifier worker.
    telegram_chat_id: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] = ""
    # Google Analytics 4 measurement id (G-XXXXXXX) and Meta (Facebook/Instagram) Pixel id.
    ga_measurement_id: GaId = ""
    meta_pixel_id: PixelId = ""
    # "content" of the <meta> verification tags from Google Search Console / Bing Webmaster.
    google_site_verification: VerificationToken = ""
    bing_site_verification: VerificationToken = ""


class ShopSettingsUpdate(BaseModel):
    payment_details: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None
    ) = None
    low_stock_threshold: int | None = Field(default=None, ge=0, le=10_000)
    telegram_chat_id: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None
    ) = None
    ga_measurement_id: GaId | None = None
    meta_pixel_id: PixelId | None = None
    google_site_verification: VerificationToken | None = None
    bing_site_verification: VerificationToken | None = None


class ShopSettingsOut(ShopSettings):
    # TELEGRAM_BOT_TOKEN is a server secret: the panel only learns whether it's set.
    telegram_bot_configured: bool = False


class TelegramTestRequest(BaseModel):
    # Lets the admin check a chat id before saving it; defaults to the saved one.
    chat_id: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
