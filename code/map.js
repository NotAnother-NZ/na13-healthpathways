(function () {
  var allowedCountries = ["nz", "au", "ca", "gb"];
  var countryCenters = {
    NZ: { lat: -35.4122, lng: 173.819 },
    AU: { lat: -23.7044, lng: 133.876 },
    CA: { lat: 56.1304, lng: -106.3468 },
    GB: { lat: 58.3781, lng: -3.436 },
  };
  var countryMarkers = [];
  var countryMode = false;
  var markers = [];
  var selectedCountryCode = null;
  var initialCountryZoom = null;

  function countryFromLatLng(lat, lng) {
    if (lat >= -48 && lat <= -10 && lng >= 112 && lng <= 154) return "AU";
    if (lat >= 42 && lat <= 83 && lng >= -141 && lng <= -52) return "CA";
    if (lat >= -48 && lat <= -34 && lng >= 166 && lng <= 179) return "NZ";
    if (lat >= 49 && lat <= 61 && lng >= -8 && lng <= 2) return "GB";
    return null;
  }
  function groupCardsByCountry() {
    const groups = {};

    cardsAll().forEach((card) => {
      const lat = n(
        card.querySelector("[data-latitude]")?.getAttribute("data-latitude")
      );
      const lng = n(
        card.querySelector("[data-longitude]")?.getAttribute("data-longitude")
      );
      if (!isFinite(lat) || !isFinite(lng)) return;

      const cc = countryFromLatLng(lat, lng);
      if (!cc) return;

      if (!groups[cc]) groups[cc] = [];
      groups[cc].push(card);
    });

    return groups;
  }
  function n(v) {
    if (v == null) return NaN;
    var s = String(v)
      .trim()
      .replace(/\u2212/g, "-");
    return parseFloat(s);
  }
  function getZoomIncreaseForScreen() {
    var width = window.innerWidth;
    var devicePixelRatio = window.devicePixelRatio || 1;
    var isMobile = width <= 479;
    var isTablet = width > 479 && width <= 1590;
    var isDesktop = width > 1590;
    var isHighRes = devicePixelRatio >= 2;

    // Base zoom increase values for different screen sizes
    var zoomIncrease;
    if (isMobile) {
      // Mobile devices: smaller zoom increase
      zoomIncrease = isHighRes ? 0.5 : 0.4;
    } else if (isTablet) {
      // Tablet devices: medium zoom increase
      zoomIncrease = isHighRes ? 0.7 : 0.6;
    } else {
      // Desktop devices: larger zoom increase
      zoomIncrease = isHighRes ? 0.4 : 0.4;
    }

    return zoomIncrease;
  }
  function ready(fn) {
    if (
      document.readyState === "complete" ||
      document.readyState === "interactive"
    )
      fn();
    else document.addEventListener("DOMContentLoaded", fn, { once: true });
  }
  function getCachedGeo() {
    try {
      var j = sessionStorage.getItem("rt_store_geo");
      if (!j) return null;
      var o = JSON.parse(j);
      if (
        o &&
        isFinite(o.lat) &&
        isFinite(o.lng) &&
        o.cc &&
        o.city &&
        o.country
      )
        return o;
    } catch (e) {}
    return null;
  }
  function setCachedGeo(o) {
    try {
      sessionStorage.setItem("rt_store_geo", JSON.stringify(o));
    } catch (e) {}
  }
  function fetchGeo(timeoutMs) {
    var ctrl = new AbortController(),
      t = setTimeout(() => ctrl.abort(), timeoutMs || 2500);
    return fetch(
      "https://pro.ip-api.com/json/?fields=status,country,countryCode,city,lat,lon&key=Yx2hC0Bm9ZA1xz1",
      { signal: ctrl.signal, cache: "reload" }
    )
      .then((r) => {
        clearTimeout(t);
        return r.json();
      })
      .then((j) => {
        if (j && j.status === "success" && isFinite(j.lat) && isFinite(j.lon)) {
          var o = {
            ok: true,
            lat: j.lat,
            lng: j.lon,
            cc: String(j.countryCode || "").toUpperCase(),
            city: j.city || "",
            country: j.country || "",
          };
          setCachedGeo(o);
          return o;
        }
        return { ok: false };
      })
      .catch(() => {
        clearTimeout(t);
        return { ok: false };
      });
  }
  async function getGeo() {
    var cached = getCachedGeo();
    if (cached) {
      console.log(
        "[store-map] geo (cached):",
        cached.city + ", " + cached.country
      );
      return cached;
    }
    var fresh = await fetchGeo(2500);
    if (fresh.ok) {
      console.log(
        "[store-map] geo (fetched):",
        fresh.city + ", " + fresh.country
      );
      return fresh;
    }
    console.log("[store-map] geo unavailable");
    return { ok: false };
  }
  function toLiteral(pos) {
    if (!pos) return null;
    if (typeof pos.lat === "function" && typeof pos.lng === "function")
      return { lat: pos.lat(), lng: pos.lng() };
    if (typeof pos.lat === "number" && typeof pos.lng === "number")
      return { lat: pos.lat, lng: pos.lng };
    if (
      typeof google !== "undefined" &&
      google.maps &&
      google.maps.LatLng &&
      pos instanceof google.maps.LatLng
    )
      return { lat: pos.lat(), lng: pos.lng() };
    return null;
  }
  function setMarkerOpacity(marker, op) {
    if (marker.__advanced && marker.content)
      marker.content.style.opacity = String(op);
    else if (marker.setOpacity) marker.setOpacity(op);
  }
  function updateAllMarkerOpacity(markers, active) {
    markers.forEach((m) => setMarkerOpacity(m, active && m !== active ? 1 : 1));
  }
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function animateCenterZoom(map, start, end, startZ, endZ, duration) {
    var startTime = null,
      rafId = null,
      from = new google.maps.LatLng(start.lat, start.lng),
      to = new google.maps.LatLng(end.lat, end.lng);
    return new Promise((resolve) => {
      function step(ts) {
        if (startTime === null) startTime = ts;
        var t = Math.min(1, (ts - startTime) / duration);
        var e = easeInOutCubic(t);
        var interp = google.maps.geometry.spherical.interpolate(from, to, e);
        map.setCenter(interp);
        var z = startZ + (endZ - startZ) * e;
        map.setZoom(z);
        if (t < 1) rafId = requestAnimationFrame(step);
        else {
          cancelAnimationFrame(rafId);
          resolve();
        }
      }
      rafId = requestAnimationFrame(step);
    });
  }
  async function flyTo(
    map,
    currentCenter,
    targetCenter,
    currentZoom,
    targetZoom
  ) {
    var p1 = new google.maps.LatLng(currentCenter.lat, currentCenter.lng);
    var p2 = new google.maps.LatLng(targetCenter.lat, targetCenter.lng);
    var d = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    var phaseOutZoom = Math.max(
      8,
      Math.min(currentZoom, targetZoom, map.getZoom()) - 2
    );
    var base = window.innerWidth <= 479 ? 900 : 1200;
    if (d > 200000) {
      await animateCenterZoom(
        map,
        currentCenter,
        currentCenter,
        currentZoom,
        phaseOutZoom,
        Math.round(base * 0.6)
      );
      await animateCenterZoom(
        map,
        currentCenter,
        targetCenter,
        phaseOutZoom,
        phaseOutZoom,
        Math.round(base * 0.7)
      );
      await animateCenterZoom(
        map,
        targetCenter,
        targetCenter,
        phaseOutZoom,
        targetZoom,
        Math.round(base * 0.8)
      );
    } else {
      await animateCenterZoom(
        map,
        currentCenter,
        targetCenter,
        currentZoom,
        targetZoom,
        Math.round(base * 1.1)
      );
    }
  }
  function dedupeByCell(points, zoom) {
    var k = new Set();
    var out = [];
    points.forEach((p) => {
      var x = Math.floor(((p.lng + 180) / 360) * Math.pow(2, zoom));
      var y = Math.floor(
        ((1 -
          Math.log(
            Math.tan((p.lat * Math.PI) / 180) +
              1 / Math.cos((p.lat * Math.PI) / 180)
          ) /
            Math.PI) /
          2) *
          Math.pow(2, zoom)
      );
      var key = x + "_" + y;
      if (!k.has(key)) {
        k.add(key);
        out.push(p);
      }
    });
    return out;
  }
  function onTransitionEndOnce(el, prop) {
    return new Promise((res) => {
      function h(e) {
        if (!prop || e.propertyName === prop) {
          el.removeEventListener("transitionend", h);
          res();
        }
      }
      el.addEventListener("transitionend", h);
    });
  }
  function smoothScrollEl(container, targetScrollTop, ms) {
    var start = container.scrollTop,
      change = targetScrollTop - start,
      startTime = null;
    return new Promise((res) => {
      function step(ts) {
        if (startTime === null) startTime = ts;
        var t = Math.min(1, (ts - startTime) / ms),
          e = easeInOutCubic(t);
        container.scrollTop = start + change * e;
        if (t < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
  }
  function ensureCardProminent(container, el, opts) {
    if (!container || !el) return Promise.resolve();
    var pad = opts && opts.pad != null ? opts.pad : 12;
    var anchorRatio =
      opts && opts.anchorRatio != null ? opts.anchorRatio : 0.25;
    var cRect = container.getBoundingClientRect();
    var eRect = el.getBoundingClientRect();
    var currentTop = container.scrollTop;
    var relTop = eRect.top - cRect.top;
    var desired =
      currentTop + relTop - container.clientHeight * anchorRatio - pad;
    desired = Math.max(
      0,
      Math.min(desired, container.scrollHeight - container.clientHeight)
    );
    if (Math.abs(desired - currentTop) < 2) return Promise.resolve();
    return smoothScrollEl(container, desired, 600);
  }
  function smoothPageScrollTo(targetY, ms) {
    var docEl = document.scrollingElement || document.documentElement;
    var start = docEl.scrollTop,
      change = targetY - start,
      startTime = null;
    return new Promise((res) => {
      function step(ts) {
        if (startTime === null) startTime = ts;
        var t = Math.min(1, (ts - startTime) / ms),
          e = easeInOutCubic(t);
        docEl.scrollTop = start + change * e;
        if (t < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
  }
  function scrollElementIntoViewWithOffset(el, pad, anchorRatio) {
    if (!el) return Promise.resolve();
    var rect = el.getBoundingClientRect();
    var pageY =
      (window.pageYOffset || document.documentElement.scrollTop) + rect.top;
    var desired =
      pageY -
      window.innerHeight * (anchorRatio != null ? anchorRatio : 0.1) -
      (pad != null ? pad : 12);
    if (desired < 0) desired = 0;
    return smoothPageScrollTo(desired, 600);
  }

  async function init() {
    countryMarkers = [];
    countryMode = true; // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â important

    var root = document.querySelector("#store-map[data-custom-map]");
    if (!root) return;
    var iconUrl = root.getAttribute("data-custom-map-marker") || "";
    var mapId = root.getAttribute("data-map-id") || "";

    var listEl = document.getElementById("store-list");
    var listOuter =
      document.getElementById("store-list-outer-wrapper") ||
      document.querySelector(".store-list-outer-wrapper");
    var noStores = document.getElementById("no-stores");
    if (noStores) noStores.style.display = "none";

    var searchInput = document.getElementById("search-input-text");
    var searchButton = document.getElementById("search-button");
    var clearButton = document.getElementById("clear-search-button");
    if (clearButton) clearButton.style.display = "none";

    var totalEl = document.getElementById("total-stores");
    var labelEl = document.getElementById("store-singular-plural");

    var cards = [
      ...document.querySelectorAll(".store-list-outer-wrapper .store-card"),
    ];
    if (!cards.length && listEl)
      cards = [...listEl.querySelectorAll(".store-card")];
    if (!cards.length) return;

    var firstLat = n(
      cards[0].querySelector("[data-latitude]")?.getAttribute("data-latitude")
    );
    var firstLng = n(
      cards[0].querySelector("[data-longitude]")?.getAttribute("data-longitude")
    );
    if (!isFinite(firstLat) || !isFinite(firstLng)) {
      firstLat = -43.53203;
      firstLng = 172.63665;
    }

    var geo = await getGeo();
    var allowed = { NZ: true, AU: true, GB: true, US: true };
    var startCenter = {
      lat: geo.ok ? geo.lat : firstLat,
      lng: geo.ok ? geo.lng : firstLng,
    };
    var startZoom =
      geo.ok && allowed[geo.cc] && geo.city
        ? 12
        : geo.ok && allowed[geo.cc]
        ? 5
        : 8;

    var styleEl = document.getElementById("rt-store-map-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "rt-store-map-style";
      document.head.appendChild(styleEl);
    }
    var cssA =
      "[data-map-host]{position:relative}.store-map-content{transform:translateY(120%);transition:transform .32s ease;will-change:transform}.store-map-content.is-visible{transform:translateY(0)}";
    if (!styleEl.textContent.includes(".store-map-content"))
      styleEl.textContent += (styleEl.textContent ? "\n" : "") + cssA;
    var cssB =
      "#rt-store-map-loader{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:2;background:transparent}#rt-store-map-loader .rt-spinner{width:32px;height:32px;border-radius:999px;border:2px solid var(--swatches--black,rgba(0,0,0,.85));border-top-color:transparent;animation:rtSpin .8s linear infinite}@keyframes rtSpin{to{transform:rotate(360deg)}}";
    if (!styleEl.textContent.includes("#rt-store-map-loader"))
      styleEl.textContent += (styleEl.textContent ? "\n" : "") + cssB;

    var host = document.createElement("div");
    host.setAttribute("data-map-host", "");
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.position = "relative";
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
    host.style.transition = "opacity .28s ease";
    var loader = document.createElement("div");
    loader.id = "rt-store-map-loader";
    var sp = document.createElement("div");
    sp.className = "rt-spinner";
    loader.appendChild(sp);
    if (!root.querySelector("[data-map-host]")) {
      root.insertBefore(host, root.firstChild);
      root.insertBefore(loader, host);
    }

    function revealMap() {
      loader.style.display = "none";
      host.style.opacity = "1";
      host.style.pointerEvents = "";
    }

    var mapStyle = await fetch(
      "https://cdn.jsdelivr.net/gh/NotAnother-NZ/na13-aoraki@main/code/map-style.json"
    ).then((r) => r.json());

    await google.maps.importLibrary("maps");
    await google.maps.importLibrary("marker");
    await google.maps.importLibrary("geometry");
    await google.maps.importLibrary("places");

    var zoomPos =
      window.innerWidth <= 479
        ? google.maps.ControlPosition.LEFT_TOP
        : google.maps.ControlPosition.LEFT_BOTTOM;
    var map = new google.maps.Map(host, {
      center: startCenter,
      zoom: startZoom,
      mapTypeId: "roadmap",
      styles: mapStyle,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: zoomPos },
      gestureHandling: "greedy",
      draggableCursor: "grab",
      draggingCursor: "grabbing",
    });

    var canUseAdvanced =
      !!mapId &&
      !!google.maps.marker &&
      !!google.maps.marker.AdvancedMarkerElement;
    var bounds = new google.maps.LatLngBounds();
    markers = [];
    var cardToMarker = new WeakMap();
    var markerToCard = new WeakMap();
    var processed = new WeakSet();
    var hasInteracted = false;

    function setMarkerVisible(marker, visible) {
      if (!marker) return;
      if (typeof marker.setMap === "function")
        marker.setMap(visible ? map : null);
      else marker.map = visible ? map : null;
    }
    function visibleCards() {
      return cardsAll().filter((c) => getCardItem(c).style.display !== "none");
    }
    function hideStoreMarkers() {
      markers.forEach(function (m) {
        setMarkerVisible(m, false);
      });
    }

    var panel = root.querySelector(".store-map-content");
    var panelName = panel?.querySelector("[data-store-name]");
    var panelAddress = panel?.querySelector("[data-store-address]");
    var panelLink = panel?.querySelector("[data-store-link]");
    var panelDirections = panel?.querySelector("[data-store-direction-link]");
    var panelClose = panel?.querySelector(".store-map-content-close");

    function getCardData(card) {
      var nameEl = card.querySelector('[data-search="store-name"]');
      var addrEl = card.querySelector('[data-search="store-address"]');
      var latEl = card.querySelector("[data-latitude]");
      var lngEl = card.querySelector("[data-longitude]");
      var linkEl = card.querySelector("[data-store-link]");
      var name = nameEl ? nameEl.textContent.trim() : "";
      var address = addrEl ? addrEl.textContent.trim() : "";
      var lat = n(latEl && latEl.getAttribute("data-latitude"));
      var lng = n(lngEl && lngEl.getAttribute("data-longitude"));
      var href =
        linkEl && linkEl.getAttribute("data-store-link")
          ? linkEl.getAttribute("data-store-link")
          : "#";
      return { name, address, lat, lng, href };
    }
    function getCardItem(card) {
      var li = card.closest(".store-list-item");
      return li || card;
    }

    function fillPanelFromCard(card) {
      var data = getCardData(card);
      if (panelName) panelName.textContent = data.name || "";
      if (panelAddress) panelAddress.textContent = data.address || "";
      if (panelLink) panelLink.setAttribute("href", data.href || "#");
      if (panelDirections) {
        var dest =
          isFinite(data.lat) && isFinite(data.lng)
            ? data.lat + "," + data.lng
            : encodeURIComponent(data.address || "");
        panelDirections.setAttribute(
          "href",
          "https://www.google.com/maps/dir/?api=1&destination=" + dest
        );
        panelDirections.setAttribute("target", "_blank");
        panelDirections.setAttribute("rel", "noopener");
      }
    }

    function panelVisible() {
      return !!panel && panel.classList.contains("is-visible");
    }
    async function showPanel() {
      if (!panel || panelVisible()) return;
      panel.classList.add("is-visible");
      await onTransitionEndOnce(panel, "transform");
    }
    async function hidePanel() {
      if (!panel || !panelVisible()) return;
      panel.classList.remove("is-visible");
      await onTransitionEndOnce(panel, "transform");
    }

    var animating = false;
    async function focusMarker(marker) {
      if (animating) return;
      var rawPos = marker.__advanced ? marker.position : marker.getPosition();
      var lit = toLiteral(rawPos);
      if (!lit || !isFinite(lit.lat) || !isFinite(lit.lng)) return;
      var w = window.innerWidth;
      var targetZoom = w <= 479 ? 17 : w <= 991 ? 15 : 14;
      var currentCenter = toLiteral(map.getCenter());
      var currentZoom = map.getZoom();

      animating = true;
      hasInteracted = true;
      updateAllMarkerOpacity(markers, marker);

      cardsAll().forEach((c) => {
        c.classList.remove("active-store-card");
        c.classList.remove("selected");
      });
      var card = markerToCard.get(marker);

      // If card is hidden by search filter, clear the filter first
      if (card) {
        var cardItem = getCardItem(card);
        var isCardHidden = cardItem && cardItem.style.display === "none";
        var hasActiveSearch =
          searchLatLng || (searchInput && searchInput.value.trim());

        if (isCardHidden && hasActiveSearch) {
          // Card is hidden by search filter - clear it and show all cards
          searchLatLng = null;
          if (searchInput) searchInput.value = "";
          if (listOuter) listOuter.style.display = "";
          if (noStores) noStores.style.display = "none";
          var allCards = cardsAll();
          allCards.forEach((c) => {
            var li = getCardItem(c);
            li.style.display = "";
          });
          updateTotalStores();
          setClearButtonVisibility(false);
          updateClusters();

          // Ensure the clicked card is visible
          if (cardItem) {
            cardItem.style.display = "";
          }
        }
      }

      if (panelVisible()) await hidePanel();
      if (card) {
        card.classList.add("active-store-card");
        card.classList.add("selected");
        fillPanelFromCard(card);
        if (listEl && window.innerWidth > 991)
          await ensureCardProminent(listEl, card, {
            pad: 12,
            anchorRatio: 0.25,
          });
      }

      await Promise.all([
        flyTo(map, currentCenter, lit, currentZoom, targetZoom),
        //showPanel(),
      ]);
      animating = false;
    }

    function cardsAll() {
      if (listEl) return [...listEl.querySelectorAll(".store-card")];
      return [
        ...document.querySelectorAll(".store-list-outer-wrapper .store-card"),
      ];
    }
    function updateTotalStores() {
      if (!listEl) return;
      var count = visibleCards().length;
      if (totalEl) totalEl.textContent = String(count);
      var label = document.getElementById("store-singular-plural");
      if (label) label.textContent = count === 1 ? "site" : "sites";
    }

    function bindCard(card) {
      if (processed.has(card)) return;
      var lat = n(
        card.querySelector("[data-latitude]")?.getAttribute("data-latitude")
      );
      var lng = n(
        card.querySelector("[data-longitude]")?.getAttribute("data-longitude")
      );
      if (!isFinite(lat) || !isFinite(lng)) {
        processed.add(card);
        updateTotalStores();
        return;
      }
      var pos = { lat: lat, lng: lng };
      var marker;
      if (canUseAdvanced) {
        var PIN_W = 28;
        var PIN_H = 40;

        var img = document.createElement("img");
        img.src = iconUrl;
        img.alt = "";
        img.style.width = PIN_W + "px";
        img.style.height = PIN_H + "px";
        img.style.cursor = "pointer";
        img.style.opacity = "1";

        marker = new google.maps.marker.AdvancedMarkerElement({
          map: map,
          position: pos,
          content: img,
          gmpClickable: true,
        });
        marker.__advanced = true;
        marker.addListener("gmp-click", function () {
          focusMarker(marker);
        });
      } else {
        marker = new google.maps.Marker({
          map: map,
          position: pos,
          clickable: true,
          icon: iconUrl
            ? {
                url: iconUrl,
                scaledSize: new google.maps.Size(28, 40),
                anchor: new google.maps.Point(14, 40), // width/2, height
              }
            : undefined,

          opacity: 1,
        });
        marker.__advanced = false;
        marker.addListener("click", function () {
          focusMarker(marker);
        });
      }
      markers.push(marker);
      cardToMarker.set(card, marker);
      markerToCard.set(marker, card);
      bounds.extend(pos);

      card.addEventListener("click", async function (e) {
        var m = cardToMarker.get(card);
        if (!m) return;
        e.preventDefault();
        exitCountryMode();
        if (window.innerWidth <= 991)
          await scrollElementIntoViewWithOffset(root, 12, 0.1);
        await focusMarker(m);
      });

      processed.add(card);
      updateTotalStores();
    }

    cardsAll().forEach(bindCard);
    function countStoresByCountry() {
      var counts = { NZ: 0, AU: 0, CA: 0, GB: 0 };
      cardsAll().forEach(function (card) {
        var lat = n(
          card.querySelector("[data-latitude]")?.getAttribute("data-latitude")
        );
        var lng = n(
          card.querySelector("[data-longitude]")?.getAttribute("data-longitude")
        );
        if (!isFinite(lat) || !isFinite(lng)) return;

        var cc = countryFromLatLng(lat, lng);
        if (cc && counts.hasOwnProperty(cc)) {
          counts[cc]++;
        }
      });
      return counts;
    }

    function createCountryMarkers() {
      // Clear any existing country markers first
      countryMarkers.forEach(function (m) {
        if (m.__advanced) m.map = null;
        else if (m.setMap) m.setMap(null);
      });
      countryMarkers = [];

      // Count stores per country
      var countryCounts = countStoresByCountry();

      // Only create markers for the 4 defined countries
      var countryKeys = Object.keys(countryCenters);
      if (countryKeys.length !== 4) {
        console.warn(
          "[store-map] Expected 4 countries, found:",
          countryKeys.length
        );
      }

      countryKeys.forEach(function (cc) {
        var pos = countryCenters[cc];
        if (!pos || !isFinite(pos.lat) || !isFinite(pos.lng)) {
          console.warn("[store-map] Invalid position for country:", cc);
          return;
        }
        var count = countryCounts[cc] || 0;
        var marker;

        if (canUseAdvanced) {
          // Use existing cluster marker design for country pins
          var countryMarkerEl = createClusterHtml(count);
          marker = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: pos,
            content: countryMarkerEl,
            gmpClickable: true,
          });
          marker.__advanced = true;
        } else {
          // For regular markers, create overlay with cluster design
          var CountryOverlay = function (position, count, countryCode) {
            this.position = position;
            this.count = count;
            this.countryCode = countryCode;
            this.div = null;
          };
          CountryOverlay.prototype = new google.maps.OverlayView();
          CountryOverlay.prototype.onAdd = function () {
            var self = this;
            this.div = createClusterHtml(this.count);
            this.getPanes().overlayMouseTarget.appendChild(this.div);
            this.div.style.cursor = "pointer";
            this.div.addEventListener("click", function () {
              // Trigger country marker click
              map.panTo(self.position);
              map.setZoom(3);
              showStoresForCountry(self.countryCode);
            });
          };
          CountryOverlay.prototype.draw = function () {
            var proj = this.getProjection();
            if (!proj || !this.div) return;
            var p = proj.fromLatLngToDivPixel(
              new google.maps.LatLng(this.position.lat, this.position.lng)
            );
            this.div.style.position = "absolute";
            this.div.style.left = p.x + "px";
            this.div.style.top = p.y + "px";
          };
          CountryOverlay.prototype.onRemove = function () {
            if (this.div && this.div.parentNode)
              this.div.parentNode.removeChild(this.div);
            this.div = null;
          };
          var ov = new CountryOverlay(pos, count, cc);
          ov.setMap(map);
          marker = {
            __overlay: ov,
            __advanced: false,
            setMap: function (m) {
              ov.setMap(m);
            },
          };
        }

        marker.__country = cc;
        countryMarkers.push(marker);

        // Add click listener for AdvancedMarkerElement only (overlay handles its own clicks)
        if (canUseAdvanced) {
          marker.addListener("gmp-click", function () {
            // Keep all country pins visible, zoom to selected country, show stores for that country
            map.panTo(pos);
            map.setZoom(3);
            showStoresForCountry(cc);
          });
        }
      });
    }
    // Country mode: hide store markers on initial load (cards remain visible, filtered by search only)
    hideStoreMarkers();
    createCountryMarkers();

    // Fit map to show all 4 country pins in a single frame
    if (countryMarkers.length > 0) {
      var countryBounds = new google.maps.LatLngBounds();
      // Extend bounds with buffer to account for marker size (especially for Canada at top)
      Object.keys(countryCenters).forEach(function (cc) {
        var pos = countryCenters[cc];
        if (pos && isFinite(pos.lat) && isFinite(pos.lng)) {
          // Add buffer around each pin location (more buffer for Canada at northern edge)
          var latBuffer = cc === "CA" ? 0.15 : 0.1; // Extra buffer for Canada
          var lngBuffer = 0.1;
          countryBounds.extend(
            new google.maps.LatLng(pos.lat + latBuffer, pos.lng + lngBuffer)
          );
          countryBounds.extend(
            new google.maps.LatLng(pos.lat - latBuffer, pos.lng - lngBuffer)
          );
        }
      });
      if (!countryBounds.isEmpty()) {
        // Significantly increase padding, especially top padding for Canada pin
        var padding = {
          top: 200,
          right: 120,
          bottom: 120,
          left: 120,
        };
        map.fitBounds(countryBounds, padding);
        // Store the initial zoom level after fitting bounds
        google.maps.event.addListenerOnce(map, "idle", function () {
          var fittedZoom = map.getZoom();
          // Increase zoom level to make the map appear larger (zoom in more)
          // Calculate zoom increase based on screen size and resolution
          var zoomIncrease = getZoomIncreaseForScreen();
          var newZoom = Math.min(18, fittedZoom + zoomIncrease); // Cap at max zoom 18
          map.setZoom(newZoom);
          // Wait for zoom to complete before checking visibility
          google.maps.event.addListenerOnce(map, "idle", function () {
            initialCountryZoom = map.getZoom();
            // Double-check and adjust if needed to ensure all pins are visible
            map.setOptions({
              minZoom: initialCountryZoom, // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸"ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ lock it
            });
            var bounds = map.getBounds();
            if (bounds) {
              var allVisible = true;
              var needsAdjustment = false;
              Object.keys(countryCenters).forEach(function (cc) {
                var pos = countryCenters[cc];
                if (pos && isFinite(pos.lat) && isFinite(pos.lng)) {
                  var latLng = new google.maps.LatLng(pos.lat, pos.lng);
                  if (!bounds.contains(latLng)) {
                    allVisible = false;
                    needsAdjustment = true;
                  }
                }
              });
              // If any pin is not visible, zoom out more aggressively
              if (needsAdjustment && map.getZoom() > 1) {
                var currentZoom = map.getZoom();
                map.setZoom(Math.max(1, currentZoom - 1));
                // Check again after zoom adjustment
                google.maps.event.addListenerOnce(map, "idle", function () {
                  var newBounds = map.getBounds();
                  if (newBounds) {
                    Object.keys(countryCenters).forEach(function (cc) {
                      var pos = countryCenters[cc];
                      if (pos && isFinite(pos.lat) && isFinite(pos.lng)) {
                        var latLng = new google.maps.LatLng(pos.lat, pos.lng);
                        if (!newBounds.contains(latLng)) {
                          // Still not visible, extend bounds manually
                          var ne = newBounds.getNorthEast();
                          var sw = newBounds.getSouthWest();
                          var centerLat = (ne.lat() + sw.lat()) / 2;
                          var centerLng = (ne.lng() + sw.lng()) / 2;
                          var latDiff = Math.abs(ne.lat() - sw.lat());
                          var lngDiff = Math.abs(ne.lng() - sw.lng());
                          var extendedBounds = new google.maps.LatLngBounds(
                            new google.maps.LatLng(
                              sw.lat() - latDiff * 0.2,
                              sw.lng() - lngDiff * 0.2
                            ),
                            new google.maps.LatLng(
                              ne.lat() + latDiff * 0.3,
                              ne.lng() + lngDiff * 0.2
                            )
                          );
                          map.fitBounds(extendedBounds, {
                            top: 150,
                            right: 100,
                            bottom: 100,
                            left: 100,
                          });
                        }
                      }
                    });
                  }
                });
              }
            }
          });
        });
      }
    }

    if (panelClose) {
      panelClose.addEventListener("click", async function (e) {
        e.preventDefault();
        await hidePanel();
        updateAllMarkerOpacity(markers, null);
        cardsAll().forEach((c) => {
          c.classList.remove("active-store-card");
          c.classList.remove("selected");
        });
      });
    }

    function kmBetween(a, b) {
      var A = new google.maps.LatLng(a.lat, a.lng);
      var B = new google.maps.LatLng(b.lat, b.lng);
      return google.maps.geometry.spherical.computeDistanceBetween(A, B) / 1000;
    }

    var nonNzMinZoom = window.innerWidth <= 479 ? 6.3 : 6.8;

    // Skip store marker bounds fitting if in country mode (we already fit to country centers)
    if (!countryMode) {
      if (!(geo.ok && allowed[geo.cc] && geo.city)) {
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
          google.maps.event.addListenerOnce(map, "idle", function () {
            if (map.getZoom() > 14) map.setZoom(14);
            if (geo.ok && geo.cc !== "NZ" && map.getZoom() < nonNzMinZoom)
              map.setZoom(nonNzMinZoom);
          });
        }
      } else {
        var nearAny = false;
        var userLL = { lat: geo.lat, lng: geo.lng };
        markers.forEach((m) => {
          var lit = toLiteral(m.__advanced ? m.position : m.getPosition());
          if (!lit) return;
          if (kmBetween(userLL, lit) <= 75) nearAny = true;
        });
        if (nearAny) {
          updateAllMarkerOpacity(markers, null);
          map.setCenter(userLL);
          map.setZoom(12);
        } else {
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
            google.maps.event.addListenerOnce(map, "idle", function () {
              if (map.getZoom() > 14) map.setZoom(14);
              if (geo.cc !== "NZ" && map.getZoom() < nonNzMinZoom)
                map.setZoom(nonNzMinZoom);
            });
          }
        }
      }
    }

    var warmHost = document.createElement("div");
    warmHost.style.position = "absolute";
    warmHost.style.left = "-10000px";
    warmHost.style.top = "-10000px";
    warmHost.style.width = "256px";
    warmHost.style.height = "256px";
    warmHost.style.opacity = "0";
    warmHost.style.pointerEvents = "none";
    document.body.appendChild(warmHost);
    var warmMap = new google.maps.Map(warmHost, {
      center: toLiteral(map.getCenter()) || { lat: firstLat, lng: firstLng },
      zoom: 12,
      mapTypeId: "roadmap",
      styles: mapStyle,
      disableDefaultUI: true,
      gestureHandling: "none",
    });
    function warmPointsFromMarkers() {
      var pts = markers
        .map((m) => toLiteral(m.__advanced ? m.position : m.getPosition()))
        .filter(Boolean);
      return dedupeByCell(pts, 14).slice(0, 12);
    }
    async function warmTilesSeq(points) {
      for (var i = 0; i < points.length; i++) {
        warmMap.setCenter(points[i]);
        warmMap.setZoom(14);
        await new Promise((res) =>
          google.maps.event.addListenerOnce(warmMap, "idle", res)
        );
      }
    }
    warmTilesSeq(warmPointsFromMarkers());

    if (listEl) {
      var obs = new MutationObserver((muts) => {
        var added = [];
        muts.forEach((mu) => {
          mu.addedNodes &&
            mu.addedNodes.forEach((node) => {
              if (!(node instanceof Element)) return;
              if (node.matches && node.matches(".store-card")) added.push(node);
              added.push(
                ...(node.querySelectorAll
                  ? node.querySelectorAll(".store-card")
                  : [])
              );
            });
        });
        if (added.length) {
          added.forEach(bindCard);
          if (!hasInteracted && !bounds.isEmpty()) {
            map.fitBounds(bounds);
            google.maps.event.addListenerOnce(map, "idle", function () {
              if (map.getZoom() > 14) map.setZoom(14);
              if (geo.ok && geo.cc !== "NZ" && map.getZoom() < nonNzMinZoom)
                map.setZoom(nonNzMinZoom);
            });
          }
          var pts = warmPointsFromMarkers();
          warmTilesSeq(pts);
          applyMarkerVisibilityToMatchList();
          updateClusters();
        }
        updateTotalStores();
      });
      obs.observe(listEl, { childList: true, subtree: true });
    }

    var searchLatLng = null;
    function setClearButtonVisibility(active) {
      if (clearButton) clearButton.style.display = active ? "" : "none";
    }

    function markerLatLng(m) {
      var p = toLiteral(m.__advanced ? m.position : m.getPosition());
      return p || null;
    }
    function markerShown(m) {
      if (m.__advanced) return m.map === map;
      if (typeof m.getMap === "function") return m.getMap() === map;
      return !!m.map;
    }

    function applyMarkerVisibilityToMatchList() {
      // If country mode is active, use updateClusters which handles country filtering
      if (countryMode && selectedCountryCode) {
        updateClusters();
        return;
      }
      // Normal mode: show all pins on map (list stays filtered by search)
      markers.forEach((m) => {
        var card = markerToCard.get(m);
        setMarkerVisible(m, !!card);
      });
    }

    function showStoresForCountry(countryCode) {
      // Requirement #3: Show stores for selected country with smooth animation
      selectedCountryCode = countryCode;

      // Hide all country pins
      countryMarkers.forEach(function (m) {
        if (m.__advanced) m.map = null;
        else if (m.__overlay && m.__overlay.setMap) m.__overlay.setMap(null);
        else if (m.setMap) m.setMap(null);
      });

      // Show store markers for the selected country with animation
      markers.forEach(function (m, index) {
        var card = markerToCard.get(m);
        if (!card) {
          setMarkerVisible(m, false);
          return;
        }

        var lat = n(
          card.querySelector("[data-latitude]")?.getAttribute("data-latitude")
        );
        var lng = n(
          card.querySelector("[data-longitude]")?.getAttribute("data-longitude")
        );

        if (!isFinite(lat) || !isFinite(lng)) {
          setMarkerVisible(m, false);
          return;
        }

        var cardCountry = countryFromLatLng(lat, lng);
        var shouldShow = cardCountry === countryCode;

        // Stagger animation for smooth appearance (Requirement #3)
        setTimeout(function () {
          animateMarkerVisibility(m, shouldShow, 300);
        }, index * 10); // Small delay between markers for cascade effect
      });

      updateClusters();
    }

    function distanceKm(a, b) {
      var A = new google.maps.LatLng(a.lat, a.lng);
      var B = new google.maps.LatLng(b.lat, b.lng);
      return google.maps.geometry.spherical.computeDistanceBetween(A, B) / 1000;
    }

    function computeDynamicCap() {
      var container =
        listEl ||
        document.getElementById("store-list-outer-wrapper") ||
        document.querySelector(".store-list-outer-wrapper");
      var available = container
        ? container.clientHeight
        : Math.floor(window.innerHeight * 0.6);
      if (!available || available < 120)
        available = Math.floor(window.innerHeight * 0.5);
      var sample = cardsAll().find(Boolean);
      var cardH = sample
        ? Math.ceil(sample.getBoundingClientRect().height)
        : 96;
      if (!cardH || cardH < 64) cardH = 96;
      var gap = 8;
      var cap = Math.floor(available / (cardH + gap));
      var minCap = 6;
      var maxCap = Math.max(
        12,
        Math.min(40, Math.ceil(window.innerHeight / 48))
      );
      if (!isFinite(cap) || cap < minCap) cap = minCap;
      if (cap > maxCap) cap = maxCap;
      return cap;
    }

    function gatherAdaptive(latLng) {
      var allCards = cardsAll();
      var items = allCards
        .map((c) => {
          var d = getCardData(c);
          return {
            card: c,
            item: getCardItem(c),
            data: d,
            ok: isFinite(d.lat) && isFinite(d.lng),
          };
        })
        .filter((x) => x.ok);
      items.forEach(
        (x) =>
          (x.dist = distanceKm({ lat: x.data.lat, lng: x.data.lng }, latLng))
      );
      items.sort((a, b) => a.dist - b.dist);

      var cap = computeDynamicCap();
      var startRadius = window.innerWidth <= 479 ? 25 : 30;
      var maxRadius = 400;
      var targetMin = Math.max(6, Math.min(cap, 10));
      var r = startRadius;
      var chosen = [];
      while (r <= maxRadius && chosen.length < targetMin) {
        chosen = items.filter((x) => x.dist <= r);
        if (chosen.length >= targetMin) break;
        r = r * 2;
      }
      if (!chosen.length) chosen = items.filter((x) => x.dist <= maxRadius);
      chosen.sort((a, b) => a.dist - b.dist);
      if (chosen.length > cap) chosen = chosen.slice(0, cap);
      return { chosen: chosen, cap: cap };
    }

    function applyFilterFrom(latLng) {
      if (!listEl) return;
      searchLatLng = latLng;

      var res = gatherAdaptive(latLng);
      var within = res.chosen;

      var allCards = cardsAll();
      var frag = document.createDocumentFragment();
      allCards.forEach((c) => {
        var li = getCardItem(c);
        li.style.display = "none";
      });
      within.forEach((x) => {
        x.item.style.display = "";
        frag.appendChild(x.item);
      });
      listEl.appendChild(frag);

      if (within.length === 0) {
        if (listOuter) listOuter.style.display = "none";
        if (noStores) noStores.style.display = "";
      } else {
        if (listOuter) listOuter.style.display = "";
        if (noStores) noStores.style.display = "none";
      }

      updateTotalStores();
      setClearButtonVisibility(
        !!within.length && !!searchInput && !!searchInput.value.trim()
      );
      applyMarkerVisibilityToMatchList();
      updateClusters();

      if (within.length) {
        var m = cardToMarker.get(within[0].card);
        if (m) focusMarker(m);
        else {
          var b = new google.maps.LatLngBounds();
          within.forEach((x) =>
            b.extend(new google.maps.LatLng(x.data.lat, x.data.lng))
          );
          map.fitBounds(b);
        }
      }
      // When no nearby stores: list shows "no stores", map still shows all pins
    }

    var originalOrder = [];
    function captureInitialOrder() {
      if (!listEl) return;
      originalOrder = [...listEl.children].map((el) => el);
    }
    if (listEl) captureInitialOrder();

    async function clearFilter() {
      if (!listEl) return;
      searchLatLng = null;
      if (listOuter) listOuter.style.display = "";
      if (noStores) noStores.style.display = "none";
      var allCards = cardsAll();
      allCards.forEach((c) => {
        var li = getCardItem(c);
        li.style.display = "";
      });
      if (originalOrder.length) {
        var frag = document.createDocumentFragment();
        originalOrder.forEach((el) => frag.appendChild(el));
        listEl.appendChild(frag);
      }
      await hidePanel();
      updateAllMarkerOpacity(markers, null);
      cardsAll().forEach((c) => {
        c.classList.remove("active-store-card");
        c.classList.remove("selected");
      });
      updateTotalStores();
      setClearButtonVisibility(false);
      // Only show markers if country mode is not active
      if (!countryMode) {
        markers.forEach((m) => setMarkerVisible(m, true));
      }
      updateClusters();

      if (geo.ok && allowed[geo.cc] && geo.city) {
        var userLL = { lat: geo.lat, lng: geo.lng };
        var nearAny = false;
        markers.forEach((m) => {
          var lit = toLiteral(m.__advanced ? m.position : m.getPosition());
          if (!lit) return;
          var A = new google.maps.LatLng(userLL.lat, userLL.lng);
          var B = new google.maps.LatLng(lit.lat, lit.lng);
          if (
            google.maps.geometry.spherical.computeDistanceBetween(A, B) /
              1000 <=
            75
          )
            nearAny = true;
        });
        if (nearAny) {
          map.setCenter(userLL);
          map.setZoom(12);
        } else {
          if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
            google.maps.event.addListenerOnce(map, "idle", function () {
              if (map.getZoom() > 14) map.setZoom(14);
              if (geo.cc !== "NZ" && map.getZoom() < nonNzMinZoom)
                map.setZoom(nonNzMinZoom);
            });
          }
        }
      } else {
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds);
          google.maps.event.addListenerOnce(map, "idle", function () {
            if (map.getZoom() > 14) map.setZoom(14);
            if (geo.ok && geo.cc !== "NZ" && map.getZoom() < nonNzMinZoom)
              map.setZoom(nonNzMinZoom);
          });
        }
      }
    }

    var placesService = new google.maps.places.PlacesService(map);
    var acService = new google.maps.places.AutocompleteService();

    function wireSearch() {
      if (!searchInput) return;

      var ac = new google.maps.places.Autocomplete(searchInput, {
        types: ["geocode"],
        fields: ["geometry", "name", "address_components", "formatted_address"],
      });

      ac.setComponentRestrictions({ country: allowedCountries });

      function isAllowedCountry(place) {
        if (!place || !place.address_components || !place.geometry)
          return false;

        return place.address_components.some(
          (c) =>
            c.types.includes("country") &&
            allowedCountries.includes(String(c.short_name || "").toLowerCase())
        );
      }

      function centerFromGeometry(g) {
        if (!g) return null;
        if (g.location) return toLiteral(g.location);
        if (g.viewport && g.viewport.getCenter)
          return toLiteral(g.viewport.getCenter());
        if (g.viewport && g.viewport.getNorthEast && g.viewport.getSouthWest) {
          var ne = g.viewport.getNorthEast(),
            sw = g.viewport.getSouthWest();
          var lat = (ne.lat() + sw.lat()) / 2,
            lng = (ne.lng() + sw.lng()) / 2;
          return { lat: lat, lng: lng };
        }
        return null;
      }

      function pickPrediction(preds) {
        if (!preds || !preds.length) return null;
        var preferred = preds.find((p) => {
          var t = p.types || [];
          return (
            t.includes("locality") ||
            t.includes("postal_town") ||
            t.includes("postal_code") ||
            t.some((x) => x.indexOf("sublocality") === 0)
          );
        });
        return preferred || preds[0];
      }

      function resolvePredictionToLatLng(pred) {
        return new Promise((resolve) => {
          if (!pred) return resolve(null);
          placesService.getDetails(
            {
              placeId: pred.place_id,
              fields: [
                "geometry",
                "name",
                "address_components",
                "formatted_address",
              ],
            },
            function (place, status) {
              if (
                status !== google.maps.places.PlacesServiceStatus.OK ||
                !place
              )
                return resolve(null);
              if (!isAllowedCountry(place)) return resolve(null);
              var ll = centerFromGeometry(place.geometry);
              resolve(ll || null);
            }
          );
        });
      }

      function submitFreeTextQuery() {
        var q = ((searchInput && searchInput.value) || "").trim();
        if (!q) return;
        acService.getPlacePredictions(
          { input: q, componentRestrictions: { country: allowedCountries } },
          async function (preds, status) {
            if (
              status === google.maps.places.PlacesServiceStatus.OK &&
              preds &&
              preds.length
            ) {
              var choice = pickPrediction(preds);
              var ll = await resolvePredictionToLatLng(choice);
              if (ll) {
                if (searchInput && choice && choice.description)
                  searchInput.value = choice.description;
                applyFilterFrom(ll);
              }
              return;
            }
            setClearButtonVisibility(false);
          }
        );
      }

      ac.addListener("place_changed", function () {
        var place = ac.getPlace();
        if (!isAllowedCountry(place)) {
          setClearButtonVisibility(false);
          return;
        }
        var ll = centerFromGeometry(place.geometry);
        if (!ll) {
          setClearButtonVisibility(false);
          return;
        }
        applyFilterFrom(ll);
      });

      if (searchButton) {
        searchButton.addEventListener("click", function (e) {
          e.preventDefault();
          submitFreeTextQuery();
        });
      }
      if (clearButton) {
        clearButton.addEventListener("click", async function (e) {
          e.preventDefault();
          if (searchInput) searchInput.value = "";
          await clearFilter();
        });
      }
      if (searchInput) {
        searchInput.addEventListener("input", function () {
          if (!this.value.trim()) {
            clearFilter();
          }
        });
        searchInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            submitFreeTextQuery();
          }
        });

        function adjustInputIntoView() {
          if (window.innerWidth <= 991) {
            scrollElementIntoViewWithOffset(searchInput, 12, 0.08);
          }
        }
        searchInput.addEventListener("focus", function () {
          adjustInputIntoView();
          setTimeout(adjustInputIntoView, 250);
          setTimeout(adjustInputIntoView, 600);
          if (window.visualViewport)
            window.visualViewport.addEventListener(
              "resize",
              adjustInputIntoView
            );
        });
        searchInput.addEventListener("click", function () {
          setTimeout(adjustInputIntoView, 50);
        });
        searchInput.addEventListener("blur", function () {
          if (window.visualViewport)
            window.visualViewport.removeEventListener(
              "resize",
              adjustInputIntoView
            );
        });
      }
    }

    wireSearch();

    var clusterMarkers = [];
    function clearClusters() {
      clusterMarkers.forEach((cm) => {
        if (cm.__advanced) cm.map = null;
        else if (cm.setMap) cm.setMap(null);
        if (cm.__overlay && cm.__overlay.setMap) cm.__overlay.setMap(null);
      });
      clusterMarkers = [];
    }
    function clusterEnabledAtZoom(z) {
      // Store markers should NOT be clustered (requirement #5)
      // Disable clustering when in country mode (showing country pins)
      if (countryMode) {
        return false; // Disable clustering when country pins are shown
      }
      return z <= 12;
    }
    function clusterCellFactor(z) {
      if (z <= 5) return 8;
      if (z <= 7) return 6;
      if (z <= 9) return 4;
      if (z <= 11) return 3;
      return 2;
    }
    function projectToTile(lat, lng, zoom) {
      var x = ((lng + 180) / 360) * Math.pow(2, zoom);
      var y =
        ((1 -
          Math.log(
            Math.tan((lat * Math.PI) / 180) +
              1 / Math.cos((lat * Math.PI) / 180)
          ) /
            Math.PI) /
          2) *
        Math.pow(2, zoom);
      return { x: x, y: y };
    }
    function tileToLatLng(x, y, zoom) {
      var n2 = Math.pow(2, zoom);
      var lng = (x / n2) * 360 - 180;
      var n = Math.PI - (2 * Math.PI * y) / n2;
      var lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      return { lat: lat, lng: lng };
    }
    function displayCount(nc) {
      return nc > 99 ? "99+" : String(nc);
    }
    function sizeForCount(c) {
      var isMobile = window.innerWidth <= 479;
      var isTablet = window.innerWidth > 479 && window.innerWidth <= 991;
      var min = isMobile ? 34 : isTablet ? 40 : 44;
      var max = isMobile ? 60 : isTablet ? 72 : 88;
      var lo = Math.log10(2),
        hi = Math.log10(200);
      var x = Math.log10(Math.max(2, c));
      var t = (x - lo) / (hi - lo);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return Math.round(min + (max - min) * t);
    }
    function fontSizeForDiameter(d) {
      return Math.max(16, Math.round(d * 0.231));
    }
    function createClusterHtml(count) {
      var d = sizeForCount(count);
      var el = document.createElement("div");
      el.className = "custom-map-marker";
      el.style.transform = "translate(-50%,-50%)";
      el.style.width = d + "px";
      el.style.height = d + "px";
      el.style.minWidth = d + "px";
      el.style.minHeight = 60 + "px";
      var inner = document.createElement("div");
      inner.textContent = displayCount(count);
      inner.style.fontSize = fontSizeForDiameter(d) + "px";
      inner.style.lineHeight = "1";
      inner.style.fontWeight = "600";
      el.appendChild(inner);
      return el;
    }
    function computeClusters() {
      var z = map.getZoom();
      if (!clusterEnabledAtZoom(z)) return [];
      var f = clusterCellFactor(z);
      var vis = markers.filter((m) => markerShown(m));
      var bins = new Map();
      vis.forEach((m) => {
        var p = markerLatLng(m);
        if (!p) return;
        var t = projectToTile(p.lat, p.lng, z);
        var bx = Math.floor(t.x / f),
          by = Math.floor(t.y / f);
        var key = bx + ":" + by;
        var b = bins.get(key);
        if (!b) {
          b = { bx: bx, by: by, z: z, members: [], sumX: 0, sumY: 0 };
          bins.set(key, b);
        }
        b.members.push(m);
        b.sumX += t.x;
        b.sumY += t.y;
      });
      var clusters = [];
      bins.forEach((b) => {
        if (b.members.length <= 1) return;
        var cx = b.sumX / b.members.length;
        var cy = b.sumY / b.members.length;
        var cLL = tileToLatLng(cx, cy, b.z);
        clusters.push({ center: cLL, markers: b.members });
      });
      return clusters;
    }
    function boundsForMarkers(ms) {
      var b = new google.maps.LatLngBounds();
      var any = false;
      for (var i = 0; i < ms.length; i++) {
        var p = markerLatLng(ms[i]);
        if (!p) continue;
        b.extend(new google.maps.LatLng(p.lat, p.lng));
        any = true;
      }
      return any ? b : null;
    }
    function fitBoundsSmart(cluster) {
      var b = boundsForMarkers(cluster.markers);
      if (!b) {
        var current = map.getZoom();
        map.panTo(cluster.center);
        map.setZoom(Math.min(18, current + 2));
        return;
      }
      var pad = 24;
      var bottom = 24;
      if (panel && panelVisible()) {
        var h = panel.getBoundingClientRect().height || 0;
        bottom = Math.max(24, Math.round(h + 24));
      }
      var padding = { top: pad, right: pad, bottom: bottom, left: pad };
      var currentZoom = map.getZoom();
      var fixed = false;
      google.maps.event.addListenerOnce(map, "idle", function () {
        if (fixed) return;
        var z = map.getZoom();
        if (z <= currentZoom) {
          map.panTo(cluster.center);
          map.setZoom(Math.min(18, currentZoom + 1));
        }
        fixed = true;
      });
      map.fitBounds(b, padding);
    }
    function renderClusters() {
      // Don't create clusters when in country mode showing country pins
      if (countryMode && initialCountryZoom !== null) {
        var currentZoom = map.getZoom();
        if (currentZoom <= initialCountryZoom) {
          clearClusters();
          return;
        }
      }
      clearClusters();
      var clusters = computeClusters();
      if (!clusters.length) return;
      var clusteredSet = new Set();
      clusters.forEach((cl) => cl.markers.forEach((m) => clusteredSet.add(m)));
      markers.forEach((m) => {
        if (clusteredSet.has(m)) setMarkerVisible(m, false);
      });
      clusters.forEach((cl) => {
        var count = cl.markers.length;
        if (canUseAdvanced) {
          var el = createClusterHtml(count);
          var c = new google.maps.marker.AdvancedMarkerElement({
            map: map,
            position: cl.center,
            content: el,
            gmpClickable: true,
          });
          c.__advanced = true;
          c.addListener("gmp-click", async function () {
            if (panelVisible()) await hidePanel();
            fitBoundsSmart(cl);
          });
          clusterMarkers.push(c);
        } else {
          var Overlay = function (position, cluster) {
            this.position = position;
            this.cluster = cluster;
            this.div = null;
          };
          Overlay.prototype = new google.maps.OverlayView();
          Overlay.prototype.onAdd = function () {
            this.div = createClusterHtml(this.cluster.markers.length);
            this.getPanes().overlayMouseTarget.appendChild(this.div);
            this.div.addEventListener("click", async () => {
              if (panelVisible()) await hidePanel();
              fitBoundsSmart(this.cluster);
            });
          };
          Overlay.prototype.draw = function () {
            var proj = this.getProjection();
            if (!proj || !this.div) return;
            var p = proj.fromLatLngToDivPixel(
              new google.maps.LatLng(this.position.lat, this.position.lng)
            );
            this.div.style.position = "absolute";
            this.div.style.left = p.x + "px";
            this.div.style.top = p.y + "px";
          };
          Overlay.prototype.onRemove = function () {
            if (this.div && this.div.parentNode)
              this.div.parentNode.removeChild(this.div);
            this.div = null;
          };
          var ov = new Overlay(cl.center, cl);
          ov.setMap(map);
          clusterMarkers.push({
            __overlay: ov,
            setMap: function (m) {
              ov.setMap(m);
            },
          });
        }
      });
    }
    function updateClusters() {
      var currentZoom = map.getZoom();

      // If in country mode, check zoom level to decide what to show
      if (countryMode && initialCountryZoom !== null) {
        // Use exact same zoom level for switching (no gap)
        if (currentZoom <= initialCountryZoom) {
          // At or below initial zoom: Hide all store markers, show only country pins
          // Clear any clusters that might be showing
          markers.forEach((m) => {
            setMarkerVisible(m, false);
          });
          clearClusters();
          // Ensure no cluster markers are visible
          clusterMarkers.forEach((cm) => {
            if (cm.__advanced) cm.map = null;
            else if (cm.setMap) cm.setMap(null);
            if (cm.__overlay && cm.__overlay.setMap) cm.__overlay.setMap(null);
          });
          clusterMarkers = [];
          return;
        }
        // Zoom increased above initial: Show all store markers (map shows all pins, list filtered by search)
        markers.forEach((m) => {
          var card = markerToCard.get(m);
          setMarkerVisible(m, !!card);
        });
        // Continue to clustering logic below
      } else if (countryMode && !selectedCountryCode) {
        // Country mode but no initial zoom set yet, hide all store markers
        markers.forEach((m) => {
          setMarkerVisible(m, false);
        });
        clearClusters();
        return;
      } else if (countryMode && selectedCountryCode) {
        // If country mode is active with a selected country, show all markers for that country (map shows all pins)
        markers.forEach((m) => {
          var card = markerToCard.get(m);
          if (!card) {
            setMarkerVisible(m, false);
            return;
          }

          // Check if marker is from selected country
          var lat = n(
            card.querySelector("[data-latitude]")?.getAttribute("data-latitude")
          );
          var lng = n(
            card
              .querySelector("[data-longitude]")
              ?.getAttribute("data-longitude")
          );

          if (!isFinite(lat) || !isFinite(lng)) {
            setMarkerVisible(m, false);
            return;
          }

          var cardCountry = countryFromLatLng(lat, lng);
          setMarkerVisible(m, cardCountry === selectedCountryCode);
        });
        // Continue with clustering if there are visible markers
        var hasVisibleMarkers = markers.some((m) => {
          if (m.__advanced) return m.map === map;
          if (typeof m.getMap === "function") return m.getMap() === map;
          return !!m.map;
        });
        if (!hasVisibleMarkers) {
          clearClusters();
          return;
        }
      } else {
        // Normal mode: show all pins on map (list stays filtered by search)
        markers.forEach((m) => {
          var card = markerToCard.get(m);
          setMarkerVisible(m, !!card);
        });
      }

      var z = map.getZoom();
      if (!clusterEnabledAtZoom(z)) {
        clearClusters();
        return;
      }

      // Render clusters for visible markers
      renderClusters();
    }
    // Detect which country the map center is currently viewing (Requirement #3: zoom into country)
    function detectCountryFromMapCenter() {
      var center = map.getCenter();
      if (!center) return null;
      var centerLat = center.lat();
      var centerLng = center.lng();
      return countryFromLatLng(centerLat, centerLng);
    }

    // Animate marker visibility (Requirement #3: smooth animation)
    function animateMarkerVisibility(marker, visible, duration) {
      duration = duration || 300;
      if (marker.__advanced && marker.content) {
        var element = marker.content;
        if (visible) {
          element.style.opacity = "0";
          element.style.transform = "scale(0.8)";
          setMarkerVisible(marker, true);
          requestAnimationFrame(function () {
            element.style.transition =
              "opacity " +
              duration +
              "ms ease, transform " +
              duration +
              "ms ease";
            element.style.opacity = "1";
            element.style.transform = "scale(1)";
          });
        } else {
          element.style.transition =
            "opacity " +
            duration +
            "ms ease, transform " +
            duration +
            "ms ease";
          element.style.opacity = "0";
          element.style.transform = "scale(0.8)";
          setTimeout(function () {
            setMarkerVisible(marker, false);
          }, duration);
        }
      } else {
        setMarkerVisible(marker, visible);
      }
    }

    google.maps.event.addListener(map, "zoom_changed", function () {
      var currentZoom = map.getZoom();
      var zoomThreshold = initialCountryZoom || 4; // Use exact same zoom level (no +1)

      // Requirement #3 & #4: Switch between country pins and store markers based on zoom
      // Check zoom level regardless of countryMode state (to handle zoom out after card click)
      if (initialCountryZoom !== null) {
        if (currentZoom > zoomThreshold) {
          // Zoom increased beyond threshold: Always hide country pins, show store markers
          // Hide all country pins when zoom increases (at the same level store markers appear)
          countryMarkers.forEach(function (m) {
            if (m.__advanced) m.map = null;
            else if (m.__overlay && m.__overlay.setMap)
              m.__overlay.setMap(null);
            else if (m.setMap) m.setMap(null);
          });

          // Detect which country user is zooming into (Requirement #3)
          var detectedCountry = detectCountryFromMapCenter();

          if (detectedCountry && (countryMode || countryMarkers.length > 0)) {
            // Show stores for the detected country (Requirement #3: zoom into country triggers store display)
            if (
              !selectedCountryCode ||
              selectedCountryCode !== detectedCountry
            ) {
              showStoresForCountry(detectedCountry);
            }
          } else if (!selectedCountryCode) {
            // If no country detected but zoom increased, show all store markers
            markers.forEach(function (m) {
              var card = markerToCard.get(m);
              setMarkerVisible(m, !!card);
            });
          }
        } else if (currentZoom <= zoomThreshold) {
          // Zoom at or below threshold: Show country pins, hide store markers (Requirement #4)
          // Re-enable country mode if it was disabled
          if (!countryMode) {
            countryMode = true;
            // Recreate country markers if they were removed
            if (countryMarkers.length === 0) {
              createCountryMarkers();
            }
          }

          // Show country pins
          countryMarkers.forEach(function (m) {
            if (m.__advanced) m.map = map;
            else if (m.__overlay && m.__overlay.setMap) m.__overlay.setMap(map);
            else if (m.setMap) m.setMap(map);
          });

          // Hide store markers (Requirement #4)
          selectedCountryCode = null;
          markers.forEach(function (m) {
            setMarkerVisible(m, false);
          });
        }
      }

      updateClusters();
    });
    google.maps.event.addListener(map, "dragend", function () {
      updateClusters();
    });

    function exitCountryMode() {
      if (!countryMode) return;
      countryMode = false;
      selectedCountryCode = null;

      // Hide country markers (but don't remove them, so they can be shown again on zoom out)
      countryMarkers.forEach(function (m) {
        if (m.__advanced) m.map = null;
        else if (m.__overlay && m.__overlay.setMap) m.__overlay.setMap(null);
        else if (m.setMap) m.setMap(null);
      });
      // Don't clear countryMarkers array - keep them for zoom out functionality

      // show all store markers (map shows all pins, list filtered by search)
      markers.forEach(function (m) {
        var card = markerToCard.get(m);
        setMarkerVisible(m, !!card);
      });

      updateClusters();
    }

    function waitForListStable(timeoutMs, idleMs) {
      return new Promise((resolve) => {
        var target = listEl || document.body;
        var last = Date.now();
        var start = Date.now();
        var mo = new MutationObserver(function () {
          last = Date.now();
        });
        mo.observe(target, { childList: true, subtree: true });
        function tick() {
          var now = Date.now();
          if (now - last >= (idleMs || 400)) {
            mo.disconnect();
            resolve();
            return;
          }
          if (now - start >= (timeoutMs || 2000)) {
            mo.disconnect();
            resolve();
            return;
          }
          setTimeout(tick, 100);
        }
        setTimeout(tick, idleMs || 400);
      });
    }

    function tryAutoSearchFromIP() {
      return new Promise((resolve) => {
        if (!geo.ok || !geo.city || hasInteracted || !searchInput) {
          resolve();
          return;
        }
        var q = String(geo.city).trim();
        if (!q) {
          resolve();
          return;
        }
        var query = q + ", New Zealand";
        acService.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: allowedCountries },
          },
          function (preds, status) {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !preds ||
              !preds.length
            ) {
              resolve();
              return;
            }
            var choice = (function () {
              var c = preds.find(
                (p) =>
                  (p.types || []).includes("locality") ||
                  (p.types || []).includes("postal_town")
              );
              return c || preds[0];
            })();
            if (!choice) {
              resolve();
              return;
            }
            placesService.getDetails(
              {
                placeId: choice.place_id,
                fields: [
                  "geometry",
                  "name",
                  "formatted_address",
                  "address_components",
                ],
              },
              function (place, st) {
                if (
                  st !== google.maps.places.PlacesServiceStatus.OK ||
                  !place ||
                  !place.geometry
                ) {
                  resolve();
                  return;
                }
                var loc = place.geometry.location
                  ? toLiteral(place.geometry.location)
                  : null;
                if (!loc) {
                  resolve();
                  return;
                }
                var all = cardsAll()
                  .map((c) => ({ card: c, d: getCardData(c) }))
                  .filter((x) => isFinite(x.d.lat) && isFinite(x.d.lng));
                var near = all.filter((x) => {
                  var A = new google.maps.LatLng(loc.lat, loc.lng);
                  var B = new google.maps.LatLng(x.d.lat, x.d.lng);
                  return (
                    google.maps.geometry.spherical.computeDistanceBetween(
                      A,
                      B
                    ) /
                      1000 <=
                    30
                  );
                });
                if (!near.length) {
                  resolve();
                  return;
                }
                searchInput.value =
                  choice.description || place.formatted_address || q;
                applyFilterFrom(loc);
                resolve();
              }
            );
          }
        );
      });
    }

    google.maps.event.addListenerOnce(map, "idle", async function () {
      updateClusters();
      await waitForListStable(2500, 450);
      await new Promise((r) => setTimeout(r, 250));
      await tryAutoSearchFromIP();
      revealMap();
    });

    updateTotalStores();
  }
  ready(init);
})();
