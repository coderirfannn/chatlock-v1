const currentUserId = "<%= user._id %>";
    const socket = io("/ChatLock", {
      auth: { token: currentUserId }
    });

      let unreadNotifications = 0;
    let isUserInChat = false;
    let currentChatUserId = null;



        const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBadge = document.getElementById('notificationBadge');
    const notificationsContainer = document.getElementById('notificationsContainer');
    const markAllReadBtn = document.getElementById('markAllRead');

    const desktopNotificationBtn = document.getElementById('desktopNotificationBtn');
    const desktopNotificationDropdown = document.getElementById('desktopNotificationDropdown');
    const desktopNotificationBadge = document.getElementById('desktopNotificationBadge');
    const desktopNotificationsContainer = document.getElementById('desktopNotificationsContainer');
    const desktopMarkAllReadBtn = document.getElementById('desktopMarkAllRead');

    
    function initNotificationButtons() {
      if (notificationBtn) {
        notificationBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
        });
      }

      if (desktopNotificationBtn) {
        desktopNotificationBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          desktopNotificationDropdown.style.display = desktopNotificationDropdown.style.display === 'block' ? 'none' : 'block';
        });
      }

           document.addEventListener('click', (e) => {
        if (notificationDropdown && !notificationDropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
          notificationDropdown.style.display = 'none';
        }
        if (desktopNotificationDropdown && !desktopNotificationDropdown.contains(e.target) && !desktopNotificationBtn.contains(e.target)) {
          desktopNotificationDropdown.style.display = 'none';
        }
      });
    }



        function setupMarkAllRead() {
      const markAllRead = async (container) => {
        document.querySelectorAll('.notification-item.unread').forEach(item => {
          item.classList.remove('unread');
        });
        unreadNotifications = 0;
        updateNotificationBadge();

        try {
          await fetch('/api/notifications/mark-all-read', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err) {
          console.error('Error marking all as read:', err);
        }
      };

      if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => markAllRead(notificationsContainer));
      }
      if (desktopMarkAllReadBtn) {
        desktopMarkAllReadBtn.addEventListener('click', () => markAllRead(desktopNotificationsContainer));
      }
    }


      function updateNotificationBadge() {
      const badgeText = unreadNotifications > 99 ? '99+' : unreadNotifications;
      [notificationBadge, desktopNotificationBadge].forEach(badge => {
        if (badge) {
          badge.textContent = badgeText;
          badge.classList.toggle('hidden', unreadNotifications === 0);
        }
      });
    }

    function formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addNotificationToUI(data, container) {
      const notification = document.createElement('div');
      notification.className = `notification-item ${data.isRead ? '' : 'unread'}`;
      notification.innerHTML = `
        <div class="flex gap-3">
          <img src="${data.senderAvatar || '/default-avatar.png'}" class="notification-avatar">
          <div class="flex-1">
            <p class="text-sm font-medium mb-1"><strong>${data.senderName}</strong> sent you a message</p>
            <p class="text-xs text-gray-600 mb-1">${data.preview}...</p>
            <p class="text-xs text-gray-500">${formatTime(data.timestamp)}</p>
          </div>
        </div>
      `;

      notification.addEventListener('click', async () => {
        if (!data.isRead) {
          notification.classList.remove('unread');
          unreadNotifications--;
          updateNotificationBadge();
          try {
            await fetch(`/api/notifications/${data.id}/read`, { method: 'PUT' });
          } catch (err) {
            console.error('Error marking notification as read:', err);
          }
        }
        window.location.href = `/api/v1/user/chat/${data.senderId}`;
      });

      container?.prepend(notification);
    }


     function checkActiveChat() {
      const chatMatch = window.location.pathname.match(/\/chat\/([^\/]+)/);
      if (chatMatch) {
        currentChatUserId = chatMatch[1];
        isUserInChat = currentChatUserId !== currentUserId;
      } else {
        isUserInChat = false;
        currentChatUserId = null;
      }
    }

    socket.on('new_message_notification', async (data) => {
      checkActiveChat();
      if (isUserInChat && data.senderId === currentChatUserId) return;

      const recipientStatus = document.getElementById(`${data.senderId}-status`)?.textContent;
      const isRecipientOnline = recipientStatus === 'Online';

      if (!isRecipientOnline || !isUserInChat) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile && 'serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(`New message from ${data.senderName}`, {
              body: data.preview,
              icon: data.senderAvatar || '/default-avatar.png',
              data: { url: `/api/v1/user/chat/${data.senderId}` },
              vibrate: [200, 100, 200]
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
      }
    });

    async function updateUnreadCount() {
      try {
        const res = await fetch('/api/notifications/unread-count');
        const { count } = await res.json();
        unreadNotifications = count;
        updateNotificationBadge();
      } catch (err) {
        console.error('Failed to get unread count:', err);
      }
    }

    async function loadNotifications() {
      try {
        const res = await fetch('/api/notifications');
        const { notifications } = await res.json();

        [notificationsContainer, desktopNotificationsContainer].forEach(container => {
          if (container) container.innerHTML = '';
        });

        unreadNotifications = 0;
        notifications.forEach(notification => {
          const notificationData = {
            id: notification._id,
            senderId: notification.sender._id,
            senderName: notification.sender.username,
            senderAvatar: notification.sender.profilePic,
            preview: notification.message.substring(0, 30),
            timestamp: notification.createdAt,
            isRead: notification.isRead
          };

          [notificationsContainer, desktopNotificationsContainer].forEach(container => {
            if (container) addNotificationToUI(notificationData, container);
          });

          if (!notification.isRead) unreadNotifications++;
        });

        updateNotificationBadge();
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    }

    let isWindowFocused = true;
    window.addEventListener('focus', () => {
      isWindowFocused = true;
      loadNotifications();
    });

    window.addEventListener('blur', () => {
      isWindowFocused = false;
    });

    function handleInAppNotification(data) {
      unreadNotifications++;
      updateNotificationBadge();
      [notificationsContainer, desktopNotificationsContainer].forEach(container => {
        if (container) addNotificationToUI(data, container);
      });
    }

    function showDesktopNotification(data) {
      if (!('Notification' in window)) return;

      if (Notification.permission === 'granted') {
        const notification = new Notification(`New message from ${data.senderName}`, {
          body: data.preview,
          icon: data.senderAvatar || '/default-avatar.png'
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = `/api/v1/user/chat/${data.senderId}`;
        };
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            const notification = new Notification(`New message from ${data.senderName}`, {
              body: data.preview,
              icon: data.senderAvatar || '/default-avatar.png'
            });

            notification.onclick = () => {
              window.focus();
              window.location.href = `/api/v1/user/chat/${data.senderId}`;
            };
          }
        });
      }
    }

    async function initializePushNotifications() {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array('<%= process.env.VAPID_PUBLIC_KEY %>')
            });

            await fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: currentUserId, subscription })
            });
          }
        } catch (err) {
          console.error('Push notification initialization failed:', err);
        }
      }
    }

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
    }

    document.addEventListener('DOMContentLoaded', () => {
      checkActiveChat();
      initNotificationButtons();
      setupMarkAllRead();
      loadNotifications();
      initializePushNotifications();

      if ('Notification' in window) Notification.requestPermission();

      setInterval(updateUnreadCount, 30000);
    });

    socket.on("getOnlineUser", (data) => {
      const el = document.getElementById(data.user_id + "-status");
      if (el) {
        el.textContent = "Online";
        el.classList.remove("offline-status");
        el.classList.add("online-status");
      }
    });

    socket.on("getOfflineUser", (data) => {
      const el = document.getElementById(data.user_id + "-status");
      if (el) {
        el.textContent = "Offline";
        el.classList.remove("online-status");
        el.classList.add("offline-status");
      }
    });

    $('#searchInput').on('keyup', function () {
      const value = $(this).val().toLowerCase().trim();
      $('.user-filter-card').each(function () {
        const username = $(this).data('username');
        const email = $(this).data('email');
        $(this).toggle(username.includes(value) || email.includes(value));
      });
    });


    document.addEventListener("DOMContentLoaded", () => {
      const menuToggle = document.getElementById("menuToggle");
      const closeSidebar = document.getElementById("closeSidebar");
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("sidebarOverlay");

      function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("open");
        document.body.style.overflow = 'hidden';
      }

      function closeSidebarFunc() {
        sidebar.classList.remove("open");
        overlay.classList.remove("open");
        document.body.style.overflow = '';
      }

      menuToggle.addEventListener("click", openSidebar);
      closeSidebar.addEventListener("click", closeSidebarFunc);
      overlay.addEventListener("click", closeSidebarFunc);
    });