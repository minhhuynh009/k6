//! k6:compatibility-mode=extended
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const config = new SharedArray('config', function () {
  return [JSON.parse(open('./config.json'))];
})[0];

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
  scenarios: {
    default: {
      executor: 'constant-arrival-rate',
      rate: config.rps,
      timeUnit: '1s',
      duration: config.duration,
      preAllocatedVUs: config.vus,
      maxVUs: config.vus * 2,
    },
  },
};

export default function () {
  for (const url of config.endpoints) {
    const res = http.get(url);
    check(res, {
      'status is 200': (r) => r.status === 200,
    });
    sleep(1);
  }
}

export function handleSummary(data) {
    console.log('✅ handleSummary is running');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`./summary-${timestamp}.html`]: htmlReport(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
      };
  }

function htmlReport(data) {
  const style = `
    body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; padding: 20px; color: #333; }
    h1 { text-align: center; color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
    th, td { padding: 12px 16px; text-align: left; vertical-align: top; }
    th { background: #34495e; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    .pass { background-color: #d4edda !important; }
    .fail { background-color: #f8d7da !important; }
    .metric-note { font-size: 0.85em; color: #555; margin-top: 4px; display: block; }
  `;

  const metricDescriptions = {
    http_req_duration: "Time taken for the server to respond to a request. Goal: 95% under 500ms.",
    http_req_failed: "Proportion of requests that failed. Should be under 1%.",
    vus: "Number of Virtual Users (VUs) active during the test run.",
    iterations: "Total times the default function executed.",
    data_received: "Amount of data received from the server (bytes).",
    data_sent: "Amount of data sent to the server (bytes).",
    http_reqs: "Total number of HTTP requests made.",
    checks: "Total number of checks performed."
  };

  const metricUnits = {
    http_req_duration: "s",
    data_received: "bytes",
    data_sent: "bytes",
    vus: "",
    iterations: "",
    http_reqs: "",
    checks: "",
    http_req_failed: "%"
  };

  const rows = Object.entries(data.metrics).map(([name, metric]) => {
    const count = metric.values.count || 0;
    const fails = metric.values.fails || 0;
    let avg = metric.values.avg || 0;
    let p95 = metric.values.p95 || 0;
    let max = metric.values.max || 0;
    const failedPercent = count > 0 ? ((fails / count) * 100).toFixed(2) + '%' : '0.00%';

    const thresholdStatus = data.thresholds[name];
    const status = thresholdStatus && thresholdStatus.ok === false ? 'fail' : 'pass';

    const note = metricDescriptions[name] ? `<span class='metric-note'>${metricDescriptions[name]}</span>` : '';
    const unit = metricUnits[name] || '';

    if (unit === 's') {
      avg = avg / 1000;
      p95 = p95 / 1000;
      max = max / 1000;
    }

    return `<tr class="${status}">
      <td>${name}${note}</td>
      <td>${count}</td>
      <td>${avg.toFixed(2)} ${unit}</td>
      <td>${p95.toFixed(2)} ${unit}</td>
      <td>${max.toFixed(2)} ${unit}</td>
      <td>${failedPercent}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>K6 Test Summary</title>
      <style>${style}</style>
    </head>
    <body>
      <h1>🚀 K6 Stress Test Report</h1>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Count</th>
            <th>Avg</th>
            <th>P(95)</th>
            <th>Max</th>
            <th>Failed %</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>`;
}
