import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['src/main.tsx','src/router.tsx','src/routes/__root.tsx','src/routes/index.tsx','src/routes/localized-home.tsx','src/routes/route-tree.ts'];
const failures = [];
for (const file of files) if (!fs.existsSync(path.join(root,file))) failures.push(`Missing runtime file: ${file}`);
const read = (file) => fs.readFileSync(path.join(root,file),'utf8');
const rootSource = read('src/routes/__root.tsx');
if (!rootSource.includes('<Suspense')) failures.push('Root route must guard lazy route rendering with Suspense.');
if (!rootSource.includes('<Outlet />')) failures.push('Root route must contain the router Outlet.');
const routerSource = read('src/router.tsx');
if (!routerSource.includes('rootRoute.addChildren(routeChildren)')) failures.push('Router must compose rootRoute + routeChildren.');
const treeSource = read('src/routes/route-tree.ts');
if (!treeSource.includes('routeChildren')) failures.push('Route tree must expose routeChildren.');
const indexSource = read('src/routes/index.tsx');
if (!indexSource.includes("path: '/'")) failures.push('Root home route must remain registered at /.');
const localizedSource = read('src/routes/localized-home.tsx');
if (!localizedSource.includes("path: '/$locale'")) failures.push('Localized home route must remain parameterized by locale.');
if (failures.length) { console.error('P6-A RUNTIME ROUTE CONTRACT: FAIL'); failures.forEach((failure)=>console.error(`- ${failure}`)); process.exit(1); }
console.log('P6-A RUNTIME ROUTE CONTRACT: PASS');
