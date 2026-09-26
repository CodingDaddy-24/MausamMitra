# Administrative GeoJSON sources

The India boundary assets are retained from the workspace's supplied `Maps` directory. Each dataset's upstream `metadata.json` is stored with the corresponding GeoJSON under `data/geojson/india/`.

| Level | Dataset | Metadata source and license | Usage notes |
| --- | --- | --- | --- |
| ADM0 | `IND_ADM0.geojson` | OpenStreetMap; Wambacher OSM boundaries site; ODbL; metadata dated 2018-08-17 | Attribute OpenStreetMap and comply with ODbL, including applicable share-alike requirements. |
| ADM1 | `IND_ADM1.geojson` | OpenStreetMap; Wambacher OSM boundaries site; ODbL; metadata dated 2018-08-17 | Attribute OpenStreetMap and comply with ODbL, including applicable share-alike requirements. |
| ADM2 | `IND_ADM2.geojson` | Datameet Group of India; metadata links to <http://projects.datameet.org/maps/districts/> and says “Creative Commons 2.0”; metadata dated 2018-08-17 | Verify the exact license and current source terms before redistribution or production use. The provided label is not specific enough to determine conditions. |

Metadata lists 2017 for ADM0/ADM1 and 2011 for ADM2. These boundaries should not be assumed to reflect current administrative changes. Preserve source attribution and license records when transforming or redistributing the data. The OSM tile service is separate from these boundary datasets and has its own usage policy and attribution requirements.
