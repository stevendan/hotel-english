
const headingIds = {};

function toId(text) {
  const base = text.trim().toLowerCase().replace(/[^a-z0-9-￿]+/g, '-').replace(/^-+|-+$/g, '');
  let id = base || 'section';
  let counter = 1;
  while (headingIds[id]) {
    id = `${base}-${counter++}`;
  }
  headingIds[id] = true;
  return id;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text) {
  let output = escapeHtml(text);
  output = output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__(.+?)__/g, '<strong>$1</strong>');
  output = output.replace(/\*(.+?)\*/g, '<em>$1</em>');
  output = output.replace(/_(.+?)_/g, '<em>$1</em>');
  output = output.replace(/`([^`]+?)`/g, '<code>$1</code>');
  output = output.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return output;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let openList = null;
  let openTable = false;
  let tableRows = [];
  let paragraph = null;

  const closeList = () => {
    if (openList) {
      html += `</${openList}>\n`;
      openList = null;
    }
  };

  const closeTable = () => {
    if (openTable) {
      html += '<table>' + tableRows.join('') + '</table>\n';
      openTable = false;
      tableRows = [];
    }
  };

  const flushParagraph = () => {
    if (paragraph !== null) {
      html += `<p>${renderInline(paragraph.trim())}</p>\n`;
      paragraph = null;
    }
  };

  const isTableSeparator = (line) => {
    const columns = line.split('|').slice(1, -1).map(cell => cell.trim());
    return columns.length > 0 && columns.every(cell => /^:?-{3,}:?$/.test(cell));
  };

  for (let rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    if (/^\s*$/.test(line)) {
      closeList();
      closeTable();
      flushParagraph();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      closeTable();
      flushParagraph();
      html += '<hr />\n';
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeTable();
      flushParagraph();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = toId(text);
      html += `<h${level} id="${id}">${renderInline(text)}</h${level}>\n`;
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      closeList();
      closeTable();
      flushParagraph();
      html += `<blockquote>${renderInline(blockquoteMatch[1])}</blockquote>\n`;
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    const unorderedMatch = line.match(/^\s*([-*+])\s+(.*)$/);
    if (orderedMatch || unorderedMatch) {
      closeTable();
      flushParagraph();
      const listType = orderedMatch ? 'ol' : 'ul';
      if (openList !== listType) {
        closeList();
        openList = listType;
        html += `<${listType}>\n`;
      }
      const itemText = orderedMatch ? orderedMatch[1] : unorderedMatch[2];
      html += `<li>${renderInline(itemText)}</li>\n`;
      continue;
    }

    if (/\|/.test(line) && !isTableSeparator(line)) {
      const trimmed = line.trim();
      const hasTable = trimmed.startsWith('|') && trimmed.endsWith('|');
      if (hasTable) {
        closeList();
        flushParagraph();
        openTable = true;
        const cells = trimmed.split('|').slice(1, -1).map(cell => cell.trim());
        const row = cells.map(cell => `<td>${renderInline(cell)}</td>`).join('');
        tableRows.push(`<tr>${row}</tr>\n`);
        continue;
      }
    }

    closeList();
    closeTable();
    paragraph = paragraph ? `${paragraph} ${line.trim()}` : line.trim();
  }

  flushParagraph();
  closeList();
  closeTable();
  return html;
}

function buildNavigation() {
  const contentElement = document.getElementById('content');
  const toc = document.getElementById('toc');
  toc.innerHTML = '';

  const units = Array.from(contentElement.querySelectorAll('h2'));

  units.forEach((unit) => {
    const anchor = unit.id;
    const subs = [];
    let el = unit.nextElementSibling;
    while (el && el.tagName !== 'H2') {
      if (el.tagName === 'H3' || el.tagName === 'H4') {
        subs.push({ id: el.id, text: el.textContent });
      }
      el = el.nextElementSibling;
    }

    const unitDiv = document.createElement('div');
    unitDiv.className = 'toc-unit';

    const link = document.createElement('a');
    link.href = `#${anchor}`;
    link.dataset.anchor = anchor;
    link.className = 'level-2';
    link.textContent = unit.textContent;

    const arrow = document.createElement('span');
    arrow.className = 'toc-arrow';
    arrow.textContent = subs.length ? '›' : '';
    link.appendChild(arrow);

    link.addEventListener('click', (event) => {
      event.preventDefault();
      document.getElementById(anchor).scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('.toc a.active').forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
      if (subs.length) unitDiv.classList.toggle('expanded');
      if (window.innerWidth <= 760) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });

    unitDiv.appendChild(link);

    const sublist = document.createElement('div');
    sublist.className = 'toc-sublist';
    const inner = document.createElement('div');
    inner.className = 'toc-sublist-inner';
    subs.forEach((s) => {
      const a = document.createElement('a');
      a.href = `#${s.id}`;
      a.className = 'level-3';
      a.textContent = s.text;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        document.getElementById(s.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.querySelectorAll('.toc a.active').forEach((item) => item.classList.remove('active'));
        a.classList.add('active');
        if (window.innerWidth <= 760) document.getElementById('sidebar').classList.remove('open');
      });
      inner.appendChild(a);
    });
    sublist.appendChild(inner);
    unitDiv.appendChild(sublist);

    toc.appendChild(unitDiv);
  });

  const firstLink = document.querySelector('.toc a.level-2');
  if (firstLink) {
    firstLink.classList.add('active');
    firstLink.closest('.toc-unit').classList.add('expanded');
  }
}

function initTocSearch() {
  const searchInput = document.getElementById('searchToc');
  searchInput.addEventListener('input', () => {
    const filter = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('#toc a').forEach((item) => {
      const visible = item.textContent.toLowerCase().includes(filter);
      item.style.display = visible ? 'block' : 'none';
    });
  });
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const button = document.getElementById('toggleSidebar');
  button.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

function buildPartSelect(contentEl) {
  const partSelect = document.getElementById('partSelect');
  partSelect.innerHTML = '<option value="">— Chọn part —</option>';
  contentEl.querySelectorAll('h3').forEach(h3 => {
    const opt = document.createElement('option');
    opt.value = h3.id;
    opt.textContent = h3.textContent;
    partSelect.appendChild(opt);
  });
}

async function loadUnit(unitNum) {
  const loadingMsg = document.getElementById('loadingMsg');
  const contentEl = document.getElementById('content');
  if (loadingMsg) loadingMsg.textContent = 'Đang tải...';
  contentEl.innerHTML = '';
  try {
    const res = await fetch('md/Unit' + unitNum + '.md');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const md = await res.text();
    contentEl.innerHTML = injectTrackButtons(renderMarkdown(md));
    buildNavigation();
    buildPartSelect(contentEl);
    const firstH1 = contentEl.querySelector('h1');
    const unitLabel = firstH1 ? firstH1.textContent : 'Unit ' + unitNum;
    document.getElementById('topbarTitle').textContent = unitLabel;
    document.getElementById('currentUnitDesc').textContent = unitLabel;
    if (loadingMsg) loadingMsg.textContent = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    contentEl.innerHTML = '<p style="color:red;padding:2rem;">Không tải được Unit ' + unitNum + ': ' + err.message + '</p>';
    if (loadingMsg) loadingMsg.textContent = '';
  }
}

function injectTrackButtons(html) {
  return html.replace(/\(Track (\d+)\)/g, (_, num) => {
    const padded = String(num).padStart(2, '0');
    const src = `mp3/Track ${padded}.mp3`;
    return `<button class="track-btn" data-src="${src}" data-track="${num}"><span class="track-icon">▶</span> Track ${num}</button>`;
  });
}

function initAudioBar() {
  const bar = document.getElementById('audioBar');
  const audio = document.getElementById('mainAudio');
  const barTitle = document.getElementById('audioBarTitle');
  const closeBtn = document.getElementById('audioClose');

  function setButtonState(track, playing) {
    document.querySelectorAll(`.track-btn[data-track="${track}"]`).forEach(btn => {
      btn.classList.toggle('playing', playing);
      const icon = btn.querySelector('.track-icon');
      if (icon) icon.textContent = playing ? '⏸' : '▶';
    });
  }

  function clearAllButtons() {
    document.querySelectorAll('.track-btn').forEach(btn => {
      btn.classList.remove('playing');
      const icon = btn.querySelector('.track-icon');
      if (icon) icon.textContent = '▶';
    });
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.track-btn');
    if (!btn) return;
    const src = btn.dataset.src;
    const track = btn.dataset.track;
    const isSame = audio.dataset.currentTrack === track;

    if (isSame && !audio.paused) {
      audio.pause();
    } else {
      clearAllButtons();
      audio.src = encodeURI(src);
      audio.dataset.currentTrack = track;
      barTitle.textContent = `♪ Track ${track}`;
      bar.classList.add('visible');
      document.body.classList.add('audio-active');
      audio.play().catch(() => {});
    }
  });

  audio.addEventListener('play', () => setButtonState(audio.dataset.currentTrack, true));
  audio.addEventListener('pause', () => setButtonState(audio.dataset.currentTrack, false));
  audio.addEventListener('ended', () => setButtonState(audio.dataset.currentTrack, false));

  closeBtn.addEventListener('click', () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    delete audio.dataset.currentTrack;
    bar.classList.remove('visible');
    document.body.classList.remove('audio-active');
    clearAllButtons();
  });
}

function resetIOSZoom() {
  const vp = document.querySelector('meta[name=viewport]');
  if (!vp) return;
  const original = vp.getAttribute('content');
  vp.setAttribute('content', original + ',maximum-scale=1');
  setTimeout(() => vp.setAttribute('content', original), 100);
}

function init() {
  initTocSearch();
  initSidebarToggle();
  initAudioBar();
  const unitSelect = document.getElementById('unitSelect');
  unitSelect.addEventListener('change', () => {
    const val = unitSelect.value;
    unitSelect.blur();
    resetIOSZoom();
    loadUnit(val);
  });
  const partSelect = document.getElementById('partSelect');
  partSelect.addEventListener('change', () => {
    const id = partSelect.value;
    if (!id) return;
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    partSelect.value = '';
    partSelect.blur();
  });
  loadUnit(1);
}

window.addEventListener('DOMContentLoaded', init);
