(function () {
  "use strict";

  /* ---------------- storage ---------------- */
  var KEYS = { events: 'cemp_events_v1', regs: 'cemp_regs_v1', user: 'cemp_user_v1' };

  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  var CATEGORIES = ['Tech', 'Cultural', 'Sports', 'Workshop', 'Seminar'];

  function seedEvents() {
    return [
      { id: 'ev1', title: 'HackNight: Build in 12 Hours', category: 'Tech', date: '2026-10-03', time: '18:00', venue: 'Auditorium Hall', capacity: 60,
        description: 'An overnight build sprint for teams of up to four. Bring a laptop and an idea — mentors from the CS department will be around all night.' },
      { id: 'ev2', title: 'Canvas & Chords: Open Air Night', category: 'Cultural', date: '2026-10-10', time: '17:30', venue: 'Open Air Theatre', capacity: 150,
        description: 'Live student performances, an open mic, and an art wall you can paint on. Free entry, snacks on sale at the gate.' },
      { id: 'ev3', title: 'Inter-Department Football Cup', category: 'Sports', date: '2026-10-17', time: '15:00', venue: 'Main Sports Ground', capacity: 200,
        description: 'Knockout rounds between all six departments. Come support your team or sign up to referee a match.' },
      { id: 'ev4', title: 'Resume & LinkedIn Workshop', category: 'Workshop', date: '2026-10-22', time: '11:00', venue: 'Seminar Hall B', capacity: 40,
        description: 'A hands-on session with the placement cell — bring a laptop and leave with a reviewed resume and an updated profile.' },
      { id: 'ev5', title: 'Guest Talk: AI in Industry', category: 'Seminar', date: '2026-11-05', time: '14:00', venue: 'Auditorium Hall', capacity: 100,
        description: 'An alumna now working in applied ML talks through what the job actually looks like, followed by an open Q&A.' },
      { id: 'ev6', title: 'Campus Photography Walk', category: 'Cultural', date: '2026-11-12', time: '07:00', venue: 'Main Gate', capacity: 30,
        description: 'An early-morning walk across campus with the photography club. Any camera welcome, phones included.' }
    ];
  }

  function seedRegs() {
    return [
      { id: uid(), eventId: 'ev1', name: 'Aarav Mehta', email: 'aarav.mehta@ridgeview.edu', time: '2026-09-18T10:12:00' },
      { id: uid(), eventId: 'ev1', name: 'Diya Kapoor', email: 'diya.kapoor@ridgeview.edu', time: '2026-09-18T11:03:00' },
      { id: uid(), eventId: 'ev3', name: 'Rohan Iyer', email: 'rohan.iyer@ridgeview.edu', time: '2026-09-19T09:40:00' },
      { id: uid(), eventId: 'ev5', name: 'Sara Fernandes', email: 'sara.fernandes@ridgeview.edu', time: '2026-09-20T16:22:00' }
    ];
  }

  var events = safeGet(KEYS.events, null);
  if (!events) { events = seedEvents(); safeSet(KEYS.events, events); }
  var regs = safeGet(KEYS.regs, null);
  if (!regs) { regs = seedRegs(); safeSet(KEYS.regs, regs); }
  var user = safeGet(KEYS.user, { name: '', email: '' });

  var role = 'student'; // 'student' | 'admin'
  var studentTab = 'events'; // 'events' | 'mine'
  var adminTab = 'dashboard'; // 'dashboard' | 'manage' | 'registrants'
  var searchQuery = '';
  var activeCategory = 'All';
  var selectedRegistrantsEvent = events[0] ? events[0].id : null;
  var flash = null; // { type, message }

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDateParts(iso) {
    var d = new Date(iso + 'T00:00:00');
    var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return { day: d.getDate(), mon: months[d.getMonth()] };
  }
  function fmtDateLong(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  function fmtTime(t) {
    var parts = t.split(':'); var h = parseInt(parts[0], 10); var m = parts[1];
    var suffix = h >= 12 ? 'PM' : 'AM'; var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + m + ' ' + suffix;
  }
  function regsForEvent(eventId) { return regs.filter(function (r) { return r.eventId === eventId; }); }
  function isRegistered(eventId, email) {
    if (!email) return false;
    return regs.some(function (r) { return r.eventId === eventId && r.email.toLowerCase() === email.toLowerCase(); });
  }
  function sortedEvents() {
    return events.slice().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  }
  function setFlash(type, message) { flash = { type: type, message: message }; }

  /* ---------------- render: shell ---------------- */
  var tabNav = document.getElementById('tabNav');
  var mainContent = document.getElementById('mainContent');
  var modalRoot = document.getElementById('modalRoot');

  function renderTabs() {
    var items = role === 'student'
      ? [['events', 'Events'], ['mine', 'My Registrations']]
      : [['dashboard', 'Dashboard'], ['manage', 'Manage Events'], ['registrants', 'Registrants']];
    var current = role === 'student' ? studentTab : adminTab;
    tabNav.innerHTML = items.map(function (it) {
      return '<button data-tab="' + it[0] + '" class="' + (current === it[0] ? 'active' : '') + '">' + it[1] + '</button>';
    }).join('');
    Array.prototype.forEach.call(tabNav.querySelectorAll('button'), function (btn) {
      btn.addEventListener('click', function () {
        if (role === 'student') studentTab = btn.getAttribute('data-tab');
        else adminTab = btn.getAttribute('data-tab');
        render();
      });
    });
  }

  function bannerHtml() {
    if (!flash) return '';
    var html = '<div class="banner ' + flash.type + '">' + esc(flash.message) + '</div>';
    return html;
  }

  /* ---------------- render: student / events ---------------- */
  function renderEventsTab() {
    var html = '';
    html += bannerHtml();
    html += '<div class="controls-row">';
    html += '<input class="search-box" id="searchInput" type="text" placeholder="Search events or venues…" value="' + esc(searchQuery) + '" />';
    html += '</div>';
    html += '<div class="chip-row" id="chipRow" style="margin-bottom:20px;">';
    ['All'].concat(CATEGORIES).forEach(function (c) {
      html += '<button class="chip ' + (activeCategory === c ? 'active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    });
    html += '</div>';

    var list = sortedEvents().filter(function (e) {
      var matchesCat = activeCategory === 'All' || e.category === activeCategory;
      var q = searchQuery.trim().toLowerCase();
      var matchesQ = !q || e.title.toLowerCase().indexOf(q) > -1 || e.venue.toLowerCase().indexOf(q) > -1;
      return matchesCat && matchesQ;
    });

    if (list.length === 0) {
      html += '<div class="empty-state"><div class="display">No events match that search</div>Try a different keyword or clear the category filter.</div>';
    } else {
      html += '<div class="ticket-list">';
      list.forEach(function (e) { html += ticketHtml(e); });
      html += '</div>';
    }
    mainContent.innerHTML = html;

    document.getElementById('searchInput').addEventListener('input', function (ev) {
      searchQuery = ev.target.value;
      renderEventsTab();
      var el = document.getElementById('searchInput');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    Array.prototype.forEach.call(mainContent.querySelectorAll('#chipRow .chip'), function (chip) {
      chip.addEventListener('click', function () { activeCategory = chip.getAttribute('data-cat'); renderEventsTab(); });
    });
    bindTicketActions();
  }

  function ticketHtml(e) {
    var dp = fmtDateParts(e.date);
    var count = regsForEvent(e.id).length;
    var pct = Math.min(100, Math.round((count / e.capacity) * 100));
    var full = count >= e.capacity;
    var mine = isRegistered(e.id, user.email);
    var pastEvent = (e.date + 'T' + e.time) < new Date().toISOString().slice(0,16);

    var actionBtn;
    if (mine) {
      actionBtn = '<button class="btn secondary" data-action="cancel" data-id="' + e.id + '">Cancel registration</button>';
    } else if (full) {
      actionBtn = '<button class="btn" disabled>Full — no seats left</button>';
    } else if (pastEvent) {
      actionBtn = '<button class="btn secondary" disabled>Registration closed</button>';
    } else {
      actionBtn = '<button class="btn" data-action="register" data-id="' + e.id + '">Register</button>';
    }

    return (
      '<div class="ticket">' +
        '<div class="ticket-date"><div class="day">' + dp.day + '</div><div class="mon">' + dp.mon + '</div></div>' +
        '<div class="ticket-body">' +
          '<div class="row-top"><h3>' + esc(e.title) + '</h3><span class="tag">' + esc(e.category) + '</span></div>' +
          '<div class="meta-line">' +
            '<span>' + esc(fmtDateLong(e.date)) + ' · ' + esc(fmtTime(e.time)) + '</span>' +
            '<span>' + esc(e.venue) + '</span>' +
          '</div>' +
          '<p class="desc">' + esc(e.description) + '</p>' +
          '<div class="seats-row">' +
            '<div class="seat-bar"><div class="seat-bar-fill" style="width:' + pct + '%;"></div></div>' +
            '<span class="seat-text">' + count + ' / ' + e.capacity + ' seats filled' + (full ? ' — full' : '') + '</span>' +
          '</div>' +
          '<div class="actions-row">' + actionBtn + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function bindTicketActions() {
    Array.prototype.forEach.call(mainContent.querySelectorAll('[data-action="register"]'), function (btn) {
      btn.addEventListener('click', function () { registerFor(btn.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(mainContent.querySelectorAll('[data-action="cancel"]'), function (btn) {
      btn.addEventListener('click', function () { cancelFor(btn.getAttribute('data-id')); });
    });
  }

  function registerFor(eventId) {
    if (!user.name.trim() || !user.email.trim()) {
      setFlash('warn', 'Enter your name and email at the top of the page before registering.');
      render(); return;
    }
    var ev = events.find(function (e) { return e.id === eventId; });
    if (!ev) return;
    if (regsForEvent(eventId).length >= ev.capacity) { setFlash('error', 'That event just filled up.'); render(); return; }
    if (isRegistered(eventId, user.email)) { setFlash('warn', 'You are already registered for that event.'); render(); return; }
    regs.push({ id: uid(), eventId: eventId, name: user.name.trim(), email: user.email.trim(), time: new Date().toISOString() });
    safeSet(KEYS.regs, regs);
    setFlash('success', 'You are registered for "' + ev.title + '".');
    render();
  }

  function cancelFor(eventId) {
    var ev = events.find(function (e) { return e.id === eventId; });
    regs = regs.filter(function (r) { return !(r.eventId === eventId && r.email.toLowerCase() === user.email.toLowerCase()); });
    safeSet(KEYS.regs, regs);
    setFlash('success', 'Registration cancelled' + (ev ? ' for "' + ev.title + '".' : '.'));
    render();
  }

  /* ---------------- render: student / mine ---------------- */
  function renderMineTab() {
    var html = '';
    html += bannerHtml();
    if (!user.email.trim()) {
      html += '<div class="empty-state"><div class="display">No student identified yet</div>Enter your name and email at the top of the page to see your registrations.</div>';
      mainContent.innerHTML = html; return;
    }
    var mine = regs.filter(function (r) { return r.email.toLowerCase() === user.email.toLowerCase(); })
      .map(function (r) { return { reg: r, event: events.find(function (e) { return e.id === r.eventId; }) }; })
      .filter(function (x) { return x.event; })
      .sort(function (a, b) { return (a.event.date + a.event.time) < (b.event.date + b.event.time) ? -1 : 1; });

    if (mine.length === 0) {
      html += '<div class="empty-state"><div class="display">You haven\'t registered for anything yet</div>Browse the Events tab and grab a seat at something that looks good.</div>';
    } else {
      html += '<div class="ticket-list">';
      mine.forEach(function (x) { html += ticketHtml(x.event); });
      html += '</div>';
    }
    mainContent.innerHTML = html;
    bindTicketActions();
  }

  /* ---------------- render: admin dashboard ---------------- */
  function renderDashboardTab() {
    var totalEvents = events.length;
    var totalRegs = regs.length;
    var totalCapacity = events.reduce(function (s, e) { return s + e.capacity; }, 0);
    var fillPct = totalCapacity ? Math.round((totalRegs / totalCapacity) * 100) : 0;
    var now = new Date();
    var weekOut = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    var upcoming = events.filter(function (e) {
      var d = new Date(e.date + 'T' + e.time);
      return d >= now && d <= weekOut;
    }).length;

    var html = '';
    html += bannerHtml();
    html += '<div class="stat-grid">';
    html += statCard(totalEvents, 'Total events');
    html += statCard(totalRegs, 'Total registrations');
    html += statCard(fillPct + '%', 'Seats filled overall');
    html += statCard(upcoming, 'Events in next 7 days');
    html += '</div>';

    html += '<div class="cat-bars"><h3>Events by category</h3>';
    var maxCount = Math.max.apply(null, CATEGORIES.map(function (c) { return events.filter(function (e) { return e.category === c; }).length; }).concat([1]));
    CATEGORIES.forEach(function (c) {
      var count = events.filter(function (e) { return e.category === c; }).length;
      var pct = Math.round((count / maxCount) * 100);
      html += '<div class="cat-bar-row"><span class="cat-name">' + c + '</span><div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%;"></div></div><span class="cat-count">' + count + '</span></div>';
    });
    html += '</div>';

    if (events.length === 0) {
      html += '<div class="empty-state"><div class="display">No events yet</div>Head to Manage Events to add the first one.</div>';
    }

    mainContent.innerHTML = html;
  }
  function statCard(num, label) {
    return '<div class="stat-card"><div class="num">' + num + '</div><div class="label">' + esc(label) + '</div></div>';
  }

  /* ---------------- render: admin manage ---------------- */
  function renderManageTab() {
    var html = '';
    html += bannerHtml();
    html += '<div class="manage-row"><div style="color:var(--ink-soft); font-size:0.85rem;">' + events.length + ' event' + (events.length === 1 ? '' : 's') + ' on the calendar</div><button class="btn" id="btnAddEvent">Add event</button></div>';

    if (events.length === 0) {
      html += '<div class="empty-state"><div class="display">Nothing scheduled</div>Add your first event to get the portal started.</div>';
      mainContent.innerHTML = html;
      document.getElementById('btnAddEvent').addEventListener('click', function () { openEventModal(null); });
      return;
    }

    html += '<div class="table-scroll"><table class="admin-table"><thead><tr><th>Event</th><th>Date</th><th>Venue</th><th>Seats</th><th></th></tr></thead><tbody>';
    sortedEvents().forEach(function (e) {
      var count = regsForEvent(e.id).length;
      html += '<tr>' +
        '<td><strong>' + esc(e.title) + '</strong><br><span style="color:var(--ink-soft); font-size:0.78rem;">' + esc(e.category) + '</span></td>' +
        '<td>' + esc(fmtDateParts(e.date).mon) + ' ' + fmtDateParts(e.date).day + '<br><span style="color:var(--ink-soft); font-size:0.78rem;">' + esc(fmtTime(e.time)) + '</span></td>' +
        '<td>' + esc(e.venue) + '</td>' +
        '<td>' + count + ' / ' + e.capacity + '</td>' +
        '<td style="white-space:nowrap;"><button class="btn-text" data-edit="' + e.id + '">Edit</button> &nbsp; <button class="btn-text" style="color:var(--danger);" data-del="' + e.id + '">Delete</button></td>' +
      '</tr>';
    });
    html += '</tbody></table></div>';
    mainContent.innerHTML = html;

    document.getElementById('btnAddEvent').addEventListener('click', function () { openEventModal(null); });
    Array.prototype.forEach.call(mainContent.querySelectorAll('[data-edit]'), function (btn) {
      btn.addEventListener('click', function () { openEventModal(btn.getAttribute('data-edit')); });
    });
    Array.prototype.forEach.call(mainContent.querySelectorAll('[data-del]'), function (btn) {
      btn.addEventListener('click', function () { confirmDeleteEvent(btn.getAttribute('data-del')); });
    });
  }

  function confirmDeleteEvent(id) {
    var ev = events.find(function (e) { return e.id === id; });
    if (!ev) return;
    openConfirmModal(
      'Delete "' + ev.title + '"?',
      'This also removes ' + regsForEvent(id).length + ' registration(s) for this event. This can\'t be undone.',
      function () {
        events = events.filter(function (e) { return e.id !== id; });
        regs = regs.filter(function (r) { return r.eventId !== id; });
        safeSet(KEYS.events, events); safeSet(KEYS.regs, regs);
        closeModal();
        setFlash('success', 'Event deleted.');
        if (selectedRegistrantsEvent === id) selectedRegistrantsEvent = events[0] ? events[0].id : null;
        render();
      }
    );
  }

  function openEventModal(id) {
    var editing = id ? events.find(function (e) { return e.id === id; }) : null;
    var e = editing || { title: '', category: CATEGORIES[0], date: '', time: '18:00', venue: '', capacity: 50, description: '' };

    var html = '<div class="modal-veil" id="veil"><div class="modal">' +
      '<h2>' + (editing ? 'Edit event' : 'Add event') + '</h2>' +
      '<div class="sub">' + (editing ? 'Update the details students see.' : 'Fill in the details students will see on the Events tab.') + '</div>' +
      '<div class="field"><label for="f_title">Event title</label><input id="f_title" type="text" value="' + esc(e.title) + '" placeholder="e.g. Design Sprint 2026" /></div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="f_cat">Category</label><select id="f_cat">' + CATEGORIES.map(function (c) { return '<option value="' + c + '" ' + (e.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="f_cap">Capacity</label><input id="f_cap" type="number" min="1" value="' + esc(e.capacity) + '" /></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label for="f_date">Date</label><input id="f_date" type="date" value="' + esc(e.date) + '" /></div>' +
        '<div class="field"><label for="f_time">Time</label><input id="f_time" type="time" value="' + esc(e.time) + '" /></div>' +
      '</div>' +
      '<div class="field"><label for="f_venue">Venue</label><input id="f_venue" type="text" value="' + esc(e.venue) + '" placeholder="e.g. Seminar Hall A" /></div>' +
      '<div class="field"><label for="f_desc">Description</label><textarea id="f_desc" placeholder="What should students expect?">' + esc(e.description) + '</textarea></div>' +
      '<div id="f_error" class="banner error" style="display:none;"></div>' +
      '<div class="modal-actions"><button class="btn secondary" id="btnCancelModal">Cancel</button><button class="btn" id="btnSaveEvent">' + (editing ? 'Save changes' : 'Add event') + '</button></div>' +
      '</div></div>';
    modalRoot.innerHTML = html;

    document.getElementById('btnCancelModal').addEventListener('click', closeModal);
    document.getElementById('veil').addEventListener('click', function (ev2) { if (ev2.target.id === 'veil') closeModal(); });
    document.getElementById('btnSaveEvent').addEventListener('click', function () {
      var title = document.getElementById('f_title').value.trim();
      var category = document.getElementById('f_cat').value;
      var capacity = parseInt(document.getElementById('f_cap').value, 10);
      var date = document.getElementById('f_date').value;
      var time = document.getElementById('f_time').value;
      var venue = document.getElementById('f_venue').value.trim();
      var description = document.getElementById('f_desc').value.trim();
      var errBox = document.getElementById('f_error');

      if (!title || !date || !time || !venue || !capacity || capacity < 1) {
        errBox.style.display = 'block';
        errBox.textContent = 'Fill in the title, date, time, venue, and a capacity of at least 1 seat.';
        return;
      }
      if (editing) {
        var idx = events.findIndex(function (x) { return x.id === editing.id; });
        events[idx] = { id: editing.id, title: title, category: category, date: date, time: time, venue: venue, capacity: capacity, description: description };
        setFlash('success', 'Event updated.');
      } else {
        events.push({ id: uid(), title: title, category: category, date: date, time: time, venue: venue, capacity: capacity, description: description });
        setFlash('success', 'Event added.');
      }
      safeSet(KEYS.events, events);
      closeModal();
      render();
    });
  }

  function openConfirmModal(title, message, onConfirm) {
    modalRoot.innerHTML = '<div class="modal-veil" id="veil"><div class="modal">' +
      '<h2>' + esc(title) + '</h2><div class="sub">' + esc(message) + '</div>' +
      '<div class="modal-actions"><button class="btn secondary" id="btnCancelConfirm">Cancel</button><button class="btn danger" id="btnDoConfirm">Delete</button></div>' +
      '</div></div>';
    document.getElementById('btnCancelConfirm').addEventListener('click', closeModal);
    document.getElementById('veil').addEventListener('click', function (ev2) { if (ev2.target.id === 'veil') closeModal(); });
    document.getElementById('btnDoConfirm').addEventListener('click', onConfirm);
  }

  function closeModal() { modalRoot.innerHTML = ''; }

  /* ---------------- render: admin registrants ---------------- */
  function renderRegistrantsTab() {
    var html = '';
    html += bannerHtml();
    if (events.length === 0) {
      html += '<div class="empty-state"><div class="display">No events to show registrants for</div>Add an event first from Manage Events.</div>';
      mainContent.innerHTML = html; return;
    }
    if (!selectedRegistrantsEvent || !events.some(function (e) { return e.id === selectedRegistrantsEvent; })) {
      selectedRegistrantsEvent = events[0].id;
    }
    html += '<div class="field" style="max-width:420px; margin-bottom:20px;"><label for="regSelect">Event</label><select class="reg-select" id="regSelect">';
    sortedEvents().forEach(function (e) {
      html += '<option value="' + e.id + '" ' + (e.id === selectedRegistrantsEvent ? 'selected' : '') + '>' + esc(e.title) + ' — ' + esc(fmtDateParts(e.date).mon) + ' ' + fmtDateParts(e.date).day + '</option>';
    });
    html += '</select></div>';

    var list = regsForEvent(selectedRegistrantsEvent).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    var ev = events.find(function (e) { return e.id === selectedRegistrantsEvent; });

    html += '<div style="margin-bottom:12px; font-size:0.85rem; color:var(--ink-soft);">' + list.length + ' / ' + (ev ? ev.capacity : '—') + ' seats taken</div>';

    if (list.length === 0) {
      html += '<div class="empty-state"><div class="display">No one has registered yet</div>Registrations will appear here as students sign up.</div>';
    } else {
      html += '<div class="table-scroll"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th></th></tr></thead><tbody>';
      list.forEach(function (r) {
        var dt = new Date(r.time);
        html += '<tr><td>' + esc(r.name) + '</td><td>' + esc(r.email) + '</td><td>' + esc(dt.toLocaleDateString()) + '</td><td><button class="btn-text" style="color:var(--danger);" data-remove="' + r.id + '">Remove</button></td></tr>';
      });
      html += '</tbody></table></div>';
    }

    mainContent.innerHTML = html;
    document.getElementById('regSelect').addEventListener('change', function (ev2) { selectedRegistrantsEvent = ev2.target.value; renderRegistrantsTab(); });
    Array.prototype.forEach.call(mainContent.querySelectorAll('[data-remove]'), function (btn) {
      btn.addEventListener('click', function () {
        regs = regs.filter(function (r) { return r.id !== btn.getAttribute('data-remove'); });
        safeSet(KEYS.regs, regs);
        setFlash('success', 'Registrant removed.');
        render();
      });
    });
  }

  /* ---------------- admin login ---------------- */
  function promptAdminLogin() {
    modalRoot.innerHTML = '<div class="modal-veil" id="veil"><div class="modal">' +
      '<h2>Admin sign-in</h2><div class="sub">Demo password: <strong>admin123</strong> — for real use this would be a proper login.</div>' +
      '<div class="field"><label for="adminPass">Password</label><input id="adminPass" type="password" placeholder="Enter admin password" /></div>' +
      '<div id="loginError" class="banner error" style="display:none;">That password isn\'t right. Try again.</div>' +
      '<div class="modal-actions"><button class="btn secondary" id="btnCancelLogin">Cancel</button><button class="btn" id="btnDoLogin">Sign in</button></div>' +
      '</div></div>';
    var input = document.getElementById('adminPass');
    input.focus();
    document.getElementById('btnCancelLogin').addEventListener('click', closeModal);
    document.getElementById('veil').addEventListener('click', function (ev2) { if (ev2.target.id === 'veil') closeModal(); });
    function tryLogin() {
      if (input.value === 'admin123') {
        role = 'admin'; adminTab = 'dashboard'; closeModal(); render();
      } else {
        document.getElementById('loginError').style.display = 'block';
      }
    }
    document.getElementById('btnDoLogin').addEventListener('click', tryLogin);
    input.addEventListener('keydown', function (ev2) { if (ev2.key === 'Enter') tryLogin(); });
  }

  /* ---------------- top bar bindings ---------------- */
  function bindTopBar() {
    var nameInput = document.getElementById('userName');
    var emailInput = document.getElementById('userEmail');
    nameInput.value = user.name; emailInput.value = user.email;
    nameInput.addEventListener('change', function () { user.name = nameInput.value; safeSet(KEYS.user, user); });
    emailInput.addEventListener('change', function () { user.email = emailInput.value; safeSet(KEYS.user, user); });

    document.getElementById('btnRoleStudent').addEventListener('click', function () {
      role = 'student'; studentTab = 'events'; syncRoleButtons(); render();
    });
    document.getElementById('btnRoleAdmin').addEventListener('click', function () {
      if (role === 'admin') return;
      promptAdminLogin();
    });
    syncRoleButtons();
  }
  function syncRoleButtons() {
    document.getElementById('btnRoleStudent').classList.toggle('active', role === 'student');
    document.getElementById('btnRoleAdmin').classList.toggle('active', role === 'admin');
    document.getElementById('btnRoleAdmin').textContent = role === 'admin' ? 'Admin ✓' : 'Admin';
  }

  /* ---------------- main render ---------------- */
  function render() {
    renderTabs();
    if (role === 'student') {
      if (studentTab === 'events') renderEventsTab(); else renderMineTab();
    } else {
      if (adminTab === 'dashboard') renderDashboardTab();
      else if (adminTab === 'manage') renderManageTab();
      else renderRegistrantsTab();
    }
    flash = null;
  }

  bindTopBar();
  render();
})();
