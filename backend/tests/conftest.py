"""Make the `app` package importable from the tests directory."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402 - must follow the sys.path fixup above

from app.config import get_settings  # noqa: E402 - must follow the sys.path fixup above


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    """Reset the `get_settings` lru_cache before and after every test.

    Without this, a test that monkeypatches an env var (e.g. HUSHWAY_DB_PASSWORD) and populates
    the cache can leak its cached Settings into later tests/modules that call get_settings()
    without clearing it first.
    """
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
