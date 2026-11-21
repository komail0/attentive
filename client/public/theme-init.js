// Applies the saved theme, language and text size before first paint so nothing flashes.
(function () {
  var d = document.documentElement;
  try {
    var t = localStorage.getItem("att-theme");
    if (t !== "light" && t !== "dark") t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    d.dataset.theme = t;
    var l = localStorage.getItem("att-lang") === "ur" ? "ur" : "en";
    d.lang = l;
    d.dir = l === "ur" ? "rtl" : "ltr";
    d.dataset.size = localStorage.getItem("att-size") || "0";
  } catch (e) {
    d.dataset.theme = "dark";
  }
})();
