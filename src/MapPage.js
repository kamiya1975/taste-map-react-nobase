// src/MapPage.js
import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { BrowserMultiFormatReader } from '@zxing/browser';

function MapPage() {
  const [data, setData] = useState([]);
  const [userRatings, setUserRatings] = useState({});
  const [zoomLevel, setZoomLevel] = useState(2.0);
  const [target, setTarget] = useState({ x: 0, y: 0 });
  const [sliderPC1, setSliderPC1] = useState(50);
  const [sliderPC2, setSliderPC2] = useState(50);
  const [scanning, setScanning] = useState(false);
  const codeReaderRef = useRef(null);
  const videoRef = useRef(null);
  const zoomFactor = 1 / zoomLevel;

  useEffect(() => {
    const handleResize = () => window.dispatchEvent(new Event('resize'));
    setTimeout(handleResize, 300);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ratingOptions = ["未評価", "★", "★★", "★★★", "★★★★", "★★★★★"];

  const handleRatingChange = (jan, rating) => {
    setUserRatings(prev => ({ ...prev, [jan]: rating }));
  };

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
        希望小売価格: metaMap[String(d.JAN)]?.希望小売価格 || null
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

  const typeColor = { Spa: 'blue', White: 'gold', Red: 'red', Rose: 'pink' };
  const typeList = ['Spa', 'White', 'Red', 'Rose'];

  const top10List = distances.map((item, index) => {
    const jan = item.JAN;
    const currentRating = userRatings[jan] || 0;
    const price = item.希望小売価格 !== null ? `${parseInt(item.希望小売価格).toLocaleString()} 円` : "価格未設定";
    return (
      <div key={jan} className="top10-item">
        <strong>{`${index + 1}.`} {item['商品名']} ({item.Type}) {price}</strong>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
          <select value={currentRating} onChange={(e) => handleRatingChange(jan, parseInt(e.target.value))}>
            {ratingOptions.map((label, idx) => (
              <option key={idx} value={idx}>{label}</option>
            ))}
          </select>
        </div>
      </div>
    );
  });

  const x_range = [
    target.x - ((x_max - x_min) / 2) * zoomFactor,
    target.x + ((x_max - x_min) / 2) * zoomFactor
  ];
  const y_range = [
    target.y - ((y_max - y_min) / 2) * zoomFactor,
    target.y + ((y_max - y_min) / 2) * zoomFactor
  ];

  const handlePlotClick = (event) => {
    if (event?.points?.length > 0) {
      const pt = event.points[0];
      setTarget({ x: pt.x, y: pt.y });
    }
  };

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    try {
      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      const selectedDeviceId = videoInputDevices[0]?.deviceId;

      codeReader.decodeOnceFromVideoDevice(selectedDeviceId, videoRef.current).then(result => {
        const jan = result.getText().trim();
        const found = data.find(d => String(d.JAN).trim() === jan);
        if (found) {
          setTarget({ x: found.BodyAxis, y: found.SweetAxis });

          // 値の位置に合わせてスライダー初期値更新
          const bodyRatio = (found.BodyAxis - x_min) / (x_max - x_min);
          const sweetRatio = (found.SweetAxis - y_min) / (y_max - y_min);
          setSliderPC1(Math.round(bodyRatio * 100));
          setSliderPC2(Math.round(sweetRatio * 100));
        } else {
          alert(`「${jan}」に該当する商品が見つかりませんでした`);
        }
        codeReader.reset();
        setScanning(false);
      });
    } catch (err) {
      console.error(err);
      alert("カメラの使用ができませんでした");
      setScanning(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <h2>SAKELAVO</h2>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={() => setZoomLevel(prev => Math.min(prev + 1.0, 10))}>＋</button>
        <button onClick={() => setZoomLevel(prev => Math.max(prev - 1.0, 0.2))}>−</button>
        <button onClick={handleScan}>📷 JANスキャン</button>
      </div>

      {scanning && (
        <div style={{ width: '100%', maxWidth: '480px', marginBottom: '10px' }}>
          <video ref={videoRef} style={{ width: '100%' }} />
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label>コク（軽やか〜濃厚）</label>
        <input type="range" min="0" max="100" value={sliderPC1} onChange={(e) => {
          const val = Number(e.target.value);
          setSliderPC1(val);
          const x = x_min + (x_max - x_min) * (val / 100);
          setTarget(prev => ({ ...prev, x }));
        }} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>甘さ（控えめ〜強め）</label>
        <input type="range" min="0" max="100" value={sliderPC2} onChange={(e) => {
          const val = Number(e.target.value);
          setSliderPC2(val);
          const y = y_min + (y_max - y_min) * (val / 100);
          setTarget(prev => ({ ...prev, y }));
        }} />
      </div>

      <div className="plot-container">
        <Plot
          useResizeHandler={true}
          style={{ width: 'calc(100vw - 20px)', height: '100%' }}
          key={JSON.stringify(userRatings) + zoomLevel + JSON.stringify(target)}
          onClick={handlePlotClick}
          data={[
            ...typeList.map(type => ({
              x: data.filter(d => d.Type === type).map(d => d.BodyAxis),
              y: data.filter(d => d.Type === type).map(d => d.SweetAxis),
              text: data.filter(d => d.Type === type).map(d => d["商品名"]),
              hoverinfo: 'text+name',
              mode: 'markers',
              type: 'scatter',
              marker: { size: 5, color: typeColor[type] },
              name: type,
            })),
            ...Object.entries(userRatings).filter(([jan, rating]) => rating > 0).map(([jan, rating]) => {
              const wine = data.find(d => String(d.JAN).trim() === String(jan).trim());
              if (!wine) return null;
              return {
                x: [wine.BodyAxis], y: [wine.SweetAxis],
                text: [""],
                mode: 'markers+text', type: 'scatter',
                marker: {
                  size: rating * 6 + 8, color: 'orange', opacity: 0.8,
                  line: { color: 'green', width: 1.5 },
                },
                textposition: 'bottom center', name: '評価バブル', showlegend: false,
                hoverinfo: 'skip',
              };
            }).filter(Boolean),
            {
              x: [target.x], y: [target.y],
              mode: 'markers', type: 'scatter',
              marker: { size: 20, color: 'green', symbol: 'x' },
              name: 'あなたの好み', hoverinfo: 'skip',
            },
            {
              x: distances.map(d => d.BodyAxis),
              y: distances.map(d => d.SweetAxis),
              text: distances.map((d, i) => '❶❷❸❹❺❻❼❽❾❿'[i] || `${i + 1}`),
              mode: 'markers+text', type: 'scatter',
              marker: { size: 10, color: 'white' },
              textfont: { color: 'black', size: 12 },
              textposition: 'middle center',
              name: 'TOP10', showlegend: false,
              hoverinfo: 'text',
            },
          ]}
          layout={{
            margin: { l: 30, r: 30, t: 30, b: 30 }, dragmode: 'pan',
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
      </div>

      <h2>あなたの好みに寄り添うワイン</h2>
      {top10List}
    </div>
  );
}

export default MapPage;