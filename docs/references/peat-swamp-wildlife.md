# Peat swamp wildlife

Animals that the game can show on restored tiles. Each species has a record in a survey of tropical peat swamp forest in Central Kalimantan.

Date of the search: 2026-11-10.

## Sources

| Key | Source | Access |
|---|---|---|
| H18 | Husson, S.J. et al. (2018). "Biodiversity of the Sebangau tropical peat swamp forest, Indonesian Borneo". *Mires and Peat* 22, Article 05, 1–50. DOI 10.19189/MaP.2018.OMB.352 | PDF opened: https://mires-and-peat.scholasticahq.com/article/128947.pdf |
| C19 | Cheyne, S.M. et al. (2019). "Home range variation and site fidelity of Bornean southern gibbons [*Hylobates albibarbis*] from 2010-2018". *PLoS ONE* 14(7): e0217784. DOI 10.1371/journal.pone.0217784 | PDF opened: https://radar.brookes.ac.uk/radar/file/bb3992c9-738c-4ba0-9206-521ceb3a76cf/1/journal.pone.0217784.pdf |
| PIN | Primate Info Net factsheet "Orangutan" (*Pongo*), Wisconsin National Primate Research Center | https://primate.wisc.edu/primate-info-net/pin-factsheets/pin-factsheet-orang-utan/ |
| KMP | Kompas.com (2023). Lists of protected mammals and birds in Indonesia, from Permen LHK P.20/MENLHK/SETJEN/KUM.1/6/2018 | https://lestari.kompas.com/read/2023/06/19/180000686/daftar-satwa-mamalia-yang-dilindungi-di-indonesia and https://lestari.kompas.com/read/2023/06/21/120000086/daftar-lengkap-562-jenis-burung-yang-dilindungi-di-indonesia |
| WP | English Wikipedia species pages (one per species, URL in each block). We used them only for the current IUCN status with its assessment citation, and for behaviour. | See each block |

### Notes on the sources

- **Presence.** H18 is the main source for presence. The site is the Natural Laboratory of Peat Swamp Forest (NLPSF), 500 km², in the 7,347 km² Sebangau peat dome (H18 page 2, "Study site"). All 11 species are in the H18 appendix tables.
- **IUCN status.** The IUCN Red List site (iucnredlist.org) returned HTTP 403 to our fetch tool. We could not open the IUCN pages directly. The "IUCN now" status comes from the IUCN citation on each Wikipedia page. This is a secondary source. Check each status on iucnredlist.org before you show it to the player.
- **Indonesian names.** Wikipedia text gives "beruang madu" and "gabus". KMP gives Indonesian names without scientific names. We matched those by name only. The other Indonesian names are `NOT SOURCED`. A Wikipedia language-link title is not a source.
- **Other areas.** H18 covers Sebangau only. We did not open a fauna survey for the Ex-Mega Rice Project area, Kahayan–Kapuas or Mentangai. Presence in those areas is `NOT SOURCED`.

## Species

Game values: the game designer will set the habitat thresholds (for example, tree cover or `wt` limits). Each threshold in this file is `game value, NOT SOURCED`.

### 1. Bornean orangutan

| Field | Value | Source |
|---|---|---|
| English name | Bornean orangutan (subspecies: Central Bornean orangutan) | H18 Table A10 page 49; WP |
| Indonesian name | orangutan kalimantan, or mawas kalimantan | KMP mammal list, entry 62 (name match only) |
| Scientific name | *Pongo pygmaeus wurmbii* | H18 Table A10 page 49 |
| IUCN in H18 | CR | H18 Table A10 page 49 |
| IUCN now | Critically Endangered, Ancrenaz et al. assessment 2023 (amended version 2024) | WP https://en.wikipedia.org/wiki/Bornean_orangutan |
| Presence | Recorded in the NLPSF, Sebangau. Protected in Indonesia. Borneo endemic. | H18 Table A10 page 49 |
| Habitat cue | Closed forest, canopy. Active in the day: activity peaks in the morning and in the late afternoon. Builds a night nest in the early evening. | PIN |
| Game mapping | Show only on tiles with tree cover ≥ 0.6 | game value, NOT SOURCED |

Teaching fact: Peat swamp forests support the highest observed population densities of orangutans of any forest type (PIN, conservation section).

### 2. Bornean white-bearded gibbon

| Field | Value | Source |
|---|---|---|
| English name | Bornean white-bearded gibbon (also: Bornean southern gibbon) | H18 Table A10 page 49; C19 title |
| Indonesian name | owa jenggot putih | KMP mammal list, entry 65 (name match only) |
| Scientific name | *Hylobates albibarbis* | H18 Table A10 page 49 |
| IUCN in H18 | EN | H18 Table A10 page 49 |
| IUCN now | Endangered, Marshall, Nijman and Cheyne, assessment 2020 | WP https://en.wikipedia.org/wiki/Bornean_white-bearded_gibbon |
| Presence | Recorded in the NLPSF, Sebangau. Protected. Borneo endemic. C19 tracked four groups in Sebangau from 2010 to 2018. | H18 Table A10 page 49; C19 page 1 (abstract) |
| Habitat cue | Closed forest with tall emergent trees to sing from. Sings morning duets in its core area. | C19 page 2 (introduction), page 6 (discussion) |
| Game mapping | Show only on tiles with tree cover ≥ 0.7. Play a duet sound in the morning. | game value, NOT SOURCED |

Teaching fact: In the 2015 fires, 10% of the study forest (53.8 km²) burned. One gibbon group moved west, away from the burnt area (C19 page 5, "HR and fire").

### 3. Maroon langur

| Field | Value | Source |
|---|---|---|
| English name | Maroon leaf monkey, or red leaf monkey | H18 Table A10 page 49 |
| Indonesian name | lutung merah | KMP mammal list, entry 24 (name match only) |
| Scientific name | *Presbytis rubicunda* | H18 Table A10 page 49 |
| IUCN in H18 | LC | H18 Table A10 page 49 |
| IUCN now | Vulnerable, Cheyne et al. assessment 2020 | WP https://en.wikipedia.org/wiki/Maroon_langur |
| Presence | Recorded in the NLPSF, Sebangau. Protected. Borneo endemic. | H18 Table A10 page 49 |
| Habitat cue | Closed forest, canopy. Arboreal: spends most of its time in the canopy. Day or night activity: `NOT SOURCED`. | WP |
| Game mapping | Show only on tiles with tree cover ≥ 0.6 | game value, NOT SOURCED |

Teaching fact: Its main food is the young parts of leaves. It also eats fruits, seeds and flowers (WP).

### 4. Sun bear

| Field | Value | Source |
|---|---|---|
| English name | Sun bear (Malayan sun bear) | H18 Table A10 page 50 |
| Indonesian name | beruang madu ("honey bear") | WP https://en.wikipedia.org/wiki/Sun_bear; KMP mammal list, entry 130 |
| Scientific name | *Helarctos malayanus* | H18 Table A10 page 50 |
| IUCN in H18 | VU | H18 Table A10 page 50 |
| IUCN now | Vulnerable, Scotson et al. assessment 2017 (errata version 2018) | WP |
| Presence | Recorded in the NLPSF, Sebangau. Protected. | H18 Table A10 page 50 |
| Habitat cue | Forest, ground and trees. WP says it is "mainly active during the day", and also that it "forages mostly at night". The activity time is not clear. | WP |
| Game mapping | Show on tiles with tree cover ≥ 0.5 | game value, NOT SOURCED |

Teaching fact: Sun bears eat termites, ants, bees, honey, seeds and fruit. They help to disperse the seeds of the tree *Canarium pilosum* (WP).

### 5. Rhinoceros hornbill

| Field | Value | Source |
|---|---|---|
| English name | Rhinoceros hornbill | H18 Table A9 page 44 |
| Indonesian name | `NOT SOURCED` (not in the KMP bird list) | KMP |
| Scientific name | *Buceros rhinoceros* | H18 Table A9 page 44 |
| IUCN in H18 | NT | H18 Table A9 page 44 |
| IUCN now | Vulnerable, BirdLife International assessment 2020. Uplisted from Near Threatened in 2018. | WP https://en.wikipedia.org/wiki/Rhinoceros_hornbill |
| Presence | Recorded in the NLPSF, Sebangau. Protected. | H18 Table A9 page 44 |
| Habitat cue | Forest. Nests inside tree trunks, so it needs large trees. Day or night activity: `NOT SOURCED`. | WP |
| Game mapping | Fly over tiles with tree cover ≥ 0.6 | game value, NOT SOURCED |

Teaching fact: The pair seals the nest hole with mud, food and faeces. The female stays inside with the eggs and chicks. The male feeds her through a small hole (WP).

### 6. Storm's stork

| Field | Value | Source |
|---|---|---|
| English name | Storm's stork | H18 Table A9 page 40 |
| Indonesian name | bangau storm | KMP bird list, item 163 (name match only) |
| Scientific name | *Ciconia stormi* | H18 Table A9 page 40 |
| IUCN in H18 | EN | H18 Table A9 page 40 |
| IUCN now | Endangered, BirdLife International assessment 2023 (errata version 2025) | WP https://en.wikipedia.org/wiki/Storm%27s_stork |
| Presence | Recorded in the NLPSF, Sebangau. Protected. H18 names it as a wetland bird that peat swamp forests help to conserve. | H18 Table A9 page 40; H18 page 2 (introduction) |
| Habitat cue | Lowland riverine forest and peat swamp forest. Forages on muddy banks of rivers and creeks inside dense forest, and in pools and swamps. Avoids deep, fast rivers. Day or night activity: `NOT SOURCED`. | WP |
| Game mapping | Show on wet tiles (`wt` ≤ 0.40 m) next to forest | game value, NOT SOURCED |

Teaching fact: Only 300 to 1,750 mature Storm's storks live in the wild (2023 estimate). Borneo has the largest part of them (WP).

### 7. Buffy fish owl

| Field | Value | Source |
|---|---|---|
| English name | Buffy fish-owl | H18 Table A9 page 42 |
| Indonesian name | `NOT SOURCED` | — |
| Scientific name | *Ketupa ketupu* | H18 Table A9 page 42 |
| IUCN in H18 | LC | H18 Table A9 page 42 |
| IUCN now | Least Concern, BirdLife International assessment 2016 | WP https://en.wikipedia.org/wiki/Buffy_fish_owl |
| Presence | Recorded in the NLPSF, Sebangau. | H18 Table A9 page 42 |
| Habitat cue | Forest and freshwater wetlands near rivers and lakes. Hunts at night. In the day, it shelters in trees with dense leaves. | WP |
| Game mapping | Show at night on water or canal tiles next to forest | game value, NOT SOURCED |

Teaching fact: The buffy fish owl eats mainly fish, crabs and frogs (WP).

### 8. Asian small-clawed otter

| Field | Value | Source |
|---|---|---|
| English name | Asian small-clawed otter | H18 Table A10 page 50 |
| Indonesian name | `NOT SOURCED` (KMP lists otters without species names) | KMP |
| Scientific name | *Aonyx cinerea* (H18 spelling) | H18 Table A10 page 50 |
| IUCN in H18 | VU | H18 Table A10 page 50 |
| IUCN now | Vulnerable, Wright et al. assessment 2021 | WP https://en.wikipedia.org/wiki/Asian_small-clawed_otter |
| Presence | Recorded in the NLPSF, Sebangau. | H18 Table A10 page 50 |
| Habitat cue | Open water: rivers and freshwater wetlands. Mostly active after dark. | WP |
| Game mapping | Show on canal and river tiles with water | game value, NOT SOURCED |

Teaching fact: The otter eats mainly crabs and fish. WP lists the conversion of peat swamp forests as a threat to its habitat (WP, threats section).

### 9. False gharial

| Field | Value | Source |
|---|---|---|
| English name | Malayan gharial, or false gharial | H18 Table A8 page 39 |
| Indonesian name | `NOT SOURCED` | — |
| Scientific name | *Tomistoma schlegelii* | H18 Table A8 page 39 |
| IUCN in H18 | VU | H18 Table A8 page 39 |
| IUCN now | Endangered, Shaney et al. assessment 2023 | WP https://en.wikipedia.org/wiki/False_gharial |
| Presence | Recorded in the NLPSF, Sebangau. Protected in Indonesia per H18. KMP does not list it. | H18 Table A8 page 39 |
| Habitat cue | Open water in peat swamps and lowland swamp forests. Day or night activity: `NOT SOURCED`. | WP |
| Game mapping | Show rarely, in river tiles only | game value, NOT SOURCED |

Teaching fact: The false gharial lives in peat swamps. It builds a mound nest (WP).

### 10. Asian water monitor

| Field | Value | Source |
|---|---|---|
| English name | Monitor lizard (Asian water monitor) | H18 Table A8 page 39 |
| Indonesian name | `NOT SOURCED` | — |
| Scientific name | *Varanus salvator* | H18 Table A8 page 39 |
| IUCN in H18 | LC | H18 Table A8 page 39 |
| IUCN now | Least Concern, Quah et al. assessment 2021 | WP https://en.wikipedia.org/wiki/Asian_water_monitor |
| Presence | Recorded in the NLPSF, Sebangau. | H18 Table A8 page 39 |
| Habitat cue | Edges of rivers, lakes, ponds and swamps. Also lives in towns with canals. An excellent swimmer. Day or night activity: `NOT SOURCED`. | WP |
| Game mapping | Show on canal banks and wet ground | game value, NOT SOURCED |

Teaching fact: The water monitor often eats carrion. This helps to clean the environment (WP).

### 11. Striped snakehead

| Field | Value | Source |
|---|---|---|
| English name | Snakehead murrel (striped snakehead) | H18 Table A6 page 35 |
| Indonesian name | gabus (Malaysia: haruan) | WP https://en.wikipedia.org/wiki/Channa_striata |
| Scientific name | *Channa striata* | H18 Table A6 page 35 |
| IUCN in H18 | LC | H18 Table A6 page 35 |
| IUCN now | Least Concern, Chaudhry et al. assessment 2019 | WP |
| Presence | Recorded in the NLPSF, Sebangau. H18 caught fish with traps in rivers, canals and forest pools. | H18 Table A6 page 35; H18 page 4 (survey methods, fish) |
| Habitat cue | Open water. In the dry season, it goes back to permanent water or burrows in the mud. | WP |
| Game mapping | Show as a ripple in canal and pool tiles with water | game value, NOT SOURCED |

Teaching fact: The snakehead is an important food fish in its full native range (WP). This links fish to local livelihoods (revitalisation).

Other snakeheads in H18 Table A6 page 35: *Channa micropeltes* (giant snakehead, LC), *C. gachua*, *C. bankanensis*, *C. melanoptera*, *C. pleurophthalmus*.

## Mix check

- Need closed forest (5): orangutan, gibbon, maroon langur, rhinoceros hornbill, sun bear.
- Use canals or open water (5): otter, snakehead, water monitor, false gharial, Storm's stork.
- Active at night (2): buffy fish owl, otter (mostly after dark).

## Concept facts

- **Canals drain the peat.** Illegal loggers dug timber canals 1–2 m wide and 0.3–1.3 m deep into the Sebangau peat. The canals cause peat drainage, subsidence and a higher dry-season fire risk (H18 page 4, "Study site").
- **Threats.** Peat drainage, fire, conversion for agriculture, logging, hunting and climate change threaten all deep peatlands in Central Kalimantan (H18 page 8, discussion).
- **Restoration actions.** H18 recommends forest patrols, firefighting, blocking of ex-logging canals and replanting of burned areas (H18 page 8, recommendation 1).
- **Fire and wildlife.** Peat and forest fires have major negative impacts on biodiversity in Kalimantan. Known or suspected impacts include respiratory ailments in orangutans (C19 page 8, discussion).
- **Species count.** H18 lists 172 bird and 65 mammal taxa at the site. 46 species are globally threatened (H18 page 1, summary).

## Newer edition check (2026-11-10)

- H18 gives the IUCN status as of 2018. Four species changed after that:
  - maroon langur: LC to VU (2020)
  - rhinoceros hornbill: NT to VU (2020)
  - false gharial: VU to EN (2023)
  - Storm's stork: EN, re-assessed in 2023 with no change
- We did not find a newer edition of H18.
- We did not open the IUCN Red List pages directly (HTTP 403). The "IUCN now" values are from the Wikipedia citations. Check them on iucnredlist.org before release.

## Not sourced

- Indonesian names for the rhinoceros hornbill, buffy fish owl, otter, false gharial and water monitor.
- Day or night activity for the maroon langur, rhinoceros hornbill, Storm's stork, false gharial and water monitor.
- Presence records outside Sebangau (Ex-Mega Rice Project, Kahayan–Kapuas, Mentangai).
- Each "Game mapping" value.
