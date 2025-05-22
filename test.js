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
    const params = {
      headers: {
        'x-apikey': config['x-apikey'],
      },
    };
    const res = http.get(url, params);
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

  function generateSimpleHtml(data) {
    const metrics = data.metrics;
    const safeMetrics = Object.entries(metrics)
      .filter(([_, m]) => m && m.values)
      .map(([name, m]) => {
        return {
          name,
          count: m.values.count || 0,
          avg: m.values.avg || 0,
          p95: m.values.p95 || 0,
          max: m.values.max || 0,
          fails: m.values.fails || 0
        };
      });
  
    const rows = safeMetrics.map(metric => {
      const failedPercent =
        metric.count > 0 ? ((metric.fails / metric.count) * 100).toFixed(2) + "%" : "0.00%";
      return `
        <tr>
          <td>${metric.name}</td>
          <td>${metric.count}</td>
          <td>${metric.avg.toFixed(2)}</td>
          <td>${metric.p95.toFixed(2)}</td>
          <td>${metric.max.toFixed(2)}</td>
          <td>${failedPercent}</td>
        </tr>
      `;
    }).join('');
  
    return `
      <html>
        <head>
          <title>K6 Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
            table { border-collapse: collapse; width: 100%; background: #fff; }
            th, td { padding: 10px; border: 1px solid #ccc; text-align: left; }
            th { background: #2c3e50; color: #fff; }
            tr:nth-child(even) { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>🚀 K6 Test Report</h1>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Count</th>
                <th>Avg</th>
                <th>P95</th>
                <th>Max</th>
                <th>Failed %</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `;
  }