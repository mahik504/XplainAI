"""URL canonicalization and content deduplication with SHA-256 and SimHash."""

from __future__ import annotations

import hashlib
import posixpath
import re
import urllib.parse

_TRACKING_PARAMS: frozenset[str] = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "ref",
        "source",
        "ysclid",
        "mc_eid",
        "_hsenc",
        "_hsmi",
    }
)


class UrlCanonicalizer:
    """Canonicalizes URLs for deduplication and crawling consistency."""

    @classmethod
    def canonicalize(cls, url: str) -> str:
        """Produce a canonical normalized URL."""
        if not url or not url.strip():
            return ""

        url_str = url.strip()
        if not url_str.lower().startswith(("http://", "https://")):
            url_str = f"https://{url_str}"

        parsed = urllib.parse.urlsplit(url_str)

        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()

        # Remove default ports
        if scheme == "http" and netloc.endswith(":80"):
            netloc = netloc[:-3]
        elif scheme == "https" and netloc.endswith(":443"):
            netloc = netloc[:-4]

        # Normalize path
        path = parsed.path or "/"
        had_trailing_slash = path.endswith("/")
        path = re.sub(r"/+", "/", path)
        path = posixpath.normpath(path)
        if had_trailing_slash and not path.endswith("/") and path != "/":
            path += "/"
        elif not path:
            path = "/"

        # Filter tracking query parameters and sort
        query_pairs = urllib.parse.parse_qsl(parsed.query, keep_blank_values=False)
        filtered_query = [
            (k, v) for k, v in query_pairs if k.lower() not in _TRACKING_PARAMS
        ]
        filtered_query.sort(key=lambda item: item[0])
        clean_query = urllib.parse.urlencode(filtered_query)

        return urllib.parse.urlunsplit((scheme, netloc, path, clean_query, ""))

    @classmethod
    def url_hash(cls, url: str) -> str:
        """SHA-256 hex digest of the canonicalized URL."""
        canon = cls.canonicalize(url)
        return hashlib.sha256(canon.encode("utf-8")).hexdigest()


class ContentHasher:
    """Computes exact SHA-256 and near-duplicate SimHash fingerprints."""

    @classmethod
    def sha256_hash(cls, text: str) -> str:
        """Compute SHA-256 of normalized text."""
        normalized = re.sub(r"\s+", " ", text.strip().lower())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    @classmethod
    def simhash(cls, text: str, hash_bits: int = 64) -> int:
        """Compute 64-bit SimHash fingerprint for near-duplicate detection."""
        tokens = re.findall(r"\w+", text.lower())
        if not tokens:
            return 0

        v = [0] * hash_bits
        for token in tokens:
            token_hash = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            for i in range(hash_bits):
                bit = (token_hash >> i) & 1
                v[i] += 1 if bit else -1

        fingerprint = 0
        for i in range(hash_bits):
            if v[i] > 0:
                fingerprint |= 1 << i

        return fingerprint

    @classmethod
    def simhash_similarity(cls, hash1: int, hash2: int, hash_bits: int = 64) -> float:
        """Calculate cosine-like similarity from hamming distance between two SimHashes."""
        diff = hash1 ^ hash2
        hamming_dist = bin(diff).count("1")
        return 1.0 - (hamming_dist / float(hash_bits))

    @classmethod
    def is_duplicate(cls, hash1: str, hash2: str) -> bool:
        """Compare two SHA-256 content hashes."""
        return bool(hash1 and hash2 and hash1 == hash2)
