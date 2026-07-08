"""
Parses the Texas RRC "Drilling Permit Master and Trailer" fixed-width bulk file
(daf420.dat) into JSON records.

Field positions below are taken directly from the RRC's own published layout
manual (OGA049, "Drilling Permit Master Tapes / Magnetic Tape User's Guide"),
https://www.rrc.texas.gov/media/ezxjqdmn/oga049.pdf, sections "01 - DRILLING
PERMIT ROOT" (record type 01 / DAROOT) and "02 - DRILLING PERMIT MASTER"
(record type 02 / DAPERMIT). Positions are 1-indexed in the manual, as in
COBOL copybooks; this parser converts to 0-indexed Python slices.

Verified by decoding a real sample file (see field-by-field walkthrough in
session notes) - status number, county code, lease name, district, operator
number, application-received date, and operator name all lined up exactly
with the manual's stated positions.

Record types found in the file, per the manual's "MASTER FILE TAPE" table:
  01 DAROOT     - status of the W-1 application (this parser: full)
  02 DAPERMIT   - approved permit detail incl. API number (this parser: full)
  03 DAFIELD, 05 DAFLDBHL, 06 DACANRES, etc. - field/restriction detail
     (not parsed here; passed through as raw text)
"""
import json
import sys
from datetime import date


def field(line: str, pos: int, length: int) -> str:
    """pos is 1-indexed per the COBOL copybook."""
    return line[pos - 1 : pos - 1 + length].strip()


def parse_date(line: str, century_pos: int) -> str | None:
    century = field(line, century_pos, 2)
    year = field(line, century_pos + 2, 2)
    month = field(line, century_pos + 4, 2)
    day = field(line, century_pos + 6, 2)
    if not (century and year and month and day):
        return None
    try:
        y = int(century) * 100 + int(year)
        return date(y, int(month), int(day)).isoformat()
    except ValueError:
        return None


STATUS_FLAG_MEANINGS = {
    "P": "Pending approval",
    "A": "Approved",
    "W": "Withdrawn",
    "D": "Dismissed",
    "E": "Denied",
    "C": "Closed",
    "O": "Other",
    "X": "Deleted",
    "Z": "Cancelled",
}

APPLICATION_TYPE_MEANINGS = {
    "01": "Drill",
    "02": "Deepen below casing",
    "03": "Deepen within casing",
    "04": "Plug back",
    "05": "Other",
    "06": "Amended drill",
    "07": "Re-enter",
    "08": "Sidetrack",
    "09": "Field transfer",
    "10": "Amended prior to 1977",
    "11": "Drill direct sidetrack",
    "12": "Drill horizontal",
    "13": "Sidetrack horizontal",
    "14": "Recompletion",
    "15": "Reclass",
}


def parse_root(line: str) -> dict:
    return {
        "record_type": "01_root",
        "status_number": field(line, 3, 7),
        "status_sequence_number": field(line, 10, 2),
        "county_code": field(line, 12, 3),
        "lease_name": field(line, 15, 32),
        "district": field(line, 47, 2),
        "operator_number": field(line, 49, 6),
        "application_received_date": parse_date(line, 59),
        "operator_name": field(line, 67, 32),
        "status_of_application": STATUS_FLAG_MEANINGS.get(field(line, 101, 1)),
        "permit_number": field(line, 113, 7),
        "issue_date": parse_date(line, 120),
        "withdrawn_date": parse_date(line, 128),
        "well_number": field(line, 157, 6),
    }


def parse_permit(line: str) -> dict:
    surface_acres_raw = field(line, 326, 8)
    return {
        "record_type": "02_permit",
        "permit_number": field(line, 3, 7),
        "permit_sequence_number": field(line, 10, 2),
        "county_code": field(line, 12, 3),
        "lease_name": field(line, 15, 32),
        "district": field(line, 47, 2),
        "well_number": field(line, 49, 6),
        "total_depth_ft": field(line, 55, 5),
        "operator_number": field(line, 60, 6),
        "application_type": APPLICATION_TYPE_MEANINGS.get(field(line, 66, 2)),
        "zip_code": f"{field(line, 104, 5)}-{field(line, 109, 4)}".strip("-"),
        "onshore_county_code": field(line, 119, 3),
        "received_date": parse_date(line, 122),
        "permit_issued_date": parse_date(line, 130),
        "permit_amended_date": parse_date(line, 138),
        "permit_extended_date": parse_date(line, 146),
        "spud_date": parse_date(line, 154),
        "surface_casing_date": parse_date(line, 162),
        "well_status_code": field(line, 170, 1),
        "expired_date": parse_date(line, 179),
        "cancelled_date": parse_date(line, 187),
        "cancellation_reason": field(line, 195, 30) or None,
        "rule_37_case_number": field(line, 229, 7),
        "rule_38_docket_number": field(line, 236, 7),
        "surface_location_raw": field(line, 244, 82),
        "surface_acres": (
            int(surface_acres_raw) / 100 if surface_acres_raw.isdigit() else None
        ),
        "nearest_city": field(line, 346, 13),
        "spud_in": field(line, 481, 1) == "Y",
        "directional_well": field(line, 482, 1) == "Y",
        "sidetrack_well": field(line, 483, 1) == "Y",
        "horizontal_well": field(line, 494, 1) == "Y",
        "api_number": f"42-{field(line, 503, 8)}" if field(line, 503, 8) else None,
    }


def main(path: str, limit: int | None = None):
    records = {"01_root": [], "02_permit": [], "other": []}
    other_type_counts: dict[str, int] = {}

    with open(path, "r", encoding="latin-1", newline="") as f:
        for raw_line in f:
            line = raw_line.rstrip("\r\n")
            if not line:
                continue
            rec_id = line[0:2]
            if rec_id == "01":
                records["01_root"].append(parse_root(line))
            elif rec_id == "02":
                records["02_permit"].append(parse_permit(line))
            else:
                other_type_counts[rec_id] = other_type_counts.get(rec_id, 0) + 1
                if limit is None or len(records["other"]) < 20:
                    records["other"].append({"record_type": rec_id, "raw": line[:120]})

    if limit:
        records["01_root"] = records["01_root"][:limit]
        records["02_permit"] = records["02_permit"][:limit]

    out = {
        "source": "Railroad Commission of Texas - Drilling Permit Master and Trailer (daily bulk file, daf420.dat)",
        "source_url": "https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/",
        "layout_manual": "https://www.rrc.texas.gov/media/ezxjqdmn/oga049.pdf",
        "downloaded_via": "RRC's sanctioned bulk-download portal (mft.rrc.texas.gov), not the interactive query UI",
        "counts": {
            "01_root": len(records["01_root"]),
            "02_permit": len(records["02_permit"]),
            "other_record_types_skipped": other_type_counts,
        },
        "records": records,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    main(path, limit)
