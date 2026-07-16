"""Unit tests for the pure transform helpers in ok_hf_laterals.

These cover the parsing/shaping logic that turns a raw OCC ArcGIS feature into a
staging row — the layer where data bugs actually live (and where we hit real
issues during the first live load: duplicate lateral vertices, laterals with a
blank county, and multi-notice wells). No network or DB is touched.
"""
import ok_hf_laterals as ok


# --------------------------------------------------------------------------- #
# format_api
# --------------------------------------------------------------------------- #
class TestFormatApi:
    def test_numeric_api_is_dashed(self):
        # OCC serves the API as a number; 10 digits -> state-county-well.
        assert ok.format_api(3509920678) == "35-099-20678"

    def test_float_and_string_inputs_match(self):
        assert ok.format_api(3509920678.0) == "35-099-20678"
        assert ok.format_api("3509920678") == "35-099-20678"

    def test_short_number_is_zero_padded(self):
        assert ok.format_api(12345) == "00-000-12345"

    def test_none_and_empty_return_none(self):
        assert ok.format_api(None) is None
        assert ok.format_api("") is None

    def test_non_numeric_returns_none(self):
        assert ok.format_api("not-a-number") is None


# --------------------------------------------------------------------------- #
# epoch_ms_to_date
# --------------------------------------------------------------------------- #
class TestEpochMsToDate:
    def test_known_epoch(self):
        # 1704067200000 ms == 2024-01-01 00:00:00 UTC
        assert ok.epoch_ms_to_date(1704067200000) == "2024-01-01"

    def test_unix_zero_is_epoch_day(self):
        # 0 is a real timestamp, not "missing" — must not be treated as null.
        assert ok.epoch_ms_to_date(0) == "1970-01-01"

    def test_string_epoch_is_accepted(self):
        assert ok.epoch_ms_to_date("1704067200000") == "2024-01-01"

    def test_none_and_empty_return_none(self):
        assert ok.epoch_ms_to_date(None) is None
        assert ok.epoch_ms_to_date("") is None

    def test_garbage_returns_none(self):
        assert ok.epoch_ms_to_date("abc") is None


# --------------------------------------------------------------------------- #
# _to_int
# --------------------------------------------------------------------------- #
class TestToInt:
    def test_int_string_and_float(self):
        assert ok._to_int(5) == 5
        assert ok._to_int("5") == 5
        assert ok._to_int("5.0") == 5

    def test_truncates_float(self):
        assert ok._to_int(5.9) == 5

    def test_none_empty_garbage(self):
        assert ok._to_int(None) is None
        assert ok._to_int("") is None
        assert ok._to_int("abc") is None


# --------------------------------------------------------------------------- #
# linestring_wkt
# --------------------------------------------------------------------------- #
class TestLinestringWkt:
    def test_basic_polyline(self):
        geom = {"paths": [[[-97.2, 34.5], [-97.25, 34.53]]]}
        assert ok.linestring_wkt(geom) == "LINESTRING(-97.2 34.5, -97.25 34.53)"

    def test_consecutive_duplicate_vertices_are_dropped(self):
        geom = {"paths": [[[1, 1], [1, 1], [2, 2]]]}
        assert ok.linestring_wkt(geom) == "LINESTRING(1 1, 2 2)"

    def test_single_point_returns_none(self):
        assert ok.linestring_wkt({"paths": [[[1, 1]]]}) is None

    def test_all_duplicate_points_collapse_to_none(self):
        # collapses to a single distinct point -> not a valid line
        assert ok.linestring_wkt({"paths": [[[1, 1], [1, 1]]]}) is None

    def test_longest_path_is_chosen(self):
        geom = {
            "paths": [
                [[0, 0], [1, 1]],
                [[0, 0], [1, 1], [2, 2], [3, 3]],
            ]
        }
        assert ok.linestring_wkt(geom) == "LINESTRING(0 0, 1 1, 2 2, 3 3)"

    def test_missing_or_empty_geometry_returns_none(self):
        assert ok.linestring_wkt(None) is None
        assert ok.linestring_wkt({}) is None
        assert ok.linestring_wkt({"paths": []}) is None


# --------------------------------------------------------------------------- #
# transform
# --------------------------------------------------------------------------- #
def _feature(**attr_overrides):
    """A representative OCC HF_LATERALS feature, overridable per test."""
    attrs = {
        "oid": 1,
        "api": 3509920678,
        "wellname": "OAK BARREL 1-36-25-24XHW",
        "opname": "CONTINENTAL RESOURCES INC",
        "opnum": "3186",
        "county": "Murray",
        "shl_lat": 34.505115,
        "shl_long": -97.249864,
        "bhl_lat": 34.530228,
        "bhl_long": -97.248683,
        "datum": "NAD27",
        "sec": 1,
        "twn": "01S",
        "rng": "01W",
        "meridian": "IM",
        "servco": "GORE NITROGEN",
        "date_sub": 1704067200000,  # 2024-01-01
        "start_date": None,
        "end_date": None,
        "flow_date": None,
        "fm": "WOODFORD",
        "stages_no": 34,
    }
    attrs.update(attr_overrides)
    return {"attributes": attrs, "geometry": {"paths": [[[-97.25, 34.505], [-97.248, 34.530]]]}}


class TestTransform:
    def test_maps_core_fields(self):
        row = ok.transform(_feature())
        assert row["oid"] == 1
        assert row["api"] == "35-099-20678"
        assert row["well_name"] == "OAK BARREL 1-36-25-24XHW"
        assert row["operator_name"] == "CONTINENTAL RESOURCES INC"
        assert row["county"] == "Murray"
        assert row["bhl_latitude"] == 34.530228
        assert row["stages"] == 34
        assert row["submitted_date"] == "2024-01-01"
        assert row["path_wkt"] == "LINESTRING(-97.25 34.505, -97.248 34.53)"

    def test_blank_and_whitespace_strings_become_none(self):
        row = ok.transform(_feature(county="", wellname="   ", fm=None))
        assert row["county"] is None
        assert row["well_name"] is None
        assert row["formation"] is None

    def test_county_can_be_none(self):
        # A lateral with coordinates but no county must still transform cleanly
        # (it plots on the map; it's excluded from county matching downstream).
        row = ok.transform(_feature(county=None))
        assert row["county"] is None
        assert row["bhl_latitude"] is not None

    def test_missing_attributes_do_not_raise(self):
        row = ok.transform({"attributes": {}, "geometry": None})
        assert row["api"] is None
        assert row["county"] is None
        assert row["path_wkt"] is None

    def test_raw_attributes_are_preserved(self):
        feature = _feature()
        row = ok.transform(feature)
        assert row["raw"] == feature["attributes"]
