(function () {
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzUE7CV4FILgZV475EDZsEuPfWHq2Gyva1iZQXYUErZ4UuZBZ5wsIidMUB5e8i76IQJvw/exec';
  var LS_KEY = 'hotel_english_session';

  function detectInfo() {
    var ua = navigator.userAgent;

    var os = 'Unknown';
    if (/Windows NT 10|Windows NT 11/.test(ua)) os = 'Windows 10/11';
    else if (/Windows/.test(ua)) os = 'Windows';
    else if (/Android/.test(ua)) {
      var m = ua.match(/Android ([\d.]+)/);
      os = 'Android' + (m ? ' ' + m[1] : '');
    } else if (/iPhone|iPad|iPod/.test(ua)) {
      var m2 = ua.match(/OS ([\d_]+)/);
      os = 'iOS' + (m2 ? ' ' + m2[1].replace(/_/g, '.') : '');
    } else if (/Mac OS X/.test(ua)) os = 'macOS';
    else if (/Linux/.test(ua)) os = 'Linux';

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
    } else if (/Safari\//.test(ua)) {
      browser = 'Safari';
    }

    var deviceType = 'Desktop';
    if (/Mobile/.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/.test(ua)) deviceType = 'Tablet';

    return {
      os: os,
      browser: browser,
      deviceType: deviceType,
      screenWidth: screen.width + 'x' + screen.height
    };
  }

  function fmtDate(d) {
    var dd = String(d.getDate()).padStart(2, '0');
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var yyyy = d.getFullYear();
    return yyyy + '-' + mm + '-' + dd;
  }

  function fmtTime(d) {
    var hh = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var ss = String(d.getSeconds()).padStart(2, '0');
    return hh + ':' + min + ':' + ss;
  }

  function send(data) {
    try {
      fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(data),
        keepalive: true
      });
    } catch (e) {}
  }

  // Gửi session còn tồn đọng từ lần mở trước (nếu có)
  try {
    var pending = localStorage.getItem(LS_KEY);
    if (pending) {
      var p = JSON.parse(pending);
      if (!p.sent) {
        if (!p.timeClose) {
          p.timeClose = p.timeOpen; // Đóng đột ngột, không ghi nhận được
          p.duration = 0;
        }
        p.sent = true;
        send(p);
      }
      localStorage.removeItem(LS_KEY);
    }
  } catch (e) {}

  // Bắt đầu phiên mới
  var info = detectInfo();
  var openTime = new Date();
  var session = {
    date: fmtDate(openTime),
    timeOpen: fmtTime(openTime),
    timeClose: '',
    duration: '',
    deviceType: info.deviceType,
    os: info.os,
    browser: info.browser,
    screenWidth: info.screenWidth,
    _openMs: openTime.getTime(),
    sent: false
  };

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(session));
  } catch (e) {}

  var closed = false;

  function closeSession() {
    if (closed) return;
    closed = true;
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s.sent) return;
      var closeTime = new Date();
      s.timeClose = fmtTime(closeTime);
      s.duration = Math.round((closeTime.getTime() - s._openMs) / 60000);
      delete s._openMs;
      s.sent = true;
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      send(s);
    } catch (e) {}
  }

  // Phát hiện đóng tab / chuyển trang
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      closeSession();
    } else {
      // Người dùng quay lại tab — mở phiên mới
      closed = false;
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) {
          var s = JSON.parse(raw);
          if (s.sent) {
            // Phiên cũ đã gửi, tạo phiên mới
            var t = new Date();
            var newSession = {
              date: fmtDate(t),
              timeOpen: fmtTime(t),
              timeClose: '',
              duration: '',
              deviceType: info.deviceType,
              os: info.os,
              browser: info.browser,
              screenWidth: info.screenWidth,
              _openMs: t.getTime(),
              sent: false
            };
            localStorage.setItem(LS_KEY, JSON.stringify(newSession));
            openTime = t;
          }
        }
      } catch (e) {}
    }
  });

  window.addEventListener('beforeunload', function () {
    closeSession();
  });
})();
