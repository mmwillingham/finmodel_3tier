from typing import Dict, Optional

import models

DEFAULT_FREE_MAX_PROJECTION_YEARS = 5
DEFAULT_FREE_MAX_DOCUMENTS = 5
DEFAULT_FREE_MAX_WHATIF_MONTHLY = 5


def get_free_limits(db) -> Dict[str, int]:
    settings = db.query(models.GlobalSettings).first()
    return {
        "projection_years": settings.free_max_projection_years if settings and settings.free_max_projection_years is not None else DEFAULT_FREE_MAX_PROJECTION_YEARS,
        "documents": settings.free_max_documents if settings and settings.free_max_documents is not None else DEFAULT_FREE_MAX_DOCUMENTS,
        "whatif_monthly": settings.free_max_whatif_monthly if settings and settings.free_max_whatif_monthly is not None else DEFAULT_FREE_MAX_WHATIF_MONTHLY,
    }


def get_user_limits(db, user) -> Dict[str, Optional[int]]:
    free_limits = get_free_limits(db)
    is_free = getattr(user, "subscription_level", 1) == 1
    return {
        "is_limited": is_free,
        "max_projection_years": free_limits["projection_years"] if is_free else None,
        "max_documents": free_limits["documents"] if is_free else None,
        "max_whatif_monthly": free_limits["whatif_monthly"] if is_free else None,
    }
