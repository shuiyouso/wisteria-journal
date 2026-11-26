// 用本机已装的 Playwright 驱动真实 Chromium，对本地站点做交互测试。
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const rtDir = path.join(os.homedir(), '.dsh', 'data', 'dsh-slidestudio', 'playwright-runtime');
const { chromium } = await import(pathToFileURL(path.join(rtDir, 'node_modules', 'playwright', 'index.mjs')).href);

const URL = 'http://127.0.0.1:8765/';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  → ' + extra : ''));
};

const browser = await chromium.launch({ executablePath: path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium_headless_shell-1248', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });

// 1 首页
check('首页三张入口卡片', await page.locator('#homeCards .card').count() === 3);
check('统计条 3 个', await page.locator('#stats .stat').count() === 3);
check('首页无脚本错误', errors.length === 0, errors.join(' | '));

// 2 新增一条幸福收藏
await page.click('a[data-view="happy"]');
await page.click('#btnNew');
await page.fill('#fDate', '2026-11-20');
await page.fill('#fTitle', '测试记录一条');
await page.fill('#fBody', '这是自动化测试写入的内容。');
await page.fill('#fTags', '测试，自动');
await page.click('#btnSave');
await page.waitForTimeout(300);
check('新增后列表出现记录', (await page.locator('#list .item').count()) >= 1);

// 3 刷新后仍在
await page.reload({ waitUntil: 'networkidle' });
await page.click('a[data-view="happy"]');
await page.waitForTimeout(300);
check('刷新后记录仍在', await page.locator('#list .item', { hasText: '测试记录一条' }).count() === 1);

// 4 搜索
await page.fill('#q', '不存在的关键词xyz');
await page.waitForTimeout(200);
check('搜索无结果时显示空态', await page.locator('#list .empty').count() === 1);
await page.fill('#q', '测试记录');
await page.waitForTimeout(200);
check('搜索能命中', await page.locator('#list .item').count() === 1);
await page.fill('#q', '');
await page.waitForTimeout(200);

// 5 标签筛选
const tagOptions = await page.locator('#fTag option').count();
check('标签下拉有内容', tagOptions >= 3, 'options=' + tagOptions);
await page.selectOption('#fTag', '测试');
await page.waitForTimeout(200);
check('按标签筛选有效', await page.locator('#list .item').count() === 1);
await page.selectOption('#fTag', '');
await page.waitForTimeout(200);

// 6 编辑
await page.locator('#list .item').first().locator('button[data-act="edit"]').click();
await page.fill('#fTitle', '测试记录已改');
await page.click('#btnSave');
await page.waitForTimeout(800);
check('编辑后标题更新', await page.locator('#list .item h3', { hasText: '测试记录已改' }).count() === 1);

// 7 心情花笺
await page.click('a[data-view="mood"]');
await page.click('#btnNew');
await page.fill('#fWhat', '今天做测试。');
await page.locator('[data-mood="平静"]').click();
await page.locator('[data-mood="释然"]').click();
await page.click('#btnSave');
await page.waitForTimeout(300);
check('新增心情记录', await page.locator('#list .item').count() === 1);
check('情绪标签显示在卡片上', await page.locator('#list .item .meta', { hasText: '平静' }).count() === 1);

// 8 情绪筛选
const moodOptions = await page.locator('#fMood option').count();
check('情绪下拉有内容', moodOptions >= 3, 'options=' + moodOptions);
await page.selectOption('#fMood', '平静');
await page.waitForTimeout(200);
check('按情绪筛选有效', await page.locator('#list .item').count() === 1);
await page.selectOption('#fMood', '');
await page.waitForTimeout(200);

// 9 快速/完整模式
await page.click('#btnNew');
await page.locator('[data-mode="full"]').click();
check('完整模式展开可选字段', await page.locator('[data-full="1"]:not(.hidden)').count() >= 4);
await page.locator('[data-mode="quick"]').click();
check('快速模式收起可选字段', await page.locator('[data-full="1"]:not(.hidden)').count() === 0);
await page.click('#btnCancel');

// 10 桌面宽度
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(200);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check('桌面端无横向溢出', !overflow);

// 11 备份页
await page.click('a[data-view="backup"]');
await page.waitForTimeout(200);
check('备份页导出按钮存在', await page.locator('#btnExportAll').count() === 1);
await page.click('#btnCheckLegacy');
await page.waitForTimeout(300);
const legacyText = await page.locator('#legacyResult').innerText();
check('旧数据检查有结果', /条/.test(legacyText), legacyText.replace(/\n/g, ' ').slice(0, 60));

// 12 无未捕获错误
check('全程无脚本错误', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: 'test-shot.png', fullPage: false });
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log('\nSUMMARY total=' + results.length + ' failed=' + failed.length);
process.exit(failed.length ? 1 : 0);
