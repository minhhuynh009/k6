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
      executor: 'constant-arrival-rate', //constant-vus
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
      // headers: {
      //   'x-apikey': config['x-apikey'],
      //   'Accept': 'application/json',
      //   'User-Agent': 'PostmanRuntime/7.32.3',
      //   'Accept-Encoding': 'gzip, deflate, br',
      //   'Connection': 'keep-alive',
      // },
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

