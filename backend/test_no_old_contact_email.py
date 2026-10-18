"""
Guard test: ensure the old placeholder support email has been fully removed
from the codebase. The official support address is chaloghumne.trips@gmail.com
(see frontend/src/lib/siteConfig.js and backend/.env.example).

Run from backend/ or repo root:
    python -m unittest test_no_old_contact_email -v
"""

import os
import unittest

# Built from parts so this very test file does not contain the literal string
# we are searching for (which would cause a self-match false positive).
_OLD_EMAIL = "hello" + "@" + "chaloghumne" + ".travel"

_SELF = os.path.abspath(__file__)


def _repo_root():
    # backend/test_no_old_contact_email.py -> repo root (one level above backend/)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _iter_source_files():
    root = _repo_root()
    # frontend/src/** — every file recursively.
    fe_src = os.path.join(root, "frontend", "src")
    if os.path.isdir(fe_src):
        for dirpath, _dirs, files in os.walk(fe_src):
            for name in files:
                full = os.path.join(dirpath, name)
                if os.path.abspath(full) == _SELF:
                    continue
                yield full
    # backend/*.py — top-level python files only (not test fixtures elsewhere).
    be = os.path.join(root, "backend")
    for name in os.listdir(be):
        if name.endswith(".py"):
            full = os.path.join(be, name)
            if os.path.abspath(full) == _SELF:
                continue
            yield full


class TestNoOldContactEmail(unittest.TestCase):
    def test_no_old_email_in_source(self):
        """The old placeholder support email must not appear anywhere in source."""
        hits = []
        for path in _iter_source_files():
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as fh:
                    content = fh.read()
            except (IsADirectoryError, OSError):
                continue
            if _OLD_EMAIL in content:
                hits.append(os.path.relpath(path, _repo_root()))
        self.assertEqual(
            hits, [],
            f"Old placeholder email {_OLD_EMAIL!r} still present in: {hits}",
        )


if __name__ == "__main__":
    unittest.main()
