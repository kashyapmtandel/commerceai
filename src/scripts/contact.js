document.addEventListener('DOMContentLoaded', function () {
  var contactForm = document.getElementById('contactForm');
  var successMessage = document.getElementById('successMessage');

  if (!contactForm || !successMessage) return;

  if (window.location.search.includes('sent=true')) {
    contactForm.style.display = 'none';
    successMessage.style.display = 'block';
  }
});
