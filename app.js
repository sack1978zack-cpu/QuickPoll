/* ==========================================================================
   QuickPoll Single-Page Application
   Pages: Create Poll | How to Use | Q&A | Privacy | My Polls | Unique Poll
   Supports Hostinger PHP Live Sync (poll-api.php) and Static URL Mode
   ========================================================================== */
(() => {
  'use strict';

  const STORAGE_SAVED_KEY = 'quickpoll_saved_v1';
  const STORAGE_VOTES_KEY = 'quickpoll_votes_v1';
  const STORAGE_USER_PICKS_KEY = 'quickpoll_user_picks_v1';

  const state = {
    serverMode: false,
    currentPage: 'create',
    builder: {
      question: '',
      options: ['', ''],
      multiChoice: false,
      expiryMinutes: 1440,
      customExpiryISO: '',
      theme: 'sovereign',
      icon: 'assets/icon-vote.png',
    },
    previewVotes: [],
    previewPicks: [],
    lastGeneratedUrl: '',
    lastGeneratedPollId: '',
    activePoll: null,
    activeSelectedIndexes: [],
    activeShowResults: false,
    countdownTimerId: null,
    pollRefreshTimerId: null,
  };

  const el = {
    body: document.body,
    brandHomeLink: document.getElementById('brandHomeLink'),
    syncModeBadge: document.getElementById('syncModeBadge'),
    syncModeText: document.getElementById('syncModeText'),
    navCreateBtn: document.getElementById('navCreateBtn'),
    navHowToBtn: document.getElementById('navHowToBtn'),
    navQaBtn: document.getElementById('navQaBtn'),
    navPrivacyBtn: document.getElementById('navPrivacyBtn'),
    navSavedBtn: document.getElementById('navSavedBtn'),
    savedCountBadge: document.getElementById('savedCountBadge'),
    toastBanner: document.getElementById('toastBanner'),

    createView: document.getElementById('createView'),
    howToView: document.getElementById('howToView'),
    qaView: document.getElementById('qaView'),
    privacyView: document.getElementById('privacyView'),
    pollView: document.getElementById('pollView'),
    savedView: document.getElementById('savedView'),

    pollForm: document.getElementById('pollForm'),
    questionInput: document.getElementById('questionInput'),
    questionCharCount: document.getElementById('questionCharCount'),
    questionMeterFill: document.getElementById('questionMeterFill'),
    questionFeedback: document.getElementById('questionFeedback'),
    optionsList: document.getElementById('optionsList'),
    optionCountStatus: document.getElementById('optionCountStatus'),
    answersFeedback: document.getElementById('answersFeedback'),
    addOptionBtn: document.getElementById('addOptionBtn'),
    multiChoiceToggle: document.getElementById('multiChoiceToggle'),

    presetPills: Array.from(document.querySelectorAll('.preset-pill')),
    customDateWrap: document.getElementById('customDateWrap'),
    customExpiryInput: document.getElementById('customExpiryInput'),
    expiryLiveSummary: document.getElementById('expiryLiveSummary'),

    swatchBtns: Array.from(document.querySelectorAll('.swatch-btn')),
    iconPickBtns: Array.from(document.querySelectorAll('.icon-pick-btn')),

    livePreviewCard: document.getElementById('livePreviewCard'),
    previewCountdown: document.getElementById('previewCountdown'),
    previewIconSlot: document.getElementById('previewIconSlot'),
    previewIconImg: document.getElementById('previewIconImg'),
    previewQuestion: document.getElementById('previewQuestion'),
    previewMeta: document.getElementById('previewMeta'),
    previewOptionsList: document.getElementById('previewOptionsList'),
    resetPreviewVotesBtn: document.getElementById('resetPreviewVotesBtn'),

    shareResultCard: document.getElementById('shareResultCard'),
    generatedUrlInput: document.getElementById('generatedUrlInput'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    openPollPageBtn: document.getElementById('openPollPageBtn'),
    nativeShareBtn: document.getElementById('nativeShareBtn'),

    jumpCreateBtns: Array.from(document.querySelectorAll('.jump-create-btn')),
    footerNavLinks: Array.from(document.querySelectorAll('.footer-nav-link')),
    faqTriggers: Array.from(document.querySelectorAll('.faq-trigger')),

    activePollStatusPill: document.getElementById('activePollStatusPill'),
    activePollStatusLabel: document.getElementById('activePollStatusLabel'),
    activeCountdownText: document.getElementById('activeCountdownText'),
    activePollIconSlot: document.getElementById('activePollIconSlot'),
    activePollIconImg: document.getElementById('activePollIconImg'),
    activePollQuestion: document.getElementById('activePollQuestion'),
    activePollSubtitle: document.getElementById('activePollSubtitle'),
    activeOptionsContainer: document.getElementById('activeOptionsContainer'),
    castVoteBtn: document.getElementById('castVoteBtn'),
    toggleResultsViewBtn: document.getElementById('toggleResultsViewBtn'),
    activeTotalVotes: document.getElementById('activeTotalVotes'),
    activeExpiryDateText: document.getElementById('activeExpiryDateText'),
    activeCopyLinkBtn: document.getElementById('activeCopyLinkBtn'),
    backToBuilderBtn: document.getElementById('backToBuilderBtn'),

    savedPollsGrid: document.getElementById('savedPollsGrid'),
    savedBackBtn: document.getElementById('savedBackBtn'),
  };

  /* ========================================================================
     Utilities
     ======================================================================== */

  let toastTimeout = null;
  function showToast(message) {
    el.toastBanner.textContent = message;
    el.toastBanner.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      el.toastBanner.classList.remove('show');
    }, 2600);
  }

  function triggerJuicyPop(node) {
    if (!node) return;
    node.classList.remove('juicy-pop');
    void node.offsetWidth;
    node.classList.add('juicy-pop');
  }

  function resolveIconSrc(iconPath) {
    if (!iconPath) return '';
    if (window.QUICKPOLL_ASSET_DATA && window.QUICKPOLL_ASSET_DATA[iconPath]) {
      return window.QUICKPOLL_ASSET_DATA[iconPath];
    }
    return iconPath;
  }

  function applyTheme(themeName) {
    el.body.classList.remove('theme-sovereign', 'theme-crimson-gold', 'theme-cobalt-purple');
    const safeTheme = ['sovereign', 'crimson-gold', 'cobalt-purple'].includes(themeName)
      ? themeName
      : 'sovereign';
    el.body.classList.add(`theme-${safeTheme}`);
  }

  function generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = 'qp_';
    for (let i = 0; i < 10; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function encodeBase64Url(obj) {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decodeBase64Url(str) {
    try {
      let padded = str.replace(/-/g, '+').replace(/_/g, '/');
      while (padded.length % 4) padded += '=';
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const json = new TextDecoder().decode(bytes);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  function formatDurationShort(ms) {
    if (ms <= 0) return 'Expired';
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${mins}m left`;
    if (mins > 0) return `${mins}m ${secs}s left`;
    return `${secs}s left`;
  }

  function formatCountdownClock(ms) {
    if (ms <= 0) return '00d : 00h : 00m : 00s';
    const totalSec = Math.floor(ms / 1000);
    const d = String(Math.floor(totalSec / 86400)).padStart(2, '0');
    const h = String(Math.floor((totalSec % 86400) / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return d !== '00' ? `${d}d : ${h}h : ${m}m : ${s}s` : `${h}h : ${m}m : ${s}s`;
  }

  function formatLocalDateTime(ts) {
    try {
      return new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  function toDatetimeLocalValue(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function getSavedPolls() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_SAVED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function savePollRecord(poll) {
    const list = getSavedPolls().filter((item) => item.id !== poll.id);
    list.unshift({
      id: poll.id,
      q: poll.q,
      opts: poll.opts,
      multi: !!poll.multi,
      theme: poll.theme || 'sovereign',
      icon: typeof poll.icon === 'string' ? poll.icon : 'assets/icon-vote.png',
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      shareUrl: poll.shareUrl || buildShareUrl(poll),
    });
    localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(list.slice(0, 40)));
    updateSavedCountBadge();
  }

  function removeSavedPoll(id) {
    const list = getSavedPolls().filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(list));
    updateSavedCountBadge();
    renderSavedPolls();
  }

  function getLocalVoteTallies(pollId, optionCount) {
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_VOTES_KEY) || '{}');
      const arr = map[pollId];
      if (Array.isArray(arr) && arr.length === optionCount) {
        return arr.map((n) => Math.max(0, Number(n) || 0));
      }
    } catch {
      // ignore
    }
    return new Array(optionCount).fill(0);
  }

  function setLocalVoteTallies(pollId, tallies) {
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_VOTES_KEY) || '{}');
      map[pollId] = tallies;
      localStorage.setItem(STORAGE_VOTES_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  function getUserPicks(pollId) {
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_USER_PICKS_KEY) || '{}');
      return Array.isArray(map[pollId]) ? map[pollId] : null;
    } catch {
      return null;
    }
  }

  function setUserPicks(pollId, picks) {
    try {
      const map = JSON.parse(localStorage.getItem(STORAGE_USER_PICKS_KEY) || '{}');
      map[pollId] = picks;
      localStorage.setItem(STORAGE_USER_PICKS_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  }

  function updateSavedCountBadge() {
    el.savedCountBadge.textContent = String(getSavedPolls().length);
  }

  /* ========================================================================
     Backend Probe
     ======================================================================== */

  async function detectBackend() {
    if (window.location.protocol === 'file:' || window.QUICKPOLL_ASSET_DATA) {
      state.serverMode = false;
      el.syncModeText.textContent = 'Link Mode';
      return;
    }
    try {
      const res = await fetch('poll-api.php?action=ping', { cache: 'no-store' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.ok) {
          state.serverMode = true;
          el.syncModeText.textContent = 'Live Sync';
          return;
        }
      }
    } catch {
      // Fallback silently
    }
    state.serverMode = false;
    el.syncModeText.textContent = 'Link Mode';
  }

  /* ========================================================================
     Navigation & Routing
     ======================================================================== */

  function navigateToPage(pageName, updateHash = true) {
    clearInterval(state.countdownTimerId);
    clearInterval(state.pollRefreshTimerId);
    state.currentPage = pageName;

    el.createView.classList.toggle('active', pageName === 'create');
    el.howToView.classList.toggle('active', pageName === 'how-to-use');
    el.qaView.classList.toggle('active', pageName === 'qa');
    el.privacyView.classList.toggle('active', pageName === 'privacy');
    el.pollView.classList.toggle('active', pageName === 'poll');
    el.savedView.classList.toggle('active', pageName === 'saved');

    el.navCreateBtn.classList.toggle('active', pageName === 'create');
    el.navHowToBtn.classList.toggle('active', pageName === 'how-to-use');
    el.navQaBtn.classList.toggle('active', pageName === 'qa');
    el.navPrivacyBtn.classList.toggle('active', pageName === 'privacy');
    el.navSavedBtn.classList.toggle('active', pageName === 'saved');

    if (pageName === 'create') {
      applyTheme(state.builder.theme);
    } else if (pageName === 'saved') {
      renderSavedPolls();
    }

    if (updateHash && pageName !== 'poll') {
      const hashTarget = `#${pageName}`;
      if (window.location.hash !== hashTarget) {
        try {
          window.history.pushState({ page: pageName }, '', `${window.location.pathname}${hashTarget}`);
        } catch {
          window.location.hash = hashTarget;
        }
      }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getBasePageUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function buildShareUrl(poll, useServerId = false) {
    const compact = {
      id: poll.id,
      q: poll.q,
      opts: poll.opts,
      multi: !!poll.multi,
      theme: poll.theme || 'sovereign',
      icon: typeof poll.icon === 'string' ? poll.icon : '',
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
    };
    const encoded = encodeBase64Url(compact);
    if (useServerId) {
      return `${getBasePageUrl()}?p=${encodeURIComponent(poll.id)}`;
    }
    if (window.location.protocol === 'file:') {
      return `${window.location.href.split('#')[0]}#poll=${encoded}`;
    }
    return `${getBasePageUrl()}?poll=${encoded}`;
  }

  function updateBrowserUrlForPoll(url) {
    if (window.location.protocol === 'file:') {
      const hashIdx = url.indexOf('#');
      if (hashIdx !== -1) window.location.hash = url.slice(hashIdx);
      return;
    }
    try {
      window.history.pushState({ pollUrl: url }, '', url);
    } catch {
      // ignore
    }
  }

  /* ========================================================================
     Live Feedback & Builder
     ======================================================================== */

  function updateLiveMeters() {
    const q = state.builder.question.trim();
    const len = q.length;
    el.questionCharCount.textContent = `${len} / 180`;
    el.questionCharCount.classList.toggle('warn', len >= 160);
    el.questionMeterFill.style.width = `${Math.min(100, Math.round((len / 90) * 100))}%`;

    const filledOpts = state.builder.options.map((o) => o.trim()).filter(Boolean);
    const uniqueOpts = new Set(filledOpts.map((o) => o.toLowerCase()));
    if (uniqueOpts.size < filledOpts.length) {
      el.answersFeedback.textContent = 'Duplicate answer detected.';
    } else {
      el.answersFeedback.textContent = '';
    }
  }

  function getBuilderExpiryTimestamp() {
    if (state.builder.expiryMinutes === 'custom') {
      const parsed = Date.parse(state.builder.customExpiryISO);
      if (!Number.isNaN(parsed)) return parsed;
      return Date.now() + 24 * 60 * 60 * 1000;
    }
    return Date.now() + Number(state.builder.expiryMinutes) * 60 * 1000;
  }

  function renderBuilderOptionRows() {
    el.optionsList.innerHTML = '';
    const count = state.builder.options.length;
    el.optionCountStatus.textContent = `${count} / 8`;
    el.addOptionBtn.disabled = count >= 8;

    state.builder.options.forEach((val, idx) => {
      const row = document.createElement('div');
      row.className = 'option-row';
      row.style.animationDelay = `${idx * 30}ms`;

      const badge = document.createElement('span');
      badge.className = 'option-badge stroke-btn';
      badge.textContent = String(idx + 1);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'field-input option-input stroke-body';
      input.maxLength = 90;
      input.placeholder = `Answer ${idx + 1}`;
      input.value = val;
      input.setAttribute('aria-label', `Answer ${idx + 1}`);

      input.addEventListener('input', (e) => {
        state.builder.options[idx] = e.target.value;
        input.classList.remove('is-invalid');
        updateLiveMeters();
        syncLivePreview();
      });

      const optIconSlot = document.createElement('span');
      optIconSlot.className = 'icon-slot icon-slot-option';
      optIconSlot.dataset.iconSlot = `option-${idx + 1}`;
      optIconSlot.title = 'Optional custom icon slot';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'reorder-btn stroke-btn';
      upBtn.textContent = '^';
      upBtn.title = 'Move up';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', () => {
        if (idx === 0) return;
        const temp = state.builder.options[idx - 1];
        state.builder.options[idx - 1] = state.builder.options[idx];
        state.builder.options[idx] = temp;
        renderBuilderOptionRows();
        updateLiveMeters();
        syncLivePreview();
      });

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-option-btn stroke-btn';
      removeBtn.textContent = 'X';
      removeBtn.title = 'Remove';
      removeBtn.disabled = count <= 2;
      removeBtn.addEventListener('click', () => {
        if (state.builder.options.length <= 2) return;
        state.builder.options.splice(idx, 1);
        state.previewVotes.splice(idx, 1);
        state.previewPicks = [];
        renderBuilderOptionRows();
        updateLiveMeters();
        syncLivePreview();
      });

      row.appendChild(badge);
      row.appendChild(input);
      row.appendChild(optIconSlot);
      row.appendChild(upBtn);
      row.appendChild(removeBtn);
      el.optionsList.appendChild(row);
    });
  }

  function updateExpirySummaryUI() {
    const expTs = getBuilderExpiryTimestamp();
    const diff = expTs - Date.now();
    if (diff <= 0) {
      el.expiryLiveSummary.textContent = 'Pick a future date';
      el.previewCountdown.textContent = 'Invalid';
    } else {
      el.expiryLiveSummary.textContent = `Closes ${formatLocalDateTime(expTs)}`;
      el.previewCountdown.textContent = formatDurationShort(diff);
    }
  }

  function syncLivePreview() {
    const qText = state.builder.question.trim() || 'What should we do this weekend?';
    el.previewQuestion.textContent = qText;
    el.previewMeta.textContent = state.builder.multiChoice ? 'Multiple choice' : 'Single choice';

    if (state.builder.icon) {
      el.previewIconSlot.classList.remove('hidden-slot');
      el.previewIconImg.src = resolveIconSrc(state.builder.icon);
    } else {
      el.previewIconSlot.classList.add('hidden-slot');
    }

    updateExpirySummaryUI();

    const displayOptions = state.builder.options.map((opt, idx) =>
      opt.trim() || `Answer ${idx + 1}`
    );

    if (state.previewVotes.length !== displayOptions.length) {
      state.previewVotes = displayOptions.map((_, i) => (i === 0 ? 3 : i === 1 ? 2 : 1));
    }

    const total = state.previewVotes.reduce((sum, v) => sum + v, 0);
    const maxVotes = Math.max(...state.previewVotes, 0);

    el.previewOptionsList.innerHTML = '';
    displayOptions.forEach((optText, idx) => {
      const votes = state.previewVotes[idx] || 0;
      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
      const isPicked = state.previewPicks.includes(idx);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vote-option-btn';
      if (state.builder.multiChoice) btn.classList.add('multi');
      if (isPicked) btn.classList.add('selected');
      if (votes > 0 && votes === maxVotes) btn.classList.add('leading');

      const fill = document.createElement('span');
      fill.className = 'vote-bar-fill';
      fill.style.width = `${pct}%`;

      const inner = document.createElement('span');
      inner.className = 'vote-option-inner';

      const left = document.createElement('span');
      left.className = 'vote-option-left';

      const ring = document.createElement('span');
      ring.className = 'vote-check-ring';

      const label = document.createElement('span');
      label.className = 'vote-option-label stroke-body';
      label.textContent = optText;

      left.appendChild(ring);
      left.appendChild(label);

      const stats = document.createElement('span');
      stats.className = 'vote-option-stats stroke-subtle';
      stats.textContent = `${pct}% (${votes})`;

      inner.appendChild(left);
      inner.appendChild(stats);
      btn.appendChild(fill);
      btn.appendChild(inner);

      btn.addEventListener('click', () => {
        if (state.builder.multiChoice) {
          if (state.previewPicks.includes(idx)) {
            state.previewPicks = state.previewPicks.filter((i) => i !== idx);
          } else {
            state.previewPicks.push(idx);
            state.previewVotes[idx] = (state.previewVotes[idx] || 0) + 1;
          }
        } else {
          state.previewPicks = [idx];
          state.previewVotes[idx] = (state.previewVotes[idx] || 0) + 1;
        }
        triggerJuicyPop(el.livePreviewCard);
        syncLivePreview();
      });

      el.previewOptionsList.appendChild(btn);
    });
  }

  /* ========================================================================
     Poll Generation
     ======================================================================== */

  async function handleGeneratePoll(e) {
    e.preventDefault();

    const question = state.builder.question.trim();
    if (!question) {
      el.questionInput.classList.add('is-invalid');
      el.questionFeedback.textContent = 'Enter a question first.';
      el.questionInput.focus();
      showToast('Enter a question');
      return;
    }

    const cleanedOptions = state.builder.options.map((o) => o.trim()).filter(Boolean);
    if (cleanedOptions.length < 2) {
      const inputs = el.optionsList.querySelectorAll('.option-input');
      inputs.forEach((inp) => {
        if (!inp.value.trim()) inp.classList.add('is-invalid');
      });
      showToast('Add at least 2 answers');
      return;
    }

    const expiresAt = getBuilderExpiryTimestamp();
    if (expiresAt <= Date.now() + 10000) {
      showToast('Pick a future expiration time');
      return;
    }

    const poll = {
      id: generateId(),
      q: question,
      opts: cleanedOptions,
      multi: state.builder.multiChoice,
      theme: state.builder.theme,
      icon: state.builder.icon,
      createdAt: Date.now(),
      expiresAt,
      votes: new Array(cleanedOptions.length).fill(0),
    };

    let shareUrl = buildShareUrl(poll, false);

    if (state.serverMode) {
      try {
        const res = await fetch('poll-api.php?action=create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(poll),
        });
        const data = await res.json();
        if (res.ok && data && data.ok && data.id) {
          poll.id = data.id;
          shareUrl = buildShareUrl(poll, true);
        }
      } catch {
        // Keep URL payload fallback
      }
    }

    poll.shareUrl = shareUrl;
    state.lastGeneratedUrl = shareUrl;
    state.lastGeneratedPollId = poll.id;

    savePollRecord(poll);

    el.generatedUrlInput.value = shareUrl;
    el.shareResultCard.classList.remove('hidden');
    triggerJuicyPop(el.shareResultCard);
    el.shareResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('Poll link generated');
  }

  /* ========================================================================
     Active Poll Page & Voting
     ======================================================================== */

  function openPollObject(poll, updateHistoryUrl = true) {
    state.activePoll = poll;
    const existingPicks = getUserPicks(poll.id);
    state.activeSelectedIndexes = existingPicks ? [...existingPicks] : [];
    state.activeShowResults = Boolean(existingPicks) || Date.now() >= poll.expiresAt;

    applyTheme(poll.theme || 'sovereign');
    navigateToPage('poll', false);

    if (updateHistoryUrl) {
      const targetUrl = poll.shareUrl || buildShareUrl(poll, state.serverMode && !poll._fromUrlPayload);
      updateBrowserUrlForPoll(targetUrl);
    }

    renderActivePoll();

    clearInterval(state.countdownTimerId);
    state.countdownTimerId = setInterval(() => {
      updateActiveCountdown();
    }, 1000);

    if (state.serverMode && !poll._fromUrlPayload) {
      refreshServerPoll(poll.id);
      clearInterval(state.pollRefreshTimerId);
      state.pollRefreshTimerId = setInterval(() => {
        refreshServerPoll(poll.id);
      }, 5000);
    }
  }

  async function refreshServerPoll(pollId) {
    if (!state.activePoll || state.activePoll.id !== pollId) return;
    try {
      const res = await fetch(`poll-api.php?action=get&id=${encodeURIComponent(pollId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.ok && data.poll) {
        state.activePoll.votes = data.poll.votes;
        renderActivePollOptionsOnly();
      }
    } catch {
      // ignore
    }
  }

  function updateActiveCountdown() {
    if (!state.activePoll) return;
    const remaining = state.activePoll.expiresAt - Date.now();
    const expired = remaining <= 0;

    el.activeCountdownText.textContent = expired ? '00h : 00m : 00s' : formatCountdownClock(remaining);
    el.activePollStatusPill.classList.toggle('expired', expired);
    el.activePollStatusLabel.textContent = expired ? 'EXPIRED' : 'LIVE POLL';

    if (expired && !state.activeShowResults) {
      state.activeShowResults = true;
      renderActivePoll();
    }
  }

  function getActiveTallies() {
    const poll = state.activePoll;
    if (!poll) return [];
    if (state.serverMode && Array.isArray(poll.votes) && poll.votes.length === poll.opts.length) {
      return poll.votes;
    }
    return getLocalVoteTallies(poll.id, poll.opts.length);
  }

  function renderActivePoll() {
    const poll = state.activePoll;
    if (!poll) return;

    const expired = Date.now() >= poll.expiresAt;
    const hasVoted = Boolean(getUserPicks(poll.id));

    if (poll.icon) {
      el.activePollIconSlot.classList.remove('hidden-slot');
      el.activePollIconImg.src = resolveIconSrc(poll.icon);
    } else {
      el.activePollIconSlot.classList.add('hidden-slot');
    }

    el.activePollQuestion.textContent = poll.q;
    el.activePollSubtitle.textContent = `${poll.multi ? 'Multiple choice' : 'Single choice'} · ${
      expired ? 'Voting closed' : hasVoted ? 'Vote recorded' : 'Choose an option'
    }`;
    el.activeExpiryDateText.textContent = `${expired ? 'Closed' : 'Expires'} ${formatLocalDateTime(poll.expiresAt)}`;

    updateActiveCountdown();
    renderActivePollOptionsOnly();

    el.castVoteBtn.classList.toggle('hidden', expired || hasVoted);
    el.toggleResultsViewBtn.classList.toggle('hidden', expired || hasVoted);
    el.toggleResultsViewBtn.textContent = state.activeShowResults ? 'Hide Results' : 'View Results';
  }

  function renderActivePollOptionsOnly() {
    const poll = state.activePoll;
    if (!poll) return;

    const expired = Date.now() >= poll.expiresAt;
    const hasVoted = Boolean(getUserPicks(poll.id));
    const showResults = state.activeShowResults || expired || hasVoted;
    const tallies = getActiveTallies();
    const totalVotes = tallies.reduce((sum, n) => sum + n, 0);
    const maxVotes = Math.max(...tallies, 0);

    el.activeTotalVotes.textContent = `${totalVotes} ${totalVotes === 1 ? 'Vote' : 'Votes'}`;
    el.activeOptionsContainer.innerHTML = '';

    poll.opts.forEach((optText, idx) => {
      const count = tallies[idx] || 0;
      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
      const isSelected = state.activeSelectedIndexes.includes(idx);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vote-option-btn';
      if (poll.multi) btn.classList.add('multi');
      if (isSelected) btn.classList.add('selected');
      if (showResults && count > 0 && count === maxVotes) btn.classList.add('leading');
      btn.disabled = expired || hasVoted;

      const fill = document.createElement('span');
      fill.className = 'vote-bar-fill';
      fill.style.width = showResults ? `${pct}%` : '0%';

      const inner = document.createElement('span');
      inner.className = 'vote-option-inner';

      const left = document.createElement('span');
      left.className = 'vote-option-left';

      const ring = document.createElement('span');
      ring.className = 'vote-check-ring';

      const label = document.createElement('span');
      label.className = 'vote-option-label stroke-body';
      label.textContent = optText;

      left.appendChild(ring);
      left.appendChild(label);

      const stats = document.createElement('span');
      stats.className = 'vote-option-stats stroke-subtle';
      stats.textContent = showResults ? `${pct}% (${count})` : '';

      inner.appendChild(left);
      inner.appendChild(stats);
      btn.appendChild(fill);
      btn.appendChild(inner);

      if (!expired && !hasVoted) {
        btn.addEventListener('click', () => {
          if (poll.multi) {
            if (state.activeSelectedIndexes.includes(idx)) {
              state.activeSelectedIndexes = state.activeSelectedIndexes.filter((i) => i !== idx);
            } else {
              state.activeSelectedIndexes.push(idx);
            }
          } else {
            state.activeSelectedIndexes = [idx];
          }
          renderActivePollOptionsOnly();
        });
      }

      el.activeOptionsContainer.appendChild(btn);
    });
  }

  async function handleCastVote() {
    const poll = state.activePoll;
    if (!poll) return;

    if (Date.now() >= poll.expiresAt) {
      showToast('Poll expired');
      renderActivePoll();
      return;
    }

    if (state.activeSelectedIndexes.length === 0) {
      showToast('Select an option first');
      return;
    }

    if (getUserPicks(poll.id)) {
      showToast('Already voted');
      return;
    }

    const tallies = [...getActiveTallies()];
    state.activeSelectedIndexes.forEach((idx) => {
      if (idx >= 0 && idx < tallies.length) tallies[idx] += 1;
    });

    if (state.serverMode && !poll._fromUrlPayload) {
      try {
        const res = await fetch('poll-api.php?action=vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: poll.id, choices: state.activeSelectedIndexes }),
        });
        const data = await res.json();
        if (res.ok && data && data.ok && data.poll) {
          poll.votes = data.poll.votes;
        }
      } catch {
        // fallback locally
      }
    } else {
      setLocalVoteTallies(poll.id, tallies);
      poll.votes = tallies;
    }

    setUserPicks(poll.id, state.activeSelectedIndexes);
    state.activeShowResults = true;
    renderActivePoll();
    triggerJuicyPop(el.activeOptionsContainer);
    showToast('Vote submitted');
  }

  /* ========================================================================
     Saved Polls
     ======================================================================== */

  function renderSavedPolls() {
    const polls = getSavedPolls();
    el.savedPollsGrid.innerHTML = '';

    if (polls.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-saved-state';
      const title = document.createElement('p');
      title.className = 'card-title stroke-heading';
      title.textContent = 'No Polls Yet';
      empty.appendChild(title);
      el.savedPollsGrid.appendChild(empty);
      return;
    }

    polls.forEach((poll) => {
      const card = document.createElement('div');
      card.className = 'saved-poll-item';

      const top = document.createElement('div');
      top.className = 'saved-item-top';

      const remaining = poll.expiresAt - Date.now();
      const badge = document.createElement('span');
      badge.className = `live-badge stroke-subtle${remaining <= 0 ? ' expired' : ''}`;
      badge.textContent = remaining <= 0 ? 'EXPIRED' : formatDurationShort(remaining);

      const optsCount = document.createElement('span');
      optsCount.className = 'stroke-subtle';
      optsCount.textContent = `${poll.opts.length} options`;

      top.appendChild(badge);
      top.appendChild(optsCount);

      const q = document.createElement('h3');
      q.className = 'saved-item-question stroke-heading';
      q.textContent = poll.q;

      const meta = document.createElement('p');
      meta.className = 'saved-item-meta stroke-body';
      meta.textContent = `${remaining <= 0 ? 'Closed' : 'Expires'} ${formatLocalDateTime(poll.expiresAt)}`;

      const actions = document.createElement('div');
      actions.className = 'saved-item-actions';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn-primary-gradient stroke-btn';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => openPollObject(poll, true));

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-gold stroke-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyTextToClipboard(poll.shareUrl || buildShareUrl(poll)));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-dark stroke-btn';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        removeSavedPoll(poll.id);
        showToast('Poll deleted');
      });

      actions.appendChild(openBtn);
      actions.appendChild(copyBtn);
      actions.appendChild(delBtn);

      card.appendChild(top);
      card.appendChild(q);
      card.appendChild(meta);
      card.appendChild(actions);
      el.savedPollsGrid.appendChild(card);
    });
  }

  /* ========================================================================
     Clipboard & URL Routing
     ======================================================================== */

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Link copied');
    } catch {
      const temp = document.createElement('textarea');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      showToast('Link copied');
    }
  }

  async function loadRouteFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const serverPollId = params.get('p');
    const urlPayload = params.get('poll') || (window.location.hash.startsWith('#poll=') ? window.location.hash.slice(6) : '');

    if (serverPollId && state.serverMode) {
      try {
        const res = await fetch(`poll-api.php?action=get&id=${encodeURIComponent(serverPollId)}`, {
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok && data.poll) {
            openPollObject(data.poll, false);
            return true;
          }
        }
      } catch {
        // fall through
      }
    }

    if (urlPayload) {
      const decoded = decodeBase64Url(urlPayload);
      if (decoded && decoded.q && Array.isArray(decoded.opts) && decoded.opts.length >= 2) {
        decoded._fromUrlPayload = true;
        openPollObject(decoded, false);
        return true;
      }
    }

    const hashPage = window.location.hash.replace('#', '');
    if (['create', 'how-to-use', 'qa', 'privacy', 'saved'].includes(hashPage)) {
      navigateToPage(hashPage, false);
      return true;
    }

    return false;
  }

  /* ========================================================================
     Events & Init
     ======================================================================== */

  function bindEvents() {
    el.brandHomeLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToPage('create');
    });

    el.navCreateBtn.addEventListener('click', () => navigateToPage('create'));
    el.navHowToBtn.addEventListener('click', () => navigateToPage('how-to-use'));
    el.navQaBtn.addEventListener('click', () => navigateToPage('qa'));
    el.navPrivacyBtn.addEventListener('click', () => navigateToPage('privacy'));
    el.navSavedBtn.addEventListener('click', () => navigateToPage('saved'));
    el.savedBackBtn.addEventListener('click', () => navigateToPage('create'));
    el.backToBuilderBtn.addEventListener('click', () => navigateToPage('create'));

    el.jumpCreateBtns.forEach((btn) => {
      btn.addEventListener('click', () => navigateToPage('create'));
    });

    el.footerNavLinks.forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page || 'create';
        navigateToPage(page);
      });
    });

    el.faqTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-item');
        if (!item) return;
        const isOpen = item.classList.toggle('open');
        trigger.setAttribute('aria-expanded', String(isOpen));
      });
    });

    el.questionInput.addEventListener('input', (e) => {
      state.builder.question = e.target.value;
      el.questionInput.classList.remove('is-invalid');
      el.questionFeedback.textContent = '';
      updateLiveMeters();
      syncLivePreview();
    });

    el.addOptionBtn.addEventListener('click', () => {
      if (state.builder.options.length >= 8) return;
      state.builder.options.push('');
      state.previewVotes.push(1);
      renderBuilderOptionRows();
      updateLiveMeters();
      syncLivePreview();
      const inputs = el.optionsList.querySelectorAll('.option-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    el.multiChoiceToggle.addEventListener('change', (e) => {
      state.builder.multiChoice = e.target.checked;
      state.previewPicks = [];
      triggerJuicyPop(el.livePreviewCard);
      syncLivePreview();
    });

    el.presetPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.presetPills.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.minutes;
        state.builder.expiryMinutes = val;
        if (val === 'custom') {
          el.customDateWrap.classList.remove('hidden');
          if (!el.customExpiryInput.value) {
            const def = toDatetimeLocalValue(Date.now() + 24 * 60 * 60 * 1000);
            el.customExpiryInput.value = def;
            state.builder.customExpiryISO = def;
          }
        } else {
          el.customDateWrap.classList.add('hidden');
        }
        triggerJuicyPop(el.previewCountdown);
        updateExpirySummaryUI();
      });
    });

    el.customExpiryInput.addEventListener('input', (e) => {
      state.builder.customExpiryISO = e.target.value;
      updateExpirySummaryUI();
    });

    el.swatchBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.swatchBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.builder.theme = btn.dataset.theme;
        applyTheme(state.builder.theme);
        triggerJuicyPop(el.livePreviewCard);
      });
    });

    el.iconPickBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.iconPickBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.builder.icon = btn.dataset.icon || '';
        triggerJuicyPop(el.previewIconSlot);
        syncLivePreview();
      });
    });

    el.resetPreviewVotesBtn.addEventListener('click', () => {
      state.previewVotes = state.builder.options.map(() => 0);
      state.previewPicks = [];
      triggerJuicyPop(el.livePreviewCard);
      syncLivePreview();
    });

    el.pollForm.addEventListener('submit', handleGeneratePoll);

    el.copyLinkBtn.addEventListener('click', () => {
      if (el.generatedUrlInput.value) copyTextToClipboard(el.generatedUrlInput.value);
    });

    el.openPollPageBtn.addEventListener('click', () => {
      const saved = getSavedPolls().find((p) => p.id === state.lastGeneratedPollId);
      if (saved) openPollObject(saved, true);
    });

    el.nativeShareBtn.addEventListener('click', async () => {
      const url = el.generatedUrlInput.value;
      if (!url) return;
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Vote on QuickPoll',
            text: state.builder.question.trim() || 'Vote on this poll',
            url,
          });
          return;
        } catch {
          // fallback
        }
      }
      copyTextToClipboard(url);
    });

    el.castVoteBtn.addEventListener('click', handleCastVote);

    el.toggleResultsViewBtn.addEventListener('click', () => {
      state.activeShowResults = !state.activeShowResults;
      renderActivePoll();
    });

    el.activeCopyLinkBtn.addEventListener('click', () => {
      if (!state.activePoll) return;
      const url = state.activePoll.shareUrl || window.location.href;
      copyTextToClipboard(url);
    });

    window.addEventListener('popstate', async () => {
      const loaded = await loadRouteFromUrl();
      if (!loaded) navigateToPage('create', false);
    });

    window.addEventListener('hashchange', async () => {
      const loaded = await loadRouteFromUrl();
      if (!loaded) navigateToPage('create', false);
    });
  }

  async function init() {
    el.customExpiryInput.min = toDatetimeLocalValue(Date.now() + 60 * 1000);
    updateSavedCountBadge();
    renderBuilderOptionRows();
    updateLiveMeters();
    syncLivePreview();
    bindEvents();

    await detectBackend();
    const routed = await loadRouteFromUrl();
    if (!routed) {
      navigateToPage('create', false);
    }
  }

  init();
})();
