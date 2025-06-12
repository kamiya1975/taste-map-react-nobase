import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

function MapPage() {
  const [data, setData] = useState([]);
  const [zoomLevel, setZoomLevel] = useState(2.0); // 初期ズームイン
  const zoomFactor = 1 / zoomLevel;

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

      // JANコードでマージ
      const merged = pcaData.map(pcaItem => {
        const metaItem = metaData.find(m => m.JAN === pcaItem.JAN);
        return metaItem ? { ...pcaItem, ...metaItem } : pcaItem;
      });

      setData(merged);
    });
  }, []);

  // TOP10のみ抽出して囲み数字に変換
  const top10 = data.slice(0, 10).map((d, i) => ({
    ...d,
    rankLabel: ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'][i]
  }));

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <Plot
        data={[
          // TOP10 バブル（白文字、黒丸）
          {
            x: top10.map(d => d.BodyAxis),
            y: top10.map(d => d.SweetAxis),
            text: top10.map(d => `${d.rankLabel} ${d["商品名"]}`),
            mode: 'markers+text',
            type: 'scatter',
            marker: {
              size: 14,
              color: 'black',
              opacity: 0.8,
              line: { color: 'white', width: 1 },
            },
            textfont: {
              color: 'white',
              size: 14,
            },
            hoverinfo: 'text',
            name: 'Top10',
          },
          // その他のバブル（灰色）
          {
            x: data.map(d => d.BodyAxis),
            y: data.map(d => d.SweetAxis),
            text: data.map(d => d["商品名"]),
            mode: 'markers',
            type: 'scatter',
            marker: {
              size: 8,
              color: 'gray',
              opacity: 0.6,
            },
            hoverinfo: 'text',
            name: 'Others',
          },
        ]}
        layout={{
          width: 800,
          height: 600,
          title: 'PCAワインマップ（スライダー・基準ワインなし）',
          xaxis: {
            title: 'Body Axis',
            showgrid: true,
            zeroline: false,
            showticklabels: true,
          },
          yaxis: {
            title: 'Sweetness Axis',
            showgrid: true,
            zeroline: false,
            showticklabels: true,
          },
          dragmode: 'pan',
        }}
        config={{
          responsive: true,
          scrollZoom: true, // ピンチズーム対応
          displayModeBar: true,
        }}
      />
    </div>
  );
}

export default MapPage;