"""
Parses a sample of the Texas RRC "Wellbore Query Data" CSV export
(OG_WELLBORE_EWA_Report.csv) into JSON records.

Column order is taken directly from RRC's own published data dictionary,
"RRC Online Oil and Gas Queries, Wellbore Query Data" (rev. 11/01/2013),
https://www.rrc.texas.gov/media/di1mm5or/og_wellbore_ewadefinitionmanual2013-10-30_subscription.pdf
"File Definitions" table, listing all 59 columns in order. Verified against
a real sample: 59 comma-separated fields per row, matching the manual's
count exactly, with values (county names, operator names, status strings)
lining up with each column's documented meaning.

Note: this is the "current wells" analog to the drilling-permit file
(tx_rrc_parse.py) - one row per wellbore, not one row per permit application.
The full file is ~450+ MB and updates monthly; only a small byte-range
sample was pulled for this preview, not the whole file.
"""
import csv
import io
import json
import sys

COLUMNS = [
    "district", "county_code", "api_no", "county_name", "oil_gas_code",
    "lease_name", "field_number", "field_name", "lease_number",
    "well_no_display", "oil_unit_number", "operator_name", "operator_number",
    "wb_water_land_code", "multi_comp_flag", "api_depth", "wb_shut_in_date",
    "wb_14b2_flag", "well_status", "wl_shut_in_date", "plug_date",
    "plug_lease_name", "plug_operator_name", "recent_permit",
    "recent_permit_lease_name", "recent_permit_operator_no", "on_schedule",
    "og_wellbore_ewa_id", "w2_g1_filed_date", "w2_g1_date", "completion_date",
    "w3_file_date", "created_by", "created_dt", "modified_by", "modified_dt",
    "well_no", "p5_renewal_month", "p5_renewal_year", "p5_org_status",
    "curr_inact_yrs", "curr_inact_mos", "wl_14b2_ext_status",
    "wl_14b2_mech_integ", "wl_14b2_plg_ord_sf", "wl_14b2_pollution",
    "wl_14b2_fldops_hold", "wl_14b2_h15_prob", "wl_14b2_h15_delq",
    "wl_14b2_oper_delq", "wl_14b2_dist_sfp", "wl_14b2_dist_sf_clnup",
    "wl_14b2_dist_st_plg", "wl_14b2_good_faith", "wl_14b2_well_other",
    "surf_eqp_viol", "w3x_viol", "h15_status_code", "orig_completion_dt",
]

ZIP_ENTRY_MARKER = b"OG_WELLBORE_EWA_Report.csv"


def load_rows(path: str):
    with open(path, "rb") as f:
        raw = f.read()
    idx = raw.find(ZIP_ENTRY_MARKER)
    text = raw[idx + len(ZIP_ENTRY_MARKER):].decode("latin-1", errors="replace")
    # last line in a byte-range sample is very likely truncated mid-record; drop it
    lines = text.split("\n")[:-1]
    reader = csv.reader(lines)
    for row in reader:
        if len(row) == len(COLUMNS):
            yield dict(zip(COLUMNS, (v.strip() for v in row)))


def standard_api(county_code: str, api_no: str) -> str | None:
    if not county_code or not api_no or len(api_no) < 5:
        return None
    return f"42-{county_code}-{api_no[-5:]}"


def main(path: str, limit: int | None = None):
    records = []
    for row in load_rows(path):
        row["standard_api_number"] = standard_api(row["county_code"], row["api_no"])
        records.append(row)
        if limit and len(records) >= limit:
            break

    out = {
        "source": "Railroad Commission of Texas - Wellbore Query Data (OG_WELLBORE_EWA_Report.csv)",
        "source_url": "https://www.rrc.texas.gov/resource-center/research/data-sets-available-for-download/",
        "layout_manual": "https://www.rrc.texas.gov/media/di1mm5or/og_wellbore_ewadefinitionmanual2013-10-30_subscription.pdf",
        "downloaded_via": "RRC's sanctioned bulk-download portal (mft.rrc.texas.gov); full file is ~450+MB, only a byte-range sample was read for this preview",
        "count": len(records),
        "records": records,
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
    main(path, limit)
