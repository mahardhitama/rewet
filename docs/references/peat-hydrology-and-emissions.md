# Peat hydrology and emissions: sourced values for Rewet

Checked 2026-11-10. Every value below was read in the opened document named next to it.

## Sources

| Key | Source | Access |
|---|---|---|
| R14 | Ritzema, H.P. et al. (2014). "Canal blocking strategies for hydrological restoration of degraded tropical peatlands in Central Kalimantan, Indonesia". *Catena* 114, 11–20. DOI 10.1016/j.catena.2013.10.009. Page numbers are post-print numbers. | PDF opened: https://edepot.wur.nl/282926 |
| IPCC13 | IPCC (2014). *2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands*. | PDF opened: https://www.ipcc.ch/site/assets/uploads/2018/03/Wetlands_Supplement_Entire_Report.pdf |
| IPCC06 | IPCC (2006). *2006 IPCC Guidelines for National Greenhouse Gas Inventories*, Volume 4 (AFOLU), Chapter 2 "Generic methodologies applicable to multiple land-use categories". | PDF opened 2026-11-11: https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf |
| PP57 | Peraturan Pemerintah No. 57 Tahun 2016 (Lembaran Negara 2016 No. 260). It changes PP 71/2014. | PDF opened 2026-11-10: https://peraturan.go.id/files/pp57-2016bt.pdf |

Every value in section 1 comes from R14 or IPCC13. On 2026-11-10 we read these again: R14 pages 2, 10 and 11, and IPCC13 Table 2.1 (oil palm and sago rows), Table 2.6 and Table 3.1. We read the other values in an earlier session. See `peat-restoration-concepts.md` for more facts with these keys.

## 1. Answer

### Canal drainage versus distance (Ritzema et al. 2014)

Source: Ritzema et al. 2014, Table 4 (post-print p.25): "Relation between the depth of the water table and the distance from Kalampangan Canal (average of transects T1, T2, T3 & T4 over the period September 2004 – April 2007)".

| Water-table depth (m) | 10 m | 100 m | 400 m | 1000 m |
|---|---|---|---|---|
| Dry season (Jul–Oct) | -0.88 | -0.54 | -0.35 | -0.33 |
| Rainy season (Nov–Apr) | -0.50 | -0.13 | -0.05 | -0.06 |
| Year | -0.56 | -0.24 | -0.12 | -0.15 |

Text from the same paper:
- p.8: "the water table close to the canals was 0.40-0.50 m deeper compared to the water table at a distance of 1000 m away from the canal".
- p.8: "in the dry season, the water tables are, on average, 0.30 m deeper than in the rainy season".

Scope: one canal (Kalampangan), Central Kalimantan, a mix of degraded and natural-forest transects, 2004–2007.

### Effect of dams (canal blocks) (Ritzema et al. 2014)

- p.8: after the dams were built, the "average water table along the transects T1, T2 and T3 varied between 0.26 to 0.35 m –GL, significantly higher than before the construction of the dams when it varied between 1.02 and 1.22 m –GL".
- p.8: "In the following dry season … the water tables dropped again to well below 0.40 m indicating that the dams cannot maintain high water tables during prolonged dry periods … lateral seepage along and below the dams."
- p.10: "the average water table along the transects rose from 1.12 m - GL to 0.37 m - GL, water tables in the dry season may still fall to below 1 m - GL."
- p.11: the "head difference over the dam … should be kept to a minimum (< 0.5 m). Consequently a cascade of multiple robust dams, each with a bypass, is required."

### Subsidence and fire risk (Ritzema et al. 2014)

- p.2: "subsidence rate (cm per year) = 0.1 x depth of the water table (cm) (Wösten and Ritzema, 2001)".
- p.2: "fire risk increases if the water table falls below 0.40 m (Wösten et al., 2008)".

### IPCC 2013 Wetlands Supplement: CO2 from drained tropical organic soils

Source: Table 2.1, "Tier 1 CO2 emission/removal factors for drained organic soils in all land-use categories". Units: t CO2-C ha⁻¹ yr⁻¹.

| Land use (tropical) | Emission factor | 95% CI | Page |
|---|---|---|---|
| Plantations, drained, oil palm | 11 | 5.6–17 | 2.12 |
| Plantations, drained, short rotations (e.g. acacia) | 20 | 16–24 | 2.12 |
| Plantations, drained, unknown or long rotations | 15 | 10–21 | 2.12 |
| Plantations, shallow-drained (<0.3 m), e.g. sago palm | 1.5 | -2.3–5.4 | 2.12 |
| Cropland and fallow, drained | 14 | 6.6–26 | 2.13 |
| Cropland, drained, paddy rice | 9.4 | -0.2–20 | 2.13 |
| Grassland, drained | 9.6 | 4.5–17 | 2.14 |

### IPCC 2013 Wetlands Supplement: rewetted tropical organic soils

Source: Table 3.1, p.3.12.
- Tropical EF_CO2 = 0, in tonnes CO2-C ha⁻¹ yr⁻¹.
- Footnote: "For tropical rewetted organic soils where decayed organic material is not oxidised due to saturated conditions."

### IPCC 2013 Wetlands Supplement: peat fires

- Table 2.6, p.2.40: fuel consumption for a tropical "Wildfire (drained peat)" is 353 t d.m. ha⁻¹ (95% CI 170–536).
- Table 2.7, p.2.41: emission factors for a tropical organic-soil fire, in g kg⁻¹ dry matter burnt: 464 (column "CO2-C"), CO 210, CH4 21.

### C to CO2 conversion (IPCC 2006 Guidelines)

- IPCC06 Vol 4 Section 2.2.3, p.2.11: "The conversion to CO2 from C, is based on the ratio of molecular weights (44/12)."
- Value: 1 t C = 44/12 t CO2 ≈ 3.667 t CO2. Example: 1 burnt tile = 0.25 ha × 353 t d.m. ha⁻¹ × 0.464 = 40.95 t C = 40.95 × 44/12 = 150.1 t CO2.
- Conditions (same section): if a large part of the carbon goes out as CO or CH4, subtract that carbon first. The game converts only CO2-C values (Table 2.1 and the Table 2.7 "CO2-C" column), so no subtraction applies.
- Current version: 2019 Refinement, Vol 4 Chapter 2, Section 2.2.3, p.2.13 has the same text (opened 2026-11-11).

**Scope:** Tier 1 defaults. Table 2.1 covers on-site CO2 only; DOC (dissolved organic carbon), CH4 and N2O are separate.

**Current version:** 2013 Wetlands Supplement (IPCC). The 2019 Refinement was NOT CHECKED for changes to wetlands organic-soil factors.

## 2. Cite lines

- Ritzema, H.P.; Limin, S.; Kusin, K.; Jauhiainen, J.; Wösten, H. (2014). Canal blocking strategies for hydrological restoration of degraded tropical peatlands in Central Kalimantan, Indonesia. Catena 114, 11–20. https://doi.org/10.1016/j.catena.2013.10.009. Post-print (WUR eDepot): Table 4 p.25; text pp.2, 8, 10, 11.
- IPCC (2006). 2006 IPCC Guidelines for National Greenhouse Gas Inventories, Volume 4, Chapter 2, Section 2.2.3, p.2.11: C to CO2 by the ratio of molecular weights, 44/12.
- IPCC (2014). 2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands. Table 2.1 pp.2.12–2.14; Table 2.6 p.2.40; Table 2.7 p.2.41; Table 3.1 p.3.12.

## 3. Not sourced

- **Indonesian 0.4 m damage criterion** (PP 71/2014 as amended by PP 57/2016, Art. 23): SOURCED on 2026-11-10 (PP57 PDF page 11).
  - Article 23(3)(a) says a peat ecosystem with a cultivation function is damaged when the water table is "lebih dari 0,4 (nol koma empat) meter di bawah permukaan Gambut pada titik penaatan".
  - Article 23(3)(b) adds exposed pyrite or quartz sediment under the peat.
  - Source: https://peraturan.go.id/files/pp57-2016bt.pdf (the earlier attempt used the wrong file name). The text applies to the cultivation function only.
  - Not checked: a later amendment of the article.
- **C-to-CO2 conversion (44/12):** SOURCED on 2026-11-11 (IPCC06 Vol 4 Section 2.2.3, p.2.11). See section 1.
- **Exponential decay fit** (L ≈ 100 m dry, ≈ 45 m wet): my own fit to Table 4, not a published parameter.
- **How leaky a blocked canal is** (fraction of drainage kept): game tuning. Calibrated against the 1.12 → 0.37 m result above, not a published value.

## 4. Sources

- https://edepot.wur.nl/282926: downloaded 2026-11-10, read with `pdftotext -layout`.
- https://www.ipcc.ch/site/assets/uploads/2018/03/Wetlands_Supplement_Entire_Report.pdf: downloaded 2026-11-10, read with `pdftotext -layout`; pages confirmed from the page footers.
- https://faolex.fao.org/docs/pdf/ins174419.pdf: downloaded 2026-11-10, read with `pdftotext`.
- https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_02_Ch2_Generic.pdf: downloaded 2026-11-11, read with `pdftotext -layout`; page from the page footer.
- https://www.ipcc-nggip.iges.or.jp/public/2019rf/pdf/4_Volume4/19R_V4_Ch02_Generic%20Methods.pdf: downloaded 2026-11-11, read with `pdftotext -layout`; page from the table of contents.
- https://peraturan.go.id/files/pp57-2016bt.pdf: downloaded 2026-11-10, read with `pdftotext -layout`. Article 23 is on PDF page 11.
- Tried and failed: https://peraturan.bpk.go.id/Details/5768/pp-no-57-tahun-2016 (bot check), https://peraturan.go.id/files/pp57-2016.pdf (returned an HTML page, not the PDF).
- Search used to find the sources (not cited): Mongabay, "Catatan Hukum Peraturan Gambut: Lama vs Baru" (2016).
