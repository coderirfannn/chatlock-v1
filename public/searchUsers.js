document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const userCards = document.querySelectorAll(".user-filter-card");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    userCards.forEach((card) => {
      const username = card.getAttribute("data-username");
      const email = card.getAttribute("data-email");

      const matches = username.includes(query) || email.includes(query);
      card.style.display = matches ? "block" : "none";
    });
  });
});
