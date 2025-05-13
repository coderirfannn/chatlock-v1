   // Current user context
    const currentUserId = "<%= user._id %>";
    const socket = io("/ChatLock", {
      auth: { token: currentUserId },
      transports: ['websocket']
    });

    // State management
    const userUnreadCounts = {};
    let currentChatUserId = null;
    let isUserInChat = false;
    let notifications = [];
    let allUsers = JSON.parse('<%- JSON.stringify(allUser) %>');
    let isSearching = false;
    let darkMode = localStorage.getItem('darkMode') === 'true';

    // DOM Elements
    const notificationList = document.getElementById('notificationList');
    const searchResults = document.getElementById('searchResults');
    const themeToggle = document.getElementById('themeToggle');
    const themeToggleMobile = document.getElementById('themeToggleMobile');
    const notificationPrompt = document.getElementById('notificationPrompt');
    const enableNotificationsBtn = document.getElementById('enableNotifications');
    const dismissPromptBtn = document.getElementById('dismissPrompt');
    const messageNotification = document.getElementById('messageNotification');
    const mobileUnreadBadge = document.getElementById('mobileUnreadBadge');

    // Initialize dark mode
    function initDarkMode() {
      if (darkMode) {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        themeToggleMobile.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        document.body.classList.remove('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        themeToggleMobile.innerHTML = '<i class="fas fa-moon"></i>';
      }
    }

    // Toggle dark mode
    function toggleDarkMode() {
      darkMode = !darkMode;
      localStorage.setItem('darkMode', darkMode);
      initDarkMode();
    }

    // Check notification permission and show prompt if needed
    function checkNotificationPermission() {
      if ('Notification' in window && Notification.permission === 'default') {
        // Only show prompt on mobile devices
        if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          setTimeout(() => {
            notificationPrompt.classList.remove('hidden');
          }, 5000);
        }
      }
    }

    // Request notification permission
    async function requestNotificationPermission() {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Register service worker for push notifications
          if ('serviceWorker' in navigator) {
            try {
              const registration = await navigator.serviceWorker.register('/sw.js');
              console.log('Service Worker registered:', registration);

              // Subscribe to push notifications
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY' // Replace with your VAPID public key
              });

              // Send subscription to server
              await fetch('/api/v1/user/push-subscribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ subscription })
              });

              notificationPrompt.classList.add('hidden');
              showToast('Notifications enabled!', 'success');
            } catch (err) {
              console.error('Service Worker registration failed:', err);
              showToast('Failed to enable notifications', 'error');
            }
          }
        } else {
          showToast('Notifications blocked', 'warning');
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
        showToast('Error enabling notifications', 'error');
      }
    }

    // Show message notification
    function showMessageNotification(data) {
      const notification = document.getElementById('messageNotification');
      const avatar = document.getElementById('messageNotificationAvatar');
      const sender = document.getElementById('messageNotificationSender');
      const text = document.getElementById('messageNotificationText');
      
      avatar.src = data.senderAvatar || 'https://res.cloudinary.com/dzdnwsojc/image/upload/v1746804708/rkwqxwswd9plkd7wpoy7.jpg';
      sender.textContent = data.senderName;
      text.textContent = data.preview;
      
      notification.classList.remove('hidden');
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        notification.classList.add('hidden');
      }, 5000);
      
      // Click handler to open chat
      notification.onclick = () => {
        window.location.href = `/api/v1/user/chat/${data.senderId}`;
      };
    }

    // Handle incoming push notifications
    function handlePushNotification(data) {
      if (!document.hasFocus()) {
        const title = `New message from ${data.senderName}`;
        const options = {
          body: data.preview,
          icon: data.senderAvatar || '/default-avatar.png',
          data: { url: `/api/v1/user/chat/${data.senderId}` },
          vibrate: [200, 100, 200]
        };

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, options);
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, options);
        }
      }
    }

    // Fetch initial unread counts from server
    async function fetchInitialUnreadCounts() {
      try {
        const response = await fetch('/api/v1/user/unread-count', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        const data = await response.json();
        if (data.success) {
          Object.assign(userUnreadCounts, data.unreadCounts);
          updateGlobalUnreadCount();
          Object.entries(userUnreadCounts).forEach(([userId, count]) => {
            updateUserBadge(userId, count);
          });
        }
      } catch (err) {
        console.error('Error fetching unread counts:', err);
      }
    }

    // Initialize notification badges
    function initializeBadges() {
      allUsers.forEach(user => {
        if (user.unreadCount > 0) {
          userUnreadCounts[user._id] = user.unreadCount;
        }
      });
      updateGlobalUnreadCount();
    }

    function checkActiveChat() {
      const chatMatch = window.location.pathname.match(/\/chat\/([^\/]+)/);
      currentChatUserId = chatMatch ? chatMatch[1] : null;
      isUserInChat = currentChatUserId && currentChatUserId !== currentUserId;
    }

    function updateUserStatus(userId, isOnline) {
      const userElement = document.querySelector(`a[href="/api/v1/user/chat/${userId}"]`);
      if (!userElement) return;

      const statusElement = userElement.querySelector('p.text-sm');
      if (statusElement) {
        statusElement.innerHTML = isOnline ? '<span class="online-status">Online</span>' : '<span class="offline-status">Offline</span>';
      }
    }

    function updateUserBadge(userId, count) {
      const avatarContainer = document.querySelector(`a[href="/api/v1/user/chat/${userId}"] .relative`);
      if (!avatarContainer) return;

      let badge = avatarContainer.querySelector('.notification-badge');

      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'notification-badge';
          avatarContainer.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    }

    function showDesktopNotification(data) {
      if (!("Notification" in window)) return;

      if (Notification.permission === "granted") {
        new Notification(`${data.senderName} sent a message`, {
          body: data.preview,
          icon: data.senderAvatar,
          vibrate: [200, 100, 200],
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            new Notification(`${data.senderName} sent a message`, {
              body: data.preview,
              icon: data.senderAvatar,
              vibrate: [200, 100, 200],
            });
          }
        });
      }
    }

    function updateGlobalUnreadCount() {
      const globalBadge = document.getElementById('unreadCount');
      const sidebarBadge = document.getElementById('sidebarUnreadCount');
      const mobileBadge = document.getElementById('mobileUnreadBadge');

      if (globalBadge || sidebarBadge || mobileBadge) {
        const total = Object.values(userUnreadCounts).reduce((a, b) => a + b, 0);

        if (globalBadge) {
          globalBadge.textContent = total > 99 ? '99+' : total;
          globalBadge.style.display = total > 0 ? 'flex' : 'none';
        }

        if (sidebarBadge) {
          sidebarBadge.textContent = total > 99 ? '99+' : total;
          sidebarBadge.style.display = total > 0 ? 'flex' : 'none';
        }

        if (mobileBadge) {
          mobileBadge.textContent = total > 99 ? '99+' : total;
          mobileBadge.style.display = total > 0 ? 'flex' : 'none';
        }
      }
    }

    // Render notifications
    async function renderNotifications() {
      const container = document.getElementById('notificationItems');
      container.innerHTML = '<div class="p-4 flex justify-center"><div class="spinner"></div></div>';

      try {
        const res = await fetch('/api/v1/user/notifications-all', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        const data = await res.json();

        if (data.success) {
          notifications = data.notifications;
          container.innerHTML = '';

          if (notifications.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-gray-500">No notifications yet</div>';
            return;
          }

          notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `dropdown-item cursor-pointer ${notification.isRead ? '' : 'bg-primary-light'}`;
            item.dataset.id = notification._id;

            const isRead = notification.isRead || false;
            const readIcon = isRead ? '<i class="fas fa-check-circle text-success ml-2" title="Read"></i>' : '';

            item.innerHTML = `
              <div class="flex items-start gap-3">
                <div class="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  ${notification.senderDetails?.profilePic
                    ? `<img src="${notification.senderDetails.profilePic}" alt="${notification.senderDetails.username}" class="h-full w-full object-cover">`
                    : `<i class="fas fa-user text-gray-500 flex items-center justify-center h-full w-full"></i>`}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center">
                    <p class="text-sm font-medium text-gray-900 truncate">${notification.senderDetails?.username || 'System'}</p>
                    ${readIcon}
                  </div>
                  <p class="text-sm text-gray-600 truncate">${notification.message}</p>
                  <p class="text-xs text-gray-400 mt-1">${formatTime(notification.createdAt)}</p>
                </div>
              </div>
            `;

            // Mark notification as read when clicked
            item.addEventListener('click', async () => {
              if (!isRead) {
                try {
                  await fetch(`/api/v1/user/notifications/${notification._id}/mark-viewed`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                  });

                  // Update the unread count for this user
                  if (notification.senderDetails?._id) {
                    if (userUnreadCounts[notification.senderDetails._id] > 0) {
                      userUnreadCounts[notification.senderDetails._id]--;
                      updateUserBadge(notification.senderDetails._id, userUnreadCounts[notification.senderDetails._id]);
                      updateGlobalUnreadCount();
                    }
                  }

                  notification.isRead = true;
                  item.classList.remove('bg-primary-light');
                  item.querySelector('.text-success')?.remove(); // Remove any existing read icon
                  const usernameElement = item.querySelector('.text-gray-900');
                  if (usernameElement) {
                    usernameElement.insertAdjacentHTML('afterend', '<i class="fas fa-check-circle text-success ml-2" title="Read"></i>');
                  }
                } catch (err) {
                  console.error('Failed to mark individual notification as viewed:', err);
                }
              }

              // Navigate to chat
              if (notification.senderDetails?._id) {
                window.location.href = `/api/v1/user/chat/${notification.senderDetails._id}`;
              }
            });

            container.appendChild(item);
          });
        }
      } catch (err) {
        console.error('Error loading notifications:', err);
        container.innerHTML = '<div class="p-4 text-center text-gray-500">Error loading notifications</div>';
      }
    }

    async function markAllNotificationsAsRead() {
      try {
        const response = await fetch('/api/v1/user/notifications/mark-all-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.ok) {
          // Reset unread badge counts
          Object.keys(userUnreadCounts).forEach(id => {
            userUnreadCounts[id] = 0;
            updateUserBadge(id, 0);
          });
          updateGlobalUnreadCount();
          await renderNotifications(); // Refresh the notification list
          showToast("All notifications marked as read!", "success");
        }
      } catch (err) {
        console.error("Error marking notifications as read:", err);
        showToast("Failed to mark notifications as read.", "error");
      }
    }

    // Update the notification button click handler
    document.getElementById('notificationBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (notificationList.classList.contains('show')) {
        notificationList.classList.remove('show');
        setTimeout(() => {
          notificationList.style.display = 'none';
        }, 200);
        return;
      }

      notificationList.style.display = 'block';
      setTimeout(() => {
        notificationList.classList.add('show');
      }, 10);

      await renderNotifications();
    });

    // Update the mark all as read button
    document.getElementById('markDropdownRead')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const markReadSpinner = document.getElementById('markReadSpinner');
      markReadSpinner.classList.remove('hidden');

      try {
        await markAllNotificationsAsRead();
      } finally {
        markReadSpinner.classList.add('hidden');
      }
    });

    function formatTime(timestamp) {
      const now = new Date();
      const date = new Date(timestamp);
      const diffInSeconds = Math.floor((now - date) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    async function searchUsers(query) {
      const resultsContainer = document.getElementById('searchResults');
      const searchLoading = document.getElementById('searchLoading');

      if (query.trim() === '') {
        resultsContainer.classList.remove('show');
        searchLoading.classList.add('hidden');
        isSearching = false;
        return;
      }

      if (!isSearching) {
        isSearching = true;
        searchLoading.classList.remove('hidden');
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('show');
      }

      // Debounce search to avoid too many requests
      await new Promise(resolve => setTimeout(resolve, 500));

      const filteredUsers = allUsers.filter(user =>
        user.username.toLowerCase().includes(query.toLowerCase())
      );

      searchLoading.classList.add('hidden');
      resultsContainer.innerHTML = '';

      if (filteredUsers.length === 0) {
        resultsContainer.innerHTML = '<div class="p-4 text-gray-500 text-center">No users found</div>';
        resultsContainer.classList.add('show');
        isSearching = false;
        return;
      }

      filteredUsers.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div class="flex items-center">
            <img src="${user.profilePic}" alt="${user.username}" class="w-10 h-10 rounded-full mr-3 object-cover">
            <div class="min-w-0">
              <div class="font-medium text-gray-800 truncate">@${user.username}</div>
              <div class="text-sm ${user.isOnline === 1 ? 'online-status' : 'offline-status'} truncate">
                ${user.isOnline === 'true' ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        `;
        item.addEventListener('click', () => {
          window.location.href = `/api/v1/user/chat/${user._id}`;
        });
        resultsContainer.appendChild(item);
      });

      resultsContainer.classList.add('show');
      isSearching = false;
    }

    // Socket.IO Event Listeners
    socket.on("user_online", (userId) => updateUserStatus(userId, true));
    socket.on("user_offline", (userId) => updateUserStatus(userId, false));

    socket.on('new_message_notification', (data) => {
      checkActiveChat();

      if (!userUnreadCounts[data.senderId]) {
        userUnreadCounts[data.senderId] = 0;
      }

      const recipientStatus = document.getElementById(`${data.senderId}-status`)?.textContent;
      const isRecipientOnline = recipientStatus === 'Online';

      if (!isRecipientOnline || !isUserInChat) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile && 'serviceWorker' in navigator) {
          try {
            const registration = navigator.serviceWorker.ready;
            registration.then(reg => {
              reg.showNotification(`New message from ${data.senderName}`, {
                body: data.preview,
                icon: data.senderAvatar || '/default-avatar.png',
                data: { url: `/api/v1/user/chat/${data.senderId}` },
                vibrate: [200, 100, 200]
              });
            });
          } catch (err) {
            console.error('Mobile notification failed:', err);
            handleInAppNotification(data);
          }
        } else {
          handleInAppNotification(data);
          if (!document.hasFocus()) showDesktopNotification(data);
        }

        updateUnreadCount();

        if (!isUserInChat || data.senderId !== currentChatUserId) {
          userUnreadCounts[data.senderId]++;
          updateUserBadge(data.senderId, userUnreadCounts[data.senderId]);
          updateGlobalUnreadCount();

          // Show in-app notification
          if (document.hasFocus()) {
            showMessageNotification(data);
          }

          notifications.unshift({
            senderDetails: {
              _id: data.senderId,
              username: data.senderName,
              profilePic: data.senderAvatar
            },
            message: data.preview,
            createdAt: new Date().toISOString(),
            isRead: false
          });

          if (notificationList.classList.contains('show')) {
            renderNotifications();
          }

          if (!document.hasFocus()) {
            showDesktopNotification(data);
          }
        }
      }
    });

    async function updateUnreadCount() {
      try {
        const res = await fetch('/api/v1/user/notifications/unread-count');
        const { count } = await res.json();
        unreadNotifications = count;
        updateNotificationBadge();
      } catch (err) {
        console.error('Failed to get unread count:', err);
      }
    }

    // DOM Event Listeners
    document.getElementById('markAllReadButton')?.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/v1/user/notifications/mark-all-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.ok) {
          Object.keys(userUnreadCounts).forEach(id => {
            userUnreadCounts[id] = 0;
            updateUserBadge(id, 0);
          });

          updateGlobalUnreadCount();
          showToast("All notifications marked as read!", "success");
        } else {
          showToast("Failed to mark notifications as read.", "error");
        }
      } catch (err) {
        console.error("Error marking notifications as read:", err);
        showToast("An error occurred while marking notifications as read.", "error");
      }
    });

    document.getElementById('markDropdownRead')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const markReadSpinner = document.getElementById('markReadSpinner');
      markReadSpinner.classList.remove('hidden');

      try {
        const response = await fetch('/api/v1/user/notifications/mark-all-read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (response.ok) {
          Object.keys(userUnreadCounts).forEach(id => {
            userUnreadCounts[id] = 0;
            updateUserBadge(id, 0);
          });

          updateGlobalUnreadCount();
          await renderNotifications();
          showToast("All notifications marked as read!", "success");
        }
      } catch (err) {
        console.error("Error marking notifications as read:", err);
        showToast("Failed to mark notifications as read.", "error");
      } finally {
        markReadSpinner.classList.add('hidden');
      }
    });

    document.getElementById('notificationBtn')?.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (notificationList.classList.contains('show')) {
        notificationList.classList.remove('show');
        setTimeout(() => {
          notificationList.style.display = 'none';
        }, 200);
        return;
      }

      notificationList.style.display = 'block';
      setTimeout(() => {
        notificationList.classList.add('show');
      }, 10);

      await renderNotifications();
    });

    document.getElementById('userSearch')?.addEventListener('input', (e) => {
      searchUsers(e.target.value);
    });

    document.getElementById('closeMessageNotification')?.addEventListener('click', (e) => {
      e.stopPropagation();
      messageNotification.classList.add('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notificationBtn') && !e.target.closest('#notificationList')) {
        notificationList.classList.remove('show');
        setTimeout(() => {
          notificationList.style.display = 'none';
        }, 200);
      }

      if (!e.target.closest('#userSearch') && !e.target.closest('#searchResults')) {
        searchResults.classList.remove('show');
        setTimeout(() => {
          searchResults.style.display = 'none';
        }, 200);
      }
    });

    document.getElementById('menuToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.add('open');
    });

    document.getElementById('closeSidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    });

    document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('open');
    });

    // Theme toggle listeners
    themeToggle?.addEventListener('click', toggleDarkMode);
    themeToggleMobile?.addEventListener('click', toggleDarkMode);

    // Notification permission listeners
    enableNotificationsBtn?.addEventListener('click', requestNotificationPermission);
    dismissPromptBtn?.addEventListener('click', () => {
      notificationPrompt.classList.add('hidden');
    });

    // Add loading state for user clicks
    document.querySelectorAll('.user-link').forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const userItem = link.closest('.user-item');
        const href = link.getAttribute('href');

        userItem.classList.add('user-item-loading');

        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          window.location.href = href;
        } catch (err) {
          console.error('Error navigating to chat:', err);
          userItem.classList.remove('user-item-loading');
        }
      });
    });

    // Toast notification function
    function showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white ${type === 'success' ? 'bg-success' :
        type === 'error' ? 'bg-danger' :
          type === 'warning' ? 'bg-warning' : 'bg-primary'
        }`;
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Initialize with loading states
    async function initializeApp() {
      const loadingOverlay = document.getElementById('loadingOverlay');
      const userListSkeleton = document.getElementById('userListSkeleton');
      const userListContent = document.getElementById('userListContent');
      const emptyState = document.getElementById('emptyState');

      // Initialize dark mode
      initDarkMode();

      // Check notification permissions
      checkNotificationPermission();

      userListSkeleton.classList.remove('hidden');
      userListContent.classList.add('hidden');

      // Fetch initial unread counts
      await fetchInitialUnreadCounts();

      setTimeout(() => {
        userListSkeleton.classList.add('hidden');
        userListContent.classList.remove('hidden');

        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
        }, 300);

        initializeBadges();
        checkActiveChat();

        // Show empty state if no users
        if (allUsers.length === 0) {
          emptyState.classList.remove('hidden');
        }
      }, 1000);
    }

    // Window event listeners
    window.addEventListener('load', initializeApp);
    window.addEventListener('focus', () => {
      if (currentChatUserId) {
        userUnreadCounts[currentChatUserId] = 0;
        updateUserBadge(currentChatUserId, 0);
        updateGlobalUnreadCount();
      }
    });