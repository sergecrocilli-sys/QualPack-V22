
async function generatePDFV2() {
  try {
    await window._libsReady;
    // Support both window.jspdf (UMD global) and window.jsPDF direct attach
    const jspdfLib = window.jspdf || (typeof jsPDF !== 'undefined' ? { jsPDF } : null);
    if (!jspdfLib) {
      toast('Librairie PDF indisponible', 'err');
      return;
    }

    const { jsPDF } = jspdfLib;
    await ensurePdfBrandAssets();
    const data = getDashboardExportData();
    const theme = pdfV2Theme();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'normal');
    pdfSetText(doc, theme.text);

    const perimeter = getPDFV2Perimeter(data);
    const rows = getPDFV2Rows(data);

  // Page 1 — Synthèse
  pdfPageHeader(doc, 'Page 1/3', 'Synthèse', 1);
  let y = 34;

  pdfCard(doc, 14, y, 87, 30, theme.bgSoft, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); pdfSetText(doc, theme.text);
  doc.text('Période', 18, y + 8);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(perimeter.periodTitle, 18, y + 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.muted);
  doc.text(`Période analysée : ${data.filtersText.periode}`, 18, y + 23);

  pdfCard(doc, 109, y, 87, 30, theme.white, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); pdfSetText(doc, theme.text);
  doc.text('Conformité globale', 113, y + 8);
  const statusColor = pdfStatusColor(data.status.level, theme);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); pdfSetText(doc, statusColor);
  doc.text(`${Math.max(data.stats.pConf, data.stats.dConf)}%`, 113, y + 21);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.muted);
  doc.text('Vision immédiate de la période sélectionnée', 142, y + 21, { maxWidth: 48 });
  y += 38;

  pdfCard(doc, 14, y, 87, 44, theme.white, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); pdfSetText(doc, theme.text);
  doc.text('Contexte', 18, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); pdfSetText(doc, theme.text);
  doc.text(`Site : ${perimeter.site}`, 18, y + 16);
  doc.text(`Client : ${perimeter.client}`, 18, y + 24);
  doc.text(`Produit : ${perimeter.product}`, 18, y + 32);
  doc.text(`Ligne : ${perimeter.line}`, 18, y + 40);

  pdfCard(doc, 109, y, 87, 44, theme.white, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); pdfSetText(doc, theme.text);
  doc.text('Conformité pesées', 113, y + 8);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); pdfSetText(doc, data.stats.pConf >= 95 ? theme.green : data.stats.pConf >= 90 ? theme.orange : theme.red);
  doc.text(`${data.stats.pConf}%`, 113, y + 21);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.text);
  doc.text(`${data.stats.pErr} lot(s) non conformes`, 145, y + 16);
  doc.text(`${data.stats.pWarn} lot(s) à surveiller`, 145, y + 24);
  doc.text(`${data.stats.lots} lot(s) contrôlés`, 145, y + 32);

  y += 50;
  pdfSetFill(doc, statusColor);
  doc.roundedRect(14, y, 182, 12, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255,255,255);
  doc.text(`STATUT GLOBAL : ${data.status.chip.toUpperCase()}`, 18, y + 8);
  pdfSetText(doc, theme.text);
  y += 18;

  pdfSectionTitle(doc, y, 'Activité');
  y += 8;
  pdfMetricCard(doc, 14, y, 42, 24, 'Lots contrôlés', data.stats.lots, theme.blue, `Complétion ${data.stats.completion}%`);
  pdfMetricCard(doc, 61, y, 42, 24, 'Tests détecteur', data.stats.tests, theme.blue, `${data.stats.dOk} OK`);
  pdfMetricCard(doc, 108, y, 42, 24, 'TU1', data.stats.tu1, data.stats.tu1 > 0 ? theme.orange : theme.green, 'Défauts légers');
  pdfMetricCard(doc, 155, y, 41, 24, 'TU2', data.stats.tu2, data.stats.tu2 > 0 ? theme.red : theme.green, 'Défauts critiques');
  y += 32;

  pdfCard(doc, 14, y, 182, 28, theme.bgSoft, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); pdfSetText(doc, theme.text);
  doc.text('Lecture qualité', 18, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.text);
  const summaryLines = [
    `Pesées conformes : ${data.stats.pOk} / ${data.stats.lots}`,
    `Détecteur NOK : ${data.stats.dErr}`,
    `${data.status.title}`,
    `${data.status.subtitle}`
  ];
  doc.text(summaryLines, 18, y + 15);
  pdfDrawFooter(doc, 1);

  // Page 2 — Activité & traçabilité
  doc.addPage();
  pdfPageHeader(doc, 'Page 2/3', 'Activité & traçabilité', 2);
  y = 34;
  pdfCard(doc, 14, y, 182, 12, theme.bgSoft, theme.border, 3);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); pdfSetText(doc, theme.muted);
  doc.text('Tableau de suivi des contrôles qualité réalisés sur la période sélectionnée.', 18, y + 7.5);
  y += 18;

  const headers = ['Date', 'Produit / Équipement', 'N° OF', 'Ligne', 'Opérateur', 'Résultat'];
  const widths = [20, 46, 28, 28, 28, 26];
  drawPDFV2Table(doc, 14, y, widths, headers, rows.slice(0, 10), theme);
  y += 12 + (Math.min(rows.length,10) + 1) * 10 + 6;

  pdfCard(doc, 14, y, 182, 20, theme.white, theme.border, 3);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.text);
  doc.text([
    "Chaque ligne reprend la date, le produit ou l'\u00e9quipement, le num\u00e9ro d'ordre de fabrication, la ligne de production,",
    "L'op\u00e9rateur et le r\u00e9sultat final constitue le socle de tra\u00e7abilit\u00e9 du rapport."
  ], 18, y + 7);
  pdfDrawFooter(doc, 2);

  // Page 3 — Alertes & analyse
  doc.addPage();
  pdfPageHeader(doc, 'Page 3/3', 'Alertes & analyse', 3);
  y = 34;

  const allGood = data.stats.tu2 === 0 && data.stats.dErr === 0 && data.stats.pErr === 0;
  const bannerColor = allGood ? theme.green : (data.stats.tu2 > 0 || data.stats.dErr > 0 ? theme.red : theme.orange);
  pdfSetFill(doc, bannerColor);
  doc.roundedRect(14, y, 182, 22, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255,255,255);
  doc.text(allGood ? 'Aucune non-conformité détectée sur cette période' : data.status.title, 18, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text(allGood ? 'Process maîtrisé et contrôles réalisés correctement.' : data.status.subtitle, 18, y + 16);
  pdfSetText(doc, theme.text);
  y += 30;

  pdfSectionTitle(doc, y, 'Analyse automatique');
  y += 8;
  pdfCard(doc, 14, y, 182, 34, theme.white, theme.border, 3);
  const checks = buildPDFV2Checks(data);
  let cy = y + 9;
  checks.forEach((item, idx) => {
    const col = idx < 2 ? 18 : 108;
    const rowY = idx < 2 ? cy + idx * 10 : cy;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    pdfSetText(doc, item.ok ? theme.green : item.level === 'warn' ? theme.orange : theme.red);
    doc.text(item.ok ? '✓' : '•', col, rowY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); pdfSetText(doc, theme.text);
    doc.text(item.label, col + 6, rowY);
  });
  y += 42;

  pdfSectionTitle(doc, y, 'Alertes à retenir');
  y += 8;
  drawPDFV2AlertMiniTable(doc, 14, y, data.alerts.slice(0, 5), theme);
  y += 12 + (Math.min(data.alerts.length, 5) + 1) * 10 + 6;

  pdfCard(doc, 14, y, 182, 22, theme.bgSoft, theme.border, 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); pdfSetText(doc, theme.text);
  doc.text('Usage recommandé', 18, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); pdfSetText(doc, theme.text);
  doc.text('Support revue qualité · audit interne · présentation direction.', 18, y + 16);
  pdfDrawFooter(doc, 3);

  doc.save('qualpack_rapport_pdf_v2.pdf');
  } catch (e) {
    console.error('generatePDFV2 error:', e);
    toast('Erreur génération PDF', 'err');
  }
}

function getPDFV2Perimeter(data) {
  const p = Array.isArray(data.p) ? data.p : [];
  const d = Array.isArray(data.d) ? data.d : [];
  const allLines = [...new Set([...p, ...d].map(x => (x && (x.ligne_prod || x.ligne) || '').trim()).filter(Boolean))];
  return {
    periodTitle: data.filtersText?.periode === 'Tout historique' ? 'Tout historique' : `Les ${String(data.filtersText?.periode || '7 jours').replace(' jours',' derniers jours')}`,
    site: allLines.length > 1 ? `Lignes de production ${allLines.join(' / ')}` : (allLines[0] || 'Site non renseigné'),
    client: data.filtersText?.client || 'Tous les clients',
    product: data.filtersText?.produit || 'Tous produits',
    line: allLines.length ? allLines.join(' / ') : 'Toutes lignes'
  };
}

function getPDFV2Rows(data) {
  const pRows = (Array.isArray(data.p) ? data.p : []).map(s => ({
    date: s.date || '—',
    prod: s.prod || 'Produit',
    of: s.of || '—',
    line: s.ligne_prod || s.ligne || '—',
    op: s.op || '—',
    result: s.vF === 'ok' ? 'CONFORME' : s.vF === 'warn' ? 'A SURVEILLER' : 'NON CONFORME',
    level: s.vF || 'warn',
    ts: new Date(s.createdAt || s.date || 0).getTime() || 0
  }));

  const dRows = (Array.isArray(data.d) ? data.d : []).map(s => ({
    date: s.date || s.now || '—',
    prod: s.eq || 'Détecteur',
    of: s.of || '—',
    line: s.ligne_prod || s.ligne || '—',
    op: s.op || '—',
    result: s.vF === 'ok' ? 'CONFORME' : 'NON CONFORME',
    level: s.vF || 'warn',
    ts: new Date(s.createdAt || s.date || s.now || 0).getTime() || 0
  }));

  return [...pRows, ...dRows].sort((a,b) => b.ts - a.ts);
}

function buildPDFV2Checks(data) {
  return [
    { ok: data.stats.pErr === 0, level: data.stats.pErr === 0 ? 'ok' : 'err', label: data.stats.pErr === 0 ? 'Pesées critiques absentes' : `${data.stats.pErr} lot(s) de pesée non conforme(s)` },
    { ok: data.stats.dErr === 0, level: data.stats.dErr === 0 ? 'ok' : 'err', label: data.stats.dErr === 0 ? 'Détecteur maîtrisé' : `${data.stats.dErr} test(s) détecteur NOK` },
    { ok: data.stats.tu1 === 0, level: data.stats.tu1 === 0 ? 'ok' : 'warn', label: data.stats.tu1 === 0 ? 'Pas de dérive détectée' : `${data.stats.tu1} défaut(s) TU1 à analyser` }
  ];
}

function drawPDFV2Table(doc, x, y, widths, headers, rows, theme) {
  let cx = x;
  headers.forEach((h, idx) => {
    pdfCard(doc, cx, y, widths[idx], 10, [238,241,245], theme.border, 1.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); pdfSetText(doc, theme.text);
    doc.text(h, cx + 2, y + 6.2);
    cx += widths[idx];
  });
  rows.forEach((row, ridx) => {
    const ry = y + 10 + ridx * 10;
    const vals = [row.date, row.prod, row.of, row.line, row.op, row.result];
    let xx = x;
    vals.forEach((v, idx) => {
      pdfCard(doc, xx, ry, widths[idx], 10, theme.white, theme.border, 1.2);
      if (idx === 5) {
        const chipColor = row.level === 'ok' ? theme.green : row.level === 'warn' ? theme.orange : theme.red;
        pdfSetFill(doc, chipColor); doc.roundedRect(xx + 1.5, ry + 2, widths[idx] - 3, 6, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255,255,255);
        doc.text(String(v), xx + widths[idx]/2, ry + 5.9, { align: 'center' });
        pdfSetText(doc, theme.text);
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.1); pdfSetText(doc, theme.text);
        const text = String(v || '—');
        doc.text(text.length > 20 ? text.slice(0, 20) + '…' : text, xx + 1.7, ry + 6.1);
      }
      xx += widths[idx];
    });
  });
}

function drawPDFV2AlertMiniTable(doc, x, y, alerts, theme) {
  const headers = ['Date', 'Type', 'Produit/Éq.', 'Action'];
  const widths = [22, 24, 44, 92];
  let cx = x;
  headers.forEach((h, idx) => {
    pdfCard(doc, cx, y, widths[idx], 10, [238,241,245], theme.border, 1.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); pdfSetText(doc, theme.text);
    doc.text(h, cx + 2, y + 6.2);
    cx += widths[idx];
  });
  alerts.forEach((a, ridx) => {
    const ry = y + 10 + ridx * 10;
    const vals = [a.date || '—', a.type || '—', a.produit || '—', a.action || '—'];
    let xx = x;
    vals.forEach((v, idx) => {
      pdfCard(doc, xx, ry, widths[idx], 10, theme.white, theme.border, 1.2);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.1); pdfSetText(doc, theme.text);
      const maxLen = idx === 3 ? 55 : 18;
      const text = String(v || '—');
      doc.text(text.length > maxLen ? text.slice(0, maxLen) + '…' : text, xx + 1.7, ry + 6.1);
      xx += widths[idx];
    });
  });
}

function pdfDrawFooter(doc, pageNo) {
  const theme = pdfV2Theme();
  pdfSetDraw(doc, theme.border);
  doc.line(14, 284, 196, 284);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); pdfSetText(doc, theme.muted);
  doc.text('Document généré automatiquement par QualPack', 14, 289);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Usage recommandé : support revue qualité, audit interne, présentation direction.', 14, 293);
  doc.text(`Page ${pageNo}/3`, 196, 289, { align: 'right' });
}
