// Runs before first paint so the page never flashes the wrong theme.
(function () {
  var theme = "light";
  try {
    var saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") theme = saved;
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) theme = "dark";
  } catch (e) {}
  document.documentElement.dataset.theme = theme;
})();
