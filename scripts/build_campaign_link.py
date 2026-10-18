"""Build a mu56.ru placement link locally; never contacts or changes a service.

Use public campaign labels, not names, phone numbers or customer identifiers.
"""

import argparse
import re
from urllib.parse import urlencode

PUBLIC_PATH = re.compile(
    r"/(?:$|(?:animators|transformers|packages|characters|shows|extras|new-year|"
    r"gallery|contacts|reviews|articles|holidays|venues)(?:/[a-z-]{1,70})?/?$)"
)
LABEL = re.compile(r"[a-z][a-z0-9_-]{0,63}")
MEDIA = ("referral", "social", "email", "cpc", "offline")


def campaign_link(path, source, campaign, medium="referral", content=None):
    """Allow public page paths and compact, explicit placement labels only."""
    if not PUBLIC_PATH.fullmatch(path):
        raise ValueError("Use a public page path without a host, query or fragment")
    if medium not in MEDIA:
        raise ValueError("Unknown campaign medium")
    labels = {"utm_source": source, "utm_medium": medium, "utm_campaign": campaign}
    if content is not None:
        labels["utm_content"] = content
    if any(not isinstance(value, str) or not LABEL.fullmatch(value) for value in labels.values()):
        raise ValueError("Use lowercase public labels: letters, digits, hyphens or underscores")
    return "https://mu56.ru" + (path.rstrip("/") or "/") + "?" + urlencode(labels)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", default="/")
    parser.add_argument("--source", required=True)
    parser.add_argument("--campaign", required=True)
    parser.add_argument("--medium", choices=MEDIA, default="referral")
    parser.add_argument("--content")
    args = parser.parse_args()
    try:
        result = campaign_link(args.path, args.source, args.campaign, args.medium, args.content)
    except ValueError as error:
        parser.error(str(error))
    print(result)


if __name__ == "__main__":
    main()
