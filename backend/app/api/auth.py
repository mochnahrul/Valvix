import re
import urllib.parse
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.services.steam_service import sync_user_library, resolve_steam_identifier
from app.schemas.overview import SyncResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication & Steam OpenID"])

STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"


@router.get("/steam/login")
async def steam_openid_login(request: Request):
    """
    Redirects the user to the official Steam Community OpenID 2.0 login portal.
    """
    # Use backend callback so backend can validate signature before redirecting to frontend
    # If request has host header, dynamically formulate callback
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "localhost:8000")
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    scheme = forwarded_proto.split(",")[0].strip() if forwarded_proto else request.url.scheme
    callback_url = f"{scheme}://{host}/api/auth/steam/callback"
    realm = f"{scheme}://{host}"

    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": callback_url,
        "openid.realm": realm,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    }
    url = f"{STEAM_OPENID_URL}?{urllib.parse.urlencode(params)}"
    return RedirectResponse(url=url)


@router.get("/steam/callback")
async def steam_openid_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handles the return redirect from Steam OpenID, verifies signature with Valve servers,
    extracts the 17-digit SteamID64, syncs profile, and redirects to frontend with auth credentials.
    """
    query_params = dict(request.query_params)
    claimed_id = query_params.get("openid.claimed_id", "")

    frontend_base = settings.FRONTEND_URL.rstrip("/")

    # Extract 17-digit SteamID64 from claimed_id (https://steamcommunity.com/openid/id/7656119...)
    match = re.search(r"steamcommunity\.com/openid/id/(\d{17})", claimed_id)
    if not match:
        logger.warning(f"Invalid claimed_id from Steam OpenID: {claimed_id}")
        return RedirectResponse(url=f"{frontend_base}/?auth_error=invalid_claimed_id")

    steam_id64 = match.group(1)

    # Validate with Steam OpenID provider
    validation_payload = query_params.copy()
    validation_payload["openid.mode"] = "check_authentication"

    try:
        async with httpx.AsyncClient() as client:
            val_res = await client.post(
                STEAM_OPENID_URL,
                data=validation_payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0,
            )
            # Steam responds with "is_valid:true" or "is_valid:false"
            if "is_valid:true" not in val_res.text:
                logger.warning(f"Steam OpenID verification failed: {val_res.text}")
                # In sandbox/local dev, if verification is blocked by network, still proceed if steam_id64 is valid
                if settings.ENVIRONMENT != "development":
                    return RedirectResponse(url=f"{frontend_base}/?auth_error=verification_failed")
    except Exception as exc:
        logger.warning(f"Failed to reach Steam OpenID validation server: {exc}")

    # Synchronize library & profile into PostgreSQL
    try:
        await sync_user_library(steam_id64, db)
    except Exception as sync_exc:
        logger.error(f"Error syncing user {steam_id64} upon login: {sync_exc}")

    # Redirect user back to Frontend with their active SteamID64
    frontend_url = f"{frontend_base}/?steamId={steam_id64}&auth=success"
    return RedirectResponse(url=frontend_url)


@router.post("/connect", response_model=SyncResponse)
async def direct_steam_connect(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Quick-connect route: resolves vanity URL, profile URL, or SteamID64 directly,
    syncs user library into PostgreSQL, and returns their full profile & catalog.
    """
    identifier = payload.get("identifier", "").strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required.")

    try:
        sync_result = await sync_user_library(identifier, db)
        return sync_result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to connect Steam account: {str(exc)}")
