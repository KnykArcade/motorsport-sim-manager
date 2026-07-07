#!/usr/bin/env python3
from __future__ import annotations

import math
import re
import html as html_lib
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

import pandas as pd
import requests
from bs4 import BeautifulSoup


ROOT = Path("/home/ubuntu/motorsport-sim-manager")
GAP_REPORT = ROOT / "src/data/phase0/generated/driver_gap_report.csv"
OUT_CSV = Path("/home/ubuntu/driver_dob_scraped.csv")
OUT_XLSX = Path("/home/ubuntu/driver_dob_scraped.xlsx")
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_PAGE = "https://en.wikipedia.org/wiki/"
USER_AGENT = "Mozilla/5.0 (DevinBot/1.0; +https://www.example.com/devin)"

MANUAL_OVERRIDES = [
    {
        "driver_id": "driver-phil-krueger",
        "canonical_name": "Phil Krueger",
        "series": "CART",
        "birth_date": "1951-06-22",
        "birth_year": 1951,
        "source_url": "manual://verified",
        "source_title": "Manual verification",
        "confidence": 1.0,
        "verified": True,
        "status": "full_date",
        "query_used": "manual override",
    },
    {
        "driver_id": "driver-ted-prappas",
        "canonical_name": "Ted Prappas",
        "series": "CART",
        "birth_date": "1955-11-14",
        "birth_year": 1955,
        "source_url": "manual://verified",
        "source_title": "Manual verification",
        "confidence": 1.0,
        "verified": True,
        "status": "full_date",
        "query_used": "manual override",
    },
    {
        "driver_id": "driver-rick-treadway",
        "canonical_name": "Rick Treadway",
        "series": "IndyCar pre-2008",
        "birth_date": "1970-01-15",
        "birth_year": 1970,
        "source_url": "manual://verified",
        "source_title": "Manual verification",
        "confidence": 1.0,
        "verified": True,
        "status": "full_date",
        "query_used": "manual override",
    },
]


MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def norm(text: str) -> str:
    text = re.sub(r"[^\w\s]", " ", str(text), flags=re.UNICODE)
    text = re.sub(r"\s+", " ", text, flags=re.UNICODE).strip().lower()
    return text


def compact(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", norm(text))


def stem_name(name: str) -> str:
    raw = norm(name)
    return raw.replace("jr", "").replace("sr", "").strip()


def series_terms(series: str) -> list[str]:
    series = str(series)
    terms = []
    if "F1" in series:
        terms.extend(["Formula One driver", "Formula 1 driver"])
    if "IndyCar" in series:
        terms.extend(["IndyCar driver", "IRL driver"])
    if "CART" in series:
        terms.extend(["CART driver", "Champ Car driver"])
    terms.append("racing driver")
    terms.append("open-wheel racing driver")
    return terms


def fold_ascii(text: str) -> str:
    return unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode("ascii")


def candidate_queries(name: str, series: str) -> list[str]:
    base = str(name).strip()
    compacted = re.sub(r"[.]", " ", base)
    collapsed = re.sub(r"\s+", " ", compacted).strip()
    surname = norm(base).split()[-1] if norm(base) else base
    initials_only = re.sub(r"[^A-Za-z]", "", base)
    queries = [base, collapsed, f"{base} racing driver", f"{collapsed} racing driver"]
    if surname and surname != norm(base):
        queries.extend([f"{surname} {t}" for t in series_terms(series)])
        queries.append(f"{surname} racing driver")
    if initials_only and surname:
        queries.extend([f"{initials_only} {surname} {t}" for t in series_terms(series)])
        queries.append(f"{initials_only} {surname} racing driver")
    queries.extend([f"{collapsed} {t}" for t in series_terms(series)])
    seen = set()
    out = []
    for q in queries:
        q = re.sub(r"\s+", " ", q).strip()
        if q and q.lower() not in seen:
            seen.add(q.lower())
            out.append(q)
    return out[:12]


def direct_title_variants(name: str) -> list[str]:
    variants = []
    base = re.sub(r"\s+", " ", str(name).strip())
    variants.append(base)
    folded = fold_ascii(base)
    variants.append(folded)
    variants.append(re.sub(r"\.", "", base))
    variants.append(re.sub(r"\.", "", folded))
    variants.append(re.sub(r"\s+", " ", re.sub(r"\.", " ", base)).strip())
    variants.append(re.sub(r"\s+", " ", re.sub(r"\.", " ", folded)).strip())
    seen = set()
    out = []
    for v in variants:
        if v and v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return out


def title_matches_name(title: str, name: str) -> bool:
    title_norm = norm(title)
    title_fold = norm(fold_ascii(title))
    name_norm = norm(name)
    name_fold = norm(fold_ascii(name))
    if title_norm == name_norm or title_fold == name_fold:
        return True
    tokens = name_norm.split()
    if len(tokens) < 2:
        return False
    surname = tokens[-1]
    given_tokens = tokens[:-1]
    if surname not in title_norm and surname not in title_fold:
        return False
    if any(tok in title_norm or tok in title_fold for tok in given_tokens if len(tok) > 0):
        return True
    title_first = title_norm.split()[0] if title_norm.split() else ""
    name_first = given_tokens[0] if given_tokens else ""
    nickname_pairs = {
        ("alex", "alessandro"),
        ("alessandro", "alex"),
    }
    return (title_first, name_first) in nickname_pairs


def wiki_session() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"User-Agent": USER_AGENT})
    return sess


def extract_birth_from_snippet(snippet: str) -> tuple[str | None, int | None, bool]:
    text = html_lib.unescape(snippet or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    m = re.search(
        r"\bborn\s+((?:\d{1,2}\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2},\s+\d{4})|(?:\d{4}))",
        text,
        flags=re.IGNORECASE,
    )
    if not m:
        return None, None, False
    raw = m.group(1)
    iso = parse_birth_text(raw)
    if iso:
        return iso if len(iso) == 10 else None, int(iso[:4]), len(iso) == 10
    year_m = re.search(r"\b(19\d{2}|20\d{2})\b", raw)
    if year_m:
        return None, int(year_m.group(1)), False
    return None, None, False


def wiki_search(sess: requests.Session, query: str, limit: int = 5) -> list[dict]:
    r = sess.get(
        WIKI_API,
        params={
            "action": "query",
            "list": "search",
            "srsearch": query,
            "format": "json",
            "utf8": 1,
            "srlimit": limit,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("query", {}).get("search", [])


def page_url(title: str) -> str:
    return WIKI_PAGE + quote(title.replace(" ", "_"))


def page_html(sess: requests.Session, title: str) -> str:
    r = sess.get(page_url(title), timeout=30)
    r.raise_for_status()
    return r.text


def extract_birthday(html: str) -> tuple[str | None, int | None, bool, str]:
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(" ", strip=True)
    born_text = ""
    for tr in soup.select("table.infobox tr"):
        th = tr.find("th")
        if not th:
            continue
        label = th.get_text(" ", strip=True).lower()
        if label.startswith("born"):
            td = tr.find("td")
            if td:
                born_text = td.get_text(" ", strip=True)
                bday = td.select_one("span.bday")
                if bday:
                    iso = bday.get_text(strip=True)
                    if re.match(r"^\d{4}-\d{2}-\d{2}$", iso):
                        return iso, int(iso[:4]), True, born_text
                break
    if not born_text:
        m = re.search(
            r"\bborn\s+((?:\d{1,2}\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2},\s+\d{4})|(?:\d{4}))",
            page_text,
            flags=re.IGNORECASE,
        )
        if m:
            born_text = m.group(1)
    if not born_text:
        m = re.search(
            r"\((?:born\s+)?((?:\d{1,2}\s+[A-Za-z]+\s+\d{4})|(?:[A-Za-z]+\s+\d{1,2},\s+\d{4})|(?:\d{4}))\s*[–-]",
            page_text,
            flags=re.IGNORECASE,
        )
        if m:
            born_text = m.group(1)
    if born_text:
        iso = parse_birth_text(born_text)
        if iso:
            year = int(iso[:4])
            full = len(iso) == 10
            return iso if full else None, year, full, born_text
        year_m = re.search(r"\b(19\d{2}|20\d{2})\b", born_text)
        if year_m:
            return None, int(year_m.group(1)), False, born_text
    return None, None, False, born_text


def parse_birth_text(text: str) -> str | None:
    text = text.replace("\xa0", " ").strip()
    iso = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    if iso:
        return iso.group(1)
    m = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})", text)
    if m:
        day, month, year = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        if month in MONTHS:
            return f"{year:04d}-{MONTHS[month]:02d}-{day:02d}"
    m = re.search(r"([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})", text)
    if m:
        month, day, year = m.group(1).lower(), int(m.group(2)), int(m.group(3))
        if month in MONTHS:
            return f"{year:04d}-{MONTHS[month]:02d}-{day:02d}"
    return None


def page_is_driver(html: str, series: str, name: str) -> bool:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    if any(token in norm(title) for token in ["racing driver", "formula one", "indycar", "cart", "champ car"]):
        return True
    lead = ""
    for p in soup.select("div.mw-parser-output > p"):
        text = p.get_text(" ", strip=True)
        if text:
            lead = text
            break
    lead_norm = norm(lead)
    return any(token in lead_norm for token in ["racing driver", "formula one", "indycar", "cart", "champ car"])


def choose_candidate(sess: requests.Session, name: str, series: str) -> dict | None:
    for title in direct_title_variants(name):
        try:
            html = page_html(sess, title)
        except Exception:
            continue
        birth_date, birth_year, full, born_text = extract_birthday(html)
        if birth_date or birth_year:
            soup = BeautifulSoup(html, "html.parser")
            page_title = soup.title.get_text(" ", strip=True) if soup.title else title
            if title_matches_name(page_title, name):
                return {
                    "source_title": page_title,
                    "source_url": page_url(title),
                    "query": title,
                    "birth_date": birth_date,
                    "birth_year": birth_year,
                    "full_date": full,
                    "verified": True,
                    "confidence": 0.99 if full else 0.89,
                    "born_text": born_text,
                }
    queries = candidate_queries(name, series)
    ranked: list[tuple[int, dict, str]] = []
    target = norm(name)
    target_compact = compact(name)
    surname = target.split()[-1] if target else ""
    initials = "".join(part[0] for part in target.split()[:-1] if part)
    for q_idx, query in enumerate(queries):
        try:
            results = wiki_search(sess, query)
        except Exception:
            continue
        for r_idx, result in enumerate(results):
            title = result.get("title", "")
            ntitle = norm(title)
            ctitle = compact(title)
            score = 0
            if ntitle == target:
                score += 80
            if ctitle == target_compact:
                score += 70
            if surname and surname in ntitle:
                score += 20
            if initials and initials in compact(title):
                score += 20
            snippet = norm(result.get("snippet", ""))
            for token in ["racing driver", "formula one", "indycar", "cart", "champ car", "open-wheel"]:
                if token in snippet:
                    score += 8
            score -= q_idx * 2 + r_idx
            ranked.append((score, result, query))
    ranked.sort(key=lambda item: item[0], reverse=True)
    for score, result, query in ranked[:12]:
        title = result.get("title", "")
        if not title:
            continue
        snippet = result.get("snippet", "")
        birth_date, birth_year, full = extract_birth_from_snippet(snippet)
        if birth_date or birth_year:
            return {
                "source_title": title,
                "source_url": page_url(title),
                "query": query,
                "birth_date": birth_date,
                "birth_year": birth_year,
                "full_date": full,
                "verified": True,
                "confidence": 0.92 if full else 0.82,
                "born_text": snippet,
            }
        try:
            html = page_html(sess, title)
        except Exception:
            continue
        if not page_is_driver(html, series, name):
            continue
        birth_date, birth_year, full, born_text = extract_birthday(html)
        if birth_date or birth_year:
            return {
                "source_title": title,
                "source_url": page_url(title),
                "query": query,
                "birth_date": birth_date,
                "birth_year": birth_year,
                "full_date": full,
                "verified": True,
                "confidence": 0.98 if full else 0.88,
                "born_text": born_text,
            }
    return None


@dataclass
class DriverRequest:
    driver_id: str
    driver_name: str
    series: str


def existing_row_key(row: pd.Series | dict) -> tuple[str, str, str]:
    driver_id = str(row.get("driver_id") or row.get("driverId") or "").strip()
    canonical_name = str(row.get("canonical_name") or row.get("driverName") or "").strip()
    series = str(row.get("series") or "").strip()
    return driver_id, canonical_name, series


def load_requests() -> list[DriverRequest]:
    df = pd.read_csv(GAP_REPORT)
    if "dob" in df.columns:
        missing = df["dob"].isna() | (df["dob"].astype(str).str.strip() == "")
        df = df[missing].copy()
    grouped = (
        df.groupby(["driverId", "driverName"], as_index=False)
        .agg({"series": lambda s: "; ".join(sorted({part.strip() for series in s for part in str(series).split(";")}))})
        .sort_values(["driverName"])
    )
    out: list[DriverRequest] = []
    for _, row in grouped.iterrows():
        out.append(DriverRequest(str(row["driverId"]), str(row["driverName"]), str(row["series"])))
    return out


def load_existing_rows() -> dict[tuple[str, str, str], dict]:
    if not OUT_CSV.exists():
        return {}
    existing = pd.read_csv(OUT_CSV)
    rows: dict[tuple[str, str, str], dict] = {}
    for _, row in existing.iterrows():
        record = row.to_dict()
        key = existing_row_key(record)
        if any(key):
            rows[key] = record
    return rows


def scrape_one(req: DriverRequest) -> dict:
    sess = wiki_session()
    result = choose_candidate(sess, req.driver_name, req.series)
    if result is None:
        return {
            "driver_id": req.driver_id,
            "canonical_name": req.driver_name,
            "series": req.series,
            "birth_date": "",
            "birth_year": "",
            "source_url": "",
            "source_title": "",
            "confidence": 0.0,
            "verified": False,
            "status": "unresolved",
            "query_used": "",
        }
    return {
        "driver_id": req.driver_id,
        "canonical_name": req.driver_name,
        "series": req.series,
        "birth_date": result["birth_date"] or "",
        "birth_year": result["birth_year"] or "",
        "source_url": result["source_url"],
        "source_title": result["source_title"],
        "confidence": result["confidence"],
        "verified": bool(result["verified"]),
        "status": "full_date" if result["birth_date"] else "year_only",
        "query_used": result["query"],
    }


def main() -> None:
    requests_list = load_requests()
    existing_rows = load_existing_rows()
    rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(scrape_one, req) for req in requests_list]
        for fut in as_completed(futures):
            rows.append(fut.result())
    merged: dict[tuple[str, str, str], dict] = {}
    for row in existing_rows.values():
        merged[existing_row_key(row)] = row
    for row in rows:
        key = existing_row_key(row)
        prior = merged.get(key)
        if prior is None:
            merged[key] = row
            continue
        if prior.get("status") == "full_date":
            continue
        if row.get("status") == "full_date":
            merged[key] = row
            continue
        if prior.get("status") == "year_only" and row.get("status") == "year_only":
            if float(row.get("confidence") or 0.0) >= float(prior.get("confidence") or 0.0):
                merged[key] = row
            continue
        if prior.get("status") == "unresolved" and row.get("status") != "unresolved":
            merged[key] = row
            continue
    for row in MANUAL_OVERRIDES:
        driver_id = str(row["driver_id"]).strip()
        for key in [key for key in merged.keys() if key[0] == driver_id]:
            merged.pop(key, None)
        merged[existing_row_key(row)] = row
    rows = list(merged.values())
    rows.sort(key=lambda r: (r["canonical_name"].lower(), r["series"]))
    df = pd.DataFrame(rows)
    df.to_csv(OUT_CSV, index=False)
    df.to_excel(OUT_XLSX, index=False)
    summary = df["status"].value_counts().to_dict()
    print({"rows": len(df), "summary": summary, "output_csv": str(OUT_CSV), "output_xlsx": str(OUT_XLSX)})


if __name__ == "__main__":
    main()
