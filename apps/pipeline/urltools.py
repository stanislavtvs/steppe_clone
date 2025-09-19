from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

STRIP_PARAMS = {
    "utm_source","utm_medium","utm_campaign","utm_term","utm_content",
    "at_medium","at_campaign","at_ptr","at_bbc_team","at_link_type",
}

def normalize_url(u: str) -> str:
    if not u:
        return u
    p = urlsplit(u)
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k not in STRIP_PARAMS]
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(q, doseq=True), ""))
