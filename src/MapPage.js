import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import QrReader from 'react-qr-reader';

function MapPage() {
  const [data, setData] = useState([]);
  const [userRatings, setUserRatings] = useState({});
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [sliderPc1, setSliderPc1] = useState(50);
  const [sliderPc2, setSliderPc2] = useState(50);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const handleResize = () => window.dispatchEvent(new Event('resize'));
    setTimeout(handleResize, 300);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/pca_result.csv').then(res => res.text()),
      fetch('/Merged_TasteDataDB15.csv').then(res => res.text())
    ]).then(([pcaText, metaText]) => {
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
        商品名: metaMap[String(d.JAN)]?.商品名 || '',
        Type: metaMap[String(d.JAN)]?.Type || '',
        希望小売価格: metaMap[String(d.JAN)]?.希望小売価格 || null,
      }));
      setData(merged);
    });
  }, []);

  useEffect(() => {
    const x = (sliderPc1 / 100) * 20 - 7.5;
    const y = (sliderPc2 / 100) * 20 - 7.5;
    setTarget({ x, y });
  }, [sliderPc1, sliderPc2]);

  const handleRatingChange = (jan, rating) => {
    setUserRatings(prev => ({ ...prev, [jan]: rating }));
  };

  const handleScan = (result) => {
    if (result && !scanned) {
      setScanned(true); // 1回だけ読み取り
      const jan = result.trim();
      const match = data.find(d => String(d.JAN).trim() === jan);
      if (match && !isNaN(match.BodyAxis) && !isNaN(match.SweetAxis)) {
        setTarget({ x: match.BodyAxis, y: match.SweetAxis });
        setSliderPc1((match.BodyAxis + 7.5) * (100 / 20));
        setSliderPc2((match.SweetAxis + 7.5) * (100 / 20));
      } else {
        alert(`「${jan}」に該当するワインが見つかりません`);
      }
      setScanning(false); // カメラを閉じる
      setTimeout(() => setScanned(false), 1000); // フラグ初期化
    }
  };

  const xValues = data.map(d => d.BodyAxis);
  const yValues = data.map(d => d.SweetAxis);

  const distances = data.map(d => {
    const dx = d.BodyAxis - target.x;
    const dy = d.SweetAxis - target.y;
    return { ...d, distance: Math.sqrt(dx * dx + dy * dy) };
  }).sort((a, b) => a.distance - b.distance).slice(0, 10);

  const typeColor = { Spa: 'blue', White: 'gold', Red: 'red', Rose: 'pink' };
  const typeList = ['Spa', 'White', 'Red', 'Rose'];
  const ratingOptions = ["未評価", "★", "★★", "★★★", "★★★★", "★★★★★"];

  return (
    <div style={{ padding: '10px' }}>
      <h2>SAKELAVO</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => setZoomLevel(prev => Math.min(prev + 1.0, 10))}>＋</button>
        <button onClick={() => setZoomLevel(prev => Math.max(prev - 1.0, 0.2))}>−</button>
        <button onClick={() => setScanning(true)}>📷 JANスキャン</button>
      </div>

      {scanning && (
        <div style={{ maxWidth: '400px', marginBottom: '10px' }}>
          <QrReader
            delay={300}
            onError={() => alert("カメラアクセスに失敗しました")}
            onScan={handleScan}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <label>コク（軽やか〜濃厚）</label>
      <input type="range" min="0" max="100" value={sliderPc1} onChange={e => setSliderPc1(parseInt(e.target.value))} style={{ width: '100%' }} />

      <label>甘さ（控えめ〜強め）</label>
      <input type="range" min="0" max="100" value={sliderPc2} onChange={e => setSliderPc2(parseInt(e.target.value))} style={{ width: '100%' }} />

      <Plot
        useResizeHandler
        style={{ width: '100%', height: '400px' }}
        data={[
          ...typeList.map(type => ({
            x: data.filter(d => d.Type === type).map(d => d.BodyAxis),
            y: data.filter(d => d.Type === type).map(d => d.SweetAxis),
            mode: 'markers',
            type: 'scatter',
            marker: { size: 6, color: typeColor[type] },
            name: type
          })),
          {
            x: [target.x], y: [target.y],
            mode: 'markers',
            type: 'scatter',
            marker: { size: 20, color: 'green', symbol: 'x' },
            name: 'あなたの好み',
          },
          {
            x: distances.map(d => d.BodyAxis),
            y: distances.map(d => d.SweetAxis),
            text: distances.map((_, i) => '❶❷❸❹❺❻❼❽❾❿'[i] || `${i + 1}`),
            mode: 'markers+text',
            type: 'scatter',
            marker: { size: 10, color: 'black' },
            textfont: { color: 'white', size: 12 },
            textposition: 'middle center',
            name: 'TOP10',
            hoverinfo: 'text',
          }
        ]}
        layout={{
          xaxis: { showticklabels: false, zeroline: false },
          yaxis: { showticklabels: false, zeroline: false },
          margin: { l: 30, r: 30, t: 30, b: 30 },
          dragmode: 'pan',
          showlegend: true
        }}
        config={{ responsive: true, scrollZoom: true, displayModeBar: false }}
      />

      <h3>あなたの好みに寄り添うワイン</h3>
      {distances.map((item, index) => (
        <div key={item.JAN} style={{ marginBottom: '8px' }}>
          <strong>
            {index + 1}. {item.商品名} ({item.Type}) {item.希望小売価格 ? `${item.希望小売価格.toLocaleString()} 円` : '価格未設定'}
          </strong>
          <select
            value={userRatings[item.JAN] || 0}
            onChange={(e) => handleRatingChange(item.JAN, parseInt(e.target.value))}
            style={{ minWidth: '90px', marginLeft: '10px' }}
          >
            {ratingOptions.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export default MapPage;
