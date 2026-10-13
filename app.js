// ============================================================
// FANTA-ACCADEMIA 2026 - APPLICATION CONTROLLER & LOGIC
// ============================================================

class FantaApp {
  constructor() {
    this.initStorage();
    this.currentUser = this.getActiveUser();
    this.currentTab = 'home';
    this.soundEnabled = localStorage.getItem('fanta_sound') !== 'false';
    this.audioCtx = null;
    
    // Temporary builder state
    this.selectedDocenti = [];
    this.selectedCollega = null;

    // Master live scoring state
    this.scoringSelectedCharId = 'door-e';

    this.initAudio();
    this.initDOM();
    this.startCountdown();
    this.render();

    // Se l'utente non è autenticato e il gatekeeper è sbloccato, chiedi subito il login
    if (this.checkGatekeeper() && !this.currentUser) {
      this.openModal('loginModal');
    }
  }

  // --- AUDIO SYNTHESIS ---
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn("AudioContext not supported", e);
    }
  }

  playSound(type) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'coin') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc.start(now);
      osc.stop(now + 0.55);
    } else if (type === 'glitch') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.setValueAtTime(800, now + 0.04);
      osc.frequency.setValueAtTime(150, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  // --- STORAGE & CLEAN INITIALIZATION ---
  // Keys synced via Firebase (shared across all devices)
  // Keys kept local: fanta_users, fanta_gatekeeper_unlocked, fanta_active_user, fanta_sound, fanta_initialized_v4
  get FIREBASE_KEYS() {
    return ['fanta_teams', 'fanta_notices', 'fanta_reports', 'fanta_tips'];
  }

  initStorage() {
    // v4: migrazione a Firebase per le chiavi condivise
    if (localStorage.getItem('fanta_initialized_v4') !== 'true') {
      // Pulisce dati locali vecchi
      ['fanta_initialized_v3', 'fanta_teams', 'fanta_notices', 'fanta_reports', 'fanta_tips'].forEach(k => localStorage.removeItem(k));
      // Scrivi dati iniziali su Firebase (solo se non esistono già)
      this.firebaseInitIfEmpty('fanta_teams', INITIAL_TEAMS);
      this.firebaseInitIfEmpty('fanta_notices', INITIAL_NOTICES);
      this.firebaseInitIfEmpty('fanta_reports', INITIAL_REPORTS);
      this.firebaseInitIfEmpty('fanta_tips', MASTER_TIPS);
      localStorage.setItem('fanta_initialized_v4', 'true');
    }
    // Sempre: resetta utenti locali (le credenziali non vanno su Firebase)
    localStorage.setItem('fanta_users', JSON.stringify(INITIAL_USERS));
    // Avvia i listener in tempo reale di Firebase
    this.startFirebaseListeners();
  }

  firebaseInitIfEmpty(key, defaultVal) {
    if (!window.fantaDB) return;
    window.fantaDB.ref(key).once('value').then(snap => {
      if (!snap.exists()) {
        window.fantaDB.ref(key).set(defaultVal);
      }
    }).catch(e => console.warn('Firebase init error for', key, e));
  }

  startFirebaseListeners() {
    if (!window.fantaDB) return;
    // Ascolta cambiamenti in tempo reale e aggiorna la UI
    this.FIREBASE_KEYS.forEach(key => {
      window.fantaDB.ref(key).on('value', snap => {
        const val = snap.val();
        if (val !== null) {
          // Cache locale per accesso sincrono
          localStorage.setItem('_fb_cache_' + key, JSON.stringify(val));
          // Aggiorna UI se l'app è già inizializzata
          if (this._appReady) {
            this.render();
          }
        }
      }, e => console.warn('Firebase listener error', key, e));
    });
  }

  getData(key) {
    try {
      if (this.FIREBASE_KEYS.includes(key)) {
        // Legge dalla cache locale aggiornata dai listener Firebase
        const cached = localStorage.getItem('_fb_cache_' + key);
        if (cached) return JSON.parse(cached);
        // Fallback ai dati iniziali se la cache non è ancora pronta
        const defaults = { fanta_teams: INITIAL_TEAMS, fanta_notices: INITIAL_NOTICES, fanta_reports: INITIAL_REPORTS, fanta_tips: MASTER_TIPS };
        return defaults[key] || null;
      }
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  }

  saveData(key, val) {
    if (this.FIREBASE_KEYS.includes(key) && window.fantaDB) {
      // Scrivi su Firebase (il listener aggiornerà automaticamente la cache locale e la UI)
      window.fantaDB.ref(key).set(val).catch(e => console.warn('Firebase write error', key, e));
      // Aggiorna anche la cache locale immediatamente per risposta UI istantanea
      localStorage.setItem('_fb_cache_' + key, JSON.stringify(val));
    } else {
      localStorage.setItem(key, JSON.stringify(val));
    }
  }

  getActiveUser() {
    const saved = localStorage.getItem('fanta_active_user');
    const users = this.getData('fanta_users') || INITIAL_USERS;
    if (saved) {
      const found = users.find(u => u.username === saved);
      if (found) return found;
    }
    return null;
  }

  setActiveUser(username) {
    localStorage.setItem('fanta_active_user', username);
    this.currentUser = this.getActiveUser();
    this.loadUserBuilderState();
    this.render();
    this.showToast(`Accesso effettuato come ${this.currentUser.username} (${this.currentUser.role === 'master' ? '👑 Master' : 'Allenatore'})`, 'info');
  }

  logout() {
    localStorage.removeItem('fanta_active_user');
    this.currentUser = null;
    this.render();
    this.playSound('click');
    this.showToast("Disconnessione effettuata. Inserisci le credenziali per rientrare.", "info");
    this.openModal('loginModal');
  }

  isUserTeamConfirmed() {
    if (!this.currentUser) return false;
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser.username];
    return !!(myTeam && myTeam.confirmed);
  }

  // --- GATEKEEPER PASS ---
  checkGatekeeper() {
    return localStorage.getItem('fanta_gatekeeper_unlocked') === 'true';
  }

  unlockGatekeeper(pwd) {
    if (pwd === GLOBAL_PASSWORD) {
      localStorage.setItem('fanta_gatekeeper_unlocked', 'true');
      const overlay = document.getElementById('gatekeeperOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
      this.playSound('success');
      this.showToast("🔓 Accesso Accademico autorizzato!", "success");

      if (!this.currentUser) {
        setTimeout(() => this.openModal('loginModal'), 400);
      }
      return true;
    }
    return false;
  }

  lockGatekeeper() {
    localStorage.removeItem('fanta_gatekeeper_unlocked');
    const overlay = document.getElementById('gatekeeperOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    this.showToast("🔒 Portale bloccato con successo.", "info");
  }

  // --- COUNTDOWN LOGIC ---
  startCountdown() {
    const target = new Date(SQUAD_DEADLINE).getTime();
    const update = () => {
      const now = new Date().getTime();
      const diff = target - now;

      const daysEl = document.getElementById('countDays');
      const hoursEl = document.getElementById('countHours');
      const minsEl = document.getElementById('countMins');
      const secsEl = document.getElementById('countSecs');

      if (!daysEl || !hoursEl || !minsEl || !secsEl) return;

      if (diff <= 0) {
        daysEl.innerText = "00";
        hoursEl.innerText = "00";
        minsEl.innerText = "00";
        secsEl.innerText = "00";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60)) / 1000);
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      daysEl.innerText = String(days).padStart(2, '0');
      hoursEl.innerText = String(hours).padStart(2, '0');
      minsEl.innerText = String(mins).padStart(2, '0');
      secsEl.innerText = String(secs).padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
  }

  // --- INITIALIZE DOM & EVENTS ---
  initDOM() {
    const gateInput = document.getElementById('gatekeeperPassword');
    const gateBtn = document.getElementById('gatekeeperSubmit');
    const gateOverlay = document.getElementById('gatekeeperOverlay');

    if (this.checkGatekeeper() && gateOverlay) {
      gateOverlay.classList.add('hidden');
    }

    if (gateBtn && gateInput) {
      gateBtn.addEventListener('click', () => {
        const val = gateInput.value.trim();
        if (this.unlockGatekeeper(val)) {
          gateInput.value = '';
        } else {
          this.playSound('glitch');
          this.showToast("❌ Parola d'ordine errata! Riprova.", "danger");
          gateInput.focus();
        }
      });

      gateInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          gateBtn.click();
        }
      });
    }

    const toggleGatePwd = document.getElementById('toggleGatePwd');
    if (toggleGatePwd && gateInput) {
      toggleGatePwd.addEventListener('click', () => {
        gateInput.type = gateInput.type === 'password' ? 'text' : 'password';
        toggleGatePwd.innerText = gateInput.type === 'password' ? '👁️' : '🔒';
      });
    }

    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem('fanta_sound', this.soundEnabled ? 'true' : 'false');
        soundBtn.innerText = this.soundEnabled ? '🔊' : '🔇';
        this.showToast(`Audio ${this.soundEnabled ? 'Attivato' : 'Disattivato'}`, 'info');
      });
    }

    document.querySelectorAll('.modal-close-btn, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.currentUser && document.getElementById('loginModal')?.classList.contains('active')) {
          this.showToast("⚠️ Devi accedere con un profilo per continuare!", "danger");
          return;
        }
        this.closeAllModals();
      });
    });

    const userBadgeBtn = document.getElementById('userBadgeBtn');
    if (userBadgeBtn) {
      userBadgeBtn.addEventListener('click', () => {
        this.openModal('loginModal');
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.logout();
      });
    }

    this.setupLoginForm();
    this.setupReportForm();
    this.setupNoticeForm();
    this.setupTipForm();
    this.setupManualPointsForm();

    this.loadUserBuilderState();
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }

  openModal(modalId) {
    this.closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  switchTab(tabName) {
    if (!this.currentUser) {
      this.openModal('loginModal');
      return;
    }

    if (tabName === 'master' && this.currentUser.role !== 'master') {
      this.playSound('glitch');
      this.showToast("⛔ Accesso Negato! Il Pannello Master è riservato a Martina.", "danger");
      return;
    }

    const isMaster = this.currentUser.role === 'master';
    const isConfirmed = this.isUserTeamConfirmed();

    if (!isConfirmed && !isMaster) {
      if (tabName === 'classifica' || tabName === 'social') {
        this.playSound('glitch');
        this.showToast("🔒 Sezione Bloccata! Devi prima confermare la tua Squadra per accedere.", "danger");
        this.switchTab('squadra');
        return;
      }
      if (tabName === 'secret') {
        this.playSound('glitch');
        this.showToast("🔒 Le Secret Rules sono sbloccate solo dopo aver confermato la tua Squadra!", "danger");
        this.switchTab('squadra');
        return;
      }
      if (tabName === 'soffiate') {
        this.playSound('glitch');
        this.showToast("🔒 Sezione protetta dal Master!", "danger");
        this.switchTab('squadra');
        return;
      }
    }

    this.currentTab = tabName;
    this.playSound('click');

    document.querySelectorAll('[data-tab]').forEach(el => {
      if (el.getAttribute('data-tab') === tabName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.tab-section').forEach(sec => {
      if (sec.id === `tab-${tabName}`) {
        sec.classList.add('active');
      } else {
        sec.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.render();
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `fanta-toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '⚠️';
    if (type === 'bonus') icon = '🌟';

    toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // --- RENDER MAIN UI ---
  render() {
    this.renderHeader();
    this.renderHome();
    this.renderBuilder();
    this.renderCatalog();
    this.renderSecretRules();
    this.renderMasterTips();
    this.renderLeaderboard();
    this.renderSocialFeed();
    this.renderMasterDashboard();
    this._appReady = true; // segnala ai listener Firebase che l'app è pronta
  }

  renderHeader() {
    const nameEl = document.getElementById('headerUserName');
    const roleEl = document.getElementById('headerUserRole');
    const avatarEl = document.getElementById('headerUserAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!this.currentUser) {
      if (nameEl) nameEl.innerText = "Accedi";
      if (avatarEl) avatarEl.innerText = "👤";
      if (roleEl) {
        roleEl.innerText = "Non Connesso";
        roleEl.className = "user-badge-role";
      }
      if (logoutBtn) logoutBtn.style.display = 'none';
      return;
    }

    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (nameEl) nameEl.innerText = this.currentUser.username;
    if (avatarEl) avatarEl.innerText = this.currentUser.avatar;
    if (roleEl) {
      if (this.currentUser.role === 'master') {
        roleEl.innerText = "👑 Master / Admin";
        roleEl.className = "user-badge-role role-master";
      } else {
        roleEl.innerText = "Allenatore";
        roleEl.className = "user-badge-role role-coach";
      }
    }

    const masterNavItems = document.querySelectorAll('.nav-master-only');
    masterNavItems.forEach(el => {
      el.style.display = (this.currentUser.role === 'master') ? 'flex' : 'none';
    });

    const isConfirmed = this.isUserTeamConfirmed();
    const isMaster = this.currentUser.role === 'master';
    const isUnlocked = isConfirmed || isMaster;

    document.querySelectorAll('[data-tab="classifica"], [data-tab="social"], [data-tab="secret"]').forEach(tab => {
      if (!isUnlocked) {
        tab.classList.add('locked-nav');
        if (!tab.querySelector('.nav-lock-icon')) {
          const lockSpan = document.createElement('span');
          lockSpan.className = 'nav-lock-icon';
          lockSpan.innerText = ' 🔒';
          tab.appendChild(lockSpan);
        }
      } else {
        tab.classList.remove('locked-nav');
        tab.querySelector('.nav-lock-icon')?.remove();
      }
    });
  }

  // --- SECTION: HOME ---
  renderHome() {
    const notices = this.getData('fanta_notices') || [];
    const container = document.getElementById('homeNoticesList');
    if (!container) return;

    container.innerHTML = notices.map(n => `
      <div class="notice-card annuncio">
        <div class="notice-top">
          <span class="notice-badge">${n.icona || '📢'} ${n.tipo}</span>
          <span class="notice-date">${n.data}</span>
        </div>
        <h4 class="notice-title">${n.titolo}</h4>
        <p class="notice-body">${n.testo}</p>
      </div>
    `).join('');

    const lockedHomeArea = document.getElementById('homeLockedCallout');
    const isConfirmed = this.isUserTeamConfirmed();
    const isMaster = this.currentUser && this.currentUser.role === 'master';

    if (lockedHomeArea) {
      if (!isConfirmed && !isMaster) {
        lockedHomeArea.style.display = 'block';
        lockedHomeArea.innerHTML = `
          <div class="locked-home-card">
            <div class="lock-icon-big">🔒</div>
            <h3>Classifica Live e Bacheca Social Bloccate</h3>
            <p>
              Per accedere alla <strong>Classifica Live</strong>, alla <strong>Bacheca Social</strong> e alle <strong>Secret Rules</strong>, devi prima comporre e confermare la tua Squadra ufficiale di 4 Docenti e 1 Collega (budget 100 CFA).
            </p>
            <button class="btn-confirm-squad" style="width: auto; margin: 0 auto; padding: 10px 24px;" onclick="app.switchTab('squadra')">
              ⚽ Vai a Comporre la Tua Squadra
            </button>
          </div>
        `;
      } else {
        lockedHomeArea.style.display = 'none';
      }
    }

    const teams = this.getData('fanta_teams') || {};
    const confirmedCount = Object.values(teams).filter(t => t.confirmed).length;
    const reports = this.getData('fanta_reports') || [];
    const approvedReports = reports.filter(r => r.stato === 'approvata').length;

    const statTeamsEl = document.getElementById('statConfirmedTeams');
    const statApprovedEl = document.getElementById('statApprovedEvents');
    if (statTeamsEl) statTeamsEl.innerText = `${confirmedCount} / 12`;
    if (statApprovedEl) statApprovedEl.innerText = approvedReports;
  }

  // --- SECTION: BUILDER & SQUADRA MERCATO ---
  loadUserBuilderState() {
    if (!this.currentUser) return;
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser.username];
    if (myTeam && myTeam.confirmed) {
      this.selectedDocenti = [...(myTeam.docenti || [])];
      this.selectedCollega = myTeam.collega || null;
    } else {
      this.selectedDocenti = [];
      this.selectedCollega = null;
    }
  }

  calculateCFA() {
    let spent = 0;
    this.selectedDocenti.forEach(id => {
      const doc = DOCENTI.find(d => d.id === id);
      if (doc) spent += doc.costoCFA;
    });
    if (this.selectedCollega) {
      const col = COLLEGHI.find(c => c.id === this.selectedCollega);
      if (col) spent += col.costoCFA;
    }
    return {
      spent,
      remaining: 100 - spent,
      isValidBudget: spent <= 100
    };
  }

  renderBuilder() {
    if (!this.currentUser) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const { spent, remaining, isValidBudget } = this.calculateCFA();

    const sealedBanner = document.getElementById('teamSealedBanner');
    if (sealedBanner) {
      sealedBanner.style.display = isConfirmed ? 'flex' : 'none';
    }

    const spentEl = document.getElementById('builderCfaSpent');
    const remEl = document.getElementById('builderCfaRemaining');
    if (spentEl) spentEl.innerText = spent;
    if (remEl) {
      remEl.innerText = remaining;
      remEl.style.color = remaining < 0 ? '#ef4444' : '#fbbf24';
    }

    const slotsWrap = document.getElementById('builderSlots');
    if (!slotsWrap) return;

    let html = '';
    for (let i = 0; i < 4; i++) {
      const docId = this.selectedDocenti[i];
      if (docId) {
        const doc = DOCENTI.find(d => d.id === docId);
        html += `
          <div class="slot-card filled">
            ${!isConfirmed ? `
              <button class="slot-remove-btn" onclick="app.removeDocente('${doc.id}')" title="Rimuovi">✕</button>
            ` : ''}
            <div class="slot-avatar">${doc.avatar}</div>
            <div class="slot-name">${doc.nome}</div>
            <div class="slot-cost">${doc.costoCFA} CFA</div>
            <div class="slot-type-label">Docente #${i + 1}</div>
          </div>
        `;
      } else {
        html += `
          <div class="slot-card">
            <div class="slot-avatar" style="opacity: 0.35;">👤</div>
            <div class="slot-name" style="color: var(--text-dark);">Docente Vuoto</div>
            <div class="slot-type-label">Slot Docente #${i + 1}</div>
          </div>
        `;
      }
    }

    if (this.selectedCollega) {
      const col = COLLEGHI.find(c => c.id === this.selectedCollega);
      html += `
        <div class="slot-card collega-slot filled">
          ${!isConfirmed ? `
            <button class="slot-remove-btn" onclick="app.removeCollega()" title="Rimuovi">✕</button>
          ` : ''}
          <div class="slot-avatar">${col.avatar}</div>
          <div class="slot-name">${col.nome}</div>
          <div class="slot-cost">${col.costoCFA} CFA</div>
          <div class="slot-type-label" style="color: #fbbf24;">Collega</div>
        </div>
      `;
    } else {
      html += `
        <div class="slot-card collega-slot">
          <div class="slot-avatar" style="opacity: 0.35;">🤝</div>
          <div class="slot-name" style="color: var(--text-dark);">Nessun Collega</div>
          <div class="slot-type-label" style="color: #fbbf24;">Slot Collega (1 Obbligatorio)</div>
        </div>
      `;
    }

    slotsWrap.innerHTML = html;

    const confirmBtn = document.getElementById('btnConfirmSquad');
    const isComplete = this.selectedDocenti.length === 4 && this.selectedCollega !== null;
    const canConfirm = isComplete && isValidBudget;

    if (confirmBtn) {
      if (isConfirmed) {
        confirmBtn.disabled = true;
        confirmBtn.style.background = 'rgba(16, 185, 129, 0.2)';
        confirmBtn.style.borderColor = 'rgba(16, 185, 129, 0.5)';
        confirmBtn.style.color = '#6ee7b7';
        confirmBtn.innerHTML = `🔒 Squadra Confermata e Bloccata Definitivamente (${spent} CFA)`;
      } else {
        confirmBtn.disabled = !canConfirm;
        confirmBtn.style.background = '';
        confirmBtn.style.borderColor = '';
        confirmBtn.style.color = '';
        if (!isComplete) {
          confirmBtn.innerHTML = `⚠️ Seleziona 4 Docenti e 1 Collega (${this.selectedDocenti.length}/4 Docenti, ${this.selectedCollega ? '1/1' : '0/1'} Collega)`;
        } else if (!isValidBudget) {
          confirmBtn.innerHTML = `⛔ Budget superato! Rimuovi ${Math.abs(remaining)} CFA per confermare`;
        } else {
          confirmBtn.innerHTML = `✨ Conferma e Blocca Definitivamente la Squadra (${spent} CFA)`;
        }
      }
    }

    this.renderDocentiMarket();
    this.renderColleghiMarket();
  }

  renderDocentiMarket() {
    const container = document.getElementById('docentiMarketList');
    if (!container) return;

    const isConfirmed = this.isUserTeamConfirmed();

    container.innerHTML = DOCENTI.map(doc => {
      const isSelected = this.selectedDocenti.includes(doc.id);
      return `
        <div class="character-card ${isSelected ? 'in-squad' : ''}">
          <div class="char-top">
            <div class="char-avatar-box">${doc.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${doc.costoCFA} CFA</span>
              <span class="tier-label">${doc.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${doc.nome}</h4>
          <p class="char-bio">${doc.bio}</p>
          <div class="char-actions">
            ${isConfirmed ? `
              <button class="btn-recruit" disabled style="opacity: 0.6;">
                ${isSelected ? '✓ In Squadra' : 'Non schierato'}
              </button>
            ` : isSelected ? `
              <button class="btn-recruit selected" onclick="app.removeDocente('${doc.id}')">
                ✓ In Squadra (Rimuovi)
              </button>
            ` : `
              <button class="btn-recruit" onclick="app.addDocente('${doc.id}')" ${this.selectedDocenti.length >= 4 ? 'disabled title="Hai già 4 docenti"' : ''}>
                + Schiera Docente
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  renderColleghiMarket() {
    const container = document.getElementById('colleghiMarketList');
    if (!container) return;

    const currentUserNameLower = (this.currentUser?.username || '').toLowerCase();
    const isConfirmed = this.isUserTeamConfirmed();

    container.innerHTML = COLLEGHI.map(col => {
      const isSelected = this.selectedCollega === col.id;
      const isSelf = col.nome.toLowerCase() === currentUserNameLower;

      return `
        <div class="character-card ${isSelected ? 'in-squad' : ''} ${isSelf ? 'self-excluded' : ''}">
          <div class="char-top">
            <div class="char-avatar-box">${col.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${col.costoCFA} CFA</span>
              <span class="tier-label">${col.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${col.nome} ${isSelf ? '<span style="font-size: 0.75rem; color: #ef4444;">(Sei tu!)</span>' : ''}</h4>

          <div class="char-actions">
            ${isSelf ? `
              <button class="btn-recruit" disabled style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
                🚫 Auto-Escluso (Regola)
              </button>
            ` : isConfirmed ? `
              <button class="btn-recruit" disabled style="opacity: 0.6;">
                ${isSelected ? '✓ In Squadra' : 'Non schierato'}
              </button>
            ` : isSelected ? `
              <button class="btn-recruit selected" onclick="app.removeCollega()">
                ✓ In Squadra (Rimuovi)
              </button>
            ` : `
              <button class="btn-recruit" onclick="app.setCollega('${col.id}')">
                + Schiera Collega
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  addDocente(id) {
    if (this.isUserTeamConfirmed()) return;
    if (this.selectedDocenti.length >= 4) {
      this.showToast("⚠️ Puoi avere al massimo 4 docenti!", "danger");
      return;
    }
    if (!this.selectedDocenti.includes(id)) {
      this.selectedDocenti.push(id);
      this.playSound('coin');
      this.renderBuilder();
    }
  }

  removeDocente(id) {
    if (this.isUserTeamConfirmed()) return;
    this.selectedDocenti = this.selectedDocenti.filter(d => d !== id);
    this.playSound('click');
    this.renderBuilder();
  }

  setCollega(id) {
    if (this.isUserTeamConfirmed()) return;
    const col = COLLEGHI.find(c => c.id === id);
    if (!col) return;

    if (col.nome.toLowerCase() === this.currentUser.username.toLowerCase()) {
      this.playSound('glitch');
      this.showToast("🚫 Regola di Auto-Esclusione: Non puoi selezionare te stesso come Collega!", "danger");
      return;
    }

    this.selectedCollega = id;
    this.playSound('coin');
    this.renderBuilder();
  }

  removeCollega() {
    if (this.isUserTeamConfirmed()) return;
    this.selectedCollega = null;
    this.playSound('click');
    this.renderBuilder();
  }

  confirmSquad() {
    if (this.isUserTeamConfirmed()) return;

    const { spent, isValidBudget } = this.calculateCFA();
    if (this.selectedDocenti.length !== 4 || !this.selectedCollega) {
      this.showToast("⚠️ Devi selezionare esattamente 4 Docenti e 1 Collega!", "danger");
      return;
    }
    if (!isValidBudget) {
      this.showToast("⛔ Budget superato! Hai speso più di 100 CFA.", "danger");
      return;
    }

    if (!confirm("Sei sicuro di voler confermare la tua squadra? Una volta confermata, sarà bloccata definitivamente e non potrai più modificarla!")) {
      return;
    }

    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser.username] || {
      confirmed: false,
      puntiBase: 0,
      puntiStorico: []
    };

    const selectedCollegaObj = COLLEGHI.find(c => c.id === this.selectedCollega);

    myTeam.confirmed = true;
    myTeam.docenti = [...this.selectedDocenti];
    myTeam.collega = this.selectedCollega;
    myTeam.cfaSpesi = spent;

    // Trigger automatici
    if (selectedCollegaObj.nome === "Kiril" || selectedCollegaObj.nome === "Nicole") {
      myTeam.puntiBase += 20;
      myTeam.puntiStorico.push({
        data: new Date().toLocaleDateString('it-IT'),
        motivo: `🎖️ Bonus Coraggio: Schierato ${selectedCollegaObj.nome}`,
        pt: 20
      });
      this.showToast(`🎖️ Sorpresa! Accredito Coraggio: +20 pt per aver schierato ${selectedCollegaObj.nome}!`, 'bonus');
    }

    if (selectedCollegaObj.nome === "Martina") {
      myTeam.puntiBase += 100;
      myTeam.puntiStorico.push({
        data: new Date().toLocaleDateString('it-IT'),
        motivo: `👑 Mascotte Martina: +100 pt automatici e sblocco Soffiate dal Master`,
        pt: 100
      });
      this.showToast(`👑 Sorpresa! Benedizione Master: +100 pt e sblocco esclusivo delle Soffiate dal Master!`, 'bonus');
    }

    teams[this.currentUser.username] = myTeam;
    this.saveData('fanta_teams', teams);

    this.playSound('success');
    this.fireConfetti();
    this.showToast("🎉 Squadra confermata e sigillata con successo! Ora hai accesso a Classifica, Bacheca e Secret Rules!", "success");

    this.render();
  }

  fireConfetti() {
    const conf = document.createElement('div');
    conf.style.position = 'fixed';
    conf.style.inset = '0';
    conf.style.pointerEvents = 'none';
    conf.style.zIndex = '99999';
    conf.innerHTML = `
      <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); font-size: 5rem; animation: pulseRotate 1s ease forwards;">
        🎊 ⚽ 🏆 🔒
      </div>
    `;
    document.body.appendChild(conf);
    setTimeout(() => conf.remove(), 1800);
  }

  // --- SECTION: SECRET RULES ---
  renderSecretRules() {
    const container = document.getElementById('secretRulesList');
    if (!container) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const isMaster = this.currentUser && this.currentUser.role === 'master';
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser?.username];
    const myCollegaId = myTeam?.collega;

    container.innerHTML = COLLEGHI.map(col => {
      const isDeployedInMyTeam = isConfirmed && (col.id === myCollegaId);
      const isUnlocked = isDeployedInMyTeam || isMaster;

      return `
        <div class="secret-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="secret-header">
            <div class="secret-collega-info">
              <span class="secret-collega-avatar">${col.avatar}</span>
              <div>
                <h3 class="secret-collega-name">${col.nome}</h3>
                <span style="font-size: 0.72rem; color: var(--text-dark);">${col.fascia} (${col.costoCFA} CFA)</span>
              </div>
            </div>
            <div>
              ${isUnlocked ? `
                <span class="secret-status-tag status-unlocked">
                  ${isDeployedInMyTeam ? '🔓 Sbloccata in Squadra' : '👑 Master Preview'}
                </span>
              ` : `
                <span class="secret-status-tag status-locked">
                  🔒 Top Secret
                </span>
              `}
            </div>
          </div>

          ${isUnlocked ? `
            <div class="unlocked-rules-list">
              ${col.secretRules.map(rule => `
                <div class="rule-item">
                  <span class="rule-pts ${rule.tipo}">
                    ${rule.pt > 0 ? '+' + rule.pt : rule.pt} pt
                  </span>
                  <div class="rule-desc">${rule.desc}</div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="cipher-box">
              <div class="cipher-redacted">
                ████████████████████████████████████████████████
              </div>
              <div class="cipher-hint">
                🔒 Regola criptata! Schiera <strong>${col.nome}</strong> e conferma definitivamente la tua squadra per decrittare questa regola segreta.
              </div>
            </div>
          `}
        </div>
      `;
    }).join('');
  }

  // --- SECTION: SOFFIATE DAL MASTER ---
  renderMasterTips() {
    const container = document.getElementById('masterTipsList');
    const lockedMsg = document.getElementById('masterTipsLockedMsg');
    if (!container || !lockedMsg) return;

    const isConfirmed = this.isUserTeamConfirmed();
    const teams = this.getData('fanta_teams') || {};
    const myTeam = teams[this.currentUser?.username];
    const hasMartina = isConfirmed && (myTeam?.collega === 'collega-martina');
    const isMaster = this.currentUser && this.currentUser.role === 'master';

    if (hasMartina || isMaster) {
      lockedMsg.style.display = 'none';
      container.style.display = 'block';

      const tips = this.getData('fanta_tips') || [];
      container.innerHTML = tips.map(tip => `
        <div class="card" style="margin-bottom: 16px; border-left: 4px solid #fbbf24; background: linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(15, 23, 42, 0.85));">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 0.75rem; font-weight: 800; color: #fbbf24; text-transform: uppercase;">
              👑 CANALE RISERVATO MASTER
            </span>
            <span style="font-size: 0.75rem; color: var(--text-dark); font-family: 'JetBrains Mono', monospace;">
              ${tip.data}
            </span>
          </div>
          <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 6px;">${tip.titolo}</h3>
          <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.5;">${tip.testo}</p>
        </div>
      `).join('');
    } else {
      lockedMsg.style.display = 'block';
      container.style.display = 'none';
    }
  }

  // --- SECTION: CATALOGO PERSONAGGI & CFA (CON LE DESCRIZIONI ORIGINALI ESATTE) ---
  renderCatalog() {
    // 1. Rendering Docenti suddivisi per le 5 fasce di costo esatte
    const docentiCatalogContainer = document.getElementById('catalogDocentiList');
    if (docentiCatalogContainer) {
      const tiers = [
        { name: "Molto Costosi (30 CFA)", color: "#ef4444", list: DOCENTI.filter(d => d.costoCFA === 30) },
        { name: "Costosi (22 CFA)", color: "#f59e0b", list: DOCENTI.filter(d => d.costoCFA === 22) },
        { name: "Medi (15 CFA)", color: "#3b82f6", list: DOCENTI.filter(d => d.costoCFA === 15) },
        { name: "Poco Costosi (10 CFA)", color: "#10b981", list: DOCENTI.filter(d => d.costoCFA === 10) },
        { name: "Occasione (5 CFA)", color: "#8b5cf6", list: DOCENTI.filter(d => d.costoCFA === 5) }
      ];

      docentiCatalogContainer.innerHTML = tiers.map(t => `
        <div style="margin-bottom: 24px;">
          <h4 style="color: ${t.color}; font-size: 1.15rem; font-weight: 800; margin-bottom: 12px; border-left: 4px solid ${t.color}; padding-left: 10px;">
            ${t.name}
          </h4>
          <div class="grid-4">
            ${t.list.map(doc => `
              <div class="character-card">
                <div class="char-top">
                  <div class="char-avatar-box">${doc.avatar}</div>
                  <div class="char-badge-cost">
                    <span class="cost-tag">${doc.costoCFA} CFA</span>
                    <span class="tier-label">${doc.fascia}</span>
                  </div>
                </div>
                <h4 class="char-name">${doc.nome}</h4>
                <p class="char-bio">${doc.bio}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }

    // 2. Rendering Colleghi (senza spoiler dei bonus segreti)
    const colleghiCatalogContainer = document.getElementById('catalogColleghiList');
    if (colleghiCatalogContainer) {
      colleghiCatalogContainer.innerHTML = COLLEGHI.map(col => `
        <div class="character-card">
          <div class="char-top">
            <div class="char-avatar-box">${col.avatar}</div>
            <div class="char-badge-cost">
              <span class="cost-tag">${col.costoCFA} CFA</span>
              <span class="tier-label">${col.fascia}</span>
            </div>
          </div>
          <h4 class="char-name">${col.nome}</h4>
        </div>
      `).join('');
    }

    // 3. Regolamento Eventi
    const attContainer = document.getElementById('regolamentoAttivitaList');
    if (attContainer) {
      attContainer.innerHTML = EVENTI_CATALOGO.attivita.map(e => `
        <div class="rule-item" style="margin-bottom: 8px; justify-content: space-between;">
          <div>
            <strong>${e.nome}</strong>: <span style="color: var(--text-muted); font-size: 0.85rem;">${e.desc}</span>
          </div>
          <span class="rule-pts bonus" style="margin-left: 10px;">+${e.pt} pt</span>
        </div>
      `).join('');
    }

    const campusContainer = document.getElementById('regolamentoCampusList');
    if (campusContainer) {
      campusContainer.innerHTML = EVENTI_CATALOGO.campus.map(e => `
        <div class="rule-item" style="margin-bottom: 8px; justify-content: space-between;">
          <div>
            <strong>${e.nome}</strong>: <span style="color: var(--text-muted); font-size: 0.85rem;">${e.desc}</span>
          </div>
          <span class="rule-pts ${e.pt > 0 ? 'bonus' : 'malus'}" style="margin-left: 10px;">
            ${e.pt > 0 ? '+' + e.pt : e.pt} pt
          </span>
        </div>
      `).join('');
    }

    const docSpecificContainer = document.getElementById('regolamentoDocentiSpecifici');
    if (docSpecificContainer) {
      docSpecificContainer.innerHTML = DOCENTI.map(d => `
        <div class="card" style="margin-bottom: 12px; padding: 14px 18px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <span style="font-size: 1.4rem;">${d.avatar}</span>
            <strong style="color: #fff; font-size: 1rem;">${d.nome}</strong>
            <span style="font-size: 0.72rem; color: #fbbf24; font-family: 'JetBrains Mono', monospace;">${d.costoCFA} CFA</span>
          </div>
          <div>
            ${d.specificEvents.map(se => `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; margin-top: 4px; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.04);">
                <span style="color: var(--text-muted);">${se.desc}</span>
                <span class="rule-pts bonus" style="margin-left: 8px;">+${se.pt} pt</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  // --- SECTION: LEADERBOARD (CLASSIFICA) ---
  renderLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    const users = this.getData('fanta_users') || INITIAL_USERS;
    const teams = this.getData('fanta_teams') || {};

    const ranks = users.map(u => {
      const team = teams[u.username] || {
        confirmed: false,
        docenti: [],
        collega: null,
        cfaSpesi: 0,
        puntiBase: 0,
        puntiStorico: []
      };

      const totalPoints = (team.puntiStorico || []).reduce((acc, h) => acc + (h.pt || 0), team.puntiBase || 0);

      return {
        username: u.username,
        avatar: u.avatar,
        role: u.role,
        team,
        totalPoints
      };
    });

    ranks.sort((a, b) => b.totalPoints - a.totalPoints);

    tbody.innerHTML = ranks.map((item, idx) => {
      let rankBadgeClass = 'rank-other';
      if (idx === 0) rankBadgeClass = 'rank-1';
      else if (idx === 1) rankBadgeClass = 'rank-2';
      else if (idx === 2) rankBadgeClass = 'rank-3';

      const isCurrent = this.currentUser && (item.username === this.currentUser.username);

      let squadPills = '';
      if (item.team.confirmed) {
        const docPills = (item.team.docenti || []).map(docId => {
          const d = DOCENTI.find(x => x.id === docId);
          return d ? `<span class="char-tiny-pill">${d.avatar} ${d.nome}</span>` : '';
        }).join('');

        const colObj = COLLEGHI.find(x => x.id === item.team.collega);
        const colPill = colObj ? `<span class="char-tiny-pill collega-pill">${colObj.avatar} ${colObj.nome}</span>` : '';

        squadPills = `<div class="team-pill-list">${docPills} ${colPill}</div>`;
      } else {
        squadPills = `<span style="font-size: 0.8rem; color: var(--text-dark); font-style: italic;">Squadra non ancora confermata</span>`;
      }

      return `
        <tr style="${isCurrent ? 'background: rgba(139, 92, 246, 0.12);' : ''}">
          <td style="width: 50px;">
            <div class="rank-badge ${rankBadgeClass}">${idx + 1}</div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.3rem;">${item.avatar}</span>
              <div>
                <strong style="color: #fff;">${item.username}</strong>
                ${item.role === 'master' ? '<span class="user-badge-role role-master" style="margin-left: 6px;">MASTER</span>' : ''}
                ${isCurrent ? '<span style="font-size: 0.7rem; color: #67e8f9; margin-left: 4px;">(TU)</span>' : ''}
              </div>
            </div>
          </td>
          <td>${squadPills}</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.88rem; color: #fbbf24;">
            ${item.team.confirmed ? item.team.cfaSpesi + ' CFA' : '-'}
          </td>
          <td class="points-cell">${item.totalPoints} pt</td>
          <td>
            <button class="btn-recruit" style="padding: 4px 10px; font-size: 0.75rem;" onclick="app.inspectCoach('${item.username}')">
              Dettagli
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  inspectCoach(username) {
    const users = this.getData('fanta_users') || INITIAL_USERS;
    const teams = this.getData('fanta_teams') || {};
    const user = users.find(u => u.username === username);
    const team = teams[username];

    if (!user || !team) return;

    const modalBody = document.getElementById('coachDetailsModalBody');
    if (!modalBody) return;

    let docentiHtml = '';
    (team.docenti || []).forEach(docId => {
      const d = DOCENTI.find(x => x.id === docId);
      if (d) {
        docentiHtml += `
          <div style="background: rgba(10, 15, 28, 0.6); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 8px;">
            <span>${d.avatar}</span>
            <strong>${d.nome}</strong>
            <span style="margin-left: auto; color: #fbbf24; font-family: 'JetBrains Mono'; font-size: 0.8rem;">${d.costoCFA} CFA</span>
          </div>
        `;
      }
    });

    const colObj = COLLEGHI.find(x => x.id === team.collega);

    let historyHtml = (team.puntiStorico || []).map(h => `
      <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div>
          <span style="color: var(--text-dark); font-family: 'JetBrains Mono'; font-size: 0.75rem;">[${h.data}]</span>
          <span style="color: #fff; margin-left: 6px;">${h.motivo}</span>
        </div>
        <strong style="color: ${h.pt >= 0 ? '#34d399' : '#ef4444'}; font-family: 'JetBrains Mono';">
          ${h.pt >= 0 ? '+' + h.pt : h.pt} pt
        </strong>
      </div>
    `).join('') || '<p style="color: var(--text-muted); font-size: 0.85rem;">Nessun evento ancora registrato.</p>';

    const totalPts = (team.puntiStorico || []).reduce((acc, h) => acc + (h.pt || 0), team.puntiBase || 0);

    modalBody.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
        <span style="font-size: 3rem;">${user.avatar}</span>
        <div>
          <h2 style="color: #fff; font-size: 1.4rem;">Squadra di ${user.username}</h2>
          <p style="color: var(--text-muted); font-size: 0.85rem;">${user.bio}</p>
        </div>
        <div style="margin-left: auto; text-align: right;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dark);">Punteggio</div>
          <div style="font-family: 'JetBrains Mono'; font-size: 1.6rem; font-weight: 800; color: #34d399;">${totalPts} pt</div>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Docenti Schierati</h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 18px;">
        ${docentiHtml || '<p style="color: var(--text-muted);">Nessun docente schierato</p>'}
      </div>

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: #fbbf24; margin-bottom: 10px;">Collega Schierato</h4>
      ${colObj ? `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
          <span style="font-size: 1.5rem;">${colObj.avatar}</span>
          <div>
            <strong style="color: #fff;">${colObj.nome}</strong>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${colObj.bio}</div>
          </div>
          <span style="margin-left: auto; color: #fbbf24; font-family: 'JetBrains Mono'; font-weight: 800;">${colObj.costoCFA} CFA</span>
        </div>
      ` : '<p style="color: var(--text-muted); margin-bottom: 20px;">Nessun collega</p>'}

      <h4 style="font-size: 0.95rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">Storico Eventi & Punti</h4>
      <div style="max-height: 180px; overflow-y: auto; background: rgba(9, 13, 24, 0.6); padding: 12px; border-radius: 8px;">
        ${historyHtml}
      </div>
    `;

    this.openModal('coachDetailsModal');
  }

  // --- SECTION: SOCIAL FEED (SEGNALAZIONI) ---
  renderSocialFeed() {
    const container = document.getElementById('socialReportsList');
    if (!container) return;

    const reports = this.getData('fanta_reports') || [];

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px 20px;">
          <div style="font-size: 2.5rem; margin-bottom: 10px;">📸</div>
          <h4 style="color: #fff; font-size: 1.15rem; margin-bottom: 6px;">Bacheca Social Pulita</h4>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 480px; margin: 0 auto 18px auto;">
            Non ci sono ancora segnalazioni inviate. Sii il primo a documentare una gaffe, un meme o un evento accademico!
          </p>
          <button class="btn-confirm-squad" style="width: auto; margin: 0 auto; padding: 10px 20px;" onclick="app.openModal('newReportModal')">
            + Invia la Prima Segnalazione
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(r => {
      const myVote = (r.voters && this.currentUser && r.voters[this.currentUser.username]) || 0;
      let statusBadge = '';
      if (r.stato === 'approvata') {
        statusBadge = `<span class="secret-status-tag status-unlocked">✓ Approvata (+${r.punti}pt)</span>`;
      } else if (r.stato === 'rifiutata') {
        statusBadge = `<span class="secret-status-tag status-locked">✕ Rifiutata</span>`;
      } else {
        statusBadge = `<span class="secret-status-tag" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">⏳ In attesa Master</span>`;
      }

      return `
        <div class="report-card">
          <div class="report-header">
            <div class="report-author-box">
              <span style="font-size: 1.4rem;">📷</span>
              <div>
                <strong style="color: #fff; font-size: 0.95rem;">${r.autore}</strong>
                <div style="font-size: 0.75rem; color: var(--text-dark);">${r.data}</div>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <h3 class="report-title">${r.titolo}</h3>
          <p class="report-desc">${r.descrizione}</p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px;">
            <span class="char-tiny-pill" style="background: rgba(6, 182, 212, 0.15); border-color: rgba(6, 182, 212, 0.4); color: #67e8f9;">
              🎯 Personaggio: ${r.personaggioNome}
            </span>
            <span class="char-tiny-pill" style="background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.4); color: #fbbf24;">
              🏆 Categoria: ${r.categoria}
            </span>
            <span class="char-tiny-pill" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #34d399;">
              ${r.punti >= 0 ? '+' + r.punti : r.punti} pt
            </span>
          </div>

          ${r.foto ? `
            <img src="${r.foto}" alt="Prova Segnalazione" class="report-media-preview" onerror="this.style.display='none'" />
          ` : ''}

          <div class="report-footer">
            <div class="vote-controls">
              <button class="btn-vote ${myVote === 1 ? 'active-up' : ''}" onclick="app.voteReport('${r.id}', 1)">
                ▲ Upvote <strong>${r.upvotes || 0}</strong>
              </button>
              <button class="btn-vote ${myVote === -1 ? 'active-down' : ''}" onclick="app.voteReport('${r.id}', -1)">
                ▼ Downvote <strong>${r.downvotes || 0}</strong>
              </button>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-dark);">
              ID: #${r.id}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  voteReport(reportId, voteVal) {
    if (!this.currentUser) return;
    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    if (!rep.voters) rep.voters = {};
    const prevVote = rep.voters[this.currentUser.username] || 0;

    if (prevVote === voteVal) {
      if (voteVal === 1) rep.upvotes = Math.max(0, (rep.upvotes || 1) - 1);
      if (voteVal === -1) rep.downvotes = Math.max(0, (rep.downvotes || 1) - 1);
      delete rep.voters[this.currentUser.username];
    } else {
      if (prevVote === 1) rep.upvotes = Math.max(0, (rep.upvotes || 1) - 1);
      if (prevVote === -1) rep.downvotes = Math.max(0, (rep.downvotes || 1) - 1);

      if (voteVal === 1) rep.upvotes = (rep.upvotes || 0) + 1;
      if (voteVal === -1) rep.downvotes = (rep.downvotes || 0) + 1;

      rep.voters[this.currentUser.username] = voteVal;
    }

    this.saveData('fanta_reports', reports);
    this.playSound('click');
    this.renderSocialFeed();
  }

  // --- SECTION: MASTER DASHBOARD & 1-CLICK LIVE SCORING ENGINE ---
  renderMasterDashboard() {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const pendingReports = reports.filter(r => r.stato === 'in_attesa');
    const container = document.getElementById('masterPendingReportsList');

    if (container) {
      if (pendingReports.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Nessuna segnalazione in attesa di approvazione.</p>`;
      } else {
        container.innerHTML = pendingReports.map(r => `
          <div class="card" style="margin-bottom: 14px; border: 1.5px solid rgba(245, 158, 11, 0.4);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px;">
              <div>
                <strong style="color: #fff; font-size: 1.05rem;">${r.titolo}</strong>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  Inviata da <strong>${r.autore}</strong> il ${r.data} • Personaggio: <strong>${r.personaggioNome}</strong>
                </div>
              </div>
              <span class="cost-tag" style="color: #34d399; border-color: #34d399;">
                ${r.punti >= 0 ? '+' + r.punti : r.punti} pt
              </span>
            </div>
            <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 12px;">${r.descrizione}</p>
            ${r.foto ? `<img src="${r.foto}" style="max-height: 180px; border-radius: 8px; margin-bottom: 12px;" />` : ''}
            <div class="master-action-row">
              <button class="btn-master-approve" onclick="app.approveReport('${r.id}')">
                ✓ Approva e Assegna Punti Automatici
              </button>
              <button class="btn-master-reject" onclick="app.rejectReport('${r.id}')">
                ✕ Rifiuta Segnalazione
              </button>
            </div>
          </div>
        `).join('');
      }
    }

    this.renderMasterLiveScoring();
    this.renderMasterUnlockControls();
  }

  renderMasterLiveScoring() {
    const chipsContainer = document.getElementById('masterScoringCharChips');
    const eventsContainer = document.getElementById('masterScoringEventsGrid');
    const selectedCharInfo = document.getElementById('masterScoringSelectedInfo');
    if (!chipsContainer || !eventsContainer) return;

    const allCharacters = [
      ...DOCENTI.map(d => ({ ...d, tipo: 'Docente' })),
      ...COLLEGHI.map(c => ({ ...c, tipo: 'Collega' }))
    ];

    chipsContainer.innerHTML = allCharacters.map(char => `
      <button type="button" class="char-chip ${char.id === this.scoringSelectedCharId ? 'active' : ''}" onclick="app.selectScoringChar('${char.id}')">
        <span>${char.avatar}</span>
        <span>${char.nome}</span>
      </button>
    `).join('');

    const currentChar = allCharacters.find(c => c.id === this.scoringSelectedCharId) || allCharacters[0];
    if (!currentChar) return;

    const teams = this.getData('fanta_teams') || {};
    const owners = [];
    Object.entries(teams).forEach(([coachName, team]) => {
      if (team.confirmed) {
        if ((team.docenti || []).includes(currentChar.id) || team.collega === currentChar.id) {
          owners.push(coachName);
        }
      }
    });

    if (selectedCharInfo) {
      selectedCharInfo.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: rgba(10, 16, 30, 0.8); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); margin-bottom: 14px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 2rem;">${currentChar.avatar}</span>
            <div>
              <strong style="color: #fff; font-size: 1.1rem;">${currentChar.nome}</strong>
              <div style="font-size: 0.78rem; color: #fbbf24;">${currentChar.tipo} (${currentChar.costoCFA} CFA)</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dark);">Schierato da (${owners.length} Squadre):</div>
            <strong style="color: ${owners.length > 0 ? '#34d399' : '#f87171'}; font-size: 0.95rem;">
              ${owners.length > 0 ? owners.join(', ') : 'Nessuna squadra confermata'}
            </strong>
          </div>
        </div>
      `;
    }

    let eventsList = [];

    if (currentChar.specificEvents) {
      currentChar.specificEvents.forEach(se => {
        eventsList.push({
          titolo: se.nome,
          desc: se.desc,
          pt: se.pt,
          categoria: 'Specifico Docente'
        });
      });
    }

    if (currentChar.secretRules) {
      currentChar.secretRules.forEach(sr => {
        if (sr.pt !== 0) {
          eventsList.push({
            titolo: sr.desc.split('(')[0],
            desc: sr.desc,
            pt: sr.pt,
            categoria: 'Secret Rule Collega'
          });
        }
      });
    }

    EVENTI_CATALOGO.attivita.forEach(ae => {
      eventsList.push({
        titolo: ae.nome,
        desc: ae.desc,
        pt: ae.pt,
        categoria: 'Attività & Lezioni'
      });
    });

    EVENTI_CATALOGO.campus.forEach(ce => {
      eventsList.push({
        titolo: ce.nome,
        desc: ce.desc,
        pt: ce.pt,
        categoria: 'Vita da Campus'
      });
    });

    eventsContainer.innerHTML = eventsList.map((ev, i) => `
      <button type="button" class="matrix-event-btn" onclick="app.triggerLiveScore('${currentChar.id}', ${i})">
        <div>
          <strong style="display: block; font-size: 0.92rem;">${ev.titolo}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${ev.categoria}</span>
        </div>
        <span class="rule-pts ${ev.pt >= 0 ? 'bonus' : 'malus'}" style="font-size: 0.85rem;">
          ${ev.pt >= 0 ? '+' + ev.pt : ev.pt} pt
        </span>
      </button>
    `).join('');

    this.currentMatrixEvents = eventsList;
  }

  selectScoringChar(charId) {
    this.scoringSelectedCharId = charId;
    this.playSound('click');
    this.renderMasterLiveScoring();
  }

  triggerLiveScore(charId, eventIndex) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const event = this.currentMatrixEvents[eventIndex];
    if (!event) return;

    const allCharacters = [...DOCENTI, ...COLLEGHI];
    const charObj = allCharacters.find(c => c.id === charId);
    if (!charObj) return;

    const teams = this.getData('fanta_teams') || {};
    const impactedCoaches = [];

    Object.entries(teams).forEach(([coachName, team]) => {
      if (!team.confirmed) return;

      const hasInDocenti = (team.docenti || []).includes(charId);
      const hasInCollega = (team.collega === charId);

      if (hasInDocenti || hasInCollega) {
        if (!team.puntiStorico) team.puntiStorico = [];
        team.puntiStorico.push({
          data: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          motivo: `⚡ ${charObj.nome}: ${event.titolo}`,
          pt: event.pt
        });
        impactedCoaches.push(coachName);
      }
    });

    this.saveData('fanta_teams', teams);
    this.playSound(event.pt >= 0 ? 'coin' : 'glitch');

    if (impactedCoaches.length > 0) {
      this.showToast(`⚡ ${charObj.nome} (${event.pt >= 0 ? '+' : ''}${event.pt} pt) accreditato a: ${impactedCoaches.join(', ')}!`, 'bonus');
    } else {
      this.showToast(`⚡ Evento ${charObj.nome} registrato (${event.pt >= 0 ? '+' : ''}${event.pt} pt), ma nessuna squadra confermata possiede questo personaggio.`, 'info');
    }

    this.render();
  }

  renderMasterUnlockControls() {
    const selUnlock = document.getElementById('masterUnlockCoachSelect');
    if (!selUnlock) return;

    const teams = this.getData('fanta_teams') || {};
    const confirmedCoaches = Object.keys(teams).filter(c => teams[c].confirmed);

    if (confirmedCoaches.length === 0) {
      selUnlock.innerHTML = '<option value="">Nessuna squadra confermata</option>';
    } else {
      selUnlock.innerHTML = confirmedCoaches.map(c => `
        <option value="${c}">${c}</option>
      `).join('');
    }
  }

  masterUnlockCoach() {
    if (!this.currentUser || this.currentUser.role !== 'master') return;
    const selUnlock = document.getElementById('masterUnlockCoachSelect');
    const coachName = selUnlock.value;
    if (!coachName) return;

    const teams = this.getData('fanta_teams') || {};
    if (teams[coachName]) {
      teams[coachName].confirmed = false;
      this.saveData('fanta_teams', teams);
      this.playSound('click');
      this.showToast(`🔓 Squadra di ${coachName} sbloccata! L'allenatore può ora effettuare le modifiche richieste.`, 'info');
      this.render();
    }
  }

  approveReport(reportId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    rep.stato = 'approvata';
    this.saveData('fanta_reports', reports);

    const teams = this.getData('fanta_teams') || {};
    const impactedCoaches = [];

    Object.entries(teams).forEach(([coachName, team]) => {
      if (!team.confirmed) return;

      const hasInDocenti = (team.docenti || []).includes(rep.personaggioId);
      const hasInCollega = (team.collega === rep.personaggioId);

      if (hasInDocenti || hasInCollega) {
        if (!team.puntiStorico) team.puntiStorico = [];
        team.puntiStorico.push({
          data: new Date().toLocaleDateString('it-IT'),
          motivo: `${rep.personaggioNome}: ${rep.categoria} (Approvata dal Master)`,
          pt: rep.punti
        });
        impactedCoaches.push(coachName);
      }
    });

    this.saveData('fanta_teams', teams);
    this.playSound('success');
    this.showToast(`✅ Segnalazione approvata! Punti accreditati a: ${impactedCoaches.length > 0 ? impactedCoaches.join(', ') : 'Nessuna squadra ha questo personaggio'}`, 'success');

    this.render();
  }

  rejectReport(reportId) {
    if (!this.currentUser || this.currentUser.role !== 'master') return;

    const reports = this.getData('fanta_reports') || [];
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;

    rep.stato = 'rifiutata';
    this.saveData('fanta_reports', reports);

    this.playSound('click');
    this.showToast(`Segnalazione #${reportId} rifiutata.`, 'info');
    this.render();
  }

  // --- FORM HANDLERS (SOLO CREDENZIALI NOME UTENTE E PASSWORD) ---
  setupLoginForm() {
    const manualForm = document.getElementById('formManualLogin');
    if (manualForm) {
      manualForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value.trim();
        const p = document.getElementById('loginPassword').value.trim();
        const users = this.getData('fanta_users') || INITIAL_USERS;

        const found = users.find(x => x.username.toLowerCase() === u.toLowerCase() && x.password === p);

        if (found) {
          this.setActiveUser(found.username);
          this.closeAllModals();
          manualForm.reset();
        } else {
          this.playSound('glitch');
          this.showToast("❌ Credenziali non valide! Verifica nome utente e password.", "danger");
        }
      });
    }
  }

  setupReportForm() {
    const btnOpen = document.getElementById('btnOpenNewReportModal');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        if (!this.isUserTeamConfirmed() && this.currentUser.role !== 'master') {
          this.showToast("🔒 Devi prima confermare la tua Squadra per inviare segnalazioni!", "danger");
          return;
        }
        this.openModal('newReportModal');
      });
    }

    const selChar = document.getElementById('reportPersonaggioSelect');
    if (selChar) {
      let optHtml = '<option value="">-- Seleziona Personaggio Coinvolto --</option>';
      optHtml += '<optgroup label="Docenti">';
      DOCENTI.forEach(d => {
        optHtml += `<option value="${d.id}" data-name="${d.nome}" data-type="docente">${d.avatar} ${d.nome} (${d.costoCFA} CFA)</option>`;
      });
      optHtml += '</optgroup><optgroup label="Colleghi">';
      COLLEGHI.forEach(c => {
        optHtml += `<option value="${c.id}" data-name="${c.nome}" data-type="collega">${c.avatar} ${c.nome} (${c.costoCFA} CFA)</option>`;
      });
      optHtml += '</optgroup>';
      selChar.innerHTML = optHtml;
    }

    const selEvent = document.getElementById('reportEventoSelect');
    if (selEvent) {
      let evHtml = '<option value="" data-pts="0">-- Seleziona Evento da Regolamento (oppure scrivi sotto) --</option>';
      evHtml += '<optgroup label="Attività & Lezioni">';
      EVENTI_CATALOGO.attivita.forEach(e => {
        evHtml += `<option value="${e.nome}" data-pts="${e.pt}">[+${e.pt}pt] ${e.nome}</option>`;
      });
      evHtml += '</optgroup><optgroup label="Vita da Campus">';
      EVENTI_CATALOGO.campus.forEach(e => {
        evHtml += `<option value="${e.nome}" data-pts="${e.pt}">[${e.pt > 0 ? '+' : ''}${e.pt}pt] ${e.nome}</option>`;
      });
      evHtml += '</optgroup>';
      selEvent.innerHTML = evHtml;

      selEvent.addEventListener('change', () => {
        const selectedOpt = selEvent.options[selEvent.selectedIndex];
        const pts = selectedOpt.getAttribute('data-pts');
        const ptsInput = document.getElementById('reportPuntiInput');
        if (ptsInput && pts) ptsInput.value = pts;
      });
    }

    const form = document.getElementById('formNewReport');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const titolo = document.getElementById('reportTitoloInput').value.trim();
        const desc = document.getElementById('reportDescInput').value.trim();
        const selPersonaggio = document.getElementById('reportPersonaggioSelect');
        const persId = selPersonaggio.value;
        const persNome = selPersonaggio.options[selPersonaggio.selectedIndex]?.getAttribute('data-name') || 'Generale';
        const catSelect = document.getElementById('reportEventoSelect');
        const catVal = catSelect.value || document.getElementById('reportCustomCatInput').value.trim() || 'Evento Straordinario';
        const punti = parseInt(document.getElementById('reportPuntiInput').value, 10) || 20;
        const fotoUrl = document.getElementById('reportFotoUrlInput').value.trim();

        if (!titolo || !desc || !persId) {
          this.showToast("⚠️ Compila tutti i campi obbligatori!", "danger");
          return;
        }

        const reports = this.getData('fanta_reports') || [];
        const newRep = {
          id: 'rep-' + Date.now(),
          titolo,
          descrizione: desc,
          personaggioId: persId,
          personaggioNome: persNome,
          categoria: catVal,
          punti,
          autore: this.currentUser.username,
          data: new Date().toLocaleDateString('it-IT') + ' ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          foto: fotoUrl,
          stato: 'in_attesa',
          upvotes: 1,
          downvotes: 0,
          voters: { [this.currentUser.username]: 1 }
        };

        reports.unshift(newRep);
        this.saveData('fanta_reports', reports);

        this.playSound('success');
        this.closeAllModals();
        form.reset();
        this.showToast("🚀 Segnalazione inviata con successo! In attesa di approvazione Master.", "success");
        this.switchTab('social');
      });
    }
  }

  setupNoticeForm() {
    const form = document.getElementById('formNewNotice');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const tipo = document.getElementById('noticeTipoSelect').value;
        const titolo = document.getElementById('noticeTitoloInput').value.trim();
        const testo = document.getElementById('noticeTestoInput').value.trim();

        let icona = '📢';
        if (tipo.includes('IMPREVISTO')) icona = '⚡';
        if (tipo.includes('LORE')) icona = '👁️';

        const notices = this.getData('fanta_notices') || [];
        notices.unshift({
          id: 'notice-' + Date.now(),
          tipo,
          icona,
          badge: 'Nuovo',
          titolo,
          data: new Date().toLocaleDateString('it-IT'),
          testo
        });

        this.saveData('fanta_notices', notices);
        this.playSound('success');
        this.showToast("📢 Avviso pubblicato in Home!", "success");
        form.reset();
        this.renderHome();
      });
    }
  }

  setupTipForm() {
    const form = document.getElementById('formNewTip');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const titolo = document.getElementById('tipTitoloInput').value.trim();
        const testo = document.getElementById('tipTestoInput').value.trim();

        const tips = this.getData('fanta_tips') || [];
        tips.unshift({
          id: Date.now(),
          titolo,
          data: new Date().toLocaleDateString('it-IT'),
          testo
        });

        this.saveData('fanta_tips', tips);
        this.playSound('success');
        this.showToast("👑 Soffiata Master aggiunta!", "success");
        form.reset();
        this.renderMasterTips();
      });
    }
  }

  setupManualPointsForm() {
    const selCoach = document.getElementById('manualCoachSelect');
    if (selCoach) {
      selCoach.innerHTML = INITIAL_USERS.map(u => `
        <option value="${u.username}">${u.avatar} ${u.username}</option>
      `).join('');
    }

    const form = document.getElementById('formManualPoints');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!this.currentUser || this.currentUser.role !== 'master') return;

        const coach = document.getElementById('manualCoachSelect').value;
        const pts = parseInt(document.getElementById('manualPointsInput').value, 10);
        const motivo = document.getElementById('manualMotivoInput').value.trim();

        const teams = this.getData('fanta_teams') || {};
        if (!teams[coach]) {
          teams[coach] = { confirmed: false, puntiBase: 0, puntiStorico: [] };
        }
        if (!teams[coach].puntiStorico) teams[coach].puntiStorico = [];

        teams[coach].puntiStorico.push({
          data: new Date().toLocaleDateString('it-IT'),
          motivo: `👑 Assegnazione Master: ${motivo}`,
          pt: pts
        });

        this.saveData('fanta_teams', teams);
        this.playSound('success');
        this.showToast(`Punti assegnati a ${coach} (${pts >= 0 ? '+' : ''}${pts} pt)`, 'success');
        form.reset();
        this.render();
      });
    }
  }
}

// Global instance initiation
let app = null;
window.addEventListener('DOMContentLoaded', () => {
  app = new FantaApp();
  window.app = app;
});
