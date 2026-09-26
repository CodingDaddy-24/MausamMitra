import json
from functools import lru_cache

from .config import get_settings

REGIONS = {
    "Northern India": {"Jammu and Kashmir", "Ladakh", "Himachal Pradesh", "Punjab", "Chandigarh", "Uttarakhand", "Haryana", "Delhi", "Rajasthan", "Uttar Pradesh"},
    "Western India": {"Gujarat", "Maharashtra", "Goa", "Dadra and Nagar Haveli and Daman and Diu"},
    "Central India": {"Madhya Pradesh", "Chhattisgarh"},
    "Eastern India": {"Bihar", "Jharkhand", "Odisha", "West Bengal"},
    "Southern India": {"Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry"},
    "North Eastern India": {"Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Sikkim", "Tripura"},
    "Island Territories": {"Andaman and Nicobar Islands", "Lakshadweep"},
}


def _name(properties: dict) -> str | None:
    return properties.get("Name") or properties.get("NAME")


@lru_cache(maxsize=1)
def read_boundaries() -> tuple[dict, dict, dict[str, str]]:
    root = get_settings().geojson_dir
    with (root / "IND_ADM1.geojson").open(encoding="utf-8") as stream:
        states = json.load(stream)
    with (root / "IND_ADM2.geojson").open(encoding="utf-8") as stream:
        districts = json.load(stream)
    state_names = {_name(feature["properties"]) for feature in states["features"]}
    state_names.discard(None)
    state_names.discard("Jammu & Kashmir")
    state_names.add("Jammu and Kashmir")
    return states, districts, {name: name for name in state_names}


def _rings(geometry: dict):
    kind, coords = geometry["type"], geometry["coordinates"]
    if kind == "Polygon":
        yield coords
    elif kind == "MultiPolygon":
        yield from coords


def _center(feature: dict) -> tuple[float, float] | None:
    polygon_rings = list(_rings(feature["geometry"]))
    if not polygon_rings:
        return None
    outer = max((rings[0] for rings in polygon_rings if rings), key=len, default=[])
    if not outer:
        return None
    return sum(p[0] for p in outer[:-1] or outer) / len(outer[:-1] or outer), sum(p[1] for p in outer[:-1] or outer) / len(outer[:-1] or outer)


def _contains(ring: list, lon: float, lat: float) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (x1, y1) in enumerate(ring):
        x2, y2 = ring[j]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / ((y2 - y1) or 1e-12) + x1:
            inside = not inside
        j = i
    return inside


def _feature_contains(feature: dict, lon: float, lat: float) -> bool:
    return any(rings and _contains(rings[0], lon, lat) and not any(_contains(hole, lon, lat) for hole in rings[1:]) for rings in _rings(feature["geometry"]))


@lru_cache(maxsize=1)
def state_districts() -> dict[str, list[str]]:
    states, districts, _ = read_boundaries()
    state_features = [(_name(feature["properties"]), feature) for feature in states["features"]]
    output = {str(name): [] for name, _ in state_features if name}
    for feature in districts["features"]:
        name = _name(feature["properties"])
        center = _center(feature)
        if not name or center is None:
            continue
        matches = [state for state, geometry in state_features if state and _feature_contains(geometry, *center)]
        if matches:
            output[matches[0]].append(name)
    # Source names use the 2011-era Jammu & Kashmir outline; the state's modern administrative status is not represented.
    return {key: sorted(set(value), key=str.casefold) for key, value in output.items()}


def normalized_state(name: str) -> str:
    return "Jammu & Kashmir" if name == "Jammu and Kashmir" else name


def list_regions() -> list[str]:
    return list(REGIONS)


def list_states(region: str) -> list[str]:
    _, _, lookup = read_boundaries()
    permitted = REGIONS.get(region, set())
    return sorted((name for name in lookup if name in permitted), key=str.casefold)


def list_districts(state: str) -> list[str]:
    return state_districts().get(normalized_state(state), [])


def district_feature(name: str) -> dict | None:
    _, districts, _ = read_boundaries()
    return next((feature for feature in districts["features"] if (_name(feature["properties"]) or "").casefold() == name.casefold()), None)


def district_feature_in_state(name: str, state: str) -> dict | None:
    states, districts, _ = read_boundaries()
    state_name = normalized_state(state)
    state_feature = next((feature for feature in states["features"] if _name(feature["properties"]) == state_name), None)
    if state_feature is None:
        return None
    return next((feature for feature in districts["features"] if (_name(feature["properties"]) or "").casefold() == name.casefold() and (center := _center(feature)) is not None and _feature_contains(state_feature, *center)), None)
