// Avnideep Admin PWA Features v1
(function() {
  'use strict';

  // ====== INSTALL PROMPT ======
  var deferredPrompt = null;
  var installBtn = document.getElementById('installAppBtn');
  var installBanner = document.getElementById('installBanner');

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallUI();
  });

  function showInstallUI() {
    if (installBtn) {
      installBtn.style.display = 'flex';
    }
    if (installBanner) {
      installBanner.classList.add('show');
    }
  }

  function hideInstallUI() {
    if (installBtn) {
      installBtn.style.display = 'none';
    }
    if (installBanner) {
      installBanner.classList.remove('show');
    }
  }

  window.installApp = function() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(choiceResult) {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        hideInstallUI();
      }
      deferredPrompt = null;
    });
  };

  window.addEventListener('appinstalled', function() {
    console.log('PWA was installed');
    hideInstallUI();
    if (installBtn) {
      installBtn.innerHTML = '✅ Installed';
      installBtn.disabled = true;
    }
  });

  // Check if already in standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    // Hide install UI if already installed
    hideInstallUI();
    if (installBtn) {
      installBtn.style.display = 'none';
    }
  }

  // ====== OFFLINE DETECTION ======
  var offlineIndicator = document.getElementById('offlineIndicator');

  function updateOnlineStatus() {
    if (offlineIndicator) {
      if (!navigator.onLine) {
        offlineIndicator.classList.add('show');
        offlineIndicator.innerHTML = '📡 You are offline - showing cached data';
      } else {
        offlineIndicator.classList.remove('show');
      }
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Initial check
  updateOnlineStatus();

  // ====== SERVICE WORKER MESSAGES ======
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.type === 'DASHBOARD_REFRESHED') {
        // Dashboard data was refreshed in background
        var eventDashRefresh = new CustomEvent('dashboardRefreshed', {
          detail: { timestamp: event.data.timestamp }
        });
        window.dispatchEvent(eventDashRefresh);
      }
    });
  }

  // ====== SERVICE WORKER REGISTRATION ======
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').then(function(reg) {
        console.log('SW registered: ' + reg.scope);
        
        // Check for updates
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function() {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available - notify user to refresh
              console.log('New version available! Please refresh.');
            }
          });
        });
      }).catch(function(err) {
        console.warn('SW registration failed: ' + err);
      });
      
      // Check for SW updates every hour
      setInterval(function() {
        reg.update();
      }, 3600000);
    });
  }

  // ====== DYNAMIC CACHE-INDIVIDUAL-PAGE ======
  window.cacheCurrentPage = function() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_PAGE',
        url: window.location.href
      });
    }
  };

  // Cache current page after load
  if (document.readyState === 'complete') {
    setTimeout(cacheCurrentPage, 1000);
  } else {
    window.addEventListener('load', function() {
      setTimeout(cacheCurrentPage, 1000);
    });
  }

})();
