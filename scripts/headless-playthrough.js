#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'artifacts');
const REPORT_PATH = path.join(REPORT_DIR, 'headless-playthrough-report.json');
const TRANSITION_TARGET = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    const relativePath = decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath);
    const absolutePath = path.resolve(rootDir, `.${relativePath}`);
    if (!absolutePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    fs.readFile(absolutePath, (err, data) => {
      if (err) {
        const statusCode = err.code === 'ENOENT' ? 404 : 500;
        res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(statusCode === 404 ? 'Not found' : 'Internal server error');
        return;
      }
      const ext = path.extname(absolutePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
}

async function runPlaythrough() {
  const server = createStaticServer(ROOT_DIR);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  const consoleLog = [];

  page.on('pageerror', (error) => {
    pageErrors.push({
      name: error.name,
      message: error.message,
      stack: error.stack || null,
    });
  });

  page.on('console', (message) => {
    const entry = {
      type: message.type(),
      text: message.text(),
      location: message.location(),
    };
    consoleLog.push(entry);
    if (entry.type === 'error') consoleErrors.push(entry);
  });

  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(
      () => typeof update === 'function' && typeof resetLevel === 'function' && typeof STATE === 'object'
    );

    const transitions = await page.evaluate((targetTransitions) => {
      const nextLevel = (level) => (level % MAX_LEVEL) + 1;
      const records = [];

      // Keep run deterministic and side-effect free in headless mode.
      AudioSystem.init = () => {};
      AudioSystem.playMusic = () => {};
      AudioSystem.stopMusic = () => {};
      AudioSystem.pauseMusic = () => {};
      AudioSystem.resumeMusic = () => {};
      AudioSystem.playSFX = () => {};

      gameState = STATE.PLAYING;
      score = 0;
      coins = 0;
      lives = 3;
      resetLevel(false);

      for (let i = 0; i < targetTransitions; i++) {
        const beforeLevel = currentLevel;
        const beforeArea = currentArea;
        const expectedAfter = nextLevel(beforeLevel);

        currentArea = 'main';
        applyCurrentAreaData();
        gameState = STATE.PLAYING;

        mario.x = 210 * TILE - mario.w / 2;
        mario.y = 9 * TILE;
        mario.vx = 0;
        mario.vy = 0;
        mario.grounded = true;
        mario.won = false;
        mario.onFlagpole = false;

        let loops = 0;
        while (gameState === STATE.PLAYING && loops < 800) {
          update();
          loops++;
        }

        const reachedWinState = gameState === STATE.WIN;
        while ((gameState === STATE.WIN || gameState === STATE.FADE) && loops < 5000) {
          update();
          loops++;
        }

        records.push({
          transition: i + 1,
          beforeLevel,
          afterLevel: currentLevel,
          expectedAfterLevel: expectedAfter,
          reachedWinState,
          finalState: gameState,
          beforeArea,
          afterArea: currentArea,
          updateLoops: loops,
        });
      }

      return records;
    }, TRANSITION_TARGET);

    const mismatches = transitions.filter((item) => {
      return item.afterLevel !== item.expectedAfterLevel || !item.reachedWinState || item.finalState !== 'INTRO';
    });

    const result = {
      transitionTarget: TRANSITION_TARGET,
      transitions,
      mismatchCount: mismatches.length,
      mismatches,
      pageErrorCount: pageErrors.length,
      pageErrors,
      consoleErrorCount: consoleErrors.length,
      consoleErrors,
      consoleLogCount: consoleLog.length,
      passed: mismatches.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0,
    };

    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(result, null, 2));

    if (!result.passed) {
      console.error(`Playthrough failed. See report: ${REPORT_PATH}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Playthrough passed (${TRANSITION_TARGET} transitions). Report: ${REPORT_PATH}`);
  } finally {
    await context.close();
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

runPlaythrough().catch((error) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const failure = {
    transitionTarget: TRANSITION_TARGET,
    fatalError: {
      message: error.message,
      stack: error.stack || null,
    },
    passed: false,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(failure, null, 2));
  console.error(`Playthrough crashed. See report: ${REPORT_PATH}`);
  process.exit(1);
});
