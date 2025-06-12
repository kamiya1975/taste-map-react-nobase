// src/MapPage.js
import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { BrowserMultiFormatReader } from '@zxing/browser';

function MapPage() {
  const [data, setData] = useState([]);
  const [userRatings, setUserRatings] = useState({});
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [baseWine, setBaseWine] = useState(null);
  const [slider_pc1, setSliderPc1] = useState(50);
  const [slider_pc2, setSliderPc2] = useState(50);

  const zoomFactor = 1 / zoomLevel;

  useEffect(() => {
    fetch('/pca_result.csv')
      .then(res => res.text())
      .then(pcaText => {
        fetch('/Merged_TasteDataDB15.csv')
          .then(res => res.text())
          .then(metaText => {
            const parseCSV = (csvText) => {
              const rows = csvText.trim().split('\n');
              const headers = rows[0].split(',');
              return rows.slice(1).map(row => {
                const values = row.split(',');
                const entry = {};
                headers.forEach((h, i) => {
                  entry[h] = isNaN(values[i]) ? values[i] : parseFloat(values[i]);
                });
                return entry;
              });
            };
            const pcaData = parseCSV(pcaText);
            const metaData = parseCSV(metaText);
            const metaMap = Object.fromEntries(metaData.map(d => [String(d.JAN), d]));
            const merged = pcaData.map(d => ({
              ...d,
              希望小売価格: metaMap[String(d.JAN)]?.希望小売価格 || null
            }));
            setData(merged);
          });
      });
  }, []);

  useEffect(() => {
    if (!baseWine) return;
    const x_min = Math.min(...data.map(d => d.BodyAxis));
    const x_max = Math.max(...data.map(d => d.BodyAxis));
    const y_min = Math.min(...data.map(d => d.SweetAxis));
    const y_max = Math.max(...data.map(d => d.SweetAxis));

    const range_left_x = baseWine.BodyAxis - x_min;
    const range_right_x = x_max - baseWine.BodyAxis;
    const range_down_y = baseWine.SweetAxis - y_min;
    const range_up_y = y_max - baseWine.SweetAxis;

    const newTarget = {
      x: slider_pc1 <= 50
        ? baseWine.BodyAxis - ((50 - slider_pc1) / 50) * range_left_x
        : baseWine.BodyAxis + ((slider_pc1 - 50) / 50) * range_right_x,
      y: slider_pc2 <= 50
        ? baseWine.SweetAxis - ((50 - slider_pc2) / 50) * range_down_y
        : baseWine.SweetAxis + ((slider_pc2 - 50) / 50) * range_up_y,
    };
    setTarget(newTarget);
  }, [slider_pc1, slider_pc2, baseWine, data]);

  const handleScan = async () => {
    const codeReader = new BrowserMultiFormatReader();
    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices[0].deviceId;

      codeReader.decodeOnceFromVideoDevice(selectedDeviceId, 'scanner', (result) => {
        const jan = result.getText().trim();
        const match = data.find(d => String(d.JAN).trim() === jan);
        if (match) {
          setBaseWine(match);
        } else {
          alert(`「${jan}」に該当するワインが見つかりません`);
        }
        codeReader.reset(); // ✅ カメラを止める
      });
    } catch (err) {
      alert('カメラアクセスに失敗しました');
    }
  };

  const distances = data.map(d => {
    const dx = d.BodyAxis - target.x;
    const dy = d.SweetAxis - target.y;
    return { ...d, distance: Math.sqrt(dx * dx + dy * dy) };
  }).sort((a, b) => a.distance - b.distance).slice(0, 10);

  const top10List = distances.map((item, index) => (
    <div key={item.JAN}><strong>{index + 1}. {item['商品名']} ({item.Type})</strong></div>
  ));

  return (
    <div style={{ padding: '10px' }}>
      <h2>SAKELAVO</h2>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => setZoomLevel(z => Math.min(z + 0.5, 10))}>＋</button>
        <button onClick={() => setZoomLevel(z => Math.max(z - 0.5, 0.5))}>−</button>
        <button onClick={handleScan}>📷 JANスキャン</button>
      </div>

      <div id="scanner" style={{ width: '100%', height: '240px', marginTop: '10px' }}></div>

      <div>
        <label>コク（軽やか〜濃厚）</label>
        <input type="range" min="0" max="100" value={slider_pc1} onChange={(e) => setSliderPc1(Number(e.target.value))} />
      </div>
      <div>
        <label>甘さ（控えめ〜強め）</label>
        <input type="range" min="0" max="100" value={slider_pc2} onChange={(e) => setSliderPc2(Number(e.target.value))} />
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>あなたの好みに寄り添うワイン</h3>
        {top10List}
      </div>
    </div>
  );
}

export default MapPage;