// Indonesian copy (Bahasa Indonesia). Data only: src/i18n.js merges it over the English copy, so a missing key stays English.
// STRINGS keys are the exports of src/strings.js; each value has the same shape, and each function the same arguments.
// Terms follow BRGM: Pembasahan Kembali, Revegetasi, Revitalisasi; sekat kanal = canal block. The facts and numbers are the same as in English.

const ACTION_TEXT = {
  tempBlock: ['Sekat sementara', 'Ketuk kanal. Banjir bisa merusaknya.', 'Sekat'],
  permBlock: ['Sekat permanen', 'Membuat sekat sementara jadi permanen.', 'Sekat+'],
  backfill: ['Timbun kanal', 'Mengisi petak kanal dengan gambut.', 'Timbun'],
  well: ['Sumur bor', 'Regu dalam 3 petak padamkan api 2×.', 'Sumur'],
  plant: ['Tanam', 'Tanam 5×5. Hidup di 0–40 cm.', 'Tanam'],
  mound: ['Gundukan', 'Naikkan gambut 20 cm di atas banjir.', 'Gunduk'],
  palud: ['Paludikultur', 'Ketuk gambut basah dekat desa.', 'Tani'],
  pond: ['Kolam ikan', 'Ketuk kanal di hulu sekat.', 'Ikan'],
  fireGroup: ['Peduli api', 'Ketuk desa. Pembakaran turun separuh.', 'MPA'],
  fireCrew: ['Regu pemadam', 'Ketuk api. Padamkan 3×3.', 'Padam'],
};
const act = (id, text) => ({ icon: id, name: `${ACTION_TEXT[id][0]} (${ACTION_TEXT[id][2]})`, text });
// short words: the HUD breakpoints in index.html are measured on the English text, so the Indonesian text must not be longer
const time = (year, years, wet, week) => `Tahun ${year}/${years} · ${wet ? 'Hujan' : 'Kemarau'} · mg ${week}`;
const timeShort = (year, years, wet, week) => `${year}/${years} · ${wet ? 'Hujan' : 'Kemarau'} · mg ${week}`;

export const STRINGS = {
  LINES: [[0, 'Rawa gambut ini dulu basah.'], [2.8, 'Kanal mengeringkannya. Lalu ia terbakar.'], [5.6, 'Sekat kanal. Basahi gambut. Tanam kembali.']],
  TOAST: { noSave: 'Tidak ada simpanan.', saveDeleted: 'Simpanan dihapus.', wet: n => `${n}% gambut sekarang basah!` },
  SELECT: {
    title: 'Pilih lokasi', back: 'Kembali', years: n => `${n} tahun`,
    best: n => `${n} dari 3 bintang`,
    upTitle: 'Peningkatan',
    stars: n => `Bintang tersedia: ${n}`,
    owned: 'Dimiliki',
    buy: cost => `Beli · ★${cost}`,
    sandbox: 'Bebas', sandboxNote: 'Lokasi acak, tanpa batas lulus, mode data aktif',
  },
  UPGRADES: {
    crew: ['Regu tambahan', 'Satu regu kerja lagi di setiap lokasi.'],
    cheapBlocks: ['Sekat lebih murah', 'Harga sekat 25% lebih murah.'],
    fastCrew: ['Regu pemadam cepat', 'Regu pemadam memadamkan api lebih cepat.'],
  },
  HUD: {
    time, timeShort,
    parts: (t, funds, crews, total, goodwill, wetNow, wetDry, short) => {
      const full = time(t.year, t.years, t.wet, t.week);
      const dry = wetDry == null ? '–' : `${wetDry}%`;
      const p = (id, label, value, f = `${label} ${value}`) => ({ id, label, value, full: f });
      return [
        p('time', '', short ? timeShort(t.year, t.years, t.wet, t.week) : full, full),
        p('funds', 'Dana', `${funds}`),
        p('crew', 'Regu', `${crews}/${total}`),
        p('goodwill', 'Dukungan', `${goodwill}`),
        p('wet', 'Basah kini', `${wetNow}%`),
        p('score', 'Basah kemarau', dry, `Basah musim kemarau ${dry} (dinilai)`),
      ];
    },
    pause: 'Jeda',
    legend: ['0 m', '40 cm', '1,5 m'], // Indonesian decimal comma
    legendTitle: 'Kedalaman muka air tanah (mode data). Basah = 40 cm atau kurang.',
    keys: 'P/Spasi jeda · 1/2 kecepatan · D mode data · seret/panah geser · +/- zum · 0 seluruh peta · Esc menu',
    dataView: 'Mode data',
    mapView: 'Mode peta',
  },
  ZOOM: {
    group: 'Zum',
    in: ['+', 'Perbesar (+)'],
    out: ['−', 'Perkecil (-)'],
    fit: ['SEMUA', 'Semua: seluruh peta (0)'], // the name starts with the visible word (WCAG 2.5.3)
  },
  R_NAMES: { rewet: 'Pembasahan Kembali', reveg: 'Revegetasi', revit: 'Revitalisasi', defense: 'Pertahanan' },
  ACTION_TEXT,
  META: { until: 'sampai padam', tile: 'petak', w: 'mg' },
  SELECT_HINT: ['Pilih aksi, lalu ketuk petak.', 'Ketuk aksi lagi untuk batal.'],
  REASON: {
    busy: 'Pekerjaan sedang berjalan di sini.',
    funds: 'Dana tidak cukup.',
    crew: 'Tidak ada regu bebas.',
    invalid: 'Tidak bisa di petak ini.',
    mounded: 'Petak ini sudah punya gundukan.',
    nothingToPlant: 'Tidak ada lagi yang bisa ditanam di sini.',
  },
  REPORT: {
    title: year => `Tahun ${year} selesai`,
    chart: 'Rata-rata kedalaman air gambut, tahun lalu',
    chartAria: 'Grafik rata-rata kedalaman muka air tanah gambut per minggu selama tahun lalu, dengan garis basah 40 cm',
    rows: (burntPct, sv, goodwill, grant, funds) => [
      ['Terbakar sejauh ini', `${burntPct}% dari lokasi`],
      ['Bibit hidup', sv.planted ? `${sv.alive}/${sv.planted} ditanam tahun ini` : 'tidak ada yang ditanam tahun ini'],
      ['Dukungan desa', `${goodwill}`],
      ['Hibah diterima', `+${grant} · Dana kini ${funds}`],
    ],
    speciesRow: names => ['Satwa terlihat', `${names.length}`, names.join(', ')],
    elNino: 'Peringatan: El Niño tahun depan. Musim kemarau mulai 10 minggu lebih awal. Pasang sekat dan sumur sekarang.',
    cont: 'Lanjut',
  },
  DEBRIEF: {
    title: 'Laporan akhir',
    stars: n => `${n} dari 3 bintang`,
    before: 'Awal', after: 'Akhir',
    thumbs: 'Kedalaman air di awal dan akhir (biru basah, cokelat kering)',
    goalHead: ['Tujuan', 'Hasil', 'Batas lulus'],
    goalRows: (r, p) => [
      [`${r.rewetPct >= p.rewet ? '✓' : '✗'}\u00a0Pembasahan Kembali`, `${r.rewetPct.toFixed(0)}% gambut tetap basah sepanjang musim kemarau terakhir`, `${p.rewet}%`],
      [`${r.coverPct >= p.reveg ? '✓' : '✗'}\u00a0Revegetasi`, `tutupan hutan baru ${r.coverPct.toFixed(0)}%`, `${p.reveg}%`],
      [`${r.goodwill >= p.revit ? '✓' : '✗'}\u00a0Revitalisasi`, `dukungan desa ${r.goodwill.toFixed(0)}`, `${p.revit}`],
    ],
    goalsTitle: 'Status tujuan',
    dataTitle: 'Data',
    dataRows: (co2, sv) => [
      ['Emisi drainase yang dicegah', `${co2.avoidedTCO2.toFixed(1).replace('.', ',')} t CO2`],
      ['Emisi kebakaran', `${co2.fireTCO2.toFixed(1).replace('.', ',')} t CO2`],
      ['Bibit hidup', sv.planted ? `${sv.alive}/${sv.planted}` : 'tidak ada yang ditanam'],
    ],
    allMet: 'Semua tujuan tercapai. Kerja bagus.',
    passed: 'Lokasi pulih.',
    failed: 'Lokasi belum pulih.',
    loss: { fire: 'Terlalu banyak bagian lokasi yang terbakar.', funds: 'Dana habis di tahun terakhir, dan tidak ada hibah lagi.', goodwill: 'Desa kehilangan kepercayaan padamu.' },
    lossHint: {
      fire: 'Gambut basah tidak terbakar. Sekat kanal sejak awal agar air tetap tinggi sepanjang musim kemarau.',
      funds: 'Setiap tahun ada hibah baru, tetapi tahun terakhir tidak ada. Belanjakan di musim hujan, saat kerja lebih murah, dan sekat sebelum menimbun.',
      goodwill: 'Jauhkan api dari desa, dan bangun kolam, kelompok peduli api, dan paludikultur.',
    },
    menu: 'Menu',
    sandbox: seed => `Mode bebas (seed ${seed}): angka saja, tanpa batas lulus.`,
    figureHead: ['Tujuan', 'Hasil'],
    figureRows: r => [
      ['Pembasahan Kembali', `${r.rewetPct.toFixed(0)}% gambut tetap basah sepanjang musim kemarau terakhir`],
      ['Revegetasi', `tutupan hutan baru ${r.coverPct.toFixed(0)}%`],
      ['Revitalisasi', `dukungan desa ${r.goodwill.toFixed(0)}`],
    ],
  },
  HINTS: {
    rewet: 'Basahi lebih banyak gambut: sekat kanal dan jaga air tetap tinggi sepanjang musim kemarau.',
    reveg: 'Tanam lebih banyak pohon di gambut basah.',
    revit: 'Dapatkan lebih banyak dukungan: bangun kolam, kelompok peduli api, dan paludikultur.',
  },
  HOWTO: {
    title: L => `Level ${L.id}: ${L.name}`,
    sub: 'Yang harus dilakukan di lokasi ini',
    newHere: 'Baru di lokasi ini',
    go: 'Mulai',
    hint: 'Level tetap dijeda sampai kamu menutup ini. Esc juga menutupnya.',
    items: {
      1: [
        act('tempBlock', 'Ketuk petak kanal. Sekat menahan air di dalam gambut. Banjir bisa merusaknya.'),
        act('permBlock', 'Ketuk sekat sementara untuk membuatnya permanen. Banjir tidak merusaknya.'),
        { icon: 'wet', name: 'Garis 40 cm', text: 'Gambut dengan muka air tanah 40 cm atau kurang di bawah permukaan itu basah. Gambut basah tidak terbakar. Jaga tetap basah sepanjang musim kemarau.' },
        { icon: 'tempBlock', name: 'Jarak', text: 'Sekat paling membasahi gambut di dekat kanal. Gambut yang jauh dari sekat tetap kering. Pasang sekat di sepanjang kanal.' },
        act('fireCrew', 'Ketuk api untuk mengirim regu ke sana.'),
        { icon: 'data', name: 'Mode data', text: 'Menunjukkan kedalaman muka air tanah. Biru basah. Cokelat kering.', key: 'D' },
        { icon: 'pause', name: 'Jeda, ×1, ×2', text: 'Hentikan atau ubah kecepatan waktu.', key: 'P, 1, 2' },
        { icon: 'fit', name: 'Geser peta', text: 'Seret atau pakai panah untuk menggeser. Perbesar, perkecil, atau tampilkan seluruh peta.', key: '+, −, 0' },
      ],
      2: [
        act('plant', 'Ketuk gambut untuk menanam bibit. Bibit hanya hidup jika muka air tanah 0 sampai 40 cm di bawah permukaan.'),
        act('mound', 'Bibit di petak rendah tenggelam saat banjir. Gundukan menaikkan petak 20 cm.'),
      ],
      3: [
        { icon: 'goodwill', name: 'Dukungan', text: 'Desa makin percaya padamu saat kamu membantunya. Pada dukungan 0, kamu kalah di level ini.' },
        act('palud', 'Ketuk gambut basah di sebelah desa. Desa bertani di sana dan memberi dukungan.'),
        act('pond', 'Ketuk petak kanal di hulu sekat. Ini memberi dukungan.'),
        act('fireGroup', 'Ketuk desa. Api di dekatnya segera ditemukan, dan pembakaran berkurang.'),
      ],
      4: [
        { icon: 'tempBlock', name: 'Sekat bertingkat', text: 'Satu sekat hanya menahan air di bagian kanal yang pendek. Pasang sekat bertingkat di sepanjang kanal yang panjang.' },
        act('backfill', 'Ketuk petak kanal untuk mengisinya dengan gambut. Kanal berhenti mengeringkan di sana. Biayanya mahal.'),
        { icon: 'tempBlock', name: 'Kanal ilegal', text: 'Orang menggali kanal ilegal baru dari tepi. Sekat kanal ilegal sejak awal, saat masih pendek.' },
      ],
      5: [
        { icon: 'time', name: 'El Niño', text: 'Di tahun El Niño, musim kemarau mulai 10 minggu lebih awal. Laporan tahunan memberi tahu setahun sebelumnya.' },
        act('well', 'Regu pemadam dekat sumur memadamkan api 2 kali lebih cepat.'),
        { icon: 'fireCrew', name: 'Api membara', text: 'Api bisa membakar di bawah permukaan. Api menyala lagi jika gambut tetap kering. Basahi gambut untuk menghentikannya.' },
      ],
      6: [
        { icon: 'score', name: 'Batas lulus lebih tinggi', text: 'Lokasi ini luas dan punya semua masalah. Pakai semua yang kamu tahu.' },
      ],
    },
  },
  QUIT: { title: 'Tinggalkan level ini?', body: 'Kemajuan di lokasi ini akan hilang.', yes: 'Tinggalkan', no: 'Tetap' },
  INTRO: { skip: 'Lewati' },
  MENU: {
    label: 'Kemajuan',
    stars: (x, n) => ['Bintang', `${x} dari ${n}`],
    found: (x, n) => ['Satwa ditemukan', `${x} dari ${n}`],
  },
  JOURNAL: {
    title: 'Jurnal', open: 'Jurnal', close: 'Tutup', prev: 'Sebelum', next: 'Lanjut', home: 'Awal',
    pos: (a, b, n) => (a === b ? `Halaman ${a} dari ${n}` : `Halaman ${a}-${b} dari ${n}`),
    contentsTiles: 'Isi: petak', contentsConcepts: 'Isi: gagasan', actionsHere: 'Aksi di petak ini', seeAlso: 'Lihat juga', contentsWildlife: (x, n) => `Isi: satwa (${x}/${n})`,
    found: name => `Baru di jurnalmu: ${name}`, openEntry: 'Buka', notFound: 'Belum ditemukan', unknown: '?',
    hidden: (k, n) => `Satwa tak dikenal ${k} dari ${n}, belum ditemukan`,
    status: { LC: 'Risiko Rendah', NT: 'Hampir Terancam', VU: 'Rentan', EN: 'Genting', CR: 'Kritis' },
    statusLabel: 'Status IUCN', habitatLabel: 'Habitat', protectedNote: 'Dilindungi di Indonesia.', endemicNote: 'Spesies ini hanya hidup di Pulau Borneo.', sources: 'Sumber', openSource: 'Buka sumber', hint: 'Panah Kiri dan Kanan membalik halaman. Esc menutup.',
  },
  // the static text in index.html: 'selector' sets the first text of the element, 'selector@attribute' sets the attribute
  PAGE: {
    '#bg@aria-label': 'Gambar piksel rawa gambut yang pulih dari kekeringan dan kebakaran',
    '#menu@aria-label': 'Menu utama',
    '#menu .sub': 'gim restorasi gambut',
    '#bNew': 'Permainan baru', '#bCont': 'Lanjutkan', '#bJrnMenu': 'Jurnal', '#bSet': 'Pengaturan', '#bCred': 'Kredit',
    '#dSet h2': 'Pengaturan', '#snd': 'Suara', '#bLang': 'Bahasa: Indonesia', '#bReplay': 'Putar ulang intro', '#bReset': 'Hapus simpanan',
    '#dCred h2': 'Kredit',
    '#dCred p:nth-of-type(1)': 'Gambar peta dan suara dibuat dengan kode.',
    '#dCred p:nth-of-type(2)': 'Huruf: Silkscreen (Google Fonts).',
    '#dCred p:nth-of-type(2) a@aria-label': 'Buka sumber Silkscreen',
    '#dCred p:nth-of-type(3)': 'Ikon: pixelarticons oleh Gerrit Halfmann (MIT).',
    '#dCred p:nth-of-type(3) a@aria-label': 'Buka sumber pixelarticons',
    '#dSet form .btn': 'Tutup', '#dCred form .btn': 'Tutup',
  },
};

export const LEVELS = {
  1: { name: 'Lahan kecil yang dikeringkan', teaches: 'Sekat, garis 40 cm, faktor jarak' },
  2: { name: 'Bekas hutan terbakar', teaches: 'Penanaman, tenggelam di cekungan, gundukan' },
  3: { name: 'Tepi desa', teaches: 'Dukungan, paludikultur, pembakaran' },
  4: { name: 'Jaringan kanal', teaches: 'Sekat bertingkat, penimbunan, kanal ilegal' },
  5: { name: 'Tahun El Nino', teaches: 'Sumur, regu pemadam, api membara' },
  6: { name: 'Kubah gambut penuh', teaches: 'Semuanya, dengan batas lulus lebih tinggi' },
};

export const CONCEPTS = {
  threer: { title: '3R', alt: 'Diagram: basahi dengan menyekat kanal, tanam kembali pohon endemik, lalu hidupkan kembali mata pencaharian.',
    body: 'BRG memimpin restorasi gambut dengan 3 langkah: pembasahan kembali, revegetasi dan revitalisasi. Pembasahan kembali berarti menyekat dan menimbun kanal. Revitalisasi berarti mata pencaharian lain bagi warga setempat. Untuk 2016 sampai 2020, BRGM mencatat 6.631 sekat kanal.' },
  canals: { title: 'Kanal dan drainase', alt: 'Diagram: penampang gambut. Di sebelah kanal, muka air tanah 0,40 sampai 0,50 m lebih dalam daripada di 1.000 m jauhnya.',
    body: 'Proyek Lahan Gambut Sejuta Hektare menggali kanal utama. Kanal itu sering memotong pusat kubah gambut, yang menyebabkan kekeringan, penurunan tanah, hilangnya habitat dan risiko kebakaran lebih tinggi. Pembalak liar juga menggali kanal kecil untuk kayu. Di sebelah kanal, muka air tanah 0,40 sampai 0,50 m lebih dalam daripada di 1.000 m jauhnya.' },
  store: { title: 'Gambut menyimpan karbon', alt: 'Diagram: di gambut basah, karbon tetap di dalam tanah. Di gambut kering, oksigen masuk dan karbon lepas ke udara sebagai CO2.',
    body: 'Gambut adalah tanah dari tumbuhan yang terurai sebagian, dengan bahan organik paling sedikit 65% dalam lapisan 30 cm atau lebih. Gambut Asia Tenggara mengandung 41,6% sampai 62,0% karbon per berat kering. Indonesia menyimpan 57,4 miliar t karbon gambut, 65% dari seluruh karbon gambut tropis. Drainase membuat oksigen masuk ke gambut, lalu gambut melepas lebih banyak CO2.' },
  rule: { title: 'Aturan 0,4 m', alt: 'Diagram: gambut dengan air di atas garis 0,4 m sehat. Gambut dengan air di bawah garis itu rusak dan bisa terbakar.',
    body: 'Hukum Indonesia PP 57/2016 menetapkan batas untuk gambut yang dibudidayakan. Gambut rusak jika muka air tanah lebih dari 0,4 m di bawah permukaan. Risiko kebakaran naik pada kedalaman yang sama. Gambut lindung rusak oleh drainase, sedimen yang terbuka atau tutupan lahan yang berkurang.' },
  seasons: { title: 'Musim kemarau dan hujan', alt: 'Grafik: kedalaman muka air tanah pada 10, 100, 400 dan 1.000 m dari kanal. Di musim kemarau, muka air tanah lebih dalam di setiap jarak.',
    body: 'Di musim kemarau, muka air tanah rata-rata 0,30 m lebih dalam daripada di musim hujan. Pada 10 m dari kanal, muka air tanah 0,88 m di bawah permukaan di musim kemarau dan 0,50 m di musim hujan. Meski ada sekat, muka air tanah bisa turun lagi di bawah 0,40 m dalam kemarau panjang.' },
  blocks: { title: 'Sekat bertingkat', alt: 'Diagram: sekat menaikkan muka air tanah dari 1,12 m ke 0,37 m di bawah permukaan. Sekat bertingkat menjaga setiap tingkat di bawah 0,5 m.',
    body: 'Dalam satu studi, sekat kanal menaikkan rata-rata muka air tanah dari 1,12 m ke 0,37 m di bawah permukaan. Di musim kemarau, air merembes di sepanjang dan di bawah sekat. Muka air tanah lalu bisa turun lagi, bahkan di bawah 1 m. Beda tinggi air di satu sekat sebaiknya di bawah 0,5 m, jadi kanal perlu sekat kuat yang bertingkat.' },
  fire: { title: 'Kebakaran', alt: 'Grafik: risiko kebakaran tetap rendah selama muka air tanah di atas 0,40 m, lalu naik saat muka air tanah turun.',
    body: 'Risiko kebakaran naik saat muka air tanah turun di bawah 0,40 m. Kebakaran membakar 1,7 juta hektare di Indonesia sampai Oktober 2015. Kebakaran terbesar terjadi di gambut. Kebakaran juga merugikan satwa liar di Kalimantan.' },
  burn: { title: 'Emisi kebakaran gambut', alt: 'Grafik: satu hektare kebakaran gambut melepas sekitar 164 t C, sama dengan 15 tahun sawit di gambut kering dengan 11 t C per tahun.',
    body: 'Kebakaran liar di gambut tropis yang dikeringkan membakar 353 t bahan kering per hektare. Setiap kg gambut terbakar menghasilkan 464 g karbon sebagai CO2, 210 g CO dan 21 g metana. Jadi CO2 dari satu hektare kebakaran mengandung sekitar 164 t C. Sawit di gambut kering perlu sekitar 15 tahun untuk melepas sebanyak itu.' },
  carbon: { title: 'Penurunan tanah dan karbon', alt: 'Grafik: penurunan tanah naik seiring kedalaman muka air tanah, 10 cm per tahun pada 100 cm. Sawit di gambut kering melepas 11 t C per hektare per tahun, gambut yang dibasahi kembali 0.',
    body: 'Di gambut yang dikeringkan, emisi CO2 dan penurunan tanah naik tajam saat muka air tanah turun. Penurunan tanah dalam cm per tahun sama dengan 0,1 kali kedalaman muka air tanah dalam cm. IPCC memberi nilai baku untuk CO2 saja: sawit tropis di gambut kering melepas 11 t C per hektare per tahun, dan gambut tropis yang dibasahi kembali melepas 0. Nilai ini tidak menghitung metana atau karbon terlarut.' },
  landuse: { title: 'Penggunaan lahan gambut', alt: 'Grafik: emisi CO2 dalam t C per hektare per tahun. Akasia 20, lahan tanaman 14, sawit 11, padi sawah 9,4, sagu 1,5, gambut dibasahi kembali 0.',
    body: 'IPCC menetapkan nilai baku CO2 yang dilepas gambut tropis yang dikeringkan, dalam t C per hektare per tahun. Hutan tanaman akasia melepas 20, lahan tanaman 14, sawit 11 dan padi sawah 9,4. Sagu dengan drainase dangkal, kurang dari 0,3 m, melepas 1,5. Gambut yang dibasahi kembali melepas 0.' },
  convert: { title: 'Karbon dan CO2', alt: 'Diagram: 1 atom karbon dengan berat 12 bergabung dengan 2 atom oksigen dengan berat 32 menjadi CO2 dengan berat 44. Jadi 1 t C menjadi 3,67 t CO2.',
    body: 'Gim ini menghitung karbon dalam t C, ton karbon. Laporan akhir menunjukkan t CO2, ton karbon dioksida. Untuk mengubah t C menjadi t CO2, kalikan dengan 44/12, rasio berat molekulnya. Jadi 1 t C sekitar 3,67 t CO2.' },
  baseline: { title: 'Baseline dan proyek', alt: 'Grafik: emisi bertambah dari tahun ke tahun. Garis baseline naik cepat, garis proyek tetap rendah. Selisih keduanya, dikurangi kebocoran, adalah penurunan emisi.',
    body: 'Proyek karbon membandingkan dua keadaan. Baseline menunjukkan emisi jika lahan tetap seperti sebelum proyek, misalnya gambut yang dikeringkan. Keadaan proyek menunjukkan emisi dengan proyek, misalnya gambut yang dibasahi kembali. Penurunan emisi bersih adalah emisi baseline dikurangi emisi proyek, dikurangi kebocoran: emisi di luar batas proyek yang disebabkan oleh proyek.' },
  plants: { title: 'Revegetasi', alt: 'Diagram: di gambut terbakar yang hanya dibasahi, air turun dan gambut amblas. Dengan pohon baru, air tetap tinggi.',
    body: 'Revegetasi BRG berarti menanam pohon endemik dan adaptif. Di gambut terbakar, pembasahan saja tidak cukup. Tanpa hutan rawa, muka air yang tinggi tidak bertahan dan penurunan tanah berlanjut. Para peneliti juga menyarankan penanaman kembali lahan terbakar.' },
  paludi: { title: 'Paludikultur', alt: 'Diagram: tanaman tumbuh di gambut basah dan gambut tetap ada. Pasar untuk panennya belum pasti.',
    body: 'Paludikultur adalah budi daya biomassa dalam kondisi basah. Paludikultur menjaga tubuh gambut. Para ahli menyebut nipah, sagu, jelutung, tengkawang dan rotan. Sampai pasar dan harga sesuai dengan pasokan dan permintaan, potensinya tampak terbatas.' },
  people: { title: 'Mata pencaharian', alt: 'Diagram: kolam ikan beje di kanal lama memberi desa ikan untuk dimakan dan dijual. Program Desa Peduli Gambut mendanai desa.',
    body: 'Revitalisasi berarti mata pencaharian lain bagi masyarakat setempat. Banyak rumah tangga bergantung pada lahan gambut untuk bertani, dan menangkap ikan umum di Kalimantan. Program Desa Peduli Gambut mendanai desa di sekitar gambut yang direstorasi BRGM. Budi daya ikan dengan sistem beje tradisional bisa memakai kanal yang ada.' },
};

// art captions and acts replace the English arrays whole, so each keeps the same tile and action ids
export const TILES = {
  peat: { title: 'Gambut', art: [['peatWet', 'Basah'], ['peatDry', 'Kering']],
    body: 'Gambut adalah tanah rawa. Gambut basah jika muka air tanah 40 cm atau kurang di bawah permukaan. Gambut kering bisa terbakar.',
    acts: [
      ['plant', 'Menanam bibit di 5×5 petak di sekitarnya. Bibit hanya hidup jika muka air tanah 0 sampai 40 cm di bawah permukaan.'],
      ['mound', 'Menaikkan petak 20 cm, agar bibit tidak tenggelam saat banjir. Satu petak hanya bisa diberi satu gundukan.'],
      ['palud', 'Hanya di gambut basah di sebelah desa. Desa bertani di sana dan memberi dukungan.'],
      ['well', 'Regu pemadam dalam 3 petak dari sumur memadamkan api 2 kali lebih cepat. Sumur bisa dibuat di petak mana pun.'],
      ['fireCrew', 'Hanya di api. Regu memadamkan api di 3×3 petak di sekitarnya.'],
    ] },
  canal: { title: 'Kanal', art: [['canal']],
    body: 'Kanal mengeringkan gambut di dekatnya. Muka air tanah paling dalam di sebelah kanal. Orang bisa menggali kanal ilegal baru dari tepi lokasi.',
    acts: [
      ['tempBlock', 'Membangun sekat yang menahan air di dalam gambut. Banjir bisa merusaknya.'],
      ['backfill', 'Mengisi petak dengan gambut. Petak menjadi gambut dan berhenti mengeringkan. Biayanya mahal.'],
      ['pond', 'Hanya di petak kanal tanpa sekat, di hulu sekat. Ini memberi dukungan.'],
    ] },
  block: { title: 'Kanal bersekat', art: [['tempBlock', 'Sementara'], ['permBlock', 'Permanen']],
    body: 'Sekat adalah bendungan di kanal. Sekat mengurangi drainase sampai 6 petak kanal di hulunya. Kanal yang panjang perlu sekat bertingkat.',
    acts: [
      ['permBlock', 'Hanya di sekat sementara. Membuat sekat permanen, jadi banjir tidak merusaknya.'],
      ['backfill', 'Mengisi petak dengan gambut. Petak menjadi gambut dan berhenti mengeringkan. Biayanya mahal.'],
    ] },
  river: { title: 'Sungai', art: [['river']],
    body: 'Sungai adalah air alami. Sungai mengeringkan gambut di dekatnya lebih sedikit daripada kanal. Kamu tidak bisa menyekat atau menimbun sungai.',
    acts: [['well', 'Sumur bisa dibuat di petak mana pun.']] },
  village: { title: 'Desa', art: [['village']],
    body: 'Warga setempat tinggal di desa. Api di sebelah desa mengurangi dukungan. Pada dukungan 0, kamu kalah di level ini.',
    acts: [['fireGroup', 'Api di dekat desa segera ditemukan, dan pembakaran berkurang.']] },
  farm: { title: 'Ladang', art: [['farm']],
    body: 'Desa bertani di ladang ini. Kamu tidak bisa menanam pohon di ladang. Ladang kering bisa terbakar.',
    acts: [['fireCrew', 'Hanya di api. Regu memadamkan api di 3×3 petak di sekitarnya.']] },
};

// names: i18n.js shows the sourced `local` name, if there is one, in place of the English name
export const SPECIES = {
  orangutan: { habitat: 'Hutan tertutup, di tajuk pohon. Aktif di siang hari, paling banyak di pagi dan sore hari. Setiap sore ia membuat sarang untuk malam.',
    fact: 'Hutan rawa gambut punya kepadatan orangutan tertinggi yang teramati di antara semua jenis hutan.' },
  gibbon: { habitat: 'Hutan tertutup dengan pohon tinggi untuk bernyanyi. Sepasang owa bernyanyi duet di pagi hari di wilayah intinya.',
    fact: 'Dalam kebakaran 2015, 10% hutan studi terbakar. Satu kelompok owa pindah ke barat, menjauh dari area terbakar.' },
  langur: { habitat: 'Hutan tertutup. Sebagian besar waktunya di tajuk pohon.',
    fact: 'Makanan utamanya bagian daun yang muda. Ia juga makan buah, biji dan bunga.' },
  sunbear: { habitat: 'Hutan, di tanah dan di pohon.',
    fact: 'Beruang madu makan rayap, semut, lebah, madu, biji dan buah. Mereka membantu menyebarkan biji pohon Canarium pilosum.' },
  hornbill: { habitat: 'Hutan. Ia bersarang di dalam batang pohon, jadi ia perlu pohon besar.',
    fact: 'Pasangan ini menutup lubang sarang dengan lumpur, makanan dan kotoran. Betina tinggal di dalam, dan jantan memberinya makan melalui lubang kecil.' },
  stork: { habitat: 'Hutan sungai dataran rendah dan hutan rawa gambut. Ia mencari makan di tepi berlumpur sungai dan anak sungai di hutan lebat, dan di kolam serta rawa. Ia menghindari sungai yang dalam dan deras.',
    fact: 'Hanya 300 sampai 1.750 bangau storm dewasa hidup di alam (perkiraan 2023). Kalimantan punya bagian terbesar dari mereka.' },
  fishowl: { habitat: 'Hutan dan lahan basah air tawar dekat sungai dan danau. Ia berburu di malam hari. Di siang hari, ia beristirahat di pohon berdaun lebat.',
    fact: 'Buffy fish owl terutama makan ikan, kepiting dan katak.' },
  otter: { habitat: 'Sungai dan lahan basah air tawar. Ia aktif terutama setelah gelap.',
    fact: 'Berang-berang ini terutama makan kepiting dan ikan. Alih fungsi hutan rawa gambut mengancam habitatnya.' },
  gharial: { habitat: 'Perairan terbuka di rawa gambut dan hutan rawa dataran rendah.',
    fact: 'False gharial hidup di rawa gambut. Ia membuat sarang berupa gundukan.' },
  monitor: { habitat: 'Tepi sungai, danau, kolam dan rawa, juga kota dengan kanal. Ia berenang dengan sangat baik.',
    fact: 'Biawak ini sering makan bangkai. Ini membantu membersihkan lingkungan.' },
  snakehead: { habitat: 'Perairan terbuka. Di musim kemarau, ia kembali ke air yang permanen atau menggali ke dalam lumpur.',
    fact: 'Gabus adalah ikan konsumsi penting di seluruh wilayah asalnya.' },
};

// journal diagram labels, keyed by the English label (src/journalArt.js). Numbers and units are not here: they stay as they are.
export const ART = {
  REWET: 'BASAHI', REPLANT: 'TANAM', REVITALISE: 'HIDUPKAN', 'block canals': 'sekat kanal', 'endemic trees': 'pohon endemik', livelihoods: 'nafkah',
  '3 steps of peat restoration': '3 langkah restorasi gambut',
  'carbon stays': 'karbon tetap', 'carbon lost': 'karbon hilang', 'wet peat': 'basah', 'O2 in': 'O2 masuk', 'CO2 out': 'CO2 keluar',
  '0.40-0.50 m deeper': '0,40-0,50 m lebih dalam', canal: 'kanal', '1,000 m away': '1.000 m jauhnya', 'water table': 'muka air', peat: 'gambut',
  healthy: 'sehat', damaged: 'rusak', '0.4 m': '0,4 m', 'water-table depth on farmed peat': 'kedalaman air di gambut budi daya',
  '1.12 m': '1,12 m', '0.37 m': '0,37 m', 'before / after': 'sebelum / sesudah', cascade: 'bertingkat', 'each step < 0.5 m': 'tingkat < 0,5 m',
  '0.40 m': '0,40 m', 'fire risk': 'risiko api', 'water-table depth': 'kedalaman muka air', wet: 'basah',
  '100 cm deep': 'dalam 100 cm', '10 cm/yr sinks': 'turun 10 cm/thn', drained: 'kering', rewet: 'basah', 't C/ha/yr': 't C/ha/thn',
  '1,000 m': '1.000 m', dry: 'kering', rainy: 'hujan', 'from canal': 'dari kanal',
  '1 fire': '1 kebakaran', '15 yr oil palm': '15 thn sawit', 'each year': 'per tahun', 't C per hectare': 't C per hektare',
  't C per hectare per year': 't C per hektare per tahun', acacia: 'akasia', cropland: 'tanaman', 'oil palm': 'sawit', 'paddy rice': 'padi sawah', sago: 'sagu', rewetted: 'dibasahi',
  '9.4': '9,4', '1.5': '1,5', '3.67 t CO2': '3,67 t CO2',
  baseline: 'baseline', leakage: 'kebocoran', project: 'proyek', reduction: 'penurunan', 'emissions so far': 'emisi kumulatif', years: 'tahun',
  'water stays': 'air tetap', 'peat sinks': 'gambut amblas', 'rewet only': 'basahi saja', 'rewet + plant': 'basahi + tanam',
  'crops on wet peat': 'tanaman gambut basah', 'the peat stays': 'gambut tetap', market: 'pasar', sell: 'jual',
  'beje pond': 'kolam beje', village: 'desa', food: 'lauk', 'fish farms in old canals': 'budi daya ikan di kanal lama', 'Care Village funds': 'dana Desa Peduli',
};
