/**
 * jspdf.umd.js — QualPack compatible build
 * Wrapper UMD autoportant autour de la logique de génération PDF.
 * Compatible avec db.js (IndexedDB : pesees / detecteurs).
 * Pas de dépendance externe requise.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? module.exports = factory()
    : typeof define === 'function' && define.amd
      ? define(factory)
      : (global = typeof globalThis !== 'undefined' ? globalThis : global || self,
         global.jspdf = global.jspdf || {},
         global.jspdf.jsPDF = factory());
}(this, function () {
  'use strict';

  // ─── Constantes PDF ────────────────────────────────────────────────────────
  const PT_PER_MM = 2.8346456692913385;
  const PAGE_W_MM = 210;
  const PAGE_H_MM = 297;
  const PAGE_W_PT = PAGE_W_MM * PT_PER_MM;
  const PAGE_H_PT = PAGE_H_MM * PT_PER_MM;

  // ─── Encodeur texte base85 / latin1 ────────────────────────────────────────
  function toHex(n, pad) {
    return n.toString(16).toUpperCase().padStart(pad, '0');
  }

  function latin1Encode(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out += c < 256 ? String.fromCharCode(c) : '?';
    }
    return out;
  }

  // ─── Polices intégrées (Helvetica, Courier) ────────────────────────────────
  const FONT_HELVETICA = 'Helvetica';
  const FONT_COURIER   = 'Courier';
  const FONT_BOLD      = 'Helvetica-Bold';

  // ─── Classe principale jsPDF ────────────────────────────────────────────────
  class jsPDF {
    constructor(options) {
      options = options || {};
      const orientation = (options.orientation || 'p').toLowerCase();
      const unit        = options.unit || 'mm';
      const format      = options.format || 'a4';

      // Facteur de conversion vers points
      this._k = unit === 'mm' ? PT_PER_MM
              : unit === 'cm' ? PT_PER_MM * 10
              : unit === 'in' ? 72
              : 1; // pt

      if (Array.isArray(format)) {
        this._pageW = format[0] * this._k;
        this._pageH = format[1] * this._k;
      } else {
        this._pageW = PAGE_W_PT;
        this._pageH = PAGE_H_PT;
      }
      if (orientation === 'l' || orientation === 'landscape') {
        [this._pageW, this._pageH] = [this._pageH, this._pageW];
      }

      this._pages        = [];       // tableaux de commandes par page
      this._currentPage  = 0;
      this._font         = FONT_HELVETICA;
      this._fontSize     = 10;
      this._textColor    = '0 0 0';  // RGB 0..1
      this._fillColor    = '1 1 1';
      this._drawColor    = '0 0 0';
      this._lineWidth    = 0.2;
      this._images       = {};
      this._objCount     = 0;
      this._objects      = [];       // objets PDF bruts
      this._margins      = { top: 10, right: 10, bottom: 10, left: 10 };

      this._addPage();
    }

    // ── Gestion pages ──────────────────────────────────────────────────────
    _addPage() {
      this._pages.push([]);
      this._currentPage = this._pages.length - 1;
    }

    addPage(format, orientation) {
      this._addPage();
      return this;
    }

    setPage(n) {
      if (n >= 1 && n <= this._pages.length) {
        this._currentPage = n - 1;
      }
      return this;
    }

    getNumberOfPages() { return this._pages.length; }

    _cmd(s) { this._pages[this._currentPage].push(s); }

    // ── Polices & tailles ─────────────────────────────────────────────────
    setFont(name, style) {
      style = (style || '').toLowerCase();
      if (style === 'bold' || style === 'b') {
        this._font = name.includes('Courier') ? 'Courier-Bold' : 'Helvetica-Bold';
      } else if (style === 'italic' || style === 'i') {
        this._font = name.includes('Courier') ? 'Courier-Oblique' : 'Helvetica-Oblique';
      } else if (style === 'bolditalic' || style === 'bi') {
        this._font = name.includes('Courier') ? 'Courier-BoldOblique' : 'Helvetica-BoldOblique';
      } else {
        this._font = name || FONT_HELVETICA;
      }
      return this;
    }

    setFontSize(size) {
      this._fontSize = size;
      return this;
    }

    getFontSize() { return this._fontSize; }

    // ── Couleurs ──────────────────────────────────────────────────────────
    _hexToRgb01(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substr(0, 2), 16) / 255;
      const g = parseInt(hex.substr(2, 2), 16) / 255;
      const b = parseInt(hex.substr(4, 2), 16) / 255;
      return `${r.toFixed(4)} ${g.toFixed(4)} ${b.toFixed(4)}`;
    }

    _parseColor(ch) {
      if (typeof ch === 'string' && ch.startsWith('#')) return this._hexToRgb01(ch);
      if (typeof ch === 'string') {
        const named = { black:'0 0 0', white:'1 1 1', red:'1 0 0', green:'0 0.502 0',
                        blue:'0 0 1', gray:'0.502 0.502 0.502', grey:'0.502 0.502 0.502',
                        orange:'1 0.647 0', yellow:'1 1 0' };
        return named[ch.toLowerCase()] || '0 0 0';
      }
      return '0 0 0';
    }

    setTextColor(r, g, b) {
      if (typeof r === 'string') { this._textColor = this._parseColor(r); return this; }
      if (g === undefined) {
        const v = r / 255;
        this._textColor = `${v.toFixed(4)} ${v.toFixed(4)} ${v.toFixed(4)}`;
      } else {
        this._textColor = `${(r/255).toFixed(4)} ${(g/255).toFixed(4)} ${(b/255).toFixed(4)}`;
      }
      return this;
    }

    setFillColor(r, g, b) {
      if (typeof r === 'string') { this._fillColor = this._parseColor(r); return this; }
      if (g === undefined) {
        const v = r / 255;
        this._fillColor = `${v.toFixed(4)} ${v.toFixed(4)} ${v.toFixed(4)}`;
      } else {
        this._fillColor = `${(r/255).toFixed(4)} ${(g/255).toFixed(4)} ${(b/255).toFixed(4)}`;
      }
      return this;
    }

    setDrawColor(r, g, b) {
      if (typeof r === 'string') { this._drawColor = this._parseColor(r); return this; }
      if (g === undefined) {
        const v = r / 255;
        this._drawColor = `${v.toFixed(4)} ${v.toFixed(4)} ${v.toFixed(4)}`;
      } else {
        this._drawColor = `${(r/255).toFixed(4)} ${(g/255).toFixed(4)} ${(b/255).toFixed(4)}`;
      }
      return this;
    }

    setLineWidth(w) {
      this._lineWidth = w;
      return this;
    }

    // ── Dimensions texte ──────────────────────────────────────────────────
    getStringUnitWidth(str) {
      // Approximation Helvetica : 0.5 * fontSize par caractère en pt
      return str.length * 0.5;
    }

    getTextWidth(str) {
      return this.getStringUnitWidth(str) * this._fontSize / this._k;
    }

    // ── Conversion coord (mm → pt internes) ───────────────────────────────
    _x(x) { return x * this._k; }
    _y(y) { return this._pageH - y * this._k; }

    // ── Texte ─────────────────────────────────────────────────────────────
    text(text, x, y, options) {
      options = options || {};
      const lines = Array.isArray(text) ? text : String(text).split('\n');
      const lineH = this._fontSize * 1.2 / this._k;

      this._cmd(`BT`);
      this._cmd(`/${this._pdfFontName(this._font)} ${this._fontSize} Tf`);
      this._cmd(`${this._textColor} rg`);

      let align = options.align || 'left';
      for (let i = 0; i < lines.length; i++) {
        const line = String(lines[i]);
        let px = x;
        if (align === 'center') {
          px = x - this.getTextWidth(line) / 2;
        } else if (align === 'right') {
          px = x - this.getTextWidth(line);
        }
        const pdfX = this._x(px);
        const pdfY = this._y(y + i * lineH);
        this._cmd(`${pdfX.toFixed(3)} ${pdfY.toFixed(3)} Td`);
        this._cmd(`(${this._escapePDF(line)}) Tj`);
        if (i < lines.length - 1) {
          this._cmd(`${(-pdfX).toFixed(3)} 0 Td`);
        }
      }
      this._cmd(`ET`);
      return this;
    }

    _escapePDF(s) {
      return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    }

    _pdfFontName(f) {
      const map = {
        'Helvetica':             'F1',
        'Helvetica-Bold':        'F2',
        'Helvetica-Oblique':     'F3',
        'Helvetica-BoldOblique': 'F4',
        'Courier':               'F5',
        'Courier-Bold':          'F6',
        'Courier-Oblique':       'F7',
        'Courier-BoldOblique':   'F8',
        'Times-Roman':           'F9',
        'Times-Bold':            'F10',
      };
      return map[f] || 'F1';
    }

    // ── Formes géométriques ───────────────────────────────────────────────
    rect(x, y, w, h, style) {
      const px = this._x(x);
      const py = this._y(y) - h * this._k;
      const pw = w * this._k;
      const ph = h * this._k;

      this._cmd(`${this._lineWidth * this._k} w`);
      if (style === 'F' || style === 'FD') {
        this._cmd(`${this._fillColor} rg`);
        this._cmd(`${px.toFixed(3)} ${py.toFixed(3)} ${pw.toFixed(3)} ${ph.toFixed(3)} re`);
        this._cmd(style === 'FD' ? 'B' : 'f');
      } else {
        this._cmd(`${this._drawColor} RG`);
        this._cmd(`${px.toFixed(3)} ${py.toFixed(3)} ${pw.toFixed(3)} ${ph.toFixed(3)} re`);
        this._cmd('S');
      }
      return this;
    }

    roundedRect(x, y, w, h, rx, ry, style) {
      // Approximation : rect classique si rx/ry petits
      return this.rect(x, y, w, h, style);
    }

    line(x1, y1, x2, y2) {
      this._cmd(`${this._drawColor} RG`);
      this._cmd(`${this._lineWidth * this._k} w`);
      this._cmd(`${this._x(x1).toFixed(3)} ${this._y(y1).toFixed(3)} m`);
      this._cmd(`${this._x(x2).toFixed(3)} ${this._y(y2).toFixed(3)} l S`);
      return this;
    }

    // ── splitTextToSize ────────────────────────────────────────────────────
    splitTextToSize(text, maxWidth) {
      const words = String(text).split(' ');
      const lines = [];
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (this.getTextWidth(test) <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
      return lines.length ? lines : [text];
    }

    // ── Dimensions page ───────────────────────────────────────────────────
    internal = {
      pageSize: {
        getWidth:  () => this._pageW / this._k,
        getHeight: () => this._pageH / this._k,
      },
      getEncryptor: () => (str) => str,
    };

    // ── autoTable (plugin léger intégré) ──────────────────────────────────
    autoTable(opts) {
      opts = opts || {};
      const head    = opts.head || [];
      const body    = opts.body || [];
      const startY  = opts.startY || 20;
      const margin  = opts.margin || { left: 10, right: 10 };
      const ml      = (typeof margin === 'number') ? margin : (margin.left || 10);
      const mr      = (typeof margin === 'number') ? margin : (margin.right || 10);
      const styles  = opts.styles || {};
      const headStyles = opts.headStyles || {};
      const bodyStyles = opts.bodyStyles || {};
      const altBodyStyles = opts.alternateRowStyles || {};
      const colStyles  = opts.columnStyles || {};
      const theme   = opts.theme || 'striped';

      const pageW   = this._pageW / this._k;
      const tableW  = pageW - ml - mr;
      const didDrawPage = opts.didDrawPage || null;
      const didParseCell = opts.didParseCell || null;

      // Colonnes
      const columns = opts.columns || (head[0] ? head[0].map((_, i) => ({ dataKey: i })) : []);
      const numCols = head[0] ? head[0].length : (body[0] ? body[0].length : 0);
      if (numCols === 0) { this.lastAutoTable = { finalY: startY }; return this; }

      // Largeurs
      let colWidths = [];
      if (opts.columnStyles) {
        let totalFixed = 0, fixedCount = 0;
        for (let c = 0; c < numCols; c++) {
          const cs = opts.columnStyles[c] || {};
          if (cs.cellWidth) { colWidths[c] = cs.cellWidth; totalFixed += cs.cellWidth; fixedCount++; }
        }
        const remaining = (tableW - totalFixed) / (numCols - fixedCount || 1);
        for (let c = 0; c < numCols; c++) {
          if (!colWidths[c]) colWidths[c] = remaining;
        }
      } else {
        const w = tableW / numCols;
        colWidths = Array(numCols).fill(w);
      }

      const rowH        = styles.rowHeight || headStyles.rowHeight || bodyStyles.rowHeight || 7;
      const headRowH    = headStyles.rowHeight || rowH;
      const headFS      = headStyles.fontSize  || styles.fontSize || this._fontSize;
      const bodyFS      = bodyStyles.fontSize  || styles.fontSize || this._fontSize;
      const cellPad     = styles.cellPadding !== undefined ? styles.cellPadding : 2;
      const pageH       = this._pageH / this._k;
      const bottomMargin = (opts.margin && opts.margin.bottom) || 15;

      let curY = startY;

      // ── Draw header ──
      const drawHeader = (y) => {
        if (!head.length) return y;
        const hRow = head[0];
        let cx = ml;
        // Fond header
        const hBg = headStyles.fillColor || (theme === 'grid' ? [66,66,66] : [41, 128, 185]);
        this.setFillColor(hBg[0], hBg[1], hBg[2]);
        this.rect(ml, y, tableW, headRowH, 'F');
        // Texte header
        this.setFontSize(headFS);
        this.setFont(this._font, 'bold');
        const hTc = headStyles.textColor || [255, 255, 255];
        this.setTextColor(hTc[0], hTc[1], hTc[2]);
        for (let c = 0; c < hRow.length; c++) {
          const cell = hRow[c];
          const txt  = typeof cell === 'object' ? (cell.content || cell.title || '') : String(cell || '');
          const ha   = (headStyles.halign || 'left');
          const tx   = ha === 'center' ? cx + colWidths[c] / 2
                     : ha === 'right'  ? cx + colWidths[c] - cellPad
                     : cx + cellPad;
          this.text(txt, tx, y + headRowH - cellPad - 0.5, { align: ha });
          cx += colWidths[c];
        }
        return y + headRowH;
      };

      curY = drawHeader(curY);

      // ── Draw body ──
      this.setFontSize(bodyFS);
      this.setFont(this._font, 'normal');

      for (let r = 0; r < body.length; r++) {
        const row = body[r];

        // Calcul hauteur dynamique (wrap)
        let rowHeight = rowH;
        for (let c = 0; c < row.length; c++) {
          const cs  = colStyles[c] || {};
          const ov  = cs.overflow || styles.overflow || 'ellipsize';
          if (ov === 'linebreak') {
            const cell = row[c];
            const txt  = typeof cell === 'object' ? String(cell.content || '') : String(cell || '');
            const maxW = colWidths[c] - cellPad * 2;
            const lines = this.splitTextToSize(txt, maxW);
            const needed = lines.length * (bodyFS * 1.2 / this._k) + cellPad * 2;
            if (needed > rowHeight) rowHeight = needed;
          }
        }

        // Nouvelle page si nécessaire
        if (curY + rowHeight > pageH - bottomMargin) {
          this.addPage();
          curY = (opts.margin && opts.margin.top) || 10;
          if (opts.showHead !== 'firstPage') {
            curY = drawHeader(curY);
          }
          if (didDrawPage) didDrawPage({ pageNumber: this._currentPage + 1, doc: this });
        }

        // Fond alterné
        let bg = null;
        if (theme === 'striped' && r % 2 === 1) {
          bg = altBodyStyles.fillColor || [240, 240, 240];
        }
        if (bodyStyles.fillColor) bg = bodyStyles.fillColor;
        if (bg) {
          this.setFillColor(bg[0], bg[1], bg[2]);
          this.rect(ml, curY, tableW, rowHeight, 'F');
        }
        if (theme === 'grid') {
          this.setDrawColor(200, 200, 200);
          this.rect(ml, curY, tableW, rowHeight);
        }

        // Cellules
        let cx = ml;
        const tc = bodyStyles.textColor || (styles.textColor) || [0,0,0];
        this.setTextColor(tc[0], tc[1], tc[2]);

        for (let c = 0; c < numCols; c++) {
          const cell = row[c];
          const cs   = colStyles[c] || {};
          const ha   = cs.halign || bodyStyles.halign || styles.halign || 'left';
          const ov   = cs.overflow || styles.overflow || 'ellipsize';
          let txt    = typeof cell === 'object' ? String(cell.content || '') : String(cell !== undefined && cell !== null ? cell : '');

          if (ov === 'linebreak') {
            const maxW = colWidths[c] - cellPad * 2;
            const lines = this.splitTextToSize(txt, maxW);
            for (let li = 0; li < lines.length; li++) {
              const ty = curY + cellPad + li * (bodyFS * 1.2 / this._k) + bodyFS / this._k * 0.7;
              this.text(lines[li], cx + cellPad, ty);
            }
          } else {
            // Ellipsis si trop long
            const maxW = colWidths[c] - cellPad * 2;
            while (txt.length > 1 && this.getTextWidth(txt) > maxW) {
              txt = txt.slice(0, -1);
            }
            const tx = ha === 'center' ? cx + colWidths[c] / 2
                     : ha === 'right'  ? cx + colWidths[c] - cellPad
                     : cx + cellPad;
            const ty = curY + cellPad + bodyFS / this._k * 0.7;
            this.text(txt, tx, ty, { align: ha });
          }

          if (theme === 'grid') {
            this.setDrawColor(200, 200, 200);
            this.line(cx, curY, cx, curY + rowHeight);
          }
          cx += colWidths[c];
        }

        curY += rowHeight;
      }

      // Bordure finale tableau (grid)
      if (theme === 'grid') {
        this.setDrawColor(200, 200, 200);
        this.rect(ml, startY, tableW, curY - startY);
      }

      this.lastAutoTable = { finalY: curY };
      // Restaurer couleur texte
      this.setTextColor(0, 0, 0);
      return this;
    }

    // ── Génération PDF binaire ─────────────────────────────────────────────
    _buildPDF() {
      const out = [];
      const offsets = [];

      const emit = (s) => out.push(s);
      let pos = 0;
      const positions = [];

      const write = (s) => {
        const b = s + '\n';
        positions.push(pos);
        pos += new TextEncoder().encode(b).length;
        return b;
      };

      let pdf = '%PDF-1.4\n';
      pdf += '%\xFF\xFF\xFF\xFF\n'; // binary marker

      // Objets accumulés
      const objs = [];
      let oid = 1;

      const FONTS = [
        ['F1',  'Helvetica'],
        ['F2',  'Helvetica-Bold'],
        ['F3',  'Helvetica-Oblique'],
        ['F4',  'Helvetica-BoldOblique'],
        ['F5',  'Courier'],
        ['F6',  'Courier-Bold'],
        ['F7',  'Courier-Oblique'],
        ['F8',  'Courier-BoldOblique'],
        ['F9',  'Times-Roman'],
        ['F10', 'Times-Bold'],
      ];

      // Font objects
      const fontOids = {};
      for (const [fname, basefont] of FONTS) {
        const foid = oid++;
        fontOids[fname] = foid;
        objs.push({ id: foid, data:
          `${foid} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${basefont} /Encoding /WinAnsiEncoding >>\nendobj` });
      }

      // Resources dict
      let fontDict = '';
      for (const [fname] of FONTS) {
        fontDict += `/${fname} ${fontOids[fname]} 0 R `;
      }

      // Page contents + page objects
      const pageOids = [];
      const contentOids = [];

      for (let p = 0; p < this._pages.length; p++) {
        const cmds = this._pages[p].join('\n');
        const contentOid = oid++;
        const stream = cmds;
        objs.push({ id: contentOid, data:
          `${contentOid} 0 obj\n<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream\nendobj` });
        contentOids.push(contentOid);

        const pageOid = oid++;
        pageOids.push(pageOid);
        objs.push({ id: pageOid, data: null, isPage: true, contentOid });
      }

      // Pages node
      const pagesOid = oid++;
      const pageRefs = pageOids.map(i => `${i} 0 R`).join(' ');
      objs.push({ id: pagesOid, data:
        `${pagesOid} 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageOids.length} >>\nendobj` });

      // Fill page objects now that pagesOid is known
      for (let p = 0; p < pageOids.length; p++) {
        const pid = pageOids[p];
        const cid = contentOids[p];
        const obj = objs.find(o => o.id === pid);
        obj.data = `${pid} 0 obj\n<< /Type /Page /Parent ${pagesOid} 0 R`
          + ` /MediaBox [0 0 ${this._pageW.toFixed(3)} ${this._pageH.toFixed(3)}]`
          + ` /Resources << /Font << ${fontDict}>> >>`
          + ` /Contents ${cid} 0 R >>\nendobj`;
      }

      // Catalog
      const catalogOid = oid++;
      objs.push({ id: catalogOid, data:
        `${catalogOid} 0 obj\n<< /Type /Catalog /Pages ${pagesOid} 0 R >>\nendobj` });

      // Assemble
      let body = `%PDF-1.4\n%\xFF\xFF\n`;
      const xref = {};
      for (const obj of objs) {
        xref[obj.id] = body.length;
        body += obj.data + '\n';
      }

      const xrefOffset = body.length;
      const maxId = Math.max(...objs.map(o => o.id));
      let xrefTable = `xref\n0 ${maxId + 1}\n`;
      xrefTable += '0000000000 65535 f \n';
      for (let i = 1; i <= maxId; i++) {
        const off = xref[i];
        if (off !== undefined) {
          xrefTable += String(off).padStart(10, '0') + ' 00000 n \n';
        } else {
          xrefTable += '0000000000 65535 f \n';
        }
      }
      body += xrefTable;
      body += `trailer\n<< /Size ${maxId + 1} /Root ${catalogOid} 0 R >>\n`;
      body += `startxref\n${xrefOffset}\n%%EOF`;

      return body;
    }

    // ── Sorties ────────────────────────────────────────────────────────────
    output(type, options) {
      const pdfStr = this._buildPDF();
      const bytes  = new Uint8Array(pdfStr.length);
      for (let i = 0; i < pdfStr.length; i++) {
        bytes[i] = pdfStr.charCodeAt(i) & 0xFF;
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });

      if (type === 'blob' || !type) return blob;
      if (type === 'arraybuffer') return bytes.buffer;
      if (type === 'datauristring' || type === 'dataurlstring') {
        return 'data:application/pdf;base64,' + this._blobToBase64Sync(bytes);
      }
      if (type === 'datauri' || type === 'dataurl') {
        const url = URL.createObjectURL(blob);
        window.open(url, options && options.filename ? options.filename : '_blank');
        return;
      }
      return blob;
    }

    _blobToBase64Sync(bytes) {
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }

    save(filename, options) {
      filename = filename || 'document.pdf';
      const blob = this.output('blob');
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 300);
      if (options && typeof options.returnPromise === 'boolean' && options.returnPromise) {
        return Promise.resolve();
      }
    }

    // ── Compatibilité plugin autoTable externe ─────────────────────────────
    // Permet d'utiliser jspdf-autotable s'il est chargé séparément
    static API = {};
  }

  // ── Plugin autoTable global (si chargé séparément) ──────────────────────
  if (typeof window !== 'undefined') {
    window.jspdf = window.jspdf || {};
    window.jspdf.jsPDF = jsPDF;
    // Alias commun
    window.jsPDF = jsPDF;
  }

  return jsPDF;
}));
