$("form").each(function () {
  $(this).validate({
    errorPlacement: function (error, element) {
      error.appendTo(element.closest("[form-field='wrap']"));
    },
  });
});

document.addEventListener("DOMContentLoaded", function () {
  var successMessages = document.querySelectorAll("[success-msg]");

  successMessages.forEach(function (successMessage) {
    var formWrapper = successMessage.closest("[form-wrapper]");

    if (!formWrapper) {
      formWrapper =
        successMessage.parentElement.querySelector("[form-wrapper]");

      if (!formWrapper) return;
    }

    var observer = new MutationObserver(function () {
      if (successMessage.style.display == "block") {
        var sectionOffsetTop = formWrapper.offsetTop;

        setTimeout(function () {
          window.scrollTo({
            top: sectionOffsetTop,
            left: 0,
            behavior: "smooth",
          });
        }, 400);
      }
    });

    observer.observe(successMessage, { attributes: true, childList: true });
  });
});
