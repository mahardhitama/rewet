# Peat hydrology and emissions: sourced values for Rewet

Checked 2026-11-10. Every value below was read in the opened document named next to it.

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

**Scope:** Tier 1 defaults. Table 2.1 covers on-site CO2 only; DOC (dissolved organic carbon), CH4 and N2O are separate.

**Current version:** 2013 Wetlands Supplement (IPCC). The 2019 Refinement was NOT CHECKED for changes to wetlands organic-soil factors.

## 2. Cite lines

- Ritzema, H.P.; Limin, S.; Kusin, K.; Jauhiainen, J.; Wösten, H. (2014). Canal blocking strategies for hydrological restoration of degraded tropical peatlands in Central Kalimantan, Indonesia. Catena 114, 11–20. https://doi.org/10.1016/j.catena.2013.10.009. Post-print (WUR eDepot): Table 4 p.25; text pp.2, 8, 10, 11.
- IPCC (2014). 2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands. Table 2.1 pp.2.12–2.14; Table 2.6 p.2.40; Table 2.7 p.2.41; Table 3.1 p.3.12.

## 3. Not sourced

- **Indonesian 0.4 m damage criterion** (PP 71/2014 as amended by PP 57/2016, Art. 23): NOT SOURCED.
  - peraturan.bpk.go.id returned a bot-check page.
  - peraturan.go.id failed with a TLS error.
  - The ministerial regulation P.15/MENLHK/SETJEN/KUM.1/2/2017 (FAOLEX ins174419), which was opened, cites Art. 23 but does not state 0.4 m.
  - Only secondary press (Mongabay) gives the value. **Need the PP 57/2016 PDF.**
- **C-to-CO2 conversion (44/12):** NOT SOURCED here. It isn't stated in the opened Wetlands Supplement text. Needed if the game shows CO2 rather than CO2-C.
- **Exponential decay fit** (L ≈ 100 m dry, ≈ 45 m wet): my own fit to Table 4, not a published parameter.
- **How leaky a blocked canal is** (fraction of drainage kept): game tuning. Calibrated against the 1.12 → 0.37 m result above, not a published value.

## 4. Sources

- https://edepot.wur.nl/282926: downloaded 2026-11-10, read with `pdftotext -layout`.
- https://www.ipcc.ch/site/assets/uploads/2018/03/Wetlands_Supplement_Entire_Report.pdf: downloaded 2026-11-10, read with `pdftotext -layout`; pages confirmed from the page footers.
- https://faolex.fao.org/docs/pdf/ins174419.pdf: downloaded 2026-11-10, read with `pdftotext`.
- Tried and failed: https://peraturan.bpk.go.id/Details/5768/pp-no-57-tahun-2016 (bot check), https://peraturan.go.id/files/pp57-2016.pdf (TLS).
- Search used to find the sources (not cited): Mongabay, "Catatan Hukum Peraturan Gambut: Lama vs Baru" (2016).
