// src/QrScanner.js
import React, { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QrScanner = ({ onScanSuccess, onClose }) => {
  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        onScanSuccess(decodedText);
        scanner.stop().then(() => {
          if (onClose) onClose();
        });
      },
      () => {
        // 無視：失敗時何もしない
      }
    );

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScanSuccess, onClose]);

  return (
    <div style={{ width: '100%', height: '300px', marginBottom: '10px' }}>
      <div id="qr-reader" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default QrScanner;
