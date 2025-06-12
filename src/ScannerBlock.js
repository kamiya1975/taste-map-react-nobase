// src/ScannerBlock.js
import React, { useState } from 'react';
import QrReader from 'react-qr-reader';

const ScannerBlock = ({ data, onMatched, onClose }) => {
  const [scanned, setScanned] = useState(false);

  return (
    <div style={{ maxWidth: '400px', marginBottom: '10px' }}>
      <QrReader
        delay={300}
        onError={() => alert("カメラアクセスに失敗しました")}
        onScan={(result) => {
          if (result && !scanned) {
            setScanned(true); // 二重発火防止
            const jan = result.trim();
            const match = data.find(d => String(d.JAN).trim() === jan);
            if (match) {
              onMatched(match);
            } else {
              alert(`「${jan}」に該当するワインが見つかりません`);
            }
            onClose(); // ✅ カメラを閉じる
          }
        }}
        style={{ width: '100%' }}
      />
    </div>
  );
};

export default ScannerBlock;
