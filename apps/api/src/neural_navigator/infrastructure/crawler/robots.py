"""Asynchronous robots.txt compliance parser with RFC 9309 precedence and domain caching."""

from __future__ import annotations

import contextlib
import re
import urllib.parse

import httpx
import structlog

_logger = structlog.get_logger("neural_navigator.infrastructure.crawler.robots")


def _pattern_to_regex(pattern: str) -> re.Pattern[str]:
    """Convert a robots.txt path pattern (with * and $ support) into a compiled regex."""
    has_end_anchor = pattern.endswith("$")
    core = pattern[:-1] if has_end_anchor else pattern
    segments = core.split("*")
    escaped_segments = [re.escape(seg) for seg in segments]
    regex_str = "^" + ".*".join(escaped_segments)
    if has_end_anchor:
        regex_str += "$"
    return re.compile(regex_str)


class _RobotsRule:
    __slots__ = ("allow", "length", "pattern", "regex")

    def __init__(self, allow: bool, pattern: str) -> None:
        self.allow = allow
        self.pattern = pattern
        self.regex = _pattern_to_regex(pattern)
        self.length = len(pattern)

    def matches(self, path: str) -> bool:
        return bool(self.regex.match(path))


class _RobotsGroup:
    def __init__(self, user_agents: list[str]) -> None:
        self.user_agents = [ua.strip().lower() for ua in user_agents if ua.strip()]
        self.rules: list[_RobotsRule] = []
        self.crawl_delay: float | None = None

    def specificity(self, target_agent: str) -> int:
        """Returns -1 if no match, 0 for wildcard (*), and length of matched agent string for specific matches."""
        target_lower = target_agent.lower()
        target_prod = target_lower.split("/")[0].strip()
        max_spec = -1
        for agent in self.user_agents:
            if agent == "*":
                max_spec = max(max_spec, 0)
            else:
                agent_prod = agent.split("/")[0].strip()
                if (
                    agent == target_lower
                    or agent_prod == target_prod
                    or agent in target_lower
                    or agent_prod in target_prod
                    or target_prod in agent_prod
                ):
                    max_spec = max(max_spec, len(agent))
        return max_spec


class _ParsedRobotsTxt:
    """Holds parsed groups and evaluates URL access and crawl delay per RFC 9309."""

    def __init__(self, raw_text: str) -> None:
        self.groups: list[_RobotsGroup] = []
        self._parse(raw_text)

    def _parse(self, text: str) -> None:
        current_agents: list[str] = []
        current_rules: list[_RobotsRule] = []
        current_delay: float | None = None

        for raw_line in text.splitlines():
            line = raw_line.split("#", 1)[0].strip()
            if not line or ":" not in line:
                continue

            key, val = line.split(":", 1)
            key = key.strip().lower()
            val = val.strip()

            if key == "user-agent":
                if current_rules or current_delay is not None:
                    if current_agents:
                        grp = _RobotsGroup(current_agents)
                        grp.rules = current_rules
                        grp.crawl_delay = current_delay
                        self.groups.append(grp)
                    current_agents = []
                    current_rules = []
                    current_delay = None
                current_agents.append(val)
            elif key == "allow":
                if val:
                    current_rules.append(_RobotsRule(allow=True, pattern=val))
            elif key == "disallow":
                if val:
                    current_rules.append(_RobotsRule(allow=False, pattern=val))
            elif key == "crawl-delay":
                with contextlib.suppress(ValueError):
                    current_delay = float(val)

        if current_agents:
            grp = _RobotsGroup(current_agents)
            grp.rules = current_rules
            grp.crawl_delay = current_delay
            self.groups.append(grp)

    def is_allowed(self, user_agent: str, path: str) -> bool:
        # 1. Look for specific matching groups
        best_spec = -1
        matching_groups: list[_RobotsGroup] = []

        for grp in self.groups:
            spec = grp.specificity(user_agent)
            if spec > 0:
                if spec > best_spec:
                    best_spec = spec
                    matching_groups = [grp]
                elif spec == best_spec:
                    matching_groups.append(grp)

        # 2. Fallback to wildcard groups if no specific match
        if not matching_groups:
            for grp in self.groups:
                if grp.specificity(user_agent) == 0:
                    matching_groups.append(grp)

        # If no group applies at all, access is allowed
        if not matching_groups:
            return True

        # 3. Find matching rules in selected group(s)
        matching_rules: list[_RobotsRule] = []
        for grp in matching_groups:
            for rule in grp.rules:
                if rule.matches(path):
                    matching_rules.append(rule)

        if not matching_rules:
            return True

        # RFC 9309 precedence: longest pattern wins; on tie, Allow wins (allow=True > allow=False)
        matching_rules.sort(key=lambda r: (r.length, r.allow), reverse=True)
        return matching_rules[0].allow

    def get_crawl_delay(self, user_agent: str) -> float:
        # Specific match first
        best_spec = -1
        best_delay: float | None = None

        for grp in self.groups:
            spec = grp.specificity(user_agent)
            if spec > best_spec and grp.crawl_delay is not None:
                best_spec = spec
                best_delay = grp.crawl_delay

        if best_delay is not None:
            return float(best_delay)

        # Fallback to wildcard group delay
        for grp in self.groups:
            if grp.specificity(user_agent) == 0 and grp.crawl_delay is not None:
                return float(grp.crawl_delay)

        return 0.0


class RobotsTxtParser:
    """Asynchronous robots.txt parser honoring User-agent, Disallow, Allow, and Crawl-delay rules."""

    def __init__(
        self,
        user_agent: str = "XplainAI-Bot/2.2",
        default_timeout: float = 4.0,
    ) -> None:
        self.user_agent = user_agent
        self.default_timeout = default_timeout
        self._parsed_cache: dict[str, _ParsedRobotsTxt | None] = {}

    async def can_fetch(self, url: str) -> tuple[bool, float]:
        """Check if URL can be fetched under robots.txt rules.

        Returns:
            tuple[bool, float]: (allowed, crawl_delay_seconds)
        """
        try:
            parsed = urllib.parse.urlparse(url)
            domain = parsed.netloc.lower()
            if not domain:
                return False, 0.0

            path = parsed.path or "/"
            if parsed.query:
                path = f"{path}?{parsed.query}"

            parsed_robots = self._parsed_cache.get(domain)
            if domain not in self._parsed_cache:
                robots_url = f"{parsed.scheme or 'https'}://{domain}/robots.txt"
                try:
                    async with httpx.AsyncClient(
                        timeout=self.default_timeout,
                        follow_redirects=True,
                        headers={"User-Agent": self.user_agent},
                    ) as client:
                        resp = await client.get(robots_url)
                        if resp.status_code == 200:
                            parsed_robots = _ParsedRobotsTxt(resp.text)
                        else:
                            parsed_robots = None
                except Exception as exc:
                    _logger.debug("robots.fetch_failed", domain=domain, error=str(exc))
                    parsed_robots = None

                self._parsed_cache[domain] = parsed_robots

            if parsed_robots is None:
                return True, 0.0

            allowed = parsed_robots.is_allowed(self.user_agent, path)
            delay = parsed_robots.get_crawl_delay(self.user_agent)
            return allowed, delay
        except Exception as exc:
            _logger.warning("robots.check_error", url=url, error=str(exc))
            return True, 0.0

    def clear_cache(self) -> None:
        self._parsed_cache.clear()
