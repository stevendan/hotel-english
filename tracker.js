(function () {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyI_X-V9KimBBY4cyIEuXdA5kMBdZKHPULz6izhqICsvoyiHLJ1nL3QS67EiJvgTBV4Ew/exec';
  var LS_KEY = 'hotel_english_session';
  var LS_DEVICE_NAME = 'hotel_english_device_name';

  function getDeviceName() {
    var name = localStorage.getItem(LS_DEVICE_NAME);
    if (!name) {
      name = prompt('Vui lòng nhập tên thiết bị (hoặc bỏ trống để bỏ qua):', '');
      if (name && name.trim()) {
        localStorage.setItem(LS_DEVICE_NAME, name.trim());
      } else {
        localStorage.setItem(LS_DEVICE_NAME, '(Không có)');
      }
    }
    return name;
  }

  function detectInfo() {
    var ua = navigator.userAgent;

    var os = 'Unknown';
    if (/Windows NT/.test(ua))       os = 'Windows';
    else if (/Android/.test(ua)) {
      var m = ua.match(/Android ([\d.]+)/);
      os = 'Android' + (m ? ' ' + m[1] : '');
    } else if (/iPhone|iPad|iPod/.test(ua)) {
      var m2 = ua.match(/OS ([\d_]+)/);
      os = 'iOS' + (m2 ? ' ' + m2[1].replace(/_/g, '.') : '');
    } else if (/Mac OS X/.test(ua))   os = 'macOS';
    else if (/Linux/.test(ua))        os = 'Linux';

    var browser = 'Unknown';
    if (/Edg\//.test(ua)) {
      var b = ua.match(/Edg\/([\d]+)/);
      browser = 'Edge ' + (b ? b[1] : '');
    } else if (/OPR\//.test(ua)) {
      var b2 = ua.match(/OPR\/([\d]+)/);
      browser = 'Opera ' + (b2 ? b2[1] : '');
    } else if (/Chrome\//.test(ua)) {
      var b3 = ua.match(/Chrome\/([\d]+)/);
      browser = 'Chrome ' + (b3 ? b3[1] : '');
    } else if (/Firefox\//.test(ua)) {
      var b4 = ua.match(/Firefox\/([\d]+)/);
      browser = 'Firefox ' + (b4 ? b4[1] : '');
    } else if (/Safari\//.test(ua))   browser = 'Safari';

    var deviceType = 'Desktop';
    if (/Mobile/.test(ua))            deviceType = 'Mobile';
    else if (/Tablet|iPad/.test(ua))  deviceType = 'Tablet';

    return { os: os, browser: browser, deviceType: deviceType,
             deviceName: getDeviceName(),
             screenWidth: screen.width + 'x' + screen.height };
  }

  function fmtDate(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  }

  function fmtTime(d) {
    return String(d.getHours()).padStart(2, '0') + ':'
      + String(d.getMinutes()).padStart(2, '0') + ':'
      + String(d.getSeconds()).padStart(2, '0');
  }

  // Gửi dữ liệu lên Google Sheets
  // onSuccess được gọi trong .then() — chỉ khi mạng thực sự nhận request
  function tryFetch(data, onSuccess) {
    fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',   // Tránh CORS preflight, response sẽ opaque nhưng vẫn gửi được
      body: JSON.stringify(data),
      keepalive: true    // Cho phép request hoàn thành sau khi tab đóng (trên desktop)
    }).then(function () {
      if (onSuccess) onSuccess();
    }).catch(function () {});
  }

  // ─── Xử lý session tồn đọng từ lần mở trước ───────────────────────────────
  try {
    var prev = localStorage.getItem(LS_KEY);
    if (prev) {
      var p = JSON.parse(prev);
      if (!p.sentOk) {
        // Lần đóng trước: fetch chưa hoàn thành (iOS suspend, mất mạng, v.v.)
        // → Gửi lại ngay bây giờ
        if (!p.timeClose) { p.timeClose = p.timeOpen; p.duration = 0; }
        delete p._openMs;
        delete p.sentOk;
        tryFetch(p, null);
      }
      localStorage.removeItem(LS_KEY);
    }
  } catch (e) {}

  // ─── Bắt đầu phiên mới ────────────────────────────────────────────────────
  var info = detectInfo();
  var openTime = new Date();
  var closed = false;

  function makeSession(t) {
    return {
      date: fmtDate(t), timeOpen: fmtTime(t),
      timeClose: '', duration: '',
      deviceType: info.deviceType, os: info.os,
      browser: info.browser, deviceName: info.deviceName,
      screenWidth: info.screenWidth,
      _openMs: t.getTime(),
      sentOk: false
    };
  }

  var currentSession = makeSession(openTime);

  function closeSession() {
    if (closed) return;
    closed = true;

    var t = new Date();
    currentSession.timeClose = fmtTime(t);
    currentSession.duration = Math.round((t.getTime() - currentSession._openMs) / 60000);
    delete currentSession._openMs;

    // Lưu vào localStorage TRƯỚC (phòng iOS kill process trước khi fetch xong)
    try { localStorage.setItem(LS_KEY, JSON.stringify(currentSession)); } catch (e) {}

    // Thử gửi lên Sheets; nếu thành công thì đánh dấu sentOk = true
    tryFetch(currentSession, function () {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          var s = JSON.parse(raw);
          s.sentOk = true;
          localStorage.setItem(LS_KEY, JSON.stringify(s));
        }
      } catch (e) {}
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      // Tab ẩn: chuyển app, khoá màn hình, chuyển tab → ghi nhận đóng
      closeSession();
    } else if (document.visibilityState === 'visible' && closed) {
      // Quay lại trang → bắt đầu phiên mới
      closed = false;
      openTime = new Date();
      currentSession = makeSession(openTime);
    }
  });

  window.addEventListener('beforeunload', function () {
    if (closed) return;
    closed = true;

    var t = new Date();
    currentSession.timeClose = fmtTime(t);
    currentSession.duration = Math.round((t.getTime() - currentSession._openMs) / 60000);
    delete currentSession._openMs;

    // Lưu vào localStorage
    try { localStorage.setItem(LS_KEY, JSON.stringify(currentSession)); } catch (e) {}

    // Dùng sendBeacon (được thiết kế cho beforeunload - đảm bảo gửi xong)
    try {
      navigator.sendBeacon(SCRIPT_URL, JSON.stringify(currentSession));
    } catch (e) {}
  });
})();
