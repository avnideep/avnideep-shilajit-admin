// Mobile Sidebar Toggle with smooth animations
(function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const menuToggle = document.getElementById('menuToggle');
  
  window.toggleSidebar = function() {
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', isOpen);
      menuToggle.textContent = isOpen ? '✕' : '☰';
    }
  };
  
  window.closeSidebar = function() {
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = '☰';
    }
  };
  
  // Close sidebar on nav link click
  document.addEventListener('DOMContentLoaded', function() {
    closeSidebar();
    document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
      link.addEventListener('click', closeSidebar);
    });
    // Keyboard: Escape to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeSidebar();
    });
  });
})();
