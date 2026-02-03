// ================================
// Home Hero Swiper
// ================================
const homeHeroSwipers = document.querySelectorAll('[swiper="home-hero"]');

if (homeHeroSwipers.length) {
  homeHeroSwipers.forEach((el) => {
    const progressBars = el.querySelectorAll(".swiper-progress-bar-h");

    // Exit if Swiper isn't loaded
    if (typeof Swiper === "undefined") return;

    new Swiper(el, {
      slidesPerView: 1,
      effect: "fade",
      loop: true,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      on: {
        init() {
          if (!progressBars.length) return;

          progressBars.forEach((bar) =>
            bar.classList.remove("animate", "active")
          );
          progressBars.forEach((bar) => bar.classList.add("active", "animate"));
        },
        slideChangeTransitionStart() {
          if (!progressBars.length) return;

          progressBars.forEach((bar) =>
            bar.classList.remove("animate", "active")
          );
          progressBars.forEach((bar) => bar.classList.add("active"));
        },
        slideChangeTransitionEnd() {
          if (!progressBars.length) return;

          progressBars.forEach((bar) => bar.classList.add("animate"));
        },
      },
    });
  });
}

// ================================
// Outcome Cards Hover
// ================================
const outcomeCards = document.querySelectorAll("[outcome-card]");
const defaultOutcomeCard = document.querySelector(
  "[outcome-card-default='true']"
);

if (outcomeCards.length) {
  if (defaultOutcomeCard) {
    defaultOutcomeCard.classList.add("active");
  }

  function setActive(card) {
    outcomeCards.forEach((c) => c.classList.remove("active"));
    if (card) card.classList.add("active");
  }

  outcomeCards.forEach((card) => {
    card.addEventListener("mouseenter", () => setActive(card));
    card.addEventListener("mouseleave", () => setActive(defaultOutcomeCard));
  });
}

// ================================
// Progress Swiper
// ================================
const progressSection = document.querySelector('[sec="progress"]');

if (progressSection && typeof Swiper !== "undefined") {
  const ppswiperEl = document.querySelector("[ppswiper]");

  if (ppswiperEl) {
    const ppswiper = new Swiper(ppswiperEl, {
      autoplay: {
        delay: 8000,
        disableOnInteraction: false,
      },
      slidesPerView: 1,
      on: {
        init() {
          startProgress(0);
          setupDotboxClick();
          updateActiveDot(0);
        },
        slideChange() {
          startProgress(ppswiper.activeIndex);
          updateActiveDot(ppswiper.activeIndex);
        },
      },
    });

    function startProgress(activeIndex) {
      const dotboxes = document.querySelectorAll("[ppslidebtn]");
      const lines = document.querySelectorAll("[ppslidebtn] .line");

      if (!dotboxes.length || !lines.length) return;

      dotboxes.forEach((dotbox, index) => {
        dotbox.classList.remove("progress-done");

        if (index < activeIndex) {
          lines[index].style.transition = "none";
          lines[index].style.width = "100%";
          dotbox.classList.add("progress-done");
        } else if (index === activeIndex) {
          lines[index].style.transition = "none";
          lines[index].style.width = "0%";

          setTimeout(() => {
            lines[index].style.transition = "width 8s linear";
            lines[index].style.width = "100%";
          }, 50);
        } else {
          lines[index].style.transition = "none";
          lines[index].style.width = "0%";
        }
      });
    }

    function setupDotboxClick() {
      document.querySelectorAll("[ppslidebtn]").forEach((dotbox, index) => {
        dotbox.addEventListener("click", () => {
          ppswiper.slideTo(index);
        });
      });
    }

    function updateActiveDot(activeIndex) {
      document.querySelectorAll("[ppslidebtn]").forEach((dotbox, index) => {
        dotbox.classList.toggle("activedot", index === activeIndex);
      });
    }

    // Body / section class switching
    ppswiper.on("slideChange", () => {
      const sliderWrap = document.querySelector("[sec='progress']");
      if (!sliderWrap) return;

      sliderWrap.classList.remove(
        "is-active-01",
        "is-active-02",
        "is-active-03",
        "is-active-04"
      );

      sliderWrap.classList.add(`is-active-0${ppswiper.activeIndex + 1}`);
    });
  }
}

// ================================
// Key Feature Swiper
// ================================
// const keySwiperEl = document.querySelector('[swiper="key-swiper"]');

// if (keySwiperEl && typeof Swiper !== "undefined") {
//   new Swiper(keySwiperEl, {
//     slidesPerView: 1,
//     initialSlide: 1,
//     centeredSlides: true,
//     spaceBetween: 24,
//     breakpoints: {
//       768: {
//         slidesPerView: 1.8,
//         spaceBetween: 24,
//       },
//       1200: {
//         slidesPerView: 3.5,
//         spaceBetween: 24,
//       },
//     },
//     navigation: {
//       nextEl: '[swiper-next="key-feature"]',
//       prevEl: '[swiper-prev="key-feature"]',
//     },
//   });
// }

document.addEventListener("DOMContentLoaded", function () {
  const slider = document.querySelector("#splide");

  if (!slider) return;

  const splide = new Splide(slider, {
    type: "loop",
    perPage: 3,
    perMove: 1,
    accessibility: true, // MUST be true (default)
    keyboard: "global", // or 'focused'
    // speed: 200,
    focus: "center",
    gap: "1.5rem",
    updateOnMove: true,
    autoplay: false,
    pagination: false,
    arrows: false, // âŒ disable default arrows

    breakpoints: {
      1024: { perPage: 2 },
      768: { perPage: 1 },
    },
  });

  splide.mount();

  // Custom arrow actions
  document.querySelector("[splide-prev]").addEventListener("click", () => {
    splide.go("<");
  });

  document.querySelector("[splide-next]").addEventListener("click", () => {
    splide.go(">");
  });
});

// ================================
// Testimonial Swiper
// ================================
const testimonialSwipers = document.querySelectorAll('[swiper="testimonial"]');

if (testimonialSwipers.length && typeof Swiper !== "undefined") {
  const testimonialPrevBtns = document.querySelectorAll(
    '[swiper-prev="testimonial"]'
  );
  const testimonialNextBtns = document.querySelectorAll(
    '[swiper-next="testimonial"]'
  );

  // testimonialSwipers.forEach((el, index) => {
  //   const progressBars = el.querySelectorAll(".swiper-progress-bar");
  testimonialSwipers.forEach((el, index) => {
    const wrapper = el.closest("[testimonial-section]"); // your common wrapper
    const progressBars = wrapper.querySelectorAll(".swiper-progress-bar");

    // Safely resolve navigation buttons per instance
    const prevBtn = testimonialPrevBtns[index] || null;
    const nextBtn = testimonialNextBtns[index] || null;

    new Swiper(el, {
      slidesPerView: 1,
      effect: "fade",
      loop: true,
      allowTouchMove: false,
      autoplay: {
        delay: 5000,
        disableOnInteraction: false,
      },
      navigation:
        prevBtn && nextBtn
          ? {
              nextEl: nextBtn,
              prevEl: prevBtn,
            }
          : undefined,
      on: {
        init() {
          if (!progressBars.length) return;

          progressBars.forEach((bar) =>
            bar.classList.remove("animate", "active")
          );

          progressBars[0].classList.add("animate", "active");
        },
        slideChangeTransitionStart() {
          if (!progressBars.length) return;

          progressBars.forEach((bar) =>
            bar.classList.remove("animate", "active")
          );

          progressBars[0].classList.add("active");
        },
        slideChangeTransitionEnd() {
          if (!progressBars.length) return;

          progressBars[0].classList.add("animate");
        },
      },
    });
  });
}
