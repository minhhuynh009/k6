//! k6:compatibility-mode=extended
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

function parseDuration(str) {
  const m = str.match(/^([\d.]+)(ms|s|m)$/);
  if (!m) throw new Error(`Invalid duration: ${str}`);
  const v = parseFloat(m[1]);
  return m[2] === 'ms' ? v : m[2] === 's' ? v * 1_000 : v * 60_000;
}

function timeoutExpectations() {
  return {
    connection: '1s',
    response: '10s',
  };
}

const cfg = new SharedArray('cfg', () => [JSON.parse(open('./config2.json'))])[0];

const EXP = timeoutExpectations();
const EXP_CONN_MS = parseDuration(EXP.connection);
const EXP_RESP_MS = parseDuration(EXP.response);
const REQ_TIMEOUT = EXP_CONN_MS + EXP_RESP_MS;

export const options = {
  scenarios: {
    perf: {
      executor: 'constant-arrival-rate',
      rate: cfg.rps,
      timeUnit: '1s',
      duration: cfg.duration,
      preAllocatedVUs: cfg.vus,
      maxVUs: cfg.vus,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01']
  },
};

let connBreaches = 0;
let respBreaches = 0;

export default function () {
  for (const url of cfg.endpoints) {
    const res = http.get(url, { timeout: `${REQ_TIMEOUT}ms` });

    const connTime = res.timings.connecting;
    const respTime = res.timings.duration;

    if (connTime > EXP_CONN_MS) connBreaches++;
    if (respTime > EXP_RESP_MS) respBreaches++;

    check(res, {
      'status 200': (r) => r.status === 200,
      [`connection ≤ ${EXP.connection}`]: (r) => r.timings.connecting <= EXP_CONN_MS,
      [`response ≤ ${EXP.response}`]: (r) => r.timings.duration <= EXP_RESP_MS,
    });
    sleep(1);
  }
}

// export function handleSummary(data) {
//   const summary = `\n================ TIMEOUT EXPECTATION ================\n` +
//     `connection ≤ ${EXP.connection} | response ≤ ${EXP.response}\n` +
//     `breached connection timeout : ${connBreaches}\n` +
//     `breached response timeout  : ${respBreaches}\n`;

//   return {
//     stdout: textSummary(data, { indent: '  ', enableColors: true }) + summary,
//   };
// }

export function handleSummary(data) {
    console.log('✅ handleSummary is running');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return {
        [`./summary-${timestamp}.html`]: htmlReport(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
      };
  }


