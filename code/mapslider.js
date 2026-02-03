(function () {
  function uid() {
    return "s" + Math.random().toString(36).slice(2);
  }
  function assignUID(el, attr) {
    if (!el.getAttribute(attr)) el.setAttribute(attr, uid());
    return el.getAttribute(attr);
  }
  function injectOnce(key, css) {
    if (document.head.querySelector('[data-rt-injected="' + key + '"]')) return;
    const s = document.createElement("style");
    s.setAttribute("data-rt-injected", key);
    s.textContent = css;
    document.head.appendChild(s);
  }
  function toSel(v) {
    return typeof v === "string" ? v.trim() : "";
  }
  function getConf(root) {
    return {
      list: toSel(root.getAttribute("data-rt-list")),
      item: toSel(root.getAttribute("data-rt-item")),
      spacer: toSel(root.getAttribute("data-rt-spacer")),
      btnPrev: toSel(root.getAttribute("data-rt-btn-prev")),
      btnNext: toSel(root.getAttribute("data-rt-btn-next")),
      scrollTrack: toSel(root.getAttribute("data-rt-scroll-track")),
      scrollBar: toSel(root.getAttribute("data-rt-scroll-bar")),
      marginRef: toSel(root.getAttribute("data-rt-margin-ref")),
      card: toSel(root.getAttribute("data-rt-card")),
    };
  }
  function findScrollableAncestor(el) {
    let n = el;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      const ox = cs.overflowX;
      const scrollable = ox === "auto" || ox === "scroll" || ox === "overlay";
      if (scrollable && n.scrollWidth > n.clientWidth) return n;
      n = n.parentElement;
    }
    return el;
  }

  function Slider(root) {
    this.root = root;
    this.conf = getConf(root);
    this.valid = !!(this.conf.list && this.conf.item);
    if (!this.valid) return;
    this.list = this.root.querySelector(this.conf.list);
    if (!this.list) {
      this.valid = false;
      return;
    }
    this.scroller = findScrollableAncestor(this.list);
    this.btnPrev = this.conf.btnPrev
      ? this.root.querySelector(this.conf.btnPrev)
      : null;
    this.btnNext = this.conf.btnNext
      ? this.root.querySelector(this.conf.btnNext)
      : null;
    this.scrollTrack = this.conf.scrollTrack
      ? this.root.querySelector(this.conf.scrollTrack)
      : null;
    this.scrollBar = this.conf.scrollBar
      ? this.root.querySelector(this.conf.scrollBar)
      : null;
    this.firstItem = this.list.querySelector(`${this.conf.item}:first-child`);
    this.lastItem = this.list.querySelector(`${this.conf.item}:last-child`);
    this.dragging = false;
    this.maybeDrag = false;
    this.startX = 0;
    this.startScroll = 0;
    this.lastX = 0;
    this.lastT = 0;
    this.velocity = 0;
    this.inertiaId = 0;
    this.ticking = false;
    this.didDrag = false;
    this.hoverBindings = [];
    this.cursorBindings = [];
    this.imgHandlers = [];
    this.mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    this.ro =
      "ResizeObserver" in window
        ? new ResizeObserver(() => {
            this.rafUpdate();
            this.setupHover();
            this.setupCursorMode(); // keep cursor logic in sync on size changes
          })
        : null;
    this.init();
  }

  Slider.prototype.devicePixelEpsilon = function () {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    return 1 / dpr;
  };
  Slider.prototype.listGap = function () {
    const cs = getComputedStyle(this.list);
    const g1 = parseFloat(cs.columnGap || "0") || 0;
    const g2 = parseFloat(cs.gap || "0") || 0;
    return Math.max(g1, g2);
  };
  Slider.prototype.pickVisibleMarginRef = function () {
    if (!this.conf.marginRef) return null;
    const nodes = document.querySelectorAll(this.conf.marginRef);
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const visible =
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        el.getClientRects().length > 0;
      if (visible) return el;
    }
    return null;
  };
  Slider.prototype.isFlex = function () {
    const d = getComputedStyle(this.list).display;
    return d.includes("flex");
  };
  Slider.prototype.isGrid = function () {
    const d = getComputedStyle(this.list).display;
    return d.includes("grid");
  };
  Slider.prototype.ensureSpacers = function () {
    const kids = Array.from(this.list.children);
    const className = this.conf.spacer
      ? this.conf.spacer.replace(/^[.#]/, "")
      : "awards-slider-spacer";
    const needStart = !(
      kids[0] &&
      kids[0].classList &&
      kids[0].classList.contains(className)
    );
    const needEnd = !(
      kids[kids.length - 1] &&
      kids[kids.length - 1].classList &&
      kids[kids.length - 1].classList.contains(className)
    );
    if (needStart) {
      const el = document.createElement("div");
      el.className = className;
      el.setAttribute("aria-hidden", "true");
      el.style.pointerEvents = "none";
      el.style.height = "1px";
      el.style.minHeight = "1px";
      if (this.isFlex()) el.style.flex = "0 0 auto";
      this.list.insertBefore(el, this.list.firstChild);
    }
    if (needEnd) {
      const el = document.createElement("div");
      el.className = className;
      el.setAttribute("aria-hidden", "true");
      el.style.pointerEvents = "none";
      el.style.height = "1px";
      el.style.minHeight = "1px";
      if (this.isFlex()) el.style.flex = "0 0 auto";
      this.list.appendChild(el);
    }
  };
  Slider.prototype.resetEdgeItemMargins = function () {
    if (this.firstItem) this.firstItem.style.marginLeft = "0px";
    if (this.lastItem) this.lastItem.style.marginRight = "0px";
  };
  Slider.prototype.updateSpacers = function () {
    this.ensureSpacers();
    this.resetEdgeItemMargins();
    const kids = Array.from(this.list.children);
    const cls = this.conf.spacer
      ? this.conf.spacer.replace(/^[.#]/, "")
      : "awards-slider-spacer";
    const spacerStart =
      kids[0] && kids[0].classList.contains(cls) ? kids[0] : null;
    const spacerEnd =
      kids[kids.length - 1] && kids[kids.length - 1].classList.contains(cls)
        ? kids[kids.length - 1]
        : null;
    if (!spacerStart || !spacerEnd) return;
    const marginRef = this.pickVisibleMarginRef();
    if (!marginRef) {
      const eps0 = this.devicePixelEpsilon();
      spacerStart.style.width = eps0 + "px";
      spacerEnd.style.width = eps0 + "px";
      return;
    }
    const sRect = this.scroller.getBoundingClientRect();
    const rRect = marginRef.getBoundingClientRect();
    const rawLeft = rRect.left - sRect.left;
    const gap = this.listGap();
    const gutter = Math.max(0, Math.round(rawLeft - gap));
    const eps = this.devicePixelEpsilon();
    const width = gutter === 0 ? eps : gutter;
    spacerStart.style.width = width + "px";
    spacerEnd.style.width = width + "px";
    if (this.isGrid()) {
      spacerStart.style.justifySelf = "start";
      spacerEnd.style.justifySelf = "start";
      spacerStart.style.gridColumn = "auto";
      spacerEnd.style.gridColumn = "auto";
    }
  };
  Slider.prototype.maxScroll = function () {
    return Math.max(0, this.scroller.scrollWidth - this.scroller.clientWidth);
  };
  Slider.prototype.updateButtons = function () {
    if (!this.btnPrev && !this.btnNext) return;
    const total = this.scroller.scrollWidth;
    const visible = this.scroller.clientWidth;
    const scrollable = total > visible + 1;
    if (!scrollable) {
      if (this.btnPrev) {
        this.btnPrev.style.opacity = "0";
        this.btnPrev.style.visibility = "hidden";
      }
      if (this.btnNext) {
        this.btnNext.style.opacity = "0";
        this.btnNext.style.visibility = "hidden";
      }
      return;
    }
    const m = this.maxScroll();
    const atStart = this.scroller.scrollLeft <= 1;
    const atEnd = this.scroller.scrollLeft >= m - 1;
    if (this.btnPrev) {
      this.btnPrev.style.opacity = atStart ? "0" : "1";
      this.btnPrev.style.visibility = atStart ? "hidden" : "visible";
    }
    if (this.btnNext) {
      this.btnNext.style.opacity = atEnd ? "0" : "1";
      this.btnNext.style.visibility = atEnd ? "hidden" : "visible";
    }
  };
  Slider.prototype.updateScrollbar = function () {
    if (!this.scrollTrack || !this.scrollBar) return;
    const total = this.scroller.scrollWidth;
    const visible = this.scroller.clientWidth;
    const items = this.list.querySelectorAll(this.conf.item).length;
    if (total <= visible || items === 0) {
      this.scrollTrack.style.display = "none";
      return;
    }
    this.scrollTrack.style.display = "";
    const trackWidth = this.scrollTrack.clientWidth;
    const avgItemWidth = total / Math.max(1, items + 2);
    const visibleItems = Math.max(1, Math.round(visible / avgItemWidth));
    const barWidth = Math.max(8, (visibleItems / (items + 2)) * trackWidth);
    const maxS = Math.max(1, total - visible);
    const maxX = Math.max(0, trackWidth - barWidth);
    const progress = Math.min(1, Math.max(0, this.scroller.scrollLeft / maxS));
    const x = maxX * progress;
    this.scrollBar.style.width = `${barWidth}px`;
    this.scrollBar.style.transform = `translateX(${x}px)`;
  };
  Slider.prototype.rafUpdate = function () {
    this.updateSpacers();
    this.updateScrollbar();
    this.updateButtons();
  };
  Slider.prototype.onScroll = function () {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      const clamped = Math.min(
        Math.max(this.scroller.scrollLeft, 0),
        this.maxScroll()
      );
      if (clamped !== this.scroller.scrollLeft)
        this.scroller.scrollLeft = clamped;
      this.updateScrollbar();
      this.updateButtons();
      this.ticking = false;
    });
  };
  Slider.prototype.itemStepWidth = function () {
    const item = this.list.querySelector(this.conf.item);
    if (!item) return Math.max(1, Math.floor(this.scroller.clientWidth * 0.9));
    const cs = getComputedStyle(item);
    const w = item.getBoundingClientRect().width;
    const mr = parseFloat(cs.marginRight) || 0;
    return Math.max(1, Math.round(w + mr));
  };
  Slider.prototype.scrollByItems = function (n) {
    const step = this.itemStepWidth();
    const target =
      n > 0
        ? this.scroller.scrollLeft + step * n
        : this.scroller.scrollLeft - step * Math.abs(n);
    const clamped = Math.min(Math.max(target, 0), this.maxScroll());
    this.scroller.scrollTo({ left: clamped, behavior: "smooth" });
  };
  Slider.prototype.onPrevClick = function (e) {
    e.preventDefault();
    this.scrollByItems(-1);
  };
  Slider.prototype.onNextClick = function (e) {
    e.preventDefault();
    this.scrollByItems(1);
  };
  Slider.prototype.stopInertia = function () {
    if (this.inertiaId) {
      cancelAnimationFrame(this.inertiaId);
      this.inertiaId = 0;
    }
  };
  Slider.prototype.clampScrollLeft = function (x) {
    return Math.min(Math.max(x, 0), this.maxScroll());
  };
  Slider.prototype.startDrag = function (e) {
    if (this.dragging) return;
    this.dragging = true;
    this.didDrag = true;
    this.scroller.setPointerCapture(e.pointerId);
    this.scroller.classList.add("is-dragging"); // CSS makes cursor: grabbing
    this.scroller.style.userSelect = "none";
    this.stopInertia();
    this.lastX = e.clientX;
    this.lastT = performance.now();
    this.velocity = 0;
  };
  Slider.prototype.endDrag = function (e) {
    if (!this.dragging) return;
    this.dragging = false;
    this.scroller.classList.remove("is-dragging");
    this.scroller.style.userSelect = "";
    if (e && e.pointerId != null)
      this.scroller.releasePointerCapture(e.pointerId);
    const decay = 0.92;
    const minVel = 0.2;
    const step = () => {
      const next = this.clampScrollLeft(
        this.scroller.scrollLeft + this.velocity
      );
      this.scroller.scrollLeft = next;
      this.velocity *= decay;
      const atEdge = next <= 0 || next >= this.maxScroll();
      if (Math.abs(this.velocity) < minVel || atEdge) {
        this.inertiaId = 0;
        return;
      }
      this.inertiaId = requestAnimationFrame(step);
    };
    if (Math.abs(this.velocity) >= minVel)
      this.inertiaId = requestAnimationFrame(step);
  };
  Slider.prototype.onPointerDown = function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.maybeDrag = true;
    this.dragging = false;
    this.didDrag = false;
    this.startX = e.clientX;
    this.startScroll = this.scroller.scrollLeft;
    this.lastX = e.clientX;
    this.lastT = performance.now();
    this.velocity = 0;
  };
  Slider.prototype.onPointerMove = function (e) {
    if (!this.maybeDrag && !this.dragging) return;
    const dxFromStart = e.clientX - this.startX;
    if (!this.dragging) {
      if (Math.abs(dxFromStart) >= 6) {
        this.startDrag(e);
      } else {
        return;
      }
    }
    const now = performance.now();
    const dx = e.clientX - this.lastX;
    const dt = Math.max(1, now - this.lastT);
    this.scroller.scrollLeft = this.clampScrollLeft(
      this.startScroll - (e.clientX - this.startX)
    );
    this.velocity = -(dx / dt) * 16;
    this.lastX = e.clientX;
    this.lastT = now;
  };
  Slider.prototype.onPointerUp = function (e) {
    if (this.dragging) this.endDrag(e);
    this.maybeDrag = false;
    setTimeout(() => {
      this.didDrag = false;
    }, 0);
  };
  Slider.prototype.onPointerCancel = function () {
    if (this.dragging) {
      this.dragging = false;
      this.scroller.classList.remove("is-dragging");
      this.scroller.style.userSelect = "";
      this.stopInertia();
    }
    this.maybeDrag = false;
    setTimeout(() => {
      this.didDrag = false;
    }, 0);
  };
  Slider.prototype.trackMetrics = function () {
    const trackWidth = this.scrollTrack ? this.scrollTrack.clientWidth : 0;
    const barWidth = this.scrollBar
      ? this.scrollBar.getBoundingClientRect().width
      : 0;
    const maxX = Math.max(0, trackWidth - barWidth);
    const m = Math.max(1, this.maxScroll());
    return { trackWidth, barWidth, maxX, m };
  };
  Slider.prototype.setScrollFromTrackX = function (x) {
    const { maxX, m } = this.trackMetrics();
    const nx = Math.min(Math.max(x, 0), maxX);
    const progress = maxX === 0 ? 0 : nx / maxX;
    const target = progress * m;
    this.scroller.scrollLeft = target;
    this.updateScrollbar();
    this.updateButtons();
  };
  Slider.prototype.onBarPointerDown = function (e) {
    if (!this.scrollTrack || !this.scrollBar) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    this.scrollBar.setPointerCapture(e.pointerId);
    this.draggingBar = true;
    this.scrollBar.style.cursor = "grabbing";
    const barRect = this.scrollBar.getBoundingClientRect();
    this.barOffsetX = e.clientX - barRect.left;
  };
  Slider.prototype.onBarPointerMove = function (e) {
    if (!this.draggingBar) return;
    const trackRect = this.scrollTrack.getBoundingClientRect();
    const x = e.clientX - trackRect.left - this.barOffsetX;
    this.setScrollFromTrackX(x);
  };
  Slider.prototype.onBarPointerUp = function (e) {
    if (!this.draggingBar) return;
    this.draggingBar = false;
    this.scrollBar.style.cursor = "grab";
    this.scrollBar.releasePointerCapture(e.pointerId);
  };
  Slider.prototype.onTrackPointerDown = function (e) {
    if (!this.scrollTrack || !this.scrollBar) return;
    if (e.target === this.scrollBar) return;
    const rect = this.scrollTrack.getBoundingClientRect();
    const barWidth = this.scrollBar.getBoundingClientRect().width;
    const x = e.clientX - rect.left - barWidth / 2;
    this.setScrollFromTrackX(x);
  };

  // --- Hover visuals (unchanged except we don't mess with anchors) ---
  Slider.prototype.clearHover = function () {
    this.hoverBindings.forEach(({ el, type, fn }) =>
      el.removeEventListener(type, fn)
    );
    this.hoverBindings = [];
    const items = this.list.querySelectorAll(this.conf.item);
    items.forEach((item) => {
      const primary = this.conf.card
        ? item.querySelector(this.conf.card)
        : null;
      const hovers = [];
      if (primary) {
        primary.style.transition = "";
        primary.style.opacity = "1";
        primary.style.transform = "scale(1)";
      }
      if (hovers.length) {
        hovers.forEach((h) => {
          h.style.transition = "";
          h.style.opacity = "0";
          h.style.transform = "scale(1)";
        });
      }
    });
  };
  Slider.prototype.setupHover = function () {
    const canHover = this.mq.matches;
    this.clearHover();
    if (!canHover) return;
    const items = this.list.querySelectorAll(this.conf.item);
    items.forEach((item) => {
      const primary = this.conf.card
        ? item.querySelector(this.conf.card)
        : null;
      const hovers = [];
      if (!primary && !hovers.length) return;
      if (primary) {
        primary.style.transition =
          "opacity 280ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 900ms cubic-bezier(0.16, 1, 0.3, 1)";
        primary.style.opacity = "1";
        primary.style.transform = "scale(1)";
        // IMPORTANT: don't kill clicks; only set pointer-events none when not an anchor
        if (primary.tagName !== "A") {
          primary.style.pointerEvents = "none";
        }
      }
      if (hovers.length) {
        hovers.forEach((h) => {
          h.style.transition =
            "opacity 380ms cubic-bezier(0.2, 0.8, 0.2, 1), transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)";
          h.style.opacity = "0";
          h.style.transform = "scale(1)";
          h.style.pointerEvents = "none";
        });
      }
      const showHover = () => {
        if (hovers.length) {
          if (primary) {
            primary.style.opacity = "0";
            primary.style.transform = "scale(0.985)";
          }
          hovers.forEach((h) => {
            h.style.opacity = "1";
            h.style.transform = "scale(1.12)";
          });
        } else if (primary) {
          primary.style.opacity = "1";
          primary.style.transform = "scale(1.08)";
        }
      };
      const hideHover = () => {
        if (hovers.length) {
          hovers.forEach((h) => {
            h.style.opacity = "0";
            h.style.transform = "scale(1)";
          });
          if (primary) {
            primary.style.opacity = "1";
            primary.style.transform = "scale(1)";
          }
        } else if (primary) {
          primary.style.transform = "scale(1)";
        }
      };
      const bind = (el, type, fn) => {
        el.addEventListener(type, fn);
        this.hoverBindings.push({ el, type, fn });
      };
      bind(item, "mouseenter", showHover);
      bind(item, "mouseleave", hideHover);
      bind(item, "focusin", showHover);
      bind(item, "focusout", hideHover);
    });
  };

  // --- Cursor mode (new): show grab on hover only when no links exist ---
  Slider.prototype.detectLinksInItems = function () {
    // Any anchor inside an item counts as "interactive"
    const selector = `${this.conf.item} a[href]`;
    return !!this.list.querySelector(selector);
  };
  Slider.prototype.clearCursorBindings = function () {
    this.cursorBindings.forEach(({ el, type, fn }) =>
      el.removeEventListener(type, fn)
    );
    this.cursorBindings = [];
  };
  Slider.prototype.setupCursorMode = function () {
    this.clearCursorBindings();
    const canHover = this.mq.matches;
    if (!canHover) {
      this.scroller.style.cursor = "";
      return;
    }
    this.hasLinks = this.detectLinksInItems();
    if (this.hasLinks) {
      // interactive cards: keep default cursor behavior
      this.scroller.style.cursor = "";
      return;
    }
    // static cards: show grab on hover (but grabbing while dragging is controlled by CSS class)
    const onEnter = () => {
      if (!this.scroller.classList.contains("is-dragging")) {
        this.scroller.style.cursor = "grab";
      }
    };
    const onLeave = () => {
      this.scroller.style.cursor = "";
    };
    this.scroller.addEventListener("mouseenter", onEnter);
    this.scroller.addEventListener("mouseleave", onLeave);
    this.cursorBindings.push({
      el: this.scroller,
      type: "mouseenter",
      fn: onEnter,
    });
    this.cursorBindings.push({
      el: this.scroller,
      type: "mouseleave",
      fn: onLeave,
    });
  };

  Slider.prototype.applyListStyles = function () {
    const listUID = assignUID(this.list, "data-rt-ss-id");
    this.list.style.overflowX = "auto";
    this.list.style.webkitOverflowScrolling = "touch";
    this.list.style.scrollbarWidth = "none";
    this.list.style.msOverflowStyle = "none";
    injectOnce(
      "rt-ss-" + listUID,
      `[data-rt-ss-id="${listUID}"]::-webkit-scrollbar{display:none}` +
        `[data-rt-ss-id="${listUID}"].is-dragging{cursor:grabbing !important;user-select:none}` +
        `[data-rt-ss-id="${listUID}"] img,[data-rt-ss-id="${listUID}"] a,[data-rt-ss-id="${listUID}"] ${this.conf.item}{user-select:none;-webkit-user-drag:none}`
    );
  };
  Slider.prototype.onResize = function () {
    this.stopInertia();
    this.rafUpdate();
    this.setupHover();
    this.setupCursorMode();
  };
  Slider.prototype.onClickCapture = function (e) {
    const a = e.target.closest("a");
    if (!a) return;
    if (this.didDrag) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  Slider.prototype.bindEvents = function () {
    this.scroller.addEventListener(
      "scroll",
      (this._onScroll = this.onScroll.bind(this)),
      { passive: true }
    );
    window.addEventListener(
      "resize",
      (this._onResize = this.onResize.bind(this))
    );
    this.scroller.addEventListener(
      "pointerdown",
      (this._onPD = this.onPointerDown.bind(this))
    );
    this.scroller.addEventListener(
      "pointermove",
      (this._onPM = this.onPointerMove.bind(this))
    );
    this.scroller.addEventListener(
      "pointerup",
      (this._onPU = this.onPointerUp.bind(this))
    );
    this.scroller.addEventListener(
      "pointercancel",
      (this._onPC = this.onPointerCancel.bind(this))
    );
    this.scroller.addEventListener(
      "pointerleave",
      (this._onPL = this.onPointerCancel.bind(this))
    );
    this.scroller.addEventListener(
      "click",
      (this._onClickCap = this.onClickCapture.bind(this)),
      true
    );

    if (this.btnPrev)
      this.btnPrev.addEventListener(
        "click",
        (this._onPrev = this.onPrevClick.bind(this))
      );
    if (this.btnNext)
      this.btnNext.addEventListener(
        "click",
        (this._onNext = this.onNextClick.bind(this))
      );

    if (this.scrollBar) {
      this.scrollBar.style.touchAction = "none";
      this.scrollBar.style.cursor = "grab";
      this.scrollBar.addEventListener(
        "pointerdown",
        (this._onBPD = this.onBarPointerDown.bind(this))
      );
      this.scrollBar.addEventListener(
        "pointermove",
        (this._onBPM = this.onBarPointerMove.bind(this))
      );
      this.scrollBar.addEventListener(
        "pointerup",
        (this._onBPU = this.onBarPointerUp.bind(this))
      );
      this.scrollBar.addEventListener(
        "pointercancel",
        (this._onBPC = this.onBarPointerUp.bind(this))
      );
      this.scrollBar.addEventListener(
        "pointerleave",
        (this._onBPL = this.onBarPointerUp.bind(this))
      );
    }
    if (this.scrollTrack) {
      this.scrollTrack.style.userSelect = "none";
      this.scrollTrack.style.cursor = "pointer";
      this.scrollTrack.addEventListener(
        "pointerdown",
        (this._onTPD = this.onTrackPointerDown.bind(this))
      );
    }

    this._onMQ = () => {
      this.setupHover();
      this.setupCursorMode(); // re-evaluate grab vs default on capability change
    };
    if (this.mq.addEventListener)
      this.mq.addEventListener("change", this._onMQ);
    else if (this.mq.addListener) this.mq.addListener(this._onMQ);

    const imgs = Array.from(this.list.querySelectorAll("img"));
    imgs.forEach((img) => {
      if (img.complete) return;
      const onL = () => {
        this.rafUpdate();
        this.setupHover();
        this.setupCursorMode();
      };
      const onE = () => {
        this.rafUpdate();
        this.setupHover();
        this.setupCursorMode();
      };
      img.addEventListener("load", onL, { once: true });
      img.addEventListener("error", onE, { once: true });
      this.imgHandlers.push({ img, onL, onE });
    });

    if (this.ro) {
      this.ro.observe(this.list);
      this.ro.observe(this.scroller);
      if (this.scrollTrack) this.ro.observe(this.scrollTrack);
    }
    window.addEventListener("pagehide", (this._onPH = this.destroy.bind(this)));
    window.addEventListener(
      "beforeunload",
      (this._onBU = this.destroy.bind(this))
    );
  };
  Slider.prototype.init = function () {
    this.applyListStyles();
    if (this.btnPrev) {
      this.btnPrev.style.opacity = "0";
      this.btnPrev.style.visibility = "hidden";
      this.btnPrev.style.transition =
        "opacity 0.25s ease, visibility 0.25s ease";
    }
    if (this.btnNext) {
      this.btnNext.style.opacity = "0";
      this.btnNext.style.visibility = "hidden";
      this.btnNext.style.transition =
        "opacity 0.25s ease, visibility 0.25s ease";
    }
    this.rafUpdate();
    window.addEventListener(
      "load",
      (this._onWL = () => {
        this.rafUpdate();
      })
    );
    this.setupHover();
    this.setupCursorMode();
    this.bindEvents();
  };
  Slider.prototype.destroy = function () {
    this.stopInertia();
    if (this._onScroll)
      this.scroller.removeEventListener("scroll", this._onScroll);
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    if (this._onPD)
      this.scroller.removeEventListener("pointerdown", this._onPD);
    if (this._onPM)
      this.scroller.removeEventListener("pointermove", this._onPM);
    if (this._onPU) this.scroller.removeEventListener("pointerup", this._onPU);
    if (this._onPC)
      this.scroller.removeEventListener("pointercancel", this._onPC);
    if (this._onPL)
      this.scroller.removeEventListener("pointerleave", this._onPL);
    if (this._onClickCap)
      this.scroller.removeEventListener("click", this._onClickCap, true);
    if (this._onPrev && this.btnPrev)
      this.btnPrev.removeEventListener("click", this._onPrev);
    if (this._onNext && this.btnNext)
      this.btnNext.removeEventListener("click", this._onNext);
    if (this.scrollBar) {
      if (this._onBPD)
        this.scrollBar.removeEventListener("pointerdown", this._onBPD);
      if (this._onBPM)
        this.scrollBar.removeEventListener("pointermove", this._onBPM);
      if (this._onBPU)
        this.scrollBar.removeEventListener("pointerup", this._onBPU);
      if (this._onBPC)
        this.scrollBar.removeEventListener("pointercancel", this._onBPC);
      if (this._onBPL)
        this.scrollBar.removeEventListener("pointerleave", this._onBPL);
    }
    if (this.scrollTrack && this._onTPD)
      this.scrollTrack.removeEventListener("pointerdown", this._onTPD);
    if (this.mq.removeEventListener && this._onMQ)
      this.mq.removeEventListener("change", this._onMQ);
    else if (this.mq.removeListener && this._onMQ)
      this.mq.removeListener(this._onMQ);
    if (this._onWL) window.removeEventListener("load", this._onWL);
    if (this._onPH) window.removeEventListener("pagehide", this._onPH);
    if (this._onBU) window.removeEventListener("beforeunload", this._onBU);
    this.imgHandlers.forEach(({ img, onL, onE }) => {
      img.removeEventListener("load", onL);
      img.removeEventListener("error", onE);
    });
    this.imgHandlers = [];
    this.clearHover();
    this.clearCursorBindings();
    this.scroller.style.cursor = "";
    if (this.ro) this.ro.disconnect();
  };

  function initAll() {
    const roots = document.querySelectorAll("[data-rt-slider]");
    const instances = [];
    roots.forEach((root) => {
      const inst = new Slider(root);
      if (inst.valid) instances.push(inst);
    });
    return instances;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initAll();
    });
  } else {
    initAll();
  }
})();
