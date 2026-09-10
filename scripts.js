(function () {
  "use strict";
  var SPACES = [
    { id: "hub-desk-central",   name: "Hub Desk Central",   type: "Desk",    floor: 3,    rating: 4.2, avail: "high",   seats: 1,  photos: 3, reviews: 38 },
    { id: "quiet-focus-pod",    name: "Quiet Focus Pod",    type: "Room",    floor: 5,    rating: 4.8, avail: "low",    seats: 2,  photos: 6, reviews: 61 },
    { id: "creators-studio",    name: "Creators Studio",    type: "Studio",  floor: 2,    rating: 4.6, avail: "medium", seats: 4,  photos: 6, reviews: 47 },
    { id: "meeting-room-24",    name: "Meeting Room 24",    type: "Room",    floor: 7,    rating: 3.9, avail: "high",   seats: 6,  photos: 5, reviews: 29 },
    { id: "zen-desk-space",     name: "Zen Desk Space",     type: "Desk",    floor: 3,    rating: 4.0, avail: "high",   seats: 1,  photos: 3, reviews: 22 },
    { id: "executive-boardroom",name: "Executive Boardroom",type: "Room",    floor: 10,   rating: 4.9, avail: "low",    seats: 10, photos: 6, reviews: 54 },
    { id: "studio-light-pro",   name: "Studio Light Pro",   type: "Studio",  floor: 7,    rating: 4.3, avail: "medium", seats: 3,  photos: 6, reviews: 33 },
    { id: "city-shuttle-mini",  name: "City Shuttle Mini",  type: "Minibus", floor: null, rating: 4.5, avail: "high",   seats: 8,  photos: 4, reviews: 40 }
  ];

  var RATE = 18; 
  var DURATIONS = { "30m": 0.5, "1 hr": 1, "2 hr": 2, "Half day": 4 };

  var AVAIL_SCORE = { high: 1, medium: 0.6, low: 0.25 };
  var AVAIL_WORD  = { high: "high", medium: "medium", low: "low" };
  var AVAIL_SHORT = { high: "free now", medium: "limited", low: "rarely free" };
  var NEXT_SLOT   = { high: "now", medium: "13:00", low: "14:00" };

  var TAGS = {
    Room:    ["Soundproof", "Monitor", "Whiteboard"],
    Desk:    ["Monitor", "Sit-stand", "Locker"],
    Studio:  ["Lighting rig", "Backdrop", "Speakers"],
    Minibus: ["Seats 8", "Aircon", "Driver incl."]
  };
  var ALERT = {
    low: "Low availability — usually booked by 10am",
    medium: "Fills up through the afternoon",
    high: ""
  };

  /* running state for the journey */
  var state = { needs: null, selected: "quiet-focus-pod" };

  /* ---------- small helpers ---------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function money(n) { return "$" + n.toFixed(2); }
  function spaceById(id) {
    for (var i = 0; i < SPACES.length; i++) if (SPACES[i].id === id) return SPACES[i];
    return SPACES[1]; 
  }
  function selectedSpace() { return spaceById(state.selected); }
  function floorLabel(sp) { return sp.floor == null ? "No fixed floor" : "Floor " + sp.floor; }
  function floorShort(sp) { return sp.floor == null ? "no floor" : "F" + sp.floor; }
  function whenDateLabel() {
    return state.needs && state.needs.when === "Another day" ? "Tue 9 Sep" : "Today";
  }
  function modeFromWhen(when) {
    if (when === "Later today") return "pm";
    if (when === "Another day") return "pick";
    return "now";
  }
  function currentMode() { return modeFromWhen(state.needs && state.needs.when); }

  /* ---------- read the needs form ---------- */
  var form = document.getElementById("screen-form");
  function readNeeds() {
    var type = "Room", when = "Now", count = 2;
    if (form) {
      var t = form.querySelector('[data-chipgroup="type"] .chip.is-active');
      var w = form.querySelector('[data-chipgroup="when"] .chip.is-active');
      var c = form.querySelector("[data-step-value]");
      if (t) type = t.textContent.trim();
      if (w) when = w.textContent.trim();
      if (c) count = parseInt(c.textContent.trim(), 10) || 1;
    }
    return { type: type, when: when, count: count };
  }

  /* spaces that clear the hard filters: right type, enough seats */
  function poolFor(needs) {
    return SPACES.filter(function (sp) {
      return sp.type === needs.type && sp.seats >= needs.count;
    });
  }

  /* ---------- navigation ---------- */
  function goTo(id) {
    var target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll(".phone.is-active").forEach(function (screen) {
      screen.classList.remove("is-active");
    });
    target.classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "auto" });

    if (id === "screen-matches") { state.needs = readNeeds(); renderMatches(); }
    else if (id === "screen-detail") renderDetail();
    else if (id === "screen-signin") renderSignin();
    else if (id === "screen-confirm") renderConfirm();
    else if (id === "screen-booked") renderBooked();
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-goto]");
    if (!trigger) return;
    e.preventDefault();
    var id = trigger.getAttribute("data-id");
    if (id) state.selected = id;
    goTo(trigger.getAttribute("data-goto"));
  });

  var authed = false;
  var welcome = document.getElementById("screen-welcome");
  if (welcome) {
    welcome.querySelectorAll(".stack-actions .btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        authed = btn.getAttribute("data-goto") === "screen-form";
      });
    });
  }

  document.addEventListener(
    "click",
    function (e) {
      if (!authed) return;
      var trigger = e.target.closest('[data-goto="screen-signin"]');
      if (!trigger) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      // forward from the detail screen jumps straight to confirm;
      // back from the confirm screen returns to the detail screen
      goTo(trigger.closest("#screen-confirm") ? "screen-detail" : "screen-confirm");
    },
    true
  );

  /* ---------- chip groups (single select) ---------- */
  document.querySelectorAll("[data-chipgroup]").forEach(function (group) {
    group.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip || !group.contains(chip)) return;
      group.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
    });
  });

  /* ---------- people stepper ---------- */
  document.querySelectorAll("[data-stepper]").forEach(function (stepper) {
    var valueEl = stepper.querySelector("[data-step-value]");
    var min = 1, max = 20;
    stepper.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-step]");
      if (!btn) return;
      var next = parseInt(valueEl.textContent, 10) + parseInt(btn.dataset.step, 10);
      valueEl.textContent = Math.max(min, Math.min(max, next));
    });
  });

  /* ---------- needs form: live match count ---------- */
  var formCountLabel = form && form.querySelector(".push-down .caption");
  function refreshFormCount() {
    if (!formCountLabel) return;
    var n = poolFor(readNeeds()).length;
    formCountLabel.textContent =
      SPACES.length + " spaces → " + n + " match" + (n === 1 ? "" : "es");
  }
  if (form) {
    form.addEventListener("click", function (e) {
      if (e.target.closest(".chip") || e.target.closest("[data-step]")) refreshFormCount();
    });
    refreshFormCount();
  }

  var matchListEl = document.querySelector("[data-match-list]");
  var matchTitleEl = document.querySelector('#screen-matches [data-bind="matches-title"]');
  var matchesMetaEl = document.querySelector("#screen-matches .topbar__meta");

  function renderMatches() {
    var needs = state.needs || readNeeds();
    var mode = modeFromWhen(needs.when);
    var isNow = mode === "now";
    var isPM = mode === "pm";

    if (matchesMetaEl) {
      matchesMetaEl.textContent =
        needs.type + " · " + needs.count + " · " + needs.when.toLowerCase();
    }

    var pool = poolFor(needs).slice();
    var wRating = isNow ? 0.35 : 0.82;
    pool.forEach(function (sp) {
      sp._score = wRating * (sp.rating / 5) + (1 - wRating) * AVAIL_SCORE[sp.avail];
    });
    pool.sort(function (a, b) { return b._score - a._score || b.rating - a.rating; });

    var top = pool.slice(0, 3);

    if (!top.length) {
      matchTitleEl.textContent = "No exact matches";
      matchListEl.innerHTML =
        '<p class="meta meta--strong">Nothing fits ' +
        needs.count + " " +
        (needs.count === 1 ? "person" : "people") + " in a " +
        needs.type.toLowerCase() +
        ". Try another space type, or browse everything below.</p>";
      return;
    }

    // a card is a "stretch" only if it is badly oversized AND a tighter fit exists
    var hasTightFit = top.some(function (sp) { return sp.seats <= needs.count * 3; });
    top.forEach(function (sp) {
      sp._stretch = hasTightFit && sp.seats > needs.count * 3;
    });
    var ratings = top.filter(function (s) { return !s._stretch; }).map(function (s) { return s.rating; });
    var maxRating = ratings.length ? Math.max.apply(null, ratings) : 0;
    var minRating = Math.min.apply(null, top.map(function (s) { return s.rating; }));
    // push stretch options to the bottom, keep score order otherwise
    top.sort(function (a, b) { return (a._stretch ? 1 : 0) - (b._stretch ? 1 : 0); });

    matchTitleEl.textContent = "Your " + top.length + " best fit" + (top.length === 1 ? "" : "s");

    matchListEl.innerHTML = top.map(function (sp) {
      var pillClass, pillText, line, cta = "";
      var lowRated = sp.rating === minRating;

      if (sp._stretch) {
        pillClass = "pill--neutral"; pillText = "Stretch";
        line = "Seats " + sp.seats + " — more room than you need";

      } else if (sp.rating === maxRating) {
        pillClass = "pill--accent"; pillText = "Best rated";
        if (isNow && sp.avail !== "high") {
          line = "Not free now — next slot " + NEXT_SLOT[sp.avail];
          cta =
            '<button class="btn btn--outline btn--sm" data-goto="screen-detail" data-id="' +
            sp.id + '">Hold ' + NEXT_SLOT[sp.avail] + "</button>";
        } else if (isNow) {
          line = "Top rated and free now";
        } else if (isPM) {
          line = sp.avail === "low"
            ? "Top rated — grab an afternoon slot before they go"
            : "Top rated — afternoon slots open";
        } else {
          line = "Top rated — book any slot that day";
        }

      } else if (sp.avail === "high") {
        pillClass = "pill--dark";
        pillText = isNow ? "Free now" : isPM ? "Open all PM" : "Always open";
        if (isNow) {
          line = lowRated ? "Lower rated, but yours in ~2 min" : "Free right now";
        } else if (isPM) {
          line = lowRated ? "Lower rated, but free all afternoon" : "Free all afternoon";
        } else {
          line = lowRated ? "Lower rated, but open whenever you pick" : "Open whenever you pick";
        }

      } else {
        pillClass = "pill--neutral"; pillText = "Good fit";
        line = isNow ? AVAIL_WORD[sp.avail] + " availability"
             : isPM ? "Limited afternoon slots"
             : "Books up, but you're planning ahead";
      }

      return (
        '<article class="match-card' + (sp._stretch ? " match-card--muted" : "") +
          '" data-goto="screen-detail" data-id="' + sp.id + '">' +
          '<div class="match-card__head">' +
            '<span class="pill ' + pillClass + '">' + pillText + "</span>" +
            '<span class="rating">' + sp.rating.toFixed(1) + " ★</span>" +
          "</div>" +
          "<h4>" + sp.name + "</h4>" +
          '<p class="meta">' + sp.type + " · seats " + sp.seats + " · " +
            AVAIL_WORD[sp.avail] + " availability</p>" +
          '<p class="meta meta--strong">' + line + "</p>" +
          cta +
        "</article>"
      );
    }).join("");
  }

  var listing = document.getElementById("screen-listing");
  if (listing) {
    var listEl = listing.querySelector("[data-space-list]");
    var moreBtn = listing.querySelector("[data-more]");
    var sortLabel = listing.querySelector(".sort-label");
    var filterGroup = listing.querySelector('[data-chipgroup="filter"]');
    var COLLAPSED = 5;
    var expanded = false;

    listEl.innerHTML = SPACES.map(function (sp) {
      return (
        '<button class="space-row" data-goto="screen-detail" data-id="' + sp.id + '"' +
          ' data-rating="' + sp.rating + '" data-avail="' + sp.avail + '"' +
          ' data-seats="' + sp.seats + '">' +
          '<div class="space-row__top"><h4>' + sp.name + "</h4>" +
          '<span class="rating">' + sp.rating.toFixed(1) + " ★</span></div>" +
          '<p class="meta">' + sp.type + " · " + floorShort(sp) + " · seats " +
            sp.seats + " · " + AVAIL_SHORT[sp.avail] + "</p>" +
        "</button>"
      );
    }).join("");

    var rows = Array.prototype.slice.call(listEl.querySelectorAll(".space-row"));

    function activeFilter() {
      var chip = filterGroup.querySelector(".chip.is-active");
      return chip ? chip.textContent.trim() : "All 8";
    }
    function rowMatches(row, filter) {
      var rating = parseFloat(row.dataset.rating);
      var seats = parseInt(row.dataset.seats, 10);
      if (filter === "Free now") return row.dataset.avail === "high";
      if (filter === "4.5+ ★") return rating >= 4.5;
      if (filter === "Seats 4+") return seats >= 4;
      return true;
    }
    function render() {
      var filter = activeFilter();
      var pool = rows.filter(function (row) { return rowMatches(row, filter); });
      var collapse = filter === "All 8" && !expanded;

      rows.forEach(function (row) {
        var idx = pool.indexOf(row);
        row.hidden = idx === -1 || (collapse && idx >= COLLAPSED);
      });

      var total = pool.length;
      sortLabel.textContent =
        "Sort: best match ▾ · " + total + " result" + (total === 1 ? "" : "s");

      var hiddenInPool = collapse ? Math.max(0, total - COLLAPSED) : 0;
      if (hiddenInPool > 0) {
        moreBtn.hidden = false;
        moreBtn.textContent = "+ " + hiddenInPool + " more";
      } else if (filter === "All 8" && expanded && total > COLLAPSED) {
        moreBtn.hidden = false;
        moreBtn.textContent = "Show fewer";
      } else {
        moreBtn.hidden = true;
      }
    }

    moreBtn.addEventListener("click", function () { expanded = !expanded; render(); });
    filterGroup.addEventListener("click", function (e) {
      if (!e.target.closest(".chip")) return;
      expanded = false;
      render();
    });
    render();
  }

  var detail = document.getElementById("screen-detail");
  var hoursEl = document.querySelector("[data-hours]");
  var priceEl = document.querySelector(".checkout-bar__price");
  var durationGroup = document.querySelector('[data-chipgroup="duration"]');

  function currentSlot() {
    var active = hoursEl && hoursEl.querySelector(".hour.is-active");
    var start = active ? parseInt(active.textContent, 10) : 10;

    var durLabel = "1 hr";
    if (durationGroup) {
      var activeDur = durationGroup.querySelector(".chip.is-active");
      if (activeDur) durLabel = activeDur.textContent.trim();
    }
    var hrs = DURATIONS[durLabel] || 1;
    var endMinutes = start * 60 + hrs * 60;
    var endH = Math.floor(endMinutes / 60) % 24;
    var endM = endMinutes % 60;

    return {
      start: start,
      hrs: hrs,
      durLabel: durLabel,
      startText: pad(start) + ":00",
      endText: pad(endH) + ":" + pad(endM),
      cost: Math.round(RATE * hrs * 100) / 100
    };
  }

  function refreshSummary() {
    if (!hoursEl || !priceEl) return;
    if (!hoursEl.querySelector(".hour.is-active")) return;
    var s = currentSlot();
    var costText = Number.isInteger(s.cost) ? "$" + s.cost : money(s.cost);
    priceEl.textContent = costText + " · " + s.startText + "–" + s.endText;
  }

  function buildHours(sp, mode) {
    var HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
    var from, to;

    if (mode === "pick") {
      from = 9; to = 16;
    } else {
      from = { high: 9, medium: 13, low: 14 }[sp.avail];
      to   = { high: 16, medium: 16, low: 15 }[sp.avail];
      if (mode === "pm") from = Math.max(from, 12);
    }
    if (from > to) from = to;
    var active = mode === "pick" ? 10 : from;

    hoursEl.innerHTML = HOURS.map(function (h) {
      var off = h < from || h > to;
      var cls = "hour" + (off ? " is-off" : "") + (!off && h === active ? " is-active" : "");
      return '<button class="' + cls + '"' + (off ? " disabled" : "") + ">" + pad(h) + "</button>";
    }).join("");
  }

  function renderDetail() {
    if (!detail) return;
    var sp = selectedSpace();
    var mode = currentMode();
    var q = function (sel) { return detail.querySelector(sel); };

    q('[data-bind="photo"]').textContent = "Space photo · 1 of " + sp.photos;
    q('[data-bind="name"]').textContent = sp.name;
    q('[data-bind="rating"]').innerHTML =
      sp.rating.toFixed(1) + " ★ <span>(" + sp.reviews + ")</span>";
    q('[data-bind="meta"]').textContent =
      sp.type + " · " + floorLabel(sp) + " · seats " + sp.seats + " · $" + RATE + "/hr";
    q('[data-bind="tags"]').innerHTML = TAGS[sp.type]
      .map(function (t) { return '<span class="tag">' + t + "</span>"; })
      .join("");

    q('[data-bind="avail-heading"]').textContent =
      mode === "pick" ? "Availability that day"
      : mode === "pm" ? "Availability this afternoon"
      : "Availability today";

    buildHours(sp, mode);

    var alertEl = q('[data-bind="alert"]');
    var msg;
    if (mode === "pick") {
      msg = sp.avail === "low" ? "Popular — reserve your date early" : "";
    } else if (mode === "pm") {
      msg = sp.avail === "low" ? "Only late-afternoon slots left today"
          : sp.avail === "medium" ? "Afternoon fills up fast" : "";
    } else {
      msg = ALERT[sp.avail];
    }
    alertEl.textContent = msg;
    alertEl.hidden = !msg;

    refreshSummary();
  }

  if (hoursEl) {
    hoursEl.addEventListener("click", function (e) {
      var hour = e.target.closest(".hour");
      if (!hour || hour.disabled) return;
      hoursEl.querySelectorAll(".hour").forEach(function (h) {
        h.classList.toggle("is-active", h === hour);
      });
      refreshSummary();
    });
  }
  if (durationGroup) durationGroup.addEventListener("click", refreshSummary);

  function renderSignin() {
    var el = document.querySelector('#screen-signin [data-bind="held"]');
    if (!el) return;
    var sp = selectedSpace();
    el.textContent = sp.name + " · " + whenDateLabel() + " " + currentSlot().startText;
  }

  function renderConfirm() {
    var scr = document.getElementById("screen-confirm");
    if (!scr) return;
    var sp = selectedSpace();
    var s = currentSlot();
    var q = function (sel) { return scr.querySelector(sel); };

    q('[data-bind="name"]').textContent = sp.name;
    q('[data-bind="meta"]').textContent = floorLabel(sp) + " · seats " + sp.seats;
    q('[data-bind="datetime"]').textContent =
      whenDateLabel() + ", " + s.startText + "–" + s.endText;

    var line = RATE * s.hrs;
    var total = line + 1.5;
    q('[data-bind="bill"]').innerHTML =
      '<div class="bill__row"><span>' + s.durLabel + " × $" + RATE +
        "</span><span>" + money(line) + "</span></div>" +
      '<div class="bill__row"><span>Service fee</span><span>$1.50</span></div>' +
      '<div class="bill__row bill__row--total"><span>Total</span><span>' +
        money(total) + "</span></div>";

    q('[data-bind="cancel"]').textContent = "Free cancellation until " + s.startText;
    q('[data-bind="paybtn"]').textContent = "Confirm & pay " + money(total);
  }

  function renderBooked() {
    var scr = document.getElementById("screen-booked");
    if (!scr) return;
    var sp = selectedSpace();
    var s = currentSlot();
    scr.querySelector('[data-bind="space"]').textContent = sp.name + " · " + floorLabel(sp);
    scr.querySelector('[data-bind="datetime"]').textContent =
      whenDateLabel() + ", " + s.startText + "–" + s.endText;
  }

  /* first paint so a direct jump to the detail screen still looks right */
  renderDetail();
})();
