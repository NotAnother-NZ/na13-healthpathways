const humbergerbtn = document.querySelector("[nav-menu-btn]");
const CloseBtn = document.querySelector("[nav-menu='close']");
const OpenBtn = document.querySelector("[nav-menu='open']");

const observer = new MutationObserver(() => {
  if (humbergerbtn.classList.contains("w--open")) {
    CloseBtn.style.display = "flex";
    OpenBtn.style.display = "none";
  } else {
    CloseBtn.style.display = "none";
    OpenBtn.style.display = "flex";
  }
});

observer.observe(humbergerbtn, {
  attributes: true,
  attributeFilter: ["class"],
});

const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
console.log(scrollBarWidth);

const navbar = document.querySelector("[navbar]");
new MutationObserver(() =>
  navbar.classList.toggle(
    "menu-open",
    humbergerbtn.classList.contains("w--open")
  )
).observe(humbergerbtn, { attributes: true, attributeFilter: ["class"] });

// Script for announcementbar start here
const announcementbar = document.querySelector("[announce-bar]");
if (announcementbar) {
  let announcementHeight = announcementbar.scrollHeight + "px";
  announcementbar.style.height = announcementHeight;

  window.addEventListener("scroll", function () {
    if (window.scrollY >= 100) {
      announcementbar.style.height = "0px";
    } else {
      announcementbar.style.height = announcementHeight;
    }
  });
}

const footeSpace = document.querySelector("[footer-space]");
const mainFooter = document.querySelector("[mainfooter]");

function updateFooterSpace() {
  if (mainFooter && footeSpace) {
    const footerHeight = mainFooter.scrollHeight + "px";
    console.log(footerHeight);
    footeSpace.style.height = footerHeight;
  }
}

// Run on initial load
updateFooterSpace();

// Run on window resize with debouncing
let resizeTimeout;
window.addEventListener("resize", function () {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(updateFooterSpace, 150);
});

// Start js for adding the class in body on scroll
// document.addEventListener("DOMContentLoaded", () => {
//   const heroSection = document.querySelector('[hero="section"]');

//   if (!heroSection) return;

//   const heroHeight = heroSection.offsetHeight;

//   window.addEventListener("scroll", () => {
//     if (window.scrollY > heroHeight) {
//       document.body.classList.add("page-scrolled");
//     } else {
//       document.body.classList.remove("page-scrolled");
//     }
//   });
// });

// Start js for adding the class in body on scroll
document.addEventListener("DOMContentLoaded", () => {
  const scrollOffset = 120;

  const checkScroll = () => {
    if (window.scrollY > scrollOffset) {
      document.body.classList.add("page-scrolled");
    } else {
      document.body.classList.remove("page-scrolled");
    }
  };

  // Run immediately (for already-scrolled pages)
  checkScroll();

  // Run on scroll
  window.addEventListener("scroll", checkScroll);
});

const footerWrap = document.querySelector("[footer-space]");
const mainNavbar = document.querySelector("[navbar]");

// Delay ScrollTrigger by 2 seconds
setTimeout(() => {
  if (footerWrap && mainNavbar) {
    const isMobile = window.innerWidth <= 768;
    const startValue = isMobile ? "top 99%" : "top 50%";

    ScrollTrigger.create({
      trigger: footerWrap,
      start: startValue,
      // markers: true,
      onEnter: () =>
        gsap.to(mainNavbar, { y: "-100%", duration: 0.4, ease: "power2.out" }),
      onLeaveBack: () =>
        gsap.to(mainNavbar, { y: "0%", duration: 0.4, ease: "power2.out" }),
    });
  }
}, 100); // 2 seconds delay

//Script for overflow hidden and start,
$('[overflowhide="active"]').click(function (e) {
  e.preventDefault();
  document.body.style.paddingRight = `${scrollBarWidth}px`;
  $("body").css("overflow", "hidden");
});

$('[overflowhide="inactive"]').click(function (e) {
  e.preventDefault();
  $("body").css("overflow", "auto");
  document.body.style.paddingRight = "";
});

$(".nav-close").click(function () {
  $(".nav-menu-btn").click();
});

document.addEventListener("DOMContentLoaded", function () {
  function addClickListeners() {
    var navMenuLinks = document.querySelectorAll("[navbar] .w-nav-menu a");
    var closeButton = document.querySelector("[nav-menu-btn]");

    // Prevent adding duplicate listeners
    navMenuLinks.forEach(function (link) {
      link.removeEventListener("click", handleClick); // remove existing
      link.addEventListener("click", handleClick); // add new
    });

    function handleClick() {
      if (closeButton) closeButton.click();
    }
  }

  addClickListeners();

  // Reattach on resize (optional, in case elements change)
  window.addEventListener("resize", addClickListeners);
});

(function () {
  function initAccordion() {
    const groups = document.querySelectorAll("[accordian-list]");

    groups.forEach((group, groupIndex) => {
      const items = group.querySelectorAll("[accordian]");

      items.forEach((item, itemIndex) => {
        const head = item.querySelector("[accordian-head]");
        const body = item.querySelector("[accordian-body]");

        if (!head || !body) return;

        /* -----------------------------
           Generate unique IDs
        ----------------------------- */
        const headId = `faq-head-${groupIndex}-${itemIndex}`;
        const bodyId = `faq-panel-${groupIndex}-${itemIndex}`;

        head.id = headId;
        body.id = bodyId;

        /* -----------------------------
           ARIA setup
        ----------------------------- */
        head.setAttribute("aria-controls", bodyId);
        head.setAttribute("aria-expanded", "false");

        body.setAttribute("role", "region");
        body.setAttribute("aria-labelledby", headId);

        /* -----------------------------
           Initial styles (height animation)
        ----------------------------- */
        body.style.overflow = "hidden";
        body.style.transition = "height 0.3s ease";

        // Close all by default
        body.style.height = "0px";

        // Open if `.open` class exists
        if (head.classList.contains("open")) {
          body.style.height = body.scrollHeight + "px";
          head.setAttribute("aria-expanded", "true");
        }

        /* -----------------------------
           Toggle logic
        ----------------------------- */
        const toggleAccordion = () => {
          const isOpen = head.getAttribute("aria-expanded") === "true";

          // Close all in this group
          items.forEach((i) => {
            const h = i.querySelector("[accordian-head]");
            const b = i.querySelector("[accordian-body]");

            h.classList.remove("open");
            h.setAttribute("aria-expanded", "false");
            b.style.height = "0px";
          });

          // Open current if it was closed
          if (!isOpen) {
            head.classList.add("open");
            head.setAttribute("aria-expanded", "true");
            body.style.height = body.scrollHeight + "px";
          }
        };

        /* -----------------------------
           Events
        ----------------------------- */
        head.addEventListener("click", toggleAccordion);

        head.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleAccordion();
          }
        });
      });
    });
  }

  /* Safe init */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccordion);
  } else {
    initAccordion();
  }
})();

$(document).ready(function () {
  $("[accordian-head]").first().trigger("click");
});

document.querySelectorAll("[navbar] a").forEach((link) => {
  link.addEventListener("click", () => {
    document.body.style.overflow = "auto";
    document.body.style.paddingRight = "";
  });
});

$("input").on("input", function () {
  this.value = this.value.replace(/^\s+/, "");
});

document.addEventListener("DOMContentLoaded", function () {
  var urlField = document.querySelector("input[page-url]");
  if (urlField) {
    urlField.value = window.location.href;
  }
});

document.addEventListener("DOMContentLoaded", function () {
  var urlField = document.querySelector("input[page-url]");
  var nameField = document.querySelector("input[page-name]");

  if (urlField) {
    urlField.value = window.location.href;
  }

  if (nameField) {
    // Use the document title as page name
    nameField.value = document.title;
  }
});
