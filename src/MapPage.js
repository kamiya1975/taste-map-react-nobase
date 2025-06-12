// src/MapPage.js
import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { QrScanner } from 'react-qr-barcode-scanner';

function MapPage() {
  const [data, setData] = useState([]);
  const [userRatings, setUserRatings] = useState({});
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [sliderPc1, setSliderPc1] = useState(50);
  const [sliderPc2, setSliderPc2] = useState(50);
  const [scanning, setScanning] = useState(false);
  const zoomFactor = 1 / zoomLevel;

  const qrRef = useRef(null);

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
        希望小売価格: metaMap[String(d.JAN)]?.希望小売価格 || null,
        商品名: metaMap[String(d.JAN)]?.商品名 || '',
        Type: metaMap[String(d.JAN)]?.Type || '',
      }));
      setData(merged);
    });
  }, []);

  const xValues = data.map(d => d.BodyAxis);
  const yValues = data.map(d => d.SweetAxis);
  const x_min = Math.min(...xValues);
  const x_max = Math.max(...xValues);
  const y_min = Math.min(...yValues);
  const y_max = Math.max(...yValues);

  const distances = data.map(d => {
    const dx = d.BodyAxis - target.x;
    const dy = d.SweetAxis - target.y;
    return { ...d, distance: Math.sqrt(dx * dx + dy * dy) };
  }).sort((a, b) => a.distance - b.distance).slice(0, 10);

  const handleSliderChange = (val, axis) => {
    axis === 'pc1' ? setSliderPc1(val) : setSliderPc2(val);
    const mappedX = ((val - 50) / 50) * (x_max - x_min) * 0.4;
    const mappedY = ((sliderPc2 - 50) / 50) * (y_max - y_min) * 0.4;
    setTarget({ x: axis === 'pc1' ? mappedX : target.x, y: axis === 'pc2' ? mappedY : target.y });
  };

  const handleScanSuccess = (result) => {
    if (!result?.text) return;
    const match = data.find(d => String(d.JAN).trim() === result.text.trim());
    if (match) {
      setTarget({ x: match.BodyAxis, y: match.SweetAxis });
      setSliderPc1(Math.round(((match.BodyAxis / (x_max - x_min)) * 50) + 50));
      setSliderPc2(Math.round(((match.SweetAxis / (y_max - y_min)) * 50) + 50));
    } else {
      alert(`「${result.text}」に該当するワインが見つかりません`);
    }
    setScanning(false);
  };

  const handleScanError = (err) => {
    console.error(err);
    setScanning(false);
    alert('カメラアクセスに失敗しました');
  };

  const x_range = [
    target.x - ((x_max - x_min) / 2) * zoomFactor,
    target.x + ((x_max - x_min) / 2) * zoomFactor
  ];

  const y_range = [
    target.y - ((y_max - y_min) / 2) * zoomFactor,
    target.y + ((y_max - y_min) / 2) * zoomFactor
  ];

  const typeColor = { Spa: 'blue', White: 'gold', Red: 'red', Rose: 'pink' };
  const typeList = ['Spa', 'White', 'Red', 'Rose'];

  return (
    <div style={{ padding: '10px' }}>
      <h2>SAKELAVO</h2>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => setZoomLevel(z => Math.min(z + 1, 10))}>＋</button>
        <button onClick={() => setZoomLevel(z => Math.max(z - 1, 0.2))}>−</button>
        <button onClick={() => setScanning(true)}>📷 JANスキャン</button>
      </div>

      {scanning && (
        <div style={{ maxWidth: '100%' }}>
          <QrScanner
            ref={qrRef}
            onResult={handleScanSuccess}
            onError={handleScanError}
            constraints={{ facingMode: 'environment' }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      <div>
        <p>コク（軽やか〜濃厚）</p>
        <input type="range" min="0" max="100" value={sliderPc1} onChange={e => handleSliderChange(Number(e.target.value), 'pc1')} />
        <p>甘さ（控えめ〜強め）</p>
        <input type="range" min="0" max="100" value={sliderPc2} onChange={e => handleSliderChange(Number(e.target.value), 'pc2')} />
      </div>

      <Plot
        useResizeHandler={true}
        style={{ width: 'calc(100vw - 20px)', height: '100%' }}
        key={zoomLevel + JSON.stringify(target)}
        data={[
          ...typeList.map(type => ({
            x: data.filter(d => d.Type === type).map(d => d.BodyAxis),
            y: data.filter(d => d.Type === type).map(d => d.SweetAxis),
            mode: 'markers', type: 'scatter',
            marker: { size: 5, color: typeColor[type] },
            name: type
          })),
          {
            x: [target.x], y: [target.y],
            mode: 'markers', type: 'scatter',
            marker: { size: 20, color: 'green', symbol: 'x' },
            name: 'あなたの好み', hoverinfo: 'skip'
          },
          {
            x: distances.map(d => d.BodyAxis),
            y: distances.map(d => d.SweetAxis),
            text: distances.map((_, i) => '❶❷❸❹❺❻❼❽❾❿'[i]),
            mode: 'markers+text', type: 'scatter',
            marker: { size: 10, color: 'white' },
            textfont: { color: 'black', size: 12 },
            textposition: 'middle center',
            name: 'TOP10', showlegend: false
          }
        ]}
        layout={{
          margin: { l: 30, r: 30, t: 30, b: 30 },
          xaxis: {
            range: x_range, showticklabels: false, zeroline: false,
            showgrid: true, gridcolor: 'lightgray', gridwidth: 1,
            scaleanchor: 'y', scaleratio: 1,
            mirror: true, linecolor: 'black', linewidth: 2
          },
          yaxis: {
            range: y_range, showticklabels: false, zeroline: false,
            showgrid: true, gridcolor: 'lightgray', gridwidth: 1,
            scaleanchor: 'x', scaleratio: 1,
            mirror: true, linecolor: 'black', linewidth: 2
          },
          legend: {
            orientation: 'h', x: 0.5, y: -0.25, xanchor: 'center', yanchor: 'top'
          }
        }}
        config={{ responsive: true, scrollZoom: true, displayModeBar: false }}
      />

      <h3>あなたの好みに寄り添うワイン</h3>
      {distances.map((item, index) => (
        <div key={item.JAN}>
          <strong>{index + 1}. {item.商品名} ({item.Type}) {item.希望小売価格 ? `${parseInt(item.希望小売価格).toLocaleString()} 円` : '価格未設定'}</strong>
        </div>
      ))}
    </div>
  );
}

export default MapPage;